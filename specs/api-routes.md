# API Routes

> REST endpoint definitions, request/response shapes, auth requirements per route.

---

## Overview

The recipe app exposes a JSON REST API for all client-server communication. SvelteKit handles routing via its file-based `+server.ts` convention. All API routes live under the `/api` prefix and return JSON responses with consistent shapes.

---

## Conventions

### Base Path

All API routes are prefixed with `/api/v1`. Versioning is baked into the path to allow non-breaking evolution.

### Request/Response Format

- **Content-Type:** `application/json` for all request and response bodies.
- **Dates:** ISO 8601 strings (e.g., `"2026-01-15T10:30:00Z"`).
- **Durations:** ISO 8601 duration strings (e.g., `"PT15M"`).
- **IDs:** ULID strings (26 characters).

### HTTP Methods

| Method   | Purpose                        |
|----------|--------------------------------|
| `GET`    | Read resources                 |
| `POST`   | Create resources               |
| `PUT`    | Full replacement of a resource |
| `PATCH`  | Partial update of a resource   |
| `DELETE` | Remove a resource              |

### Response Envelope

All responses use a consistent envelope:

**Success:**

```json
{
  "data": { ... },
  "meta": { "requestId": "01J5K..." }
}
```

**Success (list):**

```json
{
  "data": [ ... ],
  "meta": {
    "requestId": "01J5K...",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 142,
      "totalPages": 8
    }
  }
}
```

**Error:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [ ... ]
  },
  "meta": { "requestId": "01J5K..." }
}
```

### Status Codes

| Code  | Usage                                      |
|-------|--------------------------------------------|
| `200` | Successful read or update                  |
| `201` | Successful creation                        |
| `204` | Successful deletion (no body)              |
| `400` | Validation error or malformed request      |
| `404` | Resource not found                         |
| `409` | Conflict (e.g., duplicate slug)            |
| `422` | Unprocessable entity (valid JSON, bad data)|
| `500` | Internal server error                      |

---

## Recipe Endpoints

### `GET /api/v1/recipes`

List recipes with pagination, sorting, and optional filtering.

**Query Parameters:**

| Param      | Type     | Default        | Description                                |
|------------|----------|----------------|--------------------------------------------|
| `page`     | `number` | `1`            | Page number (1-based).                     |
| `pageSize` | `number` | `20`           | Items per page. Max `100`.                 |
| `sort`     | `string` | `"-createdAt"` | Sort field. Prefix `-` for descending. Allowed: `createdAt`, `updatedAt`, `title`. |
| `difficulty` | `string` | —            | Filter by difficulty: `easy`, `medium`, `hard`. |

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "01J5K...",
      "title": "Crispy Chickpea Bowl",
      "slug": "crispy-chickpea-bowl",
      "author": "Jane Doe",
      "difficulty": "easy",
      "prepTime": "PT15M",
      "cookTime": "PT25M",
      "totalTime": "PT40M",
      "servings": { "default": 4, "unit": "bowls" },
      "tags": {
        "cuisine": ["mediterranean"],
        "meal": ["lunch", "dinner"],
        "diet": ["vegan", "gluten-free"]
      },
      "image": null,
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "requestId": "01J5K...",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 142,
      "totalPages": 8
    }
  }
}
```

**Notes:**
- List responses return summary objects (no `document` body) to keep payloads small.
- The full recipe document is available via the detail endpoint.

---

### `GET /api/v1/recipes/:slug`

Get a single recipe by its URL slug.

**Response:** `200 OK`

```json
{
  "data": {
    "id": "01J5K...",
    "title": "Crispy Chickpea Bowl",
    "slug": "crispy-chickpea-bowl",
    "author": "Jane Doe",
    "source": {
      "type": "import",
      "url": "https://example.com/recipe/chickpea-bowl",
      "importedAt": "2026-01-15T10:30:00Z"
    },
    "tags": {
      "cuisine": ["mediterranean"],
      "meal": ["lunch", "dinner"],
      "diet": ["vegan", "gluten-free"],
      "technique": ["roasting"],
      "custom": ["meal-prep", "quick"]
    },
    "servings": { "default": 4, "unit": "bowls" },
    "prepTime": "PT15M",
    "cookTime": "PT25M",
    "totalTime": "PT40M",
    "difficulty": "easy",
    "image": null,
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-01-15T10:30:00Z",
    "body": "## Ingredients\n\n- 2 cans chickpeas...\n\n## Instructions\n\n1. Preheat oven..."
  },
  "meta": { "requestId": "01J5K..." }
}
```

**Error:** `404` if slug not found.

**Notes:**
- The `body` field contains the parsed Markdown body (below the frontmatter).
- The raw `document` (frontmatter + body) is not exposed directly in the API.

---

### `POST /api/v1/recipes`

Create a new recipe.

**Request Body:**

```json
{
  "title": "Crispy Chickpea Bowl",
  "author": "Jane Doe",
  "source": {
    "type": "manual"
  },
  "tags": {
    "cuisine": ["mediterranean"],
    "meal": ["lunch", "dinner"],
    "diet": ["vegan"]
  },
  "servings": { "default": 4, "unit": "bowls" },
  "prepTime": "PT15M",
  "cookTime": "PT25M",
  "difficulty": "easy",
  "body": "## Ingredients\n\n- 2 cans chickpeas...\n\n## Instructions\n\n1. Preheat oven..."
}
```

**Auto-generated fields:** `id`, `slug`, `createdAt`, `updatedAt`, `totalTime` (if calculable).

**Response:** `201 Created`

Returns the full recipe object (same shape as the detail endpoint).

**Errors:**
- `400` — Missing required fields or invalid format.
- `422` — Body missing required sections (`## Ingredients`, `## Instructions`).
- `409` — Slug collision that couldn't be auto-resolved.

---

### `PUT /api/v1/recipes/:slug`

Full replacement of a recipe. All writable fields must be provided.

**Request Body:** Same shape as `POST`, with all fields present.

**Response:** `200 OK` — Returns the updated recipe object.

**Errors:**
- `404` — Recipe not found.
- `400` / `422` — Validation errors.

**Notes:**
- `id` and `createdAt` are preserved from the original.
- `updatedAt` is set automatically.
- `slug` is regenerated from the new title if the title changed.

---

### `PATCH /api/v1/recipes/:slug`

Partial update of a recipe. Only provided fields are changed.

**Request Body:** Any subset of writable recipe fields.

```json
{
  "title": "Updated Title",
  "tags": {
    "diet": ["vegan", "gluten-free"]
  }
}
```

**Response:** `200 OK` — Returns the full updated recipe object.

**Merge Semantics:**
- Top-level fields are replaced if provided.
- `tags`: Provided groups replace that group entirely. Omitted groups are unchanged.
- `body`: If provided, replaces the entire Markdown body. Must pass body validation.

**Errors:**
- `404` — Recipe not found.
- `400` / `422` — Validation errors on provided fields.

---

### `DELETE /api/v1/recipes/:slug`

Delete a recipe.

**Response:** `204 No Content`

**Error:** `404` if slug not found.

---

## Search & Query Endpoints

### `GET /api/v1/recipes/search`

Full-text search across recipe titles and body content.

**Query Parameters:**

| Param      | Type     | Default        | Description                              |
|------------|----------|----------------|------------------------------------------|
| `q`        | `string` | — (required)   | Search query string.                     |
| `page`     | `number` | `1`            | Page number.                             |
| `pageSize` | `number` | `20`           | Items per page. Max `100`.               |

**Response:** `200 OK` — Paginated list of matching recipe summaries, ordered by relevance.

**Error:** `400` if `q` is missing or empty.

---

### `GET /api/v1/recipes/query`

Tag-based recipe querying with boolean logic.

**Query Parameters:**

| Param      | Type     | Default | Description                                               |
|------------|----------|---------|-----------------------------------------------------------|
| `include`  | `string` | —       | Comma-separated `group:value` pairs. Recipes must match ALL. |
| `any`      | `string` | —       | Comma-separated `group:value` pairs. Recipes must match ANY.  |
| `exclude`  | `string` | —       | Comma-separated `group:value` pairs. Recipes must match NONE. |
| `page`     | `number` | `1`     | Page number.                                              |
| `pageSize` | `number` | `20`    | Items per page. Max `100`.                                |
| `sort`     | `string` | `"-createdAt"` | Sort field (same options as list endpoint).         |

**Example:**

```
GET /api/v1/recipes/query?include=diet:vegan,meal:dinner&exclude=cuisine:mexican&sort=-updatedAt
```

Returns vegan dinner recipes excluding Mexican cuisine, sorted by most recently updated.

**Response:** `200 OK` — Paginated list of matching recipe summaries.

**Error:** `400` if tag format is invalid.

---

## Tag Endpoints

### `GET /api/v1/tags`

List all tags in use across recipes, grouped by tag group.

**Response:** `200 OK`

```json
{
  "data": {
    "cuisine": [
      { "value": "mediterranean", "count": 12 },
      { "value": "japanese", "count": 8 }
    ],
    "meal": [
      { "value": "dinner", "count": 45 },
      { "value": "lunch", "count": 30 }
    ],
    "diet": [ ... ],
    "technique": [ ... ],
    "custom": [ ... ]
  },
  "meta": { "requestId": "01J5K..." }
}
```

**Notes:**
- Tags are returned with usage counts to support tag cloud / filter UI.
- Groups with no tags in use are returned as empty arrays.

---

### `GET /api/v1/tags/:group`

List tags within a specific group.

**Response:** `200 OK`

```json
{
  "data": [
    { "value": "mediterranean", "count": 12 },
    { "value": "japanese", "count": 8 }
  ],
  "meta": { "requestId": "01J5K..." }
}
```

**Error:** `400` if `group` is not a recognized tag group.

---

## SvelteKit Route Structure

API routes map to SvelteKit's file-based routing:

```
src/routes/
  api/
    v1/
      recipes/
        +server.ts          → GET (list), POST (create)
        [slug]/
          +server.ts        → GET (detail), PUT, PATCH, DELETE
        search/
          +server.ts        → GET (full-text search)
        query/
          +server.ts        → GET (tag query)
      tags/
        +server.ts          → GET (all tags)
        [group]/
          +server.ts        → GET (tags by group)
```

Each `+server.ts` exports named handler functions (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) per SvelteKit convention.

---

## Request Validation

All incoming request bodies and query parameters are validated before processing:

1. **Type checking** — Ensure fields are the correct type (string, number, array, etc.).
2. **Constraint checking** — Apply rules from the recipe data model spec (title length, tag format, duration format, etc.).
3. **Required field checking** — Ensure all required fields are present for `POST` and `PUT`.
4. **Sanitization** — Strip unknown fields from request bodies silently.

Validation errors return `400` with details indicating which fields failed:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "title", "message": "Title must be between 1 and 200 characters" },
      { "field": "tags.diet[0]", "message": "Tag value must match /^[a-z0-9-]{1,50}$/" }
    ]
  },
  "meta": { "requestId": "01J5K..." }
}
```

---

## Auth Requirements

Authentication is not yet implemented (see `specs/auth.md`). When auth is added:

- All `POST`, `PUT`, `PATCH`, `DELETE` endpoints will require authentication.
- `GET` endpoints will be public by default.
- Auth strategy and per-route requirements will be defined in the auth spec.

For now, all endpoints are unauthenticated.

---

## Rate Limiting

Not implemented in v1. When needed:

- Apply per-IP rate limits on write endpoints.
- Return `429 Too Many Requests` with a `Retry-After` header.
