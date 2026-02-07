# Feature: Tag-Based Recipe Querying

> Full feature spec for tag-based recipe querying: user stories, acceptance criteria, edge cases.

---

## Overview

Tag-based querying is the primary structured discovery mechanism in the recipe app. Users build queries by selecting tags across five groups (cuisine, meal, diet, technique, custom) with AND, OR, and NOT semantics to find exactly the recipes they want. This feature spans the full stack — from the tag filter UI to the query engine and API layer.

This spec builds on:
- [search-and-query.md](./search-and-query.md) — query engine internals, SQL generation, pagination
- [search-ui.md](./search-ui.md) — filter sidebar, active filters bar, result display
- [recipe-data-model.md](./recipe-data-model.md) — tag taxonomy, validation rules
- [api-routes.md](./api-routes.md) — `/api/v1/recipes/query` endpoint definition
- [database.md](./database.md) — `recipe_tags` table, indexes

---

## User Stories

### US-1: Filter by Including Tags

**As a** user browsing recipes,
**I want to** select tags to include in my search,
**so that** I only see recipes that match all my selected tags.

**Example:** Selecting `cuisine:italian` and `meal:dinner` shows only Italian dinner recipes.

### US-2: Filter by Excluding Tags

**As a** user with dietary restrictions,
**I want to** exclude recipes with certain tags,
**so that** I avoid recipes I cannot or do not want to eat.

**Example:** Excluding `diet:gluten-free` removes all gluten-free-tagged recipes from results (showing recipes that are NOT gluten-free).

### US-3: Combine Include and Exclude

**As a** user with specific preferences,
**I want to** combine include and exclude filters in one query,
**so that** I can narrow results precisely.

**Example:** Include `cuisine:mediterranean` + exclude `technique:grilling` shows Mediterranean recipes that don't involve grilling.

### US-4: Clear Individual Filters

**As a** user refining my search,
**I want to** remove a single active filter without clearing all filters,
**so that** I can iteratively adjust my query.

### US-5: Clear All Filters

**As a** user who wants to start over,
**I want to** clear all active tag filters at once,
**so that** I can return to the full recipe list quickly.

### US-6: Shareable Filter URLs

**As a** user who found a useful filter combination,
**I want to** copy the URL and share it,
**so that** others see the same filtered results.

### US-7: Combine Text Search with Tag Filters

**As a** user looking for something specific,
**I want to** search by keyword and filter by tags simultaneously,
**so that** I can find "pasta" recipes that are also `diet:vegan`.

---

## Acceptance Criteria

### Tag Selection (UI)

| # | Criterion |
|---|-----------|
| AC-1 | Each tag in the filter sidebar has three states: unselected, included (green), excluded (red). |
| AC-2 | Clicking an unselected tag sets it to "included." |
| AC-3 | Clicking an included tag advances it to "excluded." |
| AC-4 | Clicking an excluded tag resets it to "unselected." |
| AC-5 | Tag groups (cuisine, meal, diet, technique, custom) are displayed as collapsible accordion sections. |
| AC-6 | Each tag displays a usage count showing how many recipes have that tag. |
| AC-7 | "Clear all" button resets all tags to unselected and navigates to the unfiltered view. |

### Query Execution (API)

| # | Criterion |
|---|-----------|
| AC-8 | `include` tags use AND logic — a recipe must have ALL included tags to appear. |
| AC-9 | `exclude` tags use NOT logic — a recipe must have NONE of the excluded tags to appear. |
| AC-10 | A query with both `include` and `exclude` applies both conditions. |
| AC-11 | An empty query (no tags selected) returns all recipes with default sort. |
| AC-12 | Results are paginated with `page` and `pageSize` parameters. Default page size is 24. |
| AC-13 | Invalid tag formats return HTTP 400 with `INVALID_TAG_FORMAT` error code. |
| AC-14 | A tag appearing in both `include` and `exclude` returns HTTP 400 with `CONTRADICTORY_QUERY` error code. |
| AC-15 | Maximum 10 tags per operator; exceeding returns HTTP 400 with `TOO_MANY_TAGS`. |

### URL State

| # | Criterion |
|---|-----------|
| AC-16 | Active include tags are serialized to `?include=group:value,group:value`. |
| AC-17 | Active exclude tags are serialized to `?exclude=group:value,group:value`. |
| AC-18 | Filter changes reset pagination to page 1. |
| AC-19 | Browser back/forward restores previous filter state. |
| AC-20 | Direct navigation to a URL with filter params displays the correct filters and results. |

### Results Display

| # | Criterion |
|---|-----------|
| AC-21 | Active filters appear as removable chips between the search bar and results grid. |
| AC-22 | Include chips use default badge styling; exclude chips use destructive/red styling. |
| AC-23 | Clicking × on a chip removes that filter and re-queries. |
| AC-24 | Results count header shows "N recipes found" (or "No recipes match these filters" for zero results). |
| AC-25 | Loading state shows 6 skeleton cards while query is in flight. |

---

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| EC-1 | User selects a tag that no recipes have | Empty results with "No recipes match these filters" message and "Clear filters" CTA. |
| EC-2 | User includes all tags from one group (e.g., every cuisine) | Equivalent to no filter on that group; returns recipes that have any cuisine tag. Actually returns the intersection — only recipes tagged with ALL selected cuisines. This is likely to yield zero results and is a valid but unusual query. |
| EC-3 | User excludes all recipes | Empty results displayed normally; not treated as an error. |
| EC-4 | Tags exist in the database but have zero recipes | Tags still display in the filter sidebar with a count of 0. |
| EC-5 | Simultaneous text search and tag filter | Both constraints applied server-side. Text search relevance ranking is preserved. Tags further narrow the result set. |
| EC-6 | Tag added to recipe after filter sidebar loaded | Tag counts may be stale until page refresh. No real-time sync required. |
| EC-7 | URL contains malformed tag params (e.g., `?include=notavalidformat`) | API returns 400; UI shows error banner with "Invalid filters" message and "Clear filters" CTA. |
| EC-8 | URL contains tags that don't exist in the database | Valid query, returns no matches. Not an error. |
| EC-9 | Very long tag filter list (10 include + 10 exclude) | Accepted up to the limit. Query may be slower but must complete within timeout. |
| EC-10 | Rapid filter toggling | Debounce or cancel in-flight requests so only the latest query executes. No race condition in displayed results. |

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Query response time (< 1000 recipes, < 5 tags) | < 100ms |
| Query response time (< 1000 recipes, 10 tags) | < 300ms |
| Filter sidebar initial load (tag list fetch) | < 200ms |
| UI response to filter toggle (navigation start) | < 50ms |

---

## Accessibility Requirements

- Tag filter toggles are keyboard accessible (Tab to focus, Enter/Space to cycle state).
- Each tag toggle has an `aria-label` describing its current state (e.g., "Include italian cuisine in search", "Exclude italian cuisine from search", "Italian cuisine filter not active").
- Active filter chips have accessible remove buttons with `aria-label="Remove filter cuisine:italian"`.
- Results count region uses `aria-live="polite"` to announce changes.
- Filter sidebar groups use `aria-expanded` on collapsible headings.
- Focus is managed: after filter change, focus remains on the toggled element (no focus theft).

---

## Out of Scope

- OR-mode tag queries from the UI (the engine supports it, but the UI only exposes include/exclude for v1).
- Tag management (creating, renaming, deleting tags) — tags are derived from recipe data.
- Tag autocomplete or search within the filter sidebar.
- Cross-group boolean logic (e.g., "cuisine:italian OR meal:dinner") — each group is independent.
