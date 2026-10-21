# Smoke Signals — B&A after-hours event: RSVP page, back office, Apps Script backend

Invite + RSVP site and host back office for **Smoke Signals: An evening after hours with B&A**
(AFCEA TechNet Rocket City, Wed Nov 4 2026, 6:00 PM CT, Vintage Cigar Lounge, Huntsville AL, 21+).
The public invite is on GitHub Pages; the **back office is its own site served by Apps Script** (the
web app `/exec` link, password login). Both run on one Apps Script project bound to the Google Sheet
"AFCEA TechNet RSVPs 2026", owned by **marketing.bna2026@gmail.com**.

This file is loaded into context at every Claude Code session start. Its @-imports are binding — read them before proposing any change.

## Canonical reference docs (read on session start)

If sources conflict, `CLAUDE.md` wins for structure / invariants; the state doc wins for "what's in flight."

@docs/SmokeSignals_CurrentState.md

## Latest session handoff

Replace this path with the newest handoff at the end of each session that ships material changes.

@docs/SmokeSignals_SessionHandoff_2026_10_21.md

## Quick orientation

- **Front end**: plain HTML/CSS/JS, no build step, served by GitHub Pages from `main` (public repo `BnAMarketing/B-A-Smoke-Signals-Event-`). Pushing to `main` = publishing.
- **Backend**: `apps-script/Code.js` (V8), synced with clasp. Script ID in `apps-script/.clasp.json`.
- **Data**: the bound Google Sheet — tabs `RSVPs`, `Guests`, `Settings`, `Check-in`, `Tracker` (created by the "Smoke Signals > Set up guest list" menu).
- **Images for emails**: hosted in the sibling repo `BnAMarketing/Smoke-Signal-RSVPs`.

## Layer routing

| Layer | Primary files | What lives here |
|---|---|---|
| Guest page | `index.html` | Invite, RSVP form (POST form fields to `RSVP_URL`), add-to-calendar links, localStorage prefill |
| Back office | `apps-script/Admin.html` | Host dashboard served by `doGet` (no `?key=`). Calls `adminApi(key, action, extra)` via `google.script.run`; password checked server-side on every call |
| Legacy back office | `admin.html` | Old GitHub-hosted copy using `?key=` JSON. **Pending deletion** once the Apps Script one is confirmed; then remove the legacy branch in `doGet` |
| Backend | `apps-script/Code.js` | `doGet` (serves Admin.html), `adminApi`, `doPost` (guest RSVP), Sheet tabs, invite/reminder email, Sheet menu |
| Manifest | `apps-script/appsscript.json` | Runtime V8, web app: execute as deployer, access anyone |

**Anti-patterns**: changing a field name in one HTML file without the matching `p.<field>` / `action_` case in `Code.js`; editing Sheet column order without updating `HEADERS` / `G_HEAD` / `C`; fixing a backend bug by editing only the online editor (repo drifts from Apps Script).

## Standing invariants

- **No secrets in this repo — it is public.** The back-office password lives in Script Properties (`ADMIN_PASSWORD`). Never write a password, API key or personal guest data into a committed file.
- **Backend change = push + new version of the existing deployment.** `clasp push` updates HEAD only; the live `/exec` URL keeps serving the old version until Deploy > Manage deployments > edit > New version. Never create a *new* deployment (new URL breaks both HTML files).
- **The RSVP contract is shared**: form fields `first, last, email, role, company, attending` are read by `doPost`. Change both sides together.
- **Pre-push check**: `node --check apps-script/Code.js` before any `clasp push`.
- **Every public server function is callable from the back office page** via `google.script.run`, without the password. New server functions end in `_` unless they are `adminApi`, `doGet`/`doPost`, a trigger, or a Sheet-menu item. Menu items start with `sheetOnly_();`.
- Login lockout: 10 wrong passwords (from anyone) in 15 min pause all logins (`authed_`, CacheService).
- Suggest commits; push to `main` only when the user says to (it publishes the live page).

## Clasp

clasp 3.x is installed globally and logged in as marketing.bna2026@gmail.com. In PowerShell the
`clasp` command may not resolve; use `C:\Users\taluu\AppData\Roaming\npm\clasp.cmd` or Git Bash.

```bash
cd apps-script && clasp pull   # Apps Script -> repo
cd apps-script && clasp push   # repo -> Apps Script HEAD (then redeploy a new version)
```

## Skills

User-global skills that fit this repo:

| Skill | When |
|---|---|
| `architectural-walkthrough` | Any non-trivial change. Runs first. |
| `surgical-patch` | Any single edit. |
| `appsscript-schema-cascade` | Adding/renaming a Sheet column or guest field. |
| `appsscript-oauth-scopes` | Authorization errors after adding a service (e.g. Gmail/Mail scopes). |
| `appsscript-editor-action` | Asking the user to run a function in the Apps Script editor. |
| `anthropic-skills:ba-brand-kit` | Any visual/copy change — B&A brand. |
| `session-handoff` | End of a session that shipped changes. |

## Common pitfalls

1. Forgetting the redeploy step — "I pushed but nothing changed."
2. `index.html` uses form-encoded POST; `admin.html` uses `text/plain` JSON (avoids a CORS preflight Apps Script can't answer). Don't switch either to `application/json`.
3. `clean_()` prefixes `= + - @` to stop formula injection in the Sheet — keep it on every user-supplied value.
4. Event times in `index.html` are UTC (`20261105T000000Z` = 6 PM CST Nov 4).
5. The `DEFAULT_SETTINGS` links still say `YOURNAME.github.io` — real values live in the Sheet's Settings tab.

## File inventory

- `index.html` — guest invite + RSVP
- `admin.html` — legacy back office (to be deleted)
- `apps-script/Code.js`, `apps-script/Admin.html`, `apps-script/appsscript.json`, `apps-script/.clasp.json` — backend + back office
- `docs/` — current state + session handoffs
