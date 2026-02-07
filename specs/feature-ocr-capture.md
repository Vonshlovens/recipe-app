# Feature: OCR Recipe Capture

> Full feature spec for OCR recipe capture: image requirements, attestation copy, accuracy expectations, edit flow.

---

## Overview

OCR recipe capture allows users to digitize recipes from physical sources — cookbooks, magazine clippings, handwritten cards — by uploading or photographing the recipe page. The system extracts text via OCR, parses it into structured recipe components, and presents a draft for the user to review and edit. Before saving, the user must complete a rights attestation confirming they have the right to digitize the content.

This spec builds on:
- [ocr-pipeline.md](./ocr-pipeline.md) — server-side OCR processing, image validation, text parsing, normalization
- [ocr-flow.md](./ocr-flow.md) — frontend UI for image upload, OCR progress, review, attestation modal
- [recipe-data-model.md](./recipe-data-model.md) — canonical recipe schema the draft must conform to
- [api-routes.md](./api-routes.md) — `POST /api/v1/recipes/ocr` and `POST /api/v1/recipes`
- [recipe-editor.md](./recipe-editor.md) — editor components reused in the review step

---

## User Stories

### US-1: Capture a Recipe from a Photo

**As a** user with a recipe in a cookbook or on a card,
**I want to** take a photo or upload an image and have it automatically digitized,
**so that** I can save it to my collection without retyping it.

**Example:** Photographing a page from a cookbook extracts the title, ingredients, instructions, and metadata into a draft recipe.

### US-2: Review and Correct OCR Output

**As a** user capturing a recipe via OCR,
**I want to** review and correct the extracted text before saving,
**so that** I can fix any OCR misreadings and ensure the recipe is accurate.

### US-3: See OCR Confidence Indicators

**As a** user reviewing an OCR-captured recipe,
**I want to** see which sections were extracted with low confidence,
**so that** I know which parts need careful review.

**Example:** The instructions section extracted with low confidence is highlighted in amber with a tooltip: "This section was extracted with low confidence. Please verify."

### US-4: Reference Raw OCR Text

**As a** user correcting OCR output,
**I want to** see the raw text that was extracted from the image,
**so that** I can compare it against the parsed fields and fix parsing errors.

### US-5: Attest Rights Before Saving

**As a** user saving an OCR-captured recipe,
**I want to** confirm that I have the right to digitize this content,
**so that** I am informed of my copyright responsibilities.

### US-6: Handle Poor-Quality Images Gracefully

**As a** user who uploaded a blurry or low-quality photo,
**I want to** see a clear error explaining what went wrong and tips for a better result,
**so that** I can retry with a better image.

### US-7: Cancel an In-Progress OCR

**As a** user who uploaded the wrong image,
**I want to** cancel the OCR processing while it's running,
**so that** I don't have to wait for it to finish.

### US-8: Discard an OCR Draft

**As a** user reviewing an OCR-captured recipe,
**I want to** discard the draft and start over with a new image,
**so that** I can retry if the result is too far off.

### US-9: Select OCR Language

**As a** user capturing a recipe in a non-English language,
**I want to** select the language before OCR processing,
**so that** the engine produces more accurate results for that language.

---

## Acceptance Criteria

### Image Upload & Validation

| # | Criterion |
|---|-----------|
| AC-1 | Upload area supports file picker, camera capture (mobile), and drag-and-drop. |
| AC-2 | Accepted formats: JPEG, PNG, WebP, HEIC. Max file size: 10 MB. |
| AC-3 | Client-side validation rejects missing files, unsupported formats, and files exceeding 10 MB. |
| AC-4 | Validation errors appear inline below the upload area. |
| AC-5 | After selecting an image, a thumbnail preview is shown with file name, size, and a "Remove" button. |
| AC-6 | A "Start OCR" button is shown after image selection; it is disabled until a valid image is selected. |
| AC-7 | Camera capture uses the rear camera by default via `capture="environment"`. |
| AC-8 | On mobile, camera capture button is promoted above the file picker. |
| AC-9 | Drag-and-drop is hidden on mobile viewports. |

### Language Selection

| # | Criterion |
|---|-----------|
| AC-10 | An optional language dropdown is shown below the image preview, defaulting to "English". |
| AC-11 | Supported languages: English, French, German, Spanish, Italian, Japanese. |
| AC-12 | A secondary language can be selected for bilingual recipes (e.g., `eng+fra`). |

### OCR Processing

| # | Criterion |
|---|-----------|
| AC-13 | Submitting triggers `POST /api/v1/recipes/ocr` with the image and language as `multipart/form-data`. |
| AC-14 | A spinner and "Processing image..." message are shown during OCR. |
| AC-15 | A Cancel button is available that aborts the in-flight request via `AbortController`. |
| AC-16 | If the request exceeds 10 seconds, a reassurance message appears: "This can take up to a minute for large or detailed images." |
| AC-17 | The upload area and buttons are disabled during processing. |
| AC-18 | Server-side pipeline: image validation, preprocessing (auto-orient, grayscale, resize), OCR via Tesseract.js, text parsing, normalization. |
| AC-19 | OCR processing timeout is 60 seconds server-side. |
| AC-20 | Images with OCR confidence below 30 are rejected with `OCR_LOW_CONFIDENCE`. |

### Review & Edit

| # | Criterion |
|---|-----------|
| AC-21 | On successful extraction, the draft is displayed in the `RecipeEditor` component with all extracted fields pre-populated. |
| AC-22 | An OCR confidence banner shows the overall score with color coding: green (>=75), amber (30-74), red (<30). |
| AC-23 | A collapsible "View raw OCR text" panel shows the full extracted text for reference. |
| AC-24 | Fields with `low` section confidence have an amber warning border and tooltip. |
| AC-25 | OCR warnings (missing fields, substitutions applied, unparseable values) are shown in a collapsible alert section above the form. |
| AC-26 | `source.type` is set to `"ocr"` and is read-only. |
| AC-27 | The user can edit any other field before saving. |

### Rights Attestation

| # | Criterion |
|---|-----------|
| AC-28 | Clicking Save opens a rights attestation modal before the recipe is submitted. |
| AC-29 | The modal presents four attestation types as radio buttons: personal/household use, public domain, own recipe, permission granted. |
| AC-30 | The "Save Recipe" button in the modal is disabled until an attestation type is selected. |
| AC-31 | On confirmation, `attestation.attested` is set to `true`, `attestation.attestedAt` to the current ISO 8601 timestamp, and `attestation.attestationType` to the selected value. |
| AC-32 | The recipe is submitted to `POST /api/v1/recipes` with `source.type: "ocr"` and the `attestation` field. |
| AC-33 | If the server returns `OCR_ATTESTATION_REQUIRED`, an error toast is shown (should not happen if client enforces). |

### Save Flow

| # | Criterion |
|---|-----------|
| AC-34 | On save success, a "Recipe captured!" toast is shown and the user is redirected to `/recipes/{slug}`. |
| AC-35 | On validation error, the modal closes and inline errors are displayed in the editor. |
| AC-36 | On network error, an error toast with a retry option is shown. The draft is preserved in component state. |

### Discard & Navigation

| # | Criterion |
|---|-----------|
| AC-37 | A "Discard" button returns to the image upload step. |
| AC-38 | If the user has edited the draft, clicking Discard shows a confirmation dialog: "Discard captured recipe? Your edits will be lost." |
| AC-39 | Confirming discard clears the draft and returns to the upload step with the image cleared. |

### Error States

| # | Criterion |
|---|-----------|
| AC-40 | Each OCR error code maps to a user-friendly message (see error message table below). |
| AC-41 | All error states include a "Try Another Image" button that returns to the upload step. |
| AC-42 | All error states include a "Create Manually" button that navigates to `/recipes/new`. |
| AC-43 | Error states use `role="alert"` for screen reader announcement. |

---

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| EC-1 | Image is a photo of a blank page | OCR returns `OCR_NO_TEXT`. Error state shown with "Try Another Image" and "Create Manually" options. |
| EC-2 | Image contains handwritten text | OCR attempts extraction. Results will vary; low confidence is likely. Confidence banner warns user to review carefully. |
| EC-3 | Image contains multiple recipes on one page | OCR extracts all visible text. Parser identifies the first recipe-like structure. User can edit to isolate the desired recipe. |
| EC-4 | Image is rotated or upside down | Server-side preprocessing applies EXIF auto-orient. If no EXIF data, Tesseract's page segmentation handles moderate rotation. Severely rotated images may produce poor results. |
| EC-5 | Image has decorative or unusual fonts | OCR accuracy degrades. Low confidence score likely. User is informed via the confidence banner and may need to manually correct more fields. |
| EC-6 | Recipe spans multiple pages | v1 supports single-image upload only. User must upload one page at a time and manually merge. |
| EC-7 | Image contains a recipe inside a larger page (e.g., a full magazine spread) | OCR extracts all text. Parser uses heuristics to find recipe sections. Tip text advises: "Crop the image to just the recipe text for best results." |
| EC-8 | HEIC image from iPhone | Server converts HEIC to PNG during preprocessing. Transparent to the user. |
| EC-9 | User cancels OCR, then immediately submits again | Previous request is aborted via `AbortController`. New request starts cleanly. |
| EC-10 | OCR extracts text but parser cannot identify ingredients or instructions | `OCR_MISSING_INGREDIENTS` / `OCR_MISSING_INSTRUCTIONS` warnings are shown. Corresponding editor sections are empty. User must fill them in manually. |
| EC-11 | User selects wrong OCR language | Results will have poor accuracy. User can discard, change language, and retry. |
| EC-12 | Network error during OCR upload | Error toast shown. Upload step is re-enabled so the user can retry. |
| EC-13 | Image file is corrupt | Server returns `OCR_IMAGE_CORRUPT`. Error state shown with suggestion to try a different image. |
| EC-14 | Very large image near 10 MB limit | Upload succeeds. Server preprocesses (resize) before OCR. May take longer; reassurance message shown after 10 seconds. |

---

## Image Requirements

### For Best Results

Users are advised (via tip text on the upload page) to:

- **Crop tightly** — Include only the recipe text, not full page spreads or surrounding content.
- **Use good lighting** — Avoid shadows, glare, and uneven lighting across the page.
- **Hold steady** — Blurry images significantly reduce OCR accuracy.
- **Use printed text** — Printed/typed text produces much better results than handwriting.
- **Flatten the page** — Curved cookbook pages produce distorted text.

### Technical Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Accepted formats | JPEG, PNG, WebP, HEIC | Common camera/screenshot formats |
| Max file size | 10 MB | Prevents upload abuse, covers high-res phone photos |
| Min dimensions | 200x200 px | Below this, text is unreadable |
| Max dimensions | 8000x8000 px | Prevents memory exhaustion during processing |
| Server resize threshold | Longest edge > 4000 px | Balances accuracy with processing speed |

---

## Accuracy Expectations

OCR accuracy varies significantly by source material. Users should understand these expectations:

| Source Type | Expected Accuracy | Notes |
|-------------|-------------------|-------|
| Printed cookbook (clean photo) | 85-95% | Best case. Clear fonts, structured layout. |
| Magazine clipping | 75-90% | Good, but glossy paper may cause glare. |
| Printed recipe card | 80-92% | Usually clean, simple layout. |
| Handwritten recipe | 30-70% | Highly variable. Depends on legibility. |
| Screenshot of a recipe | 90-98% | Near-perfect since text is already digital. |
| Photo of a screen | 70-85% | Moiré patterns and glare reduce accuracy. |

The confidence banner in the review step helps set expectations:
- **High (>=75):** "Most text was read accurately. Spot-check for minor errors."
- **Medium (30-74):** "Several corrections may be needed. Please review all fields carefully."
- **Low (<30):** Rejected by the pipeline. User is asked to try a clearer photo.

---

## Attestation Copy

### Modal Header

> **Rights Attestation**

### Modal Body

> Recipes from cookbooks, magazines, and other published sources may be protected by copyright. Please confirm your right to digitize this recipe.

### Attestation Options

| Option | Label | Description |
|--------|-------|-------------|
| `personal_use` | "This is for personal/household use" | The user is digitizing a recipe they own a physical copy of, for personal reference. |
| `public_domain` | "This recipe is in the public domain" | The recipe is not under copyright (e.g., very old recipes, government publications). |
| `own_recipe` | "I am the author of this recipe" | The user wrote the recipe themselves and is digitizing their own handwritten/printed version. |
| `permission_granted` | "I have permission from the copyright holder" | The user has explicit permission to digitize and store the recipe. |

### Legal Disclaimer (below attestation options)

> This attestation is a personal declaration. The app does not verify copyright status. You are responsible for ensuring you have the right to digitize this content.

---

## Error Messages

| Error Code | User-Facing Message |
|------------|---------------------|
| `OCR_NO_IMAGE` | "No image was provided. Please select or capture a photo." |
| `OCR_UNSUPPORTED_FORMAT` | "That image format isn't supported. Please use JPEG, PNG, WebP, or HEIC." |
| `OCR_IMAGE_TOO_LARGE` | "That image is too large (max 10 MB). Please use a smaller image." |
| `OCR_IMAGE_TOO_SMALL` | "That image is too small. Please use a higher resolution photo." |
| `OCR_IMAGE_DIMENSIONS` | "That image's dimensions are too large to process. Please resize it." |
| `OCR_IMAGE_CORRUPT` | "That image file appears to be corrupt. Please try a different image." |
| `OCR_ENGINE_ERROR` | "Something went wrong on our end. Please try again later." |
| `OCR_TIMEOUT` | "The image took too long to process. Try a simpler or smaller image." |
| `OCR_NO_TEXT` | "No text could be found in the image. Make sure the photo clearly shows recipe text." |
| `OCR_LOW_CONFIDENCE` | "The text in this image is too unclear to read reliably. Try a clearer photo." |

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Image upload (client to server) | Depends on connection; no client-side resize in v1 |
| OCR pipeline end-to-end (validate + preprocess + OCR + parse + normalize) | < 60s (bounded by OCR timeout) |
| OCR processing (Tesseract.js) | < 30s for typical cookbook photos |
| Parse + normalize (after OCR completes) | < 200ms |
| Review page render (editor with pre-populated data) | < 200ms |
| Save (create endpoint with attestation) | < 300ms |

---

## Security Requirements

- SSRF is not applicable (user uploads image data, no URL fetching).
- File upload validation checks magic bytes, not just Content-Type headers.
- Image dimension and file size caps prevent memory exhaustion.
- No persistent image storage — images are processed in memory and discarded after OCR.
- No automatic save — all OCR results go through user review and attestation.
- Rate limiting: 5 OCR requests per user per minute (OCR is computationally expensive).
- Multipart request size capped at 12 MB to account for overhead.

---

## Accessibility Requirements

- Upload area has a visible label: "Upload recipe image".
- File input is keyboard-focusable and labeled with accepted formats.
- Drag-and-drop zone announces state changes via `aria-live="polite"`.
- Processing state announces "Processing image" via `aria-live="polite"`.
- Error states use `role="alert"` for immediate screen reader announcement.
- Confidence indicators use `aria-describedby` to link warning tooltips to fields.
- Attestation modal traps focus and is dismissible with Escape.
- Radio buttons in attestation modal are grouped with `role="radiogroup"` and labeled "Rights attestation type".
- Image preview has `alt` text: "Selected recipe image".

---

## Out of Scope

- Batch OCR (uploading multiple images at once for a single recipe).
- Multi-page recipe stitching (automatic merging of images from consecutive pages).
- Client-side image preprocessing (resize, crop, rotate before upload).
- Real-time camera viewfinder with text detection overlay.
- NSFW or content moderation on uploaded images.
- Non-English recipe section parsing (OCR supports many languages, but the section parser is English-only in v1).
- Table recognition for nutritional information or ingredient tables.
- Automatic copyright detection or recipe source identification.
