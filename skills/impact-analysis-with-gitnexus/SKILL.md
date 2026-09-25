---
name: impact-analysis-with-gitnexus
description: Runs an impact analysis on a GitNexus code knowledge graph so specs and plans are grounded in the measured blast radius of a change before any code is written. Use when a spec, plan, or task list is about to be written for a change to an existing codebase, when you need to know who uses a function — which callers, execution flows, or modules a symbol change will break — when a grep-based caller list may be incomplete, when a GitNexus index may be missing or stale, or when a diff must be checked against the planned blast radius before commit or review. Requires the GitNexus MCP server or CLI; without it, the spec and plan skills fall back to manual dependency mapping.
---

# Impact Analysis with GitNexus

## Overview

GitNexus indexes a repository into a knowledge graph — every call, import, execution flow, and functional cluster — so "what breaks if I change X?" is a query, not a guess. This skill is the gate that runs that query **before** a spec or plan is written. It owns three things GitNexus's own skills leave open: the order of checks (available → indexed → fresh → query), the safe re-index command, and the Impact Report that `spec-driven-development` and `planning-and-task-breakdown` consume. The query mechanics stay in GitNexus's bundled skills; this skill points at them rather than restating them.

The graph is the primary source of dependents. Source reading closes its blind spots. Grep confirms completeness. Never the other way round.

## When to Use

- A spec is being written for a change to code that already exists (spec-driven-development Phase 1)
- A plan is mapping the dependency graph of a change (planning-and-task-breakdown Step 2)
- A task will edit a symbol whose callers, flows, or module boundaries you cannot list from memory
- The blast radius you have is a grep result and you do not know whether it is complete
- An existing `.gitnexus/` index may be stale (commits landed since it was built)
- A change is about to be committed or reviewed and its diff has not been compared with the planned blast radius

**When NOT to use:** greenfield code with no existing callers; docs-only or config-only changes; when neither the GitNexus MCP server nor the `gitnexus` CLI is present — write one line saying so and continue with the parent skill (see Step 0). Never install GitNexus on the user's behalf.

## The Gate

The whole gate normally costs six to eight tool calls (not counting loading tool schemas). If you are past fifteen, you are doing archaeology the index should be doing for you — go back to Step 1.

### Step 0: Availability

Check for either signal:

- an MCP tool named `list_repos` served by a `gitnexus` server, or
- the CLI: `command -v gitnexus` succeeds, or `.gitnexus/run.cjs` exists in the repository root

Neither present → add this line to the spec or plan and stop using this skill:

```
Impact: GitNexus unavailable — the dependency map below is source-derived (grep + reading), not graph-derived.
```

Then map dependencies by hand as the parent skill describes. Do not fabricate graph results, do not install GitNexus, do not ask the user to.

### Step 1: Bind the repository and check freshness

1. `list_repos {}` (page with `offset: pagination.nextOffset` while `hasMore` is true) — or `gitnexus list`.
2. Is the repository you are about to change in the list? With more than one indexed repository, pass `repo` explicitly on every later call; if you cannot tell which one is meant, ask. Names come from the git remote, so two clones of one repository register under the same name — when that happens bind by absolute path exactly as `list_repos` prints it (`repo: "<abs path>"`, CLI `--repo <abs path>`; on macOS `/tmp` is registered as `/private/tmp`) or index with `--name <alias>`.
3. Read `gitnexus://repo/{name}/context` — or run `gitnexus status` inside the repository — and note the indexed commit and how many commits behind HEAD it is. (`list_repos` also reports staleness per repository when resources cannot be read.)

Not indexed, or stale → Step 2. Fresh → Step 3.

A stale index is not "close enough". In one measured run, an index 311 commits behind returned five callers that no longer existed and zero for the ones that did. Graph callers that the source disproves, or `context` and `impact` disagreeing, mean the same thing: refresh — or, if you cannot, trust the source and say so in the report.

### Step 2: Index in safe mode

From the repository root:

```bash
gitnexus analyze --index-only        # or: node .gitnexus/run.cjs analyze --index-only
```

What `--index-only` touches, so you do not have to re-verify it: `.gitnexus/` inside the repository (self-excluded via `.git/info/exclude`) and `~/.gitnexus/registry.json`. No tracked file changes. Plain `gitnexus analyze` additionally injects a block into `CLAUDE.md`/`AGENTS.md` and installs skill files under `.claude/skills/` — that is a project decision for the user, not something a planning step makes on their behalf.

GitNexus's bundled skills say to run plain `analyze` on a stale index; use `--index-only` regardless. Run it once per gate. Small repositories take seconds; large ones a minute or two — say so and wait, do not skip. If it fails, the repository is too large to index in this session, or you are not permitted to write, continue on the stale graph, weight source reading higher, record the staleness in the Impact Report, and expect the gate to cost more calls — the budget above assumes a fresh index.

### Step 3: Locate the code

Follow GitNexus's bundled skill `gitnexus-exploring` (or the Minimal Call Sequence below): `query` for the concept (skip it when the symbol is already named, or if it errors or returns nothing), then `context` on each symbol you will change. Common names come back ambiguous — narrow with `file_path` / `kind`, or reuse the `uid` from a `context` result. An ambiguous response carries placeholder counts that look like a real zero: never read numbers off it, re-run with `uid`. An `export const` function is two nodes (`Function:` and `Const:`) that `file_path` cannot separate — run `impact` on both. The CLI forms are `gitnexus query "<concept>"` and `gitnexus context <symbol>`.

### Step 4: Measure the blast radius

Follow GitNexus's bundled skill `gitnexus-impact-analysis`: `impact` with `direction: "upstream"` on each symbol you will change (CLI: `gitnexus impact <symbol> --direction upstream`), then read `gitnexus://repo/{name}/processes` for the execution flows those symbols sit in (`impact` also returns `affected_processes` when resources cannot be read). Its depth table and risk table are the ones to use:

| Depth | Meaning |
|---|---|
| d=1 | **Will break** — direct callers and importers; every one becomes a task or acceptance criterion |
| d=2 | Likely affected — indirect; verify each |
| d=3 | May need testing |

Pass `includeTests: true` (CLI `--include-tests`): tests that pin the old contract are dependents too, and `impact` hides them by default. If the index reports zero processes (common in small repositories), execution flows are source-derived — list the entry points you traced by hand.

Three results are not "safe": `risk: UNKNOWN`, `partial: true`, and `epistemic: "lower-bound"` (or zero callers on a symbol that is exported). Each means the walk could not answer — treat the caller list as a floor and confirm with Step 5 before rating the risk. Auth, payments, permissions, and data paths are CRITICAL regardless of how few callers the count shows.

### Step 5: Close the graph's blind spots

A call graph records calls. It does not see:

- handlers passed by reference (`app.post('/login', loginHandler)`, event registration, DI containers)
- route or middleware wiring that gates code at runtime (`app.use('/api', guard)`)
- dynamic dispatch, string-keyed lookups, reflection, cross-language and config-driven calls
- callers on unmerged branches or in other repositories

Read the source of every d=1 dependent with those patterns in mind, then grep for the **dependents' names as well as the target's** (`grep -rnw loginHandler apiMiddleware`) — a grep for the target alone never finds the file that passes its callers by reference. Use `git grep -nw <symbol> <ref>` per unmerged branch when in-flight work matters, and separate call sites a branch adds (`git diff main...<ref>`) from ones it merely inherited. Anything found here goes in the report labelled **source-derived**. A dependent that is itself a test is updated to the new contract, never deleted.

### Step 6: Write the Impact Report and hand it back

```markdown
## Impact
Repository: <name> (<path>) · Index: <commit>, <n> behind HEAD (refreshed this session: yes/no)
Targets: <symbol> (<file>:<line>) …

Will break (d=1):      <caller> (<file>:<line>) [CALLS <confidence>%] …
Likely affected (d=2): …
Execution flows:       <ProcessName> (step i/n) …
Blind spots checked:   reference-passing / routes / DI / dynamic → <what was found, or none> (source-derived)
Risk: LOW | MEDIUM | HIGH | CRITICAL | UNKNOWN — <one-line reason; for UNKNOWN, the source-derived floor; name the critical-path override if any>
Open questions: <anything the graph could not answer>
```

**Where it lands:**

- **Spec** (`spec-driven-development`): the report goes under *Boundaries* as "Callers and dependents this spec accounts for"; every d=1 dependent becomes a *Success Criterion* (for example "`loginHandler` still returns 401 for a malformed user"); callers that exist only on unmerged branches get one pattern-level criterion that reproduces their call shape; every UNKNOWN becomes an *Open Question*.
- **No spec or plan** (a direct bug fix): the report goes in the commit message or PR description, so Step 7 has something to agree with.
- **Plan** (`planning-and-task-breakdown`): the report is the source for Step 2's graph — draw the tree from it and tag every edge `graph` or `source-derived`; every d=1 dependent and every affected flow becomes a task or an acceptance criterion with its own test; UNKNOWN and CRITICAL rows go in *Risks and Mitigations*; the final checkpoint runs `detect_changes` (`gitnexus detect-changes --scope all`) and requires it to agree with the report: every changed symbol is a Target or a listed dependent and every affected flow is listed — anything else means stop and update the report before committing. Use `scope: "compare", base_ref: <start commit>` when tasks were committed one at a time, and pair it with `git status` — new untracked files are invisible to the diff.

### Step 7: Close the loop after implementation

The report predicted the blast radius; the diff measures it. Compare the two **before each commit**, and once more over the whole branch before review.

1. `detect_changes` — stage everything first so new test files are in the diff, then `scope: "staged"` (or `"all"`) for the commit at hand; `scope: "compare", base_ref: <branch base>` for the whole change. CLI: `gitnexus detect-changes --scope staged|all|compare --base-ref <ref>` — the CLI prints a summary and caps the symbol list, so the completeness fields in point 2 come from the MCP call.
2. Agreement means all of: the result is complete (`partial` not true, `risk_level` not `unknown`, `changed_count` equals the list length); every changed **production** symbol is a Target or a listed dependent; every affected flow is listed; `git diff --name-status <base>` shows only planned files. Ignore the noise: new test fixtures and doc sections have no dependents outside their own file, and a symbol adjacent to an edited line can show as changed — confirm with `git diff`.
3. Every d=1 dependent has a test in the diff (or an existing test the plan names) that exercises the changed symbol *through* that dependent; a dependent that is itself a test counts once it is updated to the new contract.
4. Disagreement → stop. Revert the unplanned change, or update the Impact Report and add its test — before the commit, never after.
5. Re-index once (`analyze --index-only`) before the whole-branch check and before review: symbols the change adds are invisible to `detect_changes` until then, while per-commit checks work against the base index. Do not re-index after every commit.

Without GitNexus the same checks run by hand: `git diff --name-status <base>` against the plan's file list, `grep -rnw` on every symbol the diff changes, and a test per dependent in the source-derived map.

**Where it runs:**

- **Build** (`incremental-implementation`, `/build`): before each commit, whenever the plan carries an Impact section.
- **Bug fixes without a plan** (`test-driven-development`, Prove-It): once the reproduction test fails and before the fix, run Steps 0–5 on the symbol you are about to change — its d=1 dependents are the regression-test list. Each gets one "keeps working" test, written red-first like the reproduction: it pins the dependent's behaviour for valid input and shows the new rule reaching it. Then Step 7 before the commit.
- **Review** (`code-review-and-quality`, `/review`): Step 7 over the whole diff is the blast-radius lens — every listed dependent has a test, nothing unplanned changed, the stated risk matches the report.

## Minimal Call Sequence

When GitNexus's bundled `gitnexus-*` skills are not installed (Cursor, Windsurf, `--skip-skills` installs), this is the whole gate:

| Step | MCP | CLI |
|---|---|---|
| Bind | `list_repos {}` | `gitnexus list` |
| Freshness | read `gitnexus://repo/{name}/context` | `gitnexus status` |
| Index | — | `gitnexus analyze --index-only` |
| Locate | `query {search_query}` → `context {name, file_path}` | `gitnexus query "…"` → `gitnexus context <symbol>` |
| Blast radius | `impact {target, direction: "upstream", file_path, includeTests: true}` | `gitnexus impact <symbol> --direction upstream --file <path> --include-tests` |
| Flows | read `gitnexus://repo/{name}/processes` | `gitnexus context <symbol>` (lists processes) |
| Pre-commit check | `detect_changes {scope: "all"}` | `gitnexus detect-changes --scope all` |

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The index is stale, so I'll just grep" | A re-index costs seconds. The measured alternative was 30–50 tool calls of git archaeology that still cannot see reference-passing or dynamic callers. Refresh, then query, then grep to confirm. |
| "Re-indexing writes to disk — I'll make it a later task" | Deferring the refresh means the plan's blast radius is a guess. `--index-only` writes only gitignored paths; run it now. |
| "Zero callers, so the change is safe" | Zero with `partial`, `lower-bound`, or on an exported symbol means the walk failed, not that nobody calls it. UNKNOWN is not LOW. |
| "The graph says `exact`, so the list is complete" | Exact for call edges. Reference-passing and route wiring are not call edges. Step 5 exists for this. |
| "It's a one-line change" | A one-line guard in `validateUser` gates login and every API route. Blast radius is about dependents, not diff size. |
| "GitNexus isn't installed, so skip the impact section" | Skip the tool, not the section. Map dependencies by hand and label them source-derived. |
| "Tests are green, so the blast radius is fine" | Green tests cover only the callers that have tests. `detect_changes` shows every caller the diff reached; the report says which ones should have. Compare them. |
| "I already know this codebase" | Then the query is cheap and confirms it. Memory does not survive the last 300 commits. |

## Red Flags

- A spec or plan for a change to existing code with no Impact section and no "GitNexus unavailable" line
- `gitnexus analyze` run without `--index-only` from inside a planning step
- Planning proceeded on an index the context resource reported as stale
- The graph's `risk` field copied as the verdict when the result was `partial`, `lower-bound`, or from a stale index — UNKNOWN is a valid verdict only with its source-derived floor stated
- d=1 dependents listed in the report but absent from the tasks and success criteria
- More than ~15 tool calls spent establishing callers by hand while a graph was available
- Fabricated graph output when the tool was absent or failed
- A commit made while `detect_changes` lists a production symbol the Impact Report does not
- Re-indexing after every commit, or never before review

## Verification

Before handing the spec or plan on, confirm:

- [ ] Step 0 outcome recorded: either the gate ran or the "GitNexus unavailable" line is in the document
- [ ] Repository bound explicitly (`repo` passed when more than one is indexed) and index freshness stated with the indexed commit
- [ ] If the index was missing or stale, `analyze --index-only` was run this session — or the staleness is recorded in the report with the reason it was not
- [ ] `impact` was run upstream on every symbol the change touches, disambiguated where names collide
- [ ] Every d=1 dependent and every affected execution flow appears in the spec's success criteria or the plan's tasks
- [ ] Step 5 blind spots were read, and source-derived findings are labelled as such
- [ ] Risk level stated with its reason; UNKNOWN/partial results were not reported as LOW
- [ ] Before each commit and before review, `detect_changes` agreed with the report — or the disagreement was resolved by reverting, or by updating the report and adding the test
- [ ] Every d=1 dependent has a test that exercises the changed symbol through it
- [ ] No tracked file was modified by this skill's gate steps (Steps 0–6)
