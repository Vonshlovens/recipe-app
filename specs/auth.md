# Authentication & Authorization

> Authentication and authorization strategy, session management, user accounts.

---

## Overview

The recipe app uses cookie-based session authentication. Users register with an email and password, log in to receive a session cookie, and the server validates the session on each request. This keeps the auth model simple, server-side, and well-suited to a SvelteKit app where SSR and API routes share the same process.

---

## Auth Strategy: Cookie-Based Sessions

### Rationale

- **SvelteKit-native** — SvelteKit's `handle` hook and `locals` pattern make server-side session validation straightforward.
- **No client-side token management** — Cookies are sent automatically; no need for `Authorization` headers, token refresh logic, or local storage of secrets.
- **HttpOnly + Secure** — Session cookies are invisible to client-side JavaScript, reducing XSS attack surface.
- **Simple invalidation** — Deleting the session from the database instantly logs the user out. No token expiry dance.

### Why Not JWT?

JWTs add complexity (signing, refresh tokens, revocation difficulty) without benefit for a single-server app that already has a database. Stateless auth is unnecessary when all requests hit the same SQLite instance.

---

## User Accounts

### `users` Table

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- ULID
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,             -- bcrypt hash
  created_at    TEXT NOT NULL,             -- ISO 8601 datetime
  updated_at    TEXT NOT NULL              -- ISO 8601 datetime
);
```

### Field Rules

| Field          | Constraints                                                          |
|----------------|----------------------------------------------------------------------|
| `id`           | ULID. Generated on creation, immutable.                              |
| `email`        | Valid email format. Unique. Stored lowercase-normalized.             |
| `display_name` | 1–100 characters.                                                    |
| `password_hash`| bcrypt with cost factor 10. Never exposed in API responses.          |
| `created_at`   | ISO 8601. Set on creation, immutable.                                |
| `updated_at`   | ISO 8601. Updated on profile changes.                                |

### Password Rules

- Minimum 8 characters.
- Maximum 128 characters (prevents bcrypt DoS with extremely long inputs).
- No character-class requirements (length is the primary security factor).
- Passwords are hashed with bcrypt (cost factor 10) before storage.

---

## Sessions

### `sessions` Table

```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,            -- Random 32-byte hex token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,               -- ISO 8601 datetime
  expires_at  TEXT NOT NULL                -- ISO 8601 datetime
);
```

### Session Lifecycle

1. **Creation** — On successful login, generate a cryptographically random 32-byte token, insert a row in `sessions` with a 30-day expiry, and set it as a cookie.
2. **Validation** — On each request, read the session cookie, look up the token in `sessions`, check it hasn't expired, and load the associated user into `locals.user`.
3. **Expiry extension** — On each successful validation, if the session is past 50% of its lifetime, extend `expires_at` by another 30 days (sliding window).
4. **Logout** — Delete the session row from the database. Clear the cookie.
5. **Cleanup** — A periodic task (or on-demand) deletes expired sessions from the table.

### Cookie Configuration

```
Name:     session
Value:    <32-byte hex token>
HttpOnly: true
Secure:   true (in production)
SameSite: Lax
Path:     /
MaxAge:   2592000 (30 days)
```

---

## Auth Endpoints

### `POST /api/v1/auth/register`

Create a new user account.

**Request Body:**

```json
{
  "email": "jane@example.com",
  "displayName": "Jane Doe",
  "password": "securepassword123"
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "01J5K...",
    "email": "jane@example.com",
    "displayName": "Jane Doe",
    "createdAt": "2026-01-15T10:30:00Z"
  },
  "meta": { "requestId": "01J5K..." }
}
```

**Errors:**
- `400` — Missing or invalid fields.
- `409` — Email already registered.

**Notes:**
- Registration does NOT automatically log the user in. The client should follow up with a login request.
- The `password` field is never echoed back.

---

### `POST /api/v1/auth/login`

Authenticate and create a session.

**Request Body:**

```json
{
  "email": "jane@example.com",
  "password": "securepassword123"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "id": "01J5K...",
    "email": "jane@example.com",
    "displayName": "Jane Doe"
  },
  "meta": { "requestId": "01J5K..." }
}
```

**Side Effect:** Sets the `session` cookie.

**Errors:**
- `400` — Missing fields.
- `401` — Invalid email or password. Use a generic message ("Invalid email or password") to avoid revealing whether the email exists.

---

### `POST /api/v1/auth/logout`

Destroy the current session.

**Response:** `204 No Content`

**Side Effect:** Clears the `session` cookie and deletes the session row.

**Notes:**
- If no valid session exists, still return `204` (idempotent).

---

### `GET /api/v1/auth/me`

Return the currently authenticated user.

**Response:** `200 OK`

```json
{
  "data": {
    "id": "01J5K...",
    "email": "jane@example.com",
    "displayName": "Jane Doe",
    "createdAt": "2026-01-15T10:30:00Z"
  },
  "meta": { "requestId": "01J5K..." }
}
```

**Error:** `401` — Not authenticated.

---

## SvelteKit Integration

### Route Structure

```
src/routes/
  api/
    v1/
      auth/
        register/
          +server.ts        → POST (register)
        login/
          +server.ts        → POST (login)
        logout/
          +server.ts        → POST (logout)
        me/
          +server.ts        → GET (current user)
```

### `handle` Hook

Session validation runs in `src/hooks.server.ts`:

```ts
export const handle: Handle = async ({ event, resolve }) => {
  const sessionToken = event.cookies.get('session');

  if (sessionToken) {
    const user = await getUserBySession(sessionToken);
    if (user) {
      event.locals.user = user;
    }
  }

  return resolve(event);
};
```

All route handlers can check `event.locals.user` to determine if the request is authenticated.

### `app.d.ts`

```ts
declare global {
  namespace App {
    interface Locals {
      user?: {
        id: string;
        email: string;
        displayName: string;
      };
    }
  }
}
```

---

## Route Protection

### Authorization Rules

| Endpoint Pattern               | Auth Required | Rule                                     |
|--------------------------------|---------------|------------------------------------------|
| `GET /api/v1/recipes`          | No            | Public read access.                      |
| `GET /api/v1/recipes/:slug`    | No            | Public read access.                      |
| `GET /api/v1/recipes/search`   | No            | Public read access.                      |
| `GET /api/v1/recipes/query`    | No            | Public read access.                      |
| `GET /api/v1/tags`             | No            | Public read access.                      |
| `GET /api/v1/tags/:group`      | No            | Public read access.                      |
| `POST /api/v1/recipes`         | Yes           | Any authenticated user can create.       |
| `PUT /api/v1/recipes/:slug`    | Yes           | Any authenticated user can update.       |
| `PATCH /api/v1/recipes/:slug`  | Yes           | Any authenticated user can update.       |
| `DELETE /api/v1/recipes/:slug` | Yes           | Any authenticated user can delete.       |
| `POST /api/v1/auth/register`   | No            | Public.                                  |
| `POST /api/v1/auth/login`      | No            | Public.                                  |
| `POST /api/v1/auth/logout`     | No            | Idempotent, no error if unauthenticated. |
| `GET /api/v1/auth/me`          | Yes           | Returns current user.                    |

### Middleware Pattern

A reusable `requireAuth` helper for route handlers:

```ts
function requireAuth(event: RequestEvent): App.Locals['user'] {
  if (!event.locals.user) {
    throw error(401, {
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  return event.locals.user;
}
```

Protected route handlers call `requireAuth(event)` at the top before processing the request.

---

## Security Considerations

### Password Storage

- bcrypt with cost factor 10 (adjustable upward as hardware improves).
- Never log, return, or expose raw passwords or hashes.

### Session Security

- Session tokens are cryptographically random (32 bytes from `crypto.getRandomValues`).
- Tokens are compared in constant time to prevent timing attacks.
- Sessions are stored server-side; the cookie contains only the lookup token.

### CSRF Protection

- SvelteKit provides built-in CSRF protection via origin checking on form submissions.
- API routes that accept `application/json` are not vulnerable to traditional CSRF (browsers don't send JSON cross-origin via forms).
- The `SameSite=Lax` cookie attribute provides additional protection.

### Rate Limiting

- Login and registration endpoints should be rate-limited per IP to mitigate brute-force attacks.
- Recommended: 5 attempts per minute per IP for login, 3 registrations per hour per IP.
- Returns `429 Too Many Requests` with `Retry-After` header when exceeded.
- Rate limiting implementation deferred to a future spec or the `specs/backend-architecture.md` middleware layer.

### Account Enumeration Prevention

- Login errors use a generic "Invalid email or password" message regardless of whether the email exists.
- Registration returns `409` for duplicate emails (acceptable trade-off; email uniqueness is visible through the registration flow).

---

## Migrations

Auth tables are added via new migration files following the existing migration pattern:

```
migrations/
  004_create_users.sql
  005_create_sessions.sql
```

### `004_create_users.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### `005_create_sessions.sql`

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
```

---

## Future Considerations

- **Password reset** — Email-based reset flow (requires email sending infrastructure).
- **OAuth providers** — Social login (Google, GitHub) as an alternative to email/password.
- **Per-recipe ownership** — Associate recipes with the user who created them; restrict edits/deletes to the author (or admins).
- **Role-based access** — Admin vs. regular user roles for future multi-user features.
- **Multi-device session management** — Allow users to view and revoke active sessions.
