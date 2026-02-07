# Feature: Recipe Import from URL

> Full feature spec for importing recipes from URLs: supported sites, failure modes, user flow.

---

## Overview

Recipe import allows users to bring recipes into the app from external websites by pasting a URL. The system fetches the page, extracts structured recipe data (JSON-LD, microdata, or fallback HTML scraping), normalizes it to the internal format, and presents a draft for the user to review and edit before saving.

This spec builds on:
- [recipe-import.md](./recipe-import.md) — server-side extraction pipeline, strategy chain, normalization
- [import-flow.md](./import-flow.md) — frontend UI for URL input, progress, review, and error states
- [recipe-data-model.md](./recipe-data-model.md) — canonical recipe schema the draft must conform to
- [api-routes.md](./api-routes.md) — `POST /api/v1/recipes/import` and `POST /api/v1/recipes`
- [recipe-editor.md](./recipe-editor.md) — editor components reused in the review step

---

## User Stories

### US-1: Import a Recipe by URL

**As a** user who found a recipe online,
**I want to** paste the recipe's URL and have it automatically imported,
**so that** I can save it to my collection without retyping it.

**Example:** Pasting `https://example.com/chickpea-bowl` extracts the title, ingredients, instructions, and metadata into a draft recipe.

### US-2: Review and Edit Before Saving

**As a** user importing a recipe,
**I want to** review and edit the extracted data before saving,
**so that** I can correct extraction errors and customize the recipe to my liking.

### US-3: See Extraction Confidence

**As a** user reviewing an imported recipe,
**I want to** see which fields were extracted with low confidence,
**so that** I know which parts need manual verification.

**Example:** A field extracted via HTML scraping is highlighted in amber with a tooltip: "This field was extracted with low confidence. Please verify."

### US-4: Handle Import Failures Gracefully

**As a** user importing from an unsupported or broken URL,
**I want to** see a clear error message explaining what went wrong,
**so that** I can try a different URL or create the recipe manually.

### US-5: Cancel an In-Progress Import

**As a** user who submitted the wrong URL,
**I want to** cancel the import while it's loading,
**so that** I don't have to wait for it to finish.

### US-6: Discard an Imported Draft

**As a** user reviewing an imported recipe,
**I want to** discard the draft and start over,
**so that** I can try a different URL or abandon the import.

### US-7: Import Preserves Source Attribution

**As a** user importing a recipe,
**I want** the saved recipe to reference the original source URL,
**so that** I can revisit the original page later.

---

## Acceptance Criteria

### URL Input & Validation

| # | Criterion |
|---|-----------|
| AC-1 | URL input field auto-focuses on page load. |
| AC-2 | Client-side validation rejects empty input, non-HTTP(S) schemes, and URLs exceeding 2,048 characters. |
| AC-3 | Validation errors appear inline below the input field. |
| AC-4 | Submit button is disabled while the input is empty or invalid. |
| AC-5 | Submitting a valid URL transitions to the loading state. |

### Loading & Progress

| # | Criterion |
|---|-----------|
| AC-6 | A spinner and "Importing recipe..." message are shown during extraction. |
| AC-7 | The domain being fetched is displayed (e.g., "Fetching page from example.com"). |
| AC-8 | A Cancel button is available that aborts the in-flight request via `AbortController`. |
| AC-9 | If the request exceeds 5 seconds, a reassurance message appears: "This usually takes a few seconds." |
| AC-10 | The URL input and submit button are disabled during loading. |

### Extraction & Pipeline

| # | Criterion |
|---|-----------|
| AC-11 | The server-side pipeline attempts extraction strategies in priority order: JSON-LD, microdata, HTML scraping. |
| AC-12 | The first successful strategy is used; remaining strategies are skipped. |
| AC-13 | If all strategies fail, the API returns `IMPORT_NO_RECIPE_FOUND` (HTTP 422). |
| AC-14 | URLs pointing to private/internal IP ranges are rejected with `BLOCKED_IMPORT_URL` (HTTP 400). |
| AC-15 | Fetch timeout is 15 seconds; exceeding returns `IMPORT_FETCH_TIMEOUT` (HTTP 422). |
| AC-16 | Response size is capped at 5 MB; exceeding returns `IMPORT_RESPONSE_TOO_LARGE` (HTTP 422). |
| AC-17 | Redirect chain is limited to 5 hops; exceeding returns `IMPORT_TOO_MANY_REDIRECTS` (HTTP 422). |

### Review & Edit

| # | Criterion |
|---|-----------|
| AC-18 | On successful extraction, the draft is displayed in the `RecipeEditor` component with all extracted fields pre-populated. |
| AC-19 | A source banner at the top shows "Imported from {domain} via {method}" with a link to the original URL. |
| AC-20 | Fields with `low` confidence have an amber warning border and tooltip. |
| AC-21 | Import warnings (missing fields, unparseable values) are shown in a collapsible alert section above the form. |
| AC-22 | `source.type` is set to `"import"` and `source.url` is set to the original URL; both are read-only. |
| AC-23 | The user can edit any other field before saving. |
| AC-24 | Saving calls `POST /api/v1/recipes` and on success shows a "Recipe imported!" toast and redirects to `/recipes/{slug}`. |
| AC-25 | Validation errors from the create endpoint are displayed inline in the editor. |

### Discard & Navigation

| # | Criterion |
|---|-----------|
| AC-26 | A "Discard" button returns to the URL input step. |
| AC-27 | If the user has edited the draft, clicking Discard shows a confirmation dialog: "Discard imported recipe? Your edits will be lost." |
| AC-28 | Confirming discard clears the draft and returns to the URL input step with the field empty. |

### Error States

| # | Criterion |
|---|-----------|
| AC-29 | Each pipeline error code maps to a user-friendly message (see error message table in import-flow.md). |
| AC-30 | All error states include a "Try Another URL" button that returns to URL input with the field pre-filled. |
| AC-31 | All error states include a "Create Manually" button that navigates to `/recipes/new`. |
| AC-32 | Error states use `role="alert"` for screen reader announcement. |

---

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| EC-1 | URL points to a page with no recipe data (e.g., a blog homepage) | Pipeline returns `IMPORT_NO_RECIPE_FOUND`. Error state shown with "Try Another URL" and "Create Manually" options. |
| EC-2 | URL points to a page with multiple recipes (JSON-LD contains an array) | Extract the first `Recipe` object found. The user can manually adjust if the wrong recipe was extracted. |
| EC-3 | URL returns a 404 or 500 | `IMPORT_SOURCE_ERROR` shown. Message: "The website returned an error. The recipe page may have moved or been removed." |
| EC-4 | URL is behind a paywall or login wall | Pipeline receives whatever the unauthenticated response returns. If no recipe is found, `IMPORT_NO_RECIPE_FOUND`. |
| EC-5 | URL content is JavaScript-rendered (SPA with no SSR) | Pipeline fetches raw HTML only (no JS execution). Likely yields `IMPORT_NO_RECIPE_FOUND`. |
| EC-6 | Extracted recipe is missing title | `MISSING_TITLE` warning. Title field in the editor is empty and highlighted. User must provide a title before saving. |
| EC-7 | Extracted recipe is missing ingredients or instructions | Corresponding `MISSING_INGREDIENTS` / `MISSING_INSTRUCTIONS` warning. Sections are empty in the editor. User must add content before saving. |
| EC-8 | Duration values are in non-standard format (e.g., "30 minutes" instead of ISO 8601) | Duration parser converts to ISO 8601. If unparseable, field is left blank with `INVALID_DURATION` warning. |
| EC-9 | `recipeYield` is a range like "4-6 servings" | First integer (4) is used as `servings.default`. |
| EC-10 | User has already imported a recipe from the same URL | `DUPLICATE_URL` warning shown with a link to the existing recipe. Import is still allowed (user may want a variation). |
| EC-11 | User cancels during loading, then immediately submits again | Previous request is aborted. New request starts cleanly. |
| EC-12 | Network error during save (after review) | Error toast with retry option. Draft is preserved in component state. |
| EC-13 | Very large recipe page (near 5 MB limit) | If under limit, proceeds normally but may be slow. If over, returns `IMPORT_RESPONSE_TOO_LARGE`. |
| EC-14 | URL contains special characters or non-ASCII domains (IDN) | URL is validated as-is. Fetch uses the URL as provided. |

---

## Supported Sites

The import pipeline works with **any website** that embeds recipe data using standard formats. No site-specific scraping logic is used.

### Extraction Strategy Coverage

| Strategy | Coverage | Fidelity |
|----------|----------|----------|
| JSON-LD (`schema.org/Recipe`) | ~80% of recipe sites | High — structured, typed fields |
| Microdata (`itemscope/itemprop`) | ~10% additional | High — same schema, HTML-embedded |
| Fallback HTML scraping | Remaining sites | Low — heuristic, best-effort |

### Sites Known to Work Well (JSON-LD)

Most major recipe platforms embed JSON-LD structured data, including sites built on WordPress with recipe plugins (WP Recipe Maker, Tasty Recipes), food media sites, and cooking platforms.

### Sites Expected to Fail

- Sites that render content entirely via client-side JavaScript with no SSR
- Sites behind authentication or paywalls
- Non-recipe pages (blogs, videos without structured data)
- PDFs or non-HTML content

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Pipeline end-to-end (fetch + extract + normalize) | < 15s (bounded by fetch timeout) |
| Extract + normalize (after fetch completes) | < 500ms |
| Review page render (editor with pre-populated data) | < 200ms |
| Save (create endpoint) | < 300ms |

---

## Security Requirements

- SSRF prevention: URLs targeting private IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`) are blocked server-side.
- No JavaScript execution from fetched pages — DOM parsing only.
- Content size capped at 5 MB to prevent resource exhaustion.
- No automatic save — all imports go through user review.
- Rate limiting: 10 import requests per user per minute.
- URL blocklist is configurable for abuse prevention.

---

## Accessibility Requirements

- URL input has a visible label: "Recipe URL".
- Loading state announces "Importing recipe" via `aria-live="polite"`.
- Error states use `role="alert"` for immediate screen reader announcement.
- Confidence indicators use `aria-describedby` to link warning tooltips to fields.
- Cancel button is keyboard-focusable with label "Cancel import".
- Discard confirmation dialog traps focus and is keyboard-navigable.

---

## Out of Scope

- Batch import (importing multiple URLs at once).
- Re-importing / refreshing a previously imported recipe from its source URL.
- Image download or proxying — the `image` field stores the source URL only.
- Site-specific scraping adapters — the pipeline uses generic extraction strategies only.
- Non-English tag inference — tag inference from keywords is English-only in v1.
- Import from non-HTTP sources (e.g., file upload of HTML, email forwarding).
