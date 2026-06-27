# OpenViking L0-L2 Mapping

## Purpose

OpenViking treats the file path as the first data type. Agents must classify files by stable path patterns before opening file bodies, so recursive search can stay narrow and sensitive material can stay outside broad context loads.

This mapping assumes the S1 four-layer layout:

```text
shared-memory/
  context/      # shared company and client knowledge
  members/      # human/member-scoped notes and personal working memory
  agents/       # legacy compatibility redirects only
  _private/     # sensitive originals and sealed context
```

## Layers

| Layer | Name | Role | Default handling |
|---|---|---|---|
| L0 | Evidence | Immutable or near-immutable source material: raw meeting notes, original client files, unprocessed transcripts, sealed logs | Do not summarize in place. Derive into L1 and link back. |
| L1 | Resource / User Scope | Curated shared knowledge: client wiki, summaries, decisions, dashboard, insights, member notes meant for reuse | Search first for project and client work. Safe to quote internally when sensitivity permits. |
| L2 | Skill / Memory | Executable context: agent operating memory, prompts, skills, automation-facing instructions | Load only the named agent/tool scope needed for the task. |

## Classification Order

Classifiers must evaluate rules in this order and stop at the first match:

1. Explicit private/evidence paths (`_private`, `raw`, `transcripts`, `attachments/originals`) -> L0.
2. Executable agent/skill paths (`context/agents`, `members/*/agents`, `.claude/agents`) -> L2.
3. Curated shared and member paths (`context`, `members/*/notes`) -> L1.
4. Legacy paths under `shared-memory/agents`, `shared-memory/clients`, `shared-memory/insights`, `shared-memory/daily-logs`, `shared-memory/dashboard.md` map by the compatibility table below.
5. Unknown files are `unclassified` and must be recorded in the nearest `log.md` as `classify:unknown` before automation moves them.

## Canonical Path Rules

| Regex | Layer | Meaning | Notes |
|---|---|---|---|
| `^shared-memory/_private(?:/.*)?$` | L0 | Sealed private evidence | Excluded from broad indexing. Index may contain counts only, no titles if sensitive. |
| `^shared-memory/context/clients/[^/]+/raw(?:/.*)?$` | L0 | Client raw inputs | Original meeting notes, uploads, transcripts, exports. |
| `^shared-memory/context/clients/[^/]+/(?:evidence|source|sources|transcripts|attachments/originals)(?:/.*)?$` | L0 | Client evidence aliases | S6 should normalize new writes to `raw/` unless a repo already uses the alias. |
| `^shared-memory/context/daily-logs/raw(?:/.*)?$` | L0 | Raw daily capture | Derived daily notes belong in L1. |
| `^shared-memory/context/clients/[^/]+(?:/.*)?$` | L1 | Curated client knowledge | Includes WHY/HOW/WHAT outputs, memory, decisions, readmes, indexes. |
| `^shared-memory/context/(?:dashboard\.md|daily-logs/[^/]+\.md|insights(?:/.*)?|usage(?:/.*)?|messages(?:/.*)?|tasks(?:/.*)?|interventions(?:/.*)?|README\.md)$` | L1 | Shared operating resources | Broad internal search may include these unless task scope says otherwise. |
| `^shared-memory/members/[^/]+/notes(?:/.*)?$` | L1 | Member-scoped reusable notes | User scope: load only for that member or when explicitly handed off. |
| `^shared-memory/context/agents/[^/]+/(?:work|learnings|decisions|mistakes|README)\.md$` | L2 | Shared agent memory | Canonical agent memory location after S1. |
| `^shared-memory/members/[^/]+/agents/[^/]+(?:/.*)?$` | L2 | Member-private agent skill/memory | Member scoped; never broad-load for all agents. |
| `^\.claude/agents/[^/]+\.md$` | L2 | Claude Code subagent prompt | Treat as executable instructions. |
| `^\.codex(?:/.*)?$` | L2 | Codex local configuration | Load only when debugging local runtime behavior. |

## Legacy Compatibility Mapping

Until all automation is migrated, these legacy paths remain readable. New writes should prefer the canonical S1 paths.

| Legacy path | Canonical layer | Canonical target |
|---|---|---|
| `shared-memory/clients/{client}/raw/` | L0 | `shared-memory/context/clients/{client}/raw/` |
| `shared-memory/clients/{client}/` | L1 | `shared-memory/context/clients/{client}/` |
| `shared-memory/daily-logs/` | L1 | `shared-memory/context/daily-logs/` |
| `shared-memory/insights/` | L1 | `shared-memory/context/insights/` |
| `shared-memory/dashboard.md` | L1 | `shared-memory/context/dashboard.md` |
| `shared-memory/usage/` | L1 | `shared-memory/context/usage/` |
| `shared-memory/messages/` | L1 | `shared-memory/context/messages/` |
| `shared-memory/tasks/` | L1 | `shared-memory/context/tasks/` |
| `shared-memory/interventions/` | L1 | `shared-memory/context/interventions/` |
| `shared-memory/agents/{agent}/` | L2 | `shared-memory/context/agents/{agent}/` |

## Search Policy

| Task type | First search scope | Expansion rule |
|---|---|---|
| Client diagnosis or WHY/HOW/WHAT work | L1 client folder | Expand to L0 `raw/` only when cited source detail is needed. |
| Agent self-memory | L2 named agent folder | Expand to shared L1 only for project facts. |
| Daily brief | L1 dashboard + daily logs + active client indexes | Do not open L0 unless an index link points to a required source. |
| Audit or provenance check | L1 decision/index files | Expand to linked L0 evidence. |
| Automation/spec implementation | This mapping + `index-log-spec.md` + relevant L2 tool memory | Expand to repo code paths as needed. |

## Metadata Contract

Files may include YAML front matter. When present, `openviking_layer` must match path classification.

```yaml
---
openviking_layer: L1
scope: client|company|member|agent|private
owner: data-strategist
source_paths:
  - shared-memory/context/clients/acme/raw/2026-06-01-kickoff.md
updated_at: 2026-06-06
---
```

If front matter conflicts with the path, the path wins and S6 must append `classify:conflict` to the nearest `log.md`.
