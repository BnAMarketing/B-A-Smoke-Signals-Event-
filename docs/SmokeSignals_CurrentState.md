# Smoke Signals — Current Project State

Running snapshot of where this project is *right now*. Updated at the end of every session that ships material changes.

---

## Pinned focus

Event is **Wed Nov 4 2026** — two weeks out as of 2026-10-21. Next-session candidates, in order:

1. **End-to-end test:** submit a test RSVP on the live invite, confirm the row lands in the Sheet, send a test email from the back office.
2. **Settings tab** (back office > Settings): Invite link = `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/`; Envelope image link = `https://bnamarketing.github.io/Smoke-Signal-RSVPs/smoke-signals-invite.gif`.
3. **RSVP deadline** — owner to supply a date; set `RSVP_DEADLINE` in `index.html`.
4. **Print card:** regenerate the card-back QR to the live invite URL (it currently points at the Claude artifact).
5. Trash the stray standalone "Untitled project" (`10I_SDmo…zhw-`).

---

## Standing invariants (carry forward)

- Public repo: no secrets, no guest data in committed files. Password = Script Property `ADMIN_PASSWORD`.
- Backend change = `clasp push` + new version of the **existing** deployment (URL must not change).
- RSVP fields `first, last, email, role, company, attending` are a contract between `index.html` and `doPost`.
- `node --check apps-script/Code.js` before every push.

---

## Wiring status

| Item | Status |
|---|---|
| Backend in repo (`apps-script/`), `.clasp.json` → Sheet-bound script (Sheet renamed "AFCEA TechNet RSVPs 2026"; production) (`1S408C1h…T42eN`, parent Sheet `1-Ayv0…VQm4`) | Done 2026-10-21 |
| `ADMIN_PASSWORD` in Script Properties | Done (owner) |
| Deployment `AKfycby2Ftp…960` ("Testv1") | Version 3 live — wrong key returns `unauthorized` JSON, no doGet crash |
| `RSVP_URL` / `API_URL` in HTML | Wired to v3 `/exec` (2026-10-21); back-office login verified by owner |
| Back office | **Moved into Apps Script**, redesigned (v5, 2026-10-21). Login verified by owner on v4: open the `/exec` link. Wrong-password round trip verified; owner to verify real login. Then delete `admin.html` + legacy `?key=` branch in `doGet` |
| GitHub Pages | Live: `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/` (+ `/admin.html`) |
| `admin.html` insignia | Points at the image repo's Pages URL (no `assets/` folder in this repo) |
| Settings tab links | Unknown — check the Sheet |

---

## Open issues / risks

- The earlier doGet error came from a standalone copy of the script (no bound Sheet → `getActiveSpreadsheet()` is null). Fixed by repointing clasp to the bound script.
- "Claude version" of the back office (Smoke Signals Invite artifact > Host back office, PIN) works independently of this repo.

---

## Architecture notes worth remembering

- `authed_()` refuses empty or `"CHANGE-ME"` passwords, and failed auth sleeps 800 ms to slow guessing.
- `doPost` takes a script lock (20 s) so simultaneous RSVPs don't overwrite each other's rows.
- Auto mode (`turnOnAuto` / `autoRun`) is a time trigger for scheduled sends/reminders.

---

## Recent significant changes

| Date | Session | Outcome |
|---|---|---|
| 2026-10-30 | RSVP failure fix | 1–2 guests saw "check your connection": RSVPs waited on the script lock held for minutes by bulk sends, timed out (uncaught) and weren't saved. RSVPs now skip the lock; sends lock per guest; invite page retries x3 with distinct blocked/busy messages. Deployed v10. Failed RSVPs before the fix were never saved — those guests must resubmit. |
| 2026-10-21 | Back office redesign | `Admin.html` reskinned to the "A refined" clean-console design (sidebar, one "Do this next" action picked from the data, plain status words, big check-in buttons, phone top bar). Same IDs/server calls. Home tab one-time function `setupHomeTab` added. Deployed v5. Mockups: claude.ai/artifact/EGeWVMDc2dNbhcVMNMcRoH |
| 2026-10-21 | Standalone back office | Back office served by Apps Script (`Admin.html` + `adminApi`); Sheet-menu functions guarded with `sheetOnly_()`; login lockout. Deployed v4. |
| 2026-10-21 | Claude Code setup | Added CLAUDE.md + docs; backend into `apps-script/` via clasp; admin password moved to Script Properties; clasp repointed to the Sheet-bound script; deployment updated to v3. |
