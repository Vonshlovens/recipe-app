# Recipe Viewer

> Recipe display, scaling controls, ingredient list rendering, print/share view.

---

## Overview

The recipe viewer is the primary read-only display for a single recipe. It renders the full recipe — metadata header, ingredient list with interactive scaling, step-by-step instructions, and optional notes — in a clean, readable layout. The viewer also provides print-optimized and share-ready views.

This spec builds on:
- [recipe-data-model.md](./recipe-data-model.md) — the canonical schema, validation rules, and tag taxonomy
- [ui-components.md](./ui-components.md) — shared component APIs (RecipeHeader, IngredientList, InstructionSteps, ScalingControl, TagBadgeList)
- [frontend-architecture.md](./frontend-architecture.md) — routing, layout, and state management patterns
- [shopping-list-engine.md](./shopping-list-engine.md) — ingredient parsing and scaling math

---

## Route

| Route                  | Purpose              | Auth Required |
|------------------------|----------------------|---------------|
| `/recipes/[slug]`      | View a single recipe | No            |

---

## Page Data Loading

### `+page.server.ts`

```typescript
// GET /api/v1/recipes/:slug
// Returns full recipe object including parsed Markdown body
// On 404: throw error(404, 'Recipe not found')
```

- Fetches the recipe by slug from the API
- Passes the full recipe object to the page component
- If the current user owns the recipe, passes `isOwner: true` for edit/delete controls

---

## Page Layout

### Desktop (>= 1024px)

```
┌──────────────────────────────────────────────────────────┐
│  RecipeHeader                                            │
│  (title, source, difficulty, times, servings, tags)      │
├────────────────────────────────┬─────────────────────────┤
│  Ingredients                   │  Instructions            │
│  ┌──────────────────────────┐  │  ┌─────────────────────┐│
│  │ ScalingControl           │  │  │ 1. Step one text    ││
│  │ [−] 4 servings [+] ↺    │  │  │                     ││
│  │                          │  │  │ 2. Step two text    ││
│  │ ☐ 2 cups flour          │  │  │                     ││
│  │ ☐ 1 tsp salt            │  │  │ 3. Step three text  ││
│  │ ☐ 3 eggs                │  │  │                     ││
│  └──────────────────────────┘  │  └─────────────────────┘│
├────────────────────────────────┴─────────────────────────┤
│  Notes (if present)                                      │
├──────────────────────────────────────────────────────────┤
│  ActionBar                                               │
│  [Print] [Share] [Add to Shopping List]                   │
│  [Edit] [Delete]  ← only if isOwner                      │
└──────────────────────────────────────────────────────────┘
```

- Ingredients sidebar: 35% width, sticky within viewport
- Instructions main content: 65% width
- Notes section: full width below the two-column area

### Tablet (768px–1023px)

Single column layout. Ingredients and instructions stack vertically. Ingredients section is collapsible (expanded by default).

### Mobile (< 768px)

Single column layout. Ingredients section is collapsible (collapsed by default with a summary showing ingredient count). Sticky "Jump to Instructions" floating button when ingredients are expanded.

---

## Components

### RecipeHeader

Uses the shared `RecipeHeader` component from `ui-components.md` with the full recipe metadata:

- Title (h1)
- Source attribution (link to original URL for imported recipes, "OCR capture" badge for OCR recipes)
- Difficulty badge
- Time breakdown: prep, cook, total (displayed as human-readable, e.g., "30 min", "1 hr 15 min")
- Servings display (current scaled value with unit)
- Tag badges grouped by category

### Ingredient List

Uses the shared `IngredientList` component with scaling support:

```typescript
interface RecipeViewerIngredientProps {
  ingredients: string[];        // raw Markdown list items
  defaultServings: number;      // recipe's default servings
  currentServings: number;      // user's selected servings
}
```

- Each ingredient rendered as a checkbox item
- Quantities are scaled based on `currentServings / defaultServings` ratio
- Checked items get strikethrough styling (`line-through opacity-50`)
- Check state is local only (not persisted)
- Ingredient groups (if the body uses multiple `### Sub-heading` sections under `## Ingredients`) are rendered with sub-headings

### Scaling Control

Uses the shared `ScalingControl` component:

- Positioned above the ingredient list
- Decrement (−) and increment (+) buttons
- Current serving count display with unit
- Reset button (↺) to return to default servings
- Constraints: min 1, max 100
- Scaling updates ingredient quantities in real-time

### Instruction Steps

Uses the shared `InstructionSteps` component:

- Numbered ordered list
- Each step is a distinct block with generous spacing
- Optional step completion checkboxes (local state only)
- Long steps wrap naturally

### Notes Section

- Rendered from the `## Notes` section of the Markdown body (if present)
- Standard Markdown rendering (paragraphs, lists, links, bold/italic)
- Visually separated from instructions with a divider and "Notes" heading
- Collapsed by default on mobile

---

## Action Bar

### Component: `RecipeActionBar.svelte`

Location: `$lib/components/recipe/RecipeActionBar.svelte`

```typescript
interface RecipeActionBarProps {
  slug: string;
  title: string;
  isOwner: boolean;
  currentServings: number;
}
```

### Actions

| Action               | Button    | Behavior                                                   |
|----------------------|-----------|------------------------------------------------------------|
| Print                | "Print"   | Opens browser print dialog with print-optimized styles     |
| Share                | "Share"   | Copies recipe URL to clipboard; shows toast "Link copied!" |
| Add to Shopping List | "Add to List" | Navigates to `/shopping-list?add=[slug]&servings=[n]` |
| Edit                 | "Edit"    | Navigates to `/recipes/[slug]/edit` (owner only)           |
| Delete               | "Delete"  | Opens ConfirmDialog, then `DELETE /api/v1/recipes/:slug`   |

### Delete Flow

1. User clicks "Delete"
2. `ConfirmDialog` opens:
   - Title: "Delete recipe"
   - Description: "Are you sure you want to delete **{title}**? This action cannot be undone."
   - Confirm: "Delete" (destructive variant)
   - Cancel: "Cancel"
3. On confirm: `DELETE /api/v1/recipes/:slug`
4. On success: toast "Recipe deleted", redirect to `/recipes`
5. On error: toast "Failed to delete recipe"

---

## Print View

### Styles

Print styles are applied via `@media print` in the page component:

- Hide: Navbar, Footer, ActionBar, ScalingControl, checkboxes, tag badges
- Show: title, source attribution, servings (current scaled value), ingredients (plain list), instructions (numbered list), notes
- Typography: serif font, 12pt base size
- Layout: single column, no background colors
- Page break: avoid breaking inside an instruction step
- Header: recipe title and source URL at the top of the first page

---

## Share

### URL Copy

- Uses the `navigator.clipboard.writeText()` API
- Copies the canonical URL: `{origin}/recipes/{slug}`
- Shows a toast notification: "Link copied to clipboard!"
- Fallback for browsers without clipboard API: select-and-copy prompt

### Native Share (Mobile)

- On devices supporting `navigator.share()`, the Share button uses the native share sheet instead of clipboard copy
- Shares: `{ title: recipe.title, url: canonicalUrl }`

---

## Scaling State

- Scaling is managed as local component state (`currentServings` rune)
- Initialized to `recipe.servings.default` on page load
- Persisted in the URL query parameter `?servings=N` so that:
  - Refreshing the page preserves the scaled view
  - The "Add to Shopping List" link includes the current scaling
  - Shared links can include a specific serving count
- URL is updated via `replaceState` (no history entry per scaling change)

---

## Loading States

| State                | Display                                            |
|----------------------|----------------------------------------------------|
| Recipe loading       | Skeleton placeholders for header, ingredients, instructions |
| Delete in progress   | Delete button shows spinner, other actions disabled |

---

## Error States

| Error                | Display                                            |
|----------------------|----------------------------------------------------|
| Recipe not found     | SvelteKit error page with 404 status               |
| Delete failed        | Error toast: "Failed to delete recipe. Please try again." |
| Share failed         | Error toast: "Failed to copy link"                 |

---

## Component File Structure

```
$lib/components/recipe/
├── RecipeActionBar.svelte     # Print, share, shopping list, edit, delete
src/routes/recipes/[slug]/
├── +page.svelte               # Recipe viewer page
├── +page.server.ts            # Recipe data loader
```

---

## Accessibility

- Recipe title is an `<h1>` element
- Ingredient checkboxes have associated labels with the full ingredient text
- Instruction steps use an `<ol>` with `<li>` elements
- ScalingControl buttons have `aria-label` ("Decrease servings", "Increase servings", "Reset servings")
- Print button has `aria-label="Print recipe"`
- Share button has `aria-label="Share recipe"`
- Delete confirmation dialog traps focus and is keyboard-dismissible
- Skip link at the top: "Skip to ingredients" / "Skip to instructions"
