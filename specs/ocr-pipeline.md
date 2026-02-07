# OCR Pipeline

> Image upload, OCR processing (engine choice), text extraction, recipe parsing from raw OCR output, rights attestation flow.

---

## Overview

The OCR pipeline allows users to capture recipes from physical sources — cookbooks, magazine clippings, handwritten cards — by uploading a photo. The system processes the image through an OCR engine, extracts raw text, parses the text into structured recipe components (title, ingredients, instructions), and presents a draft for user review before saving.

Because recipes from physical sources may be copyrighted, the pipeline includes a **rights attestation step** where the user confirms they have the right to digitize the content before the recipe is saved.

This spec covers the server-side image processing, OCR, and parsing pipeline. The user-facing OCR flow is defined in `specs/ocr-flow.md`.

---

## OCR Pipeline Stages

The pipeline processes an uploaded image through four sequential stages:

```
Image Upload → OCR Processing → Text Parsing → Review Draft
```

| Stage           | Input                 | Output                          | Can Fail |
|-----------------|-----------------------|---------------------------------|----------|
| **Upload**      | Image file (binary)   | Validated image on disk/memory  | Yes      |
| **OCR**         | Validated image       | Raw text string                 | Yes      |
| **Parse**       | Raw text string       | Structured recipe components    | Yes*     |
| **Review**      | Draft `Recipe` object | Final `Recipe` (user-edited)    | No       |

*Parse always produces a best-effort draft, but may fail if no meaningful text was extracted.

---

## Stage 1: Image Upload

### Accepted Formats

| Format | MIME Type          | Max File Size |
|--------|--------------------|---------------|
| JPEG   | `image/jpeg`       | 10 MB         |
| PNG    | `image/png`        | 10 MB         |
| WebP   | `image/webp`       | 10 MB         |
| HEIC   | `image/heic`       | 10 MB         |

### Image Validation

1. **File type** — Verify MIME type matches an accepted format. Check magic bytes, not just the `Content-Type` header.
2. **File size** — Reject files exceeding 10 MB.
3. **Dimensions** — Minimum 200x200 pixels (too small for readable text). Maximum 8000x8000 pixels (prevent memory exhaustion).
4. **Content** — No further content validation (e.g., no NSFW detection in v1). The OCR engine handles arbitrary image content gracefully.

### Image Preprocessing

Before OCR, apply preprocessing to improve recognition accuracy:

1. **Auto-orient** — Apply EXIF orientation to correct rotated images (common from phone cameras).
2. **Grayscale conversion** — Convert to grayscale for consistent OCR input.
3. **Resize** — If the longest edge exceeds 4000 pixels, scale down proportionally. This balances accuracy with processing speed.
4. **Format normalization** — Convert HEIC to PNG before passing to the OCR engine if needed.

Use `sharp` (via `npm:sharp`) for image preprocessing. It is fast, well-maintained, and works with Deno via npm compatibility.

### Upload Error Handling

| Scenario                     | Error Code                  | Status |
|------------------------------|-----------------------------|--------|
| Missing image file           | `OCR_NO_IMAGE`              | `400`  |
| Unsupported file type        | `OCR_UNSUPPORTED_FORMAT`    | `400`  |
| File too large               | `OCR_IMAGE_TOO_LARGE`       | `400`  |
| Image too small              | `OCR_IMAGE_TOO_SMALL`       | `400`  |
| Image too large (dimensions) | `OCR_IMAGE_DIMENSIONS`      | `400`  |
| Corrupt/unreadable image     | `OCR_IMAGE_CORRUPT`         | `422`  |

---

## Stage 2: OCR Processing

### Engine: Tesseract.js

The OCR engine is **Tesseract.js** (`npm:tesseract.js`), a pure-JavaScript port of Tesseract OCR.

**Rationale:**

- **No native binary dependency** — Runs in Deno via npm compatibility without requiring system-level Tesseract installation.
- **Multilingual** — Supports 100+ languages with downloadable language packs.
- **Proven accuracy** — Tesseract is the most widely used open-source OCR engine.
- **Async processing** — Non-blocking; the server can handle other requests during OCR.

### Configuration

| Setting              | Value           | Notes                                            |
|----------------------|-----------------|--------------------------------------------------|
| Language             | `eng`           | English by default. Configurable per request.    |
| Page segmentation    | `PSM.AUTO`      | Automatic page layout analysis.                  |
| OCR engine mode      | `OEM.LSTM_ONLY` | LSTM neural net mode for best accuracy.          |
| Worker pool          | 1 worker        | Single worker in v1. Scale if needed.            |

### Language Support

The API accepts an optional `language` parameter. Supported values correspond to Tesseract language codes (e.g., `eng`, `fra`, `deu`, `spa`, `ita`, `jpn`). If not provided, defaults to `eng`.

Multiple languages can be specified as a `+`-separated string (e.g., `eng+fra`) for bilingual recipes.

### OCR Output

Tesseract.js returns structured output including:

- **Full text** — The complete recognized text as a single string.
- **Confidence score** — Overall recognition confidence (0–100).
- **Word-level data** — Individual word positions, confidence, and bounding boxes (available but not used in v1).

The pipeline uses the full text output and the overall confidence score.

### OCR Error Handling

| Scenario                      | Error Code              | Status |
|-------------------------------|-------------------------|--------|
| OCR engine initialization     | `OCR_ENGINE_ERROR`      | `500`  |
| Processing timeout (>60s)     | `OCR_TIMEOUT`           | `422`  |
| No text recognized            | `OCR_NO_TEXT`           | `422`  |
| Confidence below threshold    | `OCR_LOW_CONFIDENCE`    | `422`  |

**Confidence threshold:** If the overall confidence score is below **30**, the result is rejected as unreliable. The user is prompted to upload a clearer image.

**Processing timeout:** OCR processing is limited to **60 seconds**. Complex or large images that exceed this are rejected.

---

## Stage 3: Text Parsing

The parser transforms raw OCR text into structured recipe components. OCR text is messy — it may contain line-break artifacts, misrecognized characters, and no semantic markup. The parser uses heuristic rules to identify recipe sections.

### Parsing Strategy

1. **Clean raw text** — Normalize whitespace, fix common OCR substitutions (see below), remove page artifacts (page numbers, headers/footers patterns).
2. **Identify title** — The first prominent line of text (short, often capitalized or larger font detected by line spacing).
3. **Identify sections** — Scan for section markers:
   - Ingredients: lines matching "ingredient" (case-insensitive), or a block of short lines starting with quantities/measurements.
   - Instructions: lines matching "instruction", "direction", "method", "step", or "preparation" (case-insensitive), or a block of numbered/sequential lines.
   - Servings/yield: lines matching "serves", "yield", "makes", followed by a number.
   - Time: lines matching "prep time", "cook time", "total time" followed by a duration.
4. **Extract ingredients** — Each line in the ingredients section becomes one ingredient entry. Trim leading bullets, dashes, or numbers.
5. **Extract instructions** — Each numbered step or paragraph in the instructions section becomes one instruction step. Merge lines that are part of the same step (continuation lines without a new step number).

### Common OCR Substitutions

The parser corrects common OCR misrecognitions in recipe context:

| OCR Output | Correction  | Context                |
|------------|-------------|------------------------|
| `l` (ell)  | `1` (one)   | Before units: "l cup"  |
| `O`        | `0`         | In numbers: "35O°F"    |
| `rn`       | `m`         | Common: "cinnarnon"    |
| `cl`       | `d`         | Common: "acld"         |
| `ii`       | `ll`        | Common: "vaniiia"      |
| `°` missing| `°`         | Temperatures: "350 F"  |

These substitutions are applied **only** when the surrounding context suggests a recipe term (ingredient names, temperatures, measurements). A dictionary of common recipe terms aids disambiguation.

### Section Detection Confidence

Each parsed section carries a confidence indicator:

| Confidence | Meaning                                                      |
|------------|--------------------------------------------------------------|
| `high`     | Section header found explicitly (e.g., "Ingredients:")       |
| `medium`   | Section inferred from content patterns (e.g., list of quantities) |
| `low`      | Section guessed from position or fallback heuristics         |

### Parse Output

```typescript
interface OcrParseResult {
  title: string | null;
  ingredients: string[];        // Raw ingredient lines
  instructions: string[];       // Raw instruction steps
  servings: string | null;      // Raw servings string (e.g., "Serves 4")
  prepTime: string | null;      // Raw prep time string (e.g., "15 minutes")
  cookTime: string | null;      // Raw cook time string (e.g., "30 minutes")
  rawText: string;              // Full cleaned OCR text for user reference
  ocrConfidence: number;        // Overall OCR confidence (0-100)
  sectionConfidence: Record<string, "high" | "medium" | "low">;
}
```

---

## Stage 4: Normalize

The normalizer transforms the parsed OCR output into a draft `Recipe` object conforming to `specs/recipe-data-model.md`. This stage mirrors the normalizer from `specs/recipe-import.md` with OCR-specific adjustments.

### Normalization Steps

1. **Generate metadata** — Create `id` (ULID), `slug` (from title or "untitled-ocr-recipe"), `createdAt`, `updatedAt`.
2. **Set source** — `source.type = "ocr"`, `source.ocrConfidence = <confidence score>`.
3. **Build frontmatter** — Map parsed fields to frontmatter. Apply duration parsing from `specs/recipe-import.md` for time fields. Apply yield parsing for servings.
4. **Build Markdown body** — Assemble `## Ingredients` (one list item per ingredient line), `## Instructions` (one numbered item per step), and optionally `## Notes`.
5. **Infer tags** — Minimal tag inference in v1: scan title and ingredients for dietary keywords (vegan, gluten-free, etc.). OCR recipes get fewer auto-tags than imported recipes since there's less structured metadata.
6. **Validate** — Run through validation from `specs/recipe-data-model.md`. Collect validation errors as review warnings.

### Draft Shape

```typescript
interface OcrDraft {
  recipe: Partial<Recipe>;
  rawText: string;                    // Full OCR text for user reference
  ocrConfidence: number;              // Overall OCR confidence
  sectionConfidence: Record<string, "high" | "medium" | "low">;
  warnings: OcrWarning[];
  attestation: null;                  // Must be filled before save
}

interface OcrWarning {
  field: string;
  code: string;
  message: string;
}
```

### Warning Codes

| Code                          | Meaning                                             |
|-------------------------------|-----------------------------------------------------|
| `OCR_MISSING_TITLE`           | No title could be identified. User must provide one.|
| `OCR_MISSING_INGREDIENTS`     | No ingredients section found. User must add them.   |
| `OCR_MISSING_INSTRUCTIONS`    | No instructions section found. User must add them.  |
| `OCR_LOW_SECTION_CONFIDENCE`  | A section was parsed with low confidence.            |
| `OCR_SUBSTITUTIONS_APPLIED`   | OCR text corrections were applied. User should verify. |
| `OCR_UNPARSEABLE_TIME`        | A time value could not be parsed.                   |
| `OCR_UNPARSEABLE_YIELD`       | A yield/servings value could not be parsed.         |

---

## Rights Attestation

Recipes captured from physical sources (cookbooks, magazines) are often copyrighted. The app requires users to attest that they have the right to digitize the content before the recipe is saved.

### Attestation Flow

1. The OCR pipeline returns a draft to the client (no attestation yet).
2. The client displays the draft for review, along with the rights attestation prompt.
3. The user must check the attestation checkbox before submitting.
4. The client sends the final recipe to `POST /api/v1/recipes` with the `attestation` field populated.

### Attestation Data

```typescript
interface RightsAttestation {
  attested: true;
  attestedAt: string;            // ISO 8601 timestamp (set by client)
  attestationType: "personal_use" | "public_domain" | "own_recipe" | "permission_granted";
}
```

### Attestation Types

| Type                | Description                                                          |
|---------------------|----------------------------------------------------------------------|
| `personal_use`     | User is digitizing for personal/household use (fair use).            |
| `public_domain`    | The recipe is in the public domain.                                  |
| `own_recipe`       | The user is the author of the recipe.                                |
| `permission_granted`| The user has explicit permission from the copyright holder.         |

### Enforcement

- The `POST /api/v1/recipes` endpoint accepts an optional `attestation` field.
- When `source.type` is `"ocr"`, the `attestation` field is **required**. Requests without it return `400` with error code `OCR_ATTESTATION_REQUIRED`.
- The attestation is stored as part of the recipe's source metadata for audit purposes.
- The attestation is a **user declaration** — the app does not verify the claim. The goal is to inform users of their responsibility and create an audit trail.

---

## API Endpoint

### POST /api/v1/recipes/ocr

Initiates the OCR pipeline. Requires authentication. Accepts `multipart/form-data`.

**Request:**

```
POST /api/v1/recipes/ocr
Content-Type: multipart/form-data

Fields:
  image: <binary image file>
  language: "eng"               (optional, default: "eng")
```

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "recipe": { ... },
    "rawText": "Crispy Chickpea Bowl\n\nIngredients:\n- 2 cans chickpeas...",
    "ocrConfidence": 87,
    "sectionConfidence": {
      "title": "high",
      "ingredients": "high",
      "instructions": "medium"
    },
    "warnings": [
      {
        "field": "instructions",
        "code": "OCR_LOW_SECTION_CONFIDENCE",
        "message": "Instructions section was inferred from content patterns. Please verify."
      },
      {
        "field": "text",
        "code": "OCR_SUBSTITUTIONS_APPLIED",
        "message": "Some OCR corrections were applied. Please review the text for accuracy."
      }
    ],
    "attestation": null
  },
  "requestId": "01J5K..."
}
```

The response returns a **draft** — it does not save the recipe. The client presents the draft for user review, collects the rights attestation, and the user submits the final version via `POST /api/v1/recipes` with `source.type: "ocr"` and the `attestation` field.

**Error Response (422):**

```json
{
  "ok": false,
  "error": {
    "code": "OCR_NO_TEXT",
    "message": "Could not extract any text from the uploaded image. Please try a clearer photo.",
    "details": {
      "ocrConfidence": 12
    }
  },
  "requestId": "01J5K..."
}
```

### Error Codes

| Code                          | Status | Description                                       |
|-------------------------------|--------|---------------------------------------------------|
| `OCR_NO_IMAGE`                | `400`  | No image file was included in the request.        |
| `OCR_UNSUPPORTED_FORMAT`      | `400`  | Image format is not supported.                    |
| `OCR_IMAGE_TOO_LARGE`         | `400`  | Image file exceeds 10 MB.                         |
| `OCR_IMAGE_TOO_SMALL`         | `400`  | Image dimensions below 200x200 pixels.            |
| `OCR_IMAGE_DIMENSIONS`        | `400`  | Image dimensions exceed 8000x8000 pixels.         |
| `OCR_IMAGE_CORRUPT`           | `422`  | Image file is corrupt or unreadable.              |
| `OCR_ENGINE_ERROR`            | `500`  | OCR engine failed to initialize.                  |
| `OCR_TIMEOUT`                 | `422`  | OCR processing exceeded 60-second limit.          |
| `OCR_NO_TEXT`                 | `422`  | No text was recognized in the image.              |
| `OCR_LOW_CONFIDENCE`          | `422`  | OCR confidence too low for reliable extraction.   |
| `OCR_ATTESTATION_REQUIRED`    | `400`  | Recipe save attempted without rights attestation. |

---

## Implementation Location

Following the project structure from `specs/backend-architecture.md`:

```
src/lib/server/services/
  ocr-service.ts               # Pipeline orchestrator
src/lib/server/ocr/
  image-validator.ts           # Format, size, dimension checks
  image-preprocessor.ts        # Auto-orient, grayscale, resize
  ocr-engine.ts                # Tesseract.js wrapper and config
  text-cleaner.ts              # Raw OCR text cleanup and substitutions
  recipe-parser.ts             # Text → structured recipe components
  normalizer.ts                # Parsed components → Recipe draft
src/lib/models/
  ocr-types.ts                 # OcrDraft, OcrWarning, RightsAttestation types
src/routes/api/v1/recipes/
  ocr/
    +server.ts                 # POST /api/v1/recipes/ocr
```

---

## Security Considerations

- **File upload validation** — Verify magic bytes, not just Content-Type headers. Reject files that don't match expected image signatures.
- **Image processing limits** — Dimension and file size caps prevent memory exhaustion during preprocessing and OCR.
- **No persistent image storage** — Images are processed in memory and discarded after OCR completes. No image data is stored in the database or on disk.
- **No automatic save** — OCR results are always presented as drafts for user review. This prevents garbled OCR text from being saved as-is.
- **Rights attestation** — The attestation flow ensures users acknowledge copyright considerations before saving OCR-sourced recipes.
- **Rate limiting** — OCR requests should be rate-limited per user (e.g., 5 per minute) due to high computational cost.
- **Multipart parsing** — Use a battle-tested multipart parser. Limit total request size to 12 MB to account for multipart overhead.

---

## Performance Considerations

- **Processing timeout** — 60-second cap prevents runaway OCR on complex images.
- **Image preprocessing** — Resizing large images before OCR significantly reduces processing time without meaningful accuracy loss.
- **Worker pool** — Tesseract.js uses Web Workers. Start with a single worker pool in v1; monitor processing times and scale if needed.
- **Lazy initialization** — Initialize the Tesseract worker on first OCR request rather than at server startup, since not all users will use OCR.
- **Language pack loading** — Language data files are loaded on demand. Cache loaded language packs in memory to avoid re-downloading on subsequent requests.

---

## Limitations

- **Handwritten text** — Tesseract.js has limited accuracy on handwritten recipes. Results will vary significantly based on handwriting legibility. This is an inherent limitation of the engine.
- **Complex layouts** — Multi-column recipes, recipes with images interspersed, or decorative fonts may produce poor results. Users should crop the image to focus on text.
- **English-only parsing** — While OCR supports 100+ languages for text recognition, the recipe section parser (identifying ingredients vs. instructions) is English-only in v1. Non-English text will be recognized but may not be correctly segmented.
- **No table recognition** — Ingredient tables or nutritional information in tabular format will be extracted as text but not structured. This may be added in a future version.
- **Single image per request** — v1 supports one image per OCR request. Multi-page recipes (e.g., a recipe spanning two pages) require multiple uploads and manual merging.
