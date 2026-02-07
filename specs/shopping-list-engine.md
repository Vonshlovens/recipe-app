# Shopping List Engine

> Ingredient parsing and normalization, unit conversion, recipe scaling math, multi-recipe aggregation, and deduplication logic.

---

## Overview

The shopping list engine transforms raw ingredient lines from recipe Markdown bodies into structured, aggregatable shopping items. Users select one or more recipes, optionally scale servings per recipe, and the engine produces a consolidated shopping list with merged quantities, consistent units, and logical grouping.

This spec covers the engine internals — parsing, normalization, scaling, and aggregation. The API surface is defined in `specs/api-routes.md`; the UI is defined in `specs/shopping-list-ui.md`.

---

## Ingredient Parsing

### Input Format

Ingredient lines come from the `## Ingredients` section of recipe Markdown bodies (see `specs/recipe-data-model.md`). Each line is a single list item:

```
- 2 tbsp olive oil
- 1 avocado, sliced
- Salt and pepper to taste
- 2 cans (15 oz each) chickpeas, drained and rinsed
- ½ cup tahini
```

### Parsed Structure

Each ingredient line is parsed into a structured object:

```typescript
interface ParsedIngredient {
  raw: string;              // Original line text (for fallback display)
  quantity: number | null;  // Numeric amount (null if unparseable)
  unit: string | null;      // Normalized unit (null if unitless, e.g., "1 avocado")
  name: string;             // Ingredient name (primary match key for dedup)
  prep: string | null;      // Preparation notes (e.g., "sliced", "drained and rinsed")
  note: string | null;      // Parenthetical notes (e.g., "15 oz each")
}
```

### Parsing Rules

1. **Strip list marker** — Remove leading `- ` or `* ` or `1. `.
2. **Extract parenthetical notes** — Pull `(...)` content into `note`. Example: `2 cans (15 oz each) chickpeas` → note: `"15 oz each"`.
3. **Extract prep notes** — Split on the last comma. Content after the comma is `prep`. Example: `1 avocado, sliced` → prep: `"sliced"`.
4. **Parse quantity** — Match the leading numeric value. Supports:
   - Integers: `2`
   - Decimals: `1.5`
   - Unicode fractions: `½`, `¼`, `¾`, `⅓`, `⅔`, `⅛`
   - Mixed numbers: `1 ½` (= 1.5)
   - Slash fractions: `1/2`, `3/4`
   - Ranges: `2-3` → use the first value (`2`)
   - No quantity: `Salt and pepper to taste` → quantity: `null`
5. **Parse unit** — Match the token immediately after quantity against the known unit dictionary (see Unit System below). If no match, the token is part of the name.
6. **Remainder is name** — Everything after quantity and unit, up to the comma (if any), is the ingredient name. Trim whitespace.

### Parsing Edge Cases

| Input                              | quantity | unit    | name         | prep                  | note           |
|------------------------------------|----------|---------|--------------|-----------------------|----------------|
| `2 tbsp olive oil`                 | `2`      | `tbsp`  | `olive oil`  | `null`                | `null`         |
| `1 avocado, sliced`                | `1`      | `null`  | `avocado`    | `sliced`              | `null`         |
| `Salt and pepper to taste`         | `null`   | `null`  | `salt and pepper to taste` | `null`    | `null`         |
| `2 cans (15 oz each) chickpeas, drained` | `2` | `can`  | `chickpeas`  | `drained`             | `15 oz each`   |
| `½ cup tahini`                     | `0.5`    | `cup`   | `tahini`     | `null`                | `null`         |
| `1 ½ cups flour`                   | `1.5`    | `cup`   | `flour`      | `null`                | `null`         |
| `Pinch of cayenne`                 | `null`   | `null`  | `pinch of cayenne` | `null`           | `null`         |

### Unparseable Lines

If a line cannot be meaningfully parsed (no recognizable structure), return a `ParsedIngredient` with `quantity: null`, `unit: null`, `name` set to the full trimmed line, and `prep: null`. The raw field always preserves the original for display fallback.

---

## Unit System

### Known Units

The engine recognizes common cooking units and normalizes them to a canonical form:

| Canonical | Aliases                                    | Type     |
|-----------|--------------------------------------------|----------|
| `tsp`     | `teaspoon`, `teaspoons`, `t`               | volume   |
| `tbsp`    | `tablespoon`, `tablespoons`, `T`, `tbs`    | volume   |
| `cup`     | `cups`, `c`                                | volume   |
| `fl oz`   | `fluid ounce`, `fluid ounces`              | volume   |
| `ml`      | `milliliter`, `milliliters`, `mL`          | volume   |
| `l`       | `liter`, `liters`, `L`                     | volume   |
| `oz`      | `ounce`, `ounces`                          | weight   |
| `lb`      | `pound`, `pounds`, `lbs`                   | weight   |
| `g`       | `gram`, `grams`                            | weight   |
| `kg`      | `kilogram`, `kilograms`                    | weight   |
| `can`     | `cans`                                     | count    |
| `clove`   | `cloves`                                   | count    |
| `slice`   | `slices`                                   | count    |
| `piece`   | `pieces`, `pcs`                            | count    |
| `bunch`   | `bunches`                                  | count    |
| `sprig`   | `sprigs`                                   | count    |
| `pinch`   | `pinches`                                  | volume   |
| `dash`    | `dashes`                                   | volume   |

Unit matching is **case-insensitive**. Unrecognized units are preserved as-is.

### Unit Conversion

The engine can convert within the same measurement type to enable aggregation:

**Volume conversions (US customary):**

| From    | To     | Factor       |
|---------|--------|--------------|
| `tsp`   | `tbsp` | ÷ 3         |
| `tbsp`  | `cup`  | ÷ 16        |
| `cup`   | `fl oz`| × 8         |
| `ml`    | `l`    | ÷ 1000      |

**Weight conversions:**

| From  | To   | Factor  |
|-------|------|---------|
| `oz`  | `lb` | ÷ 16    |
| `g`   | `kg` | ÷ 1000  |

### Conversion Strategy

Conversion is only applied during **aggregation** to combine compatible quantities. The rules:

1. Only convert within the same type (volume↔volume, weight↔weight). Never convert weight↔volume.
2. Convert to the **larger unit** when the total quantity exceeds a natural threshold:
   - `tsp` → `tbsp` when total ≥ 3 tsp
   - `tbsp` → `cup` when total ≥ 4 tbsp (¼ cup)
   - `oz` → `lb` when total ≥ 16 oz
   - `g` → `kg` when total ≥ 1000 g
   - `ml` → `l` when total ≥ 1000 ml
3. Keep mixed-unit results readable: `1 ¼ cups` instead of `1.25 cups` or `20 tbsp`.
4. If two ingredients use incompatible units (e.g., `1 cup flour` + `200g flour`), list them as **separate line items** — do not cross-convert volume↔weight.

---

## Recipe Scaling

### Scaling Model

Users can adjust the target servings for each recipe in their shopping list. The engine scales ingredient quantities proportionally:

```typescript
interface ScalingRequest {
  recipeId: string;
  targetServings: number;  // Must be a positive number
}
```

### Scaling Calculation

```
scaledQuantity = originalQuantity × (targetServings / recipe.servings.default)
```

### Scaling Rules

1. **Null quantities** — Ingredients with `quantity: null` (e.g., "Salt and pepper to taste") are not scaled. They appear once regardless of scaling.
2. **Rounding** — Scaled quantities are rounded to the nearest friendly fraction:
   - Round to nearest ¼ for quantities ≥ 1 (e.g., 2.33 → 2 ¼)
   - Round to nearest ⅛ for quantities < 1 (e.g., 0.37 → ⅜)
   - Never display more than 2 decimal places as a fallback
3. **Zero or negative** — If scaling results in quantity ≤ 0, show the ingredient with quantity `null` (display raw line).
4. **Scaling factor limits** — The engine supports scaling from 0.25× to 10× the original. Values outside this range return a validation error.

### Friendly Fraction Display

For display, decimal values are converted to common fractions where possible:

| Decimal | Display |
|---------|---------|
| `0.125` | `⅛`    |
| `0.25`  | `¼`    |
| `0.333` | `⅓`    |
| `0.5`   | `½`    |
| `0.667` | `⅔`    |
| `0.75`  | `¾`    |
| `1.5`   | `1 ½`  |
| `2.25`  | `2 ¼`  |

---

## Multi-Recipe Aggregation

### Input

Users build a shopping list by selecting multiple recipes, each with an optional scaling:

```typescript
interface ShoppingListRequest {
  items: {
    recipeId: string;
    targetServings?: number;  // Default: recipe's default servings
  }[];
}
```

### Aggregation Pipeline

1. **Resolve recipes** — Fetch each recipe's ingredient list and servings metadata. Return 404 for missing recipes.
2. **Parse ingredients** — Parse each recipe's `## Ingredients` section into `ParsedIngredient[]`.
3. **Scale** — Apply per-recipe scaling to each parsed ingredient.
4. **Normalize names** — Normalize ingredient names for matching (see Deduplication below).
5. **Group by name** — Group ingredients with matching normalized names.
6. **Merge quantities** — For each group, aggregate quantities when units are compatible.
7. **Format output** — Produce the final shopping list with display-friendly quantities.

### Output Structure

```typescript
interface ShoppingList {
  items: ShoppingListItem[];
  recipes: ShoppingListRecipeRef[];  // Source recipes for reference
}

interface ShoppingListItem {
  name: string;                  // Display name (from most common variant)
  quantity: string | null;       // Formatted display quantity (e.g., "2 ½ cups")
  unit: string | null;           // Display unit
  sources: {                     // Which recipes need this ingredient
    recipeId: string;
    recipeTitle: string;
    originalLine: string;        // Raw ingredient line for reference
  }[];
  checked: boolean;              // For UI check-off (default false)
  category: string | null;       // Aisle/category grouping (future)
}

interface ShoppingListRecipeRef {
  recipeId: string;
  title: string;
  servings: number;              // Actual servings used (after scaling)
}
```

---

## Deduplication

### Name Normalization

To match ingredients across recipes, the engine normalizes names before comparison:

1. **Lowercase** — `Olive Oil` → `olive oil`
2. **Trim whitespace** — Remove leading/trailing spaces.
3. **Remove articles** — Strip leading `a `, `an `, `the `.
4. **Singularize** — Basic singularization: `tomatoes` → `tomato`, `potatoes` → `potato`, `berries` → `berry`. Use a simple suffix-based approach, not a full NLP stemmer.
5. **Strip modifiers** — Remove common modifiers that don't change the base ingredient: `fresh`, `dried`, `frozen`, `organic`, `large`, `medium`, `small`, `whole`.

The normalization produces a **match key**. The original display name is preserved from the most common (or first encountered) variant.

### Merge Rules

When two ingredients have the same match key:

1. **Compatible units** — Same unit or convertible units (within type). Quantities are summed and optionally converted up.
2. **Incompatible units** — Different unit types (e.g., cups vs. grams) or one has a unit and one doesn't. List as **separate line items** under the same name with a note about the source recipe.
3. **Both null quantity** — Merge into a single line. Show once.
4. **One null, one numeric** — Keep as separate lines. The null-quantity item (e.g., "salt to taste") is not mergeable.

### Merge Examples

| Recipe A              | Recipe B             | Merged Result        |
|-----------------------|----------------------|----------------------|
| `2 cups flour`        | `1 ½ cups flour`     | `3 ½ cups flour`     |
| `3 tbsp olive oil`    | `2 tbsp olive oil`   | `5 tbsp olive oil`   |
| `1 tsp salt`          | `2 tsp salt`         | `1 tbsp salt`        |
| `1 cup milk`          | `200 ml milk`        | `1 cup milk` + `200 ml milk` (separate) |
| `2 cloves garlic`     | `3 cloves garlic`    | `5 cloves garlic`    |
| `Salt to taste`       | `Salt to taste`      | `Salt to taste`      |
| `Salt to taste`       | `1 tsp salt`         | `Salt to taste` + `1 tsp salt` (separate) |

---

## Shopping List Persistence

### Storage

Shopping lists are **ephemeral by default** — generated on demand from the selected recipes and servings. The API returns a computed shopping list; the client manages check-off state locally.

### Future: Saved Lists

A future iteration may add persistent shopping lists stored in the database. The engine is designed so that the `ShoppingList` output can be serialized to a database row without changes to the aggregation logic.

---

## API Integration

### Endpoint

The shopping list is generated via a POST endpoint:

```
POST /api/v1/shopping-list
```

**Request body:**

```json
{
  "items": [
    { "recipeId": "01J5K...", "targetServings": 6 },
    { "recipeId": "01J6M...", "targetServings": 2 }
  ]
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "name": "olive oil",
        "quantity": "5",
        "unit": "tbsp",
        "sources": [
          { "recipeId": "01J5K...", "recipeTitle": "Crispy Chickpea Bowl", "originalLine": "2 tbsp olive oil" },
          { "recipeId": "01J6M...", "recipeTitle": "Pasta Aglio e Olio", "originalLine": "3 tbsp olive oil" }
        ],
        "checked": false,
        "category": null
      }
    ],
    "recipes": [
      { "recipeId": "01J5K...", "title": "Crispy Chickpea Bowl", "servings": 6 },
      { "recipeId": "01J6M...", "title": "Pasta Aglio e Olio", "servings": 2 }
    ]
  },
  "requestId": "01J7..."
}
```

### Validation

| Rule                               | Error Code                    | Status |
|------------------------------------|-------------------------------|--------|
| `items` array is empty             | `EMPTY_SHOPPING_LIST`         | `400`  |
| `items` array exceeds 20 recipes   | `TOO_MANY_RECIPES`            | `400`  |
| `recipeId` not found               | `RECIPE_NOT_FOUND`            | `404`  |
| `targetServings` ≤ 0              | `INVALID_SERVINGS`            | `400`  |
| Scaling factor outside 0.25×–10×  | `SCALING_OUT_OF_RANGE`        | `400`  |
| Duplicate `recipeId` in request    | `DUPLICATE_RECIPE`            | `400`  |
| Request body missing or malformed  | `VALIDATION_ERROR`            | `400`  |

Authentication is required (same as recipe write endpoints).

---

## Performance Considerations

- **Parsing** — Ingredient parsing is CPU-bound string processing. For typical recipes (10–30 ingredients), parsing is negligible.
- **Multi-recipe** — With a 20-recipe limit and ~30 ingredients each, the engine processes at most ~600 ingredient lines — well within acceptable latency.
- **No caching** — Shopping lists are computed fresh on each request. Caching is unnecessary given the low computation cost and the dynamic nature of recipe selections.

---

## Error Handling

| Scenario                                 | Status | Error Code              |
|------------------------------------------|--------|-------------------------|
| Recipe has no `## Ingredients` section   | `200`  | N/A — return empty items for that recipe with a warning |
| Ingredient line completely unparseable   | `200`  | N/A — include as raw line with null quantity/unit |
| All recipes missing                      | `404`  | `RECIPE_NOT_FOUND`      |
| Partial recipe missing (some found)      | `404`  | `RECIPE_NOT_FOUND` (fail fast on first missing) |

Parsing is best-effort: the engine never fails on bad ingredient lines. Unparseable lines are included verbatim so the user can still see them.

All errors follow the standard error envelope from `specs/backend-architecture.md`.
