/**
 * B&A Smoke Signals: RSVP collector + back office API + invitation sender.
 * Paste this whole file into your Google Sheet: Extensions > Apps Script.
 *
 * ONE-TIME SETUP
 * 1. Project Settings > Script Properties > add ADMIN_PASSWORD = your back office login password.
 *    (Kept out of the code on purpose: this file lives in a public GitHub repo.)
 * 2. Click Save. Reload the Google Sheet. A "Smoke Signals" menu appears.
 * 3. Smoke Signals > Set up guest list. This adds the Guests, Settings, Check-in and Tracker tabs.
 * 4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Deploy.
 *    Copy the Web app URL (ends in /exec) into index.html. Open that same URL in a browser
 *    (no ?key=) to get the back office.
 *
 * AFTER ANY CODE CHANGE: Deploy > Manage deployments > pencil > Version: New version > Deploy.
 * The web app URL stays the same.
 */
/* Back office password lives in Script Properties, never in code (public repo). */
const ADMIN_PASSWORD = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD") || "";

const SHEET_NAME = "RSVPs";
const HEADERS = ["Submitted", "First name", "Last name", "Email", "Role / position", "Company", "Attending"];
const GUESTS = "Guests";
const SETTINGS = "Settings";
const CHECKIN = "Check-in";
const TRACKER = "Tracker";
const G_HEAD = ["Send", "First name", "Last name", "Email", "Company", "RSVP status", "Invite sent", "Reminder sent", "Personal link", "Notes"];
const C = { send: 1, first: 2, last: 3, email: 4, company: 5, status: 6, sent: 7, reminded: 8, link: 9, notes: 10 };
const CI_HEAD = ["Email", "Name", "Company", "Arrived", "Walk-in", "Checked in by"];
const DEFAULT_SETTINGS = [
  ["Invite link", "https://YOURNAME.github.io/smoke-signals-rsvp/", "Your GitHub invite page"],
  ["Envelope image link", "https://YOURNAME.github.io/smoke-signals-rsvp/assets/smoke-signals-invite.gif", "Shown in the email"],
  ["Email subject", "You're invited: Smoke Signals with B&A, Nov 4", ""],
  ["Sender name", "B&A", "Shown as the From name"],
  ["Reply-to email", "", "Where replies go (your B&A email)"],
  ["RSVP deadline", "", "Shown in the email, e.g. October 30"],
  ["Automatic sending", "Off", "On or Off. Use the menu to turn on."],
  ["Send invites on", "", "Date and time to send to everyone not yet invited"],
  ["Send reminders on", "", "Date and time to remind guests who haven't replied"],
  ["Reminder subject", "Reminder: RSVP for Smoke Signals, Nov 4", ""],
  ["Venue capacity", "", "Optional. Shown in the back office"]
];
const EDITABLE_SETTINGS = ["Invite link", "Envelope image link", "Email subject", "Sender name", "Reply-to email",
  "RSVP deadline", "Reminder subject", "Venue capacity"];

/* ================= Web app ================= */

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function authed_(key) {
  const cache = CacheService.getScriptCache();
  if (Number(cache.get("authFails") || 0) >= MAX_AUTH_FAILS) return false;  // locked out for a while
  const ok = ADMIN_PASSWORD !== "" && ADMIN_PASSWORD !== "CHANGE-ME" && String(key || "") === ADMIN_PASSWORD;
  if (!ok) cache.put("authFails", String(Number(cache.get("authFails") || 0) + 1), LOCKOUT_SECONDS);
  return ok;
}
const MAX_AUTH_FAILS = 10;     // wrong passwords allowed (from anyone) ...
const LOCKOUT_SECONDS = 900;   // ... per 15 minutes before all logins pause

/* Sheet-menu functions are public (menus need that), so any page this project serves could
   call them through google.script.run. This makes them refuse to run outside the Sheet. */
function sheetOnly_() {
  try { SpreadsheetApp.getUi(); } catch (e) { throw new Error("Run this from the Sheet's Smoke Signals menu."); }
}
function clean_(v, max) {
  return String(v == null ? "" : v).slice(0, max || 200).replace(/^[=+\-@]/, "'$&");
}

/* GET: back office reads (password required) */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.key == null) {
    return HtmlService.createHtmlOutputFromFile("Admin")
      .setTitle("Smoke Signals Back Office")
      .setFaviconUrl("https://bnamarketing.github.io/Smoke-Signal-RSVPs/insignia.png")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
  /* Legacy JSON read for the old GitHub admin.html. Remove once that page is deleted. */
  if (!authed_(p.key)) { Utilities.sleep(800); return out_({ ok: false, error: "unauthorized" }); }
  try {
    ensureTabs_();
    return out_({ ok: true, data: snapshot_() });
  } catch (err) {
    return out_({ ok: false, error: String(err.message || err) });
  }
}

/* POST: guest RSVPs (form fields) or back office actions (JSON with key + action) */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let body = null;
    try { body = JSON.parse((e.postData && e.postData.contents) || ""); } catch (x) { body = null; }
    if (body && body.action) {
      if (!authed_(body.key)) { Utilities.sleep(800); return out_({ ok: false, error: "unauthorized" }); }
      ensureTabs_();
      const result = action_(body);
      return out_({ ok: true, result: result, data: snapshot_() });
    }
    const p = e.parameter || {};
    if (!p.email) return ContentService.createTextOutput("missing");
    getSheet_().appendRow([new Date(), clean_(p.first), clean_(p.last), clean_(p.email), clean_(p.role), clean_(p.company), clean_(p.attending)]);
    try { refreshStatus_(); } catch (err) {}
    return ContentService.createTextOutput("ok");
  } catch (err) {
    return out_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function action_(b) {
  switch (b.action) {
    case "addGuests": return addGuests_(b.guests || []);
    case "updateGuest": return updateGuest_(b.email, b.fields || {});
    case "removeGuest": return removeGuest_(b.email);
    case "checkIn": return checkIn_(b.email, b.name, b.company, false, b.by);
    case "undoCheckIn": return undoCheckIn_(b.email);
    case "walkIn": return checkIn_(b.email || ("walkin-" + Date.now()), b.name, b.company, true, b.by);
    case "setTask": return setTask_(b.task, !!b.done);
    case "saveSettings": return saveSettings_(b.settings || {});
    case "sendInvites": return sendRows_(rowByEmail_(b.emails), false, null);
    case "sendUnsent": return sendRows_(r => r[C.email - 1] && !r[C.sent - 1], false, null);
    case "sendReminders": return sendRows_(r => r[C.email - 1] && r[C.sent - 1] && !r[C.reminded - 1] && !/Attending|Declined/.test(r[C.status - 1]), true, null);
    case "sendTest": return sendTest_(b.to);
    case "ping": return "pong";
    default: throw new Error("Unknown action: " + b.action);
  }
}

/* Back office page (Admin.html) calls this through google.script.run. Password checked on every call. */
function adminApi(key, action, extra) {
  if (!authed_(key)) { Utilities.sleep(800); return { ok: false, error: "unauthorized" }; }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensureTabs_();
    if (action === "snapshot") return JSON.parse(JSON.stringify({ ok: true, data: snapshot_() }));
    const result = action_(Object.assign({}, extra || {}, { action: action }));
    return JSON.parse(JSON.stringify({ ok: true, result: result, data: snapshot_() }));
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    lock.releaseLock();
  }
}

/* Everything the back office shows, in one read */
function snapshot_() {
  refreshStatus_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const g = ss.getSheetByName(GUESTS);
  const guests = g.getLastRow() < 2 ? [] : g.getRange(2, 1, g.getLastRow() - 1, G_HEAD.length).getValues()
    .filter(r => String(r[C.email - 1]).trim() || String(r[C.first - 1]).trim())
    .map(r => ({
      first: String(r[C.first - 1]), last: String(r[C.last - 1]), email: String(r[C.email - 1]).trim(),
      company: String(r[C.company - 1]), status: String(r[C.status - 1]),
      sent: iso_(r[C.sent - 1]), reminded: iso_(r[C.reminded - 1]), link: String(r[C.link - 1]), notes: String(r[C.notes - 1] || "")
    }));
  const rv = getSheet_().getDataRange().getValues().slice(1).filter(r => r.join("") !== "").map(r => ({
    submitted: iso_(r[0]), first: String(r[1]), last: String(r[2]), email: String(r[3]).trim(),
    role: String(r[4]), company: String(r[5]), attending: String(r[6])
  }));
  const ci = ss.getSheetByName(CHECKIN);
  const arrivals = ci.getLastRow() < 2 ? [] : ci.getRange(2, 1, ci.getLastRow() - 1, CI_HEAD.length).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({ email: String(r[0]).trim(), name: String(r[1]), company: String(r[2]), arrived: iso_(r[3]), walkin: r[4] === true || r[4] === "Yes", by: String(r[5] || "") }));
  const tr = ss.getSheetByName(TRACKER);
  const tasks = {};
  if (tr.getLastRow() > 1) tr.getRange(2, 1, tr.getLastRow() - 1, 3).getValues().forEach(r => { if (r[0]) tasks[String(r[0])] = { done: r[1] === true, at: iso_(r[2]) }; });
  const cfg = settings_();
  const settings = {};
  EDITABLE_SETTINGS.forEach(k => settings[k] = cfg[k] instanceof Date ? iso_(cfg[k]) : String(cfg[k] == null ? "" : cfg[k]));
  settings["Automatic sending"] = String(cfg["Automatic sending"] || "Off");
  settings["Send invites on"] = iso_(cfg["Send invites on"]);
  settings["Send reminders on"] = iso_(cfg["Send reminders on"]);
  return { guests: guests, rsvps: rv, arrivals: arrivals, tasks: tasks, settings: settings,
    quota: MailApp.getRemainingDailyQuota(), now: new Date().toISOString() };
}
function iso_(v) { return v instanceof Date ? v.toISOString() : String(v || ""); }

/* ================= Guests ================= */

function findGuestRow_(email) {
  const g = guests_();
  const em = String(email || "").toLowerCase().trim();
  if (!em || g.getLastRow() < 2) return -1;
  const vals = g.getRange(2, C.email, g.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]).toLowerCase().trim() === em) return i + 2;
  return -1;
}
function addGuests_(list) {
  const g = guests_();
  let added = 0, updated = 0;
  list.slice(0, 1000).forEach(x => {
    const email = clean_(x.email).trim();
    if (!email && !x.first) return;
    const row = email ? findGuestRow_(email) : -1;
    if (row > 0) {
      if (x.first) g.getRange(row, C.first).setValue(clean_(x.first));
      if (x.last) g.getRange(row, C.last).setValue(clean_(x.last));
      if (x.company) g.getRange(row, C.company).setValue(clean_(x.company));
      updated++;
    } else {
      const r = firstEmptyRow_(g);
      g.getRange(r, C.first, 1, 4).setValues([[clean_(x.first), clean_(x.last), email, clean_(x.company)]]);
      g.getRange(r, C.send).insertCheckboxes();
      added++;
    }
  });
  return { added: added, updated: updated };
}
function firstEmptyRow_(g) {
  const n = Math.max(1, g.getLastRow() - 1);
  const vals = g.getRange(2, C.first, n, 4).getValues();
  for (let i = 0; i < vals.length; i++) if (vals[i].join("") === "") return i + 2;
  return g.getLastRow() + 1;
}
function updateGuest_(email, f) {
  const row = findGuestRow_(email);
  if (row < 0) throw new Error("Guest not found.");
  const g = guests_();
  if ("notes" in f) g.getRange(row, C.notes).setValue(clean_(f.notes, 500));
  if ("company" in f) g.getRange(row, C.company).setValue(clean_(f.company));
  if ("status" in f && /^(Attending|Declined|)$/.test(f.status)) g.getRange(row, C.status).setValue(f.status);
  return "ok";
}
function removeGuest_(email) {
  const row = findGuestRow_(email);
  if (row < 0) throw new Error("Guest not found.");
  guests_().deleteRow(row);
  return "ok";
}
function rowByEmail_(emails) {
  const set = {};
  (emails || []).forEach(e => set[String(e).toLowerCase().trim()] = true);
  return r => set[String(r[C.email - 1]).toLowerCase().trim()] === true;
}

/* ================= Check-in ================= */

function checkIn_(email, name, company, walkin, by) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHECKIN);
  const em = clean_(email).trim();
  if (s.getLastRow() > 1) {
    const vals = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) if (String(vals[i][0]).toLowerCase().trim() === em.toLowerCase()) return "already";
  }
  s.appendRow([em, clean_(name), clean_(company), new Date(), walkin ? "Yes" : "", clean_(by)]);
  if (walkin && em.indexOf("@") > 0 && findGuestRow_(em) < 0) {
    const parts = String(name || "").trim().split(/\s+/);
    addGuests_([{ first: parts[0] || "", last: parts.slice(1).join(" "), email: em, company: company }]);
    const row = findGuestRow_(em);
    if (row > 0) guests_().getRange(row, C.notes).setValue("Walk-in");
  }
  return "ok";
}
function undoCheckIn_(email) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHECKIN);
  if (s.getLastRow() < 2) return "ok";
  const vals = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]).toLowerCase().trim() === String(email).toLowerCase().trim()) s.deleteRow(i + 2);
  return "ok";
}

/* ================= Tracker ================= */

function setTask_(task, done) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRACKER);
  const key = clean_(task, 60);
  if (s.getLastRow() > 1) {
    const vals = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === key) { s.getRange(i + 2, 2, 1, 2).setValues([[done, new Date()]]); return "ok"; }
  }
  s.appendRow([key, done, new Date()]);
  return "ok";
}

/* ================= Settings ================= */

function saveSettings_(obj) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS);
  Object.keys(obj).forEach(k => { if (EDITABLE_SETTINGS.indexOf(k) >= 0) setSetting_(s, k, clean_(obj[k], 500)); });
  return "ok";
}

/* ================= Sheets setup ================= */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureTabs_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getSheet_();
  let g = ss.getSheetByName(GUESTS);
  if (!g) {
    g = ss.insertSheet(GUESTS);
    g.getRange(1, 1, 1, G_HEAD.length).setValues([G_HEAD]).setFontWeight("bold").setBackground("#16202c").setFontColor("#A9C1DF");
    g.setFrozenRows(1);
    g.getRange(2, C.send, 500, 1).insertCheckboxes();
    g.setColumnWidths(1, 1, 60); g.setColumnWidths(2, 2, 130); g.setColumnWidth(C.email, 240); g.setColumnWidth(C.company, 200);
    g.setColumnWidths(C.status, 3, 140); g.setColumnWidth(C.link, 320); g.setColumnWidth(C.notes, 240);
  } else if (g.getRange(1, C.notes).getValue() === "") {
    g.getRange(1, C.notes).setValue("Notes").setFontWeight("bold").setBackground("#16202c").setFontColor("#A9C1DF");
  }
  let s = ss.getSheetByName(SETTINGS);
  if (!s) {
    s = ss.insertSheet(SETTINGS);
    s.getRange(1, 1, 1, 3).setValues([["Setting", "Value", "Notes"]]).setFontWeight("bold");
    s.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setValues(DEFAULT_SETTINGS);
    s.setColumnWidth(1, 180); s.setColumnWidth(2, 420); s.setColumnWidth(3, 320);
    s.getRange("B9:B10").setNumberFormat("mmm d, yyyy h:mm am/pm");
  } else {
    const have = {};
    s.getRange(2, 1, Math.max(1, s.getLastRow() - 1), 1).getValues().forEach(r => have[String(r[0]).trim()] = true);
    DEFAULT_SETTINGS.forEach(d => { if (!have[d[0]]) s.appendRow(d); });
  }
  let c = ss.getSheetByName(CHECKIN);
  if (!c) {
    c = ss.insertSheet(CHECKIN);
    c.getRange(1, 1, 1, CI_HEAD.length).setValues([CI_HEAD]).setFontWeight("bold");
    c.setFrozenRows(1);
    c.getRange("D:D").setNumberFormat("mmm d h:mm am/pm");
  }
  let t = ss.getSheetByName(TRACKER);
  if (!t) {
    t = ss.insertSheet(TRACKER);
    t.getRange(1, 1, 1, 3).setValues([["Task", "Done", "Updated"]]).setFontWeight("bold");
    t.setFrozenRows(1);
  }
}

/* ================= Menu ================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Smoke Signals")
    .addItem("Set up guest list", "setupGuestList")
    .addSeparator()
    .addItem("Send to checked guests", "sendToChecked")
    .addItem("Send to everyone not yet invited", "sendToAllUnsent")
    .addItem("Send reminders to guests who haven't replied", "sendRemindersNow")
    .addItem("Send me a test email", "sendTestEmail")
    .addSeparator()
    .addItem("Refresh RSVP status", "refreshStatusMenu")
    .addItem("Turn on automatic sending", "turnOnAuto")
    .addItem("Turn off automatic sending", "turnOffAuto")
    .addToUi();
}

function setupGuestList() {
  sheetOnly_();
  ensureTabs_();
  SpreadsheetApp.getUi().alert("Done. Fill in the Settings tab, then add guests on the Guests tab or in the back office.");
}

/* ================= Helpers ================= */

function settings_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS);
  if (!s) throw new Error("Run Smoke Signals > Set up guest list first.");
  const map = {};
  s.getRange(2, 1, Math.max(1, s.getLastRow() - 1), 2).getValues().forEach(r => { if (r[0]) map[String(r[0]).trim()] = r[1]; });
  return map;
}
function guests_() {
  const g = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUESTS);
  if (!g) throw new Error("Run Smoke Signals > Set up guest list first.");
  return g;
}
function esc_(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function personalLink_(base, first, last) {
  if (!base) return "";
  const name = (String(first) + " " + String(last)).trim();
  return base + (base.indexOf("?") < 0 ? "?" : "&") + "to=" + encodeURIComponent(name);
}
function validEmail_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim()); }

function rsvpByEmail_() {
  const map = {};
  getSheet_().getDataRange().getValues().slice(1).forEach(r => {
    const em = String(r[3]).toLowerCase().trim();
    if (em) map[em] = String(r[6]); // later rows overwrite earlier ones
  });
  return map;
}
function refreshStatus_() {
  const g = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUESTS);
  if (!g || g.getLastRow() < 2) return;
  const map = rsvpByEmail_();
  const n = g.getLastRow() - 1;
  const emails = g.getRange(2, C.email, n, 1).getValues();
  const status = g.getRange(2, C.status, n, 1).getValues();
  emails.forEach((r, i) => {
    const em = String(r[0]).toLowerCase().trim();
    if (!em) return;
    const a = map[em];
    if (a === "Yes") status[i][0] = "Attending";
    else if (a === "No") status[i][0] = "Declined";
  });
  g.getRange(2, C.status, n, 1).setValues(status);
}
function refreshStatusMenu() { sheetOnly_(); refreshStatus_(); SpreadsheetApp.getActiveSpreadsheet().toast("RSVP status updated."); }

/* ================= Email ================= */

function emailHtml_(cfg, first, link, reminder) {
  const img = String(cfg["Envelope image link"] || "");
  const deadline = cfg["RSVP deadline"] ? ("Reply by " + esc_(cfg["RSVP deadline"]) + " &middot; ") : "";
  const intro = reminder
    ? "We haven't received your RSVP yet and would love to see you there. Tap the invitation below to reply."
    : "You're cordially invited to an evening after hours with B&amp;A at AFCEA TechNet Rocket City. Tap the envelope to open your invitation.";
  return '<!doctype html><html><body style="margin:0;padding:0;background:#444C57;">' +
    '<div style="display:none;max-height:0;overflow:hidden;">Bourbon, cigars, food and DJs. Wed, Nov 4 in Huntsville.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#444C57;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">' +
    '<tr><td style="padding:8px 24px 18px;font-family:Georgia,serif;font-style:italic;font-size:26px;color:#f4ead8;">Dear ' + esc_(first || "friend") + ',</td></tr>' +
    '<tr><td style="padding:0 24px 22px;font-family:Arial,sans-serif;font-size:15px;line-height:23px;color:#c3cfdd;">' + intro + '</td></tr>' +
    (img ? '<tr><td align="center"><a href="' + esc_(link) + '" target="_blank"><img src="' + esc_(img) + '" width="600" alt="Open your Smoke Signals invitation" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>' : '') +
    '<tr><td align="center" style="padding:24px 0 8px;"><a href="' + esc_(link) + '" target="_blank" style="display:inline-block;background:#7C9CC4;color:#16202c;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;letter-spacing:3px;line-height:52px;width:260px;text-align:center;text-decoration:none;">RSVP NOW</a></td></tr>' +
    '<tr><td align="center" style="padding:12px 24px 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#c3cfdd;">' +
    'Wednesday, November 4 &middot; 6:00 PM until late<br>Vintage Cigar Lounge &middot; 355 Bridge Street Town Centre, Huntsville, AL<br>' + deadline + 'Space is limited &middot; 21+</td></tr>' +
    '</table></td></tr></table></body></html>';
}
function emailText_(first, link, reminder) {
  return "Dear " + (first || "friend") + ",\n\n" +
    (reminder ? "We haven't received your RSVP yet. " : "You're invited to Smoke Signals, an evening after hours with B&A at AFCEA TechNet Rocket City.\n") +
    "Open your invitation and RSVP: " + link + "\n\nWednesday, November 4, 6:00 PM until late\nVintage Cigar Lounge, 355 Bridge Street Town Centre, Huntsville, AL";
}

function sendRows_(rowFilter, reminder, confirmText) {
  const cfg = settings_();
  const base = String(cfg["Invite link"] || "").trim();
  if (!base || base.indexOf("YOURNAME") >= 0) throw new Error('Add your real invite link in Settings ("Invite link") first.');
  const g = guests_();
  const n = g.getLastRow() - 1;
  if (n < 1) return { sent: 0, skipped: 0, note: "No guests on the list yet." };
  refreshStatus_();
  const data = g.getRange(2, 1, n, G_HEAD.length).getValues();
  const targets = [];
  data.forEach((r, i) => { if (rowFilter(r)) targets.push(i); });
  if (!targets.length) return { sent: 0, skipped: 0, note: "No guests match." };
  if (confirmText) {
    const ui = SpreadsheetApp.getUi();
    if (ui.alert(confirmText.replace("{n}", targets.length), ui.ButtonSet.YES_NO) !== ui.Button.YES) return { sent: 0, skipped: 0, note: "Canceled." };
  }
  const quota = MailApp.getRemainingDailyQuota();
  let sent = 0, skipped = 0;
  targets.forEach(i => {
    const r = data[i];
    const email = String(r[C.email - 1]).trim();
    if (!validEmail_(email)) { skipped++; g.getRange(i + 2, C.status).setValue("Check email address"); return; }
    if (sent >= quota) { skipped++; return; }
    const link = personalLink_(base, r[C.first - 1], r[C.last - 1]);
    const opts = {
      to: email,
      subject: String(reminder ? cfg["Reminder subject"] : cfg["Email subject"]),
      htmlBody: emailHtml_(cfg, r[C.first - 1], link, reminder),
      body: emailText_(r[C.first - 1], link, reminder),
      name: String(cfg["Sender name"] || "B&A")
    };
    if (validEmail_(cfg["Reply-to email"])) opts.replyTo = String(cfg["Reply-to email"]).trim();
    MailApp.sendEmail(opts);
    sent++;
    g.getRange(i + 2, reminder ? C.reminded : C.sent).setValue(new Date());
    g.getRange(i + 2, C.link).setValue(link);
    if (!reminder) g.getRange(i + 2, C.send).setValue(false);
  });
  return { sent: sent, skipped: skipped, note: sent >= quota && targets.length > sent ? "Daily email limit reached; the rest will need another day." : "" };
}

function report_(res, what) {
  const msg = res.note && !res.sent ? res.note :
    "Sent " + res.sent + " " + what + (res.skipped ? ". Skipped " + res.skipped + " (bad email or daily limit)." : ".") + (res.note ? " " + res.note : "");
  SpreadsheetApp.getUi().alert(msg);
}

function sendToChecked() {
  sheetOnly_();
  report_(sendRows_(r => r[C.send - 1] === true, false, "Send the invitation to {n} checked guest(s)?"), "invitation(s)");
}
function sendToAllUnsent() {
  sheetOnly_();
  report_(sendRows_(r => r[C.email - 1] && !r[C.sent - 1], false, "Send the invitation to {n} guest(s) who haven't been invited yet?"), "invitation(s)");
}
function sendRemindersNow() {
  sheetOnly_();
  report_(sendRows_(r => r[C.email - 1] && r[C.sent - 1] && !r[C.reminded - 1] && !/Attending|Declined/.test(r[C.status - 1]), true,
    "Send a reminder to {n} invited guest(s) who haven't replied?"), "reminder(s)");
}
function sendTest_(to) {
  const cfg = settings_();
  const me = validEmail_(to) ? String(to).trim() : (Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail());
  const link = personalLink_(String(cfg["Invite link"] || ""), "Test", "Guest");
  MailApp.sendEmail({ to: me, subject: "[TEST] " + cfg["Email subject"], htmlBody: emailHtml_(cfg, "Test", link, false), body: emailText_("Test", link, false), name: String(cfg["Sender name"] || "B&A") });
  return { sent: 1, to: me };
}
function sendTestEmail() {
  sheetOnly_();
  const r = sendTest_();
  SpreadsheetApp.getUi().alert("Test invitation sent to " + r.to + ".");
}

/* ================= Automatic sending ================= */

function turnOnAuto() {
  sheetOnly_();
  turnOffAuto_(true);
  ScriptApp.newTrigger("autoRun").timeBased().everyHours(1).create();
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS);
  setSetting_(s, "Automatic sending", "On");
  const cfg = settings_();
  SpreadsheetApp.getUi().alert("Automatic sending is on. Every hour it checks the Settings tab:\n\n" +
    "- Invites go to everyone not yet invited once \"Send invites on\" has passed" + (cfg["Send invites on"] ? " (" + cfg["Send invites on"] + ")" : " (set a date first)") + ".\n" +
    "- Reminders go to invited guests who haven't replied once \"Send reminders on\" has passed.\n\nGuests you add later are invited on the next hourly check.");
}
function turnOffAuto() { sheetOnly_(); turnOffAuto_(false); }
function turnOffAuto_(quiet) {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === "autoRun") ScriptApp.deleteTrigger(t); });
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS);
  if (s) setSetting_(s, "Automatic sending", "Off");
  if (!quiet) SpreadsheetApp.getUi().alert("Automatic sending is off.");
}
function setSetting_(s, key, val) {
  const keys = s.getRange(2, 1, Math.max(1, s.getLastRow() - 1), 1).getValues();
  for (let i = 0; i < keys.length; i++) if (String(keys[i][0]).trim() === key) { s.getRange(i + 2, 2).setValue(val); return; }
  s.appendRow([key, val, ""]);
}
function autoRun() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const cfg = settings_();
    if (String(cfg["Automatic sending"]).toLowerCase() !== "on") return;
    const now = new Date();
    const inviteAt = cfg["Send invites on"] instanceof Date ? cfg["Send invites on"] : null;
    const remindAt = cfg["Send reminders on"] instanceof Date ? cfg["Send reminders on"] : null;
    if (inviteAt && now >= inviteAt) sendRows_(r => r[C.email - 1] && !r[C.sent - 1], false, null);
    if (remindAt && now >= remindAt) sendRows_(r => r[C.email - 1] && r[C.sent - 1] && !r[C.reminded - 1] && !/Attending|Declined/.test(r[C.status - 1]), true, null);
    refreshStatus_();
  } finally {
    lock.releaseLock();
  }
}
/* ================= Home tab (one-time setup) ================= */

const BACK_OFFICE_URL = "https://script.google.com/macros/s/AKfycby2FtpOHPbhLHu-R9KxTyvHYjgf435FB92YW_bnlOW1DxCHFmZghKf1-nTAHnJG960/exec";
const INVITE_URL = "https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/";

/* Only the script owner may run this (editor or Sheet). Visitors to the back office page are
   anonymous, so their active-user email is blank and they're refused. */
function ownerOnly_() {
  const me = Session.getEffectiveUser().getEmail();
  if (!me || Session.getActiveUser().getEmail() !== me) throw new Error("Only the script owner can run this.");
}

/* Run once from the editor: builds (or rebuilds) a "Home" tab with a link to the back office. Safe to re-run. */
function setupHomeTab() {
  ownerOnly_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName("Home");
  if (h) { h.getDataRange().breakApart(); h.clear(); } else h = ss.insertSheet("Home", 0);
  ss.setActiveSheet(h); ss.moveActiveSheet(1);

  const INK = "#444C57", DEEP = "#16202c", CREAM = "#f4ead8", BLUE = "#7C9CC4", PALE = "#A9C1DF";
  if (h.getMaxColumns() > 4) h.deleteColumns(5, h.getMaxColumns() - 4);
  if (h.getMaxRows() > 22) h.deleteRows(23, h.getMaxRows() - 22);
  h.setHiddenGridlines(true);
  h.getRange(1, 1, h.getMaxRows(), h.getMaxColumns()).setBackground(INK).setFontFamily("Josefin Sans").setFontColor(CREAM).setVerticalAlignment("middle");
  h.setColumnWidth(1, 40); h.setColumnWidths(2, 2, 330); h.setColumnWidth(4, 40);

  const link = (cell, text, url) => cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(text).setLinkUrl(url).build());
  const row = (r, height) => { h.setRowHeight(r, height); return h.getRange(r, 2, 1, 2).merge(); };

  row(1, 24);
  row(2, 22).setValue("B&A HOST ACCESS").setFontColor(PALE).setFontSize(9).setFontWeight("bold");
  row(3, 54).setValue("Smoke Signals").setFontFamily("Playfair Display").setFontStyle("italic").setFontSize(30).setFontWeight("bold");
  row(4, 26).setValue("Wed, Nov 4 · 6:00 PM until late · Vintage Cigar Lounge, Huntsville · 21+").setFontColor(PALE).setFontSize(10);
  row(5, 20);
  link(row(6, 58), "Open the Back Office  →", BACK_OFFICE_URL);
  h.getRange(6, 2, 1, 2).setBackground(BLUE).setFontColor(DEEP).setFontFamily("Anton").setFontSize(18).setHorizontalAlignment("center");
  row(7, 24).setValue("Guest list · door check-in · send invites · settings. Ask the marketing team for the password.").setFontColor(PALE).setFontSize(9).setHorizontalAlignment("center");
  row(8, 18);
  link(row(9, 28), "View the guest invite page", INVITE_URL);
  h.getRange(9, 2).setFontSize(11);
  row(10, 18);
  row(11, 26).setValue("WHAT'S IN THIS SHEET").setFontColor(PALE).setFontSize(9).setFontWeight("bold");
  [["RSVPs", "Every reply from the invite page (newest at the bottom)."],
   ["Guests", "The invite list. Status updates automatically from RSVPs."],
   ["Check-in", "Arrivals and walk-ins recorded at the door."],
   ["Settings", "Email wording, links and send dates. Easier to edit in the back office."],
   ["Tracker", "The launch checklist shown on the back office Overview."]].forEach((t, i) => {
    h.setRowHeight(12 + i, 26);
    h.getRange(12 + i, 2).setValue(t[0]).setFontWeight("bold");
    h.getRange(12 + i, 3).setValue(t[1]).setFontColor(PALE).setFontSize(10).setWrap(true);
  });
  row(17, 18);
  row(18, 40).setValue("Tip: edit guests in the back office rather than here, so the RSVP status and invite tracking stay in sync.")
    .setFontColor(PALE).setFontSize(9).setFontStyle("italic").setWrap(true);

  h.getRange("B2:C18").setBorder(null, null, null, null, null, null);
  h.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(x => x.remove());  // no duplicates on re-run
  h.protect().setDescription("Home tab layout").setWarningOnly(true);
  return "Home tab ready.";
}
