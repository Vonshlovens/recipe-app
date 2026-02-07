# Search UI

> Tag-based search interface, filter controls, results display, empty/loading/error states.

---

## Overview

The search UI is the primary discovery interface for browsing and filtering recipes. It combines free-text search with tag-based filtering, presenting results in a responsive card grid. Users can build complex queries by combining text search with include/exclude tag filters across all tag groups.

This spec builds on:
- [search-and-query.md](./search-and-query.md) — tag query engine, full-text search, sorting, pagination
- [api-routes.md](./api-routes.md) — `/api/v1/recipes/search` and `/api/v1/recipes/query` endpoints
- [ui-components.md](./ui-components.md) — SearchBar, TagFilter, SearchResults, RecipeCard, Pagination
- [frontend-architecture.md](./frontend-architecture.md) — routing, layout, and state management patterns

---

## Route

| Route     | Purpose                          | Auth Required |
|-----------|----------------------------------|---------------|
| `/search` | Browse and search all recipes    | No            |

---

## Page Data Loading

### `+page.server.ts`

```typescript
// Read query params: q, include, exclude, sort, page, pageSize
// If q is present: GET /api/v1/recipes/search?q=...&page=...&pageSize=...
// If include or exclude present: GET /api/v1/recipes/query?include=...&exclude=...&sort=...&page=...&pageSize=...
// If both q and tags: search first, then filter client-side (or combine server-side if supported)
// Default: GET /api/v1/recipes?sort=-createdAt&page=1&pageSize=24
```

- All filter state is persisted in URL query parameters for shareable/bookmarkable search URLs
- On initial load with no params, shows the most recent recipes

---

## Page Layout

### Desktop (>= 1024px)

```
┌──────────────────────────────────────────────────────────┐
│  SearchBar                                                │
│  [🔍 Search recipes...                            ] [×]  │
├──────────────────┬───────────────────────────────────────┤
│  Sidebar         │  Results                               │
│  ┌────────────┐  │  ┌─────────────────────────────────┐  │
│  │ Sort by    │  │  │  24 recipes found                │  │
│  │ [▾ Newest ]│  │  │                                  │  │
│  │            │  │  │  ┌────────┐ ┌────────┐ ┌──────┐ │  │
│  │ Cuisine  ▾ │  │  │  │  Card  │ │  Card  │ │ Card │ │  │
│  │ ○ italian  │  │  │  └────────┘ └────────┘ └──────┘ │  │
│  │ ○ mexican  │  │  │  ┌────────┐ ┌────────┐ ┌──────┐ │  │
│  │ ○ thai     │  │  │  │  Card  │ │  Card  │ │ Card │ │  │
│  │            │  │  │  └────────┘ └────────┘ └──────┘ │  │
│  │ Meal     ▾ │  │  │                                  │  │
│  │ ○ dinner   │  │  │  ◄ 1  2  3 ... 10 ►             │  │
│  │ ○ lunch    │  │  └─────────────────────────────────┘  │
│  │            │  │                                        │
│  │ Diet     ▾ │  │                                        │
│  │ ...        │  │                                        │
│  │            │  │                                        │
│  │ [Clear all]│  │                                        │
│  └────────────┘  │                                        │
├──────────────────┴───────────────────────────────────────┤
└──────────────────────────────────────────────────────────┘
```

- Sidebar: 260px fixed width, sticky within viewport
- Results area: fills remaining width
- Card grid: 3 columns (fills to 4 on wide screens > 1440px)

### Tablet (768px–1023px)

- SearchBar full width
- Filter sidebar collapses into a slide-out drawer toggled by a "Filters" button with active filter count badge
- Card grid: 2 columns

### Mobile (< 768px)

- SearchBar full width
- Filter drawer triggered by "Filters" button below the search bar
- Card grid: 1 column
- Pagination uses simplified prev/next controls

---

## Components

### SearchBar

Uses the shared `SearchBar` component from `ui-components.md`:

- Debounced input (300ms) before triggering search
- Search icon on the left
- Clear button (×) on the right when input has text
- Enter key submits immediately (cancels debounce)
- Updates `?q=` query parameter on search

### Sort Control

```typescript
interface SortOption {
  label: string;
  value: string;
}

const sortOptions: SortOption[] = [
  { label: "Newest", value: "-createdAt" },
  { label: "Oldest", value: "createdAt" },
  { label: "Title A–Z", value: "title" },
  { label: "Title Z–A", value: "-title" },
  { label: "Recently Updated", value: "-updatedAt" },
];
```

- Uses shadcn-svelte `Select` component
- Defaults to "Newest" (`-createdAt`)
- Updates `?sort=` query parameter on change

### TagFilter

Uses the shared `TagFilter` component from `ui-components.md`:

- Fetches available tags from `GET /api/v1/tags` on mount
- Groups displayed as collapsible accordion sections: Cuisine, Meal, Diet, Technique, Custom
- Each tag shows a three-state toggle:
  - Default (unselected): tag is not part of the query
  - Include (green indicator): tag is added to the `include` parameter (AND logic)
  - Exclude (red indicator): tag is added to the `exclude` parameter (NOT logic)
- Usage count displayed next to each tag name
- "Clear all" button at the bottom resets all tag filters
- Active filter count shown on the mobile drawer trigger button

### Tag Filter URL State

Tag selections are serialized to URL query parameters:

```
?include=cuisine:italian,meal:dinner&exclude=diet:gluten-free
```

- `include`: comma-separated `group:value` pairs for AND filtering
- `exclude`: comma-separated `group:value` pairs for NOT filtering
- Changing any filter resets to page 1

### SearchResults

Uses the shared `SearchResults` component from `ui-components.md`:

- Results count header: "N recipes found" (or "N results for 'query'" when searching)
- Responsive card grid using `RecipeCard` components
- Grid columns: 1 (mobile) / 2 (tablet) / 3 (desktop) / 4 (wide)

### Pagination

Uses the shared `Pagination` component from `frontend-architecture.md`:

- Default page size: 24
- Shows page numbers with ellipsis for large result sets
- Previous/Next buttons disabled at bounds
- Updates `?page=` query parameter on page change
- Scrolls to top of results on page change

---

## Active Filters Display

When any filters are active, show an "active filters" bar between the search bar and results:

```
┌──────────────────────────────────────────────────────────┐
│  Active filters: [cuisine:italian ×] [meal:dinner ×]     │
│  [exclude: diet:gluten-free ×]       [Clear all]         │
└──────────────────────────────────────────────────────────┘
```

- Each active filter shown as a removable chip/badge
- Include filters shown with default badge styling
- Exclude filters shown with destructive/red badge styling
- "Clear all" removes all filters and resets to default view
- Clicking × on a chip removes that individual filter

---

## Query Composition

The search page composes queries from multiple inputs:

| Input         | API Parameter                  | Behavior                          |
|---------------|--------------------------------|-----------------------------------|
| Search text   | `q`                            | Full-text search via `/search`    |
| Include tags  | `include=group:value,...`      | AND tag filter via `/query`       |
| Exclude tags  | `exclude=group:value,...`      | NOT tag filter via `/query`       |
| Sort          | `sort=-createdAt`              | Sort order                        |
| Page          | `page=1`                       | Current page                      |
| Page size     | `pageSize=24`                  | Results per page                  |

When both `q` and tag filters are provided, the page sends the text search query with tag filter parameters combined into a single request to `/api/v1/recipes/query` with the `q` parameter included.

---

## Loading States

| State                | Display                                              |
|----------------------|------------------------------------------------------|
| Initial page load    | Skeleton grid (6 skeleton cards)                     |
| Search in progress   | Skeleton grid replacing current results              |
| Filter change        | Skeleton grid replacing current results              |
| Tag list loading     | Skeleton lines in sidebar sections                   |
| Pagination loading   | Skeleton grid, scroll to top                         |

All loading states show the `Skeleton` component from shadcn-svelte in place of content.

---

## Empty States

| Condition                 | Display                                                          |
|---------------------------|------------------------------------------------------------------|
| No recipes exist          | EmptyState: "No recipes yet" with "Create your first recipe" CTA |
| Search returned no results| EmptyState: "No recipes match your search" with suggestion to adjust filters |
| Filters too restrictive   | EmptyState: "No recipes match these filters" with "Clear filters" CTA |

---

## Error States

| Error                        | Display                                              |
|------------------------------|------------------------------------------------------|
| Search API failure           | ErrorBanner: "Something went wrong. Please try again." with retry button |
| Tag list fetch failure       | Sidebar shows "Failed to load filters" with retry link |
| Network error                | ErrorBanner: "You appear to be offline. Check your connection." |

---

## URL State Management

All search/filter state lives in URL query parameters for deep linking:

```
/search?q=pasta&include=cuisine:italian,diet:vegetarian&exclude=meal:breakfast&sort=-createdAt&page=2
```

- State changes use `goto()` with `replaceState: true` for filter/sort changes (no history spam)
- Pagination uses `goto()` with `replaceState: false` (so back button navigates pages)
- Browser back/forward correctly restores previous search state
- On page load, all UI controls are initialized from URL parameters

---

## Component File Structure

```
$lib/components/search/
├── ActiveFilters.svelte        # Removable filter chip bar
├── FilterDrawer.svelte         # Mobile slide-out filter panel
├── SortSelect.svelte           # Sort dropdown
src/routes/search/
├── +page.svelte                # Search page
├── +page.server.ts             # Search data loader
```

---

## Accessibility

- SearchBar input has `role="searchbox"` and `aria-label="Search recipes"`
- Tag filter sections use `aria-expanded` on collapsible group headings
- Three-state tag toggles have clear `aria-label` describing current state ("Include italian cuisine in search", "Exclude italian cuisine from search")
- Active filter chips are announced by screen readers and have accessible remove buttons
- Results count is announced on update via `aria-live="polite"` region
- Pagination controls have `aria-label="Search results pagination"` and current page indicator
- Focus management: focus moves to results area after search/filter change
- Keyboard navigation: all filter controls are keyboard accessible, Escape closes the mobile filter drawer
