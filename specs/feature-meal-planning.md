# Feature: Meal Planning

> Full feature spec for weekly meal planning: calendar view, recipe assignment, drag-and-drop scheduling, grocery integration.

---

## Overview

The meal planning feature lets users organize recipes into a weekly calendar. Users can assign recipes to specific days and meal slots (breakfast, lunch, dinner, snack), view their plan at a glance, and generate a shopping list directly from the plan. Plans are saved per-user and can be duplicated or cleared week by week.

This spec builds on:
- [recipe-data-model.md](./recipe-data-model.md) — canonical recipe schema, servings defaults
- [search-and-query.md](./search-and-query.md) — recipe search for adding to the plan
- [shopping-list-engine.md](./shopping-list-engine.md) — generating a shopping list from selected recipes
- [api-routes.md](./api-routes.md) — API layer design, auth requirements
- [ui-components.md](./ui-components.md) — shared RecipeCard, SearchBar, ScalingControl components
- [auth.md](./auth.md) — authentication required for persistence

---

## User Stories

### US-1: Plan Meals for the Week

**As a** user who meal preps,
**I want to** assign recipes to specific days and meal slots on a weekly calendar,
**so that** I have a clear plan for what to cook each day.

**Example:** A user drags "Crispy Chickpea Bowl" into Wednesday's dinner slot and "Overnight Oats" into Thursday's breakfast slot.

### US-2: Browse and Search Recipes to Add

**As a** user building a meal plan,
**I want to** search my recipe collection and add results directly to a day/slot,
**so that** I can quickly populate my weekly plan.

**Example:** A user searches "pasta", sees "Pasta Aglio e Olio" in the results, and clicks the "+" button next to Wednesday dinner to add it.

### US-3: Adjust Servings Per Meal

**As a** user cooking for different group sizes on different days,
**I want to** set the number of servings for each planned meal independently,
**so that** ingredient quantities are correct when I generate a shopping list.

### US-4: Generate Shopping List from Meal Plan

**As a** user who has finished planning the week,
**I want to** generate a shopping list from all recipes in my meal plan,
**so that** I can buy everything I need in one trip.

**Example:** The user clicks "Generate Shopping List" and is taken to the shopping list page with all planned recipes pre-selected at their configured servings.

### US-5: Duplicate a Weekly Plan

**As a** user who wants to repeat a good week,
**I want to** duplicate a previous week's plan into a new week,
**so that** I don't have to rebuild it from scratch.

### US-6: Clear a Week

**As a** user starting fresh,
**I want to** clear all meals from the current week,
**so that** I can plan from a blank slate.

### US-7: Move Meals Between Slots

**As a** user rearranging my plan,
**I want to** drag a meal from one slot to another (same or different day),
**so that** I can adjust my plan without removing and re-adding recipes.

---

## Acceptance Criteria

### Calendar View

| # | Criterion |
|---|-----------|
| AC-1 | The meal plan page displays a 7-day grid (Mon–Sun) with rows for each meal slot: Breakfast, Lunch, Dinner, Snack. |
| AC-2 | Each cell shows assigned recipe titles (truncated at 40 chars) with a small thumbnail if available. |
| AC-3 | Empty cells show a "+" button to add a recipe. |
| AC-4 | Week navigation arrows allow moving to previous/next weeks. The current week is highlighted. |
| AC-5 | The header displays the date range for the current week (e.g., "Feb 3 – Feb 9, 2026"). |

### Adding Recipes

| # | Criterion |
|---|-----------|
| AC-6 | Clicking "+" on a cell opens a recipe search popover with autocomplete (debounced 300ms, queries `GET /api/v1/recipes`). |
| AC-7 | Selecting a recipe from search results assigns it to that cell with the recipe's default servings. |
| AC-8 | A cell can hold at most 3 recipes. Attempting to add a fourth shows a toast: "Maximum 3 recipes per meal slot." |
| AC-9 | The same recipe can appear in multiple cells (different days/slots) but not in the same cell twice. |

### Servings and Scaling

| # | Criterion |
|---|-----------|
| AC-10 | Each recipe in a cell has a ScalingControl for adjusting servings (0.25x–10x of default). |
| AC-11 | Servings changes are saved immediately via `PATCH /api/v1/meal-plan/{weekId}/entries/{entryId}`. |

### Drag and Drop

| # | Criterion |
|---|-----------|
| AC-12 | Recipes can be dragged from one cell to another. |
| AC-13 | Dropping onto a full cell (3 recipes) is rejected with visual feedback (red border flash). |
| AC-14 | Drag and drop works on desktop via mouse and on touch devices via long-press + drag. |

### Shopping List Integration

| # | Criterion |
|---|-----------|
| AC-15 | A "Generate Shopping List" button collects all recipes and servings from the current week's plan. |
| AC-16 | Clicking it navigates to `/shopping-list` with recipes and servings pre-populated as query parameters. |
| AC-17 | If the plan is empty, the button is disabled with tooltip: "Add recipes to your plan first." |

### Persistence

| # | Criterion |
|---|-----------|
| AC-18 | Meal plans are persisted per-user, keyed by week start date (ISO Monday). |
| AC-19 | `GET /api/v1/meal-plan/{weekId}` returns the plan for a given week (empty plan if none exists). |
| AC-20 | `PUT /api/v1/meal-plan/{weekId}` saves/updates the full plan for a week. |
| AC-21 | `DELETE /api/v1/meal-plan/{weekId}` clears a week's plan. Confirmation dialog required on the client. |

### Duplicate Week

| # | Criterion |
|---|-----------|
| AC-22 | A "Duplicate Week" button copies the current week's plan to a target week selected via a date picker. |
| AC-23 | If the target week already has entries, a confirmation dialog warns: "This will overwrite the existing plan for [date range]. Continue?" |

### Authentication

| # | Criterion |
|---|-----------|
| AC-24 | The `/meal-plan` route requires authentication. Unauthenticated users are redirected to `/auth/login`. |

---

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| EC-1 | User adds a recipe that is later deleted | The entry shows "Recipe unavailable" with a remove button. It is excluded from shopping list generation. |
| EC-2 | User tries to add a 4th recipe to a cell | Toast: "Maximum 3 recipes per meal slot." Drop/add is rejected. |
| EC-3 | User duplicates into a week that already has a plan | Confirmation dialog before overwriting. |
| EC-4 | User drags a recipe to the same cell it's already in | No-op. No error shown. |
| EC-5 | User navigates to a week far in the past/future | Empty plan is displayed. No restrictions on week navigation range. |
| EC-6 | Network error while saving plan changes | Error toast: "Couldn't save your meal plan. Please try again." Local state is preserved for retry. |
| EC-7 | User clears a week with no recipes | No confirmation dialog — clears immediately (no-op). |
| EC-8 | User clears a week with recipes | Confirmation dialog: "Clear all meals for [date range]?" with Clear and Cancel buttons. |
| EC-9 | Drag and drop on a device without pointer events | Falls back to "+" button and move/remove buttons per entry. |
| EC-10 | Two browser tabs editing the same week | Last-write-wins. No real-time sync in v1. |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/meal-plan/{weekId}` | Get meal plan for a week. `weekId` is ISO date of Monday (e.g., `2026-02-02`). |
| `PUT` | `/api/v1/meal-plan/{weekId}` | Create or replace a week's meal plan. |
| `PATCH` | `/api/v1/meal-plan/{weekId}/entries/{entryId}` | Update a single entry (e.g., servings change). |
| `DELETE` | `/api/v1/meal-plan/{weekId}` | Delete a week's meal plan. |
| `POST` | `/api/v1/meal-plan/{weekId}/duplicate` | Duplicate a plan to a target week. Body: `{ "targetWeekId": "2026-02-09" }`. |

---

## Data Model

```typescript
interface MealPlan {
  weekId: string;        // ISO date of Monday, e.g. "2026-02-03"
  userId: string;
  entries: MealPlanEntry[];
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

interface MealPlanEntry {
  id: string;            // ULID
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0=Monday, 6=Sunday
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId: string;
  servings: number;
}
```

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Load week plan | < 300ms |
| Save entry change | < 200ms |
| Drag-and-drop reorder | < 50ms (optimistic UI) |
| Recipe search in popover | < 200ms |
| Generate shopping list redirect | < 100ms |

---

## Security Requirements

- All meal plan endpoints require authentication.
- Users can only access their own meal plans.
- `weekId` is validated as a valid ISO Monday date.
- Entry count per week is capped at 84 (7 days x 4 slots x 3 recipes max).
- Rate limiting: 60 write requests per user per minute.

---

## Accessibility Requirements

- Calendar grid uses `role="grid"` with `role="row"` and `role="gridcell"`.
- Day headers use `role="columnheader"`, slot labels use `role="rowheader"`.
- Add recipe button in each cell has `aria-label="Add recipe to [Day] [Slot]"`.
- Drag-and-drop has keyboard alternative: select entry, then use arrow keys to move between cells, Enter to confirm.
- Recipe search popover is focusable and dismissible with Escape.
- Week navigation buttons have `aria-label="Previous week"` / `"Next week"`.
- Date range header uses `aria-live="polite"` to announce week changes.
- All interactive elements meet 44x44px minimum touch target on mobile.

---

## Out of Scope

- Nutritional information or calorie tracking per day/week.
- Shared/collaborative meal plans between users.
- Automatic meal plan suggestions based on preferences.
- Integration with external calendar apps (Google Calendar, iCal).
- Recurring/template plans that auto-populate weekly.
- Cost estimation for planned meals.
