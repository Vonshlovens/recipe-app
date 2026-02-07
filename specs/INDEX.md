# Recipe App — Spec Index

All specs listed below are **not yet implemented**. Each entry represents a `.md` file that should be created in this `specs/` directory.

## Tech Stack

- **Runtime:** Deno
- **Framework:** SvelteKit 2 / Svelte 5
- **Styling:** Tailwind CSS 4
- **Component Library:** shadcn-svelte

---

## Technical Specs

### Backend

- [x] `specs/backend-architecture.md` — Runtime setup (Deno), project structure, API layer design, middleware, error handling conventions
- [x] `specs/database.md` — Database choice, schema design, migrations strategy, indexing for tag-based queries
- [x] `specs/api-routes.md` — REST/RPC endpoint definitions, request/response shapes, auth requirements per route
- [x] `specs/auth.md` — Authentication and authorization strategy, session management, user accounts
- [x] `specs/recipe-data-model.md` — Canonical recipe schema, YAML frontmatter spec, markdown body format, tag taxonomy, validation rules
- [x] `specs/search-and-query.md` — Tag-based query engine, filtering logic (AND/OR/NOT), full-text search, sorting, pagination
- [x] `specs/recipe-import.md` — Website recipe import pipeline: URL parsing, structured data extraction (JSON-LD, microdata), fallback scraping, normalization to internal format
- [x] `specs/ocr-pipeline.md` — Image upload, OCR processing (engine choice), text extraction, recipe parsing from raw OCR output, rights attestation flow
- [x] `specs/recommendation-engine.md` — Recommendation approach (content-based, collaborative, hybrid), input signals (collection, preferences, query), ranking, cold-start handling
- [x] `specs/shopping-list-engine.md` — Ingredient parsing and normalization, unit conversion, recipe scaling math, multi-recipe aggregation, deduplication logic

### Frontend

- [x] `specs/frontend-architecture.md` — SvelteKit 2 / Svelte 5 project structure, routing strategy, layout hierarchy, state management patterns, Tailwind 4 setup
- [x] `specs/ui-components.md` — Component inventory, design system tokens, shared component API contracts
- [x] `specs/recipe-editor.md` — Markdown + YAML frontmatter editing UX, tag input, live preview, validation feedback
- [x] `specs/recipe-viewer.md` — Recipe display, scaling controls, ingredient list rendering, print/share view
- [x] `specs/search-ui.md` — Tag-based search interface, filter controls, results display, empty/loading/error states
- [x] `specs/import-flow.md` — URL import UI, progress/status feedback, review and edit before save
- [x] `specs/ocr-flow.md` — Image upload UI, camera capture option, OCR progress, rights attestation modal, review and edit before save
- [x] `specs/shopping-list-ui.md` — Shopping list builder, recipe selection, scaling per recipe, combined list view, check-off interaction
- [x] `specs/recommendations-ui.md` — Recommendation feed, preference controls, "what are you looking for?" input

### Mobile

- [x] `specs/mobile-strategy.md` — Approach (PWA vs native wrapper vs responsive-only), offline support, camera access for OCR, mobile-specific UX considerations

### Cross-Cutting

- [x] `specs/deployment.md` — Hosting, CI/CD, environment config, Deno Deploy or alternative
- [x] `specs/testing-strategy.md` — Unit, integration, E2E approach and tooling for Deno + SvelteKit
- [x] `specs/error-handling.md` — Global error handling patterns (client + server), user-facing error messages, logging

---

## Feature Specs

- [x] `specs/feature-tag-query.md` — Full feature spec for tag-based recipe querying: user stories, acceptance criteria, edge cases
- [ ] `specs/feature-recipe-import.md` — Full feature spec for importing recipes from URLs: supported sites, failure modes, user flow
- [ ] `specs/feature-ocr-capture.md` — Full feature spec for OCR recipe capture: image requirements, attestation copy, accuracy expectations, edit flow
- [ ] `specs/feature-recommendations.md` — Full feature spec for recipe recommendations: personalization inputs, display, refresh behavior
- [ ] `specs/feature-shopping-list.md` — Full feature spec for shopping lists: scaling, multi-recipe merge, ingredient grouping, export options
