# Database

> Database choice, schema design, migrations strategy, and indexing for tag-based queries.

---

## Overview

The recipe app needs a persistence layer that can store Markdown+frontmatter recipe documents, index structured frontmatter fields for fast querying, and support tag-based filtering. This spec defines the database choice, schema, migration approach, and indexing strategy.

---

## Database Choice: SQLite (via Deno)

SQLite is the primary database for the recipe app.

### Rationale

- **Zero infrastructure** — No separate database server to run; the database is a single file.
- **Deno-native support** — Deno ships with a built-in SQLite module (`node:sqlite` or `deno.land/x/sqlite`), keeping dependencies minimal.
- **Sufficient scale** — A personal/small-team recipe app will hold thousands of recipes at most. SQLite handles this effortlessly.
- **Full-text search** — SQLite's FTS5 extension provides full-text search out of the box.
- **JSON support** — SQLite's JSON functions allow querying structured tag data without a separate tags table for reads.
- **Portable** — The entire database can be backed up, copied, or version-controlled as a single file.

### Limitations Accepted

- No concurrent write access from multiple processes (acceptable for a single-server app).
- No built-in replication (acceptable scope — see Deployment spec for backup strategy).

---

## Schema Design

### `recipes` Table

The primary table stores the full recipe document alongside indexed frontmatter fields extracted at write time.

```sql
CREATE TABLE recipes (
  id            TEXT PRIMARY KEY,          -- ULID
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  author        TEXT,
  source_type   TEXT CHECK (source_type IN ('manual', 'import', 'ocr')),
  source_url    TEXT,
  source_imported_at TEXT,                 -- ISO 8601 datetime
  servings_default   INTEGER NOT NULL CHECK (servings_default > 0),
  servings_unit      TEXT,
  prep_time     TEXT,                      -- ISO 8601 duration
  cook_time     TEXT,                      -- ISO 8601 duration
  total_time    TEXT,                      -- ISO 8601 duration
  difficulty    TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  image         TEXT,
  created_at    TEXT NOT NULL,             -- ISO 8601 datetime
  updated_at    TEXT NOT NULL,             -- ISO 8601 datetime
  document      TEXT NOT NULL              -- Full Markdown+frontmatter source
);
```

### `recipe_tags` Table

Tags are stored in a normalized join table for efficient tag-based querying.

```sql
CREATE TABLE recipe_tags (
  recipe_id   TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_group   TEXT NOT NULL,               -- 'cuisine', 'meal', 'diet', 'technique', 'custom'
  tag_value   TEXT NOT NULL,
  PRIMARY KEY (recipe_id, tag_group, tag_value)
);
```

### `recipes_fts` Virtual Table

Full-text search over recipe titles, ingredients, and instructions.

```sql
CREATE VIRTUAL TABLE recipes_fts USING fts5(
  title,
  body,                                    -- Markdown body (ingredients + instructions)
  content='recipes',
  content_rowid='rowid'
);
```

---

## Indexing Strategy

### Standard Indexes

```sql
-- Slug lookups (recipe detail pages)
CREATE UNIQUE INDEX idx_recipes_slug ON recipes(slug);

-- Listing/sorting by date
CREATE INDEX idx_recipes_created_at ON recipes(created_at);
CREATE INDEX idx_recipes_updated_at ON recipes(updated_at);

-- Filtering by difficulty
CREATE INDEX idx_recipes_difficulty ON recipes(difficulty);

-- Tag-based query indexes
CREATE INDEX idx_recipe_tags_group_value ON recipe_tags(tag_group, tag_value);
CREATE INDEX idx_recipe_tags_value ON recipe_tags(tag_value);
```

### Tag Query Patterns

Tag-based queries use the `recipe_tags` table with set operations:

**AND query** (recipes matching ALL specified tags):

```sql
SELECT r.*
FROM recipes r
WHERE r.id IN (
  SELECT recipe_id FROM recipe_tags
  WHERE (tag_group = 'diet' AND tag_value = 'vegan')
  INTERSECT
  SELECT recipe_id FROM recipe_tags
  WHERE (tag_group = 'meal' AND tag_value = 'dinner')
);
```

**OR query** (recipes matching ANY specified tag):

```sql
SELECT DISTINCT r.*
FROM recipes r
JOIN recipe_tags t ON r.id = t.recipe_id
WHERE (t.tag_group = 'cuisine' AND t.tag_value = 'mediterranean')
   OR (t.tag_group = 'cuisine' AND t.tag_value = 'japanese');
```

**NOT query** (exclude recipes with a tag):

```sql
SELECT r.*
FROM recipes r
WHERE r.id NOT IN (
  SELECT recipe_id FROM recipe_tags
  WHERE tag_group = 'diet' AND tag_value = 'keto'
);
```

### Full-Text Search

```sql
SELECT r.*
FROM recipes r
JOIN recipes_fts fts ON r.rowid = fts.rowid
WHERE recipes_fts MATCH 'chickpea roast*'
ORDER BY rank;
```

---

## Write Path

When a recipe is created or updated, the application must:

1. Parse the Markdown+frontmatter document (see `specs/recipe-data-model.md`).
2. Validate all fields per the data model spec.
3. Apply on-save logic (`updatedAt`, slug regeneration, `totalTime` calculation).
4. **Within a single transaction:**
   a. Insert or replace the row in `recipes` with extracted frontmatter fields and the full document.
   b. Delete all existing rows in `recipe_tags` for this recipe ID.
   c. Insert new rows in `recipe_tags` for all current tags.
   d. Update the FTS index via triggers or manual insert.
5. The `document` column always holds the canonical Markdown+frontmatter source of truth.

---

## Migrations Strategy

### Approach: Versioned SQL Scripts

Migrations are forward-only SQL scripts stored in the repository, numbered sequentially.

```
migrations/
  001_create_recipes.sql
  002_create_recipe_tags.sql
  003_create_fts.sql
  ...
```

### Migration Runner

A lightweight migration runner tracks applied migrations in a `_migrations` table:

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  version   INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  applied_at TEXT NOT NULL             -- ISO 8601 datetime
);
```

On app startup, the runner:

1. Reads all `migrations/*.sql` files, sorted by version number.
2. Compares against the `_migrations` table.
3. Applies any unapplied migrations in order, within a transaction per migration.
4. Records each applied migration in `_migrations`.

### Rules

- Migrations are **append-only** — never edit a previously applied migration.
- Each migration must be idempotent where possible (use `IF NOT EXISTS`).
- Destructive changes (dropping columns/tables) require a two-phase approach: deprecate first, remove in a later migration.
- The initial schema is split across the first few migrations for clarity, not combined into a single file.

---

## Backup Strategy

- The SQLite database file should be backed up regularly (e.g., daily copy or on-demand snapshot).
- SQLite's `.backup` API or a simple file copy (while no writes are in progress) is sufficient.
- The `document` column ensures that the full recipe source can be extracted to Markdown files at any time, providing an additional recovery path.

---

## Data Integrity

### Constraints

- `id` is a ULID primary key — immutable after creation.
- `slug` has a UNIQUE constraint — enforced at the database level.
- `servings_default` is checked to be positive.
- `source_type` and `difficulty` are constrained to valid enum values.
- `recipe_tags` cascades on delete — removing a recipe removes its tags.

### Consistency

- All recipe writes (insert/update) happen in a single transaction covering `recipes`, `recipe_tags`, and FTS updates.
- The `document` column is the source of truth. If extracted columns ever drift from the document, a re-index operation can reparse all documents and rebuild the indexed columns and tags.

### Re-index Operation

For data recovery or schema changes, a re-index command should:

1. Read the `document` column for every recipe.
2. Re-parse frontmatter and body.
3. Update all extracted columns and `recipe_tags` rows.
4. Rebuild the FTS index.

This operation is idempotent and safe to run at any time.
