# Recipe Import

> Website recipe import pipeline: URL parsing, structured data extraction (JSON-LD, microdata), fallback scraping, normalization to internal format.

---

## Overview

The recipe import pipeline allows users to import recipes from external websites by providing a URL. The system fetches the page, extracts recipe data using structured data formats (JSON-LD, microdata) or fallback HTML scraping, normalizes the extracted data to the internal recipe format defined in `specs/recipe-data-model.md`, and presents it to the user for review before saving.

This spec covers the server-side extraction and normalization pipeline. The user-facing import flow is defined in `specs/import-flow.md`.

---

## Import Pipeline Stages

The pipeline processes a URL through four sequential stages:

```
URL → Fetch → Extract → Normalize → Review Draft
```

| Stage         | Input                 | Output                        | Can Fail |
|---------------|-----------------------|-------------------------------|----------|
| **Fetch**     | URL string            | HTML document                 | Yes      |
| **Extract**   | HTML document         | Raw recipe data (untyped)     | Yes      |
| **Normalize** | Raw recipe data       | Draft `Recipe` object         | No*      |
| **Review**    | Draft `Recipe` object | Final `Recipe` (user-edited)  | No       |

*Normalize always produces a draft, but may flag missing or low-confidence fields for user review.

---

## Stage 1: Fetch

### URL Validation

Before fetching, the URL is validated:

1. Must be a valid, absolute URL with `http` or `https` scheme.
2. Must not point to a private/internal IP range (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`).
3. Must not exceed 2,048 characters.
4. Must not be on a blocklist (initially empty, configurable).

Invalid URLs return a `400` error.

### HTTP Request

The fetch stage issues an HTTP GET request to the validated URL:

- **User-Agent** — Identifies as the recipe app (e.g., `RecipeApp/1.0`).
- **Accept** — `text/html`.
- **Timeout** — 15 seconds. Requests exceeding this return a timeout error.
- **Max response size** — 5 MB. Responses exceeding this are truncated or rejected.
- **Redirects** — Follow up to 5 redirects. More than 5 returns an error.
- **TLS** — HTTPS only in production. HTTP allowed in development for testing.

### Fetch Error Handling

| Scenario                     | Error Code                | Status |
|------------------------------|---------------------------|--------|
| Invalid URL format           | `INVALID_IMPORT_URL`      | `400`  |
| Private/internal IP          | `BLOCKED_IMPORT_URL`      | `400`  |
| DNS resolution failure       | `IMPORT_FETCH_FAILED`     | `422`  |
| Connection timeout           | `IMPORT_FETCH_TIMEOUT`    | `422`  |
| HTTP 4xx/5xx from source     | `IMPORT_SOURCE_ERROR`     | `422`  |
| Response too large           | `IMPORT_RESPONSE_TOO_LARGE` | `422` |
| Too many redirects           | `IMPORT_TOO_MANY_REDIRECTS` | `422` |

---

## Stage 2: Extract

The extractor attempts to pull recipe data from the fetched HTML using a prioritized strategy chain. It tries each strategy in order and uses the first one that succeeds.

### Strategy Priority

1. **JSON-LD** — Highest fidelity. Most recipe sites use Schema.org `Recipe` type in `<script type="application/ld+json">` blocks.
2. **Microdata** — HTML attributes (`itemscope`, `itemprop`) embedding Schema.org `Recipe` data.
3. **Fallback HTML scraping** — Heuristic-based extraction from common HTML patterns.

If all strategies fail, the pipeline returns an error indicating no recipe could be extracted.

### Strategy 1: JSON-LD Extraction

1. Find all `<script type="application/ld+json">` elements in the document.
2. Parse each as JSON. Skip invalid JSON blocks (do not fail the whole extraction).
3. Search for an object with `@type` equal to `"Recipe"` (or an array containing such an object). Also check within `@graph` arrays.
4. Extract fields from the Schema.org Recipe object.

**Field mapping (Schema.org → internal):**

| Schema.org Field          | Internal Field          | Notes                                    |
|---------------------------|-------------------------|------------------------------------------|
| `name`                    | `title`                 | Required. Fail if missing.               |
| `recipeIngredient`        | Ingredients body section| Array of strings → Markdown list.        |
| `recipeInstructions`      | Instructions body section| See instruction parsing below.          |
| `prepTime`                | `prepTime`              | ISO 8601 duration. Pass through.         |
| `cookTime`                | `cookTime`              | ISO 8601 duration. Pass through.         |
| `totalTime`               | `totalTime`             | ISO 8601 duration. Pass through.         |
| `recipeYield`             | `servings.default`      | Parse first number. Default unit: "servings". |
| `recipeCategory`          | `tags.meal`             | Best-effort mapping (see tag inference). |
| `recipeCuisine`           | `tags.cuisine`          | Lowercase, hyphenate.                    |
| `keywords`                | `tags.custom`           | Comma-separated string or array.         |
| `author`                  | `author`                | `name` property if object. String if string. |
| `image`                   | `image`                 | First URL if array. `url` if object.     |
| `description`             | Notes body section      | Optional. Placed in `## Notes`.          |

**Instruction parsing:**

`recipeInstructions` can appear in multiple Schema.org formats:

- **Array of strings** — Each string is a step.
- **Array of `HowToStep` objects** — Use the `text` property of each.
- **Array of `HowToSection` objects** — Each section has a `name` and `itemListElement` array of `HowToStep`. Render as sub-headings within Instructions.
- **Single string** — Split by newlines or sentence boundaries.

### Strategy 2: Microdata Extraction

1. Find elements with `itemscope` and `itemtype` containing `schema.org/Recipe`.
2. Walk the DOM tree within that scope, collecting `itemprop` values.
3. Map to the same field mapping table as JSON-LD.

Microdata extraction uses the same field mapping as JSON-LD but reads from HTML attributes rather than a JSON block.

### Strategy 3: Fallback HTML Scraping

When no structured data is found, attempt heuristic extraction:

1. **Title** — `<h1>`, `<meta property="og:title">`, or `<title>`.
2. **Ingredients** — Look for elements matching common patterns: `ul` or `ol` within elements whose class/id contains "ingredient".
3. **Instructions** — Look for `ol` or numbered content within elements whose class/id contains "instruction", "direction", "step", or "method".
4. **Image** — `<meta property="og:image">` or the largest `<img>` in the article area.

Fallback scraping is **best-effort** and flags all extracted fields as low-confidence for user review.

### Extraction Confidence

Each extracted field carries a confidence level:

| Confidence | Meaning                                          |
|------------|--------------------------------------------------|
| `high`     | From JSON-LD or microdata with exact field match. |
| `medium`   | From structured data but required type coercion.  |
| `low`      | From fallback scraping or heuristic inference.    |

Fields with `low` confidence are highlighted in the review UI for manual verification.

---

## Stage 3: Normalize

The normalizer transforms raw extracted data into a draft `Recipe` object conforming to `specs/recipe-data-model.md`.

### Normalization Steps

1. **Generate metadata** — Create a new `id` (ULID), `slug` (from title), `createdAt`, and `updatedAt`.
2. **Set source** — `source.type = "import"`, `source.url = <original URL>`, `source.importedAt = <current timestamp>`.
3. **Build frontmatter** — Map extracted fields to frontmatter fields. Apply defaults for missing optional fields.
4. **Build Markdown body** — Assemble `## Ingredients`, `## Instructions`, and optionally `## Notes` sections.
5. **Infer tags** — Best-effort tag inference from extracted metadata (see below).
6. **Validate** — Run the draft through frontmatter and body validation from `specs/recipe-data-model.md`. Collect validation errors as review warnings rather than hard failures.

### Tag Inference

Tags are inferred from extracted metadata using keyword matching:

- **`tags.cuisine`** — From `recipeCuisine`. Lowercase, replace spaces with hyphens, filter to known values or place in `custom`.
- **`tags.meal`** — From `recipeCategory`. Map common values: "dessert" → `dessert`, "appetizer" → `snack`, "main course" → `dinner`, "breakfast" → `breakfast`, etc.
- **`tags.diet`** — Scan keywords and title for dietary terms: "vegan", "vegetarian", "gluten-free", "dairy-free", "keto", "paleo".
- **`tags.custom`** — Remaining keywords that don't map to built-in groups. Lowercase, hyphenate, validate against tag regex `/^[a-z0-9-]{1,50}$/`.

### Duration Handling

- Schema.org durations are already ISO 8601 (e.g., `PT30M`). Pass through if valid.
- If a duration value is a plain number (e.g., `30`), assume minutes and convert to `PT{n}M`.
- If a duration value is a human-readable string (e.g., `"30 minutes"`), parse and convert to ISO 8601.
- Invalid or unparseable durations are dropped (set to `undefined`).

### Servings Handling

- `recipeYield` may be a string like `"4 servings"`, `"6"`, or `"4-6"`.
- Extract the first integer as `servings.default`.
- If a unit-like word follows the number (e.g., "cookies", "slices"), use it as `servings.unit`. Otherwise default to `"servings"`.
- If no number is found, default to `servings.default = 4`.

---

## Draft Recipe Shape

The normalize stage produces a draft with additional metadata for the review step:

```typescript
interface ImportDraft {
  recipe: Partial<Recipe>;       // The draft recipe (may have missing optional fields)
  sourceUrl: string;             // Original URL
  extractionMethod: "json-ld" | "microdata" | "html-scraping";
  fieldConfidence: Record<string, "high" | "medium" | "low">;
  warnings: ImportWarning[];     // Issues found during normalization
}

interface ImportWarning {
  field: string;                 // Which field has an issue
  code: string;                  // Machine-readable warning code
  message: string;               // Human-readable description
}
```

### Warning Codes

| Code                          | Meaning                                             |
|-------------------------------|-----------------------------------------------------|
| `MISSING_TITLE`               | No title could be extracted. User must provide one. |
| `MISSING_INGREDIENTS`         | No ingredients found. User must add them.           |
| `MISSING_INSTRUCTIONS`        | No instructions found. User must add them.          |
| `LOW_CONFIDENCE_FIELD`        | Field was extracted with low confidence.             |
| `INVALID_DURATION`            | Duration value could not be parsed.                 |
| `UNPARSEABLE_YIELD`           | Servings/yield value could not be parsed.           |
| `TRUNCATED_CONTENT`           | Body content was truncated to fit size limits.       |
| `DUPLICATE_URL`               | A recipe imported from this URL already exists.      |

---

## API Endpoint

### POST /api/v1/recipes/import

Initiates the import pipeline. Requires authentication.

**Request:**

```json
{
  "url": "https://example.com/recipe/chickpea-bowl"
}
```

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "recipe": { ... },
    "sourceUrl": "https://example.com/recipe/chickpea-bowl",
    "extractionMethod": "json-ld",
    "fieldConfidence": {
      "title": "high",
      "ingredients": "high",
      "instructions": "high",
      "prepTime": "high",
      "tags": "medium"
    },
    "warnings": [
      {
        "field": "tags.diet",
        "code": "LOW_CONFIDENCE_FIELD",
        "message": "Dietary tags were inferred from keywords and may be inaccurate."
      }
    ]
  },
  "requestId": "01J5K..."
}
```

The response returns a **draft** — it does not save the recipe. The client presents the draft for user review, and the user submits the final version via `POST /api/v1/recipes` (the standard create endpoint).

**Error Response (422):**

```json
{
  "ok": false,
  "error": {
    "code": "IMPORT_NO_RECIPE_FOUND",
    "message": "Could not extract a recipe from the provided URL.",
    "details": {
      "url": "https://example.com/not-a-recipe",
      "strategiesAttempted": ["json-ld", "microdata", "html-scraping"]
    }
  },
  "requestId": "01J5K..."
}
```

### Error Codes

| Code                          | Status | Description                                   |
|-------------------------------|--------|-----------------------------------------------|
| `INVALID_IMPORT_URL`          | `400`  | URL is malformed or fails validation.         |
| `BLOCKED_IMPORT_URL`          | `400`  | URL points to a private/blocked address.      |
| `IMPORT_FETCH_FAILED`         | `422`  | Could not fetch the URL (DNS, connection).    |
| `IMPORT_FETCH_TIMEOUT`        | `422`  | Request timed out after 15 seconds.           |
| `IMPORT_SOURCE_ERROR`         | `422`  | Source site returned an HTTP error.           |
| `IMPORT_RESPONSE_TOO_LARGE`   | `422`  | Response exceeded 5 MB limit.                 |
| `IMPORT_TOO_MANY_REDIRECTS`   | `422`  | More than 5 redirects encountered.            |
| `IMPORT_NO_RECIPE_FOUND`      | `422`  | No recipe data could be extracted.            |

---

## Implementation Location

Following the project structure from `specs/backend-architecture.md`:

```
src/lib/server/services/
  import-service.ts          # Pipeline orchestrator
src/lib/server/import/
  fetcher.ts                 # URL validation and HTTP fetch
  extractor.ts               # Strategy dispatcher
  extractors/
    json-ld.ts               # JSON-LD extraction strategy
    microdata.ts             # Microdata extraction strategy
    html-scraper.ts          # Fallback HTML scraping strategy
  normalizer.ts              # Raw data → Recipe draft conversion
  tag-inferrer.ts            # Tag inference from extracted metadata
  duration-parser.ts         # Human-readable duration → ISO 8601
  yield-parser.ts            # Recipe yield string → servings object
src/routes/api/v1/recipes/
  import/
    +server.ts               # POST /api/v1/recipes/import
```

---

## Security Considerations

- **SSRF prevention** — The URL validator blocks private IP ranges and localhost to prevent server-side request forgery.
- **HTML parsing** — Use a DOM parser (e.g., `deno-dom` or `linkedom`) rather than regex for HTML extraction. Never execute JavaScript from fetched pages.
- **Content size limits** — The 5 MB fetch limit and 50,000 character body limit prevent resource exhaustion.
- **No automatic save** — Imported recipes are always presented as drafts for user review. This prevents injecting malicious content directly into the database.
- **URL blocklist** — Configurable list of domains to block. Can be extended if abuse patterns emerge.
- **Rate limiting** — Import requests should be rate-limited per user (e.g., 10 imports per minute) to prevent abuse.

---

## Performance Considerations

- **Fetch timeout** — 15 seconds prevents hanging on slow sites.
- **Strategy short-circuit** — The extractor stops at the first successful strategy rather than trying all three.
- **No caching of fetched pages** — Each import fetches fresh content. Caching could serve stale recipes and complicates invalidation.
- **Async pipeline** — Each stage is async, allowing the server to handle other requests while waiting on external fetches.

---

## Limitations

- **JavaScript-rendered content** — The pipeline fetches raw HTML and does not execute JavaScript. Sites that render recipe content entirely via client-side JavaScript will not be supported. This covers the vast majority of recipe sites, which use server-side rendering.
- **Paywalled content** — The pipeline cannot access content behind paywalls or login walls. The fetch will return whatever the unauthenticated request receives.
- **Non-English recipes** — The pipeline handles any language for ingredients and instructions (stored as-is), but tag inference is English-only in v1.
- **No image download** — The `image` field stores the source URL. Image proxying or download is a future enhancement.
