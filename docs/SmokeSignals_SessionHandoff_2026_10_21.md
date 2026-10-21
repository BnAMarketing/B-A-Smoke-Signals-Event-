# Session Handoff — Claude Code setup + clasp

**Session date:** 2026-10-21
**Session focus:** Onboard the repo to Claude Code and bring the Apps Script backend under version control.
**Outcome:** CLAUDE.md + docs scaffold landed; backend cloned into `apps-script/` and pushed back with the admin password moved to Script Properties.
**Next session focus:** Set the `ADMIN_PASSWORD` property, redeploy a new version, wire `/exec` into both HTML files.

## What shipped

- `CLAUDE.md` — orientation, layer routing, invariants, clasp commands.
- `docs/SmokeSignals_CurrentState.md`, this handoff.
- `apps-script/` — `Code.js`, `appsscript.json`, `.clasp.json` cloned from script `10I_SDmo…zhw-` (marketing.bna2026). **Found afterwards: that project is standalone, not bound to the Sheet, which causes the doGet error.** `.clasp.json` must be repointed to the bound script.
- `Code.js`: `ADMIN_PASSWORD` now read from Script Properties; `authed_()` also rejects an empty password. Why: the repo is public.

## Outstanding (carry forward)

0. Repoint `apps-script/.clasp.json` to the Sheet-bound Script ID and `clasp push`.
1. **[Owner, editor]** Script Properties > `ADMIN_PASSWORD` = new password. Then new deployment version.
2. Paste `/exec` into `index.html` `RSVP_URL` and `admin.html` `API_URL`.
3. Rename the Apps Script project from "Untitled project".

## Files touched this chat

`CLAUDE.md`, `docs/*`, `apps-script/*`

## Opening prompt for next session

```
Smoke Signals repo: Claude Code scaffold + clasp are set up (see docs/SmokeSignals_CurrentState.md). I've set the ADMIN_PASSWORD script property. Next: wire the /exec URL into index.html and admin.html, then walk me through a test invite send.
```
