# Feature: User Profile & Preferences

> Full feature spec for user profiles: display name, avatar, dietary preferences, default servings, and account settings.

---

## Overview

User profiles let users personalize their experience by setting a display name, avatar, dietary preferences, and cooking defaults. These preferences feed into other features — dietary tags filter search results, default servings pre-fill the recipe viewer, and the display name appears on shared collections.

This spec builds on:
- [auth.md](./auth.md) — authentication, session management, user accounts
- [recipe-data-model.md](./recipe-data-model.md) — tag taxonomy (diet tags used for preferences)
- [recommendation-engine.md](./recommendation-engine.md) — preferences as input signals
- [feature-collections.md](./feature-collections.md) — display name shown on shared collections

---

## User Stories

### US-1: Set Display Name

**As a** registered user,
**I want to** set a display name,
**so that** my name appears on shared collections and any social features.

**Example:** A user changes their display name from the default (email prefix) to "Jamie's Kitchen".

### US-2: Upload Avatar

**As a** user personalizing their profile,
**I want to** upload a profile picture,
**so that** my account feels personal and recognizable.

**Example:** A user uploads a photo that gets cropped to a circle and displayed in the nav bar.

### US-3: Set Dietary Preferences

**As a** user with dietary restrictions,
**I want to** set my dietary preferences (e.g., vegetarian, gluten-free),
**so that** search results and recommendations prioritize compatible recipes.

**Example:** A user marks "vegetarian" and "dairy-free". Search results show a "Matches your preferences" badge on compatible recipes.

### US-4: Set Default Servings

**As a** user who usually cooks for a specific number of people,
**I want to** set a default serving size,
**so that** recipes automatically scale to my household size.

**Example:** A user sets default servings to 4. When viewing any recipe, the serving scaler starts at 4 instead of the recipe's original value.

### US-5: Manage Account Settings

**As a** user managing their account,
**I want to** change my email, password, or delete my account,
**so that** I have full control over my account.

### US-6: Set Measurement Preference

**As a** user who prefers metric or imperial units,
**I want to** set my preferred measurement system,
**so that** ingredient quantities display in my preferred units.

---

## Acceptance Criteria

### Profile Information

| # | Criterion |
|---|-----------|
| AC-1 | A user can set a display name (1-50 characters, alphanumeric, spaces, hyphens, apostrophes). |
| AC-2 | Display name defaults to the portion of the email before the `@` sign on account creation. |
| AC-3 | A user can upload an avatar image (JPEG, PNG, WebP; max 2 MB; min 100x100px). |
| AC-4 | Uploaded avatars are resized to 256x256px and served in WebP format. |
| AC-5 | A default avatar is generated from the user's initials with a deterministic background color. |

### Dietary Preferences

| # | Criterion |
|---|-----------|
| AC-6 | The preferences page shows checkboxes for common diets: vegetarian, vegan, gluten-free, dairy-free, nut-free, keto, paleo, halal, kosher. |
| AC-7 | Users can select multiple dietary preferences simultaneously. |
| AC-8 | Dietary preferences are stored as an array of diet tag strings matching the recipe tag taxonomy. |
| AC-9 | When dietary preferences are set, search results show a "Matches your diet" badge on compatible recipes. |
| AC-10 | Recommendations engine uses dietary preferences as a filtering signal. |

### Cooking Defaults

| # | Criterion |
|---|-----------|
| AC-11 | A user can set default servings (1-99, integer). Default is null (use recipe's original). |
| AC-12 | A user can set measurement preference: "metric", "imperial", or "as-written" (default). |
| AC-13 | Default servings pre-fills the serving scaler on recipe viewer pages. |
| AC-14 | Measurement preference converts ingredient quantities where conversion data is available. |

### Account Settings

| # | Criterion |
|---|-----------|
| AC-15 | A user can change their email address. A verification email is sent to the new address. The change takes effect after verification. |
| AC-16 | A user can change their password. Current password is required for confirmation. |
| AC-17 | A user can delete their account. A confirmation dialog requires typing "DELETE" to proceed. |
| AC-18 | Account deletion removes all user data (profile, collections, preferences) within 30 days. Recipes created by the user are retained as anonymous. |

---

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| EC-1 | User uploads an image larger than 2 MB | Client-side validation rejects with message: "Image must be under 2 MB." |
| EC-2 | User uploads a non-image file | Rejected with message: "Please upload a JPEG, PNG, or WebP image." |
| EC-3 | User sets display name with only whitespace | Validation rejects: "Display name cannot be blank." |
| EC-4 | User clears all dietary preferences | Preferences array is set to empty. No diet filtering is applied. |
| EC-5 | User sets default servings then views a recipe | Recipe viewer scaler initializes to the user's default instead of the recipe's original. |
| EC-6 | User deletes account with active shared collections | All shared collection links immediately return 404. |
| EC-7 | User changes email to one already registered | Error: "This email is already associated with an account." |
| EC-8 | Avatar upload fails mid-upload (network error) | Error toast: "Upload failed. Please try again." Previous avatar is preserved. |
| EC-9 | User sets measurement preference but recipe has no conversion data | Quantities display as-written with no conversion attempted. |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/profile` | Get the current user's profile. |
| `PATCH` | `/api/v1/profile` | Update display name, dietary preferences, default servings, or measurement preference. |
| `POST` | `/api/v1/profile/avatar` | Upload a new avatar image (multipart/form-data). |
| `DELETE` | `/api/v1/profile/avatar` | Remove avatar, revert to generated default. |
| `PATCH` | `/api/v1/account/email` | Update email (sends verification). Body: `{ "newEmail": string }`. |
| `PATCH` | `/api/v1/account/password` | Update password. Body: `{ "currentPassword": string, "newPassword": string }`. |
| `DELETE` | `/api/v1/account` | Delete account. Body: `{ "confirmation": "DELETE" }`. |

---

## Data Model

```typescript
interface UserProfile {
  userId: string;            // ULID, matches auth user ID
  displayName: string;
  avatarUrl: string | null;  // null = use generated default
  dietaryPreferences: string[];  // e.g., ["vegetarian", "gluten-free"]
  defaultServings: number | null;  // null = use recipe original
  measurementPreference: "metric" | "imperial" | "as-written";
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
}
```

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Load profile | < 100ms |
| Update profile | < 200ms |
| Upload avatar | < 2s (including resize) |
| Delete account | < 500ms (async cleanup) |

---

## Security Requirements

- All profile endpoints require authentication.
- Avatar uploads are scanned for valid image headers (no executable content).
- Password change requires current password verification.
- Account deletion requires explicit "DELETE" confirmation string.
- Email change requires verification of the new email address.
- Rate limiting: 10 avatar uploads per user per hour, 5 email/password changes per user per hour.

---

## Accessibility Requirements

- Profile form uses proper `<label>` associations for all inputs.
- Avatar upload has a visually hidden file input with a styled button trigger labeled "Upload avatar".
- Dietary preference checkboxes are grouped with `role="group"` and `aria-label="Dietary preferences"`.
- Account deletion confirmation dialog traps focus and is dismissible with Escape.
- All form validation errors are associated with inputs via `aria-describedby`.
- Success/error toasts use `role="status"` for non-critical and `role="alert"` for errors.

---

## Out of Scope

- Public user profiles visible to other users.
- Social features (following, activity feeds).
- Allergen severity levels (binary preference only).
- Profile theming or custom color schemes.
- Export/download of user data (GDPR-style export).
- Two-factor authentication setup (covered by auth spec).
