# Session Handoff — Standalone back office, redesign, RSVP failure fix

**Session date:** 2026-10-30 (one long session that began 2026-10-21, right after the setup handoff)
**Session focus:** Turn the back office into its own password-protected site, redesign it, split Guests and RSVPs, then diagnose and fix RSVPs that failed for 1–2 guests.
**Outcome:** The back office is a standalone Apps Script site at the `/exec` link, now on **v10**. RSVPs no longer wait behind the back office. The invite page retries and gives accurate error messages. The event is **Wed Nov 4**, five days out.
**Next session focus:** Event-week readiness: confirm the affected guests re-RSVP'd, then run Home tab setup, the card QR, the RSVP deadline, and the `admin.html` cleanup.

> **STILL OUTSTANDING (since 2026-10-21):** **`setupHomeTab()` in `apps-script/Code.js`** has never been confirmed as run.
> **Legacy `admin.html`** is still live on GitHub Pages, along with the `?key=` branch in `doGet`.
> The **RSVP deadline** is still unset; the owner will supply it.

## What shipped this session

- **Standalone back office (v4):** `apps-script/Admin.html`, served by `doGet` at the bare `/exec` link. It calls `adminApi(key, action, extra)` through `google.script.run`, so the password is checked on the server on every call and never travels in a URL.
  - Sheet-menu functions are guarded with `sheetOnly_()`. Without the guard, any visitor to the page could call them through `google.script.run`.
  - A login lockout pauses all logins for 15 minutes after 10 wrong passwords.
- **Team Home tab (one-time function):** `setupHomeTab()`, guarded by `ownerOnly_()`. It builds a branded "Home" tab with a link that opens the back office.
- **Redesign "A refined" (v5):** a sidebar menu, one data-driven "Do this next" card, plain-language statuses, big check-in buttons with Undo, and a top-bar layout on phones.
  - Mockups (six directions, then the refined A): https://claude.ai/artifact/EGeWVMDc2dNbhcVMNMcRoH
- **Delete guests (v6):** `deleteGuests_` removes a person from Guests, RSVPs and Check-in. It's available from each row's ⋯ menu and in bulk from the selection bar.
- **Guests vs RSVPs split (v7):** Guests is now the invite list, with email status (Needs invite, Needs reminder, Reminded, Replied) and outstanding people listed first. A new **RSVPs** screen shows replies only, including people not on the list, with its own filters and Excel/CSV download.
- **Home finder (v8):** searches everyone and opens the person on the right screen, pinned by email.
- **"6:00 PM CT" (v9):** the label now appears on the calendar links, the ticket, the emails and the Home tab.
  - The actual time is unchanged and correct: 00:00 UTC Nov 5 = 6:00 PM CST. Daylight saving ends Nov 1.
- **RSVP failure fix (v10):** RSVPs no longer wait behind the back office.
  - Before: RSVPs waited up to 20 s on the script lock, which bulk sends held for minutes. The timeout threw an exception outside the `try`, so guests saw "Check your connection" and the RSVP was **not saved**.
  - Now: `doPost` appends the RSVP with no lock and only `tryLock`s for the status refresh.
  - Sends serialize on the document lock and take the script lock briefly per guest, re-finding each guest's row with `currentGuestRow_`.
  - `adminApi` reports "busy" instead of crashing.
  - The invite page retries up to 3 times and tells "couldn't reach us" apart from "busy".
- **Tests promoted into the repo:** `tests/lock_test.js` (the regression test for the RSVP fix), plus `tests/build_admin_harness.py` and `tests/admin_stub.html` (the fake-data back office used for UI checks).

## Decisions locked this session

- **The back office lives in Apps Script, not GitHub.** That keeps the password out of URLs and the page off the public site. The owner accepted the trade-offs: Google's gray "created by an Apps Script user" banner, and one shared password, since Gmail accounts can't support per-person logins.
- **Smoke Signals only.** The owner chose this over a multi-event hub for now.
- **Guests = the invite list; RSVPs = replies.** This was the owner's call. Don't merge them back.
- **CT, not CDT.** Use CT for this event; it's in Huntsville, Central time.
- **No help email on the invite error.** The owner's reasoning: guests already have the sending address from the invitation itself.
- **Outlook sending:** not built. The owner is asking IT what they recommend; the draft message asks a question rather than prescribing a route.

## Files changed this session

- `apps-script/Code.js`
  - `doGet` serves the page; `adminApi`, `withScriptLock_`, `currentGuestRow_`, `deleteGuests_`, `sheetOnly_`, `ownerOnly_` and `setupHomeTab` are new.
  - The lockout lives in `authed_`.
  - `doPost`, `sendRows_` and `autoRun` use the new locking.
  - Emails say "6:00 PM CT".
- `apps-script/Admin.html` — new: the whole standalone back office.
- `index.html` — the live `/exec` URL, the CT label, the calendar description, and `sendRsvp()` with retries and separate error messages.
- `admin.html` — the live URL and the insignia path. **Legacy: pending deletion.**
- `tests/lock_test.js`, `tests/build_admin_harness.py`, `tests/admin_stub.html`, `tests/.gitignore` — new.
- `.claude/skills/smoke-signals-session-handoff/`, `smoke-signals-deploy/`, `smoke-signals-backoffice-change/` — new repo skills (lint PASS).
- `docs/GlobalSkillNotes.md` — new: 5 lessons queued for the global library (Claude-Skills-Solo is off-limits).
- `CLAUDE.md` — layer routing and invariants (`google.script.run` exposure, lockout, locks), plus this handoff's import.
- `docs/SmokeSignals_CurrentState.md` — rewritten for the new baseline.

## Validation

- `node tests/lock_test.js` (run 2026-10-30 against `apps-script/Code.js`): `16/16 passed`
- The same test against the pre-fix `Code.js` crashed with `Error: Lock timeout`. That reproduces the reported bug.
- Live probes after deploying v10:
  - a POST with no email returned `missing`, so nothing was saved;
  - GET `?key=wrong` returned `{"ok":false,"error":"unauthorized"}`.
- Invite page retry, run in a browser with fake `fetch`: blocked → 3 calls + the "couldn't reach" message; busy-then-ok → 2 calls + the done screen; always busy → 3 calls + the "busy" message; normal → 1 call + the done screen. No console errors.
- Back office with the fake-data harness: all screens, check-in, select and delete, filters, the RSVPs screen, the Home finder, and phone width (375 px, no sideways scroll). No console errors.
- **Not run:** the real back office against the real Sheet after v5 (the owner logged in on v4); the Excel download inside Google's frame; `setupHomeTab` against the real Sheet.

## Not done / open

- Recover failed RSVPs: anyone who hit the error before v10 was never saved. They need to re-RSVP, or the owner adds them by hand. Check the **Executions log** (Function `doPost`, Status Failed, "Lock timeout") for the times it happened.
- **TechNet backend** (`B-A-AFCEA-TechNet-RSVPs`): still unknown. The owner thought it was a claude.ai artifact; it wasn't found by title.
- **Outlook sending:** waiting on IT's reply.
- **"Record RSVP" option** (log an email reply as Coming or Can't make it from the ⋯ menu): offered, no answer yet.
- Stray standalone "Untitled project" (`10I_SDmo…zhw-`) in marketing.bna2026's Drive: trash it.
- Settings links (Invite link, Envelope image link): not confirmed in the real Settings tab.

## Outstanding user actions

- **`setupHomeTab()` in `apps-script/Code.js`** — run once from the [Apps Script editor](https://script.google.com/d/1S408C1hKN9gFPLRK1_I26GDen5ANN8csZfM6CSMFzXqrXZAmenhT42eN/edit) (file `Code.gs`, pick the function, click Run). It builds the team Home tab. *(Outstanding since 2026-10-21.)*
- **`RSVP_DEADLINE` in `index.html`** — supply a date. *(Since 2026-10-21.)*
- **Delete `admin.html`** — confirm, and Claude removes it along with the `?key=` branch in `doGet` (`apps-script/Code.js`). *(Since 2026-10-21.)*
- Ask the 1–2 affected guests to RSVP again.

## Process lessons

- A catch-all "check your connection" message hid a server-side lock timeout. Give each failure class its own message, and never let a public endpoint wait on a lock that admin work can hold for minutes. This belongs in the global `appsscript-sheet-modal-app` skill, but that skill's source repo (Claude-Skills-Solo) is off-limits, so it's recorded locally and queued for the global library. [→ smoke-signals-backoffice-change, tests/lock_test.js, docs/GlobalSkillNotes.md]
- Deploys were typed by hand about 10 times (clasp path, the fixed deployment ID, probes that don't save data, the Pages wait). [→ smoke-signals-deploy]
- The handoff skipped the required skill review because the only fitting global skill was off-limits. Repo skills are always an allowed destination. The owner had to ask for it. [→ smoke-signals-session-handoff, docs/GlobalSkillNotes.md]
- Prove a fix by running the same test against the old code. Seeing "Lock timeout" on pre-fix `Code.js` confirmed this was the real cause, not just a plausible one. [→ tests/lock_test.js]
- The temporary folder was cleaned mid-session, and the harness stub was lost before it could be promoted. Promote a check into the repo the moment it proves useful, not at handoff. [→ tests/build_admin_harness.py, smoke-signals-backoffice-change]
- When drafting a message to IT or another team, ask for their guidance instead of prescribing a route (the owner's correction). [→ memory drafts-to-other-teams-ask-dont-prescribe]
- Check the date's DST status before writing a time-zone label. The owner asked for CDT, but Nov 4 is CST. [→ one-off]

## Opening prompt for next session

```
Smoke Signals repo: read docs/SmokeSignals_CurrentState.md first. The back office is a standalone Apps Script site at the /exec link (v10), with Guests (invite list) and RSVPs split, delete, a Home finder, and the RSVP lock fix (RSVPs never wait on the script lock; node tests/lock_test.js = 16/16). The event is Wed Nov 4.
STILL OUTSTANDING since 2026-10-21: run setupHomeTab() in apps-script/Code.js, set RSVP_DEADLINE in index.html, and confirm deleting the legacy admin.html (plus the ?key= branch in doGet).
Today I want to: <pick: event-week readiness check / delete admin.html / card QR / Record RSVP option / Outlook sending once IT replies>.
```

## Later session — sync verification (Mac check)

**Why:** the owner may have edited on a Mac and wanted proof that nothing is out of sync, and that the last push broke nothing.

**Checked (all match):**
- GitHub, all 3 repos: one branch each (`main`); local = origin; no uncommitted files. Every commit is from a Claude session except `8c378c4 pngs` (Oct 21 21:33; envelope + 3 logos), which is probably the Mac change.
- Apps Script: `clasp clone` of the live project vs `apps-script/`: `Code.js`, `Admin.html`, `appsscript.json` **IDENTICAL**, no extra files. `clasp list-versions`: 10 versions; 3–10 match this session's deploys.
- The last 3 commits touched only `.claude/skills/`, `tests/`, `docs/`, `CLAUDE.md`, with no runtime code.
- Live: invite page **IDENTICAL** to repo `index.html`; back office title `Smoke Signals Back Office`; RSVP probe `missing` (nothing saved); `node tests/lock_test.js` → `16/16 passed`.

**Resolved:** the printed card QR. The owner printed the cards and scanned one: it opens the GitHub invite, and the RSVP went through, which is a live end-to-end test. The repo PNG `Smoke-Signal-RSVPs/smoke-signals-card-back.png` is outdated (old QR) but irrelevant to the printed cards.

**Not checkable from here:** changes on the Mac that were never committed or pushed. If the Mac's repo folders exist, run `git status` there; anything listed was never pushed.
