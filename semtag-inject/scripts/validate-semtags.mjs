#!/usr/bin/env node
/**
 * validate-semtags — a static linter for data-semtag-* hints.
 *
 * Checks injected source against the closed vocabulary in
 * references/hint-design.md. Zero dependencies, Node 18+.
 *
 *   node scripts/validate-semtags.mjs [path ...] [--strict] [--json]
 *
 * WHAT IT CANNOT SEE. This reads source text, not a rendered page, so it cannot
 * resolve DOM ancestry, runtime id values, or which elements appear together on
 * a screen. Rules that depend on those (does each collection container actually
 * contain its items? are template-literal ids unique at runtime?) are reported
 * as warnings at best, and still need a human or a live snapshot. It is a first
 * pass, not a proof.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

// ---- the closed vocabulary (hint-design.md §3, §4) -------------------------

const ATTRS = new Set([
  "data-semtag-id",
  "data-semtag-role",
  "data-semtag-action",
  "data-semtag-state",
  "data-semtag-target",
  "data-semtag-controls",
  "data-semtag-options",
]);

const ROLES = new Set([
  "navigation",
  "action",
  "option",
  "input",
  "select",
  "toggle",
  "slider",
  "observable",
  "region",
  "collection",
]);

// Plain data-* attrs that look like an attempt to encode meaning. Nothing
// outside data-semtag-* reaches the agent, so these are silently dead.
const DECOY_RE =
  /^data-(?!semtag-)(price|product|item|sku|value|key|id|total|amount|qty|quantity|name|category|slug)/i;

const SCAN_EXT = new Set([
  ".html", ".htm", ".jsx", ".tsx", ".js", ".ts", ".mjs",
  ".vue", ".svelte", ".astro", ".php", ".erb",
]);
const SKIP_DIR = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".nuxt", ".svelte-kit",
  "coverage", "out", ".venv", "__pycache__", ".cache",
]);

// ---- source scanning -------------------------------------------------------

/**
 * Yield each element's opening tag. Tracks quote state and brace depth so a
 * `>` inside a JSX expression or a string does not end the tag early.
 */
function* scanElements(src) {
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) return;
    if (!/[A-Za-z]/.test(src[lt + 1] || "")) {
      i = lt + 1;
      continue;
    }
    let j = lt + 1;
    let quote = null;
    let depth = 0;
    while (j < src.length) {
      const c = src[j];
      if (quote) {
        if (c === "\\") { j += 2; continue; }
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") {
        quote = c;
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth = Math.max(0, depth - 1);
      } else if (c === ">" && depth === 0) {
        break;
      }
      j++;
    }
    yield { start: lt, text: src.slice(lt, j + 1) };
    i = j + 1;
  }
}

/** Parse the attributes of one opening tag. */
function parseAttrs(tag) {
  const out = [];
  const re = /([:@]?[A-Za-z_][\w:.-]*)\s*=\s*/g;
  let m;
  while ((m = re.exec(tag))) {
    let name = m[1];
    let dynamic = false;
    // Vue/Angular binding forms: :attr="expr", v-bind:attr="expr"
    if (name.startsWith(":")) { name = name.slice(1); dynamic = true; }
    if (name.startsWith("v-bind:")) { name = name.slice(7); dynamic = true; }

    let k = re.lastIndex;
    let value = "";
    const open = tag[k];
    if (open === '"' || open === "'") {
      const close = tag.indexOf(open, k + 1);
      if (close === -1) break;
      value = tag.slice(k + 1, close);
      k = close + 1;
    } else if (open === "{") {
      // JSX/Svelte expression container — balanced-brace scan.
      let depth = 0;
      let q = null;
      let p = k;
      for (; p < tag.length; p++) {
        const c = tag[p];
        if (q) {
          if (c === "\\") { p++; continue; }
          if (c === q) q = null;
          continue;
        }
        if (c === '"' || c === "'" || c === "`") q = c;
        else if (c === "{") depth++;
        else if (c === "}") { depth--; if (depth === 0) { p++; break; } }
      }
      value = tag.slice(k + 1, p - 1);
      dynamic = true;
      k = p;
    } else {
      const mm = /^[^\s>]*/.exec(tag.slice(k));
      value = mm ? mm[0] : "";
      k += value.length;
    }
    out.push({ name, value, dynamic, offset: m.index });
    re.lastIndex = k;
  }
  return out;
}

/** Repo-relative where that reads well, absolute where it would not. */
function displayPath(file) {
  const rel = relative(process.cwd(), file);
  return !rel || rel.startsWith("..") ? file : rel;
}

function lineOf(lineStarts, offset) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function walk(path, files) {
  let st;
  try { st = statSync(path); } catch { return files; }
  if (st.isFile()) {
    if (SCAN_EXT.has(extname(path))) files.push(path);
    return files;
  }
  if (!st.isDirectory()) return files;
  for (const entry of readdirSync(path)) {
    if (SKIP_DIR.has(entry) || entry.startsWith(".")) continue;
    walk(join(path, entry), files);
  }
  return files;
}

// ---- the checks ------------------------------------------------------------

const findings = [];
const idSites = new Map(); // literal id -> [{file, line}]
let hasCollectionRole = false;
let itemIdCount = 0;
let hintedElements = 0;

function report(level, file, line, rule, message) {
  findings.push({ level, file, line, rule, message });
}

function checkElement(file, line, attrs) {
  const semtags = attrs.filter((a) => a.name.startsWith("data-semtag-"));
  if (semtags.length === 0) return;
  hintedElements++;

  const by = new Map(semtags.map((a) => [a.name, a]));

  // §3 — the attribute list is closed.
  for (const a of semtags) {
    if (!ATTRS.has(a.name)) {
      report("error", file, line, "unknown-attribute",
        `'${a.name}' is not one of the seven attributes — it is never extracted`);
    }
  }

  // §3 — id is required on every hinted element.
  const id = by.get("data-semtag-id");
  if (!id) {
    report("error", file, line, "missing-id",
      `element carries ${semtags[0].name} but no data-semtag-id, so nothing can address it`);
  }

  // §4 — the role list is closed, and matching is exact.
  const role = by.get("data-semtag-role");
  if (role && !role.dynamic) {
    if (!ROLES.has(role.value)) {
      const near = ROLES.has(role.value.toLowerCase())
        ? ` (did you mean '${role.value.toLowerCase()}'? matching is case-sensitive)`
        : "";
      report("error", file, line, "unknown-role",
        `role '${role.value}' is not one of the ten — lands in 'other'${near}`);
    }
  }

  // §4 — no fallbacks: anything without a role is filed as a gap, whether it
  // carries other hints or only an id.
  if (!role) {
    report("warn", file, line, "no-role",
      "no data-semtag-role, so this lands in 'other' and the agent is told nothing about what it is");
  }

  // §3 — a select's options are what let an agent pick without opening the menu.
  if (role && role.value === "select" && !by.has("data-semtag-options")) {
    report("warn", file, line, "select-without-options",
      "role='select' without data-semtag-options forces the agent back to the accessibility tree");
  }

  // §6 — targets name a destination, never a URL.
  const target = by.get("data-semtag-target");
  if (target && !target.dynamic &&
      (/^https?:\/\//i.test(target.value) || target.value.startsWith("/"))) {
    report("error", file, line, "url-target",
      `target '${target.value}' is a raw URL — name the destination instead, e.g. 'product.detail'`);
  }

  // §1 — hints describe the UI, never the test.
  for (const a of semtags) {
    if (a.dynamic) continue;
    if (/\b(expected|expect|assert|oracle|pass-?fail)\b/i.test(a.value)) {
      report("error", file, line, "test-intent",
        `${a.name}='${a.value}' encodes test intent — hints describe what the UI is, not what it should be`);
    } else if (/(^|[.\-_])(should|test|testcase)([.\-_]|$)/i.test(a.value)) {
      report("warn", file, line, "test-intent",
        `${a.name}='${a.value}' reads like test intent rather than a domain name`);
    }
  }

  // §6 — stable domain names, not positions or framework nouns.
  if (id && !id.dynamic) {
    idSites.set(id.value, [...(idSites.get(id.value) || []), { file, line }]);
    if (/(^|[.\-_])(button|btn|div|span|el|node|component|card|item)[-_]?\d+([.\-_]|$)/i.test(id.value)) {
      report("warn", file, line, "positional-id",
        `id '${id.value}' looks positional or framework-derived — it breaks when the UI is reordered`);
    }
    if (!id.value.includes(".")) {
      // Info, not warn: a single-segment id is fine for a top-level region and
      // only becomes a problem once the namespace grows.
      report("info", file, line, "flat-id",
        `id '${id.value}' is not a dotted domain path (e.g. 'checkout.submit')`);
    }
  }

  // §7 — collection membership.
  const rawId = id ? id.value : "";
  if (rawId.includes(".item.")) {
    itemIdCount++;
    if (/\$\{\s*(i|j|idx|index|_?i)\s*\}/.test(rawId) || /\b(index|idx)\b/.test(rawId)) {
      report("error", file, line, "index-keyed-item",
        `item id '${rawId}' is keyed by an array index — use a stable domain key (slug or database id)`);
    }
  }
  if (role && role.value === "collection") hasCollectionRole = true;

  // Dead weight: plain data-* that looks like an attempt to encode meaning.
  for (const a of attrs) {
    if (DECOY_RE.test(a.name)) {
      report("info", file, line, "decoy-attribute",
        `'${a.name}' is not read by the extractor — only data-semtag-* reaches the agent`);
    }
  }
}

// ---- run -------------------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.includes("-h") || argv.includes("--help")) {
  console.log(`Usage: node validate-semtags.mjs [path ...] [--strict] [--json]

Lints data-semtag-* hints against the closed vocabulary in hint-design.md.
Defaults to the current directory. Exits 1 on any error, or on any warning
when --strict is set.`);
  process.exit(0);
}
const strict = argv.includes("--strict");
const asJson = argv.includes("--json");
const targets = argv.filter((a) => !a.startsWith("--"));
if (targets.length === 0) targets.push(".");

const files = [];
for (const t of targets) walk(t, files);

for (const file of files) {
  let src;
  try { src = readFileSync(file, "utf8"); } catch { continue; }
  if (!src.includes("data-semtag-")) continue;

  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineStarts.push(i + 1);

  const shown = displayPath(file);
  for (const el of scanElements(src)) {
    if (!el.text.includes("data-semtag-")) continue;
    checkElement(shown, lineOf(lineStarts, el.start), parseAttrs(el.text));
  }
}

// Cross-file checks.
for (const [id, sites] of idSites) {
  if (sites.length < 2) continue;
  report("warn", sites[0].file, sites[0].line, "duplicate-id",
    `id '${id}' is written literally in ${sites.length} places (${sites
      .map((s) => `${s.file}:${s.line}`).join(", ")}) — duplicates on one page break observation`);
}
if (itemIdCount > 0 && !hasCollectionRole) {
  report("warn", targets[0], 0, "no-collection-container",
    `${itemIdCount} '<prefix>.item.<key>' ids exist but no element declares role="collection" — nothing will fold`);
}

// ---- output ----------------------------------------------------------------

const order = { error: 0, warn: 1, info: 2 };
findings.sort((a, b) =>
  order[a.level] - order[b.level] || a.file.localeCompare(b.file) || a.line - b.line);

const counts = { error: 0, warn: 0, info: 0 };
for (const f of findings) counts[f.level]++;

if (asJson) {
  console.log(JSON.stringify({ findings, counts, filesScanned: files.length, hintedElements }, null, 2));
} else {
  const label = { error: "ERROR", warn: "WARN ", info: "INFO " };
  for (const f of findings) {
    const where = f.line ? `${f.file}:${f.line}` : f.file;
    console.log(`${label[f.level]}  ${where}  [${f.rule}]  ${f.message}`);
  }
  if (findings.length) console.log("");
  console.log(
    `${hintedElements} hinted element(s) across ${files.length} file(s) — ` +
    `${counts.error} error(s), ${counts.warn} warning(s), ${counts.info} info`);
  if (counts.error === 0 && counts.warn === 0) {
    console.log("No vocabulary violations found.");
  }
  console.log(
    "\nStatic check only: DOM ancestry, runtime id values and per-page uniqueness\n" +
    "are not verified here. Confirm collection containers really wrap their items,\n" +
    "and that ids built from template literals stay unique at runtime.");
}

process.exit(counts.error > 0 || (strict && counts.warn > 0) ? 1 : 0);
