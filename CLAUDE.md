# Schedule App: Orchestrator Rules

The approved spec is `docs/superpowers/specs/2026-10-03-calendar-and-agent-workflow-design.md`. It is the source of truth. If work needs to deviate from it, stop and ask the owner; do not decide silently.

The owner reviews only at checkpoints and hard stops (below). Between those, the orchestrator runs rounds on its own.

## Team

Agent definitions live in `.claude/agents/`: `design-agent`, `backend-agent`, `frontend-agent`, `spec-reviewer`, `ux-reviewer`. The orchestrator is the main session.

## File ownership

| Area | Owner |
|---|---|
| `server/` | backend-agent |
| `client/my_scheduler/src/` (except `styles/`) | frontend-agent |
| `client/my_scheduler/src/styles/`, `client/my_scheduler/design/` (mockups, screenshots, design notes) | design-agent |
| `docs/`, `CLAUDE.md`, `.claude/` | owner (changed only with the owner's approval) |
| Reviewers | read-only everywhere |

Two agents never edit the same file. Implementers work in separate git worktrees (under `.worktrees/`, one per agent) on separate branches (`agents/backend`, `agents/frontend`, `agents/design`). `Calender-dev` is the integration branch: a round's branches are merged into it only after the round gate passes, and each agent starts its next round by merging `Calender-dev` into its own branch.

## A round

1. Dispatch the implementer agents that have independent tasks in parallel, each with a precise task, the files it owns, and the spec sections that apply.
2. When they report, dispatch `spec-reviewer` (and `ux-reviewer` for anything visible).
3. Fix flagged items by re-dispatching the owning implementer, not by editing their files directly.
4. Round gate: server and client tests pass (run them, do not trust reports) and the app starts.
5. Merge the round's branches into the working integration branch only after the gate passes. If no checkpoint or hard stop applies, start the next round.

## Checkpoints (stop and report to the owner)

- **CP1:** tokens and a styled static calendar for look approval.
- **CP2:** create, edit, delete, and drag-to-move/resize working end to end with tests and RLS.
- **CP3:** conflicts, zones, work hours, and settings.

At a checkpoint, report: what was built, what the reviewers said, test results, how to see it running, and anything that needs the owner's decision. Then wait.

## Hard stops (stop and ask the owner immediately)

- An agent has failed the same problem 5 times.
- Two agents disagree and the spec does not settle it.
- A change would alter the spec.
- An action needs authority listed under "Needs owner approval".

## Needs owner approval

Pushing to any remote; merging to the main line; installing dependencies not named in the plan; spending money or using paid services; deleting data or branches; changing the spec, this file, or the agent definitions.

## Commits

Agents commit small, to their own branches. Commit messages end with the attribution line the harness provides.

## Honesty

Report test results and gaps exactly as they are. Never describe work as done or passing without having run the check in the same round.
