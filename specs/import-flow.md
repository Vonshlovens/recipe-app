# Import Flow

> URL import UI, progress/status feedback, review and edit before save.

---

## Overview

The import flow provides the user-facing interface for importing recipes from external websites. The user pastes a URL, the system extracts recipe data via the server-side import pipeline (defined in [recipe-import.md](./recipe-import.md)), and presents the extracted draft for review and editing before saving.

This spec builds on:
- [recipe-import.md](./recipe-import.md) — server-side extraction pipeline, `POST /api/v1/recipes/import`
- [api-routes.md](./api-routes.md) — `POST /api/v1/recipes` (standard create endpoint for saving the reviewed draft)
- [recipe-editor.md](./recipe-editor.md) — editor components reused in the review step
- [ui-components.md](./ui-components.md) — shared UI components
- [frontend-architecture.md](./frontend-architecture.md) — routing, layout, state management

---

## Route

| Route             | Purpose                              | Auth Required |
|-------------------|--------------------------------------|---------------|
| `/recipes/import` | Import a recipe from a URL           | Yes           |

---

## User Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. URL      │────▶│  2. Loading  │────▶│  3. Review   │────▶│  4. Saved    │
│  Input       │     │  Progress    │     │  & Edit      │     │  Redirect    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
  Validation           Extraction           User edits
  errors               errors               draft recipe
```

### Step 1: URL Input

The user is presented with a single URL input field and a submit button.

- Input is a full-width text field with placeholder: `"Paste a recipe URL (e.g., https://example.com/recipe)"`
- Submit button labeled "Import Recipe"
- Client-side validation before submission:
  - URL must not be empty
  - URL must start with `http://` or `https://`
  - URL must not exceed 2,048 characters
- Validation errors appear inline below the input field
- The input field auto-focuses on page load

### Step 2: Loading / Progress

After submission, show a progress state while the server processes the URL.

```
┌────────────────────────────────────────────────┐
│                                                │
│         ◠  Importing recipe...                 │
│                                                │
│    Fetching page from example.com              │
│    ████████████░░░░░░░░░░░░░░  45%             │
│                                                │
│    This usually takes a few seconds.           │
│                                                │
│              [ Cancel ]                        │
│                                                │
└────────────────────────────────────────────────┘
```

- Show a spinner with status message: "Importing recipe..."
- Display the domain being fetched (extracted from the URL)
- Show an indeterminate progress bar (the pipeline is a single request, not multi-step)
- Provide a Cancel button that aborts the fetch via `AbortController`
- If the request takes longer than 5 seconds, show a reassurance message: "This usually takes a few seconds."
- Disable the URL input and submit button during loading

### Step 3: Review & Edit

On success, the extracted draft is presented in an editor form for the user to review and modify before saving. This reuses the `RecipeEditor` component from [recipe-editor.md](./recipe-editor.md) with import-specific additions.

#### Import-Specific Additions

- **Source banner** — A dismissible info banner at the top showing: "Imported from example.com via {extractionMethod}" with a link to the original URL
- **Confidence indicators** — Fields extracted with `low` confidence are highlighted with a warning border (amber) and a tooltip: "This field was extracted with low confidence. Please verify."
- **Warnings list** — If the import draft contains warnings, display them in a collapsible alert section above the form:
  - `MISSING_TITLE` — "No title could be extracted. Please add one."
  - `MISSING_INGREDIENTS` — "No ingredients were found. Please add them."
  - `MISSING_INSTRUCTIONS` — "No instructions were found. Please add them."
  - `LOW_CONFIDENCE_FIELD` — "Some fields were extracted with low confidence and may need correction."
  - `INVALID_DURATION` — "Cook/prep time could not be parsed and was left blank."
  - `UNPARSEABLE_YIELD` — "Servings could not be determined. Defaulting to 4."
  - `TRUNCATED_CONTENT` — "Recipe content was truncated to fit size limits."
  - `DUPLICATE_URL` — "A recipe from this URL already exists." (with link to existing recipe)

#### Pre-Populated Fields

All extracted fields are pre-filled in the editor form. The user can modify any field before saving.

- `source.type` is set to `"import"` (read-only, not user-editable)
- `source.url` is set to the original URL (read-only, not user-editable)

#### Save Flow

- The Save button calls `POST /api/v1/recipes` (standard create endpoint) with the reviewed/edited recipe data
- On success: show a success toast "Recipe imported!" and redirect to `/recipes/{slug}`
- On validation error: display inline errors (same as recipe-editor.md)
- On network error: show an error toast with retry option

#### Discard Flow

- A "Discard" button allows the user to abandon the import and return to the URL input step
- If the user has made edits, show a `ConfirmDialog`: "Discard imported recipe? Your edits will be lost."

### Step 4: Error States

#### Extraction Errors

When the import pipeline fails, show an error state in place of the review form:

```
┌────────────────────────────────────────────────┐
│                                                │
│    ⚠  Could not import recipe                  │
│                                                │
│    We couldn't extract a recipe from           │
│    example.com. This can happen if the site    │
│    doesn't include structured recipe data.     │
│                                                │
│    [ Try Another URL ]  [ Create Manually ]    │
│                                                │
└────────────────────────────────────────────────┘
```

Error messages by code:

| Error Code                      | User-Facing Message                                                              |
|---------------------------------|----------------------------------------------------------------------------------|
| `INVALID_IMPORT_URL`            | "That doesn't look like a valid URL. Please check and try again."                |
| `BLOCKED_IMPORT_URL`            | "That URL can't be used for importing recipes."                                  |
| `IMPORT_FETCH_FAILED`           | "Couldn't reach that website. Please check the URL and try again."               |
| `IMPORT_FETCH_TIMEOUT`          | "The website took too long to respond. Please try again later."                  |
| `IMPORT_SOURCE_ERROR`           | "The website returned an error. The recipe page may have moved or been removed." |
| `IMPORT_RESPONSE_TOO_LARGE`    | "The page is too large to process. Try a different recipe URL."                  |
| `IMPORT_TOO_MANY_REDIRECTS`    | "Too many redirects. Please try the direct recipe URL."                          |
| `IMPORT_NO_RECIPE_FOUND`        | "Couldn't find recipe data on that page. Not all websites include structured recipe data." |

All error states include:
- "Try Another URL" button — returns to Step 1 with the URL field pre-filled
- "Create Manually" button — navigates to `/recipes/new`

---

## Page Layout

### Desktop (>= 1024px)

**Step 1 — URL Input:**

```
┌──────────────────────────────────────────────────────────┐
│                   Import a Recipe                        │
│                                                          │
│  Paste a URL from any recipe website and we'll           │
│  extract the recipe for you.                             │
│                                                          │
│  ┌────────────────────────────────────────┐ ┌──────────┐│
│  │ https://                               │ │ Import   ││
│  └────────────────────────────────────────┘ └──────────┘│
│                                                          │
│  Supported: Most recipe websites with structured data.   │
└──────────────────────────────────────────────────────────┘
```

Centered card layout, max-width 640px. Simple and focused on the single input action.

**Step 3 — Review & Edit:**

Uses the full-width RecipeEditor layout from [recipe-editor.md](./recipe-editor.md) with the source banner and confidence indicators added.

### Mobile (< 768px)

- URL input spans full width
- Import button is full width below the input
- Review step uses the mobile RecipeEditor layout (single column, tab-based preview)

---

## State Management

The import flow uses local component state (runes) rather than a global store:

```typescript
type ImportStep = "input" | "loading" | "review" | "error";

let step: ImportStep = $state("input");
let url: string = $state("");
let draft: ImportDraft | null = $state(null);
let error: ImportError | null = $state(null);
let abortController: AbortController | null = $state(null);
```

- `step` drives which UI is rendered
- `draft` holds the extracted recipe data during review
- `error` holds error details for display
- `abortController` enables cancellation during loading

---

## Implementation Location

```
src/routes/recipes/import/
  +page.server.ts              # Auth guard (redirect to /auth/login if not authenticated)
  +page.svelte                 # Import flow page (URL input, loading, review, error)
src/lib/components/import/
  UrlInput.svelte              # URL input form with validation
  ImportProgress.svelte        # Loading spinner with cancel
  ImportReview.svelte          # Wraps RecipeEditor with import-specific additions
  ImportError.svelte           # Error state with retry/manual-create actions
  ConfidenceIndicator.svelte   # Amber warning border + tooltip for low-confidence fields
  ImportWarnings.svelte        # Collapsible warnings list
```

---

## Accessibility

- URL input has a visible label: "Recipe URL"
- Loading state announces "Importing recipe" to screen readers via `aria-live="polite"`
- Error states use `role="alert"` for immediate screen reader announcement
- Confidence indicators use `aria-describedby` to link the warning tooltip to the field
- Warning list is a `role="list"` with descriptive items
- Cancel button is keyboard-focusable and labeled "Cancel import"
- All interactive elements follow the keyboard patterns from [ui-components.md](./ui-components.md)

---

## Performance Considerations

- The import API call is a single request. No polling or WebSocket is needed.
- `AbortController` ensures cancelled imports don't consume client resources.
- The RecipeEditor component is code-split and only loaded when the review step is reached (dynamic `import()`).
- URL validation happens client-side before making the API call, avoiding unnecessary server round-trips.
