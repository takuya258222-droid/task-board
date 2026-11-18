/**
* タスクボード連携スクリプト
* バージョン v8（2026-11-18）: complete に tour:pending: 特例（未送信ステージの先行完了）を追加
* バージョン v9（2026-11-18）: tour:pending: の stageKey に offer（内定確認の先行確定）を追加
* 公開ページ（GitHub Pages）から Googleシート「タスクボード」を読み書きするための受け口。
* 合言葉なし＝オープンモード（URLを知っている人だけが使える、家事/西STリストと同じ方式。ボードはユーザー専用）。
* - 状態取得: GET?action=state
* - 書き込み: POST (Content-Type: text/plain, JSONボディ)
* {action:"complete", id:"<taskId>"} // 完了チェック（冪等）
* {action:"complete", id:"tour:pending:<eventId>:<stageKey>"} // 未送信ステージの先行完了（stageKey: offer/docs/duo/sesio/contract/formrun/followup。まだタスクが存在しない段階のため、タスクシート照合なしで処理待ちへ記録する。実際の消込は同期が行う）
* {action:"addTask", title:"...", datetime:"..."} // タスク追加（datetime任意）
* {action:"caseClose", eventId:"...", kind:"lost"|"close"} // 面談案件の失注/終了（冪等）
* {action:"reopen", id:"<完了履歴のid>"} // 完了の取り消し（戻す。冪等。完了履歴タブ G列=id / H列=reopenable の行だけ受け付ける）
* {action:"delete", id:"<taskId>"} // 物理削除（冪等。完了とは別アクション）
* {action:"cancelAction", id:"<taskId>"} // 反映待ちの取り消し（未適用の complete/delete/reopen/caseLost/caseClose の最新1行のステータスを「取消」に変更。行は監査として残す。同期は未適用の行だけを処理するので取消行は無視される。案件は id に "case:<eventId>" を渡す）
* {action:"setMeta", id:"<taskId>", due:"<YYYY-MM-DD|空>", memo:"<最大500文字>"} // 期日・メモ（キューを経由せず「タスク付帯」タブへ即時upsert。ボード専用データ）
* {action:"sendSummary", member:"<呼び名 or 自分>"} // その人の未対応まとめをSlack DMへ送るよう処理待ちへ記録（実際の送信は同期。冪等）
* {action:"addMeeting", text:"<貼り付けテキスト>", assignee:"<担当>"} // 面談の後入れ（処理待ちへ記録。予定作成は同期がテキストを解釈して行う）
* {action:"addStart", text:"<貼り付けテキスト>", date:"<YYYY-MM-DD>", assignee:"<担当>", docsCollected:<true|false>} // 入社待ちの直接追加（処理待ちへ記録。合成案件の記録・入社日の反映は同期が行う。assignee / docsCollected は任意で、欠けた場合は「自分」/ false として扱う）
* {action:"setStartDate", eventId:"...", date:"<YYYY-MM-DD>"} // 入社日（キューを経由せず「案件付帯」タブへ即時upsert。入社予定の作成は同期）
* {action:"setStartResult", eventId:"...", result:"started"|"cancelled"|"reschedule", newDate:"<YYYY-MM-DD>"} // 入社結果（即時upsert。reschedule は newDate を startDate にも書く）
* 実際の反映（元のSlackメッセージへの✅付与／カレンダーへの登録／tour-prep-check.md への終了記録）は
* 同期ジョブ task-board-sync が行う。このスクリプトは「処理待ち」タブへの記録だけを行う。
* データ: 「タスク」（表示データ）/「案件」（面談案件の段階詳細）/「完了履歴」/「処理待ち」（アクション記録）/「タスク付帯」（期日・メモ。同期は上書きしない）
*/

const SPREADSHEET_ID = "1NNK6qcSQpwgZPwuceHRvBJeTTy6IekZX2OWNfZjXKj0";
const SHEET_TASKS = "タスク";
const SHEET_ACTIONS = "処理待ち";
const SHEET_CASES = "案件";
const SHEET_HISTORY = "完了履歴";
const SHEET_MEMBERS = "メンバー";
const SHEET_META = "タスク付帯";
const SHEET_CASEMETA = "案件付帯";
const SHEET_ALERTS = "要確認";
const SHEET_SENDLOG = "送信記録";

function doGet(e) {
const params = (e && e.parameter) || {};
const action = params.action || "state";
if (action!== "state") return jsonOut_({ ok: false, error: "unknown_action"});
try {
const state = readState_();
state.ok = true;
return jsonOut_(state);
} catch (err) {
return jsonOut_({ ok: false, error: "server_error", message: String(err)});
}
}

function doPost(e) {
let body = {};
try {
body = JSON.parse(e.postData.contents || "{}");
} catch (err) {
return jsonOut_({ ok: false, error: "bad_json"});
}
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
} catch (err) {
return jsonOut_({ ok: false, error: "busy"});
}
try {
if (body.action === "complete") return jsonOut_(complete_(body));
if (body.action === "addTask") return jsonOut_(addTask_(body));
if (body.action === "caseClose") return jsonOut_(caseClose_(body));
if (body.action === "reopen") return jsonOut_(reopen_(body));
if (body.action === "delete") return jsonOut_(delete_(body));
if (body.action === "cancelAction") return jsonOut_(cancelAction_(body));
if (body.action === "setMeta") return jsonOut_(setMeta_(body));
if (body.action === "sendSummary") return jsonOut_(sendSummary_(body));
if (body.action === "addMeeting") return jsonOut_(addMeeting_(body));
if (body.action === "addStart") return jsonOut_(addStart_(body));
if (body.action === "setStartDate") return jsonOut_(setStartDate_(body));
if (body.action === "setStartResult") return jsonOut_(setStartResult_(body));
if (body.action === "addMember") return jsonOut_(addMember_(body));
if (body.action === "disableMember") return jsonOut_(disableMember_(body));
return jsonOut_({ ok: false, error: "unknown_action"});
} catch (err) {
return jsonOut_({ ok: false, error: "server_error", message: String(err)});
} finally {
lock.releaseLock();
}
}

function actionRows_() {
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
return ss.getSheetByName(SHEET_ACTIONS).getDataRange().getValues();
}

function pendingIds_() {
const values = actionRows_();
const ids = {};
for (let i = 1; i < values.length; i++) {
const taskId = String(values[i][1] || "");
const status = String(values[i][4] || "");
if (taskId && status === "未適用") ids[taskId] = true;
}
return ids;
}

function pendingAdds_() {
const values = actionRows_();
const adds = [];
for (let i = 1; i < values.length; i++) {
if (String(values[i][2] || "") === "add" && String(values[i][4] || "") === "未適用") {
adds.push({
title: String(values[i][9] || ""),
datetime: String(values[i][10] || ""),
assignee: String(values[i][11] || ""),
requestedAt: String(values[i][3] || "")
});
}
}
return adds;
}

function failures_() {
// タスク（または案件）ごとに最新のアクションだけを見て、それが「失敗」の場合のみ返す。
// 失敗のあとに再操作して適用済みになっていれば、古い失敗は表示しない。
const values = actionRows_();
const latest = {};
for (let i = 1; i < values.length; i++) {
const taskId = String(values[i][1] || "");
const action = String(values[i][2] || "");
if (!taskId || (action !== "complete" && action !== "caseLost" && action !== "caseClose" && action !== "reopen" && action !== "delete")) continue;
const req = String(values[i][3] || "");
if (!latest[taskId] || req > latest[taskId].requestedAt) {
latest[taskId] = { status: String(values[i][4] || ""), action: action, note: String(values[i][6] || ""), requestedAt: req };
}
}
const out = [];
for (const taskId in latest) {
if (latest[taskId].status === "失敗") {
out.push({ taskId: taskId, action: latest[taskId].action, note: latest[taskId].note, requestedAt: latest[taskId].requestedAt });
}
}
return out;
}

function metaSheet_() {
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
let sh = ss.getSheetByName(SHEET_META);
if (!sh) {
sh = ss.insertSheet(SHEET_META);
sh.appendRow(["taskId", "due", "memo", "updatedAt"]);
}
return sh;
}

function dueStr_(v) {
// セルに日付型で入っている場合は YYYY-MM-DD 文字列に戻す
if (!v) return "";
if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, "Asia/Tokyo", "yyyy-MM-dd");
return String(v);
}

function metaMap_() {
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const sh = ss.getSheetByName(SHEET_META);
const map = {};
if (!sh) return map;
const values = sh.getDataRange().getValues();
for (let i = 1; i < values.length; i++) {
const id = String(values[i][0] || "");
if (!id) continue;
map[id] = { due: dueStr_(values[i][1]), memo: String(values[i][2] || "") };
}
return map;
}

function setMeta_(body) {
const id = String(body.id || "");
if (!id) return { ok: false, error: "missing_id" };
const due = String(body.due || "").trim();
if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, error: "bad_due", id: id };
const memo = String(body.memo || "").slice(0, 500);
const sh = metaSheet_();
const values = sh.getDataRange().getValues();
const now = new Date().toISOString();
for (let i = 1; i < values.length; i++) {
if (String(values[i][0] || "") === id) {
sh.getRange(i + 1, 1, 1, 4).setValues([[id, due, memo, now]]);
return { ok: true, id: id, metaDue: due, memo: memo };
}
}
sh.appendRow([id, due, memo, now]);
return { ok: true, id: id, metaDue: due, memo: memo };
}

function readState_() {
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const pending = pendingIds_();
const meta = metaMap_();
const caseMeta = caseMetaMap_();
const summary = summaryStatus_();

const values = ss.getSheetByName(SHEET_TASKS).getDataRange().getValues();
const tasks = [];
for (let i = 1; i < values.length; i++) {
const row = values[i];
const id = String(row[0] || "");
if (!id) continue;
tasks.push({
id: id,
type: String(row[1] || ""),
typeLabel: String(row[2] || ""),
title: String(row[3] || ""),
datetimeLabel: String(row[4] || ""),
elapsedDays: Number(row[5]) || 0,
deadlineLabel: String(row[6] || ""),
slackUrl: String(row[7] || ""),
groupKey: String(row[8] || ""),
groupTitle: String(row[9] || ""),
member: String(row[14] || ""),
shareKind: String(row[15] || ""),
overdue: String(row[16] || "") === "1",
phase: String(row[17] || ""),
owner: String(row[18] || ""),
dueToday: String(row[19] || "") === "1",
eventIso: String(row[20] || ""),
pending: pending[id] === true || String(row[12] || "") === "1",
metaDue: meta[id] ? meta[id].due : "",
memo: meta[id] ? meta[id].memo : ""
});
}

const caseValues = ss.getSheetByName(SHEET_CASES).getDataRange().getValues();
const cases = [];
for (let i = 1; i < caseValues.length; i++) {
const row = caseValues[i];
const eventId = String(row[0] || "");
if (!eventId) continue;
let stages = [];
try { stages = JSON.parse(String(row[7] || "[]"));} catch (err) { stages = [];}
const cm = caseMeta[eventId] || {};
cases.push({
eventId: eventId,
facility: String(row[1] || ""),
person: String(row[2] || ""),
owner: String(row[3] || ""),
meetingLabel: String(row[4] || ""),
meetingIso: String(row[5] || ""),
currentPhase: String(row[6] || ""),
stages: stages,
status: String(row[8] || ""),
startDate: cm.startDate || "",
daysToStart: daysToStart_(cm.startDate || ""),
startResult: cm.result || "",
startResultDate: cm.resultDate || "",
pending: pending["case:" + eventId] === true
});
}

const histValues = ss.getSheetByName(SHEET_HISTORY).getDataRange().getValues();
const history = [];
for (let i = 1; i < histValues.length; i++) {
const row = histValues[i];
if (!String(row[3] || "")) continue;
// G=id（taskId形式。case:<eventId>・assign:<割当ID>を含む） / H=reopenable("1"のみ戻し可) / I=channel / J=ts（A:F の意味は従来どおり）
const histId = String(row[6] || "");
history.push({
closedAt: String(row[0] || ""),
type: String(row[1] || ""),
typeLabel: String(row[2] || ""),
title: String(row[3] || ""),
howLabel: String(row[4] || ""),
owner: String(row[5] || ""),
id: histId,
reopenable: String(row[7] || "") === "1",
pending: histId !== "" && pending[histId] === true
});
}

const memberValues = ss.getSheetByName(SHEET_MEMBERS).getDataRange().getValues();
const members = [];
for (let i = 1; i < memberValues.length; i++) {
const row = memberValues[i];
const label = String(row[0] || "");
if (!label) continue;
members.push({
label: label,
name: String(row[1] || ""),
email: String(row[2] || ""),
slackId: String(row[3] || ""),
status: String(row[4] || ""),
scope: String(row[5] || ""),
pendingOff: pending["member:" + label] === true
});
}

return {
tasks: tasks,
adds: pendingAdds_(),
memberAdds: pendingMemberAdds_(),
meetingAdds: pendingMeetings_(),
startAdds: pendingStarts_(),
cases: cases,
history: history,
members: members,
failures: failures_(),
alerts: alerts_(),
summaryPending: summary.pending,
summarySent: summary.sent,
sheetUpdatedAt: sheetUpdatedAt_(),
fetchedAt: new Date().toISOString()
};
}

function pendingMemberAdds_() {
const values = actionRows_();
const out = [];
for (let i = 1; i < values.length; i++) {
if (String(values[i][2] || "") === "addMember" && String(values[i][4] || "") === "未適用") {
out.push({ name: String(values[i][9] || ""), email: String(values[i][10] || ""), requestedAt: String(values[i][3] || "") });
}
}
return out;
}

function addMember_(body) {
const name = String(body.name || "").trim();
const email = String(body.email || "").trim();
if (!name) return { ok: false, error: "missing_name" };
if (!email || email.indexOf("@") < 0) return { ok: false, error: "bad_email" };
// 同じメールの未適用の追加があれば二重記録しない
const values = actionRows_();
for (let i = 1; i < values.length; i++) {
if (String(values[i][2] || "") === "addMember" && String(values[i][4] || "") === "未適用" &&
    String(values[i][10] || "") === email) {
return { ok: true, pending: true, already: true };
}
}
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const actionId = "mem" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
// J列=名前、K列=メール（addTask の J/K と同じ置き場を行種別で共用）
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, "", "addMember", new Date().toISOString(), "未適用", "", "", "", "", name, email]);
return { ok: true, pending: true };
}

function disableMember_(body) {
const label = String(body.member || "").trim();
if (!label) return { ok: false, error: "missing_member" };
const taskId = "member:" + label;
if (findPendingAction_(taskId, "memberOff")) {
return { ok: true, pending: true, already: true };
}
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const actionId = "memoff" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, taskId, "memberOff", new Date().toISOString(), "未適用", "", "", "", "", label, ""]);
return { ok: true, pending: true };
}

function findPendingAction_(taskId, action) {
const values = actionRows_();
for (let i = 1; i < values.length; i++) {
if (String(values[i][1] || "") === taskId &&
String(values[i][2] || "") === action &&
String(values[i][4] || "") === "未適用") {
return true;
}
}
return false;
}

function complete_(body) {
const id = String(body.id || "");
if (!id) return { ok: false, error: "missing_id"};
if (findPendingAction_(id, "complete")) {
return { ok: true, id: id, pending: true, already: true};
}
// 未送信ステージの先行完了（tour:pending:<eventId>:<stageKey>）: まだタスクが送信されて
// いない段階への完了操作。タスクシートには行が無いので照合をスキップし、channel/ts は
// 空のまま通常の complete と同じ形式で処理待ちへ積む（消込は同期が案件記録側で行う）。
if (id.indexOf("tour:pending:") === 0) {
const parts = id.slice("tour:pending:".length).split(":");
const stageKeys = ["offer", "docs", "duo", "sesio", "contract", "formrun", "followup"];
if (parts.length !== 2 || !parts[0] || stageKeys.indexOf(parts[1]) < 0) {
return { ok: false, error: "bad_pending_id", id: id };
}
const ssP = SpreadsheetApp.openById(SPREADSHEET_ID);
const actionIdP = "a" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
ssP.getSheetByName(SHEET_ACTIONS).appendRow(
[actionIdP, id, "complete", new Date().toISOString(), "未適用", "", "", "", "", "", ""]);
return { ok: true, id: id, pending: true };
}
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const taskValues = ss.getSheetByName(SHEET_TASKS).getDataRange().getValues();
let channel = "";
let ts = "";
for (let i = 1; i < taskValues.length; i++) {
if (String(taskValues[i][0] || "") === id) {
channel = String(taskValues[i][10] || "");
ts = String(taskValues[i][11] || "");
break;
}
}
if (!channel ||!ts) return { ok: false, error: "task_not_found", id: id};
const actionId = "a" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, id, "complete", new Date().toISOString(), "未適用", "", "", channel, ts, "", ""]);
return { ok: true, id: id, pending: true};
}

function addTask_(body) {
const title = String(body.title || "").trim();
if (!title) return { ok: false, error: "missing_title"};
if (title.length > 200) return { ok: false, error: "title_too_long"};
const datetime = String(body.datetime || "").trim();
const assignee = String(body.assignee || "").trim().slice(0, 20);
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const actionId = "add" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, "", "add", new Date().toISOString(), "未適用", "", "", "", "", title, datetime, assignee]);
return { ok: true, pending: true};
}

function caseClose_(body) {
const eventId = String(body.eventId || "");
const kind = String(body.kind || "");
if (!eventId) return { ok: false, error: "missing_event"};
if (kind!== "lost" && kind!== "close") return { ok: false, error: "bad_kind"};
const taskId = "case:" + eventId;
// 既に未適用の案件アクション（失注/終了のどちらか）があれば二重記録しない
const values = actionRows_();
for (let i = 1; i < values.length; i++) {
const a = String(values[i][2] || "");
if (String(values[i][1] || "") === taskId &&
(a === "caseLost" || a === "caseClose") &&
String(values[i][4] || "") === "未適用") {
return { ok: true, pending: true, already: true};
}
}
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const actionId = "case" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, taskId, kind === "lost"? "caseLost": "caseClose",
new Date().toISOString(), "未適用", "", "", "", "", "", ""]);
return { ok: true, pending: true};
}

function reopen_(body) {
const id = String(body.id || "");
if (!id) return { ok: false, error: "missing_id" };
if (findPendingAction_(id, "reopen")) {
return { ok: true, id: id, pending: true, already: true };
}
// 完了履歴タブで対象行を探す（G=id / H=reopenable / I=channel / J=ts）
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const histValues = ss.getSheetByName(SHEET_HISTORY).getDataRange().getValues();
let found = false;
let reopenable = false;
let channel = "";
let ts = "";
for (let i = 1; i < histValues.length; i++) {
if (String(histValues[i][6] || "") === id) {
found = true;
reopenable = String(histValues[i][7] || "") === "1";
channel = String(histValues[i][8] || "");
ts = String(histValues[i][9] || "");
break;
}
}
if (!found) return { ok: false, error: "history_not_found", id: id };
if (!reopenable) return { ok: false, error: "not_reopenable", id: id };
const actionId = "re" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, id, "reopen", new Date().toISOString(), "未適用", "", "", channel, ts, "", ""]);
return { ok: true, id: id, pending: true };
}

function delete_(body) {
const id = String(body.id || "");
if (!id) return { ok: false, error: "missing_id" };
if (findPendingAction_(id, "delete")) {
return { ok: true, id: id, pending: true, already: true };
}
// complete と同じく「タスク」タブから channel / ts を引く（割当タスクもタスク行に DM の channel / ts がある）
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const taskValues = ss.getSheetByName(SHEET_TASKS).getDataRange().getValues();
let channel = "";
let ts = "";
for (let i = 1; i < taskValues.length; i++) {
if (String(taskValues[i][0] || "") === id) {
channel = String(taskValues[i][10] || "");
ts = String(taskValues[i][11] || "");
break;
}
}
if (!channel || !ts) return { ok: false, error: "task_not_found", id: id };
const actionId = "del" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, id, "delete", new Date().toISOString(), "未適用", "", "", channel, ts, "", ""]);
return { ok: true, id: id, pending: true };
}

function cancelAction_(body) {
const id = String(body.id || "");
if (!id) return { ok: false, error: "missing_id" };
// 取り消し対象は「未適用」の complete / delete / reopen / caseLost / caseClose のみ。
// caseLost / caseClose の行は B列 taskId が "case:<eventId>" なので、id に "case:..." が来ればそのまま一致する。
const targets = { complete: true, delete: true, reopen: true, caseLost: true, caseClose: true };
const values = actionRows_();
let best = -1;
let bestReq = "";
for (let i = 1; i < values.length; i++) {
if (String(values[i][1] || "") !== id) continue;
if (String(values[i][4] || "") !== "未適用") continue;
if (!targets[String(values[i][2] || "")]) continue;
const req = String(values[i][3] || "");
// requestedAt が最大の1行だけを取り消す（同値なら物理的に最後＝最新の行を優先）
if (best < 0 || req >= bestReq) { best = i; bestReq = req; }
}
if (best < 0) return { ok: false, error: "no_pending_action", id: id };
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
// E列（status）だけを「取消」に書き換える。行自体は監査として残す
ss.getSheetByName(SHEET_ACTIONS).getRange(best + 1, 5).setValues([["取消"]]);
return { ok: true, id: id, action: String(values[best][2] || ""), cancelled: true };
}

function sendSummary_(body) {
const member = String(body.member || "").trim();
if (!member) return { ok: false, error: "missing_member" };
const taskId = "summary:" + member;
if (findPendingAction_(taskId, "sendSummary")) {
return { ok: true, pending: true, already: true, member: member };
}
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const actionId = "sum" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
// J列=対象メンバー（呼び名 or 自分）
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, taskId, "sendSummary", new Date().toISOString(), "未適用", "", "", "", "", member, ""]);
return { ok: true, pending: true, member: member };
}

function addMeeting_(body) {
const text = String(body.text || "").trim();
if (!text) return { ok: false, error: "missing_text" };
if (text.length > 1000) return { ok: false, error: "text_too_long" };
const assignee = String(body.assignee || "自分").trim().slice(0, 20) || "自分";
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const actionId = "mtg" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
// taskId 列にも actionId を入れ、失敗表示（要確認）の参照キーにする。J列=貼り付けテキスト、K列=担当
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, actionId, "addMeeting", new Date().toISOString(), "未適用", "", "", "", "", text, assignee]);
return { ok: true, pending: true };
}

function pendingMeetings_() {
const values = actionRows_();
const out = [];
for (let i = 1; i < values.length; i++) {
if (String(values[i][2] || "") === "addMeeting" && String(values[i][4] || "") === "未適用") {
out.push({ text: String(values[i][9] || ""), assignee: String(values[i][10] || ""), requestedAt: String(values[i][3] || "") });
}
}
return out;
}

function addStart_(body) {
const text = String(body.text || "").trim();
if (!text) return { ok: false, error: "missing_text" };
if (text.length > 1000) return { ok: false, error: "text_too_long" };
const date = String(body.date || "").trim();
if (!date) return { ok: false, error: "missing_date" };
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "bad_date" };
// 担当（任意・後方互換: 欠けた場合は「自分」）。addMeeting と同じ正規化（trim・20文字まで）
const assignee = String(body.assignee || "自分").trim().slice(0, 20) || "自分";
// 書類回収済み（任意・後方互換: 欠けた場合は false）。true の時だけ M列に "1" を格納する
const docsCollected = body.docsCollected === true;
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const actionId = "start" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
// taskId 列にも actionId を入れ、失敗表示（要確認）の参照キーにする。
// J列=貼り付けテキスト、K列=入社日、L列=担当（addAssignee。add アクションと同じ列）、
// M列=書類回収済みフラグ（"1" のみ。それ以外は空）。A:L の各列は他アクション・同期の適用記録
// （F=appliedAt / G=note 等）と意味が決まっているため、フラグは専用の M列に置く。
ss.getSheetByName(SHEET_ACTIONS).appendRow(
[actionId, actionId, "addStart", new Date().toISOString(), "未適用", "", "", "", "", text, date, assignee, docsCollected ? "1" : ""]);
return { ok: true, pending: true };
}

function pendingStarts_() {
const values = actionRows_();
const out = [];
for (let i = 1; i < values.length; i++) {
if (String(values[i][2] || "") === "addStart" && String(values[i][4] || "") === "未適用") {
// L列=担当（旧行は空→「自分」）、M列=書類回収済み（"1" のみ true）
out.push({ text: String(values[i][9] || ""), date: dueStr_(values[i][10]), assignee: String(values[i][11] || "") || "自分", docsCollected: String(values[i][12] || "") === "1", requestedAt: String(values[i][3] || "") });
}
}
return out;
}

function caseMetaSheet_() {
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
let sh = ss.getSheetByName(SHEET_CASEMETA);
if (!sh) {
sh = ss.insertSheet(SHEET_CASEMETA);
sh.appendRow(["eventId", "startDate", "result", "resultDate", "startEventId", "updatedAt"]);
}
return sh;
}

function caseMetaMap_() {
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const sh = ss.getSheetByName(SHEET_CASEMETA);
const map = {};
if (!sh) return map;
const values = sh.getDataRange().getValues();
for (let i = 1; i < values.length; i++) {
const id = String(values[i][0] || "");
if (!id) continue;
map[id] = {
startDate: dueStr_(values[i][1]),
result: String(values[i][2] || ""),
resultDate: dueStr_(values[i][3]),
startEventId: String(values[i][4] || "")
};
}
return map;
}

function daysToStart_(startDate) {
if (!startDate) return null;
const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
const a = Date.parse(startDate + "T00:00:00+09:00");
const b = Date.parse(today + "T00:00:00+09:00");
if (isNaN(a) || isNaN(b)) return null;
return Math.round((a - b) / 86400000);
}

function upsertCaseMeta_(eventId, patch) {
const sh = caseMetaSheet_();
const values = sh.getDataRange().getValues();
const now = new Date().toISOString();
for (let i = 1; i < values.length; i++) {
if (String(values[i][0] || "") === eventId) {
const row = [eventId,
patch.startDate !== undefined ? patch.startDate : dueStr_(values[i][1]),
patch.result !== undefined ? patch.result : String(values[i][2] || ""),
patch.resultDate !== undefined ? patch.resultDate : dueStr_(values[i][3]),
patch.startEventId !== undefined ? patch.startEventId : String(values[i][4] || ""),
now];
sh.getRange(i + 1, 1, 1, 6).setValues([row]);
return { ok: true, eventId: eventId };
}
}
sh.appendRow([eventId, patch.startDate || "", patch.result || "", patch.resultDate || "", patch.startEventId || "", now]);
return { ok: true, eventId: eventId };
}

function setStartDate_(body) {
const eventId = String(body.eventId || "");
if (!eventId) return { ok: false, error: "missing_event" };
const date = String(body.date || "").trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "bad_date", eventId: eventId };
const r = upsertCaseMeta_(eventId, { startDate: date });
r.startDate = date;
return r;
}

function setStartResult_(body) {
const eventId = String(body.eventId || "");
if (!eventId) return { ok: false, error: "missing_event" };
const result = String(body.result || "");
if (result !== "started" && result !== "cancelled" && result !== "reschedule") {
return { ok: false, error: "bad_result", eventId: eventId };
}
const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
const patch = { result: result, resultDate: today };
if (result === "reschedule") {
const newDate = String(body.newDate || "").trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { ok: false, error: "bad_new_date", eventId: eventId };
patch.startDate = newDate;
}
const r = upsertCaseMeta_(eventId, patch);
r.result = result;
return r;
}

function alerts_() {
// 同期が再構築時に書き込む「要確認」タブ（kind / label / detail / days / refId / detectedAt）
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const sh = ss.getSheetByName(SHEET_ALERTS);
if (!sh) return [];
const values = sh.getDataRange().getValues();
const out = [];
for (let i = 1; i < values.length; i++) {
const kind = String(values[i][0] || "");
if (!kind) continue;
out.push({
kind: kind,
label: String(values[i][1] || ""),
detail: String(values[i][2] || ""),
days: Number(values[i][3]) || 0,
refId: String(values[i][4] || "")
});
}
return out;
}

function summaryStatus_() {
// 送信待ちは「処理待ち」の sendSummary 未適用から、最終送信日時は「送信記録」タブ（同期がボタン送信・自動送信の両方を記録）から
const values = actionRows_();
const pendingMap = {};
for (let i = 1; i < values.length; i++) {
if (String(values[i][2] || "") === "sendSummary" && String(values[i][4] || "") === "未適用") {
const member = String(values[i][9] || "");
if (member) pendingMap[member] = true;
}
}
const sent = {};
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const sh = ss.getSheetByName(SHEET_SENDLOG);
if (sh) {
const logValues = sh.getDataRange().getValues();
for (let i = 1; i < logValues.length; i++) {
const member = String(logValues[i][0] || "");
const at = String(logValues[i][1] || "");
if (member && at && (!sent[member] || at > sent[member])) sent[member] = at;
}
}
return { pending: Object.keys(pendingMap), sent: sent };
}

function sheetUpdatedAt_() {
// シートファイルの最終更新時刻（≒ 同期が最後に書き込んだ時刻）。取れない環境でも state 全体は壊さない。
try {
return DriveApp.getFileById(SPREADSHEET_ID).getLastUpdated().toISOString();
} catch (err) {
return "";
}
}

function jsonOut_(obj) {
return ContentService
.createTextOutput(JSON.stringify(obj))
.setMimeType(ContentService.MimeType.JSON);
}
