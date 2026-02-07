# Recipe Data Model

> Canonical recipe schema, YAML frontmatter spec, markdown body format, tag taxonomy, and validation rules.

---

## Overview

Every recipe in the app is stored as a structured document combining YAML frontmatter (metadata) with a Markdown body (instructions). This spec defines the canonical shape of that document, validation constraints, and the tag taxonomy.

---

## Recipe Document Format

Recipes are stored as Markdown files with YAML frontmatter, enabling both human readability and structured querying.

```markdown
---
id: "01J5K..."
title: "Crispy Chickpea Bowl"
slug: "crispy-chickpea-bowl"
author: "Jane Doe"
source:
  type: "import"        # "manual" | "import" | "ocr"
  url: "https://example.com/recipe/chickpea-bowl"
  importedAt: "2026-01-15T10:30:00Z"
tags:
  cuisine: ["mediterranean"]
  meal: ["lunch", "dinner"]
  diet: ["vegan", "gluten-free"]
  technique: ["roasting"]
  custom: ["meal-prep", "quick"]
servings:
  default: 4
  unit: "bowls"
prepTime: "PT15M"
cookTime: "PT25M"
totalTime: "PT40M"
difficulty: "easy"
createdAt: "2026-01-15T10:30:00Z"
updatedAt: "2026-01-15T10:30:00Z"
---

## Ingredients

- 2 cans (15 oz each) chickpeas, drained and rinsed
- 2 tbsp olive oil
- 1 tsp smoked paprika
- ½ tsp garlic powder
- Salt and pepper to taste
- 4 cups cooked rice
- 2 cups baby spinach
- 1 avocado, sliced
- Tahini dressing (see note)

## Instructions

1. Preheat oven to 425°F (220°C).
2. Toss chickpeas with olive oil, paprika, garlic powder, salt, and pepper.
3. Spread on a baking sheet and roast for 25 minutes until crispy.
4. Divide rice among bowls and top with spinach, chickpeas, and avocado.
5. Drizzle with tahini dressing.

## Notes

For the tahini dressing: whisk ¼ cup tahini, 2 tbsp lemon juice, 1 tbsp maple syrup, and water to thin.
```

---

## Schema Fields

### Required Fields

| Field       | Type     | Description                                      |
|-------------|----------|--------------------------------------------------|
| `id`        | `string` | ULID. Generated on creation, immutable.          |
| `title`     | `string` | Human-readable recipe name. 1–200 characters.    |
| `slug`      | `string` | URL-safe identifier derived from title. Unique.   |
| `tags`      | `object` | Tag groups (see Tag Taxonomy below).              |
| `servings`  | `object` | `{ default: number, unit?: string }`.             |
| `createdAt` | `string` | ISO 8601 datetime. Set on creation, immutable.    |
| `updatedAt` | `string` | ISO 8601 datetime. Updated on every save.         |

### Optional Fields

| Field        | Type     | Description                                         |
|--------------|----------|-----------------------------------------------------|
| `author`     | `string` | Recipe author or contributor name.                  |
| `source`     | `object` | Origin info: `{ type, url?, importedAt? }`.         |
| `prepTime`   | `string` | ISO 8601 duration (e.g., `"PT15M"`).                |
| `cookTime`   | `string` | ISO 8601 duration.                                  |
| `totalTime`  | `string` | ISO 8601 duration. Auto-calculated if both prep and cook provided. |
| `difficulty` | `string` | One of `"easy"`, `"medium"`, `"hard"`.              |
| `image`      | `string` | Path or URL to hero image.                          |

---

## Markdown Body Structure

The body below the frontmatter uses standard Markdown with these conventional sections:

### Required Sections

- **`## Ingredients`** — Unordered list of ingredients. Each item is a single line. Sub-lists may group by recipe component (e.g., "For the dressing:").
- **`## Instructions`** — Ordered list of steps.

### Optional Sections

- **`## Notes`** — Freeform tips, substitutions, storage info.
- **`## Variations`** — Named alternatives or modifications.

Section headings must be `##` level (h2). Order should follow: Ingredients → Instructions → Notes → Variations.

---

## Ingredient Line Format

Each ingredient line follows a loose structure for display, but must be parseable for the shopping list engine:

```
<quantity> <unit> <name>[, <prep>]
```

Examples:
- `2 tbsp olive oil`
- `1 avocado, sliced`
- `Salt and pepper to taste`
- `2 cans (15 oz each) chickpeas, drained and rinsed`

The shopping list engine (see `specs/shopping-list-engine.md`) is responsible for parsing these lines. The data model does **not** require structured ingredient objects in the frontmatter — ingredients live in the Markdown body only.

---

## Tag Taxonomy

Tags are organized into named groups. Each group contains an array of lowercase, hyphenated strings.

### Built-in Tag Groups

| Group       | Purpose                        | Example Values                                |
|-------------|--------------------------------|-----------------------------------------------|
| `cuisine`   | Cultural/regional origin       | `mediterranean`, `japanese`, `mexican`, `indian` |
| `meal`      | Meal type / occasion           | `breakfast`, `lunch`, `dinner`, `snack`, `dessert` |
| `diet`      | Dietary classification         | `vegan`, `vegetarian`, `gluten-free`, `dairy-free`, `keto`, `paleo` |
| `technique` | Primary cooking technique      | `roasting`, `grilling`, `stir-fry`, `no-cook`, `slow-cooker` |
| `custom`    | User-defined freeform tags     | `meal-prep`, `quick`, `kid-friendly`, `holiday` |

### Tag Rules

- Tag values: lowercase, alphanumeric + hyphens only. Max 50 characters.
- Each group can hold 0–20 tags.
- `custom` is the catch-all for tags that don't fit built-in groups.
- New built-in groups may be added in future versions; unknown groups are treated as `custom`.

---

## Validation Rules

### Frontmatter Validation

1. `id` — Must be a valid ULID.
2. `title` — Non-empty string, 1–200 characters.
3. `slug` — Lowercase alphanumeric + hyphens, 1–100 characters, unique across all recipes.
4. `servings.default` — Positive integer.
5. `prepTime`, `cookTime`, `totalTime` — Valid ISO 8601 duration if present.
6. `difficulty` — One of `"easy"`, `"medium"`, `"hard"` if present.
7. `source.type` — One of `"manual"`, `"import"`, `"ocr"` if `source` is present.
8. `tags` — Each group value must be an array of strings matching `/^[a-z0-9-]{1,50}$/`.
9. `createdAt`, `updatedAt` — Valid ISO 8601 datetime strings.

### Body Validation

1. Must contain an `## Ingredients` section with at least one list item.
2. Must contain an `## Instructions` section with at least one list item.
3. Total body size must not exceed 50,000 characters.

### On Save

- `updatedAt` is set to the current time.
- `slug` is regenerated from `title` if title changed, with collision avoidance (append `-2`, `-3`, etc.).
- `totalTime` is recalculated from `prepTime + cookTime` if both are present and `totalTime` is not explicitly set.

---

## ID Generation

Recipes use [ULID](https://github.com/ulid/spec) for identifiers:

- Sortable by creation time.
- No coordination required (no auto-increment).
- URL-safe, 26 characters.

---

## Storage Considerations

The canonical format is the Markdown+frontmatter file described above. The database layer (see `specs/database.md`) is responsible for indexing frontmatter fields for queries while storing the full document. The Markdown source is the single source of truth.
