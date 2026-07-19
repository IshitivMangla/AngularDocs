# Angular: SSR & Hydration

> **Goal**: Understand Server-Side Rendering (SSR) in Angular — why it exists, how hydration works, and how to write SSR-safe code that works in both Node.js and browser environments.

---

## 📋 Table of Contents
1. [CSR vs SSR — Core Difference](#1-csr-vs-ssr)
2. [How Angular SSR Works](#2-how-angular-ssr-works)
3. [What is Hydration?](#3-what-is-hydration)
4. [Setting Up SSR](#4-setting-up-ssr)
5. [Writing SSR-Safe Code](#5-writing-ssr-safe-code)
6. [HTTP in SSR: The Transfer State Problem](#6-http-in-ssr)
7. [Partial Hydration with `@defer`](#7-partial-hydration)
8. [SSR Performance Metrics](#8-ssr-performance-metrics)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. CSR vs SSR

| | Client-Side Rendering (CSR) | Server-Side Rendering (SSR) |
|---|---|---|
| **Initial HTML** | Empty `<app-root></app-root>` | Full HTML with content |
| **First Content** | After JS parses & executes (2-5s) | Instant (HTML arrives from server) |
| **SEO** | Difficult — bots see empty page | Excellent — bots see full content |
| **Performance** | Large JS bundle must load first | First paint is nearly instant |
| **Complexity** | Simple | Must write SSR-safe code |
| **Server** | Static file hosting | Node.js server required |

```
CSR Flow:
User requests / → Server sends index.html (empty) → Browser downloads main.js (2MB) → Angular bootstraps → UI renders
                                    ↑ User sees white screen here ↑

SSR Flow:
User requests / → Angular Universal on Node.js runs the app → Server sends full HTML → Browser shows content immediately
                → Browser downloads main.js → Angular hydrates the HTML → Interactive
                  ↑ User sees content here ↑ ← 2-5 seconds earlier!
```

---

## 2. How Angular SSR Works

1. A **Node.js server** (Express.js) runs your Angular app
2. Angular renders the app into an HTML string using the **Platform Server**
3. The HTML string is sent to the browser — user sees content immediately
4. JavaScript files download in the background
5. Angular **hydrates** the static HTML (attaches event listeners)
6. The page becomes interactive

```typescript
// server.ts — the Node.js/Express server that drives SSR
import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { AppServerModule } from './src/main.server';
import bootstrap from './src/main.server';

const app = express();
const commonEngine = new CommonEngine();

// Serve static files
app.get('*.*', express.static('dist/browser'));

// SSR handler — Angular renders the page for every non-file request
app.get('*', async (req, res, next) => {
  try {
    const html = await commonEngine.render({
      bootstrap,
      documentFilePath: 'dist/browser/index.html',
      url: `${req.protocol}://${req.headers.host}/${req.url}`,
      publicPath: 'dist/browser',
      providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }],
    });
    res.send(html);
  } catch (err) {
    next(err);
  }
});
```

---

## 3. What is Hydration?

Before Angular v16, SSR would:
1. Server sends full HTML → user sees content ✅
2. Angular downloads and runs → **destroys the HTML and rebuilds everything** → flicker, layout shift ❌

**Hydration** (Angular v16+) means:
1. Server sends full HTML → user sees content ✅
2. Angular downloads and runs → **reuses the existing DOM**, only attaches event listeners ✅

```typescript
// app.config.ts — enable hydration (required for SSR)
import { provideClientHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),  // ← Required for Angular SSR hydration!
  ]
};
```

---

## 4. Setting Up SSR

```bash
# Add SSR to an existing Angular project
ng add @angular/ssr

# Create a new project with SSR from the start
ng new my-app --ssr
```

This generates:
- `server.ts` — Express server entry point
- `src/app/app.config.server.ts` — Server-specific providers
- `src/main.server.ts` — Server bootstrap module

---

## 5. Writing SSR-Safe Code

In SSR, your code runs in **Node.js**. Node.js has NO browser APIs:

```
❌ window           ❌ document         ❌ localStorage
❌ navigator        ❌ location          ❌ history
❌ HTMLElement      ❌ canvas.getContext ❌ CSS media queries
```

Accessing any of these on the server will crash the Node.js process!

### Method 1: `afterNextRender()` — Safest Approach (Angular 17+)

```typescript
import { Component, afterNextRender, signal } from '@angular/core';

@Component({
  selector: 'app-analytics',
  standalone: true,
  template: `<canvas #chart></canvas>`
})
export class AnalyticsComponent {
  constructor() {
    // This code NEVER runs on the server — only in the browser after first render!
    afterNextRender(() => {
      // Safe to use: localStorage, document, window, canvas, third-party libraries
      const savedPreference = localStorage.getItem('chartType') ?? 'bar';

      const canvas = document.querySelector('canvas');
      // Initialize Chart.js here...
    });
  }
}
```

### Method 2: `isPlatformBrowser()` — For Services

```typescript
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly isServer = isPlatformServer(this.platformId);

  get(key: string): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(key);
  }

  set(key: string, value: string): void {
    if (!this.isBrowser) return;  // Silently skip on server
    localStorage.setItem(key, value);
  }

  // Reading cookies — works on both server and browser
  getCookie(name: string): string | undefined {
    if (this.isBrowser) {
      return document.cookie.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
    }
    // On server, cookies come from the request — use REQUEST injection token
    return undefined;
  }
}
```

### Method 3: `@if` the Dangerous Code Out

```typescript
@Component({
  standalone: true,
  template: `
    @if (isBrowser) {
      <!-- This component uses browser-only APIs -->
      <app-3d-viewer [model]="modelUrl()"></app-3d-viewer>
    } @else {
      <!-- Render a static image on the server instead -->
      <img [src]="thumbnailUrl()" [alt]="productName()">
    }
  `
})
export class ProductViewComponent {
  private platformId = inject(PLATFORM_ID);
  isBrowser = isPlatformBrowser(this.platformId);
}
```

---

## 6. HTTP in SSR

**The Transfer State Problem**: Without transfer state, a request that runs on the server will ALSO run in the browser after hydration, sending the same HTTP request twice!

```
Without Transfer State:
1. Server fetches /api/products → renders HTML with 50 products ← sent to browser
2. Browser receives HTML, shows 50 products (fast!)
3. Browser hydrates → Angular bootstraps → ngOnInit fires → fetches /api/products AGAIN! ← Wasted request!

With Transfer State:
1. Server fetches /api/products → renders HTML → STORES result in hidden script tag
2. Browser receives HTML, shows 50 products (fast!)
3. Browser hydrates → Angular reads stored result from script tag → no second HTTP call!
```

```typescript
// Angular automatically handles this with provideHttpClient(withFetch())!
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch()  // Required for SSR! Uses fetch API compatible with both Node and browser
    ),
    provideClientHydration()  // Automatically enables HttpTransferCache!
  ]
};
```

With these two providers, `HttpClient` requests made during SSR are automatically cached and reused in the browser — zero double-fetching!

---

## 7. Partial Hydration

`@defer` and SSR work together: SSR renders the `@placeholder` on the server, and the actual component is loaded lazily in the browser.

```html
<!-- Server renders the placeholder immediately (fast first paint!) -->
<!-- Browser lazy-loads the heavy chart component when needed -->
@defer (on viewport) {
  <app-analytics-chart></app-analytics-chart>
} @placeholder {
  <!-- This is what the server renders and what the user sees instantly! -->
  <div class="chart-placeholder" style="min-height: 400px">
    <img src="/assets/chart-preview.jpg" alt="Analytics chart loading...">
  </div>
}
```

---

## 8. SSR Performance Metrics

SSR primarily improves:

| Metric | Description | Impact of SSR |
|---|---|---|
| **FCP** (First Contentful Paint) | Time until first content appears | ⬇️ Dramatically reduced |
| **LCP** (Largest Contentful Paint) | Time until main content renders | ⬇️ Significantly reduced |
| **TTI** (Time to Interactive) | Time until page responds to clicks | Similar (hydration still needed) |
| **SEO Score** | Search engine indexability | ⬆️ Dramatically improved |
| **Core Web Vitals** | Google's ranking signals | ⬆️ Improved (LCP, CLS) |

---

## 9. Common Pitfalls

### Pitfall 1: Using `window`, `document`, `localStorage` directly

```typescript
// ❌ Crashes the Node.js server!
ngOnInit() {
  document.title = 'My Page';   // ReferenceError: document is not defined
  localStorage.getItem('user'); // ReferenceError: localStorage is not defined
}

// ✅ Use afterNextRender() or isPlatformBrowser()
constructor() {
  afterNextRender(() => {
    document.title = 'My Page';
    localStorage.getItem('user');
  });
}
```

### Pitfall 2: `setInterval` in `ngOnInit` on the server

```typescript
// ❌ The interval runs on the server and never completes — server hangs!
ngOnInit() {
  setInterval(() => this.updateClock(), 1000);
}

// ✅ Only run in browser
ngOnInit() {
  afterNextRender(() => {
    const id = setInterval(() => this.updateClock(), 1000);
    this.destroyRef.onDestroy(() => clearInterval(id));
  });
}
```

### Pitfall 3: Not using `withFetch()` — double HTTP requests

```typescript
// ❌ Without withFetch, uses XMLHttpRequest (not available in Node.js)
// Falls back to a Node-compatible shim, but no transfer caching!
provideHttpClient()

// ✅ With withFetch — uses Fetch API, compatible with Node.js AND enables transfer cache
provideHttpClient(withFetch())
```

### Pitfall 4: Hydration mismatch

```typescript
// ❌ If server renders different HTML than client, Angular throws hydration mismatch error!
// This happens when you access Date.now() or Math.random() in templates

template: `<p>Random: {{ getRandomId() }}</p>`
// Server: renders "42", Browser: renders "17" → MISMATCH!

// ✅ Pre-compute such values as signals before rendering
randomId = signal(Math.random());
template: `<p>Random: {{ randomId() }}</p>`
// Both server and browser use the same pre-computed value
```

---

## 10. Knowledge Check

1. What is the difference between SSR and hydration?
2. Why does Angular SSR need Node.js?
3. What does `provideClientHydration()` do?
4. Why must you use `withFetch()` with `provideHttpClient()` in SSR apps?
5. What happens if your server-rendered HTML is different from the client-rendered HTML?

<details>
<summary>✅ View Answers</summary>

1. **SSR** is the process of rendering your Angular app into HTML on the server (Node.js) and sending it to the browser — giving users content before JavaScript loads. **Hydration** is what happens next: Angular "wakes up" the static HTML by attaching event listeners and making the page interactive, WITHOUT destroying and rebuilding the DOM.

2. Angular SSR uses **Angular Universal**, which is built on `@angular/platform-server`. This package implements Angular's rendering engine in a Node.js environment. A Node.js server (often Express) receives requests, runs the Angular app in Node.js, and sends back the rendered HTML string.

3. `provideClientHydration()` enables Angular's incremental hydration feature, which allows Angular to reuse the server-rendered DOM instead of destroying it. It also automatically sets up `HttpTransferCache`, which serializes HTTP responses from the server into the HTML so the browser can reuse them without making duplicate API calls.

4. `withFetch()` makes Angular's `HttpClient` use the **Fetch API** instead of `XMLHttpRequest`. `XMLHttpRequest` is browser-only and doesn't work in Node.js. The Fetch API works in both environments. Additionally, `withFetch()` enables `HttpTransferCache` (when combined with `provideClientHydration()`), which prevents duplicate HTTP requests between server and browser.

5. Angular throws a **hydration mismatch error**. When the server-rendered HTML doesn't match what the client would render, Angular can't reliably attach event listeners to the correct DOM elements. Common causes: using `Date.now()`, `Math.random()`, or any browser-only data (like screen width) in templates. The solution is to pre-compute these values as signals and ensure server and client always produce identical output.
</details>

---

*Next: [16 - ViewChild →](./16-viewchild.md)*
