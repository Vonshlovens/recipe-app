# Recipe Editor

> Markdown + YAML frontmatter editing UX, tag input, live preview, validation feedback.

---

## Overview

The recipe editor is the primary interface for creating and editing recipes. It provides a split-pane experience with a structured form for frontmatter fields alongside a Markdown editor for the recipe body. A live preview panel shows the rendered recipe as it will appear to readers. The editor handles both the "create new recipe" and "edit existing recipe" flows.

This spec builds on:
- [recipe-data-model.md](./recipe-data-model.md) — the canonical schema, validation rules, and tag taxonomy
- [ui-components.md](./ui-components.md) — shared component APIs and design tokens
- [frontend-architecture.md](./frontend-architecture.md) — routing, layout, and state management patterns

---

## Routes

| Route                       | Purpose              | Auth Required |
|-----------------------------|----------------------|---------------|
| `/recipes/new`              | Create a new recipe  | Yes           |
| `/recipes/[slug]/edit`      | Edit existing recipe | Yes (owner)   |

Both routes render the same `RecipeEditor` component with different initial state.

---

## Page Layout

### Desktop (≥ 1024px)

Two-column layout with a collapsible preview panel:

```
┌─────────────────────────────────┬──────────────────────────┐
│  Editor Form                    │  Live Preview            │
│  ┌───────────────────────────┐  │  ┌──────────────────────┐│
│  │ Title                     │  │  │ RecipeHeader         ││
│  │ [________________________]│  │  │                      ││
│  │                           │  │  │ IngredientList       ││
│  │ Metadata Fields           │  │  │                      ││
│  │ (difficulty, times, etc.) │  │  │ InstructionSteps     ││
│  │                           │  │  │                      ││
│  │ Tags                      │  │  │ Notes                ││
│  │ [tag input chips]         │  │  │                      ││
│  │                           │  │  └──────────────────────┘│
│  │ Markdown Body             │  │                          │
│  │ ┌────────────────────────┐│  │                          │
│  │ │ Tabs: Edit | Preview   ││  │                          │
│  │ │                        ││  │                          │
│  │ │ ## Ingredients          ││  │                          │
│  │ │ - 2 cups flour         ││  │                          │
│  │ │ - 1 tsp salt           ││  │                          │
│  │ │                        ││  │                          │
│  │ │ ## Instructions         ││  │                          │
│  │ │ 1. Mix dry ingredients ││  │                          │
│  │ └────────────────────────┘│  │                          │
│  │                           │  │                          │
│  │ [Save] [Cancel]           │  │                          │
│  └───────────────────────────┘  │                          │
└─────────────────────────────────┴──────────────────────────┘
```

- Editor form: 60% width
- Preview panel: 40% width, toggleable via button
- Preview panel collapses to a floating toggle button when hidden

### Tablet (768px–1023px)

Single column with a tabs-based toggle between Edit and Preview modes. The preview is full-width when active.

### Mobile (< 768px)

Single column, edit-only by default. Preview accessible via a "Preview" tab above the Markdown body area.

---

## Editor Form Fields

### Title

```typescript
// Field: title
// Component: Input (shadcn)
// Validation: 1–200 characters, required
```

- Large text input (`text-2xl font-semibold`)
- Placeholder: "Recipe title"
- Character count displayed below (e.g., "42 / 200")
- Validation error shown on blur if empty or over 200 characters

### Author

```typescript
// Field: author
// Component: Input (shadcn)
// Validation: optional, max 100 characters
```

- Standard text input
- Placeholder: "Author name (optional)"

### Difficulty

```typescript
// Field: difficulty
// Component: Select (shadcn)
// Values: "easy" | "medium" | "hard" | undefined
```

- Dropdown with options: Easy, Medium, Hard
- Optional — includes a "None" / clear option

### Time Fields

```typescript
// Fields: prepTime, cookTime
// Component: DurationInput (custom)
// Format: stores ISO 8601 duration (e.g., "PT30M"), displays as hours + minutes inputs
```

- Two numeric fields per duration: hours (0–99) and minutes (0–59)
- `totalTime` is calculated automatically and shown as read-only when both prep and cook are provided
- If only one time field is filled, `totalTime` is not auto-calculated

### Servings

```typescript
// Field: servings
// Component: Input (number) + Input (text)
// Validation: default > 0 (required), unit is optional
```

- Numeric input for `servings.default` (min: 1)
- Text input for `servings.unit` (e.g., "servings", "bowls", "pieces")
- Placeholder for unit: "servings"

### Source

```typescript
// Field: source
// Display-only for "import" and "ocr" types
// Editable for "manual" type (default on create)
```

- On create: `source.type` is set to `"manual"` automatically
- On edit for imported/OCR recipes: source info is displayed read-only with a link to the original URL
- Not directly editable by the user

---

## Tag Input

### Component: `TagInput.svelte`

Location: `$lib/components/recipe/TagInput.svelte`

```typescript
interface TagInputProps {
  tags: Record<string, string[]>;   // current tags by group
  onchange: (tags: Record<string, string[]>) => void;
}
```

### Behavior

- One section per tag group: Cuisine, Meal, Diet, Technique, Custom
- Each section has a text input with autocomplete for existing tag values
- Type a value and press Enter or comma to add a tag chip
- Click the X on a chip to remove the tag
- Tags are validated on entry: must match `/^[a-z0-9-]{1,50}$/`
- Invalid characters are stripped on input (uppercase auto-lowered, spaces converted to hyphens)
- Max 20 tags per group — input is disabled when limit is reached
- Each tag group section is collapsible, with a count badge showing the number of tags

### Autocomplete

- Fetches available tags from `GET /api/v1/tags/:group`
- Displays matches as a dropdown below the input
- Shows usage count next to each suggestion
- Filters suggestions as the user types
- Keyboard navigation (arrow keys + Enter to select)

---

## Markdown Body Editor

### Component: `MarkdownEditor.svelte`

Location: `$lib/components/recipe/MarkdownEditor.svelte`

```typescript
interface MarkdownEditorProps {
  value: string;
  onchange: (value: string) => void;
  errors: string[];
}
```

### Features

- Large `<textarea>` with monospace font (`font-mono`)
- Tab key inserts two spaces (not focus change)
- Minimum height: 400px, resizable vertically
- Line numbers displayed in a gutter (CSS-based, not editable)

### Toolbar

A toolbar above the textarea with formatting shortcuts:

| Button     | Action                              | Shortcut        |
|------------|-------------------------------------|-----------------|
| Bold       | Wrap selection with `**`            | `Ctrl/Cmd + B`  |
| Italic     | Wrap selection with `_`             | `Ctrl/Cmd + I`  |
| Heading    | Insert `## ` at line start         | `Ctrl/Cmd + H`  |
| UL Item    | Insert `- ` at line start          | `Ctrl/Cmd + U`  |
| OL Item    | Insert `1. ` at line start         | `Ctrl/Cmd + O`  |
| Link       | Wrap selection with `[](url)`       | `Ctrl/Cmd + K`  |

### Template

When creating a new recipe, the body is pre-populated with:

```markdown
## Ingredients

-

## Instructions

1.

## Notes

```

### Inline Preview Tab

The Markdown body area supports an Edit / Preview tab toggle (using shadcn `Tabs`):

- **Edit tab**: shows the textarea
- **Preview tab**: renders the Markdown as HTML using the same renderer as the recipe viewer

---

## Live Preview Panel

### Component: `RecipePreview.svelte`

Location: `$lib/components/recipe/RecipePreview.svelte`

```typescript
interface RecipePreviewProps {
  title: string;
  author?: string;
  difficulty?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings: { default: number; unit?: string };
  tags: Record<string, string[]>;
  body: string;
}
```

### Behavior

- Updates in real-time as the user edits (debounced by 300ms for Markdown rendering)
- Uses the same recipe display components from `ui-components.md`:
  - `RecipeHeader` for metadata
  - `IngredientList` for ingredients
  - `InstructionSteps` for instructions
- Scrollable independently from the editor form
- Shows a "Preview" label header with a collapse/expand toggle

---

## Validation

### Client-Side Validation

Validation runs on field blur and on save attempt. Errors are displayed inline below the relevant field.

| Field          | Rule                                           | Error Message                              |
|----------------|------------------------------------------------|--------------------------------------------|
| `title`        | Required, 1–200 chars                          | "Title is required" / "Title must be under 200 characters" |
| `servings`     | `default` must be a positive integer           | "Servings must be at least 1"              |
| `prepTime`     | If set, hours and minutes must be non-negative  | "Invalid prep time"                        |
| `cookTime`     | If set, hours and minutes must be non-negative  | "Invalid cook time"                        |
| `difficulty`   | Must be one of the allowed values if set       | "Invalid difficulty"                       |
| `tags`         | Each value: `/^[a-z0-9-]{1,50}$/`, max 20/group | "Invalid tag format" / "Maximum 20 tags per group" |
| `body`         | Must contain `## Ingredients` with ≥1 list item | "Ingredients section is required with at least one item" |
| `body`         | Must contain `## Instructions` with ≥1 list item | "Instructions section is required with at least one item" |
| `body`         | Max 50,000 characters                          | "Recipe body is too long (max 50,000 characters)" |

### Server-Side Validation

The API performs the same validations. If the server returns a `400` with validation errors, those errors are mapped to the corresponding form fields and displayed inline.

### Validation UX

- Fields with errors show a red border and error text below (`text-destructive text-sm`)
- The save button becomes disabled while there are validation errors
- On save attempt with errors, the page scrolls to the first field with an error
- A toast notification is shown for server-side errors that don't map to specific fields

---

## Save Flow

### Create Recipe (`POST /api/v1/recipes`)

1. User fills in fields and clicks "Save"
2. Client-side validation runs
3. Form data is assembled into a request body:
   - `title`, `author`, `difficulty`, `prepTime`, `cookTime`, `servings`, `tags` from form fields
   - `body` from Markdown editor
   - `source: { type: "manual" }` set automatically
4. `POST /api/v1/recipes` is called
5. On success: toast "Recipe created!", redirect to `/recipes/[slug]`
6. On validation error: display inline field errors
7. On other error: display error toast

### Edit Recipe (`PUT /api/v1/recipes/:slug`)

1. Page loads with existing recipe data pre-filled
2. User makes changes and clicks "Save"
3. Same client-side validation as create
4. `PUT /api/v1/recipes/:slug` is called with the full updated recipe
5. On success: toast "Recipe updated!", redirect to `/recipes/[slug]`
6. On `404`: toast "Recipe not found"
7. On validation error: display inline field errors

### Unsaved Changes Guard

- Track whether any field has been modified since load (dirty state)
- On navigation away with unsaved changes, show a `ConfirmDialog`:
  - Title: "Unsaved changes"
  - Description: "You have unsaved changes. Are you sure you want to leave?"
  - Confirm: "Leave" (destructive variant)
  - Cancel: "Stay"
- Uses `beforeNavigate` from SvelteKit's `$app/navigation`

---

## Keyboard Shortcuts

| Shortcut          | Action                     |
|-------------------|----------------------------|
| `Ctrl/Cmd + S`    | Save recipe                |
| `Ctrl/Cmd + P`    | Toggle preview panel       |
| `Escape`          | Close preview panel        |

These shortcuts are registered on the page and prevented from triggering browser defaults.

---

## Loading States

| State                     | Display                                            |
|---------------------------|----------------------------------------------------|
| Loading recipe (edit mode)| Skeleton placeholders for all form fields           |
| Saving                    | Save button shows spinner, form inputs disabled     |
| Tag autocomplete loading  | Skeleton list items in dropdown                     |

---

## Error States

| Error                     | Display                                            |
|---------------------------|----------------------------------------------------|
| Recipe not found (edit)   | Redirect to `/recipes` with "Recipe not found" toast |
| Not authorized (edit)     | Redirect to `/auth/login`                           |
| Not owner (edit)          | Redirect to `/recipes/[slug]` with "Not authorized" toast |
| Save failed (network)     | Error toast: "Failed to save. Please try again."   |
| Save failed (validation)  | Inline field errors + scroll to first error        |

---

## Component File Structure

```
$lib/components/recipe/
├── RecipeEditor.svelte        # Main editor orchestrator
├── TagInput.svelte            # Tag input with autocomplete
├── MarkdownEditor.svelte      # Markdown textarea with toolbar
├── MarkdownToolbar.svelte     # Formatting toolbar buttons
├── DurationInput.svelte       # Hours + minutes duration picker
└── RecipePreview.svelte       # Live preview panel
```

---

## Accessibility

- All form fields have associated `<label>` elements
- Validation errors are linked via `aria-describedby`
- Tag chips are keyboard-navigable (arrow keys to move, Backspace/Delete to remove)
- The Markdown toolbar buttons have `aria-label` and tooltips
- Tab key behavior in textarea is announced ("Tab inserts spaces; use Escape then Tab to move focus")
- Preview panel toggle is keyboard accessible
- Focus management: on save error, focus moves to the first invalid field
