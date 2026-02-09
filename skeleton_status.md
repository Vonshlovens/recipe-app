# Skeleton Status

- [x] skeleton_done

## What's included

- **Runtime**: Deno 2.x with `deno.json` tasks
- **Framework**: SvelteKit 2 / Svelte 5 (minimal template)
- **Adapter**: `@deno/svelte-adapter` for Deno Deploy
- **Styling**: Tailwind CSS 4 via `@tailwindcss/vite`
- **UI primitives**: `bits-ui`, `clsx`, `tailwind-merge`, `tailwind-variants` (shadcn-svelte deps)
- **Utility**: `cn()` helper in `src/lib/utils.ts`
- **Directory structure**: `src/lib/server/db/`, `src/lib/server/ai/`, `src/lib/components/ui/`, `tests/`
- **Config**: `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `.env.example`
- **Build verified**: `deno task build` succeeds
- **Dev verified**: `deno task dev` starts successfully
