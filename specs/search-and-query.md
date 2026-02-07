# Search & Query

> Tag-based query engine, filtering logic (AND/OR/NOT), full-text search, sorting, and pagination.

---

## Overview

The search and query system is the primary way users discover recipes. It provides two complementary search modes: **tag-based querying** (structured, boolean filtering by recipe metadata) and **full-text search** (unstructured keyword search across recipe content). Both modes support pagination and sorting, and can be combined in the future.

This spec defines the query engine internals — how queries are parsed, translated to SQL, executed, and results returned. The API surface is defined in `specs/api-routes.md`; this spec covers the engine behind those endpoints.

---

## Tag-Based Query Engine

### Query Model

Tag queries express boolean conditions over the `recipe_tags` table. Three operators are supported:

| Operator    | Semantics                                  | API Param   |
|-------------|--------------------------------------------|-------------|
| **AND**     | Recipe must have ALL specified tags         | `include`   |
| **OR**      | Recipe must have AT LEAST ONE of the tags   | `any`       |
| **NOT**     | Recipe must have NONE of the specified tags  | `exclude`   |

Operators can be combined in a single query. Evaluation order: AND first, then OR broadens, then NOT removes.

### Tag Identifier Format

Tags are referenced as `group:value` pairs (e.g., `diet:vegan`, `cuisine:japanese`). Both `group` and `value` must match their validation rules from `specs/recipe-data-model.md`:

- **group** — One of: `cuisine`, `meal`, `diet`, `technique`, `custom`.
- **value** — Matches `/^[a-z0-9-]{1,50}$/`.

Invalid tag identifiers in a query must return a `400` error with details about which tags are malformed.

### Query Parsing

The query parser accepts comma-separated `group:value` strings from the API query parameters and produces a structured query object:

```typescript
interface TagQuery {
  include: TagFilter[];  // AND — all must match
  any: TagFilter[];      // OR — at least one must match
  exclude: TagFilter[];  // NOT — none must match
}

interface TagFilter {
  group: string;
  value: string;
}
```

**Parsing rules:**

1. Split each parameter value by `,` to get individual tag identifiers.
2. Split each tag identifier by `:` (first occurrence only) to get `group` and `value`.
3. Trim whitespace from group and value.
4. Validate group is a known tag group and value matches the tag regex.
5. Deduplicate within each operator — duplicate tags are silently dropped.
6. If a tag appears in both `include` and `exclude`, return `400` — contradictory query.

### Query Execution

Tag queries are translated to SQL against the `recipe_tags` table. The execution strategy uses subqueries with set operations.

**AND (include):**

Each included tag produces a subquery. Results are intersected to find recipes matching all tags.

```sql
SELECT recipe_id FROM recipe_tags
WHERE tag_group = ? AND tag_value = ?
INTERSECT
SELECT recipe_id FROM recipe_tags
WHERE tag_group = ? AND tag_value = ?
```

**OR (any):**

All OR tags are combined in a single query with `OR` conditions, returning distinct recipe IDs.

```sql
SELECT DISTINCT recipe_id FROM recipe_tags
WHERE (tag_group = ? AND tag_value = ?)
   OR (tag_group = ? AND tag_value = ?)
```

**NOT (exclude):**

Excluded tags produce a `NOT IN` subquery filtering out matching recipes.

```sql
AND r.id NOT IN (
  SELECT recipe_id FROM recipe_tags
  WHERE (tag_group = ? AND tag_value = ?)
     OR (tag_group = ? AND tag_value = ?)
)
```

**Combined query assembly:**

When multiple operators are used together, the engine builds a single query:

```sql
SELECT r.*
FROM recipes r
WHERE r.id IN (
  -- AND block (intersected)
  SELECT recipe_id FROM recipe_tags WHERE tag_group = ? AND tag_value = ?
  INTERSECT
  SELECT recipe_id FROM recipe_tags WHERE tag_group = ? AND tag_value = ?
)
AND r.id IN (
  -- OR block (unioned)
  SELECT DISTINCT recipe_id FROM recipe_tags
  WHERE (tag_group = ? AND tag_value = ?)
     OR (tag_group = ? AND tag_value = ?)
)
AND r.id NOT IN (
  -- NOT block
  SELECT recipe_id FROM recipe_tags
  WHERE (tag_group = ? AND tag_value = ?)
)
ORDER BY ...
LIMIT ? OFFSET ?;
```

If only one operator is used, the other blocks are omitted entirely (no empty `IN ()` clauses).

### Edge Cases

- **Empty query** (no operators provided) — Return all recipes (equivalent to `GET /api/v1/recipes` list endpoint).
- **No results** — Return an empty `data` array with pagination showing `totalItems: 0`.
- **Tag not in use** — Valid query, just returns no matches. Not an error.
- **All three operators empty** — Treated as empty query.

---

## Full-Text Search

### Search Engine

Full-text search uses SQLite's FTS5 extension via the `recipes_fts` virtual table (see `specs/database.md`). FTS5 provides tokenization, stemming (via the default `unicode61` tokenizer), and relevance ranking.

### Indexed Content

The FTS index covers:

| Column  | Source                          | Weight |
|---------|---------------------------------|--------|
| `title` | Recipe title from frontmatter   | Higher |
| `body`  | Markdown body (ingredients + instructions) | Lower  |

Title matches are weighted higher than body matches to surface more relevant results.

### Query Syntax

User search input is processed before being passed to FTS5:

1. **Sanitize** — Strip any FTS5 operator characters (`"`, `*`, `+`, `-`, `NEAR`, `AND`, `OR`, `NOT`) from user input to prevent injection of advanced FTS syntax.
2. **Tokenize** — Split the sanitized input into individual terms by whitespace.
3. **Prefix matching** — Append `*` to the last term only, enabling prefix search (e.g., "chick" matches "chicken", "chickpea").
4. **Implicit AND** — Multiple terms are combined with implicit AND (FTS5 default). A search for "crispy chickpea" finds recipes containing both words.

**Example transformation:**

```
User input:    "crispy chickpea bowl"
FTS5 query:    "crispy chickpea bowl*"
```

### Relevance Ranking

FTS5's built-in `rank` function (BM25) orders results by relevance. The column weights are configured to boost title matches:

```sql
SELECT r.*, rank
FROM recipes r
JOIN recipes_fts fts ON r.rowid = fts.rowid
WHERE recipes_fts MATCH ?
ORDER BY rank
LIMIT ? OFFSET ?;
```

Column weight configuration (applied when creating or querying the FTS table):

```sql
-- bm25(recipes_fts, title_weight, body_weight)
ORDER BY bm25(recipes_fts, 10.0, 1.0)
```

### Search Result Shape

Search results return the same summary shape as the recipe list endpoint (no full `body`/`document`), plus a relevance indicator:

- Results are ordered by relevance (BM25 rank) by default.
- No explicit relevance score is exposed in the API response — ordering alone conveys relevance.

### Minimum Query Length

- The `q` parameter must be at least 1 character after trimming.
- Empty or whitespace-only queries return `400`.

---

## Sorting

Both tag queries and recipe listing support sorting. Full-text search always sorts by relevance (BM25 rank).

### Sortable Fields

| Field        | Column         | Description                |
|--------------|----------------|----------------------------|
| `createdAt`  | `created_at`   | Recipe creation timestamp  |
| `updatedAt`  | `updated_at`   | Last update timestamp      |
| `title`      | `title`        | Alphabetical by title      |

### Sort Syntax

The `sort` query parameter accepts a field name optionally prefixed with `-` for descending order:

| Value           | SQL                          |
|-----------------|------------------------------|
| `createdAt`     | `ORDER BY created_at ASC`    |
| `-createdAt`    | `ORDER BY created_at DESC`   |
| `title`         | `ORDER BY title ASC`         |
| `-title`        | `ORDER BY title DESC`        |
| `-updatedAt`    | `ORDER BY updated_at DESC`   |

**Default sort:** `-createdAt` (newest first).

**Invalid sort field:** Return `400` with an error message listing valid options.

### Sort Stability

To ensure deterministic pagination, a secondary sort on `id` is always appended:

```sql
ORDER BY created_at DESC, id DESC
```

This prevents duplicate or missing items when paginating through results with identical sort values.

---

## Pagination

All list and query endpoints use offset-based pagination.

### Parameters

| Param      | Type     | Default | Constraints          |
|------------|----------|---------|----------------------|
| `page`     | `number` | `1`     | Minimum `1`          |
| `pageSize` | `number` | `20`    | Minimum `1`, Max `100` |

### Calculation

```
offset = (page - 1) * pageSize
```

### Total Count

Every paginated response includes a total count for the current query:

```sql
-- Run as a separate COUNT query or use a window function
SELECT COUNT(*) OVER() as total_count, r.*
FROM recipes r
WHERE ...
```

The pagination meta in the response envelope:

```json
{
  "pagination": {
    "page": 2,
    "pageSize": 20,
    "totalItems": 57,
    "totalPages": 3
  }
}
```

`totalPages` is calculated as `Math.ceil(totalItems / pageSize)`.

### Out-of-Range Pages

- `page` exceeding `totalPages` returns an empty `data` array with correct pagination meta. This is not an error.
- `page` less than `1` or `pageSize` less than `1` returns `400`.

---

## Query Builder

The query engine is implemented as a composable query builder that constructs SQL from the parsed parameters. This keeps SQL generation testable and avoids string interpolation.

### Interface

```typescript
interface QueryOptions {
  tags?: TagQuery;
  search?: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  difficulty?: string;
}

interface SortOption {
  field: "createdAt" | "updatedAt" | "title";
  direction: "asc" | "desc";
}

interface QueryResult<T> {
  data: T[];
  totalItems: number;
}
```

### Implementation Approach

The query builder:

1. Starts with a base `SELECT` from `recipes`.
2. Appends `WHERE` clauses for each active filter (tags, difficulty).
3. Appends `JOIN` on `recipes_fts` if full-text search is active.
4. Appends `ORDER BY` based on sort option (or `rank` for search).
5. Appends `LIMIT` / `OFFSET` for pagination.
6. Uses parameterized queries throughout — **never** interpolates user input into SQL strings.

All query parameters are passed as SQLite bind parameters (`?`) to prevent SQL injection.

---

## Performance Considerations

### Index Usage

- Tag queries rely on `idx_recipe_tags_group_value` for fast lookups.
- Sort queries rely on `idx_recipes_created_at` and `idx_recipes_updated_at`.
- Full-text search relies on the `recipes_fts` FTS5 index.

### Query Complexity

- AND queries with many tags produce multiple `INTERSECT` subqueries. For typical usage (2–5 tags), this performs well on SQLite. If performance degrades with many tags, consider a maximum of 10 tags per operator.
- COUNT queries for pagination add a second pass. For small datasets (< 10,000 recipes), this is negligible.

### Limits

| Limit                         | Value | Rationale                          |
|-------------------------------|-------|------------------------------------|
| Max tags per operator         | 10    | Prevent overly complex queries     |
| Max `pageSize`                | 100   | Prevent large result sets          |
| Max search query length       | 200   | Prevent abuse of FTS processing    |
| Max combined filter operators | 3     | AND + OR + NOT (all three)         |

Exceeding these limits returns `400` with descriptive error messages.

---

## Error Handling

| Scenario                           | Status | Error Code          |
|------------------------------------|--------|---------------------|
| Invalid tag format (`group:value`) | `400`  | `INVALID_TAG_FORMAT`|
| Unknown tag group                  | `400`  | `INVALID_TAG_GROUP` |
| Contradictory tags (in both include & exclude) | `400` | `CONTRADICTORY_QUERY` |
| Missing search query (`q`)         | `400`  | `MISSING_SEARCH_QUERY` |
| Search query too long              | `400`  | `SEARCH_QUERY_TOO_LONG` |
| Invalid sort field                 | `400`  | `INVALID_SORT_FIELD` |
| Invalid page/pageSize              | `400`  | `INVALID_PAGINATION` |
| Too many tags per operator         | `400`  | `TOO_MANY_TAGS`     |

All errors follow the standard error envelope from `specs/api-routes.md`.
