# Notes for the global skill library

Lessons from this repo that belong in **global** skills. The global skills are synced from the
Claude-Skills-Solo repo, which Claude must not edit, so they wait here. Move each one in by hand
(or in a session where that repo is in scope), then mark it **Moved** with the date.

| # | Target global skill | Lesson (the rule) | Evidence | Status |
|---|---|---|---|---|
| 1 | `appsscript-sheet-modal-app` (or a new `appsscript-locking` skill) | A public `doPost`/`doGet` must never `waitLock` on a lock that admin work can hold. Append-only writes need no lock; take the lock only per row/batch for admin writes, never around a loop that sends email or calls `UrlFetchApp`; keep `waitLock` inside `try`. Re-find rows by key before writing after any unlocked gap. | Smoke Signals 2026-10-30: RSVPs timed out behind a bulk send; guests saw "Check your connection". Fix and test: `apps-script/Code.js` (`withScriptLock_`, `currentGuestRow_`), `tests/lock_test.js` | Open |
| 2 | `appsscript-sheet-modal-app` | Every public server function can be called through `google.script.run` from any page the project serves, including by anonymous web app visitors. Guard Sheet-menu functions (e.g. `getUi()` throws outside the Sheet) and owner-only setup (active user email === effective user email). | Smoke Signals 2026-10-21: `turnOnAuto`, `turnOffAuto` and `sendTestEmail` were callable without the password once `Admin.html` was served | Open |
| 3 | `appsscript-sheet-modal-app` | One client error message for every failure hides server faults. Tell "never reached the server" (fetch threw) apart from "server answered but not ok", and retry briefly before showing either. | Smoke Signals 2026-10-30: `index.html` `sendRsvp()` | Open |
| 4 | `session-handoff` | When the session's cwd differs from the repo folder, memory written during the session lands in the cwd's project folder, and `--check-lessons` (run from the repo) can't find it. Write or mirror memory to the repo's project folder. | Smoke Signals handoff 2026-10-30: LESSONS CHECK failed until the memory was mirrored | Open |
| 5 | `session-handoff` | The "load `skill-enhance-from-session`" step was skipped when the only fitting global skill was off-limits. Repo-specific skills (`.claude/skills/`) are always an allowed destination, so the review never has "nowhere to go". | Owner's correction, 2026-10-30 | Open |
