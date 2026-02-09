# Tech Stack

> Authoritative technology decisions for the recipe app. This spec supersedes any conflicting technology choices in other spec files.

---

## Summary

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Deno 2.x | TypeScript-first, native tooling, `npm:` compat |
| Framework | SvelteKit 2 / Svelte 5 | File-based routing, SSR, runes for reactivity |
| UI Components | shadcn-svelte | Accessible primitives, copy-paste ownership |
| Styling | Tailwind CSS 4 | CSS-first configuration, utility classes |
| ORM | Drizzle ORM | Type-safe queries, schema-as-code, Postgres adapter |
| Database | PostgreSQL via Neon | Serverless Postgres, free tier, branching for dev |
| Auth | Better Auth | Email/password, DB sessions, Drizzle adapter, SvelteKit integration |
| Image Storage | Cloudflare R2 | S3-compatible, no egress fees, OCR uploads + avatars |
| AI Services | Azure AI Foundry | Multi-model access, custom abstractions, no framework |
| Caching | Deferred (Upstash Redis) | Not in v1; add when needed via HTTP-based Redis |
| Testing | Vitest | Fast, SvelteKit ecosystem support, `@testing-library/svelte` |
| Deployment | Deno Deploy | Auto-deploy from GitHub, edge distribution, zero config |
| CI/CD | Deno Deploy auto-deploy | GitHub integration, builds on push to main |

---

## Runtime: Deno

Deno 2.x is the application runtime. It provides:

- Native TypeScript execution (no build step for server code)
- Built-in formatter (`deno fmt`), linter (`deno lint`), and task runner (`deno task`)
- `npm:` specifiers for Node package compatibility (SvelteKit, Drizzle, Better Auth, etc.)
- Permission model for production hardening (`--allow-net`, `--allow-env`, etc.)

### Configuration

```jsonc
// deno.json
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
    "lint": "deno lint",
    "fmt": "deno fmt",
    "test": "deno run -A npm:vitest run",
    "test:watch": "deno run -A npm:vitest",
    "db:generate": "deno run -A npm:drizzle-kit generate",
    "db:migrate": "deno run -A npm:drizzle-kit migrate",
    "db:studio": "deno run -A npm:drizzle-kit studio"
  },
  "imports": {
    "$lib": "./src/lib",
    "$lib/*": "./src/lib/*"
  },
  "nodeModulesDir": "auto"
}
```

---

## Framework: SvelteKit 2 + Svelte 5

SvelteKit provides the full-stack application framework:

- File-based routing (`src/routes/`)
- Server-side rendering with `+page.server.ts` load functions
- API routes via `+server.ts` exports
- `$lib/server/` boundary enforces server-only code isolation
- Svelte 5 runes (`$state`, `$derived`, `$effect`) for fine-grained reactivity

### Adapter

```ts
// svelte.config.js
import adapter from 'svelte-adapter-deno';

export default {
  kit: {
    adapter: adapter({ out: 'build' }),
  },
};
```

---

## Database: PostgreSQL via Neon

### Why Postgres (not SQLite)

The original specs chose SQLite for single-user simplicity. With a multi-user app, Postgres is the better fit:

- Native concurrent write support for multiple users
- Mature full-text search (`tsvector`, `ts_rank`, `ts_headline`)
- Proven at scale with managed hosting
- Developer familiarity (production experience)

### Why Neon

- **Serverless Postgres** — scales to zero on inactivity, cost-effective for side projects
- **Free tier** — 0.5 GB storage, 190 compute hours/month
- **Branching** — create isolated database branches for dev/preview environments
- **Edge-compatible** — HTTP-based driver works from Deno Deploy (no TCP required)

### Connection

Neon provides two connection methods:

1. **HTTP driver** (`@neondatabase/serverless`) — works on Deno Deploy's edge runtime, one query per request
2. **WebSocket driver** — connection pooling, better for multiple queries per request

For Deno Deploy, use the HTTP driver via Drizzle's `neon-http` adapter.

---

## ORM: Drizzle

Drizzle provides type-safe database access with schema-as-code:

- Schema defined in TypeScript, generates SQL migrations
- Query builder and relational queries
- Neon HTTP adapter for serverless Postgres
- No runtime overhead (queries compile to parameterized SQL)

### Schema Location

```
src/lib/server/db/
  schema.ts          # Drizzle schema definitions (all tables)
  index.ts           # Database client singleton
  migrations/        # Generated SQL migrations (via drizzle-kit)
```

### Schema Approach

All tables (recipes, users, sessions, tags, collections, meal plans, etc.) are defined in Drizzle's TypeScript schema format. Drizzle-kit generates and runs migrations.

### Full-Text Search

PostgreSQL's built-in FTS replaces SQLite's FTS5:

- `tsvector` column on the `recipes` table for pre-computed search vectors
- GIN index for fast full-text lookups
- `ts_rank` for BM25-equivalent relevance ranking
- `ts_headline` for search result snippets

Drizzle supports raw SQL expressions for FTS operations where the query builder doesn't cover them.

---

## Auth: Better Auth

Better Auth replaces the custom session cookie implementation from the original specs. It provides:

- Email/password authentication out of the box
- Server-side database sessions (not JWT)
- Drizzle adapter for session and user storage
- SvelteKit integration via server hooks
- OAuth provider support (Google, GitHub) available when needed
- Automatic CSRF protection
- Rate limiting on auth endpoints

### Integration Points

- **Server hook:** Better Auth handles session validation in `hooks.server.ts`
- **Database:** Sessions and users stored in Postgres via Drizzle adapter
- **Client:** Better Auth client for login/register/logout API calls
- **Route protection:** Middleware/helper to require auth on write endpoints

### What Changes from Original Auth Spec

| Original Spec | Better Auth |
|---|---|
| Custom bcrypt hashing | Better Auth handles password hashing |
| Manual session token generation | Better Auth manages session lifecycle |
| Custom `requireAuth` helper | Better Auth middleware / session helpers |
| Manual cookie management | Better Auth manages cookies |
| Custom rate limiting (deferred) | Better Auth includes rate limiting |

The authorization rules (public reads, authenticated writes) remain the same.

---

## Image Storage: Cloudflare R2

R2 stores user-uploaded images:

- **OCR uploads** — photos of printed/handwritten recipes for AI processing
- **Recipe images** — optional hero images for recipes
- **Avatars** — user profile pictures

### Why R2

- S3-compatible API (familiar tooling, easy to migrate)
- No egress fees (images served directly or via Cloudflare CDN)
- Free tier: 10 GB storage, 10M class B operations/month
- Works from any deployment target (Deno Deploy, ACA, etc.)

### Access Pattern

- **Upload:** Server-side presigned URLs or direct upload from API routes
- **Serve:** Public bucket with Cloudflare CDN, or presigned read URLs for private assets
- **Cleanup:** Delete associated objects when recipes/users are deleted

---

## AI Services: Azure AI Foundry

Azure AI Foundry provides access to multiple AI models for:

- **OCR** — Extract text from recipe images (using vision-capable models)
- **Recipe parsing** — Structure extracted OCR text into recipe format
- **Recommendations** — Content-based filtering with AI-assisted similarity (future enhancement)

### Architecture

No heavy agentic framework. Custom abstractions:

```
src/lib/server/ai/
  client.ts           # Base client / provider abstraction
  ocr.ts              # OCR text extraction
  recipe-parser.ts    # Parse raw text into structured recipe
  types.ts            # Shared AI service types
```

The abstraction layer allows swapping model providers per capability (e.g., use one model for vision/OCR, another for text processing) without changing calling code.

---

## Caching: Deferred

Redis caching is not included in v1. When needed:

- **Provider:** Upstash Redis (HTTP-based, works on Deno Deploy's edge runtime)
- **Use cases:** Recipe query caching, recommendation results, rate limiting
- **Client:** `@upstash/redis` (HTTP client, no TCP connection required)

For v1, rely on:
- Neon's connection caching
- SvelteKit's built-in `Cache-Control` headers for static assets
- Client-side caching via service worker (PWA)

---

## Testing: Vitest

Vitest replaces `deno test` for better SvelteKit ecosystem integration:

- `@testing-library/svelte` for component testing
- SvelteKit's `@sveltejs/kit/testing` utilities
- Fast HMR-based watch mode
- Compatible with Deno via `deno run -A npm:vitest`

### Test Structure

```
tests/
  unit/              # Pure function and utility tests
  integration/       # API route and database tests
  components/        # Svelte component tests
```

### Test Database

Integration tests use a Neon branch (or a local Postgres via Docker) to avoid polluting the development database.

---

## Deployment: Deno Deploy

### Auto-Deploy

Deno Deploy's GitHub integration handles CI/CD:

- **Trigger:** Push to `main` branch
- **Build:** Deno Deploy builds the SvelteKit app using the `svelte-adapter-deno` output
- **Preview:** Pull requests get automatic preview deployments
- **Rollback:** Instant rollback to previous deployment via dashboard

### No Separate CI Pipeline

With Deno Deploy auto-deploy, there is no GitHub Actions workflow. Linting, type checking, and tests should be run locally or via pre-commit hooks before merging.

If automated checks before deploy become necessary, a lightweight GitHub Actions workflow can be added later for lint + test gates on PRs.

### Environment Variables

Set via the Deno Deploy dashboard:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `BETTER_AUTH_SECRET` | Secret for Better Auth session signing |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `AZURE_AI_ENDPOINT` | Azure AI Foundry endpoint URL |
| `AZURE_AI_API_KEY` | Azure AI Foundry API key |
| `PUBLIC_BASE_URL` | Public-facing app URL |

### Database Migrations

Drizzle-kit migrations run as a manual step before deploying breaking schema changes:

```bash
DATABASE_URL=<production-url> deno task db:migrate
```

For non-breaking migrations (additive columns, new tables), migrations can be run at any time.

---

## Specs That Need Updating

The following existing specs reference SQLite, `deno test`, custom auth, or Deno Deploy CI/CD and should be updated to reflect this tech stack:

| Spec | What Changes |
|---|---|
| `database.md` | SQLite → Postgres + Neon, raw SQL → Drizzle schema, FTS5 → tsvector, migration runner → drizzle-kit |
| `auth.md` | Custom session implementation → Better Auth, bcrypt → Better Auth's password handling |
| `backend-architecture.md` | `deno:sqlite` references removed, Drizzle connection setup, Better Auth hooks |
| `deployment.md` | GitHub Actions CI/CD → Deno Deploy auto-deploy, env vars updated |
| `testing-strategy.md` | `deno test` → Vitest, test database strategy |
| `search-and-query.md` | FTS5 queries → Postgres `tsvector` / `ts_rank` queries |
| `ocr-pipeline.md` | Add Azure AI Foundry as the OCR provider |
| `frontend-architecture.md` | No major changes (SvelteKit + shadcn-svelte + Tailwind unchanged) |
| `INDEX.md` | Update tech stack summary |
