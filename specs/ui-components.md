# UI Components

> Component inventory, design system tokens, shared component API contracts.

---

## Overview

This spec defines the design system and component library for the recipe app. It builds on the [frontend architecture](./frontend-architecture.md) spec, detailing the design tokens, shadcn-svelte component customizations, and custom composite components that form the UI layer. All components live under `$lib/components/` and are styled with Tailwind CSS 4 utility classes referencing the theme tokens defined in `src/app.css`.

---

## Design System Tokens

### Color Tokens

Color tokens are defined in `src/app.css` via the `@theme` block (see [frontend-architecture.md](./frontend-architecture.md)). The following semantic tokens are used throughout the component library:

| Token                       | Purpose                                | Light         | Dark          |
|-----------------------------|----------------------------------------|---------------|---------------|
| `--color-primary`           | Primary actions, links, focus rings    | `#2563eb`     | `#3b82f6`     |
| `--color-primary-foreground`| Text on primary backgrounds            | `#ffffff`     | `#ffffff`     |
| `--color-secondary`         | Secondary actions, muted buttons       | `#64748b`     | `#64748b`     |
| `--color-accent`            | Highlights, badges, stars              | `#f59e0b`     | `#f59e0b`     |
| `--color-destructive`       | Delete actions, error states           | `#ef4444`     | `#ef4444`     |
| `--color-background`        | Page background                        | `#ffffff`     | `#0f172a`     |
| `--color-foreground`        | Primary text                           | `#0f172a`     | `#e2e8f0`     |
| `--color-muted`             | Muted backgrounds, disabled states     | `#f1f5f9`     | `#1e293b`     |
| `--color-muted-foreground`  | Secondary/placeholder text             | `#64748b`     | `#94a3b8`     |
| `--color-border`            | Borders, dividers                      | `#e2e8f0`     | `#334155`     |

### Additional Semantic Tokens

The following tokens extend the base palette for recipe-app-specific needs:

```css
/* Additional tokens in src/app.css @theme block */
@theme {
  --color-success: #22c55e;
  --color-success-foreground: #ffffff;
  --color-warning: #f59e0b;
  --color-warning-foreground: #1a1a1a;
  --color-info: #3b82f6;
  --color-info-foreground: #ffffff;
}
```

### Spacing Scale

Uses Tailwind 4's default spacing scale. Key usage conventions:

| Context             | Spacing        | Tailwind Class |
|---------------------|----------------|----------------|
| Component padding   | 16px           | `p-4`          |
| Card gap            | 24px           | `gap-6`        |
| Section gap         | 32px           | `gap-8`        |
| Form field gap      | 12px           | `gap-3`        |
| Inline element gap  | 8px            | `gap-2`        |
| Page container      | 16px padding   | `px-4`         |

### Typography Scale

| Role            | Size    | Weight    | Tailwind Class                |
|-----------------|---------|-----------|-------------------------------|
| Page title      | 30px    | Bold      | `text-3xl font-bold`          |
| Section heading | 24px    | Semibold  | `text-2xl font-semibold`      |
| Card title      | 20px    | Semibold  | `text-xl font-semibold`       |
| Body            | 16px    | Normal    | `text-base`                   |
| Small / caption | 14px    | Normal    | `text-sm`                     |
| Extra small     | 12px    | Medium    | `text-xs font-medium`         |

### Border Radius

| Token          | Value     | Usage                        |
|----------------|-----------|------------------------------|
| `--radius-sm`  | `0.25rem` | Badges, small chips          |
| `--radius-md`  | `0.375rem`| Inputs, buttons              |
| `--radius-lg`  | `0.5rem`  | Cards, dialogs               |
| `--radius-xl`  | `0.75rem` | Large containers, modals     |

### Shadows

| Token          | Usage                              |
|----------------|------------------------------------|
| `--shadow-sm`  | Subtle elevation (cards at rest)   |
| `--shadow-md`  | Elevated elements (dropdowns, hover cards) |

---

## shadcn-svelte Primitives

These components are installed via the shadcn-svelte CLI into `$lib/components/ui/`. They should **not** be manually edited except for design token integration.

### Component List

| Component        | Install Command                       | Customization Notes                             |
|------------------|---------------------------------------|-------------------------------------------------|
| `Button`         | `npx shadcn-svelte add button`        | Variants: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`. Sizes: `default`, `sm`, `lg`, `icon`. |
| `Card`           | `npx shadcn-svelte add card`          | Subcomponents: `Card.Root`, `Card.Header`, `Card.Title`, `Card.Description`, `Card.Content`, `Card.Footer`. |
| `Input`          | `npx shadcn-svelte add input`         | Standard text input. Pair with `Label`.          |
| `Label`          | `npx shadcn-svelte add label`         | Associated with inputs via `for` attribute.      |
| `Textarea`       | `npx shadcn-svelte add textarea`      | Markdown editing, ingredient lists.              |
| `Select`         | `npx shadcn-svelte add select`        | Subcomponents: `Select.Root`, `Select.Trigger`, `Select.Content`, `Select.Item`. |
| `Dialog`         | `npx shadcn-svelte add dialog`        | Confirmations, attestation modals, previews.     |
| `Badge`          | `npx shadcn-svelte add badge`         | Variants: `default`, `secondary`, `destructive`, `outline`. Used for tags and difficulty. |
| `Separator`      | `npx shadcn-svelte add separator`     | Horizontal/vertical dividers.                    |
| `Skeleton`       | `npx shadcn-svelte add skeleton`      | Loading placeholders matching final layout.      |
| `Toast`          | `npx shadcn-svelte add sonner`        | Uses `sonner-svelte` under the hood. Success/error/info variants. |
| `DropdownMenu`   | `npx shadcn-svelte add dropdown-menu` | User menu, recipe action menus.                  |
| `Checkbox`       | `npx shadcn-svelte add checkbox`      | Shopping list check-off, filter toggles.         |
| `Switch`         | `npx shadcn-svelte add switch`        | Dark mode toggle, preference toggles.            |
| `Tabs`           | `npx shadcn-svelte add tabs`          | Recipe editor (edit/preview), search result tabs. |
| `Tooltip`        | `npx shadcn-svelte add tooltip`       | Icon-only button labels, truncated text.         |

---

## Custom Composite Components

These are app-specific components built from shadcn-svelte primitives and Tailwind utilities. They live under `$lib/components/{domain}/`.

### Recipe Components (`$lib/components/recipe/`)

#### `RecipeCard.svelte`

Displays a recipe summary in a card format for list/grid views.

```typescript
interface RecipeCardProps {
  recipe: RecipeSummary;
  // optional: controls whether the card links to the recipe
  href?: string;
}
```

**Structure:**
- Image thumbnail (or placeholder gradient if no image)
- Title (truncated to 2 lines)
- Difficulty badge
- Prep/cook time display
- Tag badges (up to 3, with "+N more" overflow)

**Responsive behavior:**
- Grid item: fills available column width
- Min width: 280px
- Image aspect ratio: 16:9

#### `RecipeHeader.svelte`

Full recipe header for the detail view.

```typescript
interface RecipeHeaderProps {
  recipe: Recipe;
  isOwner: boolean;
}
```

**Structure:**
- Recipe title (h1)
- Author / source attribution
- Difficulty badge
- Time breakdown (prep, cook, total)
- Servings display with scaling control
- Tag list (all tags)
- Action buttons (edit, delete) — visible only when `isOwner` is true

#### `IngredientList.svelte`

Renders the ingredients section with optional scaling.

```typescript
interface IngredientListProps {
  ingredients: string[];   // raw markdown list items
  scaleFactor: number;     // 1.0 = original
}
```

**Structure:**
- Heading: "Ingredients"
- Bulleted list of ingredients
- Quantities adjusted by `scaleFactor`
- Checkbox next to each ingredient (for cooking mode)

#### `InstructionSteps.svelte`

Renders the instructions section as numbered steps.

```typescript
interface InstructionStepsProps {
  instructions: string[];  // raw markdown list items
}
```

**Structure:**
- Heading: "Instructions"
- Ordered list with step numbers
- Each step is a block of text (supports inline markdown)
- Optional: highlight the current step in cooking mode

#### `ScalingControl.svelte`

Servings adjuster that drives ingredient scaling.

```typescript
interface ScalingControlProps {
  defaultServings: number;
  currentServings: number;
  onchange: (servings: number) => void;
}
```

**Structure:**
- Label: "Servings"
- Decrement/increment buttons
- Current serving count display
- Reset button (appears when != default)
- Constraints: min 1, max 100

#### `TagBadgeList.svelte`

Renders a list of tag badges with optional truncation.

```typescript
interface TagBadgeListProps {
  tags: Record<string, string[]>; // group → values
  maxVisible?: number;            // default: unlimited
  onTagClick?: (group: string, value: string) => void;
}
```

**Structure:**
- Badges colored by tag group (cuisine, meal, diet, technique, custom)
- Clickable badges navigate to search filtered by that tag
- "+N more" overflow badge when truncated

#### Tag Group Color Mapping

| Tag Group   | Badge Variant   | Color Class              |
|-------------|-----------------|--------------------------|
| `cuisine`   | Default         | `bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`     |
| `meal`      | Default         | `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200` |
| `diet`      | Default         | `bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200` |
| `technique` | Default         | `bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200` |
| `custom`    | Secondary       | Uses default secondary badge styling |

### Search Components (`$lib/components/search/`)

#### `SearchBar.svelte`

Full-text search input with debounced query submission.

```typescript
interface SearchBarProps {
  value: string;
  placeholder?: string;   // default: "Search recipes..."
  onsubmit: (query: string) => void;
}
```

**Behavior:**
- Debounce: 300ms after typing stops
- Submit on Enter
- Clear button when input is non-empty
- Search icon on the left

#### `TagFilter.svelte`

Tag selection interface for filtering search results.

```typescript
interface TagFilterProps {
  availableTags: Record<string, { value: string; count: number }[]>;
  selectedTags: { include: string[]; exclude: string[] };
  onchange: (selected: { include: string[]; exclude: string[] }) => void;
}
```

**Structure:**
- Collapsible sections per tag group
- Each tag shown with usage count
- Click to include (green highlight), click again to exclude (red strikethrough), click again to clear
- "Clear all filters" button

#### `SearchResults.svelte`

Displays search results as a responsive grid of RecipeCards.

```typescript
interface SearchResultsProps {
  recipes: RecipeSummary[];
  totalResults: number;
  isLoading: boolean;
}
```

**Structure:**
- Results count header ("42 recipes found")
- Responsive grid: 1 column on mobile, 2 on `md`, 3 on `lg`, 4 on `xl`
- Empty state when no results
- Loading state with skeleton cards

### Layout Components (`$lib/components/layout/`)

#### `Navbar.svelte`

See [frontend-architecture.md](./frontend-architecture.md) for layout details.

```typescript
interface NavbarProps {
  user: { id: string; displayName: string } | null;
}
```

**Structure:**
- Left: App logo/title + nav links (Recipes, Search, Shopping List, Recommendations)
- Right: Dark mode toggle + user menu (or Login/Register buttons)
- Mobile: Hamburger menu collapsing nav links into a slide-out drawer

#### `Footer.svelte`

Minimal footer.

**Structure:**
- App name
- Links: About, Privacy, GitHub

### Shared Components (`$lib/components/shared/`)

#### `LoadingSpinner.svelte`

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';  // default: 'md'
  label?: string;               // screen reader text, default: 'Loading'
}
```

**Sizes:** sm = 16px, md = 24px, lg = 40px.

#### `EmptyState.svelte`

```typescript
interface EmptyStateProps {
  icon?: Component;          // optional Lucide icon
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}
```

**Structure:**
- Centered vertically
- Icon (muted, 48px)
- Title (text-lg font-semibold)
- Description (text-muted-foreground)
- Optional action button

#### `ErrorBanner.svelte`

```typescript
interface ErrorBannerProps {
  message: string;
  dismissible?: boolean;    // default: true
  ondismiss?: () => void;
}
```

**Structure:**
- Red/destructive background
- Error icon + message text
- Dismiss X button (if dismissible)

#### `Pagination.svelte`

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

**Structure:**
- Previous/Next buttons (disabled at bounds)
- Page number indicators with ellipsis for large ranges
- "Page X of Y" label on mobile

#### `ConfirmDialog.svelte`

Generic confirmation dialog wrapping shadcn `Dialog`.

```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;     // default: "Confirm"
  cancelLabel?: string;      // default: "Cancel"
  variant?: 'default' | 'destructive';  // default: 'default'
  onconfirm: () => void;
  oncancel: () => void;
}
```

**Usage:** Delete confirmations, discard unsaved changes, OCR rights attestation.

---

## Icon System

The app uses **Lucide Svelte** (`lucide-svelte`) for icons.

### Installation

```bash
deno add npm:lucide-svelte
```

### Usage Convention

```svelte
<script>
  import { Search, Plus, Trash2, Edit, Clock, ChefHat } from 'lucide-svelte';
</script>

<Search class="size-4" />
```

### Common Icons

| Icon           | Usage                                    |
|----------------|------------------------------------------|
| `Search`       | Search bar, search nav link              |
| `Plus`         | Create recipe, add to list               |
| `Trash2`       | Delete actions                           |
| `Edit`         | Edit recipe                              |
| `Clock`        | Prep/cook/total time                     |
| `ChefHat`      | Difficulty indicator, app branding       |
| `Tag`          | Tag-related UI                           |
| `ShoppingCart`  | Shopping list nav link                   |
| `Sparkles`     | Recommendations nav link                 |
| `Camera`       | OCR capture                              |
| `Link`         | URL import                               |
| `Check`        | Checked items, success states            |
| `X`            | Close, dismiss, clear                    |
| `ChevronLeft`  | Back navigation, pagination              |
| `ChevronRight` | Forward navigation, pagination           |
| `Sun`          | Light mode toggle                        |
| `Moon`         | Dark mode toggle                         |
| `User`         | User menu                                |
| `LogOut`       | Logout action                            |

---

## Responsive Grid System

### Recipe Grid

The recipe card grid uses CSS Grid with Tailwind utilities:

```svelte
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {#each recipes as recipe}
    <RecipeCard {recipe} />
  {/each}
</div>
```

### Form Layouts

Forms use a single-column layout on all screens with a max width:

```svelte
<form class="mx-auto max-w-2xl flex flex-col gap-6">
  <!-- form fields -->
</form>
```

---

## Component API Conventions

### Props

- All components use Svelte 5 `$props()` for typed prop declarations.
- Optional props have sensible defaults.
- Event callbacks are passed as props (e.g., `onchange`, `onsubmit`, `onclick`) rather than using Svelte's event dispatching.

### Slots / Snippets

- Use Svelte 5 snippets (`{#snippet}` / `{@render}`) for composable content areas.
- Default content is provided where sensible.

### Accessibility

- All interactive components have appropriate ARIA attributes.
- Icon-only buttons include `aria-label`.
- Form inputs are associated with labels via `for`/`id`.
- Focus is managed on dialog open/close and route transitions.
- Color is never the sole indicator of state — text/icons accompany color changes.

### Error States

- Form fields show validation errors below the input with `text-destructive text-sm`.
- Required fields are marked with a red asterisk (`*`).
- Error messages are associated with inputs via `aria-describedby`.
