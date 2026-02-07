# Feature: Recipe Recommendations

> Full feature spec for recipe recommendations: personalization inputs, display, refresh behavior.

---

## Overview

Recipe recommendations surface personalized recipe suggestions based on the user's collection, explicit taste preferences, and contextual queries. The system uses content-based filtering — scoring recipes by tag similarity to the user's profile — to produce transparent, explainable suggestions. Users can refine recommendations with a "what are you looking for?" mood input, filter by difficulty and time, and manage explicit boost/suppress preferences.

This spec builds on:
- [recommendation-engine.md](./recommendation-engine.md) — scoring algorithm, ranking pipeline, cold-start handling, API endpoints
- [recommendations-ui.md](./recommendations-ui.md) — page layout, components, state management, accessibility
- [recipe-data-model.md](./recipe-data-model.md) — canonical recipe schema and tag taxonomy
- [api-routes.md](./api-routes.md) — `GET /api/v1/recommendations`, `GET /api/v1/recommendations/profile`, `PUT /api/v1/recommendations/preferences`, `POST /api/v1/recipes/:slug/interact`
- [ui-components.md](./ui-components.md) — shared RecipeCard, TagBadgeList, SearchBar components

---

## User Stories

### US-1: Browse Personalized Recommendations

**As a** user with saved recipes,
**I want to** see a feed of recipe suggestions tailored to my taste,
**so that** I can discover new recipes I'm likely to enjoy.

**Example:** A user who has saved many Mediterranean and vegan recipes sees recommendations weighted toward those tags, with reason text like "Matches your preference for Mediterranean and vegan recipes."

### US-2: Understand Why a Recipe Was Recommended

**As a** user browsing recommendations,
**I want to** see a short explanation for each suggestion,
**so that** I understand why it was recommended and can trust the results.

**Example:** A recommendation card shows "You're interested in Japanese cuisine" beneath the recipe tags.

### US-3: Refine Recommendations with a Mood Query

**As a** user looking for something specific,
**I want to** type a free-text query like "something quick and light" and see updated suggestions,
**so that** I can narrow results to match what I'm in the mood for.

### US-4: Filter by Difficulty and Time

**As a** user with time constraints,
**I want to** filter recommendations by difficulty and maximum cooking time,
**so that** I only see recipes I can realistically make right now.

### US-5: Manage Taste Preferences

**As a** user with strong taste preferences,
**I want to** explicitly boost tags I like and suppress tags I dislike,
**so that** recommendations reflect my preferences even if my collection doesn't fully represent them.

**Example:** A user boosts "cuisine:japanese" and suppresses "diet:keto" — Japanese recipes rank higher and keto recipes are excluded regardless of collection contents.

### US-6: Get Useful Recommendations as a New User

**As a** new user with no saved recipes,
**I want to** see popular or recent recipes and be prompted to set preferences,
**so that** I can start discovering recipes immediately and improve recommendations over time.

### US-7: Refresh for Different Suggestions

**As a** user who wants variety,
**I want to** refresh the recommendation feed to get a different set of results,
**so that** I can explore beyond the initial suggestions without changing my filters.

### US-8: Load More Recommendations

**As a** user who wants to keep browsing,
**I want to** load additional recommendations beyond the initial set,
**so that** I can see more options without restarting the page.

### US-9: View My Taste Profile

**As a** user managing preferences,
**I want to** see my computed tag frequency profile (top tags from my collection),
**so that** I understand what the engine already knows about my taste before adding explicit overrides.

---

## Acceptance Criteria

### Recommendation Feed

| # | Criterion |
|---|-----------|
| AC-1 | On page load, fetch `GET /api/v1/recommendations?limit=10` and display results as RecipeCards. |
| AC-2 | Each card shows recipe title, image, tags, difficulty, total time, and a reason string in muted text. |
| AC-3 | Each card shows a relevance score in a tooltip on hover (hidden by default). |
| AC-4 | Clicking a card navigates to `/recipes/{slug}`. |
| AC-5 | Results display in a responsive grid: 4 columns on desktop, 2 on tablet, 1 on mobile. |
| AC-6 | A "Load More" button appends the next page of results. It is hidden when no more results are available. |
| AC-7 | A refresh button re-fetches recommendations with the same parameters, producing a new diversity-ranked set. |

### Mood Query

| # | Criterion |
|---|-----------|
| AC-8 | A text input with placeholder "What are you looking for?" is shown above the feed. |
| AC-9 | Max input length is 200 characters, enforced client-side with a character counter. |
| AC-10 | Submitting via Enter or Go button re-fetches with the `mood` query parameter. |
| AC-11 | A clear (x) button resets the mood and re-fetches default recommendations. |

### Filter Controls

| # | Criterion |
|---|-----------|
| AC-12 | A difficulty dropdown offers: Any (default), Easy, Medium, Hard. |
| AC-13 | A max time dropdown offers: Any (default), Under 15 min, Under 30 min, Under 1 hour, Under 2 hours. |
| AC-14 | An "Only show recipes I haven't saved" checkbox maps to the `excludeOwned` parameter. |
| AC-15 | Changing any filter immediately re-fetches recommendations (replacing, not appending). |
| AC-16 | Filters are session-local state and do not persist in the URL. |

### Preference Management

| # | Criterion |
|---|-----------|
| AC-17 | A gear icon in the page header opens the preferences panel (slide-out on desktop, modal on mobile). |
| AC-18 | On panel open, fetch `GET /api/v1/recommendations/profile` and display the top 5 tags with frequencies. |
| AC-19 | Boosts section shows current boosted tags as chips with remove (x) buttons. |
| AC-20 | Suppressions section shows current suppressed tags as chips with remove (x) buttons. |
| AC-21 | An "Add tag" input with autocomplete (querying `GET /api/v1/tags`) allows adding tags to either section. |
| AC-22 | The same tag cannot appear in both boosts and suppressions. Attempting to add a duplicate shows a toast. |
| AC-23 | Maximum 20 total preferences (boosts + suppressions). At the limit, the Add button is disabled with a tooltip. |
| AC-24 | A counter shows current usage (e.g., "3 of 20 used"). |
| AC-25 | Clicking "Save Preferences" calls `PUT /api/v1/recommendations/preferences` and re-fetches recommendations on success. |
| AC-26 | Success shows toast: "Preferences saved." Error shows toast: "Couldn't save preferences. Please try again." |

### Cold Start

| # | Criterion |
|---|-----------|
| AC-27 | New users with no collection see popular/recent recipes with a banner: "Save a few recipes to get personalized recommendations!" |
| AC-28 | New users see suggested boost tags in the preferences panel (top 3 cuisines, top 2 diets from popular tags). |
| AC-29 | Users with 1-5 recipes see recommendations supplemented with popular recipes (confidence discount applied per engine spec). |

### Authentication

| # | Criterion |
|---|-----------|
| AC-30 | The `/recommendations` route requires authentication. Unauthenticated users are redirected to `/auth/login`. |

---

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| EC-1 | User has no saved recipes and no preferences | Cold start: show popular/recent recipes with banner prompting to save recipes or set preferences. |
| EC-2 | User has preferences but no collection | Engine uses boosted tags as the frequency profile. Recommendations reflect explicit preferences only. |
| EC-3 | User has a very sparse collection (1-5 recipes) | Engine applies confidence discount to tag similarity. Feed is supplemented with popular recipes. |
| EC-4 | No recipes exist in the database at all | EmptyState: "No recipes yet. Add some recipes to get personalized recommendations." with link to `/recipes/new`. |
| EC-5 | Mood query returns zero results | EmptyState: "No recipes match your filters. Try adjusting your criteria." with Clear Filters button. |
| EC-6 | User sets 20 preferences then tries to add another | Add button is disabled. Tooltip: "Remove a preference to add a new one." |
| EC-7 | User tries to add the same tag as both a boost and suppression | Toast: "This tag is already in your suppressions" (or boosts). Tag is not added. |
| EC-8 | Refresh produces identical results | Possible if the candidate pool is very small. No special handling — user sees the same cards. |
| EC-9 | User changes filters while Load More results are loading | In-flight request is cancelled. New request with updated filters replaces results. |
| EC-10 | Network error during initial load | ErrorBanner: "Couldn't load recommendations. Please try again." with Retry button. |
| EC-11 | Network error during Load More | Error toast: "Couldn't load more recommendations." Existing results are preserved. Load More button remains enabled. |
| EC-12 | Network error saving preferences | Error toast: "Couldn't save preferences. Please try again." Panel stays open with unsaved state. |
| EC-13 | User navigates away and returns | Recommendations are re-fetched fresh (no client-side cache across navigations). Preferences panel state is reset. |

---

## Refresh Behavior

### When Recommendations Re-fetch

| Trigger | Behavior |
|---------|----------|
| Page load / navigation | Fresh fetch with default parameters |
| Mood submit | Replace results with mood-filtered recommendations |
| Mood clear | Replace results with default recommendations |
| Filter change (difficulty, maxTime, excludeOwned) | Replace results with filtered recommendations |
| Refresh button click | Replace results with same parameters (new diversity ranking) |
| Load More | Append next page to existing results |
| Preferences saved | Replace results with updated preference-weighted recommendations |

### Request Deduplication

- Only one recommendation request is in flight at a time.
- If a new fetch is triggered while one is pending, the pending request is cancelled via `AbortController`.
- Load More requests are not cancelled by filter changes — filter changes cancel and replace.

---

## Personalization Inputs Summary

| Input | Source | Effect on Recommendations |
|-------|--------|---------------------------|
| Tag frequency profile | Computed from user's saved recipes | Core ranking signal (weight 0.6) — recipes with similar tags score higher |
| Explicit boosts | User-set via preferences panel | Boosted tags add +0.15 per tag to preference score (weight 0.25) |
| Explicit suppressions | User-set via preferences panel | Suppressed tags add -0.5 per tag — strongly demotes matching recipes |
| Mood query | Free-text input on recommendations page | Passed to engine as contextual hint for result selection |
| Difficulty filter | Dropdown on recommendations page | Hard filter — only recipes matching the selected difficulty are scored |
| Max time filter | Dropdown on recommendations page | Hard filter — only recipes within the time limit are scored |
| Exclude owned | Checkbox on recommendations page | Hard filter — excludes recipes already in user's collection |
| Freshness | Automatic (recipe creation date) | Small bonus (weight 0.1) for recipes added in the last 30 days |
| Diversity | Automatic (re-ranking) | Penalizes candidates too similar to already-selected recommendations |

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Initial recommendation fetch (server) | < 500ms for < 10,000 recipe database |
| Preference profile fetch | < 200ms |
| Preference save | < 300ms |
| Load More (client-side fetch) | < 500ms |
| Tag autocomplete response | < 200ms |
| Page render with 10 cards | < 200ms |

---

## Security Requirements

- All recommendation endpoints require authentication.
- Preference data is scoped to the authenticated user — no cross-user access.
- Mood input is sanitized server-side to prevent injection.
- Tag autocomplete queries are parameterized (no raw SQL interpolation).
- Rate limiting: 30 recommendation requests per user per minute.
- Interaction tracking rate limit: 1000 per user per day (prevents abuse).

---

## Accessibility Requirements

- Mood input has a visible label: "What are you looking for?"
- Filter selects have associated `<label>` elements.
- Recommendation cards are in a `role="list"` container with `role="listitem"` items.
- Reason text is linked to its card via `aria-describedby`.
- Score tooltip is accessible via keyboard focus.
- Load More button announces new result count via `aria-live="polite"`.
- Preferences panel traps focus when open, dismissible with Escape.
- Boost and suppression lists use `role="list"` with descriptive group labels.
- Loading state announces "Loading recommendations" via `aria-live="polite"`.
- Cold start banner uses `role="status"`.
- All interactive elements follow keyboard patterns from ui-components.md.

---

## Out of Scope

- Collaborative filtering (cross-user recommendation signals).
- ML-based recommendation models or embeddings.
- Recipe-to-recipe "similar recipes" suggestions (could layer on later).
- Saved/bookmarked recommendation lists.
- Notification-based recommendations ("We think you'd like this new recipe").
- A/B testing of recommendation algorithms.
- Recipe interaction tracking beyond `view` and `save` in v1.
