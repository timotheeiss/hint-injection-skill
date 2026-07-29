---
name: semtag-inject
description: >-
  Injects data-semtag-* semantic hints into a front-end codebase so an AI agent can
  understand, navigate, act on and observe the UI from a compact snapshot instead of a
  full accessibility tree or screenshot. Use when asked to add semantic hints, semtags,
  agent-testable annotations, or data-semtag-* attributes to a web app, or to make an
  app's UI legible to a browsing/testing agent.
license: MIT
compatibility: Requires Node.js 18+ to run the bundled validator script.
allowed-tools: Read Grep Glob Edit Write Bash(node:*) Bash(npm:*) Bash(pnpm:*) Bash(yarn:*) Bash(bun:*) Bash(npx:*)
---

# semtag: inject semantic UI hints

You are adding semantic UI hints to an existing front-end application, so that an
AI agent can later understand, navigate, interact with, and observe the UI from a
compact snapshot instead of a full accessibility tree.

## 1. Read the spec first

Read [references/hint-design.md](references/hint-design.md) before touching any
code. It is the complete and closed definition of the vocabulary: seven
`data-semtag-*` attributes, ten role values, and the rules for ids, state keys and
repeated collections.

The vocabulary is closed in both directions. An attribute or role outside it is
not extracted — it is dead weight in the source and invisible to the agent. There
are no fallbacks: an element with a `data-semtag-action` but no `data-semtag-role`
is not treated as an action, it is filed under `other` as a hinting gap.

## 2. Constraints

- Do not change visible behavior, styling, copy, layout, or business logic.
- Do not add visible instructional text for agents.
- Do not encode test intent — no assertions, expected values, or pass/fail logic.
  Hints describe what the UI *is*, never what it *should be*.
- Preserve existing accessibility attributes; change them only if clearly necessary.
- The one code change permitted beyond adding attributes: widening a shared
  presentational component's props so `data-semtag-*` can pass through to its root
  element (e.g. extend with `React.ComponentProps<'span'>` and spread `{...props}`).
  This adds no behavior.

## 3. Inject

1. Inspect the app and identify its screens, regions, controls, form fields,
   navigation elements, and displayed state.
2. Add hints per the spec, prioritizing what an agent needs to navigate, act, and
   observe. Keep them sparse and meaningful — an attribute that carries no
   information costs tokens on every snapshot.
3. Cover every repeated collection properly: container role, item ids, control ids
   (§7). A list or grid that fails to fold is usually the single largest waste on a
   screen, so check it explicitly rather than assuming.
4. Verify every id is unique page-wide, including across responsive layouts and
   across collections that can show the same item (§8).
5. Where the app already has a shared component for a repeated pattern, add the
   hint there rather than duplicating attributes at each call site.

## 4. Validate

Run the bundled linter over the code you changed:

```bash
node scripts/validate-semtags.mjs <path-to-app-source>
```

It catches what static analysis can catch: attributes and roles outside the
vocabulary, duplicate ids, index-keyed collection items, raw URLs in targets, test
intent leaking into names, and selects missing their options. Fix every **error**
it reports and read every **warning** — a warning is usually a real gap, not a
false positive.

Then check what it cannot see. The linter reads source text, so it cannot resolve
DOM ancestry, runtime ids, or which elements actually render together on a page.
In particular, confirm by reading the code that each collection container really
is an ancestor of its items, and that ids built from template literals stay unique
at runtime.

## 5. Verify and report

Run the project's own checks — type-check, lint, build, tests — to confirm the
injection changed nothing but attributes. If a check was already failing before
you started, say so rather than trying to fix it.

Then summarize:

- which screens and components you annotated
- the id namespaces you introduced
- any collection you could not fold, and why
- anything you deliberately left unhinted
