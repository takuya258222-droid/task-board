"use strict";
// Code.gs の reopen/delete/state をスタブで検証する使い捨てテスト
const fs = require("fs");
const vm = require("vm");

function makeSheet(rows) {
  return {
    rows,
    getDataRange() { return { getValues: () => this.rows.map((r) => r.slice()) }; },
    appendRow(r) { this.rows.push(r.slice()); },
    getRange(row, col) {
      const self = this;
      return { setValues(vals) { for (let r = 0; r < vals.length; r++) { while (self.rows.length < row + r) self.rows.push([]); for (let c = 0; c < vals[r].length; c++) self.rows[row - 1 + r][col - 1 + c] = vals[r][c]; } } };
    },
  };
}
const sheets = {
  "タスク": makeSheet([
    ["id", "type"],
    ["mail:111.1", "mail", "", "", "", "", "", "", "", "", "D0BGG9SUBEK", "111.1"],
    ["assign:A20261118-001", "member", "", "", "", "", "", "", "", "", "D0MEMBER", "222.2"],
  ]),
  "処理待ち": makeSheet([["actionId", "taskId", "action", "requestedAt", "status"]]),
  "案件": makeSheet([
    ["eventId"],
    ["evT", "テスト施設", "テスト様", "自分", "11/1 10時", "2026-11-01T10:00:00+09:00", "③書類回収", "[]", "進行中"],
  ]),
  "要確認": makeSheet([
    ["kind", "label", "detail", "days", "refId", "detectedAt"],
    ["naitei-overdue", "テスト確認", "詳細テスト", 3, "evT", "2026-11-18"],
  ]),
  "送信記録": makeSheet([
    ["member", "sentAt", "kind"],
    ["和田", "2026-11-17T10:00:00.000Z", "button"],
  ]),
  "完了履歴": makeSheet([
    ["closedAt", "type", "typeLabel", "title", "howLabel", "owner", "id", "reopenable", "channel", "ts"],
    ["2026-11-17", "mail", "メール", "テストメールタスク", "✅で完了", "自分", "mail:111.1", "1", "D0BGG9SUBEK", "111.1"],
    ["2026-11-17", "tour", "面談", "終了案件", "失注", "自分", "case:evX", "", "", ""],
    ["2026-11-16", "onboarding", "入社", "入社ステージ", "✅で完了", "自分", "onboarding:333.3", "", "D0BGG9SUBEK", "333.3"],
  ]),
  "メンバー": makeSheet([["label"]]),
  "タスク付帯": makeSheet([["taskId", "due", "memo", "updatedAt"]]),
};
const sandbox = {
  console,
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n], insertSheet: (n) => { sheets[n] = makeSheet([]); return sheets[n]; } }) },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { createTextOutput: (s) => ({ setMimeType() { return s; } }), MimeType: { JSON: "json" } },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("/home/hatch/workspace/task-board/apps-script/Code.gs", "utf8"), sandbox);

const post = (obj) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(obj) } }));
const get = () => JSON.parse(sandbox.doGet({ parameter: { action: "state" } }));
let fails = 0;
const check = (name, cond, extra) => { console.log((cond ? "PASS " : "FAIL ") + name + (extra ? ":: " + extra : "")); if (!cond) fails++; };

// reopen: 正常系
let r = post({ action: "reopen", id: "mail:111.1" });
check("reopen ok", r.ok === true && r.pending === true, JSON.stringify(r));
const rows = sheets["処理待ち"].rows;
const reRow = rows.find((x) => x[2] === "reopen");
check("reopen行が処理待ちに追加", Boolean(reRow));
check("reopen行に channel/ts が引き継がれる", reRow && reRow[7] === "D0BGG9SUBEK" && reRow[8] === "111.1");
check("reopen行 status=未適用", reRow && reRow[4] === "未適用");

// reopen: 冪等
r = post({ action: "reopen", id: "mail:111.1" });
check("reopen二重は already", r.ok === true && r.already === true);
check("reopen行は増えない", sheets["処理待ち"].rows.filter((x) => x[2] === "reopen").length === 1);

// reopen: 対象外ケース
r = post({ action: "reopen", id: "case:evX" });
check("失注案件は not_reopenable", r.ok === false && r.error === "not_reopenable", JSON.stringify(r));
r = post({ action: "reopen", id: "onboarding:333.3" });
check("入社は not_reopenable", r.ok === false && r.error === "not_reopenable");
r = post({ action: "reopen", id: "mail:unknown" });
check("未知のidは history_not_found", r.ok === false && r.error === "history_not_found");
r = post({ action: "reopen" });
check("idなしは missing_id", r.ok === false && r.error === "missing_id");

// delete: 正常系
r = post({ action: "delete", id: "mail:111.1" });
check("delete ok", r.ok === true && r.pending === true, JSON.stringify(r));
const delRow = sheets["処理待ち"].rows.find((x) => x[2] === "delete");
check("delete行に channel/ts が入る", delRow && delRow[7] === "D0BGG9SUBEK" && delRow[8] === "111.1");
r = post({ action: "delete", id: "mail:111.1" });
check("delete二重は already", r.ok === true && r.already === true);
r = post({ action: "delete", id: "assign:A20261118-001" });
check("割当タスクも delete ok", r.ok === true, JSON.stringify(r));
r = post({ action: "delete", id: "mail:unknown" });
check("未知のタスクは task_not_found", r.ok === false && r.error === "task_not_found");

// state: 履歴に id/reopenable/pending が出る
const st = get();
const h1 = st.history.find((x) => x.id === "mail:111.1");
check("state履歴に id/reopenable", h1 && h1.reopenable === true);
check("state履歴に pending（reopen未適用）", h1 && h1.pending === true);
const h2 = st.history.find((x) => x.id === "case:evX");
check("失注行は reopenable=false", h2 && h2.reopenable === false);
const t1 = st.tasks.find((x) => x.id === "mail:111.1");
check("stateタスクに pending（delete未適用）", t1 && t1.pending === true);
check("failures は空（失敗行なし）", Array.isArray(st.failures) && st.failures.length === 0);

// setMeta: 新規追加と state へのマージ
r = post({ action: "setMeta", id: "mail:111.1", due: "2026-11-25", memo: "電話で確認する" });
check("setMeta ok", r.ok === true && r.metaDue === "2026-11-25" && r.memo === "電話で確認する", JSON.stringify(r));
check("タスク付帯に行が追加", sheets["タスク付帯"].rows.some((x) => x[0] === "mail:111.1" && x[1] === "2026-11-25" && x[2] === "電話で確認する"));
let st2 = get();
const tm = st2.tasks.find((x) => x.id === "mail:111.1");
check("stateに metaDue/memo がマージされる", tm && tm.metaDue === "2026-11-25" && tm.memo === "電話で確認する");
const tmNone = st2.tasks.find((x) => x.id === "assign:A20261118-001");
check("付帯のないタスクは metaDue/memo が空文字", tmNone && tmNone.metaDue === "" && tmNone.memo === "");

// setMeta: upsert（更新・クリア）で行は増えない
r = post({ action: "setMeta", id: "mail:111.1", due: "", memo: "" });
check("setMetaクリア ok", r.ok === true && r.metaDue === "" && r.memo === "");
check("upsertで行は増えない", sheets["タスク付帯"].rows.filter((x) => x[0] === "mail:111.1").length === 1);
st2 = get();
const tm2 = st2.tasks.find((x) => x.id === "mail:111.1");
check("クリア後は metaDue/memo が空", tm2 && tm2.metaDue === "" && tm2.memo === "");

// setMeta: エラー系と memo 切り詰め
r = post({ action: "setMeta", due: "2026-11-25", memo: "x" });
check("setMeta idなしは missing_id", r.ok === false && r.error === "missing_id");
r = post({ action: "setMeta", id: "mail:111.1", due: "2026/11/25" });
check("due形式不正は bad_due", r.ok === false && r.error === "bad_due", JSON.stringify(r));
r = post({ action: "setMeta", id: "mail:111.1", memo: "あ".repeat(600) });
check("memoは500文字に切り詰め", r.ok === true && r.memo.length === 500, "len=" + (r.memo || "").length);

// ---- v4: sendSummary ----
r = post({ action: "sendSummary", member: "和田" });
check("sendSummary ok", r.ok === true && r.pending === true, JSON.stringify(r));
const sumRow = sheets["処理待ち"].rows.find((x) => x[2] === "sendSummary");
check("sendSummary行（taskId=summary:和田 / J=メンバー）", Boolean(sumRow) && sumRow[1] === "summary:和田" && sumRow[9] === "和田" && sumRow[4] === "未適用");
r = post({ action: "sendSummary", member: "和田" });
check("sendSummary二重は already", r.ok === true && r.already === true);
check("sendSummary行は増えない", sheets["処理待ち"].rows.filter((x) => x[2] === "sendSummary").length === 1);
r = post({ action: "sendSummary" });
check("sendSummary memberなしは missing_member", r.ok === false && r.error === "missing_member");
let st3 = get();
check("state.summaryPending に和田", Array.isArray(st3.summaryPending) && st3.summaryPending.includes("和田"));
check("state.summarySent に送信記録の和田", st3.summarySent && typeof st3.summarySent["和田"] === "string" && st3.summarySent["和田"].length > 0);
check("state.alerts に要確認1件", Array.isArray(st3.alerts) && st3.alerts.length === 1 && st3.alerts[0].kind === "naitei-overdue" && st3.alerts[0].days === 3);
check("state に sheetUpdatedAt キーがある", "sheetUpdatedAt" in st3);

// ---- v4: addMeeting ----
r = post({ action: "addMeeting", text: "テスト面談の貼り付け文", assignee: "和田" });
check("addMeeting ok", r.ok === true && r.pending === true, JSON.stringify(r));
const mtgRow = sheets["処理待ち"].rows.find((x) => x[2] === "addMeeting");
check("addMeeting行（J=text / K=assignee）", Boolean(mtgRow) && mtgRow[9] === "テスト面談の貼り付け文" && mtgRow[10] === "和田");
r = post({ action: "addMeeting", text: "  " });
check("addMeeting text空は missing_text", r.ok === false && r.error === "missing_text");
st3 = get();
check("state.meetingAdds に1件", Array.isArray(st3.meetingAdds) && st3.meetingAdds.length === 1 && st3.meetingAdds[0].assignee === "和田");

// ---- addStart（入社待ちの直接追加） ----
r = post({ action: "addStart", text: "テスト施設 テスト太郎様 内定済み", date: "2026-12-15" });
check("addStart ok", r.ok === true && r.pending === true, JSON.stringify(r));
const startRow = sheets["処理待ち"].rows.find((x) => x[2] === "addStart");
check("addStart行（J=text / K=入社日 / status=未適用）", Boolean(startRow) && startRow[9] === "テスト施設 テスト太郎様 内定済み" && startRow[10] === "2026-12-15" && startRow[4] === "未適用");
check("addStart行の taskId は actionId と同じ（要確認の参照キー）", Boolean(startRow) && startRow[1] === startRow[0] && String(startRow[0]).indexOf("start") === 0);
r = post({ action: "addStart", date: "2026-12-15" });
check("addStart textなしは missing_text", r.ok === false && r.error === "missing_text");
r = post({ action: "addStart", text: "   ", date: "2026-12-15" });
check("addStart text空白のみは missing_text", r.ok === false && r.error === "missing_text");
r = post({ action: "addStart", text: "テスト施設 テスト太郎様" });
check("addStart dateなしは missing_date", r.ok === false && r.error === "missing_date");
r = post({ action: "addStart", text: "テスト施設 テスト太郎様", date: "2026/12/15" });
check("addStart date形式不正は bad_date", r.ok === false && r.error === "bad_date", JSON.stringify(r));
r = post({ action: "addStart", text: "テスト施設 テスト太郎様", date: "2026-12-5" });
check("addStart date桁不正は bad_date", r.ok === false && r.error === "bad_date");
check("エラー時は行が増えない", sheets["処理待ち"].rows.filter((x) => x[2] === "addStart").length === 1);
st3 = get();
check("state.startAdds に1件（text/date）", Array.isArray(st3.startAdds) && st3.startAdds.length === 1 && st3.startAdds[0].text === "テスト施設 テスト太郎様 内定済み" && st3.startAdds[0].date === "2026-12-15");

// ---- addStart: 担当・書類回収済み（L列=担当 / M列=書類回収済みフラグ） ----
r = post({ action: "addStart", text: "テスト施設 テスト花子様 内定済み", date: "2026-12-20", assignee: "和田", docsCollected: true });
check("addStart（担当・書類回収済みつき） ok", r.ok === true && r.pending === true, JSON.stringify(r));
const startRow2 = sheets["処理待ち"].rows.filter((x) => x[2] === "addStart")[1];
check("addStart行に L=担当 / M=\"1\"（書類回収済み）", Boolean(startRow2) && startRow2[11] === "和田" && startRow2[12] === "1", JSON.stringify(startRow2));
r = post({ action: "addStart", text: "テスト施設 テスト次郎様 内定済み", date: "2026-12-22", docsCollected: false });
check("addStart（assignee欠落・docsCollected=false） ok", r.ok === true && r.pending === true, JSON.stringify(r));
const startRow3 = sheets["処理待ち"].rows.filter((x) => x[2] === "addStart")[2];
check("欠落時は L=自分 / M=空（後方互換）", Boolean(startRow3) && startRow3[11] === "自分" && (startRow3[12] || "") === "", JSON.stringify(startRow3));
// 旧形式の行（11要素・L/Mなし）を直接置いても state で正規化される
sheets["処理待ち"].rows.push(["startLEGACY1", "startLEGACY1", "addStart", "2026-11-18T00:00:00.000Z", "未適用", "", "", "", "", "旧形式施設 旧形式様 内定済み", "2026-12-25"]);
let stA = get();
const saWada = stA.startAdds.find((a) => a.text.includes("花子"));
const saDef = stA.startAdds.find((a) => a.text.includes("次郎"));
const saLegacy = stA.startAdds.find((a) => a.text.includes("旧形式"));
check("state.startAdds に担当・書類回収済みが出る", Boolean(saWada) && saWada.assignee === "和田" && saWada.docsCollected === true, JSON.stringify(saWada));
check("state.startAdds 欠落分は 自分 / false", Boolean(saDef) && saDef.assignee === "自分" && saDef.docsCollected === false, JSON.stringify(saDef));
check("state.startAdds 旧形式行（L/Mなし）も 自分 / false", Boolean(saLegacy) && saLegacy.assignee === "自分" && saLegacy.docsCollected === false, JSON.stringify(saLegacy));

// ---- v4: setStartDate / setStartResult（案件付帯） ----
r = post({ action: "setStartDate", eventId: "evT", date: "2026/12/1" });
check("setStartDate 形式不正は bad_date", r.ok === false && r.error === "bad_date");
r = post({ action: "setStartDate", date: "2026-12-01" });
check("setStartDate eventIdなしは missing_event", r.ok === false && r.error === "missing_event");
r = post({ action: "setStartDate", eventId: "evT", date: "2026-12-01" });
check("setStartDate ok", r.ok === true && r.startDate === "2026-12-01", JSON.stringify(r));
check("案件付帯タブが作られヘッダー+1行", sheets["案件付帯"] && sheets["案件付帯"].rows.length === 2 && sheets["案件付帯"].rows[1][0] === "evT" && sheets["案件付帯"].rows[1][1] === "2026-12-01");
st3 = get();
const cv = st3.cases.find((x) => x.eventId === "evT");
check("state.cases に startDate がマージ", cv && cv.startDate === "2026-12-01");
check("state.cases に daysToStart（数値）", cv && typeof cv.daysToStart === "number");
r = post({ action: "setStartDate", eventId: "evT", date: "2026-12-10" });
check("setStartDate upsertで行は増えない", sheets["案件付帯"].rows.filter((x) => x[0] === "evT").length === 1 && sheets["案件付帯"].rows[1][1] === "2026-12-10");
r = post({ action: "setStartResult", eventId: "evT", result: "done" });
check("setStartResult 不正値は bad_result", r.ok === false && r.error === "bad_result");
r = post({ action: "setStartResult", eventId: "evT", result: "reschedule" });
check("reschedule に newDate 必須（bad_new_date）", r.ok === false && r.error === "bad_new_date");
r = post({ action: "setStartResult", eventId: "evT", result: "reschedule", newDate: "2026-12-20" });
check("reschedule ok（startDateも新日付に）", r.ok === true && r.result === "reschedule" && sheets["案件付帯"].rows[1][1] === "2026-12-20" && sheets["案件付帯"].rows[1][2] === "reschedule");
r = post({ action: "setStartResult", eventId: "evT", result: "started" });
check("started ok（resultDateが入る）", r.ok === true && sheets["案件付帯"].rows[1][2] === "started" && String(sheets["案件付帯"].rows[1][3] || "").length > 0);
st3 = get();
const cv2 = st3.cases.find((x) => x.eventId === "evT");
check("state.cases に startResult がマージ", cv2 && cv2.startResult === "started" && cv2.startDate === "2026-12-20");

// ---- cancelAction（反映待ちの取り消し） ----
// 前提: mail:111.1 には reopen と delete の未適用行が既にある。complete を追加し、最新から順に取り消されることを確認
r = post({ action: "complete", id: "mail:111.1" });
check("cancel前提: complete ok", r.ok === true && r.pending === true, JSON.stringify(r));
const rowsBeforeCancel = sheets["処理待ち"].rows.length;
r = post({ action: "cancelAction", id: "mail:111.1" });
check("cancelAction ok（最新=complete）", r.ok === true && r.cancelled === true && r.action === "complete", JSON.stringify(r));
const compRow = sheets["処理待ち"].rows.find((x) => x[2] === "complete" && x[1] === "mail:111.1");
check("complete行の status が取消", compRow && compRow[4] === "取消");
check("取消でも行は残る（監査）", sheets["処理待ち"].rows.length === rowsBeforeCancel);
check("delete/reopen行はまだ未適用", sheets["処理待ち"].rows.filter((x) => x[1] === "mail:111.1" && x[4] === "未適用").length === 2);
r = post({ action: "cancelAction", id: "mail:111.1" });
check("2回目は delete が取り消される", r.ok === true && r.action === "delete", JSON.stringify(r));
r = post({ action: "cancelAction", id: "mail:111.1" });
check("3回目は reopen が取り消される", r.ok === true && r.action === "reopen", JSON.stringify(r));
r = post({ action: "cancelAction", id: "mail:111.1" });
check("未適用が無くなれば no_pending_action（冪等）", r.ok === false && r.error === "no_pending_action", JSON.stringify(r));
// 取消後は pendingIds_ に出ない（state の pending が落ちる）
let st4 = get();
const tc = st4.tasks.find((x) => x.id === "mail:111.1");
check("取消後は stateタスク pending=false", tc && tc.pending === false);
const hc = st4.history.find((x) => x.id === "mail:111.1");
check("取消後は state履歴 pending=false", hc && hc.pending === false);
// エラー系
r = post({ action: "cancelAction", id: "mail:none-pending" });
check("対象なしは no_pending_action", r.ok === false && r.error === "no_pending_action");
r = post({ action: "cancelAction" });
check("idなしは missing_id", r.ok === false && r.error === "missing_id");
// 対象外アクション（sendSummary）は取り消さない
r = post({ action: "cancelAction", id: "summary:和田" });
check("sendSummary は対象外（no_pending_action）", r.ok === false && r.error === "no_pending_action");
check("sendSummary行は未適用のまま", sheets["処理待ち"].rows.find((x) => x[2] === "sendSummary")[4] === "未適用");
// 適用済の行は取り消さない
sheets["処理待ち"].rows.push(["x-applied", "mail:555.5", "complete", "2026-11-18T00:00:00.000Z", "適用済", "", "", "D0BGG9SUBEK", "555.5", "", ""]);
r = post({ action: "cancelAction", id: "mail:555.5" });
check("適用済のみは no_pending_action", r.ok === false && r.error === "no_pending_action");
check("適用済行は変更されない", sheets["処理待ち"].rows.find((x) => x[0] === "x-applied")[4] === "適用済");
// caseLost / caseClose（id = "case:<eventId>"）
r = post({ action: "caseClose", eventId: "evT", kind: "close" });
check("cancel前提: caseClose ok", r.ok === true && r.pending === true, JSON.stringify(r));
r = post({ action: "cancelAction", id: "case:evT" });
check("cancelAction caseClose ok", r.ok === true && r.action === "caseClose", JSON.stringify(r));
check("caseClose行の status が取消", sheets["処理待ち"].rows.find((x) => x[2] === "caseClose")[4] === "取消");
r = post({ action: "cancelAction", id: "case:evT" });
check("case も2回目は no_pending_action", r.ok === false && r.error === "no_pending_action");

// ---- v8: 未送信ステージの先行完了（complete の tour:pending: 特例） ----
r = post({ action: "complete", id: "tour:pending:evT:docs" });
check("pending complete ok（タスクシートに無くても積める）", r.ok === true && r.pending === true && r.already !== true, JSON.stringify(r));
const pendRow = sheets["処理待ち"].rows.find((x) => x[1] === "tour:pending:evT:docs" && x[2] === "complete");
check("pending complete行（B=id / status=未適用 / channel・ts は空）", Boolean(pendRow) && pendRow[4] === "未適用" && (pendRow[7] || "") === "" && (pendRow[8] || "") === "", JSON.stringify(pendRow));
r = post({ action: "complete", id: "tour:pending:evT:docs" });
check("pending complete二重は already", r.ok === true && r.already === true);
check("pending complete行は増えない", sheets["処理待ち"].rows.filter((x) => x[1] === "tour:pending:evT:docs").length === 1);
["offer", "duo", "sesio", "contract", "formrun", "followup"].forEach((k) => {
  const rr = post({ action: "complete", id: "tour:pending:evT:" + k });
  check("pending complete stageKey=" + k + " ok", rr.ok === true && rr.pending === true, JSON.stringify(rr));
});
// v9: offer（内定確認の先行確定）の受理・冪等・類似キーの拒否
const offerRow = sheets["処理待ち"].rows.find((x) => x[1] === "tour:pending:evT:offer" && x[2] === "complete");
check("pending offer 行が積まれている（status=未適用 / channel・ts は空）", Boolean(offerRow) && offerRow[4] === "未適用" && (offerRow[7] || "") === "" && (offerRow[8] || "") === "", JSON.stringify(offerRow));
r = post({ action: "complete", id: "tour:pending:evT:offer" });
check("pending offer 二重は already", r.ok === true && r.already === true);
check("pending offer 行は増えない", sheets["処理待ち"].rows.filter((x) => x[1] === "tour:pending:evT:offer").length === 1);
r = post({ action: "complete", id: "tour:pending:evT:offerx" });
check("pending 類似キー offerx は bad_pending_id", r.ok === false && r.error === "bad_pending_id", JSON.stringify(r));
r = post({ action: "complete", id: "tour:pending:evT:Offer" });
check("pending 大文字 Offer は bad_pending_id", r.ok === false && r.error === "bad_pending_id");
// 不正形式は bad_pending_id で拒否し、行は増えない
r = post({ action: "complete", id: "tour:pending:" });
check("pending 後続なしは bad_pending_id", r.ok === false && r.error === "bad_pending_id", JSON.stringify(r));
r = post({ action: "complete", id: "tour:pending:evT" });
check("pending stageKeyなしは bad_pending_id", r.ok === false && r.error === "bad_pending_id");
r = post({ action: "complete", id: "tour:pending::docs" });
check("pending eventId空は bad_pending_id", r.ok === false && r.error === "bad_pending_id");
r = post({ action: "complete", id: "tour:pending:evT:xyz" });
check("pending 不正stageKeyは bad_pending_id", r.ok === false && r.error === "bad_pending_id");
r = post({ action: "complete", id: "tour:pending:evT:docs:extra" });
check("pending 余分な区切りは bad_pending_id", r.ok === false && r.error === "bad_pending_id");
check("有効な pending 行は7件のみ（不正形式では増えない）", sheets["処理待ち"].rows.filter((x) => String(x[1]).indexOf("tour:pending:") === 0).length === 7);
// ---- v11: direct: で始まる案件キー（コロンを含む eventId）の先行チェック ----
r = post({ action: "complete", id: "tour:pending:direct:20261118of12o6:duo" });
check("pending complete（direct:キー）ok", r.ok === true && r.pending === true && r.already !== true, JSON.stringify(r));
const dirRow = sheets["処理待ち"].rows.find((x) => x[1] === "tour:pending:direct:20261118of12o6:duo" && x[2] === "complete");
check("pending complete行（direct:キー。B=id / status=未適用 / channel・ts は空）", Boolean(dirRow) && dirRow[4] === "未適用" && (dirRow[7] || "") === "" && (dirRow[8] || "") === "", JSON.stringify(dirRow));
r = post({ action: "complete", id: "tour:pending:direct:20261118of12o6:duo" });
check("pending complete（direct:キー）二重は already", r.ok === true && r.already === true);
check("pending complete行（direct:キー）は増えない", sheets["処理待ち"].rows.filter((x) => x[1] === "tour:pending:direct:20261118of12o6:duo").length === 1);
r = post({ action: "complete", id: "tour:pending:direct:20261118of12o6:offer" });
check("pending offer（direct:キー）ok", r.ok === true && r.pending === true, JSON.stringify(r));
r = post({ action: "complete", id: "tour:pending:direct:20261118of12o6:xyz" });
check("pending 不正stageKey（direct:キー）は bad_pending_id", r.ok === false && r.error === "bad_pending_id");
// 通常の complete は従来どおり（タスクシートに無い tour:<ts> は task_not_found）
r = post({ action: "complete", id: "tour:1794961085.408449" });
check("通常complete（tour:<ts>）は従来どおり task_not_found", r.ok === false && r.error === "task_not_found", JSON.stringify(r));
// state が pending 行を含んでも壊れない／通常タスクの pending に混ざらない
let st5 = get();
check("state取得が pending行込みでも正常", st5 && Array.isArray(st5.tasks) && Array.isArray(st5.failures));
check("pending行が通常タスクとして現れない", st5.tasks.every((t) => String(t.id).indexOf("tour:pending:") !== 0));
check("pending行は failures に混ざらない（未適用のため）", st5.failures.every((f) => String(f.taskId).indexOf("tour:pending:") !== 0));
// ---- v10: state.pendingActionIds（未適用アクションの対象ID一覧） ----
check("state に pendingActionIds（配列）がある", Array.isArray(st5.pendingActionIds));
check("pendingActionIds に先行チェック（docs）が含まれる", st5.pendingActionIds.includes("tour:pending:evT:docs"));
check("pendingActionIds に offer も含まれる", st5.pendingActionIds.includes("tour:pending:evT:offer"));
check("pendingActionIds に direct:キーの先行チェックも含まれる", st5.pendingActionIds.includes("tour:pending:direct:20261118of12o6:duo"));
check("pendingActionIds に sendSummary の対象も含まれる", st5.pendingActionIds.includes("summary:和田"));
check("pendingActionIds に適用済の行は含まれない", !st5.pendingActionIds.includes("mail:555.5"));
// cancelAction でも pending 行を取り消せる（既存の扱いに乗る）
r = post({ action: "cancelAction", id: "tour:pending:evT:docs" });
check("cancelAction で pending complete を取り消せる", r.ok === true && r.action === "complete", JSON.stringify(r));
check("pending行の status が取消", sheets["処理待ち"].rows.find((x) => x[1] === "tour:pending:evT:docs")[4] === "取消");

console.log("----");
console.log(fails ? "FAIL " + fails : "ALL PASS");
process.exit(fails ? 1 : 0);
