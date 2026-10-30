"""Build a local test copy of the back office (apps-script/Admin.html) wired to fake data.

Injects tests/admin_stub.html (a fake google.script.run with 24 sample guests, one RSVP-only
guest and one check-in) ahead of the page script, and writes tests/out/admin.html.
Nothing reaches the real Sheet. The harness password is "test".

Run:   python tests/build_admin_harness.py
       python -m http.server 8765 --directory tests/out      then open http://localhost:8765/admin.html
Pass:  prints "wrote tests/out/admin.html".
Blind spots: the stub fakes only snapshot, checkIn, undoCheckIn, setTask, walkIn, removeGuest,
deleteGuests and sendReminders; other actions return ok with no data change. Excel download
inside Google's sandboxed frame, and real server code, are not exercised (see tests/lock_test.js).
"""
import io, os, sys

root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
page = io.open(os.path.join(root, "apps-script", "Admin.html"), encoding="utf-8").read()
stub = io.open(os.path.join(root, "tests", "admin_stub.html"), encoding="utf-8").read()
anchor = "<script>\n/* Served by Apps Script"
if anchor not in page:
    sys.exit("anchor not found in Admin.html: the page script's first line changed")
os.makedirs(os.path.join(root, "tests", "out"), exist_ok=True)
io.open(os.path.join(root, "tests", "out", "admin.html"), "w", encoding="utf-8").write(page.replace(anchor, stub + anchor, 1))
print("wrote tests/out/admin.html")
