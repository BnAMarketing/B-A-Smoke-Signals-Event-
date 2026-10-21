# Session Handoff — Claude Code setup + clasp

**Session date:** 2026-10-21
**Session focus:** Onboard the repo to Claude Code and bring the Apps Script backend under version control.
**Outcome:** CLAUDE.md + docs landed; backend under clasp, pointed at the Sheet-bound script; admin password in Script Properties; web app deployment updated to v3 and answering cleanly.
**Next session focus:** Confirm this is the production Sheet, then wire `/exec` into both HTML files.

## What shipped

- `CLAUDE.md` — orientation, layer routing, invariants, clasp commands.
- `docs/SmokeSignals_CurrentState.md`, this handoff.
- `apps-script/` — `Code.js`, `appsscript.json`, `.clasp.json` cloned from script `10I_SDmo…zhw-` (marketing.bna2026). That project turned out to be standalone (the doGet error); `.clasp.json` was repointed to the Sheet-bound "RSVP TEST" (`1S408C1h…T42eN`), pushed, and deployment `AKfycby2Ftp…960` updated to version 3.
- `Code.js`: `ADMIN_PASSWORD` now read from Script Properties; `authed_()` also rejects an empty password. Why: the repo is public.

## Outstanding (carry forward)

1. Owner: test back-office login with the new password.
2. Confirm "RSVP TEST" is the production Sheet, then wire `/exec` into `index.html` / `admin.html`.
3. Trash the stray standalone "Untitled project".

## Files touched this chat

`CLAUDE.md`, `docs/*`, `apps-script/*`

## Opening prompt for next session

```
Smoke Signals repo: Claude Code scaffold + clasp are set up (see docs/SmokeSignals_CurrentState.md). Backend is live on deployment v3 and the password is in Script Properties. Next: wire the /exec URL into index.html and admin.html, then walk me through a test invite send.
```
