# Smoke Signals emails

**Live copy: Power Automate.** The invitation and reminder emails are sent by Power Automate flows,
not by the Apps Script back office. The files here are **reference copies**, kept so the HTML is
version-controlled. When a flow's HTML changes, paste the new version over the matching file here.
Swap any real guest name for the placeholder before committing: this repo is public.

## Current (as of 2026-11-02)

| File | Flow | What | Codes the flow fills |
|---|---|---|---|
| `power-automate-invite-body.html` | AFCEA TechNet Invites | The invitation as sent: "Personal invitation for [name]", envelope, "Open invitation" button. Links go to the general invite page. | `@{items('For_each')?['First']}`, `@{items('For_each')?['Last']}` |
| `power-automate-reminder-body.html` | Smoke Signals Reminder (a Save As copy of the invite flow) | The reminder: "A friendly reminder.", no names. Both links go to the guest's **personal link**, so the back office can show who opened it. | `@{items('For_each')?['Link']}` |

- The HTML goes in a **Compose** step inside the `For each` loop. The email's Body is the Compose
  Outputs. HTML pasted straight into the Body editor turns into plain text.
- The reminder reads from `Reminder List 2026.xlsx`: the back office's Guests → Not opened →
  Download Excel, with the `Personal link` header renamed to `Link` and the data turned into a table.
- Personal links look like `…/?to=First%20Last&g=<guest ID>`. The guest ID is a hash of the email
  (`guestId_` in `apps-script/Code.js`), never the email itself.

**Images.** Both files load their images from GitHub Pages (no `data:` URIs):

- `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/envelope-closed.png`
- `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/logo-0-ba-white.png`
- `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/logo-3-opentext.png`
- `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/logo-4-netwitness.png`

`envelope-open.png` is also hosted but not used. Don't rename these files: a renamed image breaks
every email already sent. When images are blocked, the email still reads: the heading, message and
button are real text, the envelope has empty alt text on purpose, and the logos have alt text.

## Deliverability

Some recipients bounced with `550 5.7.0 Your message was detected as SPAM` from **Proofpoint**
(`*.pphosted.com`). The likely cause is the `github.io` address in the links and images, plus
automated sending. These emails don't fix that. The fixes need IT: a B&A web address for the invite
(e.g. `events.bna-inc.com`, which means updating every link and image address here) and SPF, DKIM and
DMARC for bna-inc.com. Until then, email bounced guests by hand from Outlook (plain text, reply to RSVP)
and leave them out of the reminder table.

## Older drafts (superseded)

These embed their images as `data:` URIs, which Gmail and some Outlook versions don't show.

| File | What | Placeholders |
|---|---|---|
| `invite-option-A-sealed-envelope.html` | Invitation draft A: sealed envelope teaser | `[First Last]`, `[INVITE LINK]` |
| `invite-option-B-peek-inside.html` | Invitation draft B: "a peek inside" teaser | `[First Name]`, `[INVITE LINK]` |
| `reminder.html` | Reminder as sent 2026-10-30 (links to the general invite) | `[First Last]` |
