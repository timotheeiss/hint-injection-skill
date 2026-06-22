You are modifying an existing front-end application to add semantic UI hints for agent-testable GUI interaction.

Goal:
Inject lightweight semantic hints into the app code so an AI agent can understand, navigate, interact with, and observe the UI more efficiently. These hints will later be extracted into a compact semantic snapshot. They should not encode test-specific assertions, expected outcomes, or test oracle logic.

Important:
Do not change visible UI behavior, styling, copy, layout, or business logic unless absolutely necessary.
Do not add visible instructional text for agents.
Do not encode anything like “this should pass the checkout test” or “expected value is X”.
Hints should describe the UI’s meaning and affordances, not the test’s intent.

Use embedded attributes such as:

- data-agent-id: stable semantic identifier for an element or region
- data-agent-role: semantic category of the element
- data-agent-action: user-level action supported by the element
- data-agent-state: observable state exposed by the element
- data-agent-target: destination or controlled target
- data-agent-controls: related UI region this element controls
- data-agent-observes: related state/value this element affects or exposes
- data-agent-options: for a select/dropdown trigger, its available options as
  "value|Label" pairs separated by ";" (label optional), so an agent can choose
  an option without opening the menu and reading the accessibility tree

Prefer only the fields that are useful. Do not add all fields everywhere.

Naming conventions:
Use stable, domain-level names rather than implementation names.

Good:
data-agent-id="checkout.submit"
data-agent-action="submit-order"
data-agent-state="cart.total"

Bad:
data-agent-id="button-3"
data-agent-action="click-for-test-2"
data-agent-state="expected-total-42"

Examples:

A primary button:

<button
  data-agent-id="checkout.submit"
  data-agent-role="primary-action"
  data-agent-action="submit-order"
>
  Place order
</button>

An observable value:

<div
  data-agent-id="cart.total"
  data-agent-role="observable"
  data-agent-state="cart.total"
>
  Total: £42.00
</div>

A navigation link:

<a
  data-agent-id="nav.orders"
  data-agent-role="navigation"
  data-agent-target="orders.page"
  href="/orders"
>
  Orders
</a>

A form field:

<input
  data-agent-id="shipping.postcode"
  data-agent-role="input"
  data-agent-state="shipping.postcode"
  name="postcode"
/>

A region:

<section
  data-agent-id="checkout.form"
  data-agent-role="form-region"
>
  ...
</section>

Repeated collections and selectable instances (important):

An agent must be able to act on a SPECIFIC item by selector alone. If hints
only mark the *kind* of element (e.g. a single "select" or "product-card" role)
but not each individual instance, the agent cannot target one item by
data-agent-id and is forced to fall back to the raw accessibility tree to
disambiguate by visible text or index. That defeats the purpose of the hints.

Therefore, annotate every individually-selectable instance inside a repeated
collection, AND its primary controls, with a stable, unique data-agent-id:

- Dropdown / select / listbox OPTIONS — each option, keyed by its value:
  data-agent-id="filters.category.option.tech", data-agent-role="option"
- LIST / GRID items — each item, keyed by a stable domain key (slug/id):
  data-agent-id="products.grid.item.sony-xm5"
- TABLE / list ROWS and their row-level action buttons — key the buttons by the
  same item key so they can be selected directly:
  data-agent-id="admin.product.42.edit", data-agent-id="admin.product.42.delete"

Conventions for instances:
- Options:        <control>.option.<value>
- Collection items: <collection>.item.<key>
- Item controls:  <collection>.item.<key>.<action>  (e.g. .open, .buy, .edit, .delete)

Uniqueness caution:
- The id must be unique on the page. If the SAME item can render in more than
  one collection on a single screen (e.g. a product shown both in "featured" and
  in a category grid), SCOPE the id by its collection (pass a collection id into
  the shared component) so the two instances do not collide. Duplicate ids break
  single-element observation.
- Put the instance id on the element whose accessible name identifies the item
  (e.g. the title link, or the row's name heading), so the compact snapshot
  carries a human-meaningful name the agent can match against.

A select/dropdown trigger that lists its options (so the agent can pick one
without opening the menu), paired with per-option ids on the items:

<button
  data-agent-id="filters.sort"
  data-agent-role="select"
  data-agent-action="sort-products"
  data-agent-options="newest|Newest;price-asc|Price: Low to High;price-desc|Price: High to Low"
>
  Sort by
</button>

A select option (each item, addressable as <trigger-id>.option.<value>):

<div
  data-agent-id="filters.sort.option.price-asc"
  data-agent-role="option"
>
  Price: Low to High
</div>

A collection item with controls:

<a
  data-agent-id="products.grid.item.sony-xm5"
  data-agent-role="navigation"
  data-agent-target="product.detail"
  href="/product/sony-xm5"
>
  Sony WH-1000XM5
</a>
<button data-agent-id="products.grid.item.sony-xm5.buy" data-agent-role="primary-action" data-agent-action="buy-product">Buy</button>

A row action keyed to its item:

<button
  data-agent-id="admin.product.42.edit"
  data-agent-role="action"
  data-agent-action="edit-product"
>
  Edit
</button>

Task:
1. Inspect the app structure and identify the main user-facing screens, regions, controls, form fields, navigation elements, and observable state displays.
2. Add semantic hints to the most important interactive and observable elements.
3. Keep the hints sparse and meaningful. Prioritize elements an agent would need for navigation, interaction, and observation.
   - In particular, ensure every element an agent might need to click can be located by data-agent-id ALONE. If selecting a specific instance in a repeated collection (an option, a list item, a row's edit/delete button) would otherwise require reading the accessibility tree to disambiguate, add an instance-level id (see "Repeated collections and selectable instances" above).
4. Preserve existing accessibility attributes and improve them only if clearly necessary.
5. Avoid adding duplicate or unstable IDs.
6. Do not add hints to purely decorative elements.
7. Do not encode test cases, expected postconditions, or assertions.
8. If repeated patterns exist, use the project’s existing component abstractions rather than manually duplicating attributes everywhere.
9. After editing, summarize which screens/components were annotated and what semantic IDs were introduced.

If the codebase has tests, run the relevant checks to confirm behavior is unchanged.