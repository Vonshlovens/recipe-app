# OCR Flow

> Image upload UI, camera capture option, OCR progress, rights attestation modal, review and edit before save.

---

## Overview

The OCR flow provides the user-facing interface for capturing recipes from physical sources (cookbooks, magazines, handwritten cards) by uploading or photographing a page. The user provides an image, the system runs OCR via the server-side pipeline (defined in [ocr-pipeline.md](./ocr-pipeline.md)), and presents the extracted draft for review and editing. Before saving, the user must complete a rights attestation confirming they have the right to digitize the content.

This spec builds on:
- [ocr-pipeline.md](./ocr-pipeline.md) — server-side OCR processing, `POST /api/v1/recipes/ocr`
- [api-routes.md](./api-routes.md) — `POST /api/v1/recipes` (standard create endpoint for saving the reviewed draft)
- [recipe-editor.md](./recipe-editor.md) — editor components reused in the review step
- [ui-components.md](./ui-components.md) — shared UI components
- [frontend-architecture.md](./frontend-architecture.md) — routing, layout, state management

---

## Route

| Route          | Purpose                                  | Auth Required |
|----------------|------------------------------------------|---------------|
| `/recipes/ocr` | Capture a recipe from an image via OCR   | Yes           |

---

## User Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Image    │────▶│  2. OCR      │────▶│  3. Review   │────▶│  4. Attest   │────▶│  5. Saved    │
│  Upload      │     │  Processing  │     │  & Edit      │     │  Rights      │     │  Redirect    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
  Validation           OCR errors           User edits          Attestation
  errors                                    draft recipe        required
```

### Step 1: Image Upload

The user provides an image of a recipe via file upload or camera capture.

#### Upload Methods

- **File picker** — Standard file input accepting `image/jpeg`, `image/png`, `image/webp`, `image/heic`. Labeled "Choose Image" with a file-type icon.
- **Camera capture** — On devices that support it (`navigator.mediaDevices`), show a "Take Photo" button that opens the device camera via `<input type="file" accept="image/*" capture="environment">`. This uses the rear camera by default.
- **Drag and drop** — The upload area accepts drag-and-drop. Show a dashed border drop zone with visual feedback on dragover.

#### Upload Area Layout

```
┌────────────────────────────────────────────────┐
│                                                │
│        📷  Capture a Recipe                    │
│                                                │
│   Upload a photo of a recipe from a cookbook,   │
│   magazine, or handwritten card.               │
│                                                │
│   ┌──────────────────────────────────────────┐ │
│   │                                          │ │
│   │     Drag and drop an image here          │ │
│   │     or                                   │ │
│   │     [ Choose Image ]  [ Take Photo ]     │ │
│   │                                          │ │
│   │     JPEG, PNG, WebP, or HEIC — up to     │ │
│   │     10 MB                                │ │
│   │                                          │ │
│   └──────────────────────────────────────────┘ │
│                                                │
│   💡 Tip: Crop the image to just the recipe    │
│   text for best results.                       │
│                                                │
└────────────────────────────────────────────────┘
```

#### Client-Side Validation

Before uploading to the server:

- File must be present (non-empty)
- File type must be `image/jpeg`, `image/png`, `image/webp`, or `image/heic`
- File size must not exceed 10 MB
- Validation errors appear inline below the upload area

#### Image Preview

After selecting an image (and before submitting):

- Show a thumbnail preview of the selected image (max 300px wide)
- Display the file name and size
- Provide a "Remove" button to clear the selection and pick a different image
- Show a "Start OCR" button to begin processing

#### Language Selection

- An optional dropdown below the image preview allows selecting the OCR language
- Default: "English"
- Options correspond to Tesseract language codes: English (`eng`), French (`fra`), German (`deu`), Spanish (`spa`), Italian (`ita`), Japanese (`jpn`)
- For bilingual recipes, allow selecting a secondary language (e.g., `eng+fra`)

### Step 2: OCR Processing

After submission, show a progress state while the server processes the image.

```
┌────────────────────────────────────────────────┐
│                                                │
│         ◠  Processing image...                 │
│                                                │
│    Extracting text from your photo             │
│    ████████████░░░░░░░░░░░░░░  45%             │
│                                                │
│    This can take up to a minute for            │
│    large or detailed images.                   │
│                                                │
│              [ Cancel ]                        │
│                                                │
└────────────────────────────────────────────────┘
```

- Show a spinner with status message: "Processing image..."
- Show an indeterminate progress bar (the pipeline is a single request)
- Provide a Cancel button that aborts the request via `AbortController`
- If the request takes longer than 10 seconds, show a reassurance message: "This can take up to a minute for large or detailed images."
- Display the selected image as a small thumbnail alongside the progress for visual context
- Disable the upload area and buttons during processing

### Step 3: Review & Edit

On success, the extracted draft is presented in an editor form for the user to review and modify. This reuses the `RecipeEditor` component from [recipe-editor.md](./recipe-editor.md) with OCR-specific additions.

#### OCR-Specific Additions

- **OCR confidence banner** — A banner at the top showing the overall OCR confidence: "OCR confidence: 87% — High" (green), "OCR confidence: 55% — Medium" (amber), "OCR confidence: 32% — Low" (red). Include guidance: "Lower confidence means more corrections may be needed."
- **Raw text panel** — A collapsible panel showing the full raw OCR text for reference. Useful when the user needs to see what the OCR actually read to correct parsing errors. Labeled "View raw OCR text".
- **Confidence indicators** — Fields extracted with `low` section confidence are highlighted with an amber warning border and tooltip: "This section was extracted with low confidence. Please verify."
- **Warnings list** — If the OCR draft contains warnings, display them in a collapsible alert section above the form:
  - `OCR_MISSING_TITLE` — "No title could be identified. Please add one."
  - `OCR_MISSING_INGREDIENTS` — "No ingredients section was found. Please add them."
  - `OCR_MISSING_INSTRUCTIONS` — "No instructions section was found. Please add them."
  - `OCR_LOW_SECTION_CONFIDENCE` — "Some sections were extracted with low confidence and may need correction."
  - `OCR_SUBSTITUTIONS_APPLIED` — "Some OCR text corrections were applied. Please review for accuracy."
  - `OCR_UNPARSEABLE_TIME` — "Cook/prep time could not be parsed and was left blank."
  - `OCR_UNPARSEABLE_YIELD` — "Servings could not be determined. Defaulting to 4."

#### Pre-Populated Fields

All extracted fields are pre-filled in the editor form. The user can modify any field before saving.

- `source.type` is set to `"ocr"` (read-only, not user-editable)

### Step 4: Rights Attestation

Before saving, the user must complete the rights attestation. This is presented as a modal dialog triggered by the Save button.

#### Attestation Modal

```
┌────────────────────────────────────────────────┐
│                                                │
│   ⚖️  Rights Attestation                       │
│                                                │
│   Recipes from cookbooks, magazines, and       │
│   other published sources may be protected     │
│   by copyright. Please confirm your right      │
│   to digitize this recipe.                     │
│                                                │
│   I confirm that:                              │
│                                                │
│   ○ This is for personal/household use         │
│   ○ This recipe is in the public domain        │
│   ○ I am the author of this recipe             │
│   ○ I have permission from the copyright       │
│     holder                                     │
│                                                │
│   [ Cancel ]              [ Save Recipe ]      │
│                                                │
└────────────────────────────────────────────────┘
```

- The modal appears when the user clicks Save in the review step
- The user must select exactly one attestation type (radio buttons)
- The "Save Recipe" button is disabled until an attestation type is selected
- On confirmation, the client sets `attestation.attested = true`, `attestation.attestedAt` to the current ISO 8601 timestamp, and `attestation.attestationType` to the selected value
- The recipe is then submitted to `POST /api/v1/recipes` with the attestation data

#### Save Flow

- The Save button opens the attestation modal
- After attestation, the recipe is submitted to `POST /api/v1/recipes` with `source.type: "ocr"` and the `attestation` field
- On success: show a success toast "Recipe captured!" and redirect to `/recipes/{slug}`
- On validation error: close the modal, display inline errors in the editor
- On `OCR_ATTESTATION_REQUIRED`: should not happen (client enforces), but show an error toast if it does
- On network error: show an error toast with retry option

#### Discard Flow

- A "Discard" button allows the user to abandon the capture and return to the image upload step
- If the user has made edits, show a `ConfirmDialog`: "Discard captured recipe? Your edits will be lost."

### Step 5: Error States

#### OCR Processing Errors

When the OCR pipeline fails, show an error state in place of the review form:

```
┌────────────────────────────────────────────────┐
│                                                │
│    ⚠  Could not read recipe                    │
│                                                │
│    We couldn't extract text from your           │
│    image. This can happen with blurry photos,  │
│    handwritten text, or decorative fonts.      │
│                                                │
│    [ Try Another Image ]  [ Create Manually ]  │
│                                                │
└────────────────────────────────────────────────┘
```

Error messages by code:

| Error Code                 | User-Facing Message                                                              |
|----------------------------|----------------------------------------------------------------------------------|
| `OCR_NO_IMAGE`             | "No image was provided. Please select or capture a photo."                       |
| `OCR_UNSUPPORTED_FORMAT`   | "That image format isn't supported. Please use JPEG, PNG, WebP, or HEIC."        |
| `OCR_IMAGE_TOO_LARGE`      | "That image is too large (max 10 MB). Please use a smaller image."               |
| `OCR_IMAGE_TOO_SMALL`      | "That image is too small. Please use a higher resolution photo."                 |
| `OCR_IMAGE_DIMENSIONS`     | "That image's dimensions are too large to process. Please resize it."            |
| `OCR_IMAGE_CORRUPT`        | "That image file appears to be corrupt. Please try a different image."           |
| `OCR_ENGINE_ERROR`         | "Something went wrong on our end. Please try again later."                       |
| `OCR_TIMEOUT`              | "The image took too long to process. Try a simpler or smaller image."            |
| `OCR_NO_TEXT`              | "No text could be found in the image. Make sure the photo clearly shows recipe text." |
| `OCR_LOW_CONFIDENCE`       | "The text in this image is too unclear to read reliably. Try a clearer photo."   |

All error states include:
- "Try Another Image" button — returns to Step 1 with the upload area cleared
- "Create Manually" button — navigates to `/recipes/new`

---

## Page Layout

### Desktop (>= 1024px)

**Step 1 — Image Upload:**

Centered card layout, max-width 640px. The upload area is the primary focus.

**Step 3 — Review & Edit:**

Uses the full-width RecipeEditor layout from [recipe-editor.md](./recipe-editor.md) with the OCR confidence banner and raw text panel added. The raw text panel appears in a collapsible section above the editor.

### Tablet (768px – 1023px)

- Upload area spans full width with reduced padding
- Camera button is full width alongside file picker
- Review step uses the tablet RecipeEditor layout

### Mobile (< 768px)

- Upload buttons stack vertically (full width each)
- Camera capture button is promoted above file picker (more natural on mobile)
- Drag and drop is hidden (not practical on mobile)
- Review step uses the mobile RecipeEditor layout (single column, tab-based preview)
- Attestation modal is full-screen on mobile

---

## State Management

The OCR flow uses local component state (runes) rather than a global store:

```typescript
type OcrStep = "upload" | "processing" | "review" | "error";

let step: OcrStep = $state("upload");
let imageFile: File | null = $state(null);
let imagePreviewUrl: string | null = $state(null);
let language: string = $state("eng");
let draft: OcrDraft | null = $state(null);
let error: OcrError | null = $state(null);
let abortController: AbortController | null = $state(null);
let showAttestation: boolean = $state(false);
let attestationType: string | null = $state(null);
```

- `step` drives which UI is rendered
- `imageFile` holds the selected image for upload
- `imagePreviewUrl` is a `URL.createObjectURL()` reference for the preview thumbnail (revoked on cleanup)
- `language` is the selected OCR language
- `draft` holds the extracted recipe data during review
- `error` holds error details for display
- `abortController` enables cancellation during processing
- `showAttestation` controls the attestation modal visibility
- `attestationType` tracks the user's attestation selection

---

## Implementation Location

```
src/routes/recipes/ocr/
  +page.server.ts              # Auth guard (redirect to /auth/login if not authenticated)
  +page.svelte                 # OCR flow page (upload, processing, review, error)
src/lib/components/ocr/
  ImageUpload.svelte           # Image upload area with file picker, camera, drag-and-drop
  ImagePreview.svelte          # Selected image thumbnail with remove button
  LanguageSelect.svelte        # OCR language dropdown
  OcrProgress.svelte           # Processing spinner with cancel
  OcrReview.svelte             # Wraps RecipeEditor with OCR-specific additions
  OcrConfidenceBanner.svelte   # Overall OCR confidence display
  RawTextPanel.svelte          # Collapsible raw OCR text viewer
  OcrError.svelte              # Error state with retry/manual-create actions
  AttestationModal.svelte      # Rights attestation dialog
  OcrWarnings.svelte           # Collapsible warnings list
  ConfidenceIndicator.svelte   # Amber warning border + tooltip for low-confidence sections
```

---

## Accessibility

- Upload area has a visible label: "Upload recipe image"
- File input is keyboard-focusable and labeled with accepted formats
- Drag-and-drop zone announces state changes ("File ready to drop", "File dropped") via `aria-live="polite"`
- Processing state announces "Processing image" to screen readers via `aria-live="polite"`
- Error states use `role="alert"` for immediate screen reader announcement
- Confidence indicators use `aria-describedby` to link the warning tooltip to the field
- Attestation modal traps focus and is dismissible with Escape
- Radio buttons in the attestation modal are grouped with `role="radiogroup"` and labeled "Rights attestation type"
- All interactive elements follow the keyboard patterns from [ui-components.md](./ui-components.md)
- Image preview has `alt` text: "Selected recipe image"

---

## Performance Considerations

- The OCR API call is a single request. No polling or WebSocket is needed.
- `AbortController` ensures cancelled requests don't consume client resources.
- Image preview uses `URL.createObjectURL()` which is memory-efficient. The URL is revoked when the component unmounts or a new image is selected.
- The RecipeEditor component is code-split and only loaded when the review step is reached (dynamic `import()`).
- Client-side validation (file type, file size) happens before upload, avoiding unnecessary server round-trips.
- Large images are uploaded as-is — the server handles preprocessing. Client-side resize would add complexity without significant benefit since the server needs the full-quality image for best OCR results.
