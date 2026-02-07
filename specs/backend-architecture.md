# Backend Architecture

> Runtime setup (Deno), project structure, API layer design, middleware, error handling conventions.

---

## Overview

The recipe app backend runs on **Deno** using **SvelteKit 2** as the application framework. SvelteKit provides file-based routing, server-side rendering, and a unified build pipeline. This spec defines the runtime configuration, project layout, middleware pipeline, and error handling conventions that all other backend specs build upon.

---

## Runtime: Deno

### Why Deno

- **TypeScript-first** — Native TypeScript execution with no separate compilation step.
- **Secure by default** — Explicit permission flags for network, file system, and environment access.
- **Built-in tooling** — Formatter (`deno fmt`), linter (`deno lint`), test runner (`deno test`), and task runner (`deno task`).
- **Node compatibility** — Supports `npm:` specifiers for Node packages, enabling the full SvelteKit ecosystem.
- **SQLite built-in** — Deno ships with a native SQLite module, avoiding external database dependencies.

### Deno Configuration

The project uses a `deno.json` (or `deno.jsonc`) configuration file at the project root:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "verbatimModuleSyntax": true
  },
  "tasks": {
    "dev": "deno run -A npm:vite dev",
    "build": "deno run -A npm:vite build",
    "preview": "deno run -A npm:vite preview",
    "check": "deno run -A npm:svelte-kit sync && deno check src/**/*.ts",
    "test": "deno test --allow-read --allow-write --allow-env",
    "lint": "deno lint",
    "fmt": "deno fmt"
  },
  "imports": {
    "$lib": "./src/lib",
    "$lib/*": "./src/lib/*"
  },
  "nodeModulesDir": "auto"
}
```

### Permission Model

In production, the app runs with the minimum necessary permissions:

| Permission       | Reason                                    |
|------------------|-------------------------------------------|
| `--allow-net`    | Serve HTTP, fetch external URLs (import)  |
| `--allow-read`   | Read project files, SQLite database       |
| `--allow-write`  | Write SQLite database, upload temp files  |
| `--allow-env`    | Read environment variables for config     |

During development, `-A` (allow all) is acceptable for convenience.

---

## Project Structure

```
recipe-app/
├── deno.json                   # Deno config, tasks, import map
├── svelte.config.js            # SvelteKit configuration
├── vite.config.ts              # Vite configuration
├── migrations/                 # SQL migration files (see database.md)
│   ├── 001_create_recipes.sql
│   ├── 002_create_recipe_tags.sql
│   └── ...
├── src/
│   ├── app.html                # SvelteKit HTML shell
│   ├── app.d.ts                # Global type declarations (Locals, etc.)
│   ├── hooks.server.ts         # Server hooks (auth, request ID, error handling)
│   ├── lib/
│   │   ├── server/             # Server-only code (never sent to client)
│   │   │   ├── db/
│   │   │   │   ├── connection.ts     # SQLite connection singleton
│   │   │   │   ├── migrations.ts     # Migration runner
│   │   │   │   ├── recipes.ts        # Recipe CRUD queries
│   │   │   │   ├── tags.ts           # Tag query functions
│   │   │   │   └── search.ts         # FTS query functions
│   │   │   ├── auth/
│   │   │   │   ├── password.ts       # Hashing utilities
│   │   │   │   ├── session.ts        # Session management
│   │   │   │   └── guard.ts          # requireAuth helper
│   │   │   ├── middleware/
│   │   │   │   ├── validate.ts       # Request validation
│   │   │   │   └── rate-limit.ts     # Rate limiting (future)
│   │   │   ├── services/
│   │   │   │   ├── recipe-service.ts # Recipe business logic
│   │   │   │   └── import-service.ts # Recipe import pipeline (future)
│   │   │   └── config.ts            # Environment config loader
│   │   ├── models/
│   │   │   ├── recipe.ts             # Recipe types and validation
│   │   │   ├── user.ts               # User/Session types
│   │   │   └── errors.ts             # Application error types
│   │   ├── utils/
│   │   │   ├── ulid.ts               # ULID generation
│   │   │   ├── slug.ts               # Slug generation
│   │   │   ├── duration.ts           # ISO 8601 duration parsing
│   │   │   └── response.ts           # Response envelope helpers
│   │   └── constants.ts              # Shared constants (tag groups, limits)
│   └── routes/
│       ├── api/
│       │   └── v1/
│       │       ├── recipes/
│       │       │   ├── +server.ts           # GET (list), POST (create)
│       │       │   ├── [slug]/
│       │       │   │   └── +server.ts       # GET, PUT, PATCH, DELETE
│       │       │   ├── search/
│       │       │   │   └── +server.ts       # GET (full-text search)
│       │       │   └── query/
│       │       │       └── +server.ts       # GET (tag query)
│       │       ├── tags/
│       │       │   ├── +server.ts           # GET (all tags)
│       │       │   └── [group]/
│       │       │       └── +server.ts       # GET (tags by group)
│       │       └── auth/
│       │           ├── register/
│       │           │   └── +server.ts       # POST
│       │           ├── login/
│       │           │   └── +server.ts       # POST
│       │           ├── logout/
│       │           │   └── +server.ts       # POST
│       │           └── me/
│       │               └── +server.ts       # GET
│       └── (app)/                           # Frontend routes (future)
├── static/                     # Static assets
└── tests/                      # Test files
    ├── unit/
    └── integration/
```

### Key Conventions

- **`$lib/server/`** — All server-only code lives here. SvelteKit enforces that `$lib/server/` imports cannot be used in client-side code, preventing accidental leakage of database connections, secrets, or server logic.
- **`$lib/models/`** — Shared types and validation logic usable on both server and client.
- **`$lib/utils/`** — Pure utility functions usable on both server and client.
- **`src/routes/api/`** — API route handlers. Each `+server.ts` exports named HTTP method functions.

---

## API Layer Design

### Route Handlers

Each API route handler follows a consistent pattern:

```typescript
// src/routes/api/v1/recipes/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';
import { validate } from '$lib/server/middleware/validate';
import { recipeService } from '$lib/server/services/recipe-service';
import { success, listSuccess, error } from '$lib/utils/response';

export const GET: RequestHandler = async ({ url }) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
  const sort = url.searchParams.get('sort') ?? '-createdAt';

  const result = await recipeService.list({ page, pageSize, sort });

  return json(listSuccess(result.recipes, result.pagination));
};

export const POST: RequestHandler = async (event) => {
  const user = requireAuth(event);
  const body = await validate(event, createRecipeSchema);
  const recipe = await recipeService.create(body, user);

  return json(success(recipe), { status: 201 });
};
```

### Service Layer

Route handlers delegate business logic to service modules in `$lib/server/services/`. Services:

- Orchestrate database calls and validation.
- Enforce business rules (slug generation, timestamp management, tag limits).
- Throw typed application errors (see Error Handling below).
- Are the single point of entry for write operations — route handlers never call the database directly for mutations.

Read-only queries may call database functions directly from route handlers when no additional business logic is needed.

### Database Access Layer

Database functions in `$lib/server/db/` provide parameterized query wrappers:

- Each module exposes functions, not classes.
- All queries use parameterized SQL (never string interpolation).
- Write operations are wrapped in transactions.
- Functions return plain objects, not ORM instances.

---

## Middleware

SvelteKit uses **hooks** (`src/hooks.server.ts`) as its middleware mechanism. The `handle` function processes every request.

### Hook Pipeline

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { generateUlid } from '$lib/utils/ulid';
import { validateSession } from '$lib/server/auth/session';

const requestId: Handle = async ({ event, resolve }) => {
  event.locals.requestId = generateUlid();
  const response = await resolve(event);
  response.headers.set('X-Request-Id', event.locals.requestId);
  return response;
};

const auth: Handle = async ({ event, resolve }) => {
  const sessionToken = event.cookies.get('session');
  if (sessionToken) {
    const { user, shouldExtend } = await validateSession(sessionToken);
    event.locals.user = user ?? undefined;
    if (shouldExtend) {
      // Extend session cookie (sliding window)
      event.cookies.set('session', sessionToken, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });
    }
  }
  return resolve(event);
};

export const handle = sequence(requestId, auth);
```

### Middleware Responsibilities

| Middleware     | Purpose                                                                 |
|----------------|-------------------------------------------------------------------------|
| `requestId`    | Generate a ULID for every request, attach to `locals` and response header. |
| `auth`         | Read session cookie, validate, populate `event.locals.user`.            |

Additional middleware (rate limiting, CORS) can be added to the `sequence()` chain as needed.

### `app.d.ts` Type Declarations

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      requestId: string;
      user?: {
        id: string;
        email: string;
        displayName: string;
      };
    }
  }
}

export {};
```

---

## Error Handling

### Application Error Types

All expected errors are represented as typed error classes:

```typescript
// src/lib/models/errors.ts

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown[]
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier: string) {
    super('NOT_FOUND', `${resource} '${identifier}' not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(details: { field: string; message: string }[]) {
    super('VALIDATION_ERROR', 'Request validation failed', 400, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super('AUTH_REQUIRED', message, 401);
  }
}
```

### Error Handling Hook

Unexpected errors are caught by the SvelteKit `handleError` hook:

```typescript
// src/hooks.server.ts (additional export)
import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = async ({ error, event }) => {
  const requestId = event.locals.requestId;

  // Log the full error server-side
  console.error(`[${requestId}]`, error);

  // Return a safe error to the client
  return {
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId
  };
};
```

### Error Handling in Route Handlers

Route handlers catch `AppError` instances and convert them to JSON responses:

```typescript
import { json } from '@sveltejs/kit';
import { AppError } from '$lib/models/errors';
import { errorResponse } from '$lib/utils/response';

// In a route handler:
try {
  // ... business logic
} catch (err) {
  if (err instanceof AppError) {
    return json(
      errorResponse(err.code, err.message, event.locals.requestId, err.details),
      { status: err.status }
    );
  }
  throw err; // Re-throw unexpected errors for handleError hook
}
```

To reduce boilerplate, a `withErrorHandling` wrapper can be used:

```typescript
// $lib/server/middleware/error-handler.ts
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { AppError } from '$lib/models/errors';
import { errorResponse } from '$lib/utils/response';

export function withErrorHandling(
  handler: (event: RequestEvent) => Promise<Response>
) {
  return async (event: RequestEvent) => {
    try {
      return await handler(event);
    } catch (err) {
      if (err instanceof AppError) {
        return json(
          errorResponse(err.code, err.message, event.locals.requestId, err.details),
          { status: err.status }
        );
      }
      throw err;
    }
  };
}
```

---

## Environment Configuration

Configuration is loaded from environment variables with sensible defaults:

```typescript
// src/lib/server/config.ts

function env(key: string, fallback?: string): string {
  const value = Deno.env.get(key) ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  /** SQLite database file path */
  databasePath: env('DATABASE_PATH', 'data/recipes.db'),

  /** Session cookie name */
  sessionCookie: env('SESSION_COOKIE', 'session'),

  /** Session lifetime in seconds (default 7 days) */
  sessionMaxAge: Number(env('SESSION_MAX_AGE', String(60 * 60 * 24 * 7))),

  /** bcrypt cost factor */
  bcryptCost: Number(env('BCRYPT_COST', '10')),

  /** Whether the app is running in production */
  isProduction: env('NODE_ENV', 'development') === 'production',
} as const;
```

### Required Environment Variables

| Variable         | Required | Default              | Description                    |
|------------------|----------|----------------------|--------------------------------|
| `DATABASE_PATH`  | No       | `data/recipes.db`    | Path to SQLite database file   |
| `SESSION_COOKIE` | No       | `session`            | Name of the session cookie     |
| `SESSION_MAX_AGE`| No       | `604800` (7 days)    | Session lifetime in seconds    |
| `BCRYPT_COST`    | No       | `10`                 | bcrypt hashing cost factor     |
| `NODE_ENV`       | No       | `development`        | `development` or `production`  |

---

## Logging

### Approach: Structured Console Logging

For v1, the app uses structured `console` logging. No external logging library is introduced initially.

```typescript
console.info(`[${requestId}] POST /api/v1/recipes — 201 Created`);
console.error(`[${requestId}] Unhandled error:`, error);
```

### Conventions

- Always include the `requestId` in log messages for traceability.
- Use `console.info` for request lifecycle events.
- Use `console.warn` for recoverable issues (e.g., invalid session token).
- Use `console.error` for unexpected failures.
- Never log sensitive data (passwords, session tokens, full cookies).

A structured logging library (e.g., `pino`) can be introduced later if needed, with the same interface.

---

## Testing Conventions

Tests are run via `deno test` and live in the `tests/` directory.

### Structure

- **Unit tests** (`tests/unit/`) — Test individual functions and modules in isolation. Mock database and external dependencies.
- **Integration tests** (`tests/integration/`) — Test API routes end-to-end against a real (in-memory or temp file) SQLite database.

### Conventions

- Test files are named `*.test.ts`.
- Use Deno's built-in test runner and assertion library (`@std/assert`).
- Integration tests create a fresh database per test suite (not per test) for performance.
- Tests do not depend on external services or network access.

---

## Security Conventions

- **No string interpolation in SQL** — All queries use parameterized bind values.
- **`$lib/server/` boundary** — Server-only code cannot be imported by client modules.
- **HttpOnly cookies** — Session tokens are never accessible to client-side JavaScript.
- **Input validation** — All user input is validated before reaching business logic.
- **Error sanitization** — Internal error details are never exposed to the client; only safe error codes and messages are returned.
- **Dependency minimalism** — Prefer Deno built-ins and standard library over third-party packages to reduce supply chain risk.
