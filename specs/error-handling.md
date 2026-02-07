# Error Handling

> Global error handling patterns (client + server), user-facing error messages, logging.

---

## Overview

This spec defines error handling conventions across the entire recipe app — server-side API errors, client-side UI error states, and structured logging. The goal is consistent, user-friendly error reporting with sufficient detail for debugging.

This spec builds on:
- [backend-architecture.md](./backend-architecture.md) — API layer, middleware
- [frontend-architecture.md](./frontend-architecture.md) — SvelteKit routing, layouts
- [api-routes.md](./api-routes.md) — endpoint definitions, response shapes
- [auth.md](./auth.md) — authentication errors

---

## Error Shape

All API errors follow a single JSON shape returned from the server.

```ts
interface ApiError {
  error: {
    code: string;       // Machine-readable code, e.g. "RECIPE_NOT_FOUND"
    message: string;    // Human-readable summary
    status: number;     // HTTP status code
    details?: unknown;  // Optional structured context (validation errors, etc.)
  };
}
```

**Conventions:**
- `code` is UPPER_SNAKE_CASE and stable — clients can switch on it
- `message` is a sentence suitable for displaying to users
- `details` is only present when additional context is useful (e.g. per-field validation errors)

---

## Error Codes

| Code                        | HTTP Status | When                                          |
|-----------------------------|-------------|-----------------------------------------------|
| `VALIDATION_ERROR`          | 400         | Request body or params fail validation        |
| `UNAUTHORIZED`              | 401         | Missing or invalid auth credentials           |
| `FORBIDDEN`                 | 403         | Valid auth but insufficient permissions        |
| `NOT_FOUND`                 | 404         | Resource does not exist                       |
| `CONFLICT`                  | 409         | Duplicate resource (e.g. slug collision)       |
| `RATE_LIMITED`              | 429         | Too many requests                             |
| `INTERNAL_ERROR`            | 500         | Unexpected server failure                     |
| `OCR_PROCESSING_FAILED`    | 502         | OCR service returned an error                 |
| `IMPORT_FETCH_FAILED`      | 502         | Could not fetch the recipe import URL         |
| `IMPORT_PARSE_FAILED`      | 422         | Fetched page but could not extract recipe     |

---

## Server-Side Error Handling

### SvelteKit Error Hook

Use the `handleError` hook in `src/hooks.server.ts` to catch unexpected errors globally.

```ts
// src/hooks.server.ts
import type { HandleServerError } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";

export const handleError: HandleServerError = ({ error, event }) => {
  const requestId = crypto.randomUUID();

  logger.error({
    requestId,
    method: event.request.method,
    url: event.url.pathname,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return {
    message: "An unexpected error occurred.",
    code: "INTERNAL_ERROR",
    requestId,
  };
};
```

### API Route Error Helper

A shared utility for returning consistent error responses from API routes.

```ts
// src/lib/server/errors.ts
import { json, error } from "@sveltejs/kit";

export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function apiError(err: AppError): Response {
  return json(
    { error: { code: err.code, message: err.message, status: err.status, details: err.details } },
    { status: err.status },
  );
}
```

**Usage in routes:**

```ts
// src/routes/api/v1/recipes/[id]/+server.ts
import { AppError, apiError } from "$lib/server/errors";

export async function GET({ params }) {
  const recipe = await db.getRecipe(params.id);
  if (!recipe) {
    return apiError(new AppError("NOT_FOUND", 404, "Recipe not found."));
  }
  return json(recipe);
}
```

### Validation Errors

Validation failures include per-field detail in the `details` property.

```ts
return apiError(
  new AppError("VALIDATION_ERROR", 400, "Invalid recipe data.", {
    fields: {
      title: "Title is required.",
      "tags.cuisine": "Maximum 20 tags allowed per group.",
    },
  }),
);
```

---

## Client-Side Error Handling

### SvelteKit Error Pages

Use SvelteKit's `+error.svelte` pages at the root layout level, with optional per-route overrides.

```
src/routes/
├── +error.svelte          # Global fallback error page
├── recipes/
│   └── +error.svelte      # Recipe-specific error page (optional)
```

The root `+error.svelte` reads the error from `$page.error` and renders an appropriate message.

```svelte
<!-- src/routes/+error.svelte -->
<script>
  import { page } from "$app/stores";
</script>

<div class="flex flex-col items-center justify-center min-h-[50vh] gap-4">
  <h1 class="text-4xl font-bold">{$page.status}</h1>
  <p class="text-muted-foreground">{$page.error?.message ?? "Something went wrong."}</p>
  <a href="/" class="underline">Go home</a>
</div>
```

### API Call Error Handling

Client-side API calls should use a shared fetch wrapper that handles errors consistently.

```ts
// src/lib/api.ts
import { AppError } from "$lib/shared/errors";

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new AppError(
      body?.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      body?.error?.message ?? "An unexpected error occurred.",
      body?.error?.details,
    );
  }

  return response.json();
}
```

### Toast Notifications

Non-fatal errors (failed save, network blip) display as toast notifications rather than full error pages.

**Rules:**
- Use toasts for transient, recoverable errors
- Use error pages for navigation failures (404, 500)
- Include a retry action on toasts where retrying makes sense

---

## Logging

### Structured Logger

Use a structured JSON logger on the server.

```ts
// src/lib/server/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, data: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (data: Record<string, unknown>) => log("debug", data),
  info: (data: Record<string, unknown>) => log("info", data),
  warn: (data: Record<string, unknown>) => log("warn", data),
  error: (data: Record<string, unknown>) => log("error", data),
};
```

### What to Log

| Event                     | Level  | Details                                     |
|---------------------------|--------|---------------------------------------------|
| Incoming request          | info   | method, path, requestId                     |
| Successful response       | info   | method, path, status, durationMs            |
| Validation failure        | warn   | code, fields, requestId                     |
| Auth failure              | warn   | reason, ip, requestId                       |
| Unexpected server error   | error  | message, stack, requestId                   |
| External service failure  | error  | service, statusCode, requestId              |

### What NOT to Log

- Passwords, tokens, session IDs, or credentials
- Full request bodies containing user data
- PII beyond what is necessary for debugging

---

## Conventions

1. **Never expose stack traces to clients** — stack traces are logged server-side only
2. **Always return the standard error shape** — even for unexpected errors via the error hook
3. **Use `AppError` for expected errors** — throw or return it; let unexpected errors bubble to the hook
4. **Log a requestId on every error** — correlate client reports with server logs
5. **Fail fast on startup** — missing environment variables or database connection failures should crash immediately with a clear message, not silently degrade
6. **Validate at boundaries** — validate incoming request data at the API route level, trust internal code
7. **No silent catches** — every `catch` block must either re-throw, log, or handle the error meaningfully
