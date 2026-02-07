# Recommendations UI

> Recommendation feed, preference controls, "what are you looking for?" input.

---

## Overview

The recommendations UI provides the user-facing interface for browsing personalized recipe recommendations and managing taste preferences. The user can view a recommendation feed, refine results with contextual queries, and configure explicit preference boosts and suppressions.

This spec builds on:
- [recommendation-engine.md](./recommendation-engine.md) — server-side scoring, ranking, cold-start, and `GET /api/v1/recommendations`
- [api-routes.md](./api-routes.md) — recommendation and preference API endpoints
- [ui-components.md](./ui-components.md) — shared UI components (RecipeCard, TagBadgeList, SearchBar, etc.)
- [frontend-architecture.md](./frontend-architecture.md) — routing, layout, state management

---

## Route

| Route              | Purpose                                         | Auth Required |
|--------------------|-------------------------------------------------|---------------|
| `/recommendations` | Browse recommendations and manage preferences   | Yes           |

---

## User Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Feed     │────▶│  2. Refine   │────▶│  3. Manage   │
│  View        │     │  Query       │     │  Preferences │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
       ▼                    ▼                     ▼
  Browse cards,       Filter by mood,       Boost/suppress
  view reasons        time, difficulty      tags
```

### Step 1: Recommendation Feed

On page load, the UI fetches personalized recommendations from `GET /api/v1/recommendations` with default parameters (limit 10, no filters).

#### Feed Layout

```
┌────────────────────────────────────────────────────┐
│  Recommended for You                     [⚙ Prefs] │
│────────────────────────────────────────────────────│
│  "What are you looking for?"                       │
│  [ .......................... ]  [Go]               │
│                                                     │
│  Filters: [Difficulty ▼]  [Max Time ▼]             │
│────────────────────────────────────────────────────│
│  ┌──────────────┐  ┌──────────────┐                │
│  │  RecipeCard   │  │  RecipeCard   │               │
│  │  ★ 0.82       │  │  ★ 0.76       │               │
│  │  "Matches     │  │  "You're      │               │
│  │   your taste  │  │   interested  │               │
│  │   for Med.."  │  │   in Japanese"│               │
│  └──────────────┘  └──────────────┘                │
│  ┌──────────────┐  ┌──────────────┐                │
│  │  RecipeCard   │  │  RecipeCard   │               │
│  │  ...          │  │  ...          │               │
│  └──────────────┘  └──────────────┘                │
│                                                     │
│           [ Load More ]                             │
└────────────────────────────────────────────────────┘
```

#### Recommendation Cards

Each recommendation is displayed as a `RecipeCard` (from [ui-components.md](./ui-components.md)) extended with:

- **Reason text** — The human-readable `reason` string from the API, shown below the card tags in muted text
- **Score indicator** — A small relevance indicator (hidden by default, shown in a tooltip on hover) displaying the raw score for transparency
- Clicking a card navigates to `/recipes/{slug}`

#### Empty States

| State                     | Display                                                                      |
|---------------------------|------------------------------------------------------------------------------|
| No recipes in database    | EmptyState: "No recipes yet. Add some recipes to get personalized recommendations." with link to `/recipes/new` |
| Cold start (new user)     | Show popular/recent recipes with banner: "Save a few recipes to get personalized recommendations!" |
| No results for filters    | EmptyState: "No recipes match your filters. Try adjusting your criteria." with Clear Filters button |
| Loading                   | Skeleton card grid (same layout as SearchResults skeleton)                    |
| Error                     | ErrorBanner: "Couldn't load recommendations. Please try again." with Retry button |

### Step 2: Contextual Query — "What Are You Looking For?"

A mood input and filter controls allow the user to refine recommendations for a specific session.

#### Mood Input

- A text input with placeholder: "What are you looking for?" (e.g., "something quick and light", "a hearty winter dish")
- Max 200 characters (matching API limit)
- Submit via Enter key or Go button
- Submitting re-fetches recommendations with the `mood` query parameter
- A clear (×) button resets the mood and re-fetches default recommendations

#### Filter Controls

Below the mood input, optional filter dropdowns:

- **Difficulty** — Select with options: Any (default), Easy, Medium, Hard
- **Max Time** — Select with options: Any (default), Under 15 min, Under 30 min, Under 1 hour, Under 2 hours
  - Maps to ISO 8601: `PT15M`, `PT30M`, `PT1H`, `PT2H`
- **Exclude Owned** — Checkbox: "Only show recipes I haven't saved" (default: unchecked)

Changing any filter re-fetches recommendations. Filters do not persist in URL (they are session-local state).

#### Refresh Button

- A refresh icon button next to the heading re-fetches recommendations with the same parameters
- Useful for getting a different diversity-ranked set without changing filters

### Step 3: Preference Management

A preferences panel allows the user to configure explicit taste boosts and suppressions.

#### Preferences Panel

Accessed via the gear icon (⚙) in the page header. Opens as a slide-out panel on desktop or a full-page modal on mobile.

```
┌────────────────────────────────────────────────────┐
│  Taste Preferences                        [ × ]     │
│────────────────────────────────────────────────────│
│  Your top tags (from your collection):              │
│  mediterranean (40%) · vegan (27%) · lunch (23%)   │
│────────────────────────────────────────────────────│
│  Boosts (show me more of these):                    │
│  [+ Add tag]                                        │
│  ┌────────────────────────────────┐                │
│  │ cuisine: japanese        [ × ] │                │
│  │ meal: breakfast          [ × ] │                │
│  └────────────────────────────────┘                │
│────────────────────────────────────────────────────│
│  Suppressions (show me less of these):              │
│  [+ Add tag]                                        │
│  ┌────────────────────────────────┐                │
│  │ diet: keto               [ × ] │                │
│  └────────────────────────────────┘                │
│────────────────────────────────────────────────────│
│  Max 20 total preferences.  (3 of 20 used)         │
│                                                     │
│  [ Save Preferences ]                               │
└────────────────────────────────────────────────────┘
```

#### Tag Profile Display

- On panel open, fetch `GET /api/v1/recommendations/profile`
- Display the user's top tag frequencies as a summary line (top 5 tags with percentages)
- This gives the user context on what the engine already knows about their taste

#### Boost / Suppress Management

- **Add tag** — A tag input with autocomplete (same as TagInput from [recipe-editor.md](./recipe-editor.md))
  - Dropdown queries `GET /api/v1/tags` for available tags
  - User selects `group:value` pair
  - Cannot add the same tag to both boosts and suppressions (show toast: "This tag is already in your suppressions")
- **Remove tag** — Click the × button on a tag chip to remove it
- **Limit** — Max 20 total preferences (boosts + suppressions combined). When at limit, the Add button is disabled with tooltip: "Remove a preference to add a new one"
- **Save** — `PUT /api/v1/recommendations/preferences` with current boosts and suppressions. On success, show toast "Preferences saved" and re-fetch recommendations. On error, show error toast.

#### Cold Start Prompt

For new users with no collection and no preferences, display a prompt within the preferences panel:

- "Save a few recipes or set some preferences below to help us recommend recipes you'll love."
- Pre-populate suggested boost tags from popular tag groups (top 3 cuisines, top 2 diets)

---

## Page Layout

### Desktop (>= 1024px)

```
┌────────────────────────────────────────────────────────────────┐
│  Recommended for You                           [↻] [⚙ Prefs]  │
│                                                                 │
│  "What are you looking for?"                                    │
│  [ ................................. ]  [Go]                     │
│  [Difficulty ▼]  [Max Time ▼]  ☐ Only new to me                │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ RecipeCard │ │ RecipeCard │ │ RecipeCard │ │ RecipeCard │  │
│  │ reason...  │ │ reason...  │ │ reason...  │ │ reason...  │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ RecipeCard │ │ RecipeCard │ │ RecipeCard │ │ RecipeCard │  │
│  │ reason...  │ │ reason...  │ │ reason...  │ │ reason...  │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                 │
│                      [ Load More ]                              │
└────────────────────────────────────────────────────────────────┘
```

- Full-width feed with 4-column responsive card grid (same as SearchResults)
- Preferences panel slides in from the right as a 400px side panel
- Feed content remains visible but dimmed behind the panel overlay

### Tablet (768px–1023px)

- 2-column card grid
- Filters collapse into a single row
- Preferences panel opens as a modal overlay

### Mobile (< 768px)

- 1-column card grid
- Mood input full-width
- Filters stack vertically or collapse behind a "Filters" toggle button
- Preferences panel opens as a full-screen modal
- Load More button full-width with larger touch target

---

## State Management

The recommendations page uses local component state (runes):

```typescript
type RecommendationsStep = "loading" | "feed" | "error";

let step: RecommendationsStep = $state("loading");
let recommendations: ScoredRecipe[] = $state([]);
let mood: string = $state("");
let difficulty: string | null = $state(null);
let maxTime: string | null = $state(null);
let excludeOwned: boolean = $state(false);
let page: number = $state(1);
let hasMore: boolean = $state(true);
let prefsOpen: boolean = $state(false);
let preferences: UserPreferences | null = $state(null);
let tagProfile: TagCount[] = $state([]);
```

```typescript
interface ScoredRecipeDisplay {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  totalTime: string;
  tags: Record<string, string[]>;
  image: string | null;
  score: number;
  reason: string;
}
```

- `step` drives the main UI state (loading, feed, error)
- `recommendations` accumulates results across pages (Load More appends)
- `mood`, `difficulty`, `maxTime`, `excludeOwned` control the active query
- `page` and `hasMore` manage Load More pagination
- `prefsOpen` toggles the preferences panel
- `preferences` and `tagProfile` hold data for the preferences panel

---

## Implementation Location

```
src/routes/recommendations/
  +page.server.ts              # Auth guard (redirect to /auth/login if not authenticated)
  +page.svelte                 # Recommendations page (feed, filters, load more)
src/lib/components/recommendations/
  MoodInput.svelte             # "What are you looking for?" text input with submit
  RecommendationFilters.svelte # Difficulty, max time, exclude owned filter controls
  RecommendationCard.svelte    # RecipeCard extended with reason text and score tooltip
  PreferencesPanel.svelte      # Slide-out/modal panel for managing boosts and suppressions
  TagProfileSummary.svelte     # Display of user's top tag frequencies
  PreferenceTagInput.svelte    # Tag input with autocomplete for adding boosts/suppressions
  ColdStartBanner.svelte       # Banner prompting new users to save recipes or set preferences
```

---

## Error Handling

| Scenario                          | Behavior                                                                                  |
|-----------------------------------|-------------------------------------------------------------------------------------------|
| `INVALID_LIMIT`                  | Prevented client-side — limit is hardcoded per request                                     |
| `INVALID_DIFFICULTY`             | Prevented client-side — select options are constrained                                     |
| `INVALID_DURATION`               | Prevented client-side — max time options are predefined                                    |
| `MOOD_TOO_LONG`                  | Prevented client-side — input enforces 200 char max with character counter                 |
| `TOO_MANY_PREFERENCES`          | Prevented client-side — Add button disabled at 20 total, shows count                       |
| `CONTRADICTORY_PREFERENCE`      | Prevented client-side — cannot add same tag to both boosts and suppressions                 |
| `AUTH_REQUIRED`                  | Handled by auth guard — redirect to `/auth/login`                                          |
| Network error (feed)              | Show ErrorBanner with Retry button                                                         |
| Network error (preferences save)  | Show error toast: "Couldn't save preferences. Please try again."                           |
| Server error (500)                | Show ErrorBanner: "Something went wrong. Please try again." with Retry button              |

All server errors follow the standard error envelope from [backend-architecture.md](./backend-architecture.md).

---

## Accessibility

- Mood input has a visible label: "What are you looking for?"
- Filter selects have associated `<label>` elements
- Recommendation cards are wrapped in a `role="list"` container with `role="listitem"` items
- Reason text is associated with its card via `aria-describedby`
- Score tooltip is accessible via keyboard focus
- Load More button announces new results count via `aria-live="polite"` region: "Loaded 10 more recommendations"
- Preferences panel uses focus trap when open, dismissible with Escape
- Boost and suppression tag lists use `role="list"` with descriptive labels
- Loading state announces "Loading recommendations" via `aria-live="polite"`
- Cold start banner uses `role="status"` for screen reader announcement
- All interactive elements follow keyboard patterns from [ui-components.md](./ui-components.md)

---

## Performance Considerations

- Initial recommendation fetch happens in `+page.server.ts` load function for fast first paint
- Load More uses client-side fetch with `offset` parameter to append results
- Mood input submission is debounce-free (explicit submit via Enter/button) to avoid unnecessary API calls
- Filter changes trigger an immediate fetch (replacing current results, not appending)
- Preferences panel data is fetched lazily on first open, then cached in component state
- Tag autocomplete in preferences is debounced at 300ms
- Recommendation cards reuse the same RecipeCard component from search, no extra bundle cost
