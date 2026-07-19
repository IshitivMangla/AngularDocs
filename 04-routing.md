# Angular: Routing, Navigation API & URL Strategies

> **Goal**: Master Angular's router to build multi-page SPAs with lazy loading, nested routes, programmatic navigation, and route-based data flow — all essential for scalable apps.

---

## 📋 Table of Contents
1. [How the Router Works](#1-how-the-router-works)
2. [Route Configuration Patterns](#2-route-configuration-patterns)
3. [Lazy Loading with `loadComponent` & `loadChildren`](#3-lazy-loading)
4. [Route Parameters & Query Params](#4-route-parameters--query-params)
5. [The Navigation API](#5-the-navigation-api)
6. [Nested Routes & Named Outlets](#6-nested-routes--named-outlets)
7. [Router Events & Progress Indicators](#7-router-events--progress-indicators)
8. [Location Strategies: HTML5 vs Hash](#8-location-strategies)
9. [Route Data: `data` & `resolve`](#9-route-data)
10. [`RouterLink` Directive Deep Dive](#10-routerlink-directive-deep-dive)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Try It Yourself](#12-try-it-yourself)
13. [Knowledge Check](#13-knowledge-check)

---

## 1. How the Router Works

When the user types or clicks a URL, Angular's router:

1. **Receives the URL** from the address bar or a `router.navigate()` call
2. **Matches** the URL against the `routes` array **top-to-bottom**
3. **Runs guards** (`canActivate`, `canMatch`) — can block or redirect
4. **Runs resolvers** — fetches data before rendering
5. **Instantiates components** and inserts them into `<router-outlet>`
6. **Updates the browser URL** and history

```
URL Change → Route Matching → Guards → Resolvers → Component Activation → Render
```

### Route Matching Strategies

| Strategy | Default? | Description |
|---|---|---|
| `prefix` | ✅ Yes | Matches if URL **starts with** the path. `path: ''` matches EVERYTHING. |
| `full` | ❌ No | Matches only if the URL is **exactly** the path. |

```typescript
export const routes: Routes = [
  // ❌ DANGER: pathMatch defaults to 'prefix', so '' matches every URL!
  // This creates an infinite redirect loop.
  { path: '', redirectTo: 'home' },                           // BROKEN

  // ✅ CORRECT: 'full' means "only redirect if the path is exactly ''"
  { path: '', redirectTo: 'home', pathMatch: 'full' },        // FIXED

  { path: 'home', component: HomeComponent },
  { path: 'users/:id', component: UserDetailComponent },

  // ✅ Wildcard MUST be last — it matches everything not matched above
  { path: '**', component: NotFoundComponent }
];
```

---

## 2. Route Configuration Patterns

### Full Scalable Route Configuration

```typescript
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { userProfileResolver } from './features/users/resolvers/user-profile.resolver';

export const routes: Routes = [
  // Root redirect
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Public routes — no auth required
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },

  // Protected routes — require authentication
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component')
                           .then(m => m.DashboardComponent),
    canActivate: [authGuard],
    // Static data available to the component via @Input('title') or ActivatedRoute
    data: { title: 'Dashboard', breadcrumb: 'Home' }
  },

  // Feature with nested routes
  {
    path: 'users',
    canActivate: [authGuard],
    loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES)
  },

  // Admin-only section — uses multiple guards (all must pass)
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },

  // 404 page
  {
    path: '**',
    loadComponent: () => import('./shared/components/not-found/not-found.component')
                           .then(m => m.NotFoundComponent)
  }
];
```

---

## 3. Lazy Loading

Lazy loading is the #1 performance technique for Angular apps. Code for a feature is only downloaded when the user actually navigates to it.

### `loadComponent` — Lazy-load a Single Component

```typescript
// Best for simple routes with one component
{
  path: 'about',
  loadComponent: () => import('./pages/about/about.component')
                         .then(m => m.AboutComponent)
}
```

### `loadChildren` — Lazy-load an Entire Feature (Multiple Routes)

```typescript
// Parent route file
{
  path: 'products',
  loadChildren: () => import('./features/products/products.routes')
                         .then(m => m.PRODUCTS_ROUTES)
}
```

```typescript
// src/app/features/products/products.routes.ts
import { Routes } from '@angular/router';

export const PRODUCTS_ROUTES: Routes = [
  // '' matches 'products' from the parent
  {
    path: '',
    loadComponent: () => import('./list/products-list.component')
                           .then(m => m.ProductsListComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./detail/product-detail.component')
                           .then(m => m.ProductDetailComponent),
    resolve: { product: productResolver }
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./edit/product-edit.component')
                           .then(m => m.ProductEditComponent),
    canDeactivate: [unsavedChangesGuard]
  }
];
```

### Preloading Strategies

```typescript
// app.config.ts — choose your preloading strategy
import { provideRouter, withPreloading, PreloadAllModules, QuicklinkStrategy } from '@angular/router';

export const appConfig = {
  providers: [
    provideRouter(
      routes,
      // Option 1: Preload all lazy modules when browser is idle (after initial load)
      withPreloading(PreloadAllModules),

      // Option 2: Only preload routes that have a [routerLink] visible on screen
      // Requires: npm install ngx-quicklink
      // withPreloading(QuicklinkStrategy)
    )
  ]
};
```

---

## 4. Route Parameters & Query Params

### The Modern Way: Component Input Binding (Angular v16+)

When `withComponentInputBinding()` is set up in `app.config.ts`, the router automatically maps URL data to component inputs. **No need to inject `ActivatedRoute`!**

```typescript
// app.config.ts
provideRouter(routes, withComponentInputBinding())
```

```typescript
// For URL: /products/42?sort=price&order=asc
// Route: { path: 'products/:id', ... }

import { Component, input, OnInit, inject } from '@angular/core';
import { ProductService } from '../product.service';
import { Product } from '../product.model';
import { signal } from '@angular/core';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  template: `
    @if (product(); as p) {
      <h1>{{ p.name }}</h1>
      <p>Sorted by: {{ sort() }}, Order: {{ order() }}</p>
    }
  `
})
export class ProductDetailComponent implements OnInit {
  // ✅ Route param :id → automatically bound to 'id' input
  id = input.required<string>();

  // ✅ Query param ?sort=price → automatically bound to 'sort' input
  sort = input<string>('name');  // Default to 'name' if not present in URL

  // ✅ Query param ?order=asc → automatically bound to 'order' input
  order = input<string>('asc');

  // ✅ Static route data { data: { breadcrumb: 'Product' } } → bound to 'breadcrumb' input
  breadcrumb = input<string>('');

  private productService = inject(ProductService);
  product = signal<Product | null>(null);

  ngOnInit() {
    // Now use the id input to fetch data
    this.productService.getById(this.id()).subscribe(p => this.product.set(p));
  }
}
```

### The Traditional Way: `ActivatedRoute`

Useful when you need to react to **parameter changes** while staying on the same component (e.g., navigating from product/1 to product/2 without destroying the component).

```typescript
import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

@Component({ ... })
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private destroyRef = inject(DestroyRef);
  product = signal<Product | null>(null);

  ngOnInit() {
    // paramMap is an Observable that emits every time :id changes in the URL
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id')!;
        return this.productService.getById(+id); // Cancel previous request automatically
      }),
      takeUntilDestroyed(this.destroyRef)  // Auto-unsubscribe on destroy
    ).subscribe(product => this.product.set(product));

    // Reading query params
    this.route.queryParamMap.subscribe(params => {
      const sort = params.get('sort') ?? 'name';
      const page = Number(params.get('page') ?? 1);
      console.log(`Sort: ${sort}, Page: ${page}`);
    });
  }
}
```

---

## 5. The Navigation API

### `navigate()` vs `navigateByUrl()`

| Method | Input | Use Case |
|---|---|---|
| `router.navigate()` | Array of segments | Preferred. Supports relative navigation. Handles encoding. |
| `router.navigateByUrl()` | Absolute string | Simple absolute URL navigation. |

```typescript
import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Component({ ... })
export class OrderFormComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  async onSubmitSuccess(orderId: number) {
    // 1. Navigate to absolute path (builds URL: /orders/123)
    await this.router.navigate(['/orders', orderId]);

    // 2. Navigate with query params (builds URL: /orders?status=new&page=1)
    await this.router.navigate(['/orders'], {
      queryParams: { status: 'new', page: 1 }
    });

    // 3. Relative navigation — if currently on /dashboard/orders,
    //    '..' goes up to /dashboard, then adds /settings
    await this.router.navigate(['../settings'], { relativeTo: this.route });

    // 4. String-based (simple cases only)
    await this.router.navigateByUrl('/home');
  }
}
```

### Navigation Extras — Advanced Options

```typescript
this.router.navigate(['/dashboard'], {
  // Replace current URL in browser history instead of pushing a new entry.
  // Effect: If user clicks Back, they skip this navigation.
  // Use case: After login — user shouldn't be able to go back to the login page.
  replaceUrl: true,

  // The URL in the address bar will NOT change, but the component WILL change.
  // Use case: Displaying a "maintenance mode" view without breaking bookmarked URLs.
  skipLocationChange: false,

  // Pass hidden state that is NOT visible in the URL.
  // Available on the next page via: history.state.orderId
  // WARNING: This data is LOST on page refresh!
  state: {
    fromCheckout: true,
    orderId: 'ORD-12345',
    paymentConfirmed: true
  },

  // Keep existing query params when navigating
  queryParamsHandling: 'merge',    // 'merge' | 'preserve' | ''

  // Fragment for in-page anchoring (adds #section to URL)
  fragment: 'confirmation-section'
});
```

### Reading Navigation State

```typescript
// In the destination component — reads the hidden state
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({ ... })
export class OrderConfirmationComponent {
  private router = inject(Router);

  constructor() {
    // Read the hidden state — will be null if user refreshed the page!
    const state = this.router.getCurrentNavigation()?.extras.state;
    if (state?.['fromCheckout']) {
      console.log('Order ID:', state['orderId']);
    }
  }
}
```

---

## 6. Nested Routes & Named Outlets

### Nested Routes

```typescript
// Admin feature routes — with layout component wrapping children
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    // AdminLayoutComponent provides the sidebar + content structure
    loadComponent: () => import('./admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        loadComponent: () => import('./overview/overview.component').then(m => m.OverviewComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./users/admin-users.component').then(m => m.AdminUsersComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/admin-settings.component').then(m => m.AdminSettingsComponent)
      }
    ]
  }
];
```

```typescript
// admin-layout.component.ts
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-layout">
      <aside class="sidebar">
        <nav>
          <a routerLink="overview" routerLinkActive="active">Overview</a>
          <a routerLink="users" routerLinkActive="active">Users</a>
          <a routerLink="settings" routerLinkActive="active">Settings</a>
        </nav>
      </aside>
      <main class="content">
        <!-- Child routes render here -->
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AdminLayoutComponent {}
```

---

## 7. Router Events & Progress Indicators

Track the navigation lifecycle to show global progress bars, loading indicators, or analytics events.

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  RouterOutlet
} from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <!-- Global progress bar at top of screen -->
    @if (isNavigating()) {
      <div class="progress-bar"></div>
    }
    <router-outlet></router-outlet>
  `
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  isNavigating = signal(false);

  ngOnInit() {
    this.router.events.pipe(
      filter(event =>
        event instanceof NavigationStart ||
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ),
      takeUntilDestroyed()  // Angular 16+ — auto-cleanup, no destroyRef needed
    ).subscribe(event => {
      this.isNavigating.set(event instanceof NavigationStart);
    });
  }
}
```

---

## 8. Location Strategies

| Strategy | URL Example | Server Config Required? | Use Case |
|---|---|---|---|
| `PathLocationStrategy` (default) | `https://app.com/users/42` | ✅ Yes — must configure fallback to `index.html` | Production apps on properly configured servers |
| `HashLocationStrategy` | `https://app.com/#/users/42` | ❌ No | Legacy servers, GitHub Pages, static hosting without config |

### The Production Server Problem

If you use `PathLocationStrategy` (the default) and a user bookmarks `https://app.com/users/42`, then refreshes:
- The **server** receives a request for `/users/42`
- The server looks for a folder/file called `users/42` — it doesn't exist!
- The server returns a `404 Not Found` error

**Fix**: Configure your server to return `index.html` for all 404s.

**Nginx:**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

**Apache:**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### Enabling Hash Strategy

```typescript
import { provideRouter, withHashLocation } from '@angular/router';

export const appConfig = {
  providers: [
    provideRouter(routes, withHashLocation())
  ]
};
```

---

## 9. Route Data

### Static Route Data with `data`

```typescript
// In routes
{
  path: 'analytics',
  loadComponent: () => import('./analytics.component').then(m => m.AnalyticsComponent),
  data: {
    title: 'Analytics Dashboard',
    breadcrumb: 'Analytics',
    requiredPermission: 'analytics:read'
  }
}
```

```typescript
// In the component — auto-bound with withComponentInputBinding()
@Component({ ... })
export class AnalyticsComponent {
  title = input<string>('');
  breadcrumb = input<string>('');
  requiredPermission = input<string>('');
}
```

### SEO with Route Titles

Angular can automatically set the browser tab title based on route data:

```typescript
import { provideRouter, withRouterConfig, TitleStrategy } from '@angular/router';
import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot } from '@angular/router';

// Custom title strategy that appends app name
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private titleService = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot) {
    const title = this.buildTitle(snapshot);
    if (title) {
      this.titleService.setTitle(`${title} | MyApp`);
    } else {
      this.titleService.setTitle('MyApp');
    }
  }
}

// Register in app.config.ts
export const appConfig = {
  providers: [
    provideRouter(routes),
    { provide: TitleStrategy, useClass: AppTitleStrategy }
  ]
};
```

```typescript
// Routes with titles
{
  path: 'dashboard',
  loadComponent: () => import('./dashboard.component').then(m => m.DashboardComponent),
  title: 'Dashboard'   // Browser tab will show "Dashboard | MyApp"
}
```

---

## 10. `RouterLink` Directive Deep Dive

```html
<!-- Basic navigation -->
<a routerLink="/home">Home</a>

<!-- Dynamic segment -->
<a [routerLink]="['/users', userId]">My Profile</a>

<!-- With query params -->
<a [routerLink]="['/search']" [queryParams]="{ q: 'angular', page: 1 }">Search</a>

<!-- Relative navigation — from /dashboard, goes to /dashboard/settings -->
<a routerLink="settings">Settings</a>

<!-- Go up one level then to sibling -->
<a routerLink="../profile">Profile</a>

<!-- Active class — adds 'active' class when this route is current -->
<a routerLink="/home" routerLinkActive="active">Home</a>

<!-- exactActiveClass — only when EXACTLY this route (not a child) -->
<a routerLink="/home" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>

<!-- ❌ NEVER use href for SPA navigation — causes a full page reload! -->
<a href="/home">Home</a>  <!-- BAD! -->
```

---

## 11. Common Pitfalls

### Pitfall 1: Missing `pathMatch: 'full'` on empty redirect

```typescript
// ❌ Causes infinite redirect loop — '' is a prefix of every URL
{ path: '', redirectTo: 'home' }

// ✅ Correct
{ path: '', redirectTo: 'home', pathMatch: 'full' }
```

### Pitfall 2: Wildcard route not at the end

```typescript
// ❌ '**' catches everything — nothing below it is reachable!
{ path: '**', component: NotFoundComponent },
{ path: 'dashboard', component: DashboardComponent }  // UNREACHABLE!

// ✅ Wildcard always goes last
{ path: 'dashboard', component: DashboardComponent },
{ path: '**', component: NotFoundComponent }
```

### Pitfall 3: Using `<a href>` instead of `routerLink`

```html
<!-- ❌ Full page reload — destroys Angular app state and re-downloads everything -->
<a href="/products">Products</a>

<!-- ✅ Angular SPA navigation — no reload, state preserved -->
<a routerLink="/products">Products</a>
```

### Pitfall 4: Navigation state is lost on refresh

```typescript
// ❌ Don't store important data only in navigation state
this.router.navigate(['/confirm'], { state: { orderId: '123' } });
// If user refreshes /confirm, history.state.orderId is undefined!

// ✅ Use URL query params for persistent data
this.router.navigate(['/confirm'], { queryParams: { orderId: '123' } });
// ?orderId=123 survives refresh and can be bookmarked
```

### Pitfall 5: Not handling the 404 server configuration in production

If you deploy with `PathLocationStrategy` (default) and don't configure a server fallback, all directly-accessed routes (bookmarks, external links) return 404.

---

## 12. Try It Yourself

**Scenario**: You have a products application. Build the complete route configuration for:
1. `/` → redirect to `/products`
2. `/products` → `ProductsListComponent` (lazy-loaded, requires auth)
3. `/products/:id` → `ProductDetailComponent` (lazy-loaded, requires auth)
4. `/products/:id/edit` → `ProductEditComponent` (lazy-loaded, requires auth, prompt if unsaved changes)
5. `/login` → `LoginComponent` (public, lazy-loaded)
6. Any other URL → `NotFoundComponent`

<details>
<summary>✅ View Solution</summary>

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'products', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component')
                           .then(m => m.LoginComponent)
  },

  {
    path: 'products',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/products/list/products-list.component')
                               .then(m => m.ProductsListComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/products/detail/product-detail.component')
                               .then(m => m.ProductDetailComponent)
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./features/products/edit/product-edit.component')
                               .then(m => m.ProductEditComponent),
        canDeactivate: [unsavedChangesGuard]
      }
    ]
  },

  {
    path: '**',
    loadComponent: () => import('./shared/components/not-found/not-found.component')
                           .then(m => m.NotFoundComponent)
  }
];
```
</details>

---

## 13. Knowledge Check

1. What is the difference between `navigate()` and `navigateByUrl()`?
2. Why is `replaceUrl: true` useful after a user successfully logs in?
3. If your Angular app works fine on click but throws 404 on page refresh in production, what is the fix?
4. What does `withComponentInputBinding()` do, and why is it preferred over injecting `ActivatedRoute`?
5. When would you use `HashLocationStrategy` over the default `PathLocationStrategy`?

<details>
<summary>✅ View Answers</summary>

1. `navigate()` takes an **array of URL segments** (e.g., `['/users', id, 'edit']`), handles URL encoding automatically, and supports relative navigation (`relativeTo: this.route`). `navigateByUrl()` takes a **literal string** (e.g., `'/users/' + id + '/edit'`). `navigate()` is preferred in most cases.

2. It replaces the current entry in the browser's history stack. When the user is on the dashboard and clicks the browser **Back** button, they skip the Login page they came from (they're already logged in — there's no reason to go back there).

3. The production server is not configured to serve `index.html` for unknown routes. It's looking for a physical directory on the hard drive. Configure **server-side URL rewriting** (Nginx: `try_files $uri /index.html`) to serve `index.html` for all 404s, then Angular handles the routing client-side. Alternatively, switch to `HashLocationStrategy`.

4. `withComponentInputBinding()` tells the router to **automatically push route params, query params, and static `data`** into the component's `@Input()` / `input()` properties. This eliminates boilerplate: no need to inject `ActivatedRoute`, no need to subscribe to `paramMap`. It results in cleaner, more testable components.

5. Use `HashLocationStrategy` when you're hosting on a server you cannot configure (e.g., GitHub Pages, some shared hosting, S3 static hosting without CloudFront). The `#` fragment is never sent to the server, so the server always sees `https://app.com/` — no 404 problems. The downside is the URLs look ugly and aren't great for SEO.
</details>

---

*Next: [05 - Services & Dependency Injection →](./05-services-di.md)*
