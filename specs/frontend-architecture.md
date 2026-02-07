# Frontend Architecture

> SvelteKit 2 / Svelte 5 project structure, routing strategy, layout hierarchy, state management patterns, Tailwind 4 setup.

---

## Overview

The recipe app frontend is built with **SvelteKit 2** and **Svelte 5**, styled with **Tailwind CSS 4**, and uses **shadcn-svelte** as the component library. This spec defines the client-side project structure, routing conventions, layout hierarchy, state management approach, and Tailwind configuration that all frontend specs build upon.

---

## Svelte 5 / SvelteKit 2

### Why Svelte 5

- **Runes** — Fine-grained reactivity via `$state`, `$derived`, and `$effect` replaces Svelte 4's implicit reactivity model.
- **Snippets** — Replaces slots with a more composable content-passing mechanism.
- **Performance** — Smaller bundle sizes and faster hydration than Svelte 4.
- **TypeScript integration** — First-class TypeScript support with typed props via `$props()`.

### SvelteKit 2 Conventions

- **File-based routing** — Routes are defined by directory structure under `src/routes/`.
- **Server/client boundary** — `+page.server.ts` for server-only load functions, `+page.ts` for universal load functions.
- **Form actions** — SvelteKit form actions for progressive enhancement on mutations.

---

## Project Structure (Frontend)

```
src/
├── app.html                       # SvelteKit HTML shell
├── app.css                        # Global styles, Tailwind directives
├── hooks.server.ts                # Server hooks (shared with backend)
├── lib/
│   ├── components/
│   │   ├── ui/                    # shadcn-svelte primitives (Button, Input, Card, etc.)
│   │   ├── recipe/                # Recipe-specific components
│   │   │   ├── RecipeCard.svelte
│   │   │   ├── RecipeHeader.svelte
│   │   │   ├── IngredientList.svelte
│   │   │   ├── InstructionSteps.svelte
│   │   │   └── ScalingControl.svelte
│   │   ├── search/                # Search and filter components
│   │   │   ├── SearchBar.svelte
│   │   │   ├── TagFilter.svelte
│   │   │   └── SearchResults.svelte
│   │   ├── layout/                # Shared layout components
│   │   │   ├── Navbar.svelte
│   │   │   ├── Sidebar.svelte
│   │   │   └── Footer.svelte
│   │   └── shared/                # Generic reusable components
│   │       ├── LoadingSpinner.svelte
│   │       ├── EmptyState.svelte
│   │       ├── ErrorBanner.svelte
│   │       └── Pagination.svelte
│   ├── stores/                    # Client-side state (runes-based)
│   │   ├── auth.svelte.ts         # Auth state (current user)
│   │   ├── search.svelte.ts       # Search/filter state
│   │   └── shopping-list.svelte.ts # Shopping list state
│   ├── api/                       # API client functions
│   │   ├── client.ts              # Base fetch wrapper
│   │   ├── recipes.ts             # Recipe API calls
│   │   ├── auth.ts                # Auth API calls
│   │   ├── tags.ts                # Tag API calls
│   │   └── shopping-list.ts       # Shopping list API calls
│   ├── models/                    # Shared types (used by both server and client)
│   ├── utils/                     # Shared utilities
│   └── constants.ts               # Shared constants
├── routes/
│   ├── +layout.svelte             # Root layout (Navbar, global providers)
│   ├── +layout.server.ts          # Root layout server load (auth state)
│   ├── +page.svelte               # Home / landing page
│   ├── +error.svelte              # Global error page
│   ├── recipes/
│   │   ├── +page.svelte           # Recipe list / browse
│   │   ├── +page.server.ts        # Load recipe list
│   │   ├── new/
│   │   │   ├── +page.svelte       # Create recipe form
│   │   │   └── +page.server.ts    # Form action for creation
│   │   ├── import/
│   │   │   ├── +page.svelte       # URL import flow
│   │   │   └── +page.server.ts    # Import server logic
│   │   ├── ocr/
│   │   │   ├── +page.svelte       # OCR capture flow
│   │   │   └── +page.server.ts    # OCR server logic
│   │   └── [slug]/
│   │       ├── +page.svelte       # Recipe detail view
│   │       ├── +page.server.ts    # Load single recipe
│   │       └── edit/
│   │           ├── +page.svelte   # Edit recipe form
│   │           └── +page.server.ts
│   ├── search/
│   │   ├── +page.svelte           # Search results page
│   │   └── +page.server.ts        # Search server load
│   ├── shopping-list/
│   │   ├── +page.svelte           # Shopping list builder
│   │   └── +page.server.ts
│   ├── recommendations/
│   │   ├── +page.svelte           # Recommendation feed
│   │   └── +page.server.ts
│   ├── auth/
│   │   ├── login/
│   │   │   └── +page.svelte       # Login page
│   │   └── register/
│   │       └── +page.svelte       # Registration page
│   └── api/                       # API routes (see backend-architecture.md)
│       └── v1/
└── static/                        # Static assets (favicon, images)
```

### Key Conventions

- **`$lib/components/ui/`** — shadcn-svelte primitives, generated via the `shadcn-svelte` CLI. Never manually edited.
- **`$lib/components/{domain}/`** — Domain-specific composite components built from UI primitives.
- **`$lib/stores/`** — Svelte 5 runes-based state modules (`.svelte.ts` extension for runes outside components).
- **`$lib/api/`** — Thin typed wrappers around `fetch` for calling backend API routes.
- **Route groups** — `(app)` group can be introduced later to separate authenticated from public routes.

---

## Routing Strategy

### Route Map

| Path                     | Purpose                          | Auth Required |
|--------------------------|----------------------------------|---------------|
| `/`                      | Home / landing page              | No            |
| `/recipes`               | Browse all recipes               | No            |
| `/recipes/new`           | Create a new recipe              | Yes           |
| `/recipes/import`        | Import recipe from URL           | Yes           |
| `/recipes/ocr`           | Capture recipe via OCR           | Yes           |
| `/recipes/[slug]`        | View a single recipe             | No            |
| `/recipes/[slug]/edit`   | Edit an existing recipe          | Yes           |
| `/search`                | Full search with tag filters     | No            |
| `/shopping-list`         | Shopping list builder            | Yes           |
| `/recommendations`       | Personalized recommendations     | Yes           |
| `/auth/login`            | Login page                       | No            |
| `/auth/register`         | Registration page                | No            |

### Server-side Data Loading

All pages that display data use `+page.server.ts` load functions to fetch from the internal API layer (calling service/database functions directly, not HTTP). This avoids unnecessary network round-trips.

```typescript
// src/routes/recipes/[slug]/+page.server.ts
import type { PageServerLoad } from './$types';
import { recipeService } from '$lib/server/services/recipe-service';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
  const recipe = await recipeService.getBySlug(params.slug);
  if (!recipe) {
    error(404, 'Recipe not found');
  }
  return { recipe };
};
```

### Auth Guards

Protected routes check `event.locals.user` in their `+page.server.ts` load function and redirect to `/auth/login` if the user is not authenticated:

```typescript
// src/routes/recipes/new/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, '/auth/login');
  }
  return {};
};
```

---

## Layout Hierarchy

### Root Layout (`+layout.svelte`)

The root layout wraps all pages and provides:

- **Navbar** — App title/logo, navigation links, user menu (login/logout).
- **Main content area** — Renders the current page via `{@render children()}`.
- **Footer** — Minimal footer with links.
- **Auth state** — Receives the current user from the root layout server load.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  import Navbar from '$lib/components/layout/Navbar.svelte';
  import Footer from '$lib/components/layout/Footer.svelte';

  let { data, children } = $props();
</script>

<div class="min-h-screen flex flex-col">
  <Navbar user={data.user} />
  <main class="flex-1 container mx-auto px-4 py-6">
    {@render children()}
  </main>
  <Footer />
</div>
```

### Root Layout Server Load

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user ?? null
  };
};
```

### Nested Layouts

Nested layouts can be introduced as needed:

- **`/recipes/+layout.svelte`** — Shared recipe browsing chrome (e.g., sidebar filters).
- **Route groups** — `(auth)` group for login/register pages with a minimal layout (no sidebar).

---

## State Management

### Principles

1. **Server-first** — Data is loaded server-side via `+page.server.ts` and passed as `data` props. No client-side fetching on initial page load.
2. **Runes for client state** — Interactive UI state (form inputs, toggles, search filters) uses Svelte 5 runes (`$state`, `$derived`).
3. **URL as state** — Search queries, filters, pagination, and sort order are stored in URL search params, enabling deep linking and browser navigation.
4. **Minimal global state** — Only auth status and shopping list are global. Everything else is page-scoped or URL-driven.

### Runes-Based Stores

For state that needs to be shared across components or persist across navigation, use `.svelte.ts` modules with runes:

```typescript
// src/lib/stores/auth.svelte.ts

interface User {
  id: string;
  email: string;
  displayName: string;
}

let currentUser = $state<User | null>(null);

export function setUser(user: User | null) {
  currentUser = user;
}

export function getUser() {
  return currentUser;
}
```

### URL-Based State for Search

Search and filter state lives in URL search params, managed through SvelteKit's `goto()` and `$page.url`:

```typescript
// Updating search params triggers a server-side reload
import { goto } from '$app/navigation';
import { page } from '$app/stores';

function applyFilters(tags: string[], sort: string) {
  const url = new URL($page.url);
  url.searchParams.set('tags', tags.join(','));
  url.searchParams.set('sort', sort);
  goto(url.toString(), { replaceState: true });
}
```

### Form State

Form state for recipe creation/editing uses local `$state` within the page component. Form submissions use SvelteKit form actions for progressive enhancement:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let title = $state('');
  let ingredients = $state('');
</script>

<form method="POST" use:enhance>
  <input name="title" bind:value={title} />
  <textarea name="ingredients" bind:value={ingredients}></textarea>
  <button type="submit">Save Recipe</button>
</form>
```

---

## Tailwind CSS 4 Setup

### Configuration

Tailwind CSS 4 uses a CSS-first configuration approach. All configuration lives in the main CSS file:

```css
/* src/app.css */
@import 'tailwindcss';

@theme {
  /* Color palette */
  --color-primary: #2563eb;
  --color-primary-foreground: #ffffff;
  --color-secondary: #64748b;
  --color-secondary-foreground: #ffffff;
  --color-accent: #f59e0b;
  --color-accent-foreground: #1a1a1a;

  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-muted: #f1f5f9;
  --color-muted-foreground: #64748b;
  --color-border: #e2e8f0;

  --color-destructive: #ef4444;
  --color-destructive-foreground: #ffffff;

  /* Typography */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* Dark mode overrides */
@theme dark {
  --color-primary: #3b82f6;
  --color-primary-foreground: #ffffff;

  --color-background: #0f172a;
  --color-foreground: #e2e8f0;
  --color-muted: #1e293b;
  --color-muted-foreground: #94a3b8;
  --color-border: #334155;
}
```

### Dark Mode

Dark mode is supported via the `class` strategy. A `dark` class on the `<html>` element toggles the theme. The user's preference is:

1. Read from `localStorage` on initial load.
2. Falls back to `prefers-color-scheme` media query.
3. Persisted to `localStorage` on toggle.

```typescript
// src/lib/utils/theme.ts
export function getTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('theme', theme);
}
```

### Responsive Breakpoints

Standard Tailwind breakpoints are used:

| Breakpoint | Min Width | Target              |
|------------|-----------|---------------------|
| `sm`       | 640px     | Large phones        |
| `md`       | 768px     | Tablets             |
| `lg`       | 1024px    | Small laptops       |
| `xl`       | 1280px    | Desktops            |

---

## shadcn-svelte Component Library

### Setup

shadcn-svelte components are installed into `$lib/components/ui/` using the CLI:

```bash
npx shadcn-svelte@latest init
npx shadcn-svelte@latest add button card input label textarea select dialog
```

### Component Inventory (Initial)

The following shadcn-svelte components are needed for the initial feature set:

| Component      | Usage                                           |
|----------------|-------------------------------------------------|
| `Button`       | Actions, form submissions, navigation           |
| `Card`         | Recipe cards, content containers                 |
| `Input`        | Text inputs, search bar                         |
| `Label`        | Form field labels                               |
| `Textarea`     | Markdown editing, ingredient lists              |
| `Select`       | Sort order, difficulty filter, unit selection    |
| `Dialog`       | Confirmations, OCR attestation modal            |
| `Badge`        | Tags, difficulty indicators                     |
| `Separator`    | Section dividers                                |
| `Skeleton`     | Loading placeholders                            |
| `Toast`        | Success/error notifications                     |
| `DropdownMenu` | User menu, recipe actions                       |

### Customization

shadcn-svelte components are source-installed (not an npm package), so they can be customized directly. The design tokens defined in `app.css` (via `@theme`) feed into the component styles.

---

## API Client Layer

### Base Client

A thin fetch wrapper provides typed API access with automatic error handling:

```typescript
// src/lib/api/client.ts

interface ApiResponse<T> {
  data: T;
  meta?: { pagination?: Pagination };
}

interface ApiError {
  error: { code: string; message: string; details?: unknown[] };
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`/api/v1${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new ApiClientError(error.error.code, error.error.message, response.status);
  }

  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) =>
    request<void>(path, { method: 'DELETE' }),
};
```

### Domain-Specific API Modules

```typescript
// src/lib/api/recipes.ts
import { api } from './client';
import type { Recipe, RecipeSummary } from '$lib/models/recipe';

export const recipesApi = {
  list: (params: { page?: number; sort?: string }) =>
    api.get<RecipeSummary[]>(`/recipes?${new URLSearchParams(params as Record<string, string>)}`),

  get: (slug: string) =>
    api.get<Recipe>(`/recipes/${slug}`),

  create: (data: CreateRecipeInput) =>
    api.post<Recipe>('/recipes', data),

  importFromUrl: (url: string) =>
    api.post<ImportDraft>('/recipes/import', { url }),
};
```

---

## Loading and Error States

### Loading

- **Initial page load** — Data loads server-side; no client-side loading spinner needed.
- **Client-side navigation** — SvelteKit shows a progress bar (configurable via `+layout.svelte`).
- **Async operations** (import, OCR) — Show inline loading spinners with status text.
- **Skeleton placeholders** — Use shadcn `Skeleton` components for content that loads incrementally.

### Error Handling

- **`+error.svelte`** — Global error page for unrecoverable errors (404, 500).
- **Inline errors** — Form validation errors displayed next to fields.
- **Toast notifications** — Success/error feedback for async actions (save, delete, import).
- **Error boundaries** — Per-route `+error.svelte` files for route-specific error handling when needed.

```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="flex flex-col items-center justify-center min-h-[50vh]">
  <h1 class="text-4xl font-bold">{$page.status}</h1>
  <p class="text-muted-foreground mt-2">{$page.error?.message ?? 'Something went wrong'}</p>
  <a href="/" class="mt-4 text-primary hover:underline">Go home</a>
</div>
```

---

## Accessibility

### Conventions

- **Semantic HTML** — Use `<nav>`, `<main>`, `<article>`, `<section>`, `<button>` (not styled divs).
- **ARIA attributes** — Applied by shadcn-svelte components by default; add `aria-label` to custom interactive elements.
- **Keyboard navigation** — All interactive elements are focusable and operable via keyboard.
- **Focus management** — Manage focus on route transitions and modal open/close.
- **Color contrast** — All text meets WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text).
- **Reduced motion** — Respect `prefers-reduced-motion` via Tailwind's `motion-safe:` / `motion-reduce:` variants.

---

## Performance

### Strategies

- **Server-side rendering** — All pages are SSR'd by default for fast initial paint and SEO.
- **Code splitting** — SvelteKit automatically code-splits per route.
- **Image optimization** — Use `<enhanced:img>` from `@sveltejs/enhanced-img` for responsive images with lazy loading.
- **Prefetching** — SvelteKit's `data-sveltekit-preload-data="hover"` on links for instant navigation.
- **Minimal JavaScript** — Svelte 5's compiled output is significantly smaller than virtual-DOM frameworks.
