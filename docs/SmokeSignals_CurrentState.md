# Smoke Signals — Current Project State

Running snapshot of where this project is *right now*. Updated at the end of every session that ships material changes.

---

## Pinned focus

Event is **Wed Nov 4 2026** — two weeks out as of 2026-10-21. Next-session candidates, in order:

0. **Repoint clasp at the Sheet-bound script.** `apps-script/.clasp.json` currently points at a *standalone* "Untitled project" (`10I_SDmo…zhw-`, no parentId). Standalone scripts get `null` from `getActiveSpreadsheet()`, which is the `doGet` error. Get the real Script ID from the "Smoke Signals RSVPs" Sheet > Extensions > Apps Script > Project Settings, put it in `.clasp.json`, `clasp push`. Then trash or ignore the stray project.
1. **Finish the password move (editor actions, owner only):** in the Apps Script project, Project Settings > Script Properties > add `ADMIN_PASSWORD` (pick a new one — the old value sat in a plain file). Then Deploy > Manage deployments > edit > Version: New version > Deploy.
2. **Wire the live URLs:** paste the web app `/exec` URL into `RSVP_URL` (`index.html`) and `API_URL` (`admin.html`); set `RSVP_DEADLINE` if wanted.
3. **Settings tab:** set "Invite link" (this repo's Pages URL) and "Envelope image link" (`Smoke-Signal-RSVPs` Pages URL for `smoke-signals-invite.gif`).
4. Send a test invite (Sheet menu) before the real send.

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
| Backend in repo (`apps-script/`) via clasp | Done 2026-10-21 |
| `ADMIN_PASSWORD` moved to Script Properties (code) | Done in repo; pushed only to the stray standalone project, not yet to the bound one |
| `.clasp.json` points at the Sheet-bound script | **No — needs the bound Script ID** |
| `ADMIN_PASSWORD` property set + new version deployed | **Owner to do** |
| `RSVP_URL` / `API_URL` in HTML | Placeholder |
| Settings tab links | Unknown — check the Sheet |

---

## Open issues / risks

- Until the property is set, a redeploy would lock everyone out of the back office (fails closed — safe, but confusing).
- The Apps Script project is named "Untitled project" — rename it in the editor so it's findable.
- The doGet error seen in the GitHub back office = the standalone-project problem above.
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
| 2026-10-21 | Claude Code setup | Added CLAUDE.md + docs; pulled backend into `apps-script/` with clasp; moved admin password out of code. |
