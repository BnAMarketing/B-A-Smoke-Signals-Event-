/* Regression test for the 2026-10-30 RSVP failure: runs the REAL apps-script/Code.js against fake
   Google services (Sheet, LockService, MailApp) and checks RSVPs never wait on the sheet lock,
   sends lock per guest, and mid-send deletes can't mis-stamp rows.
   Run:   node tests/lock_test.js            (optional arg: path to another Code.js)
   Pass:  prints "35/35 passed" and exits 0.  The pre-fix code crashes with "Lock timeout".
   Blind spots: fakes model single-threaded lock contention only; no real quotas, no real Sheets latency,
   no HTML/client code. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const code = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "apps-script", "Code.js"), "utf8");

function mkSheet(name, rows) {
  const sh = {
    name, rows,
    getLastRow() { return this.rows.length; },
    getMaxColumns() { return 20; },
    getRange(r, c, n, w) { n = n || 1; w = w || 1; const self = this;
      const rg = new Proxy({
        getValues() { const out = []; for (let i = 0; i < n; i++) { const row = self.rows[r - 1 + i] || []; const o = []; for (let j = 0; j < w; j++) o.push(row[c - 1 + j] === undefined ? "" : row[c - 1 + j]); out.push(o); } return out; },
        getValue() { return this.getValues()[0][0]; },
        setValue(v) { for (let i = 0; i < n; i++) { self.rows[r - 1 + i] = self.rows[r - 1 + i] || []; for (let j = 0; j < w; j++) self.rows[r - 1 + i][c - 1 + j] = v; } return rg; },
        setValues(vs) { vs.forEach((row, i) => { self.rows[r - 1 + i] = self.rows[r - 1 + i] || []; row.forEach((v, j) => self.rows[r - 1 + i][c - 1 + j] = v); }); return rg; }
      }, { get(t, k) { return k in t ? t[k] : () => rg; } });
      return rg; },
    getDataRange() { return this.getRange(1, 1, this.rows.length, 12); },
    appendRow(v) { this.rows.push(v.slice()); },
    deleteRow(i) { this.rows.splice(i - 1, 1); },
    deleteColumn(c) { this.rows.forEach(r => r.splice(c - 1, 1)); }
  };
  return new Proxy(sh, { get(t, k) { return k in t ? t[k] : () => sh; } });
}

let assertions = 0, failures = 0;
function check(label, ok) { assertions++; if (!ok) failures++; console.log((ok ? "PASS " : "FAIL ") + label); }

function setup() {
  const ctx = {};
  ctx.console = console; ctx.Date = Date; ctx.JSON = JSON; ctx.Math = Math; ctx.String = String; ctx.Number = Number; ctx.Object = Object;
  const sheets = {};
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n, [])), getId: () => "x", toast() {} };
  ctx.SpreadsheetApp = { getActiveSpreadsheet: () => ss, getUi() { throw new Error("no ui"); } };
  ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "pw" }) };
  ctx.CacheService = { getScriptCache: () => ({ get: () => null, put() {} }) };
  ctx.Utilities = { sleep() {}, DigestAlgorithm: { SHA_256: "sha256" },
    computeDigest: (alg, txt) => [...require("crypto").createHash(alg).update(txt).digest()],
    base64EncodeWebSafe: b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_") };
  ctx.ContentService = { createTextOutput: t => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: "json" } };
  ctx.HtmlService = {};
  ctx.Session = { getEffectiveUser: () => ({ getEmail: () => "o@x" }), getActiveUser: () => ({ getEmail: () => "o@x" }) };
  ctx.ScriptApp = { getProjectTriggers: () => [] };
  ctx.locks = { script: false, doc: false };
  const mkLock = k => ({ tryLock() { if (ctx.locks[k]) return false; ctx.locks[k] = true; return true; }, waitLock() { if (!this.tryLock()) throw new Error("Lock timeout"); }, releaseLock() { ctx.locks[k] = false; } });
  ctx.LockService = { getScriptLock: () => mkLock("script"), getDocumentLock: () => mkLock("doc"), getUserLock: () => mkLock("doc") };
  ctx.sent = []; ctx.onSend = null;
  ctx.MailApp = { getRemainingDailyQuota: () => 100, sendEmail(o) { ctx.sent.push(o.to); if (ctx.onSend) ctx.onSend(o.to); } };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  vm.runInContext("ensureTabs_()", ctx);
  vm.runInContext('saveSettings_({"Invite link":"https://example.com/invite/"})', ctx);
  return { ctx, sheets };
}

// --- 1. An RSVP arrives while the back office is holding the sheet lock (the reported bug)
{
  const { ctx, sheets } = setup();
  ctx.locks.script = true;  // e.g. a bulk send / snapshot is mid-flight
  const before = sheets["RSVPs"].getLastRow();
  const out = ctx.doPost({ parameter: { first: "Ann", last: "Lee", email: "ann@x.com", role: "PM", company: "A", attending: "Yes" }, postData: { contents: "first=Ann" } });
  check("RSVP is accepted while the sheet lock is busy", out.text === "ok");
  check("RSVP row was saved while the lock was busy", sheets["RSVPs"].getLastRow() === before + 1 && sheets["RSVPs"].rows.at(-1)[3] === "ann@x.com");
  check("RSVP did not steal or release someone else's lock", ctx.locks.script === true);
  const miss = ctx.doPost({ parameter: { first: "x" }, postData: { contents: "first=x" } });
  check("RSVP without an email is still rejected and not saved", miss.text === "missing" && sheets["RSVPs"].getLastRow() === before + 1);
}

// --- 2. A guest is deleted in the middle of a bulk send: stamps must land on the right people
{
  const { ctx, sheets } = setup();
  vm.runInContext('addGuests_([{first:"A",last:"One",email:"a@x.com",company:""},{first:"B",last:"Two",email:"b@x.com",company:""},{first:"C",last:"Three",email:"c@x.com",company:""}])', ctx);
  ctx.onSend = to => { if (to === "a@x.com") vm.runInContext('deleteGuests_(["a@x.com"])', ctx); };  // deleted right after its email went out
  const res = vm.runInContext("sendRows_(r => r[C.email - 1] && !r[C.sent - 1], false, null)", ctx);
  const G = sheets["Guests"].rows, col = name => vm.runInContext("C." + name, ctx) - 1;
  const row = e => G.find(r => r[col("email")] === e);
  check("all three emails went out", res.sent === 3 && ctx.sent.join() === "a@x.com,b@x.com,c@x.com");
  check("deleted guest is gone", !row("a@x.com"));
  check("B is stamped as sent (row moved up after the delete)", row("b@x.com") && row("b@x.com")[col("sent")] instanceof Date);
  check("C is stamped as sent", row("c@x.com") && row("c@x.com")[col("sent")] instanceof Date);
  check("send released its locks", !ctx.locks.script && !ctx.locks.doc);
}

// --- 3. Sends don't hold the sheet lock while emailing; RSVPs during a send still save
{
  const { ctx, sheets } = setup();
  vm.runInContext('addGuests_([{first:"A",last:"One",email:"a@x.com",company:""},{first:"B",last:"Two",email:"b@x.com",company:""}])', ctx);
  let lockHeldDuringEmail = null, rsvpDuringSend = null;
  ctx.onSend = to => { if (to === "a@x.com") { lockHeldDuringEmail = ctx.locks.script; rsvpDuringSend = ctx.doPost({ parameter: { first: "Z", email: "z@x.com", attending: "Yes" }, postData: { contents: "" } }).text; } };
  vm.runInContext("sendRows_(r => r[C.email - 1] && !r[C.sent - 1], false, null)", ctx);
  check("sheet lock is free while an email is being sent", lockHeldDuringEmail === false);
  check("an RSVP arriving mid-send is saved", rsvpDuringSend === "ok" && sheets["RSVPs"].rows.some(r => r[3] === "z@x.com"));
}

// --- 4. Two sends can't run at once
{
  const { ctx } = setup();
  vm.runInContext('addGuests_([{first:"A",last:"One",email:"a@x.com",company:""}])', ctx);
  ctx.locks.doc = true;  // another send in progress
  let msg = "";
  try { vm.runInContext("sendRows_(r => true, false, null)", ctx); } catch (e) { msg = e.message; }
  check("second simultaneous send is refused with a clear message", /already running/.test(msg) && ctx.sent.length === 0);
}

// --- 5. Back office API still works end to end, and reports busy instead of crashing
{
  const { ctx } = setup();
  const snap = ctx.adminApi("pw", "snapshot", {});
  check("adminApi snapshot returns data", snap.ok === true && Array.isArray(snap.data.guests));
  const add = ctx.adminApi("pw", "addGuests", { guests: [{ first: "Q", last: "R", email: "q@x.com", company: "" }] });
  check("adminApi addGuests works and returns fresh data", add.ok === true && add.data.guests.some(g => g.email === "q@x.com"));
  ctx.locks.script = true;
  const busy = ctx.adminApi("pw", "snapshot", {});
  check("adminApi returns a 'busy' error instead of throwing when locked", busy.ok === false && /busy/.test(busy.error));
  ctx.locks.script = false;
  const bad = ctx.adminApi("nope", "snapshot", {});
  check("wrong password is still refused", bad.ok === false && bad.error === "unauthorized");
}

// --- 6. Invite opened from a personal link: logged without the lock; shows on the guest; manual "sent" marks
{
  const { ctx, sheets } = setup();
  ctx.adminApi("pw", "addGuests", { guests: [{ first: "Ann", last: "Lee", email: "Ann@X.com", company: "" }] });
  const g0 = ctx.adminApi("pw", "snapshot", {}).data.guests[0];
  const id = (g0.link.match(/[?&]g=([\w-]+)/) || [])[1] || "";
  check("personal link carries a guest ID, not the email", id.length === 10 && !/ann%40|ann@/i.test(g0.link));
  ctx.locks.script = true;
  const out = ctx.doPost({ parameter: { viewed: "1", g: id }, postData: { contents: "" } });
  ctx.locks.script = false;
  check("view ping saves while the sheet lock is busy", out.text === "ok" && sheets["Views"].rows.length === 2);
  check("bad view ping is refused, nothing saved", ctx.doPost({ parameter: { viewed: "1", g: "<x>" }, postData: { contents: "" } }).text === "missing" && sheets["Views"].rows.length === 2);
  check("guest shows as opened (any email case)", !!ctx.adminApi("pw", "snapshot", {}).data.guests[0].viewed);
  const m1 = ctx.adminApi("pw", "markSent", { emails: ["ann@x.com"], which: "sent", on: true });
  const first = m1.data.guests[0].sent;
  const m2 = ctx.adminApi("pw", "markSent", { emails: ["ann@x.com"], which: "sent", on: true });
  check("mark sent stamps once and keeps the first date", !!first && m2.result.marked === 0 && m2.data.guests[0].sent === first);
  const m3 = ctx.adminApi("pw", "markSent", { emails: ["ann@x.com"], which: "sent", on: false });
  check("mark not sent clears it", m3.ok && m3.data.guests[0].sent === "");
  ctx.adminApi("pw", "markSent", { emails: ["ann@x.com"], which: "sent", on: true });
  ctx.adminApi("pw", "markSent", { emails: ["ann@x.com"], which: "reminded", on: true });
  const m4 = ctx.adminApi("pw", "markSent", { emails: ["ann@x.com"], which: "sent", on: false });
  check("unmarking the invite clears the reminder too", m4.data.guests[0].reminded === "");
}

// --- 7. Bounces: marked by hand, stamps "sent", skipped by reminders, overwritten by a later RSVP
{
  const { ctx } = setup();
  ctx.adminApi("pw", "addGuests", { guests: [{ first: "Bo", last: "U", email: "bo@x.com", company: "" }, { first: "Ok", last: "K", email: "ok@x.com", company: "" }] });
  const b1 = ctx.adminApi("pw", "markBounced", { emails: ["BO@x.com"], on: true });
  const bo = b1.data.guests.find(g => g.email === "bo@x.com");
  check("mark bounced sets the status and an invite date", bo.status === "Bounced" && !!bo.sent);
  ctx.adminApi("pw", "markSent", { emails: ["ok@x.com"], which: "sent", on: true });
  ctx.sent.length = 0;
  vm.runInContext("sendRows_(r => r[C.email - 1] && r[C.sent - 1] && !r[C.reminded - 1] && !/Attending|Declined|Bounced/.test(r[C.status - 1]), true, null)", ctx);
  check("reminders skip bounced guests", ctx.sent.length === 1 && ctx.sent[0] === "ok@x.com");
  ctx.doPost({ parameter: { first: "Bo", last: "U", email: "bo@x.com", attending: "Yes" }, postData: { contents: "" } });
  const after = ctx.adminApi("pw", "snapshot", {}).data.guests.find(g => g.email === "bo@x.com");
  check("a later RSVP replaces Bounced", after.status === "Attending");
  const b2 = ctx.adminApi("pw", "markBounced", { emails: ["bo@x.com"], on: true });
  check("can't mark someone bounced after they replied", b2.result.marked === 0);
}

// --- 8. Add RSVP by hand, with or without an email; the dropped Source column is cleaned up
{
  const { ctx, sheets } = setup();
  check("RSVPs tab has no Source header", sheets["RSVPs"].rows[0].length === 7);
  sheets["RSVPs"].rows[0][7] = "Source";  // what v13 and v14 added to the real sheet
  sheets["RSVPs"].rows.push([new Date(), "Old", "Row", "old@x.com", "", "", "Yes", "Word of mouth"]);
  ctx.adminApi("pw", "snapshot", {});
  check("Source column is removed, RSVP data kept", sheets["RSVPs"].rows[0].length === 7 && sheets["RSVPs"].rows[1].length === 7 && sheets["RSVPs"].rows[1][3] === "old@x.com" && sheets["RSVPs"].rows[1][6] === "Yes");
  const a = ctx.adminApi("pw", "addRsvp", { first: "Wes", last: "T", company: "=ACME", attending: "Yes" });
  const r = a.data.rsvps[1];
  check("added RSVP saves with no email, using a stand-in key", a.ok && /^added-/.test(r.email) && r.attending === "Yes" && sheets["RSVPs"].rows[2].length === 7);
  check("added RSVP values are cleaned", r.company === "'=ACME");
  const n = ctx.adminApi("pw", "addRsvp", { first: "Nia", email: "nia@x.com", attending: "No" });
  check("added RSVP can record Can't make it", n.data.rsvps[2].attending === "No" && n.data.rsvps[2].email === "nia@x.com");
  check("added RSVP needs a first name", ctx.adminApi("pw", "addRsvp", { first: " " }).ok === false);
  check("added RSVP rejects a bad email", ctx.adminApi("pw", "addRsvp", { first: "X", email: "nope" }).ok === false);
  const key = r.email.toLowerCase();
  ctx.adminApi("pw", "checkIn", { email: key, name: "Wes T", company: "" });
  const del = ctx.adminApi("pw", "deleteGuests", { keys: [key] });
  check("no-email RSVP can be checked in and deleted", del.ok && del.result.rsvpRows === 1 && del.result.checkinRows === 1);
}

console.log(`\n${assertions - failures}/${assertions} passed`);
process.exit(failures ? 1 : 0);
