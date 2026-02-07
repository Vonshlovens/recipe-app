# Recommendation Engine

> Recommendation approach (content-based, collaborative, hybrid), input signals (collection, preferences, query), ranking, and cold-start handling.

---

## Overview

The recommendation engine suggests recipes to users based on their collection, taste preferences, and contextual queries. It uses a **content-based** approach — recommendations are driven by tag similarity and usage patterns within the user's own data, rather than collaborative filtering across users. This keeps the system simple, privacy-friendly, and effective at small scale (single-user or small-team).

This spec covers the engine internals — signal collection, scoring, ranking, and cold-start strategies. The API surface is defined in `specs/api-routes.md`; the UI is defined in `specs/recommendations-ui.md`.

---

## Approach: Content-Based Filtering

### Why Content-Based?

- **No minimum user count** — Collaborative filtering requires many users with overlapping behavior. A personal recipe app may have a single user. Content-based works from day one.
- **Transparent** — Recommendations are explainable: "Because you have many Mediterranean recipes" rather than opaque matrix factorization.
- **Privacy** — No cross-user data sharing. Each user's recommendations are derived solely from their own collection and explicit preferences.
- **Low complexity** — Tag-based similarity is computed with simple SQL queries. No ML model training, no background jobs, no external services.

### Why Not Collaborative or Hybrid?

Collaborative filtering and hybrid approaches are out of scope for v1. If the app grows to support many users with shared recipe libraries, a hybrid model can be layered on later without changing the content-based foundation.

---

## Input Signals

The engine uses three categories of input to produce recommendations.

### 1. Collection Signal — Tag Frequency Profile

The user's saved recipes form an implicit taste profile. The engine builds a **tag frequency profile** by counting tags across the user's collection:

```typescript
interface TagFrequencyProfile {
  userId: string;
  tagCounts: TagCount[];
  totalRecipes: number;
}

interface TagCount {
  group: string;       // e.g., "cuisine", "diet"
  value: string;       // e.g., "mediterranean", "vegan"
  count: number;       // Number of recipes with this tag
  frequency: number;   // count / totalRecipes (0–1)
}
```

**Computation:**

```sql
SELECT rt.tag_group, rt.tag_value, COUNT(*) as count
FROM recipe_tags rt
JOIN recipes r ON r.id = rt.recipe_id
WHERE r.author_id = ?
GROUP BY rt.tag_group, rt.tag_value
ORDER BY count DESC;
```

The tag frequency profile is computed on demand (not cached) since the query is fast for typical collection sizes (< 1,000 recipes).

### 2. Explicit Preferences

Users can optionally set explicit taste preferences to boost or suppress certain tags:

```typescript
interface UserPreferences {
  userId: string;
  boosts: TagFilter[];     // Tags to promote in recommendations
  suppressions: TagFilter[];  // Tags to demote/exclude
}

interface TagFilter {
  group: string;
  value: string;
}
```

Preferences are stored in a `user_preferences` table (see Database Schema below). They override the collection signal — a suppressed tag is excluded even if it appears frequently in the user's collection.

### 3. Contextual Query — "What Are You Looking For?"

Users can provide a free-text or tag-based query to guide recommendations for a specific session:

```typescript
interface RecommendationQuery {
  tags?: TagFilter[];       // Explicit tag constraints
  mood?: string;            // Free-text hint (e.g., "something quick and light")
  maxTime?: string;         // ISO 8601 duration — max totalTime
  difficulty?: "easy" | "medium" | "hard";
  excludeOwned?: boolean;   // Exclude recipes already in user's collection (default: false)
}
```

The contextual query acts as a hard filter — only recipes matching the constraints are considered. The collection and preference signals then rank within those constraints.

---

## Database Schema

### `user_preferences` Table

```sql
CREATE TABLE user_preferences (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pref_type   TEXT NOT NULL CHECK (pref_type IN ('boost', 'suppress')),
  tag_group   TEXT NOT NULL,
  tag_value   TEXT NOT NULL,
  created_at  TEXT NOT NULL,             -- ISO 8601 datetime
  PRIMARY KEY (user_id, pref_type, tag_group, tag_value)
);
```

### `recipe_interactions` Table

Tracks lightweight interaction signals for future scoring improvements:

```sql
CREATE TABLE recipe_interactions (
  id          TEXT PRIMARY KEY,          -- ULID
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id   TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('view', 'cook', 'save', 'share')),
  created_at  TEXT NOT NULL              -- ISO 8601 datetime
);

CREATE INDEX idx_interactions_user ON recipe_interactions(user_id, created_at);
CREATE INDEX idx_interactions_recipe ON recipe_interactions(recipe_id);
```

In v1, only `view` and `save` actions are tracked. `cook` and `share` are reserved for future use.

---

## Scoring Algorithm

### Recipe Score Calculation

Each candidate recipe receives a score composed of weighted sub-scores:

```typescript
interface ScoredRecipe {
  recipeId: string;
  score: number;           // Composite score (0–1)
  breakdown: {
    tagSimilarity: number; // 0–1
    preferenceBoost: number; // -1 to +1
    freshnessBonus: number;  // 0–0.1
    diversityPenalty: number; // 0–0.2
  };
}
```

### Tag Similarity Score (weight: 0.6)

Measures how well a candidate recipe's tags match the user's tag frequency profile.

**Calculation:**

1. For each tag on the candidate recipe, look up its frequency in the user's profile.
2. Sum the frequencies of matching tags.
3. Normalize by the number of tags on the candidate recipe.

```
tagSimilarity = sum(frequency(tag) for tag in recipe.tags) / count(recipe.tags)
```

This naturally favors recipes with tags the user gravitates toward, while penalizing recipes with many unfamiliar tags.

### Preference Boost (weight: 0.25)

Explicit preferences apply a direct bonus or penalty:

- Each **boosted** tag on the recipe adds `+0.15` (capped at `+1.0` total).
- Each **suppressed** tag on the recipe adds `-0.5` (can drive the sub-score to `-1.0`).

Suppression is weighted more heavily than boosting — if a user says "no seafood," that should dominate even if their collection has some seafood recipes.

### Freshness Bonus (weight: 0.1)

Recently added recipes get a small boost to surface new content:

```
freshnessBonus = max(0, 0.1 × (1 - daysSinceCreation / 30))
```

Recipes older than 30 days receive no freshness bonus. This prevents the recommendation feed from going stale.

### Diversity Penalty (weight: 0.05)

To avoid recommending 10 very similar recipes, a diversity penalty is applied during ranking (see Ranking below). Recipes that are too similar to already-selected recommendations are penalized.

### Composite Score

```
score = (0.6 × tagSimilarity) + (0.25 × preferenceBoost) + (0.1 × freshnessBonus) - diversityPenalty
```

The score is clamped to `[0, 1]`.

---

## Ranking

### Pipeline

1. **Filter** — Apply hard constraints from the contextual query (tags, maxTime, difficulty, excludeOwned).
2. **Score** — Calculate composite score for each candidate recipe.
3. **Sort** — Order by score descending.
4. **Diversify** — Re-rank the top N results to ensure variety (see Diversity below).
5. **Limit** — Return the top `limit` results (default 10, max 50).

### Diversity Re-Ranking

After scoring, the top 3× `limit` candidates are re-ranked using a greedy diversity algorithm:

1. Start with the highest-scored recipe.
2. For each subsequent slot, pick the candidate with the highest `score - diversityPenalty`.
3. The diversity penalty for a candidate increases based on tag overlap with already-selected recipes:

```
diversityPenalty = 0.2 × (sharedTags / totalTags)
```

Where `sharedTags` is the number of tags the candidate shares with any already-selected recipe, and `totalTags` is the candidate's total tag count.

This ensures the recommendation set covers different cuisines, meals, and techniques rather than clustering around a single tag profile.

---

## Cold-Start Handling

### New User (No Collection)

When a user has no saved recipes and no preferences:

1. **Popular recipes** — Return the most-viewed recipes across the platform (based on `recipe_interactions` with `action = 'view'`).
2. **Recent recipes** — If no interaction data exists at all (fresh install), return the most recently created recipes.
3. **Prompt for preferences** — The UI should encourage the user to set explicit preferences or save a few recipes to bootstrap the engine.

### New User With Preferences (No Collection)

If a user has set explicit preferences but has no collection:

- Use the boosted tags as the tag frequency profile (treat each boosted tag as frequency `1.0`).
- Apply suppression normally.
- Skip the freshness bonus (no collection age baseline).

### Sparse Collection (1–5 Recipes)

With very few recipes, the tag frequency profile is noisy. The engine:

- Applies a **confidence discount**: `effectiveFrequency = frequency × min(1, totalRecipes / 10)`. This reduces the weight of the tag similarity score until the user has at least 10 recipes.
- Supplements with popular recipes to fill the recommendation set.

---

## API Integration

### Endpoints

#### `GET /api/v1/recommendations`

Returns personalized recipe recommendations for the authenticated user.

**Query Parameters:**

| Param          | Type     | Default | Description                                  |
|----------------|----------|---------|----------------------------------------------|
| `limit`        | `number` | `10`    | Number of recommendations (1–50)             |
| `difficulty`   | `string` | —       | Filter by difficulty                         |
| `maxTime`      | `string` | —       | Max totalTime (ISO 8601 duration)            |
| `excludeOwned` | `boolean`| `false` | Exclude recipes in user's collection         |
| `tags`         | `string` | —       | Comma-separated `group:value` tag filters    |
| `mood`         | `string` | —       | Free-text hint for contextual recommendations|

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "01J5K...",
      "title": "Crispy Chickpea Bowl",
      "slug": "crispy-chickpea-bowl",
      "difficulty": "easy",
      "totalTime": "PT40M",
      "tags": {
        "cuisine": ["mediterranean"],
        "meal": ["lunch"],
        "diet": ["vegan"]
      },
      "image": "/images/01J5K....webp",
      "score": 0.82,
      "reason": "Matches your preference for Mediterranean and vegan recipes"
    }
  ],
  "requestId": "01J7..."
}
```

Each recommendation includes a `score` (for debugging/transparency) and a human-readable `reason` string explaining why the recipe was recommended.

#### `GET /api/v1/recommendations/profile`

Returns the user's computed tag frequency profile and current preferences. Useful for the preferences UI.

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "tagProfile": [
      { "group": "cuisine", "value": "mediterranean", "count": 12, "frequency": 0.4 },
      { "group": "diet", "value": "vegan", "count": 8, "frequency": 0.27 }
    ],
    "totalRecipes": 30,
    "preferences": {
      "boosts": [{ "group": "cuisine", "value": "japanese" }],
      "suppressions": [{ "group": "diet", "value": "keto" }]
    }
  },
  "requestId": "01J7..."
}
```

#### `PUT /api/v1/recommendations/preferences`

Update the user's explicit taste preferences.

**Request Body:**

```json
{
  "boosts": [
    { "group": "cuisine", "value": "japanese" },
    { "group": "meal", "value": "breakfast" }
  ],
  "suppressions": [
    { "group": "diet", "value": "keto" }
  ]
}
```

**Response (200):** Returns the updated preferences object.

#### `POST /api/v1/recipes/:slug/interact`

Record a user interaction with a recipe.

**Request Body:**

```json
{
  "action": "view"
}
```

**Response (204):** No content.

### Validation

| Rule                                        | Error Code                     | Status |
|---------------------------------------------|--------------------------------|--------|
| `limit` outside 1–50                        | `INVALID_LIMIT`                | `400`  |
| Invalid `difficulty` value                  | `INVALID_DIFFICULTY`           | `400`  |
| Invalid `maxTime` format                    | `INVALID_DURATION`             | `400`  |
| Invalid tag format in `tags` param          | `INVALID_TAG_FORMAT`           | `400`  |
| `mood` exceeds 200 characters               | `MOOD_TOO_LONG`                | `400`  |
| Invalid `action` in interact endpoint       | `INVALID_ACTION`               | `400`  |
| `boosts` + `suppressions` exceed 20 total   | `TOO_MANY_PREFERENCES`         | `400`  |
| Same tag in both boosts and suppressions    | `CONTRADICTORY_PREFERENCE`     | `400`  |
| Not authenticated                           | `AUTH_REQUIRED`                | `401`  |

All endpoints require authentication.

---

## Reason Generation

Each recommendation includes a short, human-readable `reason` string explaining why it was suggested. Reasons are generated from the scoring breakdown:

### Reason Templates

| Primary signal               | Template                                                     |
|------------------------------|--------------------------------------------------------------|
| High tag similarity          | `"Matches your preference for {topTags}"`                    |
| Explicit boost match         | `"You're interested in {boostedTags}"`                       |
| Freshness                    | `"Recently added — give it a try"`                           |
| Popular (cold start)         | `"Popular with other users"`                                 |
| Contextual query match       | `"Matches your request for {queryDescription}"`              |

The engine selects the template based on which sub-score contributed most to the composite score. If multiple signals are strong, the top two are combined (e.g., `"Matches your preference for Mediterranean recipes and easy difficulty"`).

---

## Performance Considerations

### Query Performance

- **Tag frequency profile** — Single aggregate query over `recipe_tags`. Fast for typical collection sizes.
- **Candidate scoring** — Requires reading tags for each candidate recipe. For a database with < 10,000 recipes, scoring all candidates is feasible in a single pass.
- **No pre-computation** — Recommendations are computed on demand. No background jobs or materialized views required at this scale.

### Limits

| Limit                             | Value   | Rationale                              |
|-----------------------------------|---------|----------------------------------------|
| Max `limit` per request           | 50      | Prevent oversized responses            |
| Max preferences (boosts + suppr.) | 20      | Keep preference model manageable       |
| Max `mood` length                 | 200     | Prevent abuse                          |
| Candidate pool size               | 3× limit| Balance diversity with performance     |
| Max interactions per user per day  | 1000   | Prevent abuse of interaction tracking  |

### Scaling Notes

If the recipe database grows beyond 10,000 recipes, consider:

1. **Pre-filtered candidate set** — Use tag indexes to pre-select a smaller candidate pool before scoring.
2. **Cached tag profiles** — Cache the user's tag frequency profile with a short TTL (5 minutes).
3. **Background scoring** — Move scoring to a background job and cache results.

These optimizations are not needed for v1.

---

## Error Handling

| Scenario                              | Status | Error Code                   |
|---------------------------------------|--------|------------------------------|
| No recommendations available          | `200`  | N/A — return empty array     |
| User has no collection (cold start)   | `200`  | N/A — return popular/recent  |
| Recipe not found (interact endpoint)  | `404`  | `RECIPE_NOT_FOUND`           |
| Preference update validation failure  | `400`  | See validation table above   |

The recommendation endpoint never fails — it always returns results (possibly from cold-start fallbacks). An empty array is returned only when there are truly zero recipes in the database.

All errors follow the standard error envelope from `specs/backend-architecture.md`.
