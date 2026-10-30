---
name: smoke-signals-deploy
description: >-
  Ship a Smoke Signals change to production. Backend and back-office changes (apps-script/Code.js, Admin.html) get the pre-push checks, clasp push, and an update to the ONE existing web app deployment so the /exec URL never changes, plus live probes that save no data; invite-page changes (index.html) get pushed to GitHub Pages and polled until actually live. Trigger on "deploy", "push it", "redeploy", "new version", "make it live", "is it live yet", or "my change isn't showing". Skip for local-only edits not ready to ship, and for other repos.
---

# Smoke Signals deploy

Two targets, two paths. Most changes touch only one; do both when both changed.

| Changed | Target | Path |
|---|---|---|
| `apps-script/Code.js`, `apps-script/Admin.html`, `appsscript.json` | Apps Script web app | A |
| `index.html`, images at the repo root | GitHub Pages | B |

## A. Apps Script (backend + back office)

```bash
cd apps-script
node --check Code.js                       # syntax
node ../tests/lock_test.js | tail -1       # must print "N/N passed"
C=/c/Users/taluu/AppData/Roaming/npm/clasp # PowerShell can't resolve `clasp`; use Git Bash + this path
$C push
$C update-deployment AKfycby2FtpOHPbhLHu-R9KxTyvHYjgf435FB92YW_bnlOW1DxCHFmZghKf1-nTAHnJG960 -d "<what changed>"
```

For an `Admin.html` change, also syntax-check its script block and run the harness
(see `smoke-signals-backoffice-change`) **before** pushing.

**Never** `clasp deploy` without the ID, and never create a new deployment: a new deployment is a new
`/exec` URL, which breaks `index.html` and every teammate's bookmark. The `@N` printed by
`update-deployment` is the new live version — record it in `docs/SmokeSignals_CurrentState.md`.

**Live probes** (none of these save data or use up a login try):

```bash
U=https://script.google.com/macros/s/AKfycby2FtpOHPbhLHu-R9KxTyvHYjgf435FB92YW_bnlOW1DxCHFmZghKf1-nTAHnJG960/exec
curl -sL "$U?v=$RANDOM" | grep -o "<title>[^<]*"   # expect: Smoke Signals Back Office
curl -sL --data "first=probe" "$U"                  # expect: missing  (no email = rejected, nothing saved)
```

> Gotcha: don't probe with `?key=wrong` — every wrong key counts toward the 10-tries lockout that pauses
> all logins for 15 minutes.
> Gotcha: `curl -L -X POST` re-POSTs after Google's 302 and returns a fake `411`; use `--data` without
> `-X POST`, which follows the redirect the way browsers do.
> Gotcha: if a browser shows `{"ok":false,"error":"unauthorized"}` at the bare link after a deploy, it's a
> cached redirect — hard refresh (Ctrl+F5) or add `?v=1`. A fresh `curl` is the source of truth.

## B. GitHub Pages (invite page)

Pushing to `main` publishes (public repo `BnAMarketing/B-A-Smoke-Signals-Event-`). Confirm the user wants
it live, commit, push, then **wait for the change to actually serve** — Pages lags 30–90 s:

```bash
for i in 1 2 3 4 5 6 7 8; do curl -s "https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/?n=$i$RANDOM" | grep -q '<unique string from your change>' && { echo "live after try $i"; break; }; sleep 15; done
```

Don't report a Pages change as live until this loop says so.

## After either path

- Commit with the deployed version in the message body when it's a backend deploy.
- Tell the user the version (`@N`), what's verified live, and what isn't (e.g. "not tested against the
  real Sheet").
