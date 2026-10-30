# Smoke Signals — Current Project State

Running snapshot of where this project is *right now*. Updated at the end of every session that ships material changes.

---

## Pinned focus

The event is **Wed Nov 4 2026**, five days out as of 2026-10-30. The back office is live, and the RSVP failure fix is deployed (v10). Event-week order of operations:

1. **Recover failed RSVPs.** Have the 1–2 affected guests RSVP again, and check the Executions log (`doPost`, Failed, "Lock timeout") for anyone else.
2. **STILL OUTSTANDING (since 2026-10-21):** run **`setupHomeTab()` in `apps-script/Code.js`**, set `RSVP_DEADLINE` in `index.html`, and confirm deleting the legacy `admin.html` together with the `?key=` branch in `doGet`.
3. **Settings tab:** confirm the Invite link (`https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/`) and the Envelope image link (`https://bnamarketing.github.io/Smoke-Signal-RSVPs/smoke-signals-invite.gif`).
4. **Event night:** charge the check-in device, sign it in at the `/exec` link, and print a backup list (RSVPs → Download Excel).

---

## Standing invariants (carry forward)

- Public repo: no secrets and no guest data in committed files. The password is the Script Property `ADMIN_PASSWORD`.
- A backend change = `clasp push` + a new version of the **existing** deployment `AKfycby2Ftp…960`. The URL must not change.
- RSVP fields `first, last, email, role, company, attending` are a contract between `index.html` and `doPost`.
- RSVPs never wait on the script lock; all other code holds it only briefly, via `withScriptLock_`. Regression check: `node tests/lock_test.js` must print `16/16 passed`.
- `node --check apps-script/Code.js` before every push.

---

## Wiring status

| Item | Status |
|---|---|
| Backend: `apps-script/`, with `.clasp.json` → Sheet-bound script (`1S408C1h…T42eN`) of the Sheet "AFCEA TechNet RSVPs 2026" | Live, **v10** (2026-10-30) |
| `ADMIN_PASSWORD` in Script Properties | Done (owner) |
| Back office | Standalone at the `/exec` link (`Admin.html`). Owner login verified on v4; v5–v10 tested with the fake-data harness only |
| Invite page (`index.html`) | Live on GitHub Pages, wired to `/exec`; retries x3; "6:00 PM CT" |
| Legacy `admin.html` + `doGet ?key=` branch | Still live; pending the owner's OK to delete |
| Team Home tab (`setupHomeTab`) | Not confirmed as run |
| Printed card QR | **Done** (owner, verified 2026-10-30): the printed card's QR opens the GitHub invite, and the owner's RSVP went through end to end. The repo copy `Smoke-Signal-RSVPs/smoke-signals-card-back.png` still has the old artifact QR; it's an outdated file only, and doesn't affect the printed cards |
| RSVP deadline | Unset (owner to supply) |
| Settings tab links | Unconfirmed |
| Outlook sending | Not built; waiting on IT's recommendation |

---

## Open issues / risks

- RSVPs that failed before v10 were never saved. They can't be recovered, so those guests must resubmit.
- A retried RSVP can leave a duplicate row in the RSVPs tab, if the first attempt saved but the reply was lost. The back office merges duplicates by email, and Delete removes all of them.
- Excel download inside Google's sandboxed frame is untested. CSV is the fallback.
- TechNet backend (`B-A-AFCEA-TechNet-RSVPs`): location unknown.
- "Claude version" of the back office (the Smoke Signals Invite artifact → Host back office, PIN) works independently of this repo.

---

## Architecture notes worth remembering

- `authed_()` refuses empty or `"CHANGE-ME"` passwords, sleeps 800 ms on a failure, and pauses all logins after 10 failures in 15 minutes (CacheService).
- Every public server function can be called through `google.script.run` by anyone viewing the page. That's why menu functions start with `sheetOnly_()` and `setupHomeTab` with `ownerOnly_()`.
- Locks: `doPost` (guest RSVP) appends with no lock. `sendRows_` serializes on the document lock and stamps each guest under a brief script lock, after re-finding the row with `currentGuestRow_`. `autoRun` relies on the same locking.
- Guests and RSVPs screens both read `people()`, which merges the Guests, RSVPs and Check-in tabs, then filter it differently. Email status is worked out in this order: replied → never sent → not reminded → reminded.
- UI checks without the real Sheet: `python tests/build_admin_harness.py`, then serve `tests/out/` (password `test`).

---

## Recent significant changes

| Date | Session | Outcome |
|---|---|---|
| 2026-10-30 | Sync verification | GitHub (3 repos, all branches), the Apps Script editor copy and the live sites all match the repo; versions 3–10 are all accounted for; the only commit not from a Claude session is `8c378c4 pngs` (4 images). Printed card QR verified by the owner. |
| 2026-10-30 | Standalone back office → redesign → RSVP fix | Back office moved into Apps Script (v4), redesigned (v5); delete guests (v6); Guests/RSVPs split (v7); Home finder (v8); "CT" labels (v9); RSVP lock fix with a retrying invite page (v10). Tests promoted to `tests/`. |
| 2026-10-21 | Claude Code setup | Added CLAUDE.md + docs; backend into `apps-script/` via clasp; admin password moved to Script Properties; clasp repointed to the Sheet-bound script; v3. |
