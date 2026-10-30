---
name: smoke-signals-session-handoff
description: >-
  Close out a session in the Smoke Signals repo: write the dated handoff, update CurrentState and re-point CLAUDE.md (via the generic session-handoff), check the live web app version and run the repo regression test, then ALWAYS run a skill review that ends in a picker to apply skill edits, create new repo skills, or skip. Trigger on "session handoff", "wrap up", "close out", "write the handoff", "end of session", or "do the handoff" in this repo. Skip mid-session and never offer it proactively; skip in other repos (use their own handoff skill or the generic one).
---

# Smoke Signals session handoff

Specializer of the global `session-handoff`: run its three artifacts exactly as it says, plus the
repo-specific steps below. The skill review in step 4 is **mandatory here, every time** — the owner
asked for it after a handoff skipped it (2026-10-30).

## 1. Facts (from the repo root)

```bash
python ~/.claude/skills/session-handoff/scripts/handoff_facts.py
```

Same-day convention for this repo: **UPDATE-IN-PLACE.** If `docs/SmokeSignals_SessionHandoff_<today>.md`
exists, append a `## Later session — <topic>` block; never a second file for the same date.

## 2. Repo validation (paste the summary lines verbatim into the handoff's Validation section)

```bash
node tests/lock_test.js | tail -1          # pass: "16/16 passed" (or the current total, all passing)
/c/Users/taluu/AppData/Roaming/npm/clasp list-deployments    # run from apps-script/; note the @N on AKfycby2Ftp…960
```

The live version number (`@N`) goes in the handoff header and CurrentState's wiring table. Anything
not run this session is written as **not run**, never as passing.

## 3. The three artifacts

Follow `session-handoff` for the handoff doc, `docs/SmokeSignals_CurrentState.md` and the CLAUDE.md
`@`-import. Repo specifics:

- **Outstanding user actions** name the file and the editor link, e.g. **`setupHomeTab()` in
  `apps-script/Code.js`** (editor: `https://script.google.com/d/1S408C1hKN9gFPLRK1_I26GDen5ANN8csZfM6CSMFzXqrXZAmenhT42eN/edit`).
- Anything still outstanding from the previous handoff goes at the **top**, marked
  `STILL OUTSTANDING (since YYYY-MM-DD)`, and is repeated in the opening prompt.
- The event date drives priority: keep "days until Nov 4" in Pinned focus while the event is ahead.

## 4. Skill review — mandatory, ends in a picker

Load `skill-enhance-from-session` and sweep the whole session (the user's corrections, picker answers
that overruled a recommendation, steps they had to ask for, anything done by hand twice or more).
Sort each finding into exactly one bucket:

| Bucket | Where it goes |
|---|---|
| Edit an existing **repo** skill | `.claude/skills/<name>/SKILL.md` in this repo |
| **Create a new repo skill** — a workflow done by hand 2+ times, or a rule broken twice | `.claude/skills/<new-name>/SKILL.md` in this repo |
| A lesson for a **global** skill | append to `docs/GlobalSkillNotes.md` — **never** edit `~/.claude/skills/` or the Claude-Skills-Solo repo (off-limits) |
| A user preference not tied to this repo | memory (and mirror it, see below) |
| One-off | the handoff only |

Before proposing, grep `.claude/skills/`, `docs/GlobalSkillNotes.md` and `MEMORY.md` so nothing is added twice.

**Always show the picker** (`AskUserQuestion`): one question per proposed edit/creation, `Apply
(Recommended)` / `Skip`, the consequence in each description, max four per round (say what was held
back). If the sweep found nothing new, still ask one question — "No new skill changes found. Capture
anything?" with `Nothing to add (Recommended)` / `I have one` — so the gate is never silent.

Then tag every Process lessons bullet `[→ dest]` and gate it:

```bash
python ~/.claude/skills/session-handoff/scripts/handoff_facts.py --check-lessons   # must end LESSONS CHECK: PASS
```

> Gotcha: sessions run from the parent "Github Repo" folder save memory under a different project
> folder than sessions run inside this repo. A memory written from the parent must also be copied to
> `~/.claude/projects/C--Users-taluu-OneDrive-Documents-Github-Repo-B-A-Smoke-Signals-Event-/memory/`
> (file + its `MEMORY.md` line), or the lessons check — and the next repo session — won't see it.

## 5. Commits and reply

- Suggest commits, don't run them: skill files first (`chore(skills): …`), tests next, docs + handoff last.
- End the reply with the **chat name** and the **opening prompt**, each in its own fenced block.
