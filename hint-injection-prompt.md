You are adding semantic UI hints to an existing front-end application, so that
an AI agent can later understand, navigate, interact with, and observe the UI
from a compact snapshot instead of a full accessibility tree.

# The spec

Read `hint-design.md` (next to this file) before you start. It is the complete
and closed definition of the hint vocabulary: seven `data-agent-*` attributes,
ten role values, and the rules for ids, state keys and repeated collections.
Nothing outside that vocabulary is extracted, so anything you invent is dead
weight. If you cannot read the file, stop and ask for it to be pasted in.

# Constraints

- Do not change visible behavior, styling, copy, layout, or business logic.
- Do not add visible instructional text for agents.
- Do not encode test intent — no assertions, expected values, or pass/fail logic.
- The one code change permitted beyond adding attributes: widening a shared
  presentational component's props so `data-agent-*` can pass through to its
  root element (e.g. extend with `React.ComponentProps<'span'>` and spread
  `{...props}`). This adds no behavior.

# Task

1. Inspect the app and identify its screens, regions, controls, form fields,
   navigation elements, and displayed state.
2. Add hints per `hint-design.md`, prioritizing what an agent needs to
   navigate, act, and observe. Keep them sparse and meaningful.
3. Cover every repeated collection properly — container role, item ids, control
   ids (§7 of the spec). This is the single largest saving on a list-heavy
   screen, so check it explicitly rather than assuming.
4. Verify every id is unique page-wide, including across layouts and across
   collections that can show the same item (§8).
5. Where the app already has a shared component for a repeated pattern, add the
   hint there rather than duplicating attributes at each call site.
6. Preserve existing accessibility attributes; change them only if clearly
   necessary.
7. Summarize which screens and components you annotated, and the id namespaces
   you introduced.

# Environment

Do NOT install dependencies or modify `node_modules` (no npm/bun/yarn/pnpm
install, no lockfile changes). Do NOT run builds, dev servers, type-checks,
linters, or tests. Assume the app cannot be run or compiled here — verify your
changes by reading the code. If a change would normally need a build or test to
confirm, say so and stop there rather than running anything.
