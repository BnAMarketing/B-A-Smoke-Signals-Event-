/* Regression test for the 2026-10-30 RSVP failure: runs the REAL apps-script/Code.js against fake
   Google services (Sheet, LockService, MailApp) and checks RSVPs never wait on the sheet lock,
   sends lock per guest, and mid-send deletes can't mis-stamp rows.
   Run:   node tests/lock_test.js            (optional arg: path to another Code.js)
   Pass:  prints "16/16 passed" and exits 0.  The pre-fix code crashes with "Lock timeout".
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
    deleteRow(i) { this.rows.splice(i - 1, 1); }
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
  ctx.Utilities = { sleep() {} };
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

console.log(`\n${assertions - failures}/${assertions} passed`);
process.exit(failures ? 1 : 0);
