# Mixpanel V2 Page Visit Instrumentation

This note documents the quickest way to enable "V2-*" Mixpanel page-visit events in the second frontend application while reusing the same API keys already present in this workspace. The goal is a minimal integration that reports which high-level page (landing, dashboard, etc.) was viewed, prefixed with `V2-` so results are easy to filter inside Mixpanel.

---

## 1. Existing building blocks in this repo

| File | Purpose | Reuse guidance |
| --- | --- | --- |
| `src/services/analytics.ts` | Centralized wrapper around `mixpanel-browser` that reads `VITE_MIXPANEL_TOKEN(_DEV)` and exposes `init`, `trackEvent`, etc. | Safe to re-use as-is in the new app. It already enables `track_pageview` and `debug` in dev. |
| `src/contexts/AnalyticsContext.tsx` | React Context that initializes Mixpanel once and exposes the analytics service through a hook. | Copy or re-create in the target project to get easy access via `useAnalytics()`. |
| `.env` / `.env.local.example` | Contains `MIXPANEL_TOKEN` and `MIXPANEL_TOKEN_DEV`. In Vite, these map to `VITE_MIXPANEL_TOKEN` variables consumed at build time. | Duplicate the same vars (with identical values) in the second project's env files. |

Because these modules are already decoupled, porting Mixpanel to another Vite-based frontend is straightforward—no additional dependencies beyond `mixpanel-browser` are required.

---

## 2. Minimal plan for V2 page-visit tracking

1. **Install dependency** (if the new project does not already have it):
   ```bash
   pnpm add mixpanel-browser
   ```
2. **Copy the service + context** into the new codebase (keep paths identical or adjust imports accordingly).
3. **Wrap the root tree** with `<AnalyticsProvider>` so the service initializes early.
4. **Emit a V2-prefixed event whenever the route changes.** This is the only custom logic needed for "page visit" analytics beyond the existing auto page view.

Implementation complexity: **low** (≈2 files to copy + one hook in the router). No backend changes or new secrets are necessary.

---

## 3. Route-change hook example

Place this effect inside whatever component already has access to `useLocation()` (in this repo, `AppRouterContent` is a good spot). The same snippet can be lifted into the other application.

```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalytics } from '@/contexts/AnalyticsContext';

const pageEventMap: Record<string, string> = {
  '/': 'V2-Landing Page',
  '/dashboard': 'V2-Dashboard',
  '/faq': 'V2-FAQs',
  '/presale': 'V2-Presale',
  '/lightning': 'V2-Lightning Node',
  '/settings': 'V2-Settings',
};

export function RouterAnalyticsBridge() {
  const location = useLocation();
  const analytics = useAnalytics();

  useEffect(() => {
    const eventName = pageEventMap[location.pathname] ?? `V2-Unknown (${location.pathname})`;
    analytics.trackEvent(eventName, {
      path: location.pathname,
      timestamp: new Date().toISOString(),
    });
  }, [location.pathname, analytics]);

  return null; // This component only performs the side effect
}
```

Then render `<RouterAnalyticsBridge />` anywhere inside the router (e.g., alongside `<Routes />`). This keeps the integration declarative and ensures every navigation emits a Mixpanel event with the requested `V2-*` prefix.

---

## 4. Environment + configuration checklist

- Ensure the new project exposes the same tokens via Vite-compatible names:
  ```env
  VITE_MIXPANEL_TOKEN=39af93120cb2259bcbfa5754c98f8dc4
  VITE_MIXPANEL_TOKEN_DEV=39af93120cb2259bcbfa5754c98f8dc4
  ```
- Confirm `mixpanel.init` runs exactly once (the provided context already handles this via `useEffect`).
- Optional: register a super property such as `{ appVersion: 'V2' }` during init if you want an additional filter besides the event name.

---

## 5. Validation workflow

1. Run the app locally and open DevTools → Network to confirm Mixpanel requests fire on route changes.
2. In Mixpanel, create a simple report filtering on `event name starts with "V2-"` to isolate the new application.
3. Promote the change to staging/production; the same API keys keep all data in the existing Mixpanel project.

---

## 6. Effort & difficulty assessment

- **Estimated engineering time:** ~30–45 minutes (copy service/context, add router hook, verify locally).
- **Risk level:** Low. Changes are isolated to the frontend; no schema or backend dependencies.
- **Scalability:** Additional pages only require entries in `pageEventMap`, keeping maintenance simple.

This document can be dropped directly into the second repository to guide the integration. Copy the code snippets, keep the `V2-` naming convention, and you will start seeing labeled page visits as soon as the build ships.
