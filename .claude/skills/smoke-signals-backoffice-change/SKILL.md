---
name: smoke-signals-backoffice-change
description: >-
  Rules and test loop for changing the Smoke Signals back office or its server (apps-script/Admin.html, apps-script/Code.js): how the page reaches the server through adminApi and google.script.run, which server functions must be private or guarded, the locking rule that keeps guest RSVPs from failing, how a new screen or action is wired, and testing against fake data before deploy. Trigger on "add a button/screen/filter to the back office", "change what Guests or RSVPs shows", "add a server action", "the back office is slow or busy", or "RSVPs aren't going through". Skip for invite-page-only edits (index.html) and for shipping, which is smoke-signals-deploy.
---

# Smoke Signals back office change

Defers to `architectural-walkthrough` for anything non-trivial and `surgical-patch` for each edit;
this skill holds what is specific to this app.

## How it fits together

- `Admin.html` is served by `doGet` (bare `/exec`, no `?key=`). Every data call is
  `call(action, extra)` → `google.script.run.adminApi(KEY, action, extra)` → `action_()` switch in `Code.js`.
- The server returns `{ ok, result, data }`; `data` is a fresh `snapshot_()`, and the page re-renders
  from it. The page never patches state by hand after a write.
- Every screen renders from `people()`, which merges the Guests, RSVPs and Check-in tabs into one row
  per person, keyed by lower-case email (`n:first last` for guests without one, the walk-in key for walk-ins).
  Screens **filter** `people()`; they don't fetch their own data. Guests = `onList`; RSVPs = `reply`.

## Rules

1. **Private by default.** Every top-level server function whose name doesn't end in `_` can be called by
   *any* visitor to the page through `google.script.run`, without the password. New helpers end in `_`.
   The only public ones: `doGet`, `doPost`, `adminApi`, the `autoRun` trigger, Sheet-menu items (first
   line `sheetOnly_();`) and owner-run setup (first line `ownerOnly_();`).
2. **New action = three places.** A `case` in `action_()` in `Code.js`, a client call through `apiPost`
   in `Admin.html`, and a fake in `tests/admin_stub.html` so the harness can exercise it.
3. **Locking.** Guest RSVPs (`doPost`) never wait on the script lock. Everything else takes it only
   through `withScriptLock_` and holds it for seconds. Never wrap a loop that sends email or calls an
   outside service in the script lock; `sendRows_` shows the pattern: a document lock for one-send-at-a-time,
   the script lock per guest, the row re-found with `currentGuestRow_` before writing.
   > Gotcha: a `waitLock` outside `try` in `doPost` crashed RSVPs while a bulk send held the lock, and
   > guests saw "Check your connection" (2026-10-30). `tests/lock_test.js` guards this.
4. **Keep the element IDs** that the script uses (`$("…")`). When a screen changes, update the `show()`
   view list and the nav `data-v` together.
5. **Plain-language UI.** Statuses use the words already in use: Coming, Can't make it, Needs invite,
   Needs reminder, Replied, Here. Any destructive action goes through `confirmBox` and says what it removes.
6. **Public repo.** Nothing secret in `Admin.html` or `Code.js`; settings live in the Settings tab or
   Script Properties.

## Test loop (before deploying)

```bash
cd apps-script && node --check Code.js
python - <<'PY'            # syntax-check Admin.html's script block
import re,io; s=io.open("Admin.html",encoding="utf-8").read()
io.open("/tmp/admin_client.js","w",encoding="utf-8").write("\n".join(re.findall(r'<script>(.*?)</script>',s,re.S)))
PY
node --check /tmp/admin_client.js
cd .. && node tests/lock_test.js | tail -1      # N/N passed
python tests/build_admin_harness.py             # writes tests/out/admin.html
```

Serve `tests/out/` (the `.claude/launch.json` entry, or `python -m http.server 8765 --directory tests/out`),
sign in with password `test`, and check:

- the changed screen at **1280×820** and at **375 px** (no sideways scroll: `scrollWidth === innerWidth`);
- the changed action, end to end (count changes, toast shows);
- **no console errors**.

The harness can't test the real Sheet, the Excel download inside Google's frame, or real server code
(that's what `tests/lock_test.js` is for). Say so when reporting. Then ship with `smoke-signals-deploy`.
