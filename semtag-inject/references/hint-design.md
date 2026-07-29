# Semantic Hint Design Spec

The single source of truth for the `data-semtag-*` vocabulary. The hint-injection
prompt, the semantic-hints MCP extractor, and the browser-agent prompt all
implement this file — change it here first, then in those three places.

## 1. Purpose

Hints describe what the UI **means and affords**, so an agent can understand a
screen, act on it, and read its state *without* a full accessibility tree or DOM reading.

Hints never encode test intent: no assertions, no expected values, no
pass/fail logic, no "the total should be £42". Describing what the UI *is*
is in scope; describing what it *should be* is not.

## 2. How hints reach the agent

The agent sees only a compact snapshot extracted from `data-semtag-*`
attributes. Three consequences:

- **The extractor reads live values for you.** For the roles that hold one
  (`input`, `select`, `toggle`, `slider`, `observable`) it captures the
  element's current on-screen text or form value automatically. Never write a
  value into an attribute yourself.
- **Only `data-semtag-*` attributes are read.** Mirroring data into `data-price`
  or `data-product-id` does nothing — it never reaches the agent.
- **Nothing is inferred, and nothing is repaired.** Tag names, ARIA roles and
  input types are never used to guess an element's meaning, and a partial hint
  is never completed for you. An element with a `data-semtag-id` and no
  `data-semtag-role` lands in `other`, where it is visible as the gap it is.

## 3. The seven attributes

This list is closed. No other `data-semtag-*` attribute is extracted.

| Attribute | Value | Notes |
|---|---|---|
| `data-semtag-id` | dotted domain path, e.g. `checkout.submit` | **Required on every hinted element.** Unique page-wide. |
| `data-semtag-role` | one of the ten roles in §4 | The element's semantic category. |
| `data-semtag-action` | verb-object, e.g. `submit-order` | The user-level action. Only on things that do something. |
| `data-semtag-state` | state key(s), e.g. `cart.total` | What the element reads or writes. See §5. |
| `data-semtag-target` | destination name, e.g. `product.detail` | Where a navigation goes. Never a raw URL. |
| `data-semtag-controls` | the `data-semtag-id` of a region | For a control that drives a distinct region (search → result list). Omit when there is no clear one. |
| `data-semtag-options` | `value\|Label;value2\|Label2` | A select trigger's available options, so the agent picks one without opening the menu. Label optional. |

Use only the attributes that carry information. Do not put all seven everywhere.

Build `data-semtag-options` from the same source that renders the options —
`categories.map((c) => \`${c.id}|${c.name}\`).join(";")` — so the trigger and
its menu cannot drift apart.

## 4. The ten roles

This list is closed, and **the role is also the snapshot group**: the extractor
files each element under its role, so entries carry no `role` field — the group
name already states it.

| Role | Use for |
|---|---|
| `navigation` | link/button that moves to another screen or view |
| `action` | any command button (submit, buy, edit, delete, clear, add) |
| `option` | one option inside a select or listbox |
| `input` | text/number/search field or textarea |
| `select` | a select/dropdown trigger — pair with `data-semtag-options` |
| `toggle` | checkbox, switch, on-off chip, tag filter |
| `slider` | range slider |
| `observable` | element that only displays a value to be read |
| `region` | a meaningful grouping — form, filter panel, dialog, banner |
| `collection` | container of repeated items — list, grid, table |

Anything else — an off-vocabulary value, or no `data-semtag-role` at all — lands
in `other`. That group is the snapshot's record of a hinting gap, never a
category to aim for. There are no fallbacks and no repairs: an element with a
`data-semtag-action` but no role is `other`, not an action, and `Action` is not
`action`.

## 5. `data-semtag-state`

Two forms, in order of preference:

1. **A state key** naming what the element reads or edits:
   `cart.total`, `filters.category`, `search.query`. This is the normal case.
   Comma-separate when one element covers several: `product.price,product.stock`.
2. **A literal value**, only when the element's state is *not* readable as
   on-screen text: `open`/`closed`, `selected`, `empty`. An `observable` almost
   never needs this — the extractor already captures its displayed text.

Put the same key on the control that edits a value and on the element that
displays it; that is how the agent connects the two.

## 6. Naming

Stable domain names, never implementation names or positions.

| Good | Bad | Why |
|---|---|---|
| `checkout.submit` | `button-3` | positional, breaks on reorder |
| `submit-order` | `click-for-test-2` | encodes test intent |
| `cart.total` | `expected-total-42` | encodes an expected value |
| `products.grid.item.sony-xm5` | `card-component-7` | framework name, not domain |

`data-semtag-target` names a destination by what it is:
`products.page`, `category.tech`, `product.detail`, `external.affiliate`.

## 7. Repeated collections

Lists, grids and tables are the bulk of a snapshot, and almost all of it is
repetition. The extractor folds them into one compact block — shared attributes
stated once, each item one row — but **only when all four rules hold**:

1. The container carries `data-semtag-role="collection"` **and** its own
   `data-semtag-id`.
2. Each item's id is `<prefix>.item.<key>`, keyed by a stable domain key
   (slug or database id), never an array index.
3. Each per-item control's id is `<prefix>.item.<key>.<control>`
   (`.open`, `.buy`, `.edit`, `.delete`, `.price`).
4. There are at least 2 items, and they all share one collection ancestor.

Get any of these wrong and folding silently does not happen: rows keyed
`admin.product.42.edit` (no `.item.`) stay fully expanded, and so does a grid
whose container has no `collection` role. Treat a missing `collection` role on
a list container as a bug.

`<prefix>` need not equal the container's own id — membership follows the DOM,
so `admin.products.list` holding `admin.products.item.42` is fine.

Folding costs nothing: every item stays individually addressable by its real id.

```html
<section data-semtag-id="products.grid" data-semtag-role="collection">
  <a data-semtag-id="products.grid.item.sony-xm5"
     data-semtag-role="navigation"
     data-semtag-target="product.detail"
     href="/product/sony-xm5">Sony WH-1000XM5</a>
  <span data-semtag-id="products.grid.item.sony-xm5.price"
        data-semtag-role="observable"
        data-semtag-state="product.price">£299.00</span>
  <button data-semtag-id="products.grid.item.sony-xm5.buy"
          data-semtag-role="action"
          data-semtag-action="buy-product">Buy</button>
</section>
```

Select options follow the same shape, keyed by option value:
`filters.sort.option.price-asc` under trigger `filters.sort`.

## 8. Uniqueness

Ids must be unique page-wide — duplicates break single-element observation.

- **Same item in two collections** (a product in "featured" *and* in a category
  grid): scope the id by its collection. Thread a collection id into the shared
  component and build the id from it, so each call site supplies its own
  (`home.featured`, `products.grid`). Emit no attribute at all when that id is
  missing, rather than a half-formed one.
- **Same control in two layouts** (desktop bar and mobile drawer): suffix the
  secondary copy with `.mobile` — `search.query` and `search.query.mobile`.
  Keep `data-semtag-state` identical on both; only the id differs.
- Put an item's id on the element whose accessible name identifies it (the
  title link, the row's name cell), not on an outer wrapper whose name would be
  every word inside it.

## 9. Coverage

Hint an element when an agent would need to **navigate to it, act on it, or
read it**. In particular, anything the agent might click must be reachable by
`data-semtag-id` alone — if picking one instance out of a repeat would otherwise
need the accessibility tree to disambiguate, it needs an instance-level id.

Do not hint decorative elements, layout wrappers, or icons that duplicate an
adjacent labelled control.

## 10. Examples

```html
<!-- action -->
<button data-semtag-id="checkout.submit"
        data-semtag-role="action"
        data-semtag-action="submit-order">Place order</button>

<!-- observable: the extractor captures "Total: £42.00" as its value -->
<div data-semtag-id="cart.total"
     data-semtag-role="observable"
     data-semtag-state="cart.total">Total: £42.00</div>

<!-- navigation -->
<a data-semtag-id="nav.orders"
   data-semtag-role="navigation"
   data-semtag-target="orders.page" href="/orders">Orders</a>

<!-- input -->
<input data-semtag-id="shipping.postcode"
       data-semtag-role="input"
       data-semtag-state="shipping.postcode" name="postcode" />

<!-- select trigger listing its options, driving a region -->
<button data-semtag-id="filters.sort"
        data-semtag-role="select"
        data-semtag-action="sort-products"
        data-semtag-controls="products.grid"
        data-semtag-options="newest|Newest;price-asc|Price: Low to High">Sort by</button>

<!-- region -->
<section data-semtag-id="checkout.form" data-semtag-role="region">…</section>
```
