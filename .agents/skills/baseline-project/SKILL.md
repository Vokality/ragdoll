---
name: baseline-project
description: Set up, audit, or refresh evidence-backed AGENTS.md instructions, domain guidance, and coding skills for a repository. Use when standardizing coding-agent behavior or fixing stale agent guidance; not for ordinary feature implementation.
---

# Establish an agent baseline for a project

Produce concise project guidance grounded in inspected contracts, code, and commands. Use the user's existing engineering preferences. Treat this as improving the environment around agents, not making a claim of equal model capability.

Run the deterministic CLI with `uvx agent-baseline@0.2.0 <command> <project>` (requires uv and Python 3.11+), or an installed matching `agent-baseline` version. Git is optional for inventory; verification runs on macOS or Linux. The CLI has no model or API dependency. This skill and its references are persistent copies; they do not depend on the uv cache. If reading `skill show` output, the linked references are included under their file headings.

## Choose the requested operation

- **Set up:** create or improve project instructions, scoped contracts, and the evidence record.
- **Audit:** inspect and report issues without editing project files or running project verification commands.
- **Refresh:** review changed evidence, update affected guidance, then record the reviewed state.
- **Evaluate:** prepare and, if requested with an available model runner and budget, execute paired model trials using [references/evaluate.md](references/evaluate.md). The helper does not execute model evaluations.

Infer the operation from the request. Do not make an ordinary code change trigger a repository-wide instruction rewrite. Preserve unrelated edits and the user's chosen scope. Do not install global rules, modify other repositories, or publish anything as a side effect of a project setup.

## Inspect before authoring

For first-time setup, run `uvx agent-baseline@0.2.0 init <project>` and add `--agent codex` and/or `--agent claude` only for the hosts requested. This creates an unreviewed draft, not finished project instructions. For other hosts, supply this skill directly through `skill show`; do not guess host configuration. Link existing project skills with `skill link <canonical-folder> --project <project> --agent <host>` instead of creating divergent copies.

Resolve the exact project directory and applicable existing instructions. Run `uvx agent-baseline@0.2.0 inspect <project>` for candidate paths, then inspect the relevant files. Inventory matches are not evidence of authority.

Establish the language/runtime versions, declared package commands, CI entrypoints, test prerequisites, existing agent configuration, and the ownership of the requested domain. Read root routing first; open only relevant scoped files. Do not read secrets or environment-value files to discover variable names; prefer documented examples and configuration schemas.

Use normative specifications for intended behavior, code for current behavior, and version-matched official documentation for uncertain dependency APIs. Resolve material contradictions before writing the dependent rule. Do not invent commands, source paths, domain invariants, or measured improvements.

## Author the minimum useful guidance

Keep durable, shared instructions canonical. Preserve existing symlinks and imports; do not replace a linked instruction file with a separate divergent copy. Keep global user preferences separate from project rules.

Write the root as a short set of important rules and task routing. For each ambiguous rule, supply its trigger, the decision to make, and the evidence or check that establishes compliance. Put substantial task-specific detail into linked references. Link to a maintained example rather than copying a code tour.

Write current implementation facts descriptively. Only durable user preferences or explicit normative decisions establish prohibitions or approval requirements; an absent dependency, a command's behavior, and this setup task's limits do not. "Not needed" does not mean "forbidden." Before recording, review each new instruction against a future authorized task and remove restrictions or "ask first" requirements without that durable authority.

For a domain change workflow, define identity, lifecycle, ownership, valid states, boundary validation, failure semantics, and relevant observable examples. Reuse concepts only when their invariants match. Keep internal types precise, imports at module scope, and test-only branches out of production. Do not use casts or unexplained nullable state to hide contract errors.

Prefer repo-owned executable checks for mechanically decidable rules. State the coverage limits of those checks. Architectural quality still needs a concrete rubric or owner review.

Add a skill only for a recurring procedure that needs more than a short routing rule. Its description must discriminate applicable requests from nearby requests that should not trigger it. Test discovery separately from execution. If a procedure is mandatory, make the task entrypoint explicitly supply it.

## Record evidence and verify

Read [references/project-record.md](references/project-record.md) before authoring `.agent-baseline.json`. Populate it with real artifacts, source files, and exact check arguments/working directories. Each artifact needs supporting evidence; do not use it as its own source. Prefer stable contracts, schemas, command manifests, and representative tests to an entire source tree.

Use `doctor` to check guidance links and metadata. Add host flags to check the requested native routes. Resolve findings against the actual linked source; do not rewrite guidance to make a checker pass without preserving its meaning. Prefer named Markdown sections or JSON pointers when only that source contract supports the rule.

For setup or refresh, run the declared non-destructive development checks when authorized by that request. Inspect their behavior and prerequisites first. Do not insert deployment, production mutation, publishing, or credential-bearing commands into the check list.

After reviewing guidance against its sources, run `record` to save the evidence snapshot, `check` to detect drift, and `verify` to execute all declared checks. `record` does not certify quality or successful verification. An empty project-check list must be reported as guidance-only verification. If a check is blocked, retain that status and complete independent work; do not substitute a passing no-op.

For refresh, inspect the differences in every changed monitored file and decide which guidance is affected. Update or affirm the guidance with a concrete reason before recording. Never automatically re-record just to silence a drift failure.

Keep existing host adapters minimal and verify their loading behavior in supported installed versions. The standard skill content is portable; plugin manifests and invocation syntax are host-specific.

Finish with files changed, evidence behind the rules, actual verification results, and remaining limitations. Distinguish mechanical validation from semantic review and measured model performance. Do not claim model parity without paired trials.
