# Angular: Deferrable Views (`@defer`)

> **Goal**: Use Angular's `@defer` block to dramatically reduce initial bundle size by lazy-loading heavy components exactly when they're needed.

---

## 📋 Table of Contents
1. [Why `@defer`?](#1-why-defer)
2. [The Four Blocks](#2-the-four-blocks)
3. [All Trigger Types](#3-all-trigger-types)
4. [Prefetch Strategies](#4-prefetch-strategies)
5. [Real-World Patterns](#5-real-world-patterns)
6. [Testing Defer Blocks](#6-testing-defer-blocks)
7. [Common Pitfalls](#7-common-pitfalls)
8. [Try It Yourself](#8-try-it-yourself)
9. [Knowledge Check](#9-knowledge-check)

---

## 1. Why `@defer`?

Before `@defer`, lazy-loading a component either required:
- Putting it on a separate route (`loadComponent` / `loadChildren`)
- Complex boilerplate with `ViewContainerRef` + `ComponentRef` + dynamic imports

`@defer` makes **template-level lazy loading** declarative and zero-boilerplate. The Angular compiler automatically:
1. Detects everything inside the `@defer` block
2. Bundles those dependencies into a **separate JS file**
3. Downloads that file **only when the trigger condition is met**

### Impact on Bundle Size

```
Before @defer:
main.js → 1.2MB (includes charts, editor, video player, etc.)

After @defer:
main.js → 180KB   ← User downloads this on first visit
chunk-charts.js → 400KB  ← Downloaded only when Charts section is in viewport
chunk-editor.js → 320KB  ← Downloaded only when user clicks "Edit"
chunk-video.js  → 280KB  ← Downloaded only on interaction
```

---

## 2. The Four Blocks

```html
@defer (on viewport; prefetch on idle) {
  <!-- 📦 LAZY BLOCK -->
  <!-- All imports inside here become a separate JavaScript bundle! -->
  <!-- Angular knows to lazy-load: ChartComponent, its dependencies, etc. -->
  <app-analytics-chart [data]="salesData()"></app-analytics-chart>
  <app-data-table [rows]="tableData()"></app-data-table>
}

@placeholder (minimum 500ms) {
  <!-- 🖼️ PLACEHOLDER — shown while the chunk is not yet downloaded -->
  <!-- 'minimum: 500ms' prevents a quick flash if the chunk loads fast -->
  <!-- Always give it a height! (see Pitfalls) -->
  <div class="chart-skeleton" style="min-height: 400px">
    <p>Scroll down to load the analytics chart...</p>
  </div>
}

@loading (after 200ms; minimum 1s) {
  <!-- ⏳ LOADING — shown only when the browser is actively downloading the chunk -->
  <!-- 'after 200ms': don't show for instant downloads (fast connections) -->
  <!-- 'minimum 1s': ensure spinner stays visible enough to be seen (not just a flash) -->
  <div class="spinner-container">
    <div class="spinner"></div>
    <p>Loading chart data...</p>
  </div>
}

@error {
  <!-- ❌ ERROR — shown if the chunk fails to download (e.g., user went offline) -->
  <div class="error-state">
    <p>⚠️ Failed to load this section.</p>
    <button (click)="retryLoad()">Retry</button>
  </div>
}
```

### Block Timing Summary

| State | Renders When |
|---|---|
| `@placeholder` | Immediately, before the chunk downloads |
| `@loading` | When the browser starts downloading the JS chunk |
| `@defer` content | When the chunk downloads and the trigger is active |
| `@error` | If the chunk download fails |

---

## 3. All Trigger Types

### `on idle` (Default)

```html
<!-- Waits until the browser is idle (requestIdleCallback) -->
<!-- Best for: Below-the-fold content, non-critical sections -->
@defer (on idle) {
  <app-recommendations></app-recommendations>
}
```

### `on viewport`

```html
<!-- Uses IntersectionObserver — loads when placeholder enters the viewport -->
<!-- Best for: Infinite scrolling, below-fold heavy content -->
@defer (on viewport) {
  <app-analytics-dashboard [data]="metrics()"></app-analytics-dashboard>
} @placeholder {
  <!-- CRITICAL: Give the placeholder height! Otherwise it's always "in viewport" -->
  <div style="min-height: 500px" class="dashboard-skeleton"></div>
}
```

### `on interaction`

```html
<!-- Loads when the user clicks or focusses the placeholder element -->
<!-- Best for: Video players, rich text editors, complex modals -->
@defer (on interaction) {
  <app-video-player [src]="videoUrl()"></app-video-player>
} @placeholder {
  <div class="video-thumbnail" style="min-height: 300px">
    <img [src]="thumbnailUrl()" alt="Click to play">
    <div class="play-button">▶</div>
  </div>
}
```

### `on hover`

```html
<!-- Loads when the user hovers over the placeholder -->
<!-- Best for: Tooltips, dropdowns, preview panels -->
@defer (on hover) {
  <app-user-preview-card [userId]="hoveredUserId()"></app-user-preview-card>
} @placeholder {
  <span class="username-link">{{ username() }}</span>
}
```

### `on timer(ms)`

```html
<!-- Loads after a specified delay, regardless of user action -->
<!-- Best for: Non-critical sections below the fold, chat widgets -->
@defer (on timer(3000)) {
  <app-cookie-consent-banner></app-cookie-consent-banner>
}
```

### `when <condition>` — Conditional Trigger

```html
<!-- Loads when the expression becomes truthy -->
<!-- Best for: Feature flags, permission-based components -->
@defer (when isAdmin() && featureEnabled()) {
  <app-admin-controls></app-admin-controls>
} @placeholder {
  <div></div>  <!-- Empty placeholder — nothing shows until condition is met -->
}
```

### `on immediate` — No Delay

```html
<!-- Loads as soon as the component renders — but still as a separate chunk! -->
<!-- Best for: Important content that you still want in a lazy bundle for code-splitting -->
@defer (on immediate) {
  <app-above-fold-hero></app-above-fold-hero>
}
```

---

## 4. Prefetch Strategies

The `prefetch` keyword starts downloading the JS chunk **before** the main trigger fires, so the component is instantly available when needed.

```html
<!-- Trigger: load on click (interaction) -->
<!-- Prefetch: start downloading when user hovers -->
<!-- Result: By the time they click, the download is already done! -->
@defer (on interaction; prefetch on hover) {
  <app-document-editor [doc]="currentDoc()"></app-document-editor>
} @placeholder {
  <button class="open-editor-btn">📝 Open Editor</button>
}
```

```html
<!-- Trigger: show when admin flag is set (when) -->
<!-- Prefetch: start downloading when the app is idle -->
<!-- Result: Admin panel is ready before admin even navigates there -->
@defer (when showAdminPanel(); prefetch on idle) {
  <app-admin-panel></app-admin-panel>
}
```

All trigger types work as prefetch strategies: `prefetch on idle`, `prefetch on viewport`, `prefetch on hover`, `prefetch on timer(2000)`, `prefetch when condition`.

---

## 5. Real-World Patterns

### Pattern 1: Analytics Dashboard (Below the Fold)

```html
<!-- Hero section — loaded eagerly (no defer needed) -->
<app-hero-banner></app-hero-banner>

<!-- Analytics charts — defer with viewport trigger -->
@defer (on viewport; prefetch on idle) {
  <section class="analytics">
    <app-revenue-chart [data]="revenueData()"></app-revenue-chart>
    <app-user-growth-chart [data]="userGrowthData()"></app-user-growth-chart>
    <app-conversion-funnel [data]="funnelData()"></app-conversion-funnel>
  </section>
} @placeholder {
  <div class="analytics-skeleton" style="min-height: 800px">
    <div class="skeleton-bar"></div>
    <div class="skeleton-bar" style="height: 200px"></div>
  </div>
} @loading (after 200ms; minimum 800ms) {
  <div class="loading-charts">
    <div class="spinner"></div>
    <p>Loading analytics data...</p>
  </div>
}
```

### Pattern 2: Rich Text Editor (On User Action)

```html
<div class="article-view">
  <!-- Read-only view always loads -->
  <div [innerHTML]="article().html"></div>

  @if (currentUser()?.canEdit) {
    <!-- Editor only loads when the edit button is clicked -->
    @defer (on interaction; prefetch on hover) {
      <app-rich-text-editor
        [content]="article().html"
        (contentChange)="onContentChange($event)">
      </app-rich-text-editor>
    } @placeholder {
      <button class="edit-btn">✏️ Edit Article</button>
    } @loading (after 100ms; minimum 500ms) {
      <div class="editor-loading">
        <div class="spinner-sm"></div> Loading editor...
      </div>
    }
  }
</div>
```

### Pattern 3: Tabbed Content

```html
<div class="tabs">
  <button (click)="activeTab.set('overview')" [class.active]="activeTab() === 'overview'">Overview</button>
  <button (click)="activeTab.set('reviews')" [class.active]="activeTab() === 'reviews'">Reviews</button>
  <button (click)="activeTab.set('specs')" [class.active]="activeTab() === 'specs'">Specifications</button>
</div>

<!-- Each tab is a separate lazy chunk -->
@defer (when activeTab() === 'overview') {
  <app-product-overview [product]="product()"></app-product-overview>
}

@defer (when activeTab() === 'reviews'; prefetch on idle) {
  <app-reviews-section [productId]="product().id"></app-reviews-section>
}

@defer (when activeTab() === 'specs'; prefetch on idle) {
  <app-specifications-table [specs]="product().specs"></app-specifications-table>
}
```

---

## 6. Testing Defer Blocks

Angular provides `DeferBlockBehavior` for testing:

```typescript
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DeferBlockBehavior, DeferBlockState } from '@angular/core/testing';

describe('ProductPageComponent', () => {
  let fixture: ComponentFixture<ProductPageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Control defer behavior in tests
      deferBlockBehavior: DeferBlockBehavior.Manual  // Control manually
    });
    fixture = TestBed.createComponent(ProductPageComponent);
  });

  it('should show placeholder initially', async () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Scroll down to load');
  });

  it('should render chart after defer resolves', async () => {
    fixture.detectChanges();

    // Manually trigger the defer block
    const deferBlocks = await fixture.getDeferBlocks();
    await deferBlocks[0].render(DeferBlockState.Complete);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-analytics-chart')).toBeTruthy();
  });
});
```

---

## 7. Common Pitfalls

### Pitfall 1: Empty placeholder (zero height breaks `on viewport`)

```html
<!-- ❌ Placeholder has zero height — it's always "in the viewport" — loads immediately! -->
@defer (on viewport) {
  <app-heavy-chart></app-heavy-chart>
} @placeholder {
  <div></div>  <!-- 0px height! -->
}

<!-- ✅ Give the placeholder realistic dimensions -->
@defer (on viewport) {
  <app-heavy-chart></app-heavy-chart>
} @placeholder {
  <div class="chart-placeholder" style="min-height: 400px">
    📊 Chart loads when you scroll here
  </div>
}
```

### Pitfall 2: Deferring tiny components

```html
<!-- ❌ Overkill — creates an HTTP request for a 3KB button! -->
@defer {
  <app-simple-button></app-simple-button>
}

<!-- ✅ Only defer heavy components (>50KB dependencies) -->
@defer {
  <app-pdf-viewer></app-pdf-viewer>   <!-- Heavy PDF.js library inside -->
}
```

### Pitfall 3: Not having an `@error` block

```html
<!-- ❌ If the user goes offline, the component just never loads — silent failure! -->
@defer (on viewport) {
  <app-chart></app-chart>
}

<!-- ✅ Always add error handling for production apps -->
@defer (on viewport) {
  <app-chart></app-chart>
} @error {
  <div class="error">Failed to load chart. <button (click)="reload()">Retry</button></div>
}
```

---

## 8. Try It Yourself

**Scenario**: You have a product page with:
1. An eager-loading product hero section (always visible)
2. A heavy reviews section (below the fold)
3. A 3D product viewer (only when the user clicks "View in 3D")
4. A recommendations widget (load when browser is idle, but start when viewport is triggered)

Build the `@defer` structure for all three.

<details>
<summary>✅ View Solution</summary>

```html
<!-- 1. Hero section — no defer, always loads immediately -->
<app-product-hero [product]="product()"></app-product-hero>

<!-- 2. Reviews section — lazy-load when scrolled to -->
@defer (on viewport; prefetch on idle) {
  <app-reviews-section [productId]="product().id"></app-reviews-section>
} @placeholder {
  <div style="min-height: 600px" class="reviews-placeholder">
    <p>⭐ Reviews loading as you scroll...</p>
  </div>
} @loading (after 150ms; minimum 500ms) {
  <div class="reviews-loading">Loading reviews...</div>
} @error {
  <p>Failed to load reviews. <a href="" (click)="$event.preventDefault()">Retry</a></p>
}

<!-- 3. 3D Viewer — only download on user click, prefetch on hover -->
@defer (on interaction; prefetch on hover) {
  <app-product-3d-viewer [model]="product().model3dUrl"></app-product-3d-viewer>
} @placeholder {
  <button class="view-3d-btn" style="min-height: 100px">
    🎮 Click to View in 3D
  </button>
} @loading (after 200ms; minimum 1s) {
  <div class="viewer-loading">Loading 3D viewer...</div>
} @error {
  <p>3D viewer failed to load.</p>
}

<!-- 4. Recommendations — prefetch on idle, show when in viewport -->
@defer (on viewport; prefetch on idle) {
  <app-recommendations [productId]="product().id"></app-recommendations>
} @placeholder {
  <div style="min-height: 300px" class="recommendations-placeholder"></div>
}
```
</details>

---

## 9. Knowledge Check

1. What does `@loading (after 200ms; minimum 1s)` mean?
2. If a component inside `@defer` imports `chart.js`, does `chart.js` end up in the main bundle?
3. What is the difference between `on interaction` and `when <condition>` triggers?
4. Why must `@placeholder` elements have a minimum height when using `on viewport`?

<details>
<summary>✅ View Answers</summary>

1. The `@loading` block only starts showing after **200ms** have elapsed since downloading started (to avoid showing a spinner for fast network downloads). Once the spinner appears, it stays visible for **at least 1 second** (`minimum 1s`) — preventing it from flashing too quickly for the user to see.

2. **No.** The Angular compiler detects that `chart.js` is only imported by a component inside a `@defer` block, so it automatically extracts `chart.js` into a separate lazy-loaded JavaScript chunk. It will NOT be included in the main bundle. This is the primary performance benefit of `@defer`.

3. `on interaction` is a **DOM event trigger** — it fires when the user clicks or focuses on the placeholder element. `when <condition>` is a **programmatic trigger** — it fires when the TypeScript expression evaluates to `true` (e.g., a signal changes). Use `on interaction` for user-driven loading, `when` for state-driven loading.

4. The `on viewport` trigger uses `IntersectionObserver` to detect when the placeholder enters the visible screen area. If the placeholder has zero height (`0px`), it technically occupies space "in" the viewport (an invisible line). The observer fires immediately on load — defeating the lazy-loading purpose entirely. Always give placeholders a `min-height` that approximates the final content's size.
</details>

---

*Next: [15 - SSR & Hydration →](./15-ssr-hydration.md)*
