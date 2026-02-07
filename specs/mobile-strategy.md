# Mobile Strategy

> Approach (PWA vs native wrapper vs responsive-only), offline support, camera access for OCR, mobile-specific UX considerations.

---

## Overview

The mobile strategy defines how the recipe app delivers a high-quality experience on phones and tablets. Rather than building a native app, we adopt a **Progressive Web App (PWA)** approach on top of the existing responsive SvelteKit frontend. This gives us installability, offline access, and camera integration without a separate codebase.

This spec builds on:
- [frontend-architecture.md](./frontend-architecture.md) — SvelteKit routing, layout, Tailwind 4 responsive design
- [ocr-flow.md](./ocr-flow.md) — camera capture for OCR
- [shopping-list-ui.md](./shopping-list-ui.md) — offline-friendly shopping list use case
- [ui-components.md](./ui-components.md) — responsive component contracts

---

## Approach: Progressive Web App (PWA)

### Decision

| Option            | Pros                                          | Cons                                          |
|-------------------|-----------------------------------------------|-----------------------------------------------|
| Responsive-only   | Zero extra work                               | No install, no offline, no push notifications |
| PWA               | Installable, offline, camera, single codebase | Limited iOS capabilities, no app store        |
| Native wrapper    | Full native APIs, app store presence           | Separate codebase, build tooling, maintenance |

**Choice: PWA.** It covers the core mobile needs (offline shopping lists, camera OCR, home screen install) with minimal additional infrastructure beyond what SvelteKit already provides.

### PWA Manifest

File: `static/manifest.json`

```json
{
  "name": "Recipe App",
  "short_name": "Recipes",
  "description": "Collect, organize, and cook your recipes",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#16a34a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Service Worker

Use `@vite-pwa/sveltekit` for service worker generation.

#### Caching Strategy

| Resource                  | Strategy         | Max Age   |
|---------------------------|------------------|-----------|
| App shell (HTML/CSS/JS)   | Precache         | Build     |
| API responses (recipes)   | Network-first    | 24 hours  |
| Recipe images             | Cache-first      | 7 days    |
| Fonts / static assets     | Cache-first      | 30 days   |

#### Precached Assets

- All SvelteKit-generated chunks
- App shell HTML
- Icon set
- Fallback offline page

---

## Offline Support

### Offline-Capable Pages

| Page                  | Offline Behavior                                     |
|-----------------------|------------------------------------------------------|
| Recipe viewer         | Serve cached recipe if previously viewed             |
| Shopping list         | Fully functional from cached list state              |
| Recipe list / search  | Show cached results with "offline" banner            |
| Recipe editor         | Queue save; sync when back online                    |
| Import / OCR          | Not available offline (requires server)              |

### Shopping List Offline

The shopping list is the primary offline use case (users check items at the grocery store).

- Persist the current shopping list to IndexedDB after generation
- Check-off state stored locally in IndexedDB
- Full functionality without network
- Sync check state back to server on reconnect (optional future enhancement)

### Offline Indicator

- Show a dismissible banner when `navigator.onLine === false`
- Banner text: "You're offline. Some features may be limited."
- Hide automatically on reconnect
- Use `online` and `offline` window events

### Background Sync

- When a recipe save fails due to network, queue the request in IndexedDB
- On reconnect, replay queued requests using the Background Sync API
- Show a toast: "Synced 1 recipe saved while offline"
- Limit queue to 10 pending operations

---

## Camera Access for OCR

### Implementation

Camera access for OCR uses the HTML `<input>` element with `capture` attribute, already specified in [ocr-flow.md](./ocr-flow.md).

```html
<input type="file" accept="image/*" capture="environment" />
```

### Mobile-Specific Considerations

- **iOS Safari**: `capture="environment"` opens the rear camera directly
- **Android Chrome**: Offers a chooser between camera and gallery
- **Fallback**: If `capture` is unsupported, the standard file picker still works
- **Permissions**: Camera permission is handled by the browser natively; no additional API calls needed
- **HEIC Support**: iOS photos may be HEIC format; the OCR pipeline already handles this per [ocr-pipeline.md](./ocr-pipeline.md)

---

## Mobile-Specific UX

### Touch Targets

- Minimum touch target: 44×44 CSS pixels (per WCAG 2.5.8)
- Spacing between interactive elements: minimum 8px
- Checkbox and radio inputs: use custom styled targets at 44px minimum

### Responsive Breakpoints

Defined in [frontend-architecture.md](./frontend-architecture.md), reiterated here for mobile context:

| Breakpoint | Width       | Layout            |
|------------|-------------|-------------------|
| Mobile     | < 768px     | Single column     |
| Tablet     | 768–1023px  | Two columns       |
| Desktop    | ≥ 1024px    | Multi-column      |

### Navigation

- Hamburger menu on mobile (< 768px) per [ui-components.md](./ui-components.md)
- Bottom navigation bar for primary actions (Recipes, Search, Shopping List, OCR)
- Bottom nav is fixed, 56px height, with icon + label for each item
- Active route highlighted with primary color

### Bottom Navigation Bar

```
┌──────────────────────────────────────────┐
│  🏠 Recipes  🔍 Search  🛒 List  📷 OCR │
└──────────────────────────────────────────┘
```

- Visible only on mobile (< 768px)
- Replaces hamburger menu for primary navigation on smallest screens
- Uses `position: fixed; bottom: 0` with safe area inset padding for notched devices:
  ```css
  padding-bottom: env(safe-area-inset-bottom);
  ```

### Gestures

- No custom gesture handlers in v1
- Rely on native scroll and browser back gesture
- Future consideration: swipe between recipe steps

### Viewport and Scaling

In `app.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

### Safe Areas

Handle notched devices (iPhone, etc.) with CSS `env()`:
```css
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
.page-content {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

---

## Install Prompt

### A2HS (Add to Home Screen)

- Listen for the `beforeinstallprompt` event
- Show a custom install banner after the user has visited 3+ pages in a session
- Banner: "Install Recipe App for quick access and offline use" with Install and Dismiss buttons
- Persist dismissal in `localStorage` for 30 days
- On iOS (no `beforeinstallprompt`), show a manual instruction tooltip: "Tap Share → Add to Home Screen"

---

## Performance Budget

| Metric                     | Target        |
|----------------------------|---------------|
| First Contentful Paint     | < 1.5s (3G)  |
| Largest Contentful Paint   | < 2.5s (3G)  |
| Total JS bundle (initial)  | < 150 KB gz   |
| Time to Interactive        | < 3.5s (3G)  |

### Optimization Strategies

- SvelteKit's built-in code splitting per route
- Lazy-load images with `loading="lazy"` and `decoding="async"`
- Use `srcset` with responsive image sizes (320w, 640w, 960w)
- Inline critical CSS via SvelteKit's SSR
- Defer non-critical JS (e.g., install prompt, analytics)

---

## Testing

### Device Testing Matrix

| Device Category  | Representative Targets                      |
|------------------|---------------------------------------------|
| iOS Phone        | iPhone 13+ (Safari)                         |
| iOS Tablet       | iPad Air (Safari)                           |
| Android Phone    | Pixel 7 / Samsung Galaxy S23 (Chrome)       |
| Android Tablet   | Samsung Galaxy Tab (Chrome)                 |

### Test Cases

- PWA install flow on Android Chrome and iOS Safari
- Offline recipe viewing after caching
- Offline shopping list check-off
- Camera capture for OCR on iOS and Android
- Bottom navigation routing
- Touch target sizing compliance
- Safe area rendering on notched devices
- Background sync after offline save
- Performance budget compliance via Lighthouse

---

## Non-Goals (v1)

- Push notifications
- Native app store distribution
- Offline recipe creation (queued save covers basic case)
- Cross-device sync of shopping list check state
- Biometric authentication
