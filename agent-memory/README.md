# agent-memory — session memory files

One file per agent session: `<machine>-<agent>-<task>.md` (e.g. `baba-hermes-analysis.md`).

## Format

YAML header (fenced or front-matter):

```yaml
agent: <agent name>
machine: <machine hostname>
issue: <issue id>
branch: <git branch>
status: <in-progress | blocked | done>
updated: <UTC ISO-8601 timestamp>
```

## Sections (in this order)

1. **Understanding** — what the task is, scope boundaries, key repo facts.
2. **Decisions & why** — choices made during the session and their rationale.
3. **Files changed** — every file created/modified, with purpose.
4. **Tests & evidence** — commands run + actual output tails (pass/fail counts).
5. **Open issues** — unresolved questions, blockers, unverified claims.
6. **Handoff** — self-sufficient next steps for a fresh session resuming this work.

Checkpoints are written at every milestone (session start, after install/tests,
after each review section, before exit). The final file is committed and pushed
on the task branch.
