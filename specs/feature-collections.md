# Feature: Recipe Collections

> Full feature spec for organizing recipes into user-created collections (cookbooks): creation, management, sharing, and browsing.

---

## Overview

Recipe collections let users group recipes into named, ordered lists — similar to playlists for music. Users can create collections like "Weeknight Dinners", "Holiday Baking", or "High Protein", add and reorder recipes within them, and optionally share a collection via a public link.

This spec builds on:
- [recipe-data-model.md](./recipe-data-model.md) — canonical recipe schema
- [search-and-query.md](./search-and-query.md) — recipe search for adding to collections
- [api-routes.md](./api-routes.md) — API layer design, auth requirements
- [ui-components.md](./ui-components.md) — shared RecipeCard, SearchBar components
- [auth.md](./auth.md) — authentication required for persistence

---

## User Stories

### US-1: Create a Collection

**As a** user who wants to organize recipes,
**I want to** create a named collection,
**so that** I can group related recipes together.

**Example:** A user creates a collection called "Quick Lunches" and gives it an optional description.

### US-2: Add Recipes to a Collection

**As a** user browsing or searching recipes,
**I want to** add a recipe to one of my collections,
**so that** I can save it for later in context.

**Example:** While viewing "Pasta Aglio e Olio", a user clicks "Add to Collection" and selects "Weeknight Dinners".

### US-3: Browse a Collection

**As a** user reviewing what they've saved,
**I want to** view all recipes in a collection,
**so that** I can decide what to cook.

### US-4: Reorder Recipes in a Collection

**As a** user curating a collection,
**I want to** drag recipes to reorder them,
**so that** I can put favorites or frequently used recipes at the top.

### US-5: Share a Collection

**As a** user who wants to share recipes with friends or family,
**I want to** generate a public link for a collection,
**so that** others can view (but not edit) my curated list.

### US-6: Delete or Rename a Collection

**As a** user managing their collections,
**I want to** rename or delete a collection,
**so that** I can keep my library tidy.

### US-7: Remove a Recipe from a Collection

**As a** user editing a collection,
**I want to** remove a recipe without deleting the recipe itself,
**so that** I can refine what's in the collection.

---

## Acceptance Criteria

### Collection Management

| # | Criterion |
|---|-----------|
| AC-1 | A user can create a collection with a name (1–100 chars) and optional description (0–500 chars). |
| AC-2 | Collection names do not need to be unique per user. |
| AC-3 | A user can rename a collection. The name field is inline-editable on the collection page. |
| AC-4 | A user can delete a collection. A confirmation dialog is shown: "Delete '[name]'? The recipes inside will not be deleted." |
| AC-5 | Collections are listed on `/collections` sorted by last updated, with the option to sort alphabetically. |
| AC-6 | Each collection card shows the name, recipe count, and a thumbnail mosaic of up to 4 recipe images. |

### Adding and Removing Recipes

| # | Criterion |
|---|-----------|
| AC-7 | An "Add to Collection" button appears on recipe detail pages and in recipe card overflow menus. |
| AC-8 | Clicking it opens a popover listing the user's collections with checkboxes. Collections that already contain the recipe are pre-checked. |
| AC-9 | Toggling a checkbox immediately adds/removes the recipe from that collection. |
| AC-10 | A recipe can belong to multiple collections simultaneously. |
| AC-11 | On the collection detail page, each recipe has a "Remove" action (icon button). Removal is immediate with an "Undo" toast (5 seconds). |

### Ordering

| # | Criterion |
|---|-----------|
| AC-12 | Recipes within a collection are displayed in a user-defined order (manual sort). |
| AC-13 | Users can drag-and-drop to reorder recipes. Order is persisted via `PATCH /api/v1/collections/{id}/reorder`. |
| AC-14 | Newly added recipes are appended to the end of the collection. |

### Sharing

| # | Criterion |
|---|-----------|
| AC-15 | A "Share" toggle on the collection page enables/disables a public link. |
| AC-16 | When enabled, a shareable URL is generated: `/collections/shared/{shareToken}`. |
| AC-17 | The share token is a random URL-safe string (22 chars, base62). |
| AC-18 | Visitors to the shared link see the collection in read-only mode — no edit controls, no auth required. |
| AC-19 | Disabling sharing invalidates the previous token. Re-enabling generates a new token. |

### Authentication

| # | Criterion |
|---|-----------|
| AC-20 | All collection management endpoints require authentication. |
| AC-21 | Shared collection view (`/collections/shared/{shareToken}`) does not require authentication. |

---

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| EC-1 | A recipe in a collection is deleted | The entry shows "Recipe unavailable" with a remove button. |
| EC-2 | User tries to add the same recipe to a collection twice | No-op. The checkbox is already checked. |
| EC-3 | User deletes a collection that has sharing enabled | Share link immediately returns 404. |
| EC-4 | User has no collections and clicks "Add to Collection" | Popover shows an empty state with a "Create New Collection" link. |
| EC-5 | Collection has 0 recipes | Collection page shows empty state: "No recipes yet. Browse recipes to add some." |
| EC-6 | User creates more than 50 collections | Soft limit warning: "You have a lot of collections! Consider consolidating." No hard block. |
| EC-7 | Shared link is accessed but sharing was just disabled | Returns 404: "This collection is no longer shared." |
| EC-8 | Network error while reordering | Error toast: "Couldn't save order. Please try again." Local state reverts. |
| EC-9 | User removes all recipes from a collection | Collection persists in an empty state (not auto-deleted). |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/collections` | List the current user's collections (paginated, 20 per page). |
| `POST` | `/api/v1/collections` | Create a new collection. Body: `{ "name": string, "description"?: string }`. |
| `GET` | `/api/v1/collections/{id}` | Get a collection with its recipes. |
| `PATCH` | `/api/v1/collections/{id}` | Update collection name, description, or sharing status. |
| `DELETE` | `/api/v1/collections/{id}` | Delete a collection. |
| `POST` | `/api/v1/collections/{id}/recipes` | Add a recipe. Body: `{ "recipeId": string }`. |
| `DELETE` | `/api/v1/collections/{id}/recipes/{recipeId}` | Remove a recipe from a collection. |
| `PATCH` | `/api/v1/collections/{id}/reorder` | Reorder recipes. Body: `{ "recipeIds": string[] }`. |
| `GET` | `/api/v1/collections/shared/{shareToken}` | Public: get a shared collection (no auth). |

---

## Data Model

```typescript
interface Collection {
  id: string;            // ULID
  userId: string;
  name: string;
  description: string;
  shareToken: string | null;  // null = not shared
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

interface CollectionEntry {
  id: string;            // ULID
  collectionId: string;
  recipeId: string;
  position: number;      // 0-indexed sort order
  addedAt: string;       // ISO 8601
}
```

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| List user collections | < 200ms |
| Load collection with recipes | < 300ms |
| Add/remove recipe | < 200ms |
| Reorder recipes | < 200ms |
| Load shared collection | < 300ms |

---

## Security Requirements

- All mutation endpoints require authentication.
- Users can only access/modify their own collections.
- Share tokens are cryptographically random (22 chars, base62, ~131 bits of entropy).
- Collection entry count is capped at 200 recipes per collection.
- Rate limiting: 60 write requests per user per minute.

---

## Accessibility Requirements

- Collection list uses `role="list"` with `role="listitem"` for each card.
- Drag-and-drop reorder has keyboard alternative: select recipe, use arrow keys to move, Enter to confirm.
- "Add to Collection" popover is focusable and dismissible with Escape.
- Delete confirmation dialog traps focus and is dismissible with Escape.
- Share toggle uses `role="switch"` with `aria-checked`.
- All interactive elements meet 44x44px minimum touch target on mobile.

---

## Out of Scope

- Collaborative collections (multiple editors).
- Collection templates or pre-built starter collections.
- Nested collections or folders.
- Importing/exporting collections.
- Following other users' collections.
- Collection-level tags or categories.
