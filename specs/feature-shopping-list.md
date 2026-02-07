# Feature: Shopping List

> Full feature spec for shopping lists: scaling, multi-recipe merge, ingredient grouping, export options.

---

## Overview

The shopping list feature lets users select multiple recipes, adjust servings for each, and generate a consolidated shopping list with merged and scaled ingredients. Users can check off items as they shop, print the list, and clear or regenerate as needed.

This spec builds on:
- [shopping-list-engine.md](./shopping-list-engine.md) — ingredient parsing, unit conversion, scaling math, aggregation pipeline, deduplication logic
- [shopping-list-ui.md](./shopping-list-ui.md) — page layout, components, state management, accessibility
- [recipe-data-model.md](./recipe-data-model.md) — canonical recipe schema, `## Ingredients` section format
- [api-routes.md](./api-routes.md) — `POST /api/v1/shopping-list`
- [ui-components.md](./ui-components.md) — shared ScalingControl, RecipeCard, SearchBar components

---

## User Stories

### US-1: Build a Shopping List from Multiple Recipes

**As a** user planning meals for the week,
**I want to** select several recipes and generate a combined shopping list,
**so that** I have one consolidated list of everything I need to buy.

**Example:** A user selects "Crispy Chickpea Bowl" and "Pasta Aglio e Olio", generates the list, and sees olive oil merged into a single line with combined quantities.

### US-2: Scale Servings Per Recipe

**As a** user cooking for a different number of people,
**I want to** adjust the servings for each recipe independently before generating the list,
**so that** ingredient quantities reflect the actual amounts I need.

**Example:** A user sets "Crispy Chickpea Bowl" to 6 servings (from default 4) and "Pasta Aglio e Olio" to 2 servings — the shopping list reflects both scaling factors.

### US-3: Check Off Items While Shopping

**As a** user at the grocery store,
**I want to** check off ingredients as I add them to my cart,
**so that** I can track what I still need.

**Example:** Checking off "olive oil" applies strikethrough styling and moves it to the bottom of the list.

### US-4: See Which Recipes Need Each Ingredient

**As a** user reviewing the shopping list,
**I want to** see which recipes contributed each ingredient,
**so that** I can understand why a quantity is what it is and make substitutions if needed.

**Example:** "5 tbsp olive oil" shows source references: "Crispy Chickpea Bowl (2 tbsp)" and "Pasta Aglio e Olio (3 tbsp)".

### US-5: Print the Shopping List

**As a** user who prefers a paper list,
**I want to** print the shopping list in a clean, printer-friendly format,
**so that** I can bring it to the store without my phone.

### US-6: Clear and Start Over

**As a** user who wants to build a different list,
**I want to** clear the current shopping list and start fresh,
**so that** I can plan a different set of meals.

### US-7: Edit Recipe Selection After Generating

**As a** user who wants to add or remove a recipe,
**I want to** go back to the recipe selection step and modify my choices,
**so that** the list updates without losing my check-off progress unnecessarily.

**Example:** A user clicks "Edit Recipes", adds a third recipe, and the list regenerates with the new ingredients. Check state is reset since quantities may have changed.

---

## Acceptance Criteria

### Recipe Selection

| # | Criterion |
|---|-----------|
| AC-1 | A search input with autocomplete lets users find recipes by title (debounced 300ms, queries `GET /api/v1/recipes`). |
| AC-2 | Clicking a search result adds the recipe to the selected list with its default servings. |
| AC-3 | Duplicate recipes cannot be added. Attempting to add a duplicate shows a toast: "This recipe is already in your list." |
| AC-4 | Maximum 20 recipes can be selected. At the limit, the search input is disabled with a message: "Maximum 20 recipes reached." |
| AC-5 | Each selected recipe shows its title, a remove button, and a ScalingControl for adjusting servings. |
| AC-6 | ScalingControl enforces 0.25x–10x scaling limits relative to the recipe's default servings. |
| AC-7 | A "Generate Shopping List" button is disabled until at least one recipe is selected. |

### Shopping List Display

| # | Criterion |
|---|-----------|
| AC-8 | On generate, call `POST /api/v1/shopping-list` with selected recipe IDs and target servings. |
| AC-9 | The shopping list displays a header with the number of recipes and total item count. |
| AC-10 | Each item shows a checkbox, formatted quantity and unit, ingredient name, and source recipe references. |
| AC-11 | Ingredients with merged quantities from multiple recipes show all source recipes inline. |
| AC-12 | Ingredients that couldn't be parsed show the raw ingredient line as a fallback. |
| AC-13 | Items with incompatible units from different recipes appear as separate line items under the same ingredient name. |

### Check-Off Interaction

| # | Criterion |
|---|-----------|
| AC-14 | Clicking the checkbox toggles the checked state for that item. |
| AC-15 | Checked items display with strikethrough text and reduced opacity. |
| AC-16 | Checked items move to the bottom of the list. |
| AC-17 | A checked count is displayed (e.g., "5 of 23 items checked"). |
| AC-18 | An "Uncheck All" button resets all items to unchecked. |
| AC-19 | Check-off state is client-side only and does not persist across page reloads. |

### Edit and Clear

| # | Criterion |
|---|-----------|
| AC-20 | An "Edit Recipes" button collapses the list view and re-expands the recipe selection panel with current selections preserved. |
| AC-21 | Modifying the recipe selection and regenerating resets check-off state. |
| AC-22 | A "Clear" button with confirmation dialog (if any items are checked) resets to the empty recipe selection state. |

### Print View

| # | Criterion |
|---|-----------|
| AC-23 | A "Print" button triggers `window.print()`. |
| AC-24 | Print styles hide Navbar, Footer, action buttons, and checked items. |
| AC-25 | Print view includes a title with the current date and a source recipes section listing all included recipes. |

### Export Options

| # | Criterion |
|---|-----------|
| AC-26 | A "Copy to Clipboard" button copies the shopping list as plain text with one item per line (e.g., "2 cups flour"). |
| AC-27 | Clipboard copy shows a toast: "Shopping list copied to clipboard." |
| AC-28 | On mobile devices supporting `navigator.share()`, a "Share" button opens the native share sheet with the plain text list. |

### Authentication

| # | Criterion |
|---|-----------|
| AC-29 | The `/shopping-list` route requires authentication. Unauthenticated users are redirected to `/auth/login`. |

---

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| EC-1 | User selects zero recipes and tries to generate | Generate button is disabled. Cannot submit. |
| EC-2 | User selects 20 recipes then tries to add another | Search input is disabled. Message: "Maximum 20 recipes reached." |
| EC-3 | User adds the same recipe twice | Duplicate is rejected with toast: "This recipe is already in your list." |
| EC-4 | A selected recipe is deleted by another session | `POST /api/v1/shopping-list` returns `RECIPE_NOT_FOUND`. Error toast: "One or more recipes could not be found. Please remove them and try again." |
| EC-5 | A recipe has no `## Ingredients` section | That recipe contributes zero items to the list. No error — other recipes still populate the list. |
| EC-6 | An ingredient line is completely unparseable | The raw line is displayed with null quantity/unit. The user sees the original text. |
| EC-7 | Two recipes have the same ingredient in incompatible units (e.g., "1 cup flour" + "200g flour") | Listed as separate line items, each referencing its source recipe. |
| EC-8 | Scaling results in very small quantities (e.g., 0.05 tsp) | Rounded to the nearest friendly fraction (⅛ tsp). If rounded to zero, show the ingredient with null quantity. |
| EC-9 | User scales a recipe to 0.25x (minimum) | All ingredients scaled to 25% of original. Quantities rounded to friendly fractions. |
| EC-10 | User scales a recipe to 10x (maximum) | All ingredients scaled to 1000% of original. Unit conversion kicks in (e.g., tsp→tbsp→cups). |
| EC-11 | Network error during list generation | Error toast: "Couldn't generate shopping list. Please try again." Recipe selection is preserved. |
| EC-12 | User clicks "Clear" with no items checked | No confirmation dialog — clears immediately. |
| EC-13 | User clicks "Clear" with some items checked | Confirmation dialog: "You have checked items. Clear the list?" with Clear and Cancel buttons. |
| EC-14 | User navigates away and returns | Shopping list state is reset. User starts fresh with recipe selection. |
| EC-15 | Clipboard API is not available | Copy button is hidden. Only print and share (if available) are shown. |

---

## Ingredient Grouping

### Current Behavior (v1)

Items are listed in a flat list, ordered by:
1. Unchecked items first, checked items last.
2. Within each group, items are in the order produced by the aggregation pipeline (first-encountered order).

### Future: Aisle/Category Grouping

A future iteration may group items by aisle or category (produce, dairy, pantry, etc.). The `ShoppingListItem.category` field is reserved for this purpose but is `null` in v1.

---

## Export Format

### Plain Text (for clipboard and share)

```
Shopping List (Feb 7, 2026)
From: Crispy Chickpea Bowl (6 servings), Pasta Aglio e Olio (2 servings)

- 5 tbsp olive oil
- 3 ½ cups flour
- 2 cloves garlic
- Salt and pepper to taste
```

Format rules:
- One item per line, prefixed with `- `.
- Quantity and unit followed by ingredient name.
- Items with null quantity show only the name.
- Header includes date and source recipes with servings.
- Checked items are excluded from the export.

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Shopping list generation (server) | < 500ms for 20 recipes |
| Recipe search autocomplete | < 200ms |
| Check-off toggle (client) | < 50ms (no server round-trip) |
| Print render | < 200ms |
| Clipboard copy | < 100ms |

---

## Security Requirements

- The shopping list endpoint requires authentication.
- Recipe IDs in the request are validated against recipes accessible to the authenticated user.
- No shopping list data is persisted server-side in v1 — all state is ephemeral.
- Request body size is validated (max 20 items).
- Rate limiting: 30 shopping list generation requests per user per minute.

---

## Accessibility Requirements

- Recipe search input has a visible label: "Search recipes to add."
- Selected recipe list uses `role="list"` with `role="listitem"` entries.
- ScalingControl buttons have `aria-label` attributes ("Increase servings", "Decrease servings").
- Shopping list items are in a `role="list"` container.
- Checkbox items have associated labels via `aria-labelledby`.
- Checked count uses `aria-live="polite"` to announce updates.
- "Uncheck All" button announces result: "All items unchecked."
- Print and Copy buttons have descriptive `aria-label` attributes.
- Confirmation dialog traps focus and is dismissible with Escape.
- Loading state announces "Generating shopping list" via `aria-live="polite"`.
- All interactive elements meet 44x44px minimum touch target on mobile.

---

## Out of Scope

- Persistent/saved shopping lists (database storage for later retrieval).
- Aisle/category grouping of ingredients.
- Ingredient price estimation or store integration.
- Sharing shopping lists with other users.
- Syncing check-off state across devices.
- Barcode scanning for item lookup.
- Manual ingredient addition (items not from recipes).
