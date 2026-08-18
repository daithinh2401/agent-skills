---
name: delegation-orchestration
description: Defines the contract between an orchestrating agent and its implementation subagents — model tiering, spawn prompts, evidence-based "done", and verification without re-doing the work. Use when dispatching implementation work to subagents, when preparing task cards for a milestone, when subagent output keeps needing re-work or re-spawns, or when main-model token spend on bulk implementation is growing.
---

# Delegation & Orchestration

## Overview

The contract between an orchestrating agent and its implementation subagents: who runs on which model, what a spawn prompt must contain, what "done" means, and how the orchestrator verifies without re-doing the work. Every rule here traces to an observed failure mode; none are speculative.

**Scope split (one source per rule):** this skill owns the *delegation contract*. Multi-agent *topology* (fan-out, pipelines, router anti-patterns) belongs to the shared [`orchestration-patterns`](../../references/orchestration-patterns.md) reference — defer to it for how agents are wired together. For a heavier per-task variant that adds a two-stage review around each subagent, run the loop under a review skill such as [code-review-and-quality](../code-review-and-quality/SKILL.md) on high-risk milestones.

## When to Use

- Any implementation task is about to be dispatched to a subagent
- Writing task cards at milestone start (rolling-wave planning)
- A subagent returned work that failed verification, or you're about to re-spawn one
- Reviewing why delegation is burning tokens or requiring repeated prompts

**When NOT to use:** trivial glue fixes where writing the spec would cost more than writing the code — do those inline, but treat them as the exception.

## Model tiering

| Work | Tier |
|---|---|
| Mechanical: doc formatting, config transforms, bulk renames | cheapest model (e.g. Haiku) |
| Implementation, refactors, standard reviews, research/harvest | mid model (e.g. Sonnet) |
| Specs, phase gates, cross-cutting decisions, debug handoffs, final verification | orchestrator — never delegated |

The orchestrator never implements in bulk. Its jobs: write the contract, spawn, unblock, verify evidence, gate the commit.

## The spawn contract

A subagent session is **fresh**: it auto-loads the project's rules files and hooks, but **never sees the orchestrator's chat history**. Everything else must arrive via (a) repo files or (b) the spawn prompt.

0. **State file first.** Keep a cross-session state file (e.g. `tasks/state.md`): current position, owner-confirmed facts from conversation, environment notes, open items. Read it when resuming in a fresh session; update it at every checkpoint, blocker, and session end. Statuses live in the task checklist; the state file carries the narrative that files otherwise miss.
1. **Card file first.** At milestone start, write one card per task in `tasks/cards/<TASK-ID>.md` (template below). The spawn prompt becomes: pointer to the card + env-facts + deltas. Files beat prompt text: reusable across resumes, owner-reviewable, survive context compaction, re-readable mid-task.
2. **Cite rules, don't paste them.** Name the 3–5 project rules this task can violate, each with a one-line restatement. Full rule text stays in the project's rules files (the subagent auto-loads them); the citation anchors attention. Pasting whole rulebooks dilutes attention and creates drift.
3. **Point at the pattern.** Reference the project's pattern doc and real reference-implementation files — "copy this, don't improvise."
4. **Env-facts block.** Maintain the project's environment facts (service URLs/ports, gate commands, known machine quirks and their workarounds, commit-hook requirements) in the state file, and paste that block verbatim into every implementation spawn. Agents rediscovering the environment is pure token waste.
5. **Pin API assumptions.** If the task touches a fast-moving or unfamiliar library, put version-pinned API notes or verified snippets in the card, and instruct the agent to confirm against the installed package's types before coding — never from memory.

## Card template (`tasks/cards/<TASK-ID>.md`)

```markdown
# <TASK-ID> — <title>
## Goal            — 2-3 sentences; which plan item this executes
## Binding rules   — rule IDs + one-liners; pattern doc + reference files
## Steps           — numbered, with code snippets for anything non-obvious
## Acceptance      — evidence-based: "DONE means: run <exact command>, observe <exact output/state>".
##                   Synthetic substitutes are FORBIDDEN — real service/device/pipeline, or STOP and report.
## Verify          — gate commands to run before committing
## Commit          — exact message (project conventions, trailers)
## Out of scope    — what NOT to touch
```

## Execution protocol

- **STOP conditions in every prompt:** "if an API mismatches expectations, a verification fails without an obvious fix, or the environment blocks you — STOP and report; never improvise around a broken assumption, never fight machine state." The orchestrator owns the environment; the agent owns the task.
- **Resume over respawn, where the platform allows it.** If your agent runtime can message an existing agent, send follow-ups there — its transcript persists, so a fix costs a delta, not a re-brief. If subagents are one-shot (they terminate after returning), the card is what makes a respawn cheap: update the card, then point the new agent at it instead of re-briefing from scratch.
- **One committer per working tree.** Two agents committing into the same tree race the git index, so parallel spawns sharing a checkout must be read-only (reviews, research). To parallelize *writing*, give each agent its own git worktree — see [git-workflow-and-versioning](../git-workflow-and-versioning/SKILL.md#working-with-worktrees) — and merge the branches yourself.
- **Required report format:** verification outcomes (one line each), evidence for each acceptance, commit hash, deviations. Honest deviations are welcome; silent smoothing is a violation.

## Verification pyramid (orchestrator side)

Spot-check only — the agent already ran the gates: (1) commit exists + working tree clean; (2) re-run the 1–2 highest-risk evidence commands yourself; (3) skim the diff for rule smells. Never re-run full gates on unchanged code. Escalate to a reviewer-subagent or a full review pass only at milestone checkpoints or for safety-critical work.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "The top model will just do it faster itself" | Bulk implementation on the top tier is the single largest avoidable spend; the contract exists so cheaper models produce the same output |
| "The acceptance is obvious from context" | An agent under debugging pressure will verify against a synthetic stand-in unless the card names the exact command, the exact observable, and forbids substitutes |
| "The agent can figure out the environment" | It will — by burning tool calls on archaeology the orchestrator already did. Paste env-facts |
| "Easier to respawn than explain" | A resume costs a delta message. If resuming is not available, an updated card still beats a re-brief — the expensive part is re-deriving the context, not re-spawning |
| "I'll just paste the full rulebook to be safe" | Attention dilutes; the 3–5 rules that matter get lost among the ones that don't |

## Red Flags

- A spawn prompt written from scratch when a card file should exist
- Acceptance criteria without an exact command + observable
- An agent debugging Docker/keychain/network state instead of stopping
- Two agents committing into the same working tree at once (no worktree isolation)
- The orchestrator re-running a full gate suite the agent already ran
- Re-briefing from zero when a reachable agent could be messaged, or when an updated card would do

## See Also

- [`orchestration-patterns`](../../references/orchestration-patterns.md) — multi-agent topology (fan-out, pipelines, anti-patterns) this contract sits inside
- [planning-and-task-breakdown](../planning-and-task-breakdown/SKILL.md) — produces the plan items each card executes
- [incremental-implementation](../incremental-implementation/SKILL.md) — the per-slice discipline a subagent follows inside a card
- [git-workflow-and-versioning](../git-workflow-and-versioning/SKILL.md#working-with-worktrees) — worktree isolation, the way to parallelize agents that write
- [documentation-and-adrs](../documentation-and-adrs/SKILL.md) — where environment lessons and recurring traps get recorded

## Verification

Before closing a delegated task:

- [ ] Output verified against the card's evidence-based acceptance (not a paraphrase of it)
- [ ] Commit exists, tree clean, message follows project conventions
- [ ] Deviations reported by the agent were reviewed, not rubber-stamped
- [ ] Any environment lesson learned went into the project's docs (an ADR, a lessons/traps log, or the state file)
- [ ] State file updated if this closed a checkpoint or changed the project's position
