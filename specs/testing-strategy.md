# Testing Strategy

> Unit, integration, E2E approach and tooling for Deno + SvelteKit.

---

## Overview

This spec defines the testing approach for the recipe app across all layers: unit tests, integration tests, and end-to-end tests. We use **Deno's built-in test runner** for backend logic, **Vitest** for SvelteKit frontend components, and **Playwright** for E2E browser testing.

This spec builds on:
- [backend-architecture.md](./backend-architecture.md) — Deno runtime, API layer
- [frontend-architecture.md](./frontend-architecture.md) — SvelteKit project structure
- [database.md](./database.md) — database schema and migrations
- [deployment.md](./deployment.md) — CI/CD pipeline

---

## Test Pyramid

```
        ┌─────────┐
        │   E2E   │  ~20 tests — critical user flows
        ├─────────┤
      │ Integration │  ~50 tests — API routes, DB queries
      ├─────────────┤
    │    Unit Tests    │  ~200+ tests — pure logic, components
    └──────────────────┘
```

- **Unit tests** form the base: fast, isolated, no external dependencies
- **Integration tests** verify API routes and database interactions
- **E2E tests** cover critical user journeys end-to-end in a real browser

---

## Unit Testing

### Backend: Deno Test Runner

All backend unit tests use `Deno.test()` with the standard library assertions.

```ts
// src/lib/server/models/__tests__/recipe.test.ts
import { assertEquals, assertThrows } from "@std/assert";
import { parseRecipe } from "../recipe.ts";

Deno.test("parseRecipe - valid frontmatter", () => {
  const result = parseRecipe(validMarkdown);
  assertEquals(result.title, "Test Recipe");
});

Deno.test("parseRecipe - missing title throws", () => {
  assertThrows(() => parseRecipe(invalidMarkdown), Error, "title is required");
});
```

**Run command:**
```bash
deno test --allow-read --allow-env
```

**Conventions:**
- Test files live adjacent to source in `__tests__/` directories
- File naming: `<module>.test.ts`
- Use `describe`-style grouping via nested `Deno.test()` with `t.step()`
- Mock external dependencies (OCR service, fetch) using test doubles

### Frontend: Vitest + Testing Library

SvelteKit components are tested with Vitest and `@testing-library/svelte`.

```ts
// src/lib/components/__tests__/RecipeCard.test.ts
import { render, screen } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import RecipeCard from "../RecipeCard.svelte";

describe("RecipeCard", () => {
  it("renders recipe title", () => {
    render(RecipeCard, { props: { recipe: mockRecipe } });
    expect(screen.getByText("Test Recipe")).toBeInTheDocument();
  });

  it("displays difficulty badge", () => {
    render(RecipeCard, { props: { recipe: mockRecipe } });
    expect(screen.getByText("easy")).toBeInTheDocument();
  });
});
```

**Run command:**
```bash
deno task test:unit
```

**Conventions:**
- Test files in `__tests__/` adjacent to components
- Use `@testing-library/svelte` for component rendering and queries
- Prefer `getByRole`, `getByText`, `getByLabelText` over test IDs
- Mock API calls with `vi.mock()` or MSW

---

## Integration Testing

### API Route Tests

Integration tests verify SvelteKit API routes with a real (test) database.

```ts
// src/routes/api/v1/recipes/__tests__/recipes.integration.test.ts
import { assertEquals } from "@std/assert";

Deno.test("POST /api/v1/recipes - creates recipe", async () => {
  const response = await fetch(`${TEST_BASE_URL}/api/v1/recipes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify(validRecipePayload),
  });
  assertEquals(response.status, 201);
  const recipe = await response.json();
  assertEquals(recipe.title, validRecipePayload.title);
});
```

### Database Tests

Database integration tests run against a dedicated test database that is reset between test suites.

```ts
// src/lib/server/db/__tests__/queries.integration.test.ts
import { assertEquals } from "@std/assert";
import { setupTestDb, teardownTestDb } from "../test-utils.ts";

Deno.test("recipe queries", async (t) => {
  const db = await setupTestDb();

  await t.step("insertRecipe returns created recipe", async () => {
    const recipe = await db.insertRecipe(testRecipe);
    assertEquals(recipe.title, testRecipe.title);
  });

  await teardownTestDb(db);
});
```

**Test database strategy:**
- Use a separate SQLite database file for tests (`:memory:` or `test.db`)
- Run migrations before each test suite
- Truncate tables between tests for isolation
- Never run integration tests against production

**Run command:**
```bash
deno task test:integration
```

---

## End-to-End Testing

### Playwright

E2E tests run in real browsers to verify critical user flows.

```ts
// e2e/recipe-create.spec.ts
import { test, expect } from "@playwright/test";

test("user can create a recipe", async ({ page }) => {
  await page.goto("/auth/login");
  await page.fill('[name="email"]', "test@example.com");
  await page.fill('[name="password"]', "password123");
  await page.click('button[type="submit"]');

  await page.goto("/recipes/new");
  await page.fill('[name="title"]', "My Test Recipe");
  await page.fill(".markdown-editor textarea", "## Ingredients\n- 1 cup flour\n\n## Instructions\n1. Mix it");
  await page.click('button:text("Save")');

  await expect(page).toHaveURL(/\/recipes\/my-test-recipe/);
  await expect(page.getByText("My Test Recipe")).toBeVisible();
});
```

**Critical flows to cover:**
1. User registration and login
2. Create a recipe manually
3. Import a recipe from URL
4. OCR capture flow (with mock image)
5. Search and filter recipes
6. Generate a shopping list
7. View recommendations

**Run command:**
```bash
deno task test:e2e
```

**Configuration:**
- Browsers: Chromium and Firefox (skip WebKit for speed)
- Run against a local dev server with seeded test data
- Screenshots on failure for debugging
- Retry flaky tests once

---

## Test Configuration

### deno.json Tasks

```json
{
  "tasks": {
    "test": "deno task test:unit && deno task test:integration",
    "test:unit": "deno test --allow-read --allow-env src/",
    "test:integration": "deno test --allow-all src/ --filter integration",
    "test:e2e": "npx playwright test",
    "test:coverage": "deno test --allow-read --allow-env --coverage=cov_profile src/ && deno coverage cov_profile"
  }
}
```

### Playwright Config

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  baseURL: "http://localhost:5173",
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "deno task dev",
    port: 5173,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  retries: 1,
});
```

---

## Coverage

### Targets

| Layer      | Target | Enforcement |
|------------|--------|-------------|
| Backend    | 80%    | CI warning  |
| Frontend   | 70%    | CI warning  |
| Overall    | 75%    | CI warning  |

Coverage is tracked but not blocking — we optimize for meaningful tests over coverage percentages.

### Generating Reports

```bash
# Backend coverage
deno task test:coverage

# Frontend coverage
npx vitest --coverage
```

---

## Test Data

### Fixtures

Shared test fixtures live in `src/lib/test-fixtures/`.

```
src/lib/test-fixtures/
├── recipes.ts          # Mock recipe objects
├── users.ts            # Mock user objects
└── ingredients.ts      # Mock ingredient data
```

### Factories

Use factory functions for creating test data with sensible defaults and overrides.

```ts
// src/lib/test-fixtures/recipes.ts
export function createMockRecipe(overrides?: Partial<Recipe>): Recipe {
  return {
    id: "01HQXYZ1234567890ABCDE",
    title: "Test Recipe",
    slug: "test-recipe",
    servings: { default: 4, label: "servings" },
    difficulty: "easy",
    tags: { cuisine: ["italian"], meal: ["dinner"] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
```

### E2E Seed Data

E2E tests use a seed script that populates the test database before the suite runs.

```bash
deno task test:seed  # Populates test DB with known recipes, users
```

---

## CI Integration

Tests run in the GitHub Actions pipeline defined in [deployment.md](./deployment.md).

```
push/PR to main
  └─ Lint
  └─ Type check
  └─ Unit tests (deno test)
  └─ Integration tests (deno test --filter integration)
  └─ Build
  └─ E2E tests (playwright, post-build)
  └─ Coverage report (upload as artifact)
  └─ Deploy (only on merge to main)
```

### Test Failures

- **Unit/Integration failure:** Blocks merge
- **E2E failure:** Blocks merge
- **Coverage below target:** Warning comment on PR, does not block

---

## Conventions

1. **Test naming:** Use descriptive names — `"parseRecipe - missing title throws validation error"`
2. **Arrange-Act-Assert:** Structure tests with clear setup, action, and verification
3. **One assertion per concept:** Multiple assertions are fine if they verify one logical thing
4. **No test interdependence:** Each test must run in isolation and in any order
5. **Mock at boundaries:** Mock external services (OCR, fetch), not internal modules
6. **No sleeping:** Use polling/waiting utilities instead of fixed delays
7. **Clean up:** Tests must clean up any state they create (DB records, files, etc.)
