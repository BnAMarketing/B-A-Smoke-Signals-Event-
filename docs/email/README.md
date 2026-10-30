# Smoke Signals emails

**Live copy: Power Automate.** The invitation and reminder emails are sent by a Power Automate flow,
not by the Apps Script back office. The files here are **reference copies**, kept so the HTML is
version-controlled. When the flow's HTML changes, paste the new version over the matching file here.
Swap any real guest name for the placeholder before committing: this repo is public.

| File | What | Placeholders the flow fills |
|---|---|---|
| `invite-option-A-sealed-envelope.html` | Invitation draft A: sealed envelope teaser | `[First Last]`, `[INVITE LINK]` |
| `invite-option-B-peek-inside.html` | Invitation draft B: "a peek inside" teaser | `[First Name]`, `[INVITE LINK]` |
| `reminder.html` | Reminder (as sent 2026-10-30; links to the GitHub invite) | `[First Last]` |

Which invitation option the flow actually sends: **[owner to confirm]**.

**Images.** All three files embed their images as `data:` URIs. Gmail and some Outlook desktop
versions don't display those. The same images are hosted on GitHub Pages and can replace the
`data:` sources if needed:

- `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/envelope-closed.png`
- `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/envelope-open.png`
- `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/logo-0-ba-white.png`
- `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/logo-3-opentext.png`
- `https://bnamarketing.github.io/B-A-Smoke-Signals-Event-/logo-4-netwitness.png`

Not renaming these files matters: a renamed image breaks every email already sent.
