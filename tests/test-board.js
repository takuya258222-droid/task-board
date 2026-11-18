"use strict";
// タスクボード通し操作テスト: モックAPI（Playwright route差し替え）+ iPhone 390x844
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium} = require("/home/hatch/workspace/kaji/.tests/node_modules/playwright-core");

const PAGE_DIR = path.resolve(__dirname, "..", "github-page");
const results = [];
function check(name, cond, extra) {
results.push({ name, ok: Boolean(cond)});
console.log((cond? "PASS ": "FAIL ") + name + (extra? ":: " + extra: ""));
}

const pending = new Set();
const reopenPending = new Set();
const deletePending = new Set();
const posts = [];
let casePending = false;
const casePendSet = new Set();
let memberOffPending = false;
const addedTasks = [];
const addedMembers = [];
const addedMeetings = [];
const addedStarts = [];
const sentSummaries = new Set();
const caseOverrides = {};
caseOverrides.ev1 = { startDate: "", daysToStart: 7 };
caseOverrides.ev1.startDate = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
const ymdOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const mdOf = (n) => { const d = daysFromNow(n); return (d.getMonth() + 1) + "/" + d.getDate(); };
const metas = {
"calendar:555.5": { due: ymdOf(daysFromNow(3)), memo: "プロフィール写真も用意する"},
"slack:777.7": { due: ymdOf(daysFromNow(-1)), memo: ""}
};

function mockState() {
const t = (o) => Object.assign({ elapsedDays: 1, deadlineLabel: "", slackUrl: "https://kikaricojp.slack.com/archives/D0BGG9SUBEK/p1", groupKey: "", groupTitle: "", member: "", shareKind: "", overdue: false, phase: "", owner: "自分", dueToday: false, eventIso: "", pending: false}, o);
const tasks = [
t({ id: "mail:111.1", type: "mail", typeLabel: "メール", title: "西山様｜契約書類の指摘確認・再再送", datetimeLabel: "11/16 13時", elapsedDays: 2}),
t({ id: "tour:222.2", type: "tour", typeLabel: "面談", title: "🟪すずらん 深堀香織様", datetimeLabel: "11/10 10時", elapsedDays: 8, groupKey: "ev1", groupTitle: "すずらん 深堀香織様", phase: "④入力・申請", overdue: true, slackUrl: "https://kikaricojp.slack.com/archives/C0CE9GN162J/p2"}),
t({ id: "tour:333.3", type: "tour", typeLabel: "面談", title: "🟪すずらん 深堀香織様", datetimeLabel: "11/10 10時", elapsedDays: 8, groupKey: "ev1", groupTitle: "すずらん 深堀香織様", phase: "④入力・申請", overdue: true, slackUrl: "https://kikaricojp.slack.com/archives/C0CE9GN162J/p3"}),
t({ id: "tour:444.4", type: "tour", typeLabel: "面談", title: "🟦" + mdOf(2) + " 清和苑 黒木さん", datetimeLabel: mdOf(2) + " 10時", elapsedDays: 1, groupKey: "ev2", groupTitle: "清和苑 黒木さん", phase: "①準備", owner: "和田", slackUrl: "https://kikaricojp.slack.com/archives/C0CE9GN162J/p4"}),
t({ id: "calendar:555.5", type: "calendar", typeLabel: "カレンダー", title: "コンサルタントプロフィール記入", datetimeLabel: "11/18 17時", elapsedDays: 5, deadlineLabel: "11/18 17時", dueToday: true}),
t({ id: "member:666.6", type: "member", typeLabel: "メンバー", title: "福井様SOの実施待ち連絡", datetimeLabel: "11/16 17時", elapsedDays: 2, groupKey: "member:和田", groupTitle: "和田", member: "和田", shareKind: "依頼共有", owner: "和田", deadlineLabel: "11/16 18時", overdue: true}),
t({ id: "slack:777.7", type: "slack", typeLabel: "Slack", title: "河添大地｜週2日アテンドNG・譲渡基準の統一判断", datetimeLabel: "11/17 9時", elapsedDays: 1}),
t({ id: "onboarding:888.8", type: "onboarding", typeLabel: "入社", title: "伊藤奈美（2日前）", datetimeLabel: "11/19 9時", elapsedDays: 3, owner: "自分"})
];
tasks.forEach((x) => { x.pending = pending.has(x.id) || deletePending.has(x.id);});
tasks.forEach((x) => { const mm = metas[x.id]; x.metaDue = mm ? mm.due : ""; x.memo = mm ? mm.memo : ""; });
const st = {
ok: true,
tasks,
adds: addedTasks.map((a) => ({ title: a.title, datetime: a.datetime, assignee: a.assignee || "", requestedAt: "2026-11-17T21:00:00+09:00"})),
memberAdds: addedMembers.map((a) => ({ name: a.name, email: a.email, requestedAt: "2026-11-17T21:00:00+09:00"})),
cases: [
{ eventId: "ev1", facility: "すずらん", person: "深堀香織様", owner: "自分", meetingLabel: "11/10 10時", meetingIso: "2026-11-10T10:00:00+09:00", currentPhase: "④入力・申請", status: "進行中", pending: casePendSet.has("case:ev1"), startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備（3日前・前日・当日）", status: "done", slackUrl: "https://example.com/s1"},
{ phase: "②内定確認", label: "②内定確認", status: "done", slackUrl: "https://example.com/s2"},
{ phase: "③書類回収", label: "③書類回収", status: "done", slackUrl: "https://example.com/s3"},
{ phase: "④入力・申請", label: "④入力・申請／セシオ入力", status: "open", slackUrl: "https://example.com/s4"},
{ phase: "④入力・申請", label: "④入力・申請／契約申請", status: "open", slackUrl: "https://example.com/s5"},
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: ""}
]},
{ eventId: "ev2", facility: "清和苑", person: "黒木さん", owner: "和田", meetingLabel: mdOf(2) + " 10時", meetingIso: daysFromNow(2).toISOString(), currentPhase: "①準備", status: "進行中", pending: casePendSet.has("case:ev2"), startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [ { phase: "①準備", label: "①準備・3日前", status: "open", slackUrl: "https://example.com/s6"}]},
{ eventId: "ev4", facility: "未登録苑", person: "未登録様", owner: "自分", meetingLabel: mdOf(-3) + " 13時", meetingIso: daysFromNow(-3).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "②内定確認", label: "②内定確認", status: "done", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "open", slackUrl: "https://example.com/s8" }
]}
],
history: [
{ closedAt: "2026-11-17", type: "tour", typeLabel: "面談", title: "🟧たのしい家西陣 前西様", howLabel: "✅で完了", owner: "和田", id: "tour:999.9", reopenable: true, pending: reopenPending.has("tour:999.9")},
{ closedAt: "2026-11-16", type: "mail", typeLabel: "メール", title: "中村隆志様｜書類送付の確認待ち", howLabel: "✅で完了", owner: "自分", id: "mail:998.8", reopenable: false, pending: false}
],
members: [
{ label: "和田", name: "和田貞次", email: "s-wada@kikari.co.jp", slackId: "U0BUUTZ7N1W", status: "有効", scope: "", pendingOff: memberOffPending},
{ label: "岸田", name: "岸田亮士", email: "r-kishida@kikari.co.jp", slackId: "U0C9MADGBUM", status: "無効", scope: "タスク系のみ", pendingOff: false}
],
failures: [],
meetingAdds: addedMeetings.map((a) => ({ text: a.text, assignee: a.assignee || "", requestedAt: "2026-11-17T21:00:00+09:00" })),
startAdds: addedStarts.map((a) => ({ text: a.text, date: a.date, assignee: a.assignee || "", docsCollected: a.docsCollected === true, requestedAt: "2026-11-17T21:00:00+09:00" })),
alerts: [
{ kind: "naitei-overdue", label: "グローバルケア浜寺 藤生様の内定確認が未回答です", detail: "面談から6日経過しています", days: 6, refId: "evX" },
{ kind: "share-stale", label: "和田さんへの依頼共有が5日以上未対応です", detail: "福井様SOの実施待ち連絡", days: 5, refId: "member:666.6" }
],
summaryPending: Array.from(sentSummaries),
summarySent: { "自分": new Date().toISOString() },
sheetUpdatedAt: new Date().toISOString(),
fetchedAt: new Date().toISOString()
};
st.cases.forEach((c) => Object.assign(c, caseOverrides[c.eventId] || {}));
return st;
}

async function main() {
const server = http.createServer((req, res) => {
const p = decodeURIComponent(req.url.split("?")[0]);
const file = p === "/"? "/index.html": p;
const fp = path.join(PAGE_DIR, file);
if (!fp.startsWith(PAGE_DIR) ||!fs.existsSync(fp)) { res.writeHead(404); res.end(); return;}
const type = file.endsWith(".json")? "application/json": file.endsWith(".svg")? "image/svg+xml": file.endsWith(".js")? "text/javascript": "text/html";
res.writeHead(200, { "Content-Type": type});
if (file === "/index.html") {
res.end(fs.readFileSync(fp, "utf8").replace("REPLACE_WITH_APPS_SCRIPT_URL", "https://script.google.com/macros/s/TESTBOARD/exec"));
} else {
res.end(fs.readFileSync(fp));
}
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844}, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text());});
page.on("pageerror", (e) => errors.push(String(e)));
let pageGets = 0;
page.on("request", (r) => { if (r.url().includes("script.google.com") && r.method() === "GET") pageGets++; });

await page.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
if (body.action === "complete") pending.add(body.id);
if (body.action === "reopen") reopenPending.add(body.id);
if (body.action === "delete") deletePending.add(body.id);
if (body.action === "caseClose") { casePending = true; casePendSet.add("case:" + body.eventId); }
let resp = { ok: true };
if (body.action === "cancelAction") {
const hit = pending.delete(body.id) || deletePending.delete(body.id) || reopenPending.delete(body.id) || casePendSet.delete(body.id);
if (!hit) resp = { ok: false, error: "no_pending_action" };
}
if (body.action === "addTask") addedTasks.push(body);
if (body.action === "addMember") addedMembers.push(body);
if (body.action === "disableMember") memberOffPending = true;
if (body.action === "setMeta") metas[body.id] = { due: body.due || "", memo: body.memo || "" };
if (body.action === "sendSummary") sentSummaries.add(body.member);
if (body.action === "addMeeting") addedMeetings.push(body);
if (body.action === "addStart") addedStarts.push(body);
if (body.action === "setStartDate") { const d = new Date(body.date + "T00:00:00"); const now = new Date(); now.setHours(0, 0, 0, 0); const o = caseOverrides[body.eventId] = caseOverrides[body.eventId] || {}; o.startDate = body.date; o.daysToStart = Math.round((d - now) / 86400000); }
if (body.action === "setStartResult") { const o = caseOverrides[body.eventId] = caseOverrides[body.eventId] || {}; if (body.result === "reschedule") { const d = new Date(body.newDate + "T00:00:00"); const now = new Date(); now.setHours(0, 0, 0, 0); o.startDate = body.newDate; o.daysToStart = Math.round((d - now) / 86400000); o.startResult = "reschedule"; } else { o.startResult = body.result; o.startResultDate = ymdOf(new Date()); } }
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp)});
} else {
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockState())});
}
});

await page.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle"});

// 初期表示
check("サマリーに未対応8件", await page.locator("#summary").innerText().then((s) => s.includes("8")));
check("期限超過が赤チップ表示", await page.locator(".sum-chip.red").count() >= 1);
check("次の面談サマリー（清和苑 黒木さん）", await page.locator("#nextMeet").textContent().then((s) => s.includes("清和苑")));
check("すべてタブに8件+追加0件のカード", await page.locator("#list .card").count() === 8);
check("期限超過フラグ表示", await page.locator(".flag.red").count() >= 2);
check("今日が期限フラグ表示", await page.locator(".flag.amber").count() >= 1);
const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
check("横スクロールなし", scrollW <= 390, "scrollWidth=" + scrollW);

// UI全体の拡大（2026-11-18: 小さいという指摘への対応。主要要素の computed style で確認）
const sizes = await page.evaluate(() => {
const cs = (sel) => { const el = document.querySelector(sel); return el ? parseFloat(getComputedStyle(el).fontSize) : 0; };
const mh = (sel) => { const el = document.querySelector(sel); return el ? parseFloat(getComputedStyle(el).minHeight) : 0; };
return { tabIcon: cs("#tabbar .tab .ic"), tabLabel: cs("#tabbar .tab"), tabH: mh("#tabbar .tab"),
title: cs(".card .title"), line: cs(".card .line"), chip: cs(".card .chip"), sumChip: cs(".sum-chip"),
doneH: mh("[data-done]"), doneFont: cs("[data-done]"), fchipH: mh(".fchip"), miniH: mh(".meet-row [data-lost]"),
delH: mh("[data-del]"), slackFont: cs("a.slack-link") };
});
check("UI拡大: 下部タブのアイコン22px以上", sizes.tabIcon >= 21.5, "icon=" + sizes.tabIcon);
check("UI拡大: 下部タブのラベル11px以上・高さ62px以上", sizes.tabLabel >= 11 && sizes.tabH >= 62, "label=" + sizes.tabLabel + " h=" + sizes.tabH);
check("UI拡大: カードのタイトル16px以上", sizes.title >= 16, "title=" + sizes.title);
check("UI拡大: カードの補足行14px以上", sizes.line >= 14, "line=" + sizes.line);
check("UI拡大: 種別チップ12px以上・サマリー13px以上", sizes.chip >= 12 && sizes.sumChip >= 13, "chip=" + sizes.chip + " sum=" + sizes.sumChip);
check("UI拡大: 完了ボタンは高さ56px以上・文字16px以上", sizes.doneH >= 56 && sizes.doneFont >= 16, "h=" + sizes.doneH + " font=" + sizes.doneFont);
check("UI拡大: 削除ボタンも高さ56px以上", sizes.delH >= 56, "h=" + sizes.delH);
check("UI拡大: フィルタチップはヘッダー用に36px以上（コンパクト化で44pxルール対象外）", sizes.fchipH >= 36 && sizes.fchipH <= 40, "h=" + sizes.fchipH);
check("UI拡大: 小ボタン（失注）の高さ44px以上", sizes.miniH >= 44, "h=" + sizes.miniH);
check("UI拡大: Slackリンクの文字14px以上", sizes.slackFont >= 14, "font=" + sizes.slackFont);

// ヘッダーのコンパクト化（2026-11-18: スマホでヘッダーが画面を圧迫しないこと）
const headGeom = await page.evaluate(() => {
const chips = Array.from(document.querySelectorAll("#summary .sum-chip"));
const tops = chips.map((el) => el.offsetTop);
const nm = document.querySelector("#nextMeet"), sn = document.querySelector("#syncNote");
return { spread: tops.length ? Math.max(...tops) - Math.min(...tops) : -1, chipCount: chips.length,
chipH: chips.length ? chips[0].offsetHeight : 0,
metaSameLine: Math.abs(nm.offsetTop - sn.offsetTop) <= 2,
headerH: document.querySelector("header").offsetHeight };
});
check("ヘッダー: サマリーチップが1行（横スクロール）に収まる", headGeom.chipCount >= 6 && headGeom.spread <= 2, JSON.stringify(headGeom));
check("ヘッダー: サマリーチップの高さ36〜40px", headGeom.chipH >= 36 && headGeom.chipH <= 40, "h=" + headGeom.chipH);
check("ヘッダー: 次の面談と最終更新が1行に統合されている", headGeom.metaSameLine);
check("ヘッダー: 全体の高さがコンパクト（215px以下）", headGeom.headerH > 0 && headGeom.headerH <= 215, "h=" + headGeom.headerH);

// 同期タイミング表示は名目7時刻（8:45/10:30/12:00/15:00/16:00/17:30/19:30）に追随（実スケジュール前倒しに伴う表示側の追随）
check("同期スロットが名目7時刻", await page.evaluate(() => JSON.stringify(SYNC_SLOTS) === JSON.stringify([[8,45],[10,30],[12,0],[15,0],[16,0],[17,30],[19,30]])));
check("次回反映ラベルが7スロットのいずれかを指す", await page.evaluate(() => {
const label = nextSyncLabel();
const times = SYNC_SLOTS.map(([h, m]) => h + ":" + String(m).padStart(2, "0"));
return label.includes("ごろ反映") && times.some((t) => label.includes(t));
}));
check("フッターの同期タイミング表記が名目7時刻", await page.locator("footer").innerText().then((s) => s.includes("8:45／10:30／12:00／15:00／16:00／17:30／19:30")));

// ダッシュボード（すべてタブ上部）
check("要確認パネルに2件", await page.locator(".dash-panel .alert-row").count() === 2);
check("要確認がサマリーに表示", await page.locator("#summary").innerText().then((s) => s.includes("要確認")));
check("面談実施待ちに清和苑×黒木（バイネーム）", await page.locator(".meet-row").first().innerText().then((s) => s.includes("清和苑") && s.includes("黒木")));
check("面談実施待ちカードに失注/終了ボタン", await page.locator(".meet-row [data-lost='ev2']").count() === 1 && await page.locator(".meet-row [data-close='ev2']").count() === 1);
check("すべてタブに 入社待ち セクションは無い（入社タブへ移設）", await page.evaluate(() => {
const panels = Array.from(document.querySelectorAll(".dash-panel"));
return !panels.some((x) => (x.querySelector("h2") || {}).textContent.includes("入社待ち"));
}));
check("ヘッダーに 入社待ち チップ（1件）", await page.locator("#summary [data-gostarts]").innerText().then((s) => s.includes("入社待ち") && s.includes("1")));
await page.click("#summary [data-gostarts]");
await page.waitForTimeout(300);
check("入社待ちチップのタップで入社タブへ遷移", await page.locator('[data-tab="onboarding"]').getAttribute("class").then((c) => (c || "").includes("active")));
check("入社タブの先頭に 入社待ち セクション（すずらん深堀・あと7日）", await page.locator("#dash").innerText().then((s) => s.includes("入社待ち") && s.includes("すずらん") && s.includes("あと7日")));
check("入社待ちセクションが入社タスク一覧より上にある", await page.evaluate(() => {
const dash = document.querySelector("#dash"), list = document.querySelector("#list");
return Boolean(dash.querySelector(".dash-panel")) && (dash.compareDocumentPosition(list) & 4) !== 0;
}));
check("入社待ちパネル内に未登録の警告行がある", await page.evaluate(() => {
const panels = Array.from(document.querySelectorAll(".dash-panel"));
const p = panels.find((x) => (x.querySelector("h2") || {}).textContent.includes("入社待ち"));
return Boolean(p) && p.textContent.includes("未登録苑") && p.textContent.includes("入社日を入れてください");
}));
check("入社日未登録の警告行（未登録苑）", await page.locator("#dash").innerText().then((s) => s.includes("入社日を入れてください") && s.includes("未登録苑")));
await page.click('[data-tab="all"]');
await page.waitForTimeout(300);
check("最終更新の表示", await page.locator("#syncNote").textContent().then((s) => s.includes("最終更新")));
check("下部タブバーに8タブ", await page.locator("#tabbar .tab").count() === 8);

// 配置: 面談実施待ち・入社待ちは「すべて」ビュー上部（追加パネル・タスク一覧より前）
check("ダッシュボードが追加パネル・タスク一覧より前に配置", await page.evaluate(() => {
const dash = document.querySelector("#dash"), list = document.querySelector("#list"), add = document.querySelector("#addPanel");
return (dash.compareDocumentPosition(list) & 4) !== 0 && (dash.compareDocumentPosition(add) & 4) !== 0;
}));
check("面談実施待ちの行にフェーズバッジ（①準備）", await page.locator(".meet-row .ph-badge.ph1").first().innerText().then((s) => s.includes("①準備")));
// 面談実施待ちの行タップで案件詳細へ
await page.click(".meet-row [data-gocase='ev2']");
await page.waitForTimeout(300);
check("面談実施待ちの行タップで案件詳細が開く", await page.locator("#case-ev2").count() === 1);
await page.click('[data-tab="all"]');
await page.waitForTimeout(300);
// 0件でも両セクションの見出しと件数が出る（入社待ちは入社タブ、面談実施待ちは すべてタブ）
await page.click('[data-tab="onboarding"]');
await page.waitForTimeout(200);
await page.evaluate(() => { cases.forEach((c) => { c.startDate = ""; c.startResult = "started"; c.startResultDate = ""; }); render(); });
check("入社待ち0件でも見出しと0件表示（入社タブ）", await page.evaluate(() => {
const panels = Array.from(document.querySelectorAll(".dash-panel"));
const p = panels.find((x) => (x.querySelector("h2") || {}).textContent.includes("入社待ち"));
return Boolean(p) && p.textContent.includes("0件") && p.textContent.includes("入社待ちの案件はありません");
}));
await page.click('[data-tab="all"]');
await page.waitForTimeout(200);
await page.evaluate(() => { cases = []; render(); });
check("面談実施待ち0件でも見出しと0件表示", await page.evaluate(() => {
const panels = Array.from(document.querySelectorAll(".dash-panel"));
const p = panels.find((x) => (x.querySelector("h2") || {}).textContent.includes("面談実施待ち"));
return Boolean(p) && p.textContent.includes("0件") && p.textContent.includes("実施待ちの面談はありません");
}));
await page.evaluate(() => fetchState());
await page.waitForTimeout(400);
check("状態復元後に面談実施待ちが戻る（すべてタブ）", await page.locator("#dash").innerText().then((s) => s.includes("面談実施待ち")));
await page.click('[data-tab="onboarding"]');
await page.waitForTimeout(300);
check("状態復元後に 入社待ち が戻る（入社タブ・あと7日）", await page.locator("#dash").innerText().then((s) => s.includes("入社待ち") && s.includes("あと7日")));

// 入社待ちの直接追加（貼り付け+入社日ピッカーのみ）
check("入社待ちセクションに「入社待ちを追加」ボタン", await page.locator("[data-start-add-toggle]").count() === 1);
await page.click("[data-start-add-toggle]");
check("追加フォームが開く（テキスト欄+入社日ピッカー）", await page.locator("#startAddText").count() === 1 && await page.locator("#startAddDate").count() === 1);
await page.fill("#startAddText", "追加苑 追加様 入社決定");
await page.fill("#startAddDate", ymdOf(daysFromNow(14)));
await page.click("[data-start-add-submit]");
await page.waitForTimeout(60);
check("入社待ち追加が即時反映（POST完了前に反映待ち行が出る）", await page.locator("#dash").innerText().then((s) => s.includes("追加苑 追加様") && s.includes("反映待ち")));
await page.waitForTimeout(700);
const startPost = posts.find((p) => p.action === "addStart");
check("addStart がPOSTされた（text/date）", startPost && startPost.text.includes("追加苑") && startPost.date === ymdOf(daysFromNow(14)), JSON.stringify(startPost));
check("二重送信なし（addStart POSTは1回）", posts.filter((p) => p.action === "addStart").length === 1);
check("着地後も入社待ちに反映待ち行が残る（あと14日）", await page.locator("#dash").innerText().then((s) => s.includes("追加苑 追加様") && s.includes("あと14日") && s.includes("反映待ち")));
check("追加成功フィードバック表示", await page.locator("#okBar").innerText().then((s) => s.includes("入社待ちの追加を受け付けました")));
await page.click('[data-tab="all"]');
await page.waitForTimeout(300);

// 期日・メモの表示
const calCard = page.locator(".card", { hasText: "コンサルタントプロフィール記入" });
check("メモがカードに表示される", await calCard.innerText().then((s) => s.includes("プロフィール写真も用意する")));
check("期日が「期日: M/D」で表示される", await calCard.innerText().then((s) => s.includes("期日: " + mdOf(3))), "期日: " + mdOf(3));
const slackCard = page.locator(".card", { hasText: "河添大地" });
check("過去の期日も「期日: M/D」で表示される", await slackCard.innerText().then((s) => s.includes("期日: " + mdOf(-1))), "期日: " + mdOf(-1));
check("過去の期日で期限超過フラグが付く", await slackCard.locator(".flag.red").count() >= 1);
check("過去の期日でカードが超過の色付け（overdueクラス）", await slackCard.getAttribute("class").then((c) => (c || "").includes("overdue")));

// 検索
await page.fill("#searchBox", "深堀");
check("検索で深堀の2件に絞り込み", await page.locator("#list .card").count() === 2);
await page.fill("#searchBox", "");

// 期限超過のみチップ
await page.click("[data-overdue]");
check("期限超過のみで4件（期日超過も含む）", await page.locator("#list .card").count() === 4);
await page.click("[data-overdue]");

// 担当チップ（和田）
check("担当フィルタに無効メンバー（岸田）は出ない", await page.locator('[data-owner="岸田"]').count() === 0);
check("担当フィルタは自分+有効メンバー（和田）", await page.locator('[data-owner="自分"]').count() === 1 && await page.locator('[data-owner="和田"]').count() === 1);
await page.click('[data-owner="和田"]');
check("担当=和田で2件", await page.locator("#list .card").count() === 2);
await page.click('[data-owner="all"]');

// 面談タブ: グルーピング+詳細（面談タブは面談待ち＝①②の案件だけ。③以降のev1は出ない）
await page.click('[data-tab="tour"]');
check("面談タブのグループは面談待ち（①②）の案件だけ（③以降のev1は出ない）", await page.locator(".group-head").count() === 1 && await page.locator('[data-group="ev1"]').count() === 0);
await page.evaluate(() => { openCases["ev1"] = true; render(); });
check("案件詳細が開く", await page.locator("#case-ev1").count() === 1);
check("進捗セグメント5つ", await page.locator("#case-ev1 .seg").count() === 5);
check("段階行6行", await page.locator("#case-ev1 .stage-row").count() === 6);
check("⑤セグメントは未送信（doneでない）", await page.locator("#case-ev1 .seg").nth(4).getAttribute("class").then((c) => !c.includes("done") && !c.includes("now")));
check("失注ボタンあり", await page.locator("[data-lost='ev1']").count() === 1);
check("失注/終了が「案件を閉じる」ゾーンに目立つ配置", await page.locator("#case-ev1 .close-zone [data-lost='ev1']").count() === 1 && await page.locator("#case-ev1 .close-zone [data-close='ev1']").count() === 1);

// 段階行からメモ・期日を開ける導線（段階行とタスクが一意に対応付く場合にボタンが出る）
check("段階行にメモ・期日ボタン（対応タスク分）", await page.locator("#case-ev1 [data-stage-edit='tour:222.2']").count() === 1 && await page.locator("#case-ev1 [data-stage-edit='tour:333.3']").count() === 1);
check("段階行ボタンのラベルが「メモ・期日」", await page.locator("#case-ev1 [data-stage-edit='tour:222.2']").innerText().then((s) => s.includes("メモ・期日")));
await page.click("#case-ev1 [data-stage-edit='tour:222.2']");
await page.waitForTimeout(200);
check("段階行ボタンでメモ・期日フォームが開く", await page.locator("#metaDueInput").count() === 1 && await page.locator("#metaMemoInput").count() === 1);
await page.click("[data-meta-cancel]");
check("段階行から開いたフォームもキャンセルで閉じる", await page.locator("#metaDueInput").count() === 0);
check("キャンセルでは setMeta はPOSTされない（段階行導線）", !posts.some((p) => p.action === "setMeta"));

// 内定後の回収チェックリスト（案件詳細内）: ev1 は ③完了・④×2対応中・⑤未送信 → 対象4件/回収1件（⑤は送信待ち行として出る）
await page.evaluate(() => { openCases["ev1"] = true; openCases["ev2"] = true; render(); });
await page.waitForTimeout(200);
check("回収チェックリストのセクションがある", await page.locator("#case-ev1 .collect-box").count() === 1);
check("回収の進捗は 1/4", await page.locator("#case-ev1 [data-collect-prog]").innerText().then((s) => s.includes("1/4")));
check("回収項目は4行（③+④×2+⑤送信待ち）", await page.locator("#case-ev1 .collect-row").count() === 4);
check("未送信の⑤は送信待ち行（未チェック・操作可能・tour:pending: のID）", await page.evaluate(() => {
const inp = document.querySelector("#case-ev1 [data-collect-check='tour:pending:ev1:followup']");
const row = inp && inp.closest(".collect-row");
return Boolean(inp) && !inp.checked && !inp.disabled && row && row.getAttribute("data-cstate") === "notyet" && row.textContent.includes("送信待ち");
}));
check("書類回収はチェック済み・操作不可で表示", await page.evaluate(() => {
const rows = Array.from(document.querySelectorAll("#case-ev1 .collect-row"));
const r = rows.find((x) => x.textContent.includes("書類回収"));
const inp = r && r.querySelector("input[type=checkbox]");
return Boolean(inp) && inp.checked && inp.disabled && r.textContent.includes("回収済み");
}));
check("反映済み項目に「完了済みタブから戻す」注記がある", await page.locator("#case-ev1 .collect-note").innerText().then((s) => s.includes("完了済み")));
check("セシオ入力のチェック先は tour:222.2", await page.locator("#case-ev1 [data-collect-check='tour:222.2']").count() === 1);
check("契約申請のチェック先は tour:333.3", await page.locator("#case-ev1 [data-collect-check='tour:333.3']").count() === 1);
check("案件カード（グループ見出し）に「回収 1/4」チップ", await page.locator(".group-head[data-group='ev1']").innerText().then((s) => s.includes("回収 1/4")));
check("未内定の案件（ev2）に回収セクションは無い", await page.locator("#case-ev2").count() === 1 && await page.locator("#case-ev2 .collect-box").count() === 0);
check("未内定の案件（ev2）に回収チップは無い", await page.locator("[data-collect-chip='ev2']").count() === 0);
// チェック→既存の完了ハンドラと同経路で complete がキューに入り、行が反映待ち表示になる
await page.click("#case-ev1 [data-collect-check='tour:222.2']");
await page.waitForTimeout(700);
check("チェックで complete がPOSTされた（tour:222.2）", posts.some((p) => p.action === "complete" && p.id === "tour:222.2"));
check("チェックした行がチェック済み・反映待ち表示になる", await page.evaluate(() => {
const inp = document.querySelector("#case-ev1 [data-collect-check='tour:222.2']");
const row = inp && inp.closest(".collect-row");
return Boolean(inp) && inp.checked && !inp.disabled && row && row.getAttribute("data-cstate") === "pendingOpt" && row.textContent.includes("反映待ち");
}));
check("進捗が 2/4 に進む", await page.locator("#case-ev1 [data-collect-prog]").innerText().then((s) => s.includes("2/4")));
check("カード側の回収チップも「回収 2/4」", await page.locator("[data-collect-chip='ev1']").innerText().then((s) => s.includes("回収 2/4")));
check("チェックしたタスクのカードは一覧から消える", await page.locator('[data-card-id="tour:222.2"]').count() === 0);
// 反映待ちの間はチェックを外して取り消せる（cancelAction と同経路）
await page.click("#case-ev1 [data-collect-check='tour:222.2']");
await page.waitForTimeout(700);
check("外すと cancelAction がPOSTされた（tour:222.2）", posts.some((p) => p.action === "cancelAction" && p.id === "tour:222.2"));
check("取り消すと行が未チェック・操作可能に戻る", await page.evaluate(() => {
const inp = document.querySelector("#case-ev1 [data-collect-check='tour:222.2']");
const row = inp && inp.closest(".collect-row");
return Boolean(inp) && !inp.checked && !inp.disabled && row && row.getAttribute("data-cstate") === "open";
}));
check("進捗が 1/4 に戻る", await page.locator("#case-ev1 [data-collect-prog]").innerText().then((s) => s.includes("1/4")));
check("取り消すとタスクのカードが一覧に戻る", await page.locator('[data-card-id="tour:222.2"]').count() === 1);

// 入社日・結果（ev1は内定済み+入社日登録済みのモック）
check("入社日ボックス表示（あと7日）", await page.locator("#case-ev1 .start-box").innerText().then((s) => s.includes("入社日") && s.includes("あと7日")));
await page.fill("#startDate-ev1", ymdOf(daysFromNow(10)));
await page.click("[data-start-save='ev1']");
await page.waitForTimeout(700);
check("setStartDate がPOSTされた", posts.some((p) => p.action === "setStartDate" && p.eventId === "ev1" && p.date === ymdOf(daysFromNow(10))));
check("入社日変更が即反映（あと10日）", await page.locator("#case-ev1 .start-box").innerText().then((s) => s.includes("あと10日")));
page.once("dialog", (d) => d.accept());
await page.click("#case-ev1 [data-result='started']");
await page.waitForTimeout(700);
check("setStartResult(started) がPOSTされた", posts.some((p) => p.action === "setStartResult" && p.eventId === "ev1" && p.result === "started"));
check("入社済み表示になる", await page.locator("#case-ev1 .start-ok").count() === 1);

// 案件の失注アクション（confirm を承認）: 押した瞬間に消える（楽観的UI）
await page.evaluate(() => { window.__keepCaseNode = document.querySelector('[data-card-id="tour:444.4"]'); });
page.once("dialog", (d) => d.accept());
await page.click("[data-lost='ev1']");
await page.waitForTimeout(60);
check("失注が即時反映（POST完了前に案件詳細が消える）", await page.locator("#case-ev1").count() === 0);
check("案件クローズで無関係カードのDOMノードが保持される", await page.evaluate(() => Boolean(window.__keepCaseNode) && window.__keepCaseNode.isConnected && document.querySelector('[data-card-id="tour:444.4"]') === window.__keepCaseNode));
await page.waitForTimeout(700);
check("caseClose(lost) がPOSTされた", posts.some((p) => p.action === "caseClose" && p.kind === "lost" && p.eventId === "ev1"));
check("失注の反映待ちストリップ表示", await page.locator(".opt-strip").first().innerText().then((s) => s.includes("失注") && s.includes("反映待ち")));
// 楽観的に閉じた案件を実状態へ戻す（以降のまとめ集計のため）
await page.evaluate(() => { optCases = {}; return fetchState(); });
await page.waitForTimeout(400);

// 完了ボタン: 押した瞬間に消える（楽観的UI。POSTはモックで250ms遅延するので、その前に消えていることを確認）
await page.click('[data-tab="mail"]');
const getsBeforeComplete = pageGets;
await page.click("[data-done='mail:111.1']");
await page.waitForTimeout(60);
check("完了が即時反映（POST完了前に行が消える）", await page.locator("[data-done='mail:111.1']").count() === 0);
await page.waitForTimeout(700);
check("complete がPOSTされた", posts.some((p) => p.action === "complete" && p.id === "mail:111.1"));
check("完了のPOST成功直後に state を再取得しない（カクつき対策）", pageGets === getsBeforeComplete, "gets=" + pageGets + " before=" + getsBeforeComplete);
const completePosts = posts.filter((p) => p.action === "complete" && p.id === "mail:111.1").length;
check("二重送信なし（complete POSTは1回）", completePosts === 1, "count=" + completePosts);

// タスク追加フォーム
await page.click('[data-tab="all"]');
await page.click("#addPanel summary");
await page.fill("#addTitle", "テスト追加タスク");
await page.click('[data-preset="tomorrow9"]');
await page.click("#addSubmit");
await page.waitForTimeout(400);
const addPost = posts.find((p) => p.action === "addTask");
check("addTask がPOSTされた", Boolean(addPost));
check("プリセット明日9:00が datetime に入る", addPost && /T09:00$/.test(addPost.datetime || ""), addPost && addPost.datetime);
check("登録待ちカードが表示される", await page.locator("#list .card.pending").count() >= 1);
check("担当者セレクトに自分+和田の2択", await page.locator("#addAssignee option").count() === 2);
await page.selectOption("#addAssignee", "和田");
check("担当=メンバーでヒントがDM文面に切替", await page.locator("#addHint").innerText().then((s) => s.includes("Slack DM")));
await page.fill("#addTitle", "メンバー割当テスト");
await page.click("#addSubmit");
await page.waitForTimeout(400);
check("addTask に assignee=和田 が含まれる", posts.some((p) => p.action === "addTask" && p.assignee === "和田"));
check("DM送信待ちカードが表示される", await page.locator("#list").innerText().then((s) => s.includes("DM送信待ち")));

// 面談の後入れ（貼り付け+担当のみ）
await page.click("#meetingPanel summary");
await page.fill("#mtgText", "\u3010\u9762\u8ac7\u3011\u30c6\u30b9\u30c8\u82d1\u00d7\u30c6\u30b9\u30c8\u69d8 12/25 14:00");
await page.click("#mtgSubmit");
await page.waitForTimeout(700);
check("addMeeting がPOSTされた（text+assignee=自分）", posts.some((p) => p.action === "addMeeting" && p.assignee === "自分" && (p.text || "").includes("テスト苑")));
check("面談追加の反映待ち表示", await page.locator("#mtgPending").innerText().then((s) => s.includes("反映待ち")));

// メンバータブ
await page.click('[data-tab="member"]');
check("メンバー管理パネル表示", await page.locator("#memberPanel").isVisible());
check("メンバー行2件（有効+無効）", await page.locator(".member-row").count() === 2);
check("メンバー共有カード1件", await page.locator("#list .card").count() === 1);
page.once("dialog", (d) => d.accept());
await page.click("[data-off='和田']");
await page.waitForTimeout(400);
check("disableMember がPOSTされた", posts.some((p) => p.action === "disableMember" && p.member === "和田"));
await page.fill("#memName", "山田太郎");
await page.fill("#memEmail", "t-yamada@kikari.co.jp");
await page.click("#memSubmit");
await page.waitForTimeout(400);
check("addMember がPOSTされた", posts.some((p) => p.action === "addMember" && p.email === "t-yamada@kikari.co.jp"));
check("追加反映待ちの行が出る", await page.locator(".member-row").count() === 3);

// 人ごとの残タスクまとめコピー
check("人カードは自分+有効メンバーの2枚（無効メンバーは出ない）", await page.locator(".person-card").count() === 2);
check("和田のまとめコピーボタンがある", await page.locator("[data-copy='和田']").count() === 1);
const wadaCard = page.locator(".person-card", { hasText: "和田さん" });
check("和田カードの負荷表示（未対応2件・期限超過1件）", await wadaCard.innerText().then((s) => s.includes("未対応") && s.includes("期限超過")));
check("和田カードの内訳（面談1件・依頼1件）", await wadaCard.innerText().then((s) => s.includes("面談 1件") && s.includes("依頼 1件")));
const selfCard = page.locator(".person-card", { hasText: "自分の分" });
check("自分カードに停滞フラグ（8日経過×2）", await selfCard.innerText().then((s) => s.includes("停滞")));
check("自分カードに最終送信の表示", await selfCard.innerText().then((s) => s.includes("最終送信")));
check("Slackで送るボタン（和田）がある", await page.locator("[data-send='和田']").count() === 1);
check("自分カードの内訳に全種別（面談2・Slack1・カレンダー1・入社1）", await selfCard.innerText().then((s) => s.includes("面談 2件") && s.includes("Slack 1件") && s.includes("カレンダー 1件") && s.includes("入社 1件")));

// 人ビュー: 人ごとの残タスクを1件ずつ展開表示
check("人カードに「タスクを見る」トグルがある", await page.locator("[data-ptoggle='自分']").count() === 1 && await page.locator("[data-ptoggle='和田']").count() === 1);
await page.click("[data-ptoggle='自分']");
await page.waitForTimeout(200);
const selfTasksBox = page.locator('.person-card[data-person="自分"] .person-tasks');
check("自分の展開リストに5件出る", await selfTasksBox.locator(".card").count() === 5);
check("自分の展開リストに全種別が混在（面談/Slack/カレンダー/入社）", await selfTasksBox.locator(".chip.tour").count() >= 1 && await selfTasksBox.locator(".chip.slack").count() === 1 && await selfTasksBox.locator(".chip.calendar").count() === 1 && await selfTasksBox.locator(".chip.onboarding").count() === 1);
check("自分の展開リストに各タスクのタイトルが出る", await selfTasksBox.innerText().then((s) => s.includes("深堀香織") && s.includes("河添大地") && s.includes("コンサルタントプロフィール記入") && s.includes("伊藤奈美")));
check("自分の展開リストの行にメモ・期日ボタンがある", await selfTasksBox.locator("[data-edit='calendar:555.5']").count() === 1);
await page.click("[data-ptoggle='和田']");
await page.waitForTimeout(200);
const wadaTasksBox = page.locator('.person-card[data-person="和田"] .person-tasks');
check("和田の展開リストに2件（面談+依頼共有）", await wadaTasksBox.locator(".card").count() === 2 && await wadaTasksBox.innerText().then((s) => s.includes("清和苑") && s.includes("福井様SO")));
check("和田の展開リストの行にSlackリンクがある", await wadaTasksBox.locator("a.slack-link").count() >= 1);
await page.click("[data-ptoggle='自分']");
await page.click("[data-ptoggle='和田']");
await page.waitForTimeout(200);
check("トグルを閉じると展開リストが消える", await page.locator(".person-tasks").count() === 0);
await page.evaluate(() => {
window.__copied = null;
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } });
});
await page.click("[data-copy='和田']");
await page.waitForTimeout(300);
const wadaText = await page.evaluate(() => window.__copied);
const wadaLines = (wadaText || "").split("\n");
check("和田まとめ1行目（件数・時点）", /^【和田さん】未対応 2件（\d{1,2}\/\d{1,2}時点）$/.test(wadaLines[0] || ""), wadaLines[0]);
check("和田まとめ期限超過行が先頭（⚠️+締切）", (wadaLines[1] || "").startsWith("⚠️期限超過 ") && wadaLines[1].includes("福井様SOの実施待ち連絡") && wadaLines[1].includes("締切: 11/16 18時"), wadaLines[1]);
check("和田まとめ面談行（締切なし=日経過）", (wadaLines[2] || "").startsWith("・") && wadaLines[2].includes("清和苑 黒木さん") && wadaLines[2].includes("1日経過"), wadaLines[2]);
check("和田まとめ末尾に✅依頼の1行", wadaLines[wadaLines.length - 1] === "対応したら元のメッセージに✅をお願いします");
check("和田まとめは全4行", wadaLines.length === 4, "lines=" + wadaLines.length);
check("コピー成功フィードバック表示", await page.locator("#okBar").isVisible() && await page.locator("#okBar").innerText().then((s) => s.includes("コピーしました")));
await page.click("[data-copy='自分']");
await page.waitForTimeout(300);
const selfText = await page.evaluate(() => window.__copied);
const selfLines = (selfText || "").split("\n");
check("自分まとめ1行目は【自分の分】", /^【自分の分】未対応 5件（\d{1,2}\/\d{1,2}時点）$/.test(selfLines[0] || ""), selfLines[0]);
check("自分まとめに✅依頼の行はない", !(selfText || "").includes("お願いします"));
check("自分まとめは全6行（見出し+5件）", selfLines.length === 6, "lines=" + selfLines.length);
check("自分まとめに全種別が混在（面談・Slack・カレンダー・入社）", (selfText || "").includes("深堀香織") && (selfText || "").includes("河添大地") && (selfText || "").includes("コンサルタントプロフィール記入") && (selfText || "").includes("伊藤奈美"));
// フォールバック: clipboard が失敗したらテキストエリア表示
await page.evaluate(() => {
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } });
});
await page.click("[data-copy='和田']");
await page.waitForTimeout(300);
check("コピー失敗時はテキストエリアにフォールバック表示", await page.locator("#copyText").isVisible() && await page.locator("#copyText").inputValue().then((v) => v.includes("【和田さん】")));
// 0件: 和田のタスクを消した状態で再描画するとボタンなし・未対応なし表示
await page.evaluate(() => {
tasks = tasks.filter((t) => (t.owner || "自分") !== "和田" && t.member !== "和田");
render();
});
check("0件の人はボタンなし・未対応なし表示", await page.locator("[data-copy='和田']").count() === 0 && await page.locator("#copyList").innerText().then((s) => s.includes("未対応なし")));
await page.evaluate(() => fetchState());
await page.waitForTimeout(400);

// Slackで送る（送信予約→送信待ち表示）
page.once("dialog", (d) => d.accept());
await page.click("[data-send='和田']");
await page.waitForTimeout(700);
check("sendSummary がPOSTされた", posts.some((p) => p.action === "sendSummary" && p.member === "和田"));
check("送信後は送信待ち表示になる", await page.locator("[data-send='和田']").count() === 0 && await page.locator("#copyList").innerText().then((s) => s.includes("送信待ち")));

// 完了済みタブ
await page.click('[data-tab="history"]');
check("完了済み3件表示（実績2件+楽観完了1件）", await page.locator(".hist-row").count() === 3);
check("楽観完了の行に反映待ち（次回同期時刻つき）", await page.locator(".hist-row.opt .hist-pend").innerText().then((s) => s.includes("反映待ち") && s.includes("次回")));

// 戻す（reopen）: 表示条件・送信・反映待ち・二重送信なし
check("reopenableな履歴に「未対応に戻す」ボタン", await page.locator("[data-reopen='tour:999.9']").count() === 1);
check("reopenableでない履歴にボタンなし", await page.locator("[data-reopen='mail:998.8']").count() === 0);
await page.evaluate(() => { window.__keepHistNode = document.querySelector('[data-hist-id="mail:998.8"]'); });
await page.click("[data-reopen='tour:999.9']");
await page.waitForTimeout(60);
check("戻しが即時反映（POST完了前に履歴から消える）", await page.locator("[data-reopen='tour:999.9']").count() === 0);
check("戻しで無関係な履歴行のDOMノードが保持される", await page.evaluate(() => Boolean(window.__keepHistNode) && window.__keepHistNode.isConnected && document.querySelector('[data-hist-id="mail:998.8"]') === window.__keepHistNode));
await page.waitForTimeout(700);
check("reopen がPOSTされた", posts.some((p) => p.action === "reopen" && p.id === "tour:999.9"));
check("二重送信なし（reopen POSTは1回）", posts.filter((p) => p.action === "reopen").length === 1);
await page.click('[data-tab="all"]');
check("戻したタスクが未対応に即時表示（戻し反映待ちバッジ）", await page.locator("#list").innerText().then((s) => s.includes("前西") && s.includes("戻し 反映待ち")));

// 削除の確認文（種別ごと）: 面談①準備=離脱、カレンダー=予定自体を削除
await page.click('[data-tab="tour"]');
await page.click("[data-del='tour:444.4']");
await page.waitForTimeout(200);
check("面談①準備の確認文に離脱が明記", await page.locator(".del-q").innerText().then((s) => s.includes("離脱")));
await page.click("[data-del-cancel]");
await page.click('[data-tab="calendar"]');
await page.click("[data-del='calendar:555.5']");
await page.waitForTimeout(200);
check("カレンダーの確認文に予定自体の削除が明記", await page.locator(".del-q").innerText().then((s) => s.includes("予定自体を削除します")));
await page.click("[data-del-cancel]");
check("確認文の表示だけでは delete はPOSTされない", !posts.some((p) => p.action === "delete"));

// メモ行タップでもメモ・期日フォームが開く
check("メモ行にタップ導線がある", await page.locator("[data-memo-edit='calendar:555.5']").count() === 1);
await page.click("[data-memo-edit='calendar:555.5']");
await page.waitForTimeout(200);
check("メモ行タップでメモ・期日フォームが開く", await page.locator("#metaDueInput").count() === 1 && await page.locator("#metaMemoInput").count() === 1);
check("フォームに既存の期日・メモが入っている", (await page.locator("#metaDueInput").inputValue()) === ymdOf(daysFromNow(3)) && (await page.locator("#metaMemoInput").inputValue()) === "プロフィール写真も用意する");
await page.click("[data-meta-cancel]");
check("メモ行から開いたフォームもキャンセルで閉じる", await page.locator("#metaDueInput").count() === 0);

// 削除フロー（Slackタスク）: 2段階確認→送信→反映待ち
await page.click('[data-tab="slack"]');
check("カードに削除ボタンがある", await page.locator("[data-del='slack:777.7']").count() === 1);
await page.click("[data-del='slack:777.7']");
await page.waitForTimeout(200);
check("1回目ではまだ delete はPOSTされない", !posts.some((p) => p.action === "delete"));
check("確認UI（削除する/やめる）が出る", await page.locator("[data-del-confirm='slack:777.7']").count() === 1 && await page.locator("[data-del-cancel]").count() === 1);
check("Slack削除の確認文（メッセージは消えない）", await page.locator(".del-q").innerText().then((s) => s.includes("消えません")));
await page.click("[data-del-cancel]");
await page.waitForTimeout(200);
check("やめるで確認UIが消える", await page.locator("[data-del-confirm]").count() === 0);
check("やめても delete はPOSTされない", !posts.some((p) => p.action === "delete"));
await page.click("[data-del='slack:777.7']");
await page.click("[data-del-confirm='slack:777.7']");
await page.waitForTimeout(400);
check("delete がPOSTされた", posts.some((p) => p.action === "delete" && p.id === "slack:777.7"));
check("二重送信なし（delete POSTは1回）", posts.filter((p) => p.action === "delete").length === 1);
check("削除が即時反映（行が消える）", await page.locator("[data-del='slack:777.7']").count() === 0);

// 差分更新: 完了しても無関係カードのDOMノード・上のカードの位置・スクロール位置が保たれる（全面再描画しない）
await page.click('[data-tab="all"]');
await page.waitForTimeout(200);
const visBefore = await page.evaluate(() => {
const anchor = document.querySelector('[data-card-id="tour:222.2"]');
window.__keepCardNode = document.querySelector('[data-card-id="tour:444.4"]');
anchor.scrollIntoView({ block: "center" });
return { top: anchor.getBoundingClientRect().top, y: window.scrollY };
});
await page.evaluate(() => complete("tour:333.3"));
await page.waitForTimeout(200);
check("完了で無関係カードのDOMノードが保持される", await page.evaluate(() => Boolean(window.__keepCardNode) && window.__keepCardNode.isConnected && document.querySelector('[data-card-id="tour:444.4"]') === window.__keepCardNode));
check("完了で上のカードの見た目の位置が保たれる", await page.evaluate((before) => Math.abs(document.querySelector('[data-card-id="tour:222.2"]').getBoundingClientRect().top - before.top) <= 2, visBefore));
check("完了でスクロール位置が保たれる", await page.evaluate((before) => Math.abs(window.scrollY - before.y) <= 2, visBefore));
check("完了したカードは一覧から消える", await page.locator('[data-card-id="tour:333.3"]').count() === 0);

// 期日・メモの編集UI
await page.click('[data-tab="onboarding"]');
check("メモ・期日ボタンがある（ラベルでメモ欄と分かる）", await page.locator("[data-edit='onboarding:888.8']").count() === 1 && await page.locator("[data-edit='onboarding:888.8']").innerText().then((s) => s.trim() === "メモ・期日"));
await page.click("[data-edit='onboarding:888.8']");
check("編集UIが開く（期日入力+メモ欄）", await page.locator("#metaDueInput").count() === 1 && await page.locator("#metaMemoInput").count() === 1);
await page.click("[data-meta-cancel]");
check("キャンセルで編集UIが閉じる", await page.locator("#metaDueInput").count() === 0);
check("キャンセルでは setMeta はPOSTされない", !posts.some((p) => p.action === "setMeta"));
await page.click("[data-edit='onboarding:888.8']");
await page.fill("#metaDueInput", "2026-12-01");
await page.fill("#metaMemoInput", "入社書類の確認メモ");
await page.click("[data-meta-save='onboarding:888.8']");
await page.waitForTimeout(400);
const metaPost = posts.find((p) => p.action === "setMeta");
check("setMeta がPOSTされた（id/due/memo）", metaPost && metaPost.id === "onboarding:888.8" && metaPost.due === "2026-12-01" && metaPost.memo === "入社書類の確認メモ", JSON.stringify(metaPost));
check("保存後にメモがカードへ即反映", await page.locator("#list").innerText().then((s) => s.includes("入社書類の確認メモ")));
check("保存後に期日がカードへ即反映", await page.locator("#list").innerText().then((s) => s.includes("期日: 12/1")));
check("保存成功フィードバック表示", await page.locator("#okBar").innerText().then((s) => s.includes("保存しました")));
await page.click("[data-edit='onboarding:888.8']");
check("編集UIに保存済みの値が入っている", (await page.locator("#metaDueInput").inputValue()) === "2026-12-01" && (await page.locator("#metaMemoInput").inputValue()) === "入社書類の確認メモ");
await page.fill("#metaDueInput", "");
await page.fill("#metaMemoInput", "");
await page.click("[data-meta-save='onboarding:888.8']");
await page.waitForTimeout(400);
const clearPost = posts.filter((p) => p.action === "setMeta").pop();
check("クリア保存は due/memo とも空でPOST", clearPost && clearPost.due === "" && clearPost.memo === "", JSON.stringify(clearPost));
check("クリア後に期日・メモが消える", await page.locator("#list").innerText().then((s) => !s.includes("入社書類の確認メモ") && !s.includes("期日: 12/1")));
// まとめコピーへの反映（期日が締切表示に優先される）
await page.click('[data-tab="tour"]');
await page.click("[data-edit='tour:444.4']");
await page.fill("#metaDueInput", "2026-11-25");
await page.click("[data-meta-save='tour:444.4']");
await page.waitForTimeout(400);
await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } }); });
await page.click('[data-tab="member"]');
await page.click("[data-copy='和田']");
await page.waitForTimeout(300);
const wadaText2 = await page.evaluate(() => window.__copied);
check("まとめコピーの締切に期日が優先表示される", (wadaText2 || "").includes("清和苑 黒木さん") && (wadaText2 || "").includes("締切: 11/25"), wadaText2);

// 人ビューの展開リスト内から完了でき、人カードの件数も差分で追従する
await page.click("[data-ptoggle='和田']");
await page.waitForTimeout(200);
const wadaTasksBox2 = page.locator('.person-card[data-person="和田"] .person-tasks');
check("展開リスト再表示（3件: 面談・依頼共有・戻しで復活した面談）", await wadaTasksBox2.locator(".card").count() === 3);
await page.click('.person-card[data-person="和田"] .person-tasks [data-done="member:666.6"]');
await page.waitForTimeout(100);
check("展開リスト内の完了でその行が消える", await wadaTasksBox2.locator(".card").count() === 2 && await wadaTasksBox2.locator('[data-card-id="member:666.6"]').count() === 0);
check("展開リスト内の完了で人カードの未対応が2件に減る", await page.evaluate(() => personStats("和田").list.length === 2 && personStats("和田").bd.tour === 2));
await page.waitForTimeout(500);
check("展開リスト内の完了も complete がPOSTされる", posts.some((p) => p.action === "complete" && p.id === "member:666.6"));

// 空タブ（入社は1件あるのでカレンダー以外を確認: フェーズ絞り込みで0件）
await page.click('[data-tab="onboarding"]');
await page.fill("#searchBox", "存在しない名前");
check("0件で空表示", await page.locator(".empty").count() === 1);
await page.fill("#searchBox", "");

// API失敗時: エラーバーが出て固まらない
const page2 = await ctx.newPage();
await page2.route("https://script.google.com/**", async (route) => { await route.abort(); });
await page2.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page2.waitForTimeout(600);
check("API失敗時にエラーバー表示", await page2.locator("#errBar").isVisible());
check("API失敗時もタブが描画される", await page2.locator(".tab").count() === 8);
await page2.close();

// POST失敗時: エラーバーが出て固まらない（GETは成功、POSTだけ abort）
const page3 = await ctx.newPage();
await page3.route("https://script.google.com/**", async (route) => {
if (route.request().method() === "POST") { await route.abort(); return;}
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockState())});
});
await page3.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle"});
await page3.click('[data-tab="onboarding"]');
await page3.click("[data-done='onboarding:888.8']");
await page3.waitForTimeout(600);
check("POST失敗時にエラーバー表示", await page3.locator("#errBar").isVisible());
await page3.close();

// 消失検出: 痕跡のない楽観操作は警告して表示を戻す（黙って成功扱いにしない）
await page.click('[data-tab="calendar"]');
await page.evaluate(() => {
const t = tasks.find((x) => x.id === "calendar:555.5");
optTasks["calendar:555.5"] = { kind: "complete", row: { closedAt: "たった今", type: t.type, typeLabel: t.typeLabel, title: t.title, howLabel: "✅で完了", owner: t.owner, id: t.id, reopenable: false, pending: true, opt: true }, misses: 2 };
tasks = tasks.filter((x) => x.id !== "calendar:555.5");
render();
});
check("消失シミュレーション: いったん行が消える", await page.locator("[data-done='calendar:555.5']").count() === 0);
await page.evaluate(() => fetchState());
await page.waitForTimeout(300);
check("消失検出で警告が出る", await page.locator("#errBar").innerText().then((s) => s.includes("消失")));
check("消失検出で行が元に戻る（再操作できる）", await page.locator("[data-done='calendar:555.5']").count() === 1);

// 反映待ちの「完了」を取り消す（完了済みタブの楽観行から→未対応に戻って操作可能になる）
await page.click('[data-tab="onboarding"]');
await page.click("[data-done='onboarding:888.8']");
await page.waitForTimeout(700);
check("取り消し前提: 完了がPOSTされ行が消える", posts.some((p) => p.action === "complete" && p.id === "onboarding:888.8") && await page.locator("[data-done='onboarding:888.8']").count() === 0);
await page.click('[data-tab="history"]');
check("楽観完了の行に「完了を取り消す」ボタン", await page.locator("[data-cancel-opt='onboarding:888.8']").count() === 1 && await page.locator("[data-cancel-opt='onboarding:888.8']").innerText().then((s) => s.includes("完了を取り消す")));
await page.click("[data-cancel-opt='onboarding:888.8']");
await page.waitForTimeout(60);
check("取り消しが即時反映（POST完了前に完了済みから消える）", await page.locator("[data-cancel-opt='onboarding:888.8']").count() === 0);
await page.waitForTimeout(700);
check("cancelAction がPOSTされた（完了の取り消し）", posts.some((p) => p.action === "cancelAction" && p.id === "onboarding:888.8"));
check("cancelAction は1回だけ（二重送信なし）", posts.filter((p) => p.action === "cancelAction" && p.id === "onboarding:888.8").length === 1);
await page.click('[data-tab="onboarding"]');
check("取り消したタスクが未対応に戻り操作できる（完了ボタン復活）", await page.locator("[data-done='onboarding:888.8']").count() === 1);
check("取り消し成功フィードバック表示", await page.locator("#okBar").innerText().then((s) => s.includes("取り消しました")));

// 反映待ちの「削除」を取り消す
await page.click('[data-tab="calendar"]');
await page.click("[data-del='calendar:555.5']");
await page.waitForTimeout(200);
await page.click("[data-del-confirm='calendar:555.5']");
await page.waitForTimeout(700);
check("取り消し前提: delete がPOSTされた（カレンダー）", posts.filter((p) => p.action === "delete" && p.id === "calendar:555.5").length === 1);
await page.click('[data-tab="history"]');
check("楽観削除の行に「削除を取り消す」ボタン", await page.locator("[data-cancel-opt='calendar:555.5']").count() === 1 && await page.locator("[data-cancel-opt='calendar:555.5']").innerText().then((s) => s.includes("削除を取り消す")));
await page.click("[data-cancel-opt='calendar:555.5']");
await page.waitForTimeout(700);
check("cancelAction がPOSTされた（削除の取り消し）", posts.some((p) => p.action === "cancelAction" && p.id === "calendar:555.5"));
await page.click('[data-tab="calendar"]');
check("削除を取り消したタスクが未対応に戻る", await page.locator("[data-done='calendar:555.5']").count() === 1);

// 取り消し対象が無い場合（既に反映済みの可能性）: 警告が出て、実状態への読み戻しで帳尻が合う
// ※この区間は「サーバ側に痕跡のない楽観行」を植えるため、30秒周期の自動再取得が割り込むと pruneOpts に消されてしまう。区間内だけ自動再取得を止める
await page.evaluate(() => {
window.__fetchStateOrig = fetchState;
fetchState = async () => {};
const t = tasks.find((x) => x.id === "onboarding:888.8");
optTasks[t.id] = { kind: "complete", task: t, row: histRowFromTask(t, "✅で完了", "complete") };
tasks = tasks.filter((x) => x.id !== t.id);
history = history.concat(optTasks[t.id].row);
render();
});
await page.click('[data-tab="history"]');
await page.click("[data-cancel-opt='onboarding:888.8']");
await page.waitForTimeout(900);
check("対象なしの取り消しで「既に反映済みの可能性」警告", await page.locator("#errBar").innerText().then((s) => s.includes("既に反映済みの可能性")));
await page.click('[data-tab="onboarding"]');
check("読み戻し後はタスクが未対応に残る（完了済みに残らない）", await page.locator("[data-done='onboarding:888.8']").count() === 1);
await page.evaluate(() => { fetchState = window.__fetchStateOrig; return fetchState(); });
await page.waitForTimeout(400);

// 「未対応に戻す」の取り消し（未対応側の楽観カードから→履歴に戻る）
await page.click('[data-tab="all"]');
check("戻し反映待ちのカードに「戻すを取り消す」ボタン", await page.locator("#list [data-cancel-reopen='tour:999.9']").count() === 1);
await page.click("#list [data-cancel-reopen='tour:999.9']");
await page.waitForTimeout(700);
check("cancelAction がPOSTされた（戻しの取り消し）", posts.some((p) => p.action === "cancelAction" && p.id === "tour:999.9"));
check("戻しを取り消すと未対応カードが消える", await page.locator('#list [data-card-id="tour:999.9"]').count() === 0);
await page.click('[data-tab="history"]');
check("戻しを取り消すと履歴に「未対応に戻す」ボタンが戻る", await page.locator("[data-reopen='tour:999.9']").count() === 1);

// 案件クローズ（失注）の取り消し（反映待ちストリップから→案件が戻る）
await page.click('[data-tab="all"]');
page.once("dialog", (d) => d.accept());
await page.click(".meet-row [data-lost='ev2']");
await page.waitForTimeout(700);
check("取り消し前提: caseClose がPOSTされた（ev2）", posts.some((p) => p.action === "caseClose" && p.eventId === "ev2"));
check("案件クローズの反映待ちストリップに「取り消す」ボタン", await page.locator("[data-cancel-case='ev2']").count() === 1);
await page.click("[data-cancel-case='ev2']");
await page.waitForTimeout(700);
check("cancelAction がPOSTされた（案件は case:ev2）", posts.some((p) => p.action === "cancelAction" && p.id === "case:ev2"));
check("取り消すと面談実施待ちに案件が戻る", await page.locator(".meet-row [data-lost='ev2']").count() === 1);
check("取り消すと反映待ちストリップが消える", await page.locator("[data-cancel-case='ev2']").count() === 0);

// 再読み込み後に残る反映待ちカードの取り消し（楽観記録が手元に無い状態から）
const page5 = await ctx.newPage();
await page5.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
if (body.action === "complete") pending.add(body.id);
let resp5 = { ok: true };
if (body.action === "cancelAction") {
const hit = pending.delete(body.id) || deletePending.delete(body.id) || reopenPending.delete(body.id) || casePendSet.delete(body.id);
if (!hit) resp5 = { ok: false, error: "no_pending_action" };
}
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp5) });
return;
}
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockState()) });
});
await page5.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page5.click('[data-tab="calendar"]');
await page5.click("[data-done='calendar:555.5']");
await page5.waitForTimeout(700);
await page5.reload({ waitUntil: "networkidle" });
await page5.waitForTimeout(400);
await page5.click('[data-tab="calendar"]');
check("再読み込み後は反映待ちカードとして残る", await page5.locator('[data-card-id="calendar:555.5"] .pend-chip').count() === 1);
check("反映待ちカードに「操作を取り消す」ボタン", await page5.locator("[data-cancel-pending='calendar:555.5']").count() === 1);
const cancelCalBefore = posts.filter((p) => p.action === "cancelAction" && p.id === "calendar:555.5").length;
await page5.click("[data-cancel-pending='calendar:555.5']");
await page5.waitForTimeout(60);
check("カードの取り消しが即時反映（完了ボタンが戻る）", await page5.locator("[data-done='calendar:555.5']").count() === 1);
await page5.waitForTimeout(700);
check("cancelAction がPOSTされた（カードの取り消し）", posts.filter((p) => p.action === "cancelAction" && p.id === "calendar:555.5").length === cancelCalBefore + 1);
await page5.close();

// 回収チェックリスト: サーバ側で反映待ちの項目（再読み込み後）→チェック済み表示、外すと cancelPending 経路で cancelAction
// ※モックの pending は全ページ共有。メイン側「差分更新」テストで tour:333.3 を完了した分が残っているので、page6 の前提（333.3は未対応）に合わせて消しておく
pending.delete("tour:333.3");
const page6 = await ctx.newPage();
await page6.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
if (body.action === "complete") pending.add(body.id);
let resp6 = { ok: true };
if (body.action === "cancelAction") {
const hit = pending.delete(body.id) || deletePending.delete(body.id) || reopenPending.delete(body.id) || casePendSet.delete(body.id);
if (!hit) resp6 = { ok: false, error: "no_pending_action" };
}
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp6) });
return;
}
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockState()) });
});
await page6.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
// ev1は③以降の案件なので面談タブには出ない。完了は「すべて」タブのカードから行う
await page6.click("[data-done='tour:222.2']");
await page6.waitForTimeout(700);
await page6.reload({ waitUntil: "networkidle" });
await page6.waitForTimeout(400);
await page6.click('[data-tab="tour"]');
await page6.evaluate(() => { openCases["ev1"] = true; render(); });
await page6.waitForTimeout(200);
check("再読み込み後: 反映待ちの回収項目はチェック済み・反映待ちで出る", await page6.evaluate(() => {
const inp = document.querySelector("#case-ev1 [data-collect-check='tour:222.2']");
const row = inp && inp.closest(".collect-row");
return Boolean(inp) && inp.checked && !inp.disabled && row && row.getAttribute("data-cstate") === "pending" && row.textContent.includes("反映待ち");
}));
check("再読み込み後: 回収の進捗は 2/4", await page6.locator("#case-ev1 [data-collect-prog]").innerText().then((s) => s.includes("2/4")));
// 残りの実タスクをチェックしても、未送信の⑤（送信待ち）が残るので 3/4 まで
await page6.click("#case-ev1 [data-collect-check='tour:333.3']");
await page6.waitForTimeout(700);
check("残りの実タスクをチェックすると進捗は 3/4", await page6.locator("#case-ev1 [data-collect-prog]").innerText().then((s) => s.includes("3/4")));
// 未送信の⑤を先行チェックすると tour:pending: 形式のIDで complete がPOSTされ、全て回収済みになる
await page6.click("#case-ev1 [data-collect-check='tour:pending:ev1:followup']");
await page6.waitForTimeout(700);
check("未送信⑤の先行チェックで complete がPOSTされる（tour:pending:ev1:followup）", posts.some((p) => p.action === "complete" && p.id === "tour:pending:ev1:followup"));
check("⑤まで先行チェックすると「全て回収済み」表示", await page6.locator("#case-ev1 [data-collect-prog]").innerText().then((s) => s.includes("全て回収済み")));
check("チップも「回収 4/4」になる", await page6.locator("[data-collect-chip='ev1']").innerText().then((s) => s.includes("回収 4/4")));
// サーバ側で反映待ちの項目のチェックを外す→ cancelAction（cancelPending 経路）
const cancel222Before = posts.filter((p) => p.action === "cancelAction" && p.id === "tour:222.2").length;
await page6.click("#case-ev1 [data-collect-check='tour:222.2']");
await page6.waitForTimeout(700);
check("反映待ち（サーバ側）のチェックを外すと cancelAction がPOSTされる", posts.filter((p) => p.action === "cancelAction" && p.id === "tour:222.2").length === cancel222Before + 1);
check("外すと行が未チェックに戻り進捗は 3/4", await page6.evaluate(() => {
const inp = document.querySelector("#case-ev1 [data-collect-check='tour:222.2']");
const prog = document.querySelector("#case-ev1 [data-collect-prog]");
return Boolean(inp) && !inp.checked && !inp.disabled && prog && prog.textContent.includes("3/4");
}));
await page6.close();

// 入社タブの入社待ち行から回収チェックリストを操作する（案件詳細と同じ組み立て・同じ操作経路）
// ※モックの pending は全ページ共有。page6 の完了分（tour:333.3）が残っているので前提（ev1は回収1/4）に合わせて消しておく
pending.delete("tour:333.3");
// ※caseOverrides も全ページ共有。本体テストで ev1 に付けた「入社済み」を戻し、入社待ちに出る状態で始める
caseOverrides.ev1.startResult = "";
caseOverrides.ev1.startResultDate = "";
const page7 = await ctx.newPage();
await page7.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
if (body.action === "complete") pending.add(body.id);
let resp7 = { ok: true };
if (body.action === "cancelAction") {
const hit = pending.delete(body.id) || deletePending.delete(body.id) || reopenPending.delete(body.id) || casePendSet.delete(body.id);
if (!hit) resp7 = { ok: false, error: "no_pending_action" };
}
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp7) });
return;
}
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockState()) });
});
await page7.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page7.click('[data-tab="onboarding"]');
await page7.waitForTimeout(300);
check("入社待ち行（入社日あり・ev1）に回収進捗 1/4 が常時表示", await page7.locator("[data-start-collect='ev1']").innerText().then((s) => s.includes("回収 1/4")));
check("入社待ち行（内定済み・入社日未登録・ev4）にも回収進捗 0/1 が常時表示", await page7.locator("[data-start-collect='ev4']").innerText().then((s) => s.includes("回収 0/1")));
check("内定済み・入社日未登録の案件が入社待ちに出ている（詳細を開く導線も残る）", await page7.locator("#dash").innerText().then((s) => s.includes("未登録苑") && s.includes("入社日を入れてください")) && await page7.locator("[data-gocase='ev4']").count() === 1);
check("展開前は入社待ち行にチェックボックスは無い", await page7.locator("#dash [data-collect-check]").count() === 0);
await page7.click("[data-collect-toggle='ev1']");
await page7.waitForTimeout(200);
check("入社待ち行を展開するとチェックリストがその場で開く（4行）", await page7.locator("#dash .collect-box[data-collect-ev='ev1'] .collect-row").count() === 4);
check("入社待ち行のチェック先は案件詳細と同じ tour:222.2 / tour:333.3", await page7.locator("#dash [data-collect-check='tour:222.2']").count() === 1 && await page7.locator("#dash [data-collect-check='tour:333.3']").count() === 1);
const comp222Before7 = posts.filter((p) => p.action === "complete" && p.id === "tour:222.2").length;
await page7.click("#dash [data-collect-check='tour:222.2']");
await page7.waitForTimeout(700);
check("入社タブでチェックすると complete がPOSTされる", posts.filter((p) => p.action === "complete" && p.id === "tour:222.2").length === comp222Before7 + 1);
check("入社タブでもチェック行がチェック済み・反映待ち表示になる", await page7.evaluate(() => {
const inp = document.querySelector("#dash [data-collect-check='tour:222.2']");
const row = inp && inp.closest(".collect-row");
return Boolean(inp) && inp.checked && !inp.disabled && row && row.getAttribute("data-cstate") === "pendingOpt" && row.textContent.includes("反映待ち");
}));
check("入社待ち行の進捗表示も 2/4 に進む", await page7.locator("[data-start-collect='ev1']").innerText().then((s) => s.includes("回収 2/4")));
const cancel222Before7 = posts.filter((p) => p.action === "cancelAction" && p.id === "tour:222.2").length;
await page7.click("#dash [data-collect-check='tour:222.2']");
await page7.waitForTimeout(700);
check("入社タブで反映待ちのチェックを外すと cancelAction がPOSTされる", posts.filter((p) => p.action === "cancelAction" && p.id === "tour:222.2").length === cancel222Before7 + 1);
check("入社タブで取り消すと行が未チェックに戻り進捗は 1/4", await page7.evaluate(() => {
const inp = document.querySelector("#dash [data-collect-check='tour:222.2']");
const chip = document.querySelector("[data-start-collect='ev1']");
return Boolean(inp) && !inp.checked && !inp.disabled && chip && chip.textContent.includes("回収 1/4");
}));
// 内定済み・入社日未登録の案件（ev4）も入社待ちから管理できる（対応タスクがある状態にしてチェック→完了キュー）
await page7.click("[data-collect-toggle='ev4']");
await page7.waitForTimeout(200);
check("入社日未登録の行も展開できる（対応タスク未特定の項目は操作不可で出る）", await page7.evaluate(() => {
const inp = document.querySelector("#dash .collect-box[data-collect-ev='ev4'] input[type=checkbox]");
return Boolean(inp) && inp.disabled;
}));
await page7.evaluate(() => {
tasks.push({ id: "tour:4444.4", type: "tour", typeLabel: "面談", title: "🟧未登録苑 未登録様", datetimeLabel: "", elapsedDays: 2, deadlineLabel: "", slackUrl: "https://example.com/s8", groupKey: "ev4", groupTitle: "未登録苑 未登録様", member: "", shareKind: "", overdue: false, phase: "③書類回収", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" });
render();
});
await page7.waitForTimeout(200);
check("対応タスクがあれば入社日未登録の行でもチェックできる", await page7.evaluate(() => {
const inp = document.querySelector("#dash [data-collect-check='tour:4444.4']");
return Boolean(inp) && !inp.disabled && !inp.checked;
}));
await page7.click("#dash [data-collect-check='tour:4444.4']");
await page7.waitForTimeout(700);
check("入社日未登録の行でチェックすると complete がPOSTされる（tour:4444.4）", posts.some((p) => p.action === "complete" && p.id === "tour:4444.4"));
check("入社日未登録の行の進捗が「全て回収済み」になる", await page7.locator("[data-start-collect='ev4']").innerText().then((s) => s.includes("全て回収済み")));
// 入社待ち行から詳細を開かずに直接入社日を登録できる（ピッカー+登録ボタン→既存 setStartDate と同形式でPOST）
check("入社日未登録の行に日付ピッカーと登録ボタンがある", await page7.locator("#panelStartDate-ev4").count() === 1 && await page7.locator("[data-start-save-panel='ev4']").count() === 1);
check("詳細を開く導線も残っている", await page7.locator("[data-gocase='ev4']").count() === 1);
const sdPostsBefore7 = posts.filter((p) => p.action === "setStartDate" && p.eventId === "ev4").length;
await page7.click("[data-start-save-panel='ev4']");
await page7.waitForTimeout(200);
check("日付未選択で登録するとエラー表示されPOSTされない", await page7.locator("#errBar").innerText().then((s) => s.includes("入社日を選んでください")) && posts.filter((p) => p.action === "setStartDate" && p.eventId === "ev4").length === sdPostsBefore7);
await page7.fill("#panelStartDate-ev4", ymdOf(daysFromNow(21)));
await page7.click("[data-start-save-panel='ev4']");
await page7.waitForTimeout(60);
check("パネル登録が即時反映（POST完了前に日付・あと21日・反映待ちが行に出る）", await page7.evaluate(() => {
const rows = Array.from(document.querySelectorAll("#dash .start-row"));
const r = rows.find((x) => x.textContent.includes("未登録苑"));
return Boolean(r) && r.textContent.includes("あと21日") && r.textContent.includes("反映待ち") && !r.textContent.includes("入社日を入れてください");
}));
await page7.waitForTimeout(700);
check("パネルから setStartDate がPOSTされた（ev4・日付一致）", posts.some((p) => p.action === "setStartDate" && p.eventId === "ev4" && p.date === ymdOf(daysFromNow(21))));
check("二重送信なし（パネル登録のPOSTは1回）", posts.filter((p) => p.action === "setStartDate" && p.eventId === "ev4").length === sdPostsBefore7 + 1);
check("パネル登録の成功フィードバック表示", await page7.locator("#okBar").innerText().then((s) => s.includes("入社日を") && s.includes("登録しました")));
check("登録後も行に回収進捗が残る（チェックリストと干渉しない）", await page7.locator("[data-start-collect='ev4']").innerText().then((s) => s.includes("全て回収済み")));
await page7.close();

// 入社待ちパネル: 担当者別セクション（自分→メンバー登録順）＋セクション内は未登録を先頭に、入社日が近い順
const page8 = await ctx.newPage();
await page8.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
if (body.action === "complete") pending.add(body.id);
let resp8 = { ok: true };
if (body.action === "cancelAction") {
const hit = pending.delete(body.id) || deletePending.delete(body.id) || reopenPending.delete(body.id) || casePendSet.delete(body.id);
if (!hit) resp8 = { ok: false, error: "no_pending_action" };
}
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp8) });
return;
}
const st8 = mockState();
// 前セクションまでの共有状態（追加済み入社待ち・ev1の日付変更）の影響を切り、page8 の前提を固定する
st8.startAdds = [];
const ev1fix8 = st8.cases.find((c) => c.eventId === "ev1");
if (ev1fix8) { ev1fix8.startDate = ymdOf(daysFromNow(7)); ev1fix8.daysToStart = 7; ev1fix8.startResult = ""; ev1fix8.startResultDate = ""; }
const decidedStages8 = [
{ phase: "②内定確認", label: "②内定確認", status: "done", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "open", slackUrl: "https://example.com/s9" }
];
st8.cases.push(
{ eventId: "evW2", facility: "和田苑B", person: "和田未様", owner: "和田", meetingLabel: mdOf(-2) + " 10時", meetingIso: daysFromNow(-2).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "", stages: decidedStages8 },
{ eventId: "evW1", facility: "和田苑A", person: "和田先様", owner: "和田", meetingLabel: mdOf(-4) + " 10時", meetingIso: daysFromNow(-4).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: ymdOf(daysFromNow(3)), daysToStart: 3, startResult: "", startResultDate: "", stages: decidedStages8 },
{ eventId: "evS1", facility: "近日苑", person: "近日様", owner: "自分", meetingLabel: mdOf(-5) + " 10時", meetingIso: daysFromNow(-5).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: ymdOf(daysFromNow(2)), daysToStart: 2, startResult: "", startResultDate: "", stages: decidedStages8 },
{ eventId: "evP1", facility: "過去苑", person: "過去様", owner: "自分", meetingLabel: mdOf(-9) + " 10時", meetingIso: daysFromNow(-9).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: ymdOf(daysFromNow(-2)), daysToStart: -2, startResult: "", startResultDate: "", stages: decidedStages8 }
);
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st8) });
});
await page8.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page8.click('[data-tab="onboarding"]');
await page8.waitForTimeout(300);
const startSeq8 = () => {
const els = Array.from(document.querySelectorAll("#dash .start-owner, #dash .start-row"));
return els.map((el) => {
if (el.classList.contains("start-owner")) return "H:" + el.getAttribute("data-start-owner");
const t = el.textContent;
for (const f of ["未登録苑", "過去苑", "近日苑", "すずらん", "和田苑B", "和田苑A"]) if (t.includes(f)) return f;
return "?";
});
};
check("入社待ちが担当者別セクションに分かれる（自分→和田の順・見出し文言）", await page8.evaluate(() => {
const hs = Array.from(document.querySelectorAll("#dash [data-start-owner]"));
return hs.length === 2 && hs[0].getAttribute("data-start-owner") === "自分" && hs[1].getAttribute("data-start-owner") === "和田" &&
hs[0].textContent.includes("自分の分") && hs[1].textContent.includes("和田さんの分");
}));
check("セクション見出しに件数（自分の分4件・和田さんの分2件）", await page8.evaluate(() => {
const hs = Array.from(document.querySelectorAll("#dash [data-start-owner]"));
return hs.length === 2 && hs[0].textContent.includes("4件") && hs[1].textContent.includes("2件");
}));
check("パネル見出しの件数は従来どおり入社日ありの4件", await page8.evaluate(() => {
const p = Array.from(document.querySelectorAll("#dash .dash-panel")).find((x) => (x.querySelector("h2") || {}).textContent.includes("入社待ち"));
return Boolean(p) && p.querySelector("h2").textContent.includes("4件");
}));
check("行の並び: 自分=未登録→経過→近い順 / 和田=未登録→近い順", await page8.evaluate(startSeq8).then((s) =>
JSON.stringify(s) === JSON.stringify(["H:自分", "未登録苑", "過去苑", "近日苑", "すずらん", "H:和田", "和田苑B", "和田苑A"])));
check("入社日を過ぎた行は「2日経過」バッジ＋期限超過スタイル", await page8.evaluate(() => {
const r = Array.from(document.querySelectorAll("#dash .start-row")).find((x) => x.textContent.includes("過去苑"));
return Boolean(r) && r.textContent.includes("2日経過") && r.classList.contains("past");
}));
check("近い順のバッジ（近日苑=あと2日・和田苑A=あと3日・すずらん=あと7日）", await page8.evaluate(() => {
const rows = Array.from(document.querySelectorAll("#dash .start-row"));
const find = (f) => rows.find((x) => x.textContent.includes(f));
return find("近日苑").textContent.includes("あと2日") && find("和田苑A").textContent.includes("あと3日") && find("すずらん").textContent.includes("あと7日");
}));
check("和田の未登録行にもインライン入社日登録UIがある（グルーピングで壊れていない）", await page8.locator("#panelStartDate-evW2").count() === 1 && await page8.locator("[data-start-save-panel='evW2']").count() === 1);
await page8.fill("#panelStartDate-evW2", ymdOf(daysFromNow(10)));
await page8.click("[data-start-save-panel='evW2']");
await page8.waitForTimeout(60);
check("和田の行で登録すると和田セクション内で日付あり行になる（あと10日・和田苑Aの後）", await page8.evaluate((seqFn) => {
const els = Array.from(document.querySelectorAll("#dash .start-owner, #dash .start-row"));
const seq = els.map((el) => {
if (el.classList.contains("start-owner")) return "H:" + el.getAttribute("data-start-owner");
const t = el.textContent;
for (const f of ["未登録苑", "過去苑", "近日苑", "すずらん", "和田苑B", "和田苑A"]) if (t.includes(f)) return f;
return "?";
});
const rowB = els.find((el) => el.classList.contains("start-row") && el.textContent.includes("和田苑B"));
return JSON.stringify(seq) === JSON.stringify(["H:自分", "未登録苑", "過去苑", "近日苑", "すずらん", "H:和田", "和田苑A", "和田苑B"]) && Boolean(rowB) && rowB.textContent.includes("あと10日");
}));
await page8.waitForTimeout(700);
check("和田の行からも setStartDate がPOSTされた（evW2・日付一致）", posts.some((p) => p.action === "setStartDate" && p.eventId === "evW2" && p.date === ymdOf(daysFromNow(10))));
await page8.close();

// 入社待ちの直接追加: 担当セレクト＋書類回収済みチェック（仮表示行は担当セクションに出て、チップが付く）
const page9 = await ctx.newPage();
await page9.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
if (body.action === "addStart") addedStarts.push(body);
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
return;
}
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockState()) });
});
await page9.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page9.click('[data-tab="onboarding"]');
await page9.waitForTimeout(300);
await page9.click("[data-start-add-toggle]");
check("追加フォームに担当セレクト（自分＋有効メンバーのみ・既定は自分）", await page9.evaluate(() => {
const sel = document.querySelector("#startAddAssignee");
if (!sel) return false;
const vals = Array.from(sel.options).map((o) => o.value);
return vals.includes("自分") && vals.includes("和田") && !vals.includes("岸田") && sel.value === "自分";
}));
check("追加フォームに書類回収済みチェックボックス（既定オフ）", await page9.evaluate(() => {
const cb = document.querySelector("#startAddDocs");
return Boolean(cb) && cb.checked === false;
}));
const scanStartRow9 = (needle) => {
const els = Array.from(document.querySelectorAll("#dash .start-owner, #dash .start-row"));
let cur = "";
for (const el of els) {
if (el.classList.contains("start-owner")) { cur = el.getAttribute("data-start-owner"); continue; }
if (el.textContent.includes(needle)) return { owner: cur, text: el.textContent };
}
return null;
};
await page9.fill("#startAddText", "老健たんぽぽ 田中様 入社決定");
await page9.fill("#startAddDate", ymdOf(daysFromNow(10)));
await page9.selectOption("#startAddAssignee", "和田");
await page9.check("#startAddDocs");
await page9.click("[data-start-add-submit]");
await page9.waitForTimeout(60);
const row9a = await page9.evaluate(scanStartRow9, "老健たんぽぽ");
check("仮表示行が和田のセクションに出る（書類回収済みチップ＋反映待ち）",
Boolean(row9a) && row9a.owner === "和田" && row9a.text.includes("書類回収済み") && row9a.text.includes("反映待ち") && row9a.text.includes("担当: 和田"), JSON.stringify(row9a));
await page9.waitForTimeout(700);
const startPost9 = posts.filter((p) => p.action === "addStart").pop();
check("addStart POSTに assignee / docsCollected が入る", startPost9 && startPost9.assignee === "和田" && startPost9.docsCollected === true, JSON.stringify(startPost9));
await page9.evaluate(() => fetchState());
await page9.waitForTimeout(400);
const row9b = await page9.evaluate(scanStartRow9, "老健たんぽぽ");
check("着地（state経由）後も和田セクションに書類回収済みチップが残る",
Boolean(row9b) && row9b.owner === "和田" && row9b.text.includes("書類回収済み"), JSON.stringify(row9b));
// 既定（自分・チェックなし）の追加は自分のセクションにチップなしで出る
await page9.click("[data-start-add-toggle]");
check("再オープン時は担当=自分・書類回収済みオフにリセット", await page9.evaluate(() => {
const sel = document.querySelector("#startAddAssignee");
const cb = document.querySelector("#startAddDocs");
return Boolean(sel) && sel.value === "自分" && Boolean(cb) && cb.checked === false;
}));
await page9.fill("#startAddText", "自分苑 自分様 入社決定");
await page9.fill("#startAddDate", ymdOf(daysFromNow(5)));
await page9.click("[data-start-add-submit]");
await page9.waitForTimeout(700);
const startPost9b = posts.filter((p) => p.action === "addStart").pop();
check("既定の追加は assignee=自分 / docsCollected=false でPOST", startPost9b && startPost9b.assignee === "自分" && startPost9b.docsCollected === false, JSON.stringify(startPost9b));
const row9c = await page9.evaluate(scanStartRow9, "自分苑");
check("既定の仮表示行は自分のセクションでチップなし",
Boolean(row9c) && row9c.owner === "自分" && !row9c.text.includes("書類回収済み"), JSON.stringify(row9c));
await page9.close();

// 面談実施待ち: 対象はフェーズが①準備・②内定確認の案件だけ（③以降＝実施済み・内定済みは出さない）
const page10 = await ctx.newPage();
await page10.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
return;
}
const st10 = mockState();
st10.startAdds = [];
const todayNine10 = new Date(); todayNine10.setHours(9, 0, 0, 0);
const stagesDecided10 = [
{ phase: "①準備", label: "①準備", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "done", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "open", slackUrl: "https://example.com/s10" }
];
st10.cases.push(
{ eventId: "direct:test0001", facility: "老健たんぽぽ", person: "梅村様", owner: "自分", meetingLabel: mdOf(0) + " 9時", meetingIso: todayNine10.toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: ymdOf(daysFromNow(5)), daysToStart: 5, startResult: "", startResultDate: "", stages: stagesDecided10 },
{ eventId: "evF3", facility: "未来苑", person: "未来様", owner: "和田", meetingLabel: mdOf(3) + " 10時", meetingIso: daysFromNow(3).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "", stages: stagesDecided10 },
{ eventId: "evF4", facility: "申請苑", person: "申請様", owner: "自分", meetingLabel: mdOf(4) + " 10時", meetingIso: daysFromNow(4).toISOString(), currentPhase: "④入力・申請", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "", stages: stagesDecided10 },
{ eventId: "evF5", facility: "フォロー苑", person: "フォロー様", owner: "和田", meetingLabel: mdOf(5) + " 10時", meetingIso: daysFromNow(5).toISOString(), currentPhase: "⑤入職フォロー", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "", stages: stagesDecided10 },
{ eventId: "evN2", facility: "確認苑", person: "確認様", owner: "自分", meetingLabel: mdOf(1) + " 10時", meetingIso: daysFromNow(1).toISOString(), currentPhase: "②内定確認", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "", stages: [ { phase: "①準備", label: "①準備", status: "done", slackUrl: "" }, { phase: "②内定確認", label: "②内定確認", status: "open", slackUrl: "" } ] },
{ eventId: "evN1", facility: "準備苑", person: "準備様", owner: "和田", meetingLabel: mdOf(6) + " 10時", meetingIso: daysFromNow(6).toISOString(), currentPhase: "①準備", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "", stages: [ { phase: "①準備", label: "①準備・3日前", status: "open", slackUrl: "" } ] }
);
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st10) });
});
await page10.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page10.waitForTimeout(300);
check("面談実施待ちは①②のみ: 見出し件数が絞り込み後の3件", await page10.evaluate(() => {
const p = Array.from(document.querySelectorAll(".dash-panel")).find((x) => (x.querySelector("h2") || {}).textContent.includes("面談実施待ち"));
return Boolean(p) && p.querySelector("h2").textContent.includes("3件");
}));
check("面談実施待ちの内訳が絞り込み後と一致（自分1件・和田さん2件）", await page10.evaluate(() => {
const p = Array.from(document.querySelectorAll(".dash-panel")).find((x) => (x.querySelector("h2") || {}).textContent.includes("面談実施待ち"));
return Boolean(p) && p.textContent.includes("自分 1件") && p.textContent.includes("和田さん 2件");
}));
check("面談実施待ちの行は①②の3行（確認苑・清和苑・準備苑／日付順）", await page10.evaluate(() => {
const rows = Array.from(document.querySelectorAll(".meet-row")).map((r) => {
for (const f of ["確認苑", "清和苑", "準備苑"]) if (r.textContent.includes(f)) return f;
return "?";
});
return JSON.stringify(rows) === JSON.stringify(["確認苑", "清和苑", "準備苑"]);
}));
check("③以降の案件は面談実施待ちに出ない（老健たんぽぽ・未来苑・申請苑・フォロー苑）", await page10.evaluate(() => {
const p = Array.from(document.querySelectorAll(".dash-panel")).find((x) => (x.querySelector("h2") || {}).textContent.includes("面談実施待ち"));
return Boolean(p) && !["老健たんぽぽ", "未来苑", "申請苑", "フォロー苑"].some((f) => p.textContent.includes(f));
}));
await page10.click('[data-tab="onboarding"]');
await page10.waitForTimeout(300);
check("除外された直接追加案件も入社待ちには残る（老健たんぽぽ×梅村様）", await page10.locator("#dash").innerText().then((s) => s.includes("老健たんぽぽ") && s.includes("梅村様")));
await page10.close();

// ②内定確認の完了で案件が入社待ちへ即移動する（同期の再構築を待たない・アプリ内の楽観表示）
const page11 = await ctx.newPage();
await page11.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
return;
}
const st11 = mockState();
st11.startAdds = [];
st11.tasks.push({ id: "tour:5555.5", type: "tour", typeLabel: "面談", title: "🟨判定苑 判定様", datetimeLabel: mdOf(0) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/s11", groupKey: "evN", groupTitle: "判定苑 判定様", member: "", shareKind: "", overdue: false, phase: "②内定確認", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" });
st11.cases.push({ eventId: "evN", facility: "判定苑", person: "判定様", owner: "自分", meetingLabel: mdOf(0) + " 10時", meetingIso: daysFromNow(0).toISOString(), currentPhase: "②内定確認", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "open", slackUrl: "https://example.com/s11" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]});
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st11) });
});
await page11.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page11.click('[data-tab="tour"]');
await page11.waitForTimeout(200);
check("内定前: 面談タブに判定苑のグループが出る", await page11.locator('[data-group="evN"]').count() === 1);
await page11.click("[data-done='tour:5555.5']");
await page11.waitForTimeout(700);
check("②完了で complete がPOSTされた（tour:5555.5）", posts.some((p) => p.action === "complete" && p.id === "tour:5555.5"));
check("②完了の瞬間に面談タブから判定苑が消える", await page11.locator('[data-group="evN"]').count() === 0);
await page11.click('[data-tab="onboarding"]');
await page11.waitForTimeout(300);
check("②完了の瞬間に入社待ちへ移動（入社日未登録の行）", await page11.locator("#dash").innerText().then((s) => s.includes("判定苑") && s.includes("入社日を入れてください")));
check("入社待ちで回収進捗が即表示（0/6: ③+④4点+⑤の送信待ち）", await page11.locator("[data-start-collect='evN']").innerText().then((s) => s.includes("回収 0/6")));
await page11.close();

// 同期前の段階チェック: 未送信ステージが「送信待ち」行として出て、先行チェックで tour:pending: 形式のIDがPOSTされる
const page12 = await ctx.newPage();
await page12.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
if (body.action === "complete") pending.add(body.id);
let resp12 = { ok: true };
if (body.action === "cancelAction") {
const hit = pending.delete(body.id) || deletePending.delete(body.id) || reopenPending.delete(body.id) || casePendSet.delete(body.id);
if (!hit) resp12 = { ok: false, error: "no_pending_action" };
}
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp12) });
return;
}
const st12 = mockState();
st12.startAdds = [];
st12.cases.push(
{ eventId: "evD", facility: "先行苑", person: "先行様", owner: "自分", meetingLabel: mdOf(-1) + " 10時", meetingIso: daysFromNow(-1).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "done", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evF", facility: "回収苑", person: "回収様", owner: "自分", meetingLabel: mdOf(-2) + " 10時", meetingIso: daysFromNow(-2).toISOString(), currentPhase: "④入力・申請", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "②内定確認", label: "②内定確認", status: "done", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "done", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請／フォームラン回収", status: "open", slackUrl: "https://example.com/sf4" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]}
);
st12.tasks.push({ id: "tour:6666.6", type: "tour", typeLabel: "面談", title: "🟪回収苑 回収様", datetimeLabel: mdOf(-2) + " 10時", elapsedDays: 2, deadlineLabel: "", slackUrl: "https://example.com/sf4", groupKey: "evF", groupTitle: "回収苑 回収様", member: "", shareKind: "", overdue: false, phase: "④入力・申請", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" });
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st12) });
});
await page12.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page12.click('[data-tab="onboarding"]');
await page12.waitForTimeout(300);
check("未送信だらけの案件も入社待ちで回収 0/6 が出る", await page12.locator("[data-start-collect='evD']").innerText().then((s) => s.includes("回収 0/6")));
await page12.click("[data-collect-toggle='evD']");
await page12.waitForTimeout(200);
check("未送信③・④4点・⑤が送信待ち行として6行出る", await page12.evaluate(() => {
const rows = Array.from(document.querySelectorAll("#dash .collect-box[data-collect-ev='evD'] .collect-row"));
const names = ["書類回収", "duo登録", "セシオ登録", "契約申請", "フォームラン回収", "入職フォロー"];
return rows.length === 6 && names.every((n) => rows.some((r) => r.textContent.includes(n)));
}));
check("送信待ち行は未チェック・操作可能で stageKey 付きのIDを持つ（docs/duo/sesio/contract/formrun/followup）", await page12.evaluate(() => {
const keys = ["docs", "duo", "sesio", "contract", "formrun", "followup"];
return keys.every((k) => {
const inp = document.querySelector("#dash [data-collect-check='tour:pending:evD:" + k + "']");
const row = inp && inp.closest(".collect-row");
return Boolean(inp) && !inp.checked && !inp.disabled && row && row.getAttribute("data-cstate") === "notyet" && row.textContent.includes("送信待ち");
});
}));
await page12.click("#dash [data-collect-check='tour:pending:evD:docs']");
await page12.waitForTimeout(700);
check("先行チェックで complete がPOSTされる（tour:pending:evD:docs）", posts.some((p) => p.action === "complete" && p.id === "tour:pending:evD:docs"));
check("先行チェックした行はチェック済み・「送信され次第完了」表示", await page12.evaluate(() => {
const inp = document.querySelector("#dash [data-collect-check='tour:pending:evD:docs']");
const row = inp && inp.closest(".collect-row");
return Boolean(inp) && inp.checked && !inp.disabled && row && row.getAttribute("data-cstate") === "stagePending" && row.textContent.includes("送信され次第完了");
}));
check("進捗が 1/6 に進む", await page12.locator("[data-start-collect='evD']").innerText().then((s) => s.includes("回収 1/6")));
await page12.click("#dash [data-collect-check='tour:pending:evD:formrun']");
await page12.waitForTimeout(700);
check("④の先行チェックも stageKey 付きでPOSTされる（formrun）", posts.some((p) => p.action === "complete" && p.id === "tour:pending:evD:formrun"));
check("進捗が 2/6 に進む", await page12.locator("[data-start-collect='evD']").innerText().then((s) => s.includes("回収 2/6")));
await page12.click("#dash [data-collect-check='tour:pending:evD:docs']");
await page12.waitForTimeout(700);
check("先行チェックを外すと cancelAction がPOSTされる（docs）", posts.some((p) => p.action === "cancelAction" && p.id === "tour:pending:evD:docs"));
check("外した行は未チェック・送信待ちに戻り進捗は 1/6", await page12.evaluate(() => {
const inp = document.querySelector("#dash [data-collect-check='tour:pending:evD:docs']");
const row = inp && inp.closest(".collect-row");
const chip = document.querySelector("[data-start-collect='evD']");
return Boolean(inp) && !inp.checked && !inp.disabled && row && row.getAttribute("data-cstate") === "notyet" && chip && chip.textContent.includes("回収 1/6");
}));
// フォームラン回収（移行追加された実タスク）は従来どおり実IDで完了できる
await page12.click("[data-collect-toggle='evF']");
await page12.waitForTimeout(200);
check("移行追加のフォームラン回収は実タスクID（tour:6666.6）で出る（pending IDではない）", await page12.locator("#dash [data-collect-check='tour:6666.6']").count() === 1 && await page12.locator("#dash [data-collect-check='tour:pending:evF:formrun']").count() === 0);
await page12.click("#dash [data-collect-check='tour:6666.6']");
await page12.waitForTimeout(700);
check("フォームラン回収の完了が従来どおりPOSTされる（tour:6666.6）", posts.some((p) => p.action === "complete" && p.id === "tour:6666.6"));
check("フォームラン回収の行が反映待ち表示になる", await page12.evaluate(() => {
const inp = document.querySelector("#dash [data-collect-check='tour:6666.6']");
const row = inp && inp.closest(".collect-row");
return Boolean(inp) && inp.checked && row && row.getAttribute("data-cstate") === "pendingOpt" && row.textContent.includes("反映待ち");
}));
await page12.close();

// 本日入社のハイライト: 入社日が今日の入社待ち行だけが .today＋「本日入社」バッジで強く目立つ
const page13 = await ctx.newPage();
await page13.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
return;
}
const st13 = mockState();
st13.startAdds = [];
const stagesT13 = [
{ phase: "①準備", label: "①準備", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "done", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "open", slackUrl: "https://example.com/s13" }
];
st13.cases.push(
{ eventId: "evT0", facility: "本日苑", person: "本日様", owner: "自分", meetingLabel: mdOf(-2) + " 10時", meetingIso: daysFromNow(-2).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: ymdOf(daysFromNow(0)), daysToStart: 0, startResult: "", startResultDate: "", stages: stagesT13 },
{ eventId: "evT2", facility: "明後日苑", person: "明後日様", owner: "自分", meetingLabel: mdOf(-2) + " 10時", meetingIso: daysFromNow(-2).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: ymdOf(daysFromNow(2)), daysToStart: 2, startResult: "", startResultDate: "", stages: stagesT13 },
{ eventId: "evTm1", facility: "過去苑", person: "過去様", owner: "自分", meetingLabel: mdOf(-4) + " 10時", meetingIso: daysFromNow(-4).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: ymdOf(daysFromNow(-1)), daysToStart: -1, startResult: "", startResultDate: "", stages: stagesT13 }
);
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st13) });
});
await page13.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page13.click('[data-tab="onboarding"]');
await page13.waitForTimeout(300);
check("本日入社の行に today クラスが付く（本日苑）", await page13.evaluate(() => {
const row = Array.from(document.querySelectorAll("#dash .start-row")).find((r) => r.textContent.includes("本日苑"));
return Boolean(row) && row.classList.contains("today");
}));
check("本日入社のバッジは「本日入社」＋ days-badge.today", await page13.evaluate(() => {
const row = Array.from(document.querySelectorAll("#dash .start-row")).find((r) => r.textContent.includes("本日苑"));
const b = row && row.querySelector(".days-badge.today");
return Boolean(b) && b.textContent === "本日入社";
}));
check("本日入社バッジは塗りつぶし（背景 #c2410c・白文字）", await page13.evaluate(() => {
const row = Array.from(document.querySelectorAll("#dash .start-row")).find((r) => r.textContent.includes("本日苑"));
const b = row && row.querySelector(".days-badge.today");
if (!b) return false;
const cs = getComputedStyle(b);
return cs.backgroundColor === "rgb(194, 65, 12)" && cs.color === "rgb(255, 255, 255)";
}));
check("本日入社の行全体に薄い背景色（#fff7ed）", await page13.evaluate(() => {
const row = Array.from(document.querySelectorAll("#dash .start-row")).find((r) => r.textContent.includes("本日苑"));
return Boolean(row) && getComputedStyle(row).backgroundColor === "rgb(255, 247, 237)";
}));
check("あと2日の行は today でなく soon＋バッジ「あと2日」（明後日苑）", await page13.evaluate(() => {
const row = Array.from(document.querySelectorAll("#dash .start-row")).find((r) => r.textContent.includes("明後日苑"));
const b = row && row.querySelector(".days-badge");
return Boolean(row) && !row.classList.contains("today") && row.classList.contains("soon") && Boolean(b) && b.textContent === "あと2日" && !b.classList.contains("today");
}));
check("過去日（結果未登録）の行は today でなく past＋バッジ「1日経過」（過去苑）", await page13.evaluate(() => {
const row = Array.from(document.querySelectorAll("#dash .start-row")).find((r) => r.textContent.includes("過去苑"));
const b = row && row.querySelector(".days-badge");
return Boolean(row) && !row.classList.contains("today") && row.classList.contains("past") && Boolean(b) && b.textContent === "1日経過" && !b.classList.contains("today");
}));
await page13.close();

// 「内定にする」: ②内定確認が未送信の案件だけ、同期を待たずにボードから内定を先行確定できる
const page14 = await ctx.newPage();
const offerPend = new Set();
await page14.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
if (body.action === "complete") { pending.add(body.id); if (/:offer$/.test(body.id || "")) offerPend.add(body.id); }
let resp14 = { ok: true };
if (body.action === "cancelAction") {
const hit = offerPend.delete(body.id) || pending.delete(body.id) || deletePending.delete(body.id) || reopenPending.delete(body.id) || casePendSet.delete(body.id);
if (!hit) resp14 = { ok: false, error: "no_pending_action" };
}
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp14) });
return;
}
const st14 = mockState();
st14.startAdds = [];
st14.tasks.push(
{ id: "tour:7777.7", type: "tour", typeLabel: "面談", title: "🟦" + mdOf(2) + " 内定苑 内定様", datetimeLabel: mdOf(2) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sO1", groupKey: "evO", groupTitle: "内定苑 内定様", member: "", shareKind: "", overdue: false, phase: "①準備", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" },
{ id: "tour:8888.8", type: "tour", typeLabel: "面談", title: "🟨確認苑 確認様", datetimeLabel: mdOf(1) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sP2", groupKey: "evP", groupTitle: "確認苑 確認様", member: "", shareKind: "", overdue: false, phase: "②内定確認", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" }
);
st14.cases.push(
{ eventId: "evO", facility: "内定苑", person: "内定様", owner: "自分", meetingLabel: mdOf(2) + " 10時", meetingIso: daysFromNow(2).toISOString(), currentPhase: "①準備", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備・前日", status: "open", slackUrl: "https://example.com/sO1" },
{ phase: "②内定確認", label: "②内定確認", status: "notyet", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evP", facility: "確認苑", person: "確認様", owner: "自分", meetingLabel: mdOf(1) + " 10時", meetingIso: daysFromNow(1).toISOString(), currentPhase: "②内定確認", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "open", slackUrl: "https://example.com/sP2" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evR", facility: "待機苑", person: "待機様", owner: "和田", meetingLabel: mdOf(0) + " 13時", meetingIso: daysFromNow(0).toISOString(), currentPhase: "②内定確認", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備・3日前", status: "done", slackUrl: "" },
{ phase: "①準備", label: "①準備・前日", status: "done", slackUrl: "" },
{ phase: "①準備", label: "①準備・当日", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "notyet", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]}
);
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st14) });
});
await page14.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page14.click('[data-tab="tour"]');
await page14.waitForTimeout(200);
check("内定前: 面談タブに内定苑のグループが出る", await page14.locator('[data-group="evO"]').count() === 1);
check("グループヘッダー直下に「内定にする」ボタンが出る", await page14.locator('#list .group-acts [data-offer="evO"]').count() === 1);
await page14.click('[data-group="evO"]');
await page14.waitForTimeout(200);
check("案件詳細にも「内定にする」ボタンが出る", await page14.locator('#case-evO [data-offer="evO"]').count() === 1);
await page14.click('[data-tab="all"]');
await page14.waitForTimeout(200);
check("面談実施待ちの行にも「内定にする」が出る（失注/終了と並ぶ）", await page14.locator('#dash .meet-row [data-offer="evO"]').count() === 1);
await page14.click('[data-tab="tour"]');
await page14.waitForTimeout(200);
check("②タスクが実在する案件には「内定にする」が出ない（確認苑）", await page14.locator('[data-offer="evP"]').count() === 0);
check("②の段階自体が無い案件にも出ない（清和苑）", await page14.locator('[data-offer="ev2"]').count() === 0);
await page14.click('#list .group-acts [data-offer="evO"]');
await page14.waitForTimeout(700);
check("「内定にする」で complete がPOSTされる（tour:pending:evO:offer）", posts.some((p) => p.action === "complete" && p.id === "tour:pending:evO:offer"));
check("押した瞬間に面談タブから内定苑が消える", await page14.locator('[data-group="evO"]').count() === 0);
await page14.click('[data-tab="onboarding"]');
await page14.waitForTimeout(300);
check("押した瞬間に入社待ちへ移動（入社日未登録の行）", await page14.locator("#dash").innerText().then((s) => s.includes("内定苑") && s.includes("入社日を入れてください")));
check("入社待ちで回収進捗が即表示（0/6: 先行チェック行が使える）", await page14.locator("[data-start-collect='evO']").innerText().then((s) => s.includes("回収 0/6")));
check("入社待ちの行に「内定 反映待ち」と取り消しが出る", await page14.locator("#dash").innerText().then((s) => s.includes("内定 反映待ち")) && await page14.locator('#dash [data-cancel-offer="evO"]').count() === 1);
await page14.click('#dash [data-cancel-offer="evO"]');
await page14.waitForTimeout(700);
check("取り消しで cancelAction がPOSTされる（tour:pending:evO:offer）", posts.some((p) => p.action === "cancelAction" && p.id === "tour:pending:evO:offer"));
await page14.click('[data-tab="tour"]');
await page14.waitForTimeout(300);
check("取り消すと面談タブに内定苑が戻り、ボタンも戻る", await page14.locator('[data-group="evO"]').count() === 1 && await page14.locator('#list .group-acts [data-offer="evO"]').count() === 1);
// フェーズ②＋②未送信（①が全て完了し、②タスクの送信を待っている状態）の案件にも「内定にする」が出る
await page14.click('[data-tab="all"]');
await page14.waitForTimeout(200);
check("フェーズ②で②未送信の案件にも「内定にする」が出る（待機苑・面談実施待ち）", await page14.locator('#dash .meet-row [data-offer="evR"]').count() === 1);
await page14.click('#dash .meet-row [data-offer="evR"]');
await page14.waitForTimeout(700);
check("待機苑の「内定にする」で complete がPOSTされる（tour:pending:evR:offer）", posts.some((p) => p.action === "complete" && p.id === "tour:pending:evR:offer"));
await page14.click('[data-tab="onboarding"]');
await page14.waitForTimeout(300);
check("フェーズ②からでも押した瞬間に入社待ちへ移動（待機苑・入社日未登録の行）", await page14.locator("#dash").innerText().then((s) => s.includes("待機苑") && s.includes("入社日を入れてください")));
check("待機苑の入社待ちで回収進捗が即表示（0/6: 先行チェック行が使える）", await page14.locator("[data-start-collect='evR']").innerText().then((s) => s.includes("回収 0/6")));
check("待機苑の入社待ちの行に「内定 反映待ち」と取り消しが出る", await page14.locator("#dash").innerText().then((s) => s.includes("内定 反映待ち")) && await page14.locator('#dash [data-cancel-offer="evR"]').count() === 1);
await page14.close();

// 「内定にする」の失敗時: API が ok:false（v9未デプロイの bad_pending_id 等）を返したら巻き戻して理由を表示する
const page15 = await ctx.newPage();
await page15.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
let resp15 = { ok: true };
if (body.action === "complete" && body.id === "tour:pending:evQ:offer") resp15 = { ok: false, error: "bad_pending_id" };
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp15) });
return;
}
const st15 = mockState();
st15.startAdds = [];
st15.tasks.push({ id: "tour:9999.1", type: "tour", typeLabel: "面談", title: "🟦" + mdOf(3) + " 失敗苑 失敗様", datetimeLabel: mdOf(3) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sQ1", groupKey: "evQ", groupTitle: "失敗苑 失敗様", member: "", shareKind: "", overdue: false, phase: "①準備", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" });
st15.cases.push({ eventId: "evQ", facility: "失敗苑", person: "失敗様", owner: "自分", meetingLabel: mdOf(3) + " 10時", meetingIso: daysFromNow(3).toISOString(), currentPhase: "①準備", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備・前日", status: "open", slackUrl: "https://example.com/sQ1" },
{ phase: "②内定確認", label: "②内定確認", status: "notyet", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]});
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st15) });
});
await page15.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page15.click('[data-tab="tour"]');
await page15.waitForTimeout(200);
check("失敗テスト前: 失敗苑のグループと「内定にする」が出る", await page15.locator('[data-group="evQ"]').count() === 1 && await page15.locator('#list .group-acts [data-offer="evQ"]').count() === 1);
await page15.click('#list .group-acts [data-offer="evQ"]');
await page15.waitForTimeout(900);
check("API が ok:false を返したら理由が表示される（未有効化の案内）", await page15.locator("#errBar").innerText().then((s) => s.includes("まだ有効化されていません")));
check("失敗時は巻き戻って面談タブに失敗苑が残り、ボタンも戻る", await page15.locator('[data-group="evQ"]').count() === 1 && await page15.locator('#list .group-acts [data-offer="evQ"]').count() === 1);
await page15.click('[data-tab="onboarding"]');
await page15.waitForTimeout(300);
check("失敗時は入社待ちに失敗苑が出ない", await page15.locator("#dash").innerText().then((s) => !s.includes("失敗苑")));
await page15.close();

// 「内定まで一括で進める」: ①②の実在タスクを段階順にまとめて完了し、そのまま内定まで進める
const page16 = await ctx.newPage();
const bulkPend = new Set();
await page16.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
if (body.action === "complete") bulkPend.add(body.id);
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
return;
}
const st16 = mockState();
st16.startAdds = [];
st16.tasks.push(
{ id: "tour:1111.1", type: "tour", typeLabel: "面談", title: "🟦" + mdOf(2) + " 一括苑 一括様", datetimeLabel: mdOf(2) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sB1", groupKey: "evB1", groupTitle: "一括苑 一括様", member: "", shareKind: "", overdue: false, phase: "①準備", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" },
{ id: "tour:2222.2", type: "tour", typeLabel: "面談", title: "🟦" + mdOf(2) + " 一括苑 一括様", datetimeLabel: mdOf(2) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sB2", groupKey: "evB1", groupTitle: "一括苑 一括様", member: "", shareKind: "", overdue: false, phase: "①準備", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" },
{ id: "tour:3333.3", type: "tour", typeLabel: "面談", title: "🟨実在苑 実在様", datetimeLabel: mdOf(1) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sB3", groupKey: "evB2", groupTitle: "実在苑 実在様", member: "", shareKind: "", overdue: false, phase: "②内定確認", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" },
{ id: "tour:4444.9", type: "tour", typeLabel: "面談", title: "🟨保留苑 保留様", datetimeLabel: mdOf(1) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sB4", groupKey: "evB4", groupTitle: "保留苑 保留様", member: "", shareKind: "", overdue: false, phase: "②内定確認", owner: "自分", dueToday: false, eventIso: "", pending: true, metaDue: "", memo: "" },
{ id: "tour:5555.9", type: "tour", typeLabel: "面談", title: "🟧確定苑 確定様", datetimeLabel: mdOf(-2) + " 10時", elapsedDays: 3, deadlineLabel: "", slackUrl: "https://example.com/sB5", groupKey: "evB3", groupTitle: "確定苑 確定様", member: "", shareKind: "", overdue: false, phase: "③書類回収", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" }
);
st16.tasks.forEach((x) => { if (bulkPend.has(x.id)) x.pending = true; });
st16.cases.push(
{ eventId: "evB1", facility: "一括苑", person: "一括様", owner: "自分", meetingLabel: mdOf(2) + " 10時", meetingIso: daysFromNow(2).toISOString(), currentPhase: "①準備", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備・前日", status: "open", slackUrl: "https://example.com/sB1" },
{ phase: "①準備", label: "①準備・当日", status: "open", slackUrl: "https://example.com/sB2" },
{ phase: "②内定確認", label: "②内定確認", status: "notyet", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evB2", facility: "実在苑", person: "実在様", owner: "自分", meetingLabel: mdOf(1) + " 10時", meetingIso: daysFromNow(1).toISOString(), currentPhase: "②内定確認", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "open", slackUrl: "https://example.com/sB3" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evB4", facility: "保留苑", person: "保留様", owner: "自分", meetingLabel: mdOf(1) + " 10時", meetingIso: daysFromNow(1).toISOString(), currentPhase: "②内定確認", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "open", slackUrl: "https://example.com/sB4" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evB3", facility: "確定苑", person: "確定様", owner: "自分", meetingLabel: mdOf(-2) + " 10時", meetingIso: daysFromNow(-2).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "done", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "open", slackUrl: "https://example.com/sB5" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]}
);
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st16) });
});
await page16.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page16.click('[data-tab="tour"]');
await page16.waitForTimeout(200);
check("一括前: 面談タブに一括苑のグループが出る", await page16.locator('[data-group="evB1"]').count() === 1);
check("グループヘッダーに「内定まで一括で進める」と「内定にする」が併置される（一括苑）", await page16.locator('#list .group-acts [data-bulk="evB1"]').count() === 1 && await page16.locator('#list .group-acts [data-offer="evB1"]').count() === 1);
check("②タスクが実在する案件には一括ボタンだけ出る（実在苑）", await page16.locator('#list .group-acts [data-bulk="evB2"]').count() === 1 && await page16.locator('[data-offer="evB2"]').count() === 0);
check("②タスクが反映待ちの案件には一括も内定にするも出ない（保留苑）", await page16.locator('[data-bulk="evB4"]').count() === 0 && await page16.locator('[data-offer="evB4"]').count() === 0);
check("①タスクしか無い案件には一括ボタンが出ない（清和苑）", await page16.locator('[data-bulk="ev2"]').count() === 0);
await page16.click('[data-group="evB1"]');
await page16.waitForTimeout(200);
check("案件詳細にも「内定まで一括で進める」が出る（一括苑）", await page16.locator('#case-evB1 [data-bulk="evB1"]').count() === 1);
const before16 = posts.length;
await page16.evaluate(() => { const b = document.querySelector('#list .group-acts [data-bulk="evB1"]'); if (b) { b.click(); b.click(); } });
await page16.waitForTimeout(2200);
const ids16 = posts.slice(before16).filter((p) => p.action === "complete").map((p) => p.id);
check("一括で①タスクが段階順にPOSTされ、最後にofferがPOSTされる", JSON.stringify(ids16) === JSON.stringify(["tour:1111.1", "tour:2222.2", "tour:pending:evB1:offer"]), ids16.join(","));
check("二重タップでも一括のPOSTは1回分だけ（offerは1回）", ids16.filter((x) => x === "tour:pending:evB1:offer").length === 1 && ids16.length === 3);
check("一括完了で面談タブから一括苑が消える", await page16.locator('[data-group="evB1"]').count() === 0);
await page16.click('[data-tab="onboarding"]');
await page16.waitForTimeout(300);
check("一括完了で入社待ちへ即移動（一括苑・入社日未登録の行）", await page16.locator("#dash").innerText().then((s) => s.includes("一括苑") && s.includes("入社日を入れてください")));
check("一括苑の入社待ちで回収進捗が即表示（0/6）", await page16.locator("[data-start-collect='evB1']").innerText().then((s) => s.includes("回収 0/6")));
await page16.click('[data-tab="tour"]');
await page16.waitForTimeout(200);
const before16b = posts.length;
await page16.click('#list .group-acts [data-bulk="evB2"]');
await page16.waitForTimeout(1200);
const ids16b = posts.slice(before16b).filter((p) => p.action === "complete").map((p) => p.id);
check("②タスクが実在する案件の一括は、そのタスクの完了だけがPOSTされる", JSON.stringify(ids16b) === JSON.stringify(["tour:3333.3"]), ids16b.join(","));
check("②タスクが実在する案件ではofferはPOSTされない", !posts.some((p) => p.action === "complete" && p.id === "tour:pending:evB2:offer"));
check("実在苑も一括完了で面談タブから消える", await page16.locator('[data-group="evB2"]').count() === 0);
await page16.click('[data-tab="onboarding"]');
await page16.waitForTimeout(300);
check("実在苑も入社待ちへ即移動（入社日未登録の行）", await page16.locator("#dash").innerText().then((s) => s.includes("実在苑") && s.includes("入社日を入れてください")));
await page16.click('#dash [data-gocase="evB3"]');
await page16.waitForTimeout(300);
check("内定確定済みの案件の詳細には一括も内定にするも出ない（確定苑）", await page16.locator('#case-evB3').count() === 1 && await page16.locator('#case-evB3 [data-bulk]').count() === 0 && await page16.locator('#case-evB3 [data-offer]').count() === 0);
await page16.close();

// 「内定まで一括で進める」の途中失敗: 失敗した時点で中断し、完了済みは残し、内定までは進めない
const page17 = await ctx.newPage();
const failPend = new Set();
await page17.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
let resp17 = { ok: true };
if (body.action === "complete" && body.id === "tour:5555.5") resp17 = { ok: false, error: "error" };
else if (body.action === "complete") failPend.add(body.id);
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp17) });
return;
}
const st17 = mockState();
st17.startAdds = [];
st17.tasks.push(
{ id: "tour:4444.4", type: "tour", typeLabel: "面談", title: "🟦" + mdOf(2) + " 途中苑 途中様", datetimeLabel: mdOf(2) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sF1", groupKey: "evF1", groupTitle: "途中苑 途中様", member: "", shareKind: "", overdue: false, phase: "①準備", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" },
{ id: "tour:5555.5", type: "tour", typeLabel: "面談", title: "🟦" + mdOf(2) + " 途中苑 途中様", datetimeLabel: mdOf(2) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sF2", groupKey: "evF1", groupTitle: "途中苑 途中様", member: "", shareKind: "", overdue: false, phase: "①準備", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" }
);
st17.tasks.forEach((x) => { if (failPend.has(x.id)) x.pending = true; });
st17.cases.push(
{ eventId: "evF1", facility: "途中苑", person: "途中様", owner: "自分", meetingLabel: mdOf(2) + " 10時", meetingIso: daysFromNow(2).toISOString(), currentPhase: "①準備", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備・前日", status: "open", slackUrl: "https://example.com/sF1" },
{ phase: "①準備", label: "①準備・当日", status: "open", slackUrl: "https://example.com/sF2" },
{ phase: "②内定確認", label: "②内定確認", status: "notyet", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]}
);
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st17) });
});
await page17.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page17.click('[data-tab="tour"]');
await page17.waitForTimeout(200);
check("途中失敗テスト前: 途中苑のグループと一括ボタンが出る", await page17.locator('[data-group="evF1"]').count() === 1 && await page17.locator('#list .group-acts [data-bulk="evF1"]').count() === 1);
const before17 = posts.length;
await page17.click('#list .group-acts [data-bulk="evF1"]');
await page17.waitForTimeout(1800);
const ids17 = posts.slice(before17).filter((p) => p.action === "complete").map((p) => p.id);
check("途中失敗: 2件目のPOSTで止まり、offerはPOSTされない", JSON.stringify(ids17) === JSON.stringify(["tour:4444.4", "tour:5555.5"]), ids17.join(","));
check("途中失敗: 中断の理由が表示される（完了済み1件の経過つき）", await page17.locator("#errBar").innerText().then((s) => s.includes("一括処理を中断しました") && s.includes("1件")));
check("途中失敗: 失敗したタスクのカードは一覧に戻る", await page17.locator('[data-card-id="tour:5555.5"]').count() === 1);
check("途中失敗: 完了済みのタスクのカードは消えたまま", await page17.locator('[data-card-id="tour:4444.4"]').count() === 0);
await page17.click('[data-tab="onboarding"]');
await page17.waitForTimeout(300);
check("途中失敗: 内定までは進まず入社待ちに出ない（途中苑）", await page17.locator("#dash").innerText().then((s) => !s.includes("途中苑")));
await page17.close();

// 面談タブの案件母体表示: 未完了タスク0件の①②案件（②送信待ち・当日未送信・将来で全段階未送信）も必ず出る
const page18 = await ctx.newPage();
await page18.route("https://script.google.com/**", async (route) => {
const req = route.request();
if (req.method() === "POST") {
const body = JSON.parse(req.postData() || "{}");
posts.push(body);
await new Promise((r) => setTimeout(r, 250));
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
return;
}
const st18 = mockState();
st18.startAdds = [];
st18.tasks.push(
{ id: "tour:1818.1", type: "tour", typeLabel: "面談", title: "🟦" + mdOf(2) + " 作業苑 作業様", datetimeLabel: mdOf(2) + " 10時", elapsedDays: 1, deadlineLabel: "", slackUrl: "https://example.com/sw4", groupKey: "evW4", groupTitle: "作業苑 作業様", member: "", shareKind: "", overdue: false, phase: "①準備", owner: "自分", dueToday: false, eventIso: "", pending: false, metaDue: "", memo: "" }
);
st18.cases.push(
{ eventId: "evW1", facility: "若葉苑", person: "若葉様", owner: "自分", meetingLabel: mdOf(5) + " 10時", meetingIso: daysFromNow(5).toISOString(), currentPhase: "①準備", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備・3日前", status: "notyet", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "notyet", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evW2", facility: "本日苑", person: "本日様", owner: "和田", meetingLabel: mdOf(0) + " 13時", meetingIso: daysFromNow(0).toISOString(), currentPhase: "②内定確認", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備（3日前・前日・当日）", status: "done", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "notyet", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evW3", facility: "明日苑", person: "明日様", owner: "自分", meetingLabel: mdOf(1) + " 10時", meetingIso: daysFromNow(1).toISOString(), currentPhase: "①準備", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備・3日前", status: "done", slackUrl: "" },
{ phase: "①準備", label: "①準備・前日", status: "done", slackUrl: "" },
{ phase: "①準備", label: "①準備・当日", status: "notyet", slackUrl: "" },
{ phase: "②内定確認", label: "②内定確認", status: "notyet", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evW4", facility: "作業苑", person: "作業様", owner: "自分", meetingLabel: mdOf(2) + " 10時", meetingIso: daysFromNow(2).toISOString(), currentPhase: "①準備", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "①準備", label: "①準備・3日前", status: "open", slackUrl: "https://example.com/sw4" },
{ phase: "②内定確認", label: "②内定確認", status: "notyet", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "notyet", slackUrl: "" },
{ phase: "④入力・申請", label: "④入力・申請", status: "notyet", slackUrl: "" },
{ phase: "⑤入職フォロー", label: "⑤入職フォロー", status: "notyet", slackUrl: "" }
]},
{ eventId: "evW5", facility: "書類苑", person: "書類様", owner: "自分", meetingLabel: mdOf(-1) + " 10時", meetingIso: daysFromNow(-1).toISOString(), currentPhase: "③書類回収", status: "進行中", pending: false, startDate: "", daysToStart: null, startResult: "", startResultDate: "",
stages: [
{ phase: "②内定確認", label: "②内定確認", status: "done", slackUrl: "" },
{ phase: "③書類回収", label: "③書類回収", status: "open", slackUrl: "" }
]}
);
await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(st18) });
});
await page18.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
await page18.click('[data-tab="tour"]');
await page18.waitForTimeout(200);
check("面談タブのバッジは面談待ち（①②）の案件数（5件）", await page18.locator('.tab[data-tab="tour"] .bdg').innerText().then((s) => s.trim() === "5"));
check("面談タブに案件グループが5件出る（バッジと表示件数が一致）", await page18.locator("#list .group-head[data-case-group]").count() === 5);
check("面談タブが空表示にならない", await page18.locator("#list .empty").count() === 0);
check("タスク0件の②待ち案件（本日苑）が出る", await page18.locator('[data-group="evW2"]').count() === 1);
check("本日苑の状態行に「②内定確認は未送信です」", await page18.locator('[data-idle-for="evW2"]').innerText().then((s) => s.includes("未対応のタスクはありません") && s.includes("②内定確認は未送信です")));
check("本日苑の見出しにフェーズバッジと面談日時", await page18.locator('[data-group="evW2"]').innerText().then((s) => s.includes("②内定確認") && s.includes(mdOf(0))));
check("本日苑に「内定にする」ボタンが出る", await page18.locator('#list .group-acts [data-offer="evW2"]').count() === 1);
check("タスク0件の①案件（明日苑）が出て、状態行は当日未送信", await page18.locator('[data-group="evW3"]').count() === 1 && await page18.locator('[data-idle-for="evW3"]').innerText().then((s) => s.includes("①準備・当日は未送信です")));
check("将来日付で全段階未送信の案件（若葉苑）も出る", await page18.locator('[data-group="evW1"]').count() === 1 && await page18.locator('[data-idle-for="evW1"]').innerText().then((s) => s.includes("未送信です")));
check("並びは面談日時の昇順（本日苑→明日苑→若葉苑、若葉苑が最後）", await page18.evaluate(() => {
const names = Array.from(document.querySelectorAll("#list .group-head[data-case-group]")).map((h) => h.textContent);
const i2 = names.findIndex((t) => t.includes("本日苑"));
const i3 = names.findIndex((t) => t.includes("明日苑"));
const i1 = names.findIndex((t) => t.includes("若葉苑"));
return i2 >= 0 && i3 > i2 && i1 > i3 && i1 === names.length - 1;
}));
check("タスク有りの案件（作業苑）は従来どおりカードと件数が出る", await page18.locator('[data-card-id="tour:1818.1"]').count() === 1 && await page18.locator('[data-group="evW4"]').innerText().then((s) => s.includes("1件")));
check("タスク有りの案件では状態行は隠れている", await page18.evaluate(() => { const el = document.querySelector('[data-idle-for="evW4"]'); return Boolean(el) && el.hidden; }));
check("③以降の案件（書類苑）はタスク0件でも面談タブに出ない", await page18.locator('[data-group="evW5"]').count() === 0 && await page18.locator("#list").innerText().then((s) => !s.includes("書類苑")));
await page18.close();

check("コンソールエラー0", errors.length === 0, errors.join(" | ").slice(0, 300));

await page.screenshot({ path: path.resolve(__dirname, "shot-board-all.png")});
await browser.close();
server.close();
const failed = results.filter((r) =>!r.ok);
console.log("----");
console.log("TOTAL " + results.length + " / PASS " + (results.length - failed.length) + " / FAIL " + failed.length);
process.exit(failed.length? 1: 0);
}

main().catch((e) => { console.error(e); process.exit(2);});
