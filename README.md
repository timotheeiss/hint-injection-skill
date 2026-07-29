# semtag-inject

An [Agent Skill](https://agentskills.io) that injects `data-semtag-*` semantic
hints into a front-end codebase, so an AI agent can drive and observe the UI from
a compact snapshot instead of a full accessibility tree or screenshots.

The skill is self-contained and portable: it needs no MCP server, no network, and
no build step. It reads and edits source files, then lints its own work.

```
semtag-inject/
├── SKILL.md                        the procedure the agent follows
├── references/
│   └── hint-design.md              the vocabulary spec — loaded on demand
└── scripts/
    └── validate-semtags.mjs        zero-dependency linter (Node 18+)
```

`references/hint-design.md` is the **source of truth for the whole project**, not
a copy. The extractor in `semantic-hints-mcp/`, the hint-review overlay, and the
browser-agent prompt all implement it.

## Install

The skill follows the open Agent Skills standard, so the same directory works in
any compatible client. Copy or symlink `semtag-inject/` into the client's skills
directory:

| Client | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/semtag-inject/` | `.claude/skills/semtag-inject/` |
| Codex | `~/.agents/skills/semtag-inject/` | `.agents/skills/semtag-inject/` |

For example, for Claude Code:

```bash
mkdir -p ~/.claude/skills
cp -r semtag-inject ~/.claude/skills/
```

Create the parent first. If `~/.claude/skills/` does not already exist, `cp -r`
treats it as the destination *name* and copies the skill's contents to that path
directly — leaving a loose `SKILL.md` where the directory should be, and no
`semtag-inject/` skill at all.

## Use

Ask for it in plain language — "add semtags to this app", "make this UI
agent-testable" — or invoke it directly: `/semtag-inject` in Claude Code,
`$semtag-inject` in Codex.

## Validate on its own

The linter is useful outside the skill too, e.g. in CI:

```bash
node semtag-inject/scripts/validate-semtags.mjs src/
node semtag-inject/scripts/validate-semtags.mjs src/ --strict   # warnings fail too
node semtag-inject/scripts/validate-semtags.mjs src/ --json     # machine-readable
```

It exits non-zero on any error. It checks what source text can tell you:
attributes and roles outside the closed vocabulary, missing ids, duplicate
literal ids, index-keyed collection items, raw URLs in targets, test intent in
names, selects missing their options, and dead `data-*` decoy attributes.

It does **not** resolve DOM ancestry or runtime ids, so it cannot confirm that a
collection container actually wraps its items, or that template-literal ids stay
unique on a rendered page. For that, use the hint-review overlay in
`hint-review-tool/` against the running app, which shows the exact snapshot the
agent would receive.
