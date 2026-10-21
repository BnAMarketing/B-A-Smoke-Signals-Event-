# Smoke Signals — Current Project State

Running snapshot of where this project is *right now*. Updated at the end of every session that ships material changes.

---

## Pinned focus

Event is **Wed Nov 4 2026** — two weeks out as of 2026-10-21. Next-session candidates, in order:

1. **Owner test:** sign in to `admin.html` (or hit `/exec?key=<password>`) with the new password — expect `{"ok":true,...}`.
2. **Wire the live URLs:** web app `/exec` = `https://script.google.com/macros/s/AKfycby2FtpOHPbhLHu-R9KxTyvHYjgf435FB92YW_bnlOW1DxCHFmZghKf1-nTAHnJG960/exec` → `RSVP_URL` (`index.html`) and `API_URL` (`admin.html`). Confirm first: the script is titled "RSVP TEST" and the deployment "Testv1", so check this is the Sheet meant for real guests.
3. **Settings tab:** set "Invite link" (this repo's Pages URL) and "Envelope image link" (`Smoke-Signal-RSVPs` Pages URL for `smoke-signals-invite.gif`).
4. Send a test invite (Sheet menu) before the real send.
5. Trash the stray standalone "Untitled project" (`10I_SDmo…zhw-`) in marketing.bna2026's Drive.

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
| Backend in repo (`apps-script/`), `.clasp.json` → Sheet-bound script "RSVP TEST" (`1S408C1h…T42eN`, parent Sheet `1-Ayv0…VQm4`) | Done 2026-10-21 |
| `ADMIN_PASSWORD` in Script Properties | Done (owner) |
| Deployment `AKfycby2Ftp…960` ("Testv1") | Version 3 live — wrong key returns `unauthorized` JSON, no doGet crash |
| `RSVP_URL` / `API_URL` in HTML | Placeholder |
| Settings tab links | Unknown — check the Sheet |

---

## Open issues / risks

- The bound project is titled "RSVP TEST" — rename if it is the production one.
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
| 2026-10-21 | Claude Code setup | Added CLAUDE.md + docs; backend into `apps-script/` via clasp; admin password moved to Script Properties; clasp repointed to the Sheet-bound script; deployment updated to v3. |
