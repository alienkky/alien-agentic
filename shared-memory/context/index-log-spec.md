# index.md and log.md Automation Spec

## Purpose

Every folder root may carry two automation files:

- `index.md`: current navigable map of the folder.
- `log.md`: append-only event stream for changes automation should remember.

S6 can regenerate `index.md`. S6 must only append to `log.md`.

## File Placement

| Folder type | `index.md` | `log.md` |
|---|---:|---:|
| `shared-memory/context/` | required | required |
| `shared-memory/context/clients/{client}/` | required | required |
| `shared-memory/context/clients/{client}/raw/` | required, redacted if needed | required |
| `shared-memory/context/agents/{agent}/` | required | required |
| `shared-memory/members/{member}/` | required | required |
| `shared-memory/members/{member}/agents/{agent}/` | required | required |
| `shared-memory/_private/` | optional redacted counts only | required, private |

Small leaf folders may omit both files unless they contain more than 12 markdown files or any L0 evidence.

## index.md Contract

`index.md` is generated from filesystem state plus optional front matter. It should stay compact enough to load before opening body files.

### Required front matter

```yaml
---
index_version: 1
generated_at: 2026-06-06T20:00:00+09:00
root: shared-memory/context/clients/example
default_layer: L1
owner: data-strategist
source: auto
---
```

### Required sections

```markdown
# Index: {folder-name}

## Scope
- Layer: L1
- Owner: data-strategist
- Contains: curated client knowledge
- Do not include: raw transcripts; sealed private notes

## Entry Points
| Path | Layer | Type | Updated | Summary |
|---|---|---|---|---|
| WHY/origin-diagnosis-4layer.md | L1 | diagnosis | 2026-06-06 | Four-layer origin diagnosis |

## Link Graph
| From | Relation | To |
|---|---|---|
| WHY/master-narrative.md | derived_from | raw/2026-06-01-kickoff.md |

## Open Questions
| ID | Question | Owner | Created |
|---|---|---|---|

## Automation Notes
- Last classifier run: 2026-06-06T20:00:00+09:00
- Unknown files: 0
```

### Entry point fields

| Field | Source | Rule |
|---|---|---|
| `Path` | relative path from current index root | Must be slash-separated. |
| `Layer` | OpenViking classifier | One of `L0`, `L1`, `L2`, `unclassified`. |
| `Type` | front matter `type`, else path heuristic | Suggested values: `raw`, `diagnosis`, `decision`, `memory`, `prompt`, `workflow`, `log`, `readme`, `dashboard`. |
| `Updated` | git mtime or filesystem mtime | ISO date only unless multiple edits in one day matter. |
| `Summary` | front matter `summary`, first heading, or generated one-line label | Max 120 chars. No sensitive L0 snippets. |

### Link graph fields

S6 should parse these sources in order:

1. YAML `source_paths`, `derived_from`, `related`.
2. Markdown wiki links and relative links.
3. Conventional section labels such as `근거`, `Sources`, `Handoff`, `Depends on`.

Relations must use this controlled vocabulary:

| Relation | Meaning |
|---|---|
| `derived_from` | Curated file was produced from an evidence/source file. |
| `summarizes` | File condenses a longer file without replacing it. |
| `decides` | File records a decision affecting another file or workflow. |
| `implements` | Code or prompt implements a spec. |
| `hands_off_to` | File is intended input for a later issue/agent. |
| `related_to` | Weak relation when no stronger relation fits. |

## log.md Contract

`log.md` is append-only. It records file lifecycle and classifier decisions, not full content.

### Required header

```markdown
# Log: {folder-name}

Append-only OpenViking folder log. Newest entries at bottom.

| Time | Event | Actor | Path | Layer | Detail |
|---|---|---|---|---|---|
```

### One-line append format

```markdown
| 2026-06-06T20:00:00+09:00 | append | data-strategist | shared-memory/context/openviking-mapping.md | L1 | created mapping spec for ALI-101 |
```

`Detail` must be one line, max 180 chars, with pipes escaped as `\|`.

## Logged Events

| Event | When to append | Required detail |
|---|---|---|
| `append` | A file is created or appended by an agent or automation | issue id, reason, or source |
| `update` | Existing file content changes without path move | issue id and short intent |
| `move` | File moves from one path to another | `from -> to` |
| `delete_proposed` | Automation believes a file should be removed | reason; never delete directly from this event |
| `classify` | Classifier assigns or confirms a layer | rule id or regex family |
| `classify:unknown` | No mapping rule matches | proposed owner or next action |
| `classify:conflict` | Front matter layer conflicts with path layer | `frontmatter=X path=Y` |
| `redact` | L0/private index entry is redacted | redaction reason |
| `index_regenerated` | S6 regenerates `index.md` | number of entries and unknowns |

## Redaction Rules

For L0 and `_private` paths:

- `index.md` may list counts, dates, and opaque IDs.
- `index.md` must not expose family, psychology, raw client secrets, or unapproved names.
- `log.md` may record path and event but should use redacted path segments when the path itself is sensitive.

Example:

```markdown
| 2026-06-06T20:00:00+09:00 | redact | index-bot | shared-memory/_private/[redacted]/raw.md | L0 | private path hidden from shared index |
```

## Implementation Notes for S6

1. Walk folders breadth-first.
2. Classify each file using `openviking-mapping.md`.
3. Load front matter only after path classification.
4. Generate or update each required `index.md`.
5. Append `index_regenerated` to the same folder's `log.md`.
6. Append `classify:unknown` and skip move/delete when a file cannot be classified.
7. Never mutate L0 source bodies.
