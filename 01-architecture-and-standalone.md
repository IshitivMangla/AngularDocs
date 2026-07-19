# Angular: Architecture & Standalone Components

> **Goal**: Understand how modern Angular applications are structured, why `NgModules` are being phased out, and how to set up a scalable project from scratch using Standalone Components.

---

## 📋 Table of Contents
1. [The Mental Model: What is Angular?](#1-the-mental-model)
2. [The Problem with NgModules](#2-the-problem-with-ngmodules)
3. [Standalone Components — The Solution](#3-standalone-components)
4. [Anatomy of a Standalone Component](#4-anatomy-of-a-standalone-component)
5. [Bootstrapping the Application](#5-bootstrapping-the-application)
6. [Scalable Project Folder Structure](#6-scalable-project-folder-structure)
7. [Feature Modules vs. Feature Folders](#7-feature-modules-vs-feature-folders)
8. [Mixing Standalone & NgModules](#8-mixing-standalone--ngmodules)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Try It Yourself](#10-try-it-yourself)
11. [Knowledge Check](#11-knowledge-check)

---

## 1. The Mental Model

Angular is a **platform and framework** for building client-side applications in HTML and TypeScript. It provides:

| Layer | Responsibility |
|---|---|
| **Components** | The UI — what the user sees and interacts with |
| **Services** | Business logic, data fetching, shared state |
| **Router** | Maps URLs to components |
| **DI (Dependency Injection)** | Wires services into components automatically |
| **Change Detection** | Syncs TypeScript data to the DOM |

The key architectural principle is **Separation of Concerns**: your HTML knows nothing about HTTP, your service knows nothing about the DOM, and your component acts as the glue between them.

---

## 2. The Problem with NgModules

In Angular v2–v13, every component had to be declared in an `NgModule`. The module acted as a "registry" for its components, directives, and pipes.

```typescript
// ❌ The OLD way — 30+ lines just to declare ONE component!
@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    ProductCardComponent,
    // ...imagine 20 more entries
  ],
  imports: [
    BrowserModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forRoot(routes),
    HttpClientModule,
    MatButtonModule,
    // ...
  ],
  providers: [UserService, AuthService],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

### Core Problems

1. **Mental Overhead**: Developers had to learn TWO systems — Components AND Modules — before writing a single line of actual app logic.
2. **Hidden Dependencies**: If `ButtonComponent` was in `SharedModule`, importing `SharedModule` gave you `ButtonComponent` even if you didn't need it. This made dependency tracking nearly impossible.
3. **Poor Tree-Shaking**: Because dependencies were bundled at the Module level, unused code frequently shipped to the browser, increasing bundle size.
4. **Lazy Loading Complexity**: To lazy-load a single route, you had to create an entire `NgModule` wrapper just for that one route. Total boilerplate.
5. **Declaration Conflicts**: Accidentally declaring a component in two modules caused a runtime crash — a confusing error to debug.

---

## 3. Standalone Components — The Solution

Angular v15 made standalone components the official, recommended approach. With `standalone: true`, **the component itself becomes its own module**. It explicitly imports only what its own template uses.

### The Key Shift in Thinking

| Old Way (NgModules) | New Way (Standalone) |
|---|---|
| Module declares components | Component declares its own dependencies |
| Dependencies are implicit (via module imports) | Dependencies are explicit (via `imports: []`) |
| Tree-shaking at module level | Tree-shaking at component level (much better!) |
| Lazy load requires a module | Lazy load a single component directly |
| Hard to know what a component needs | Instantly clear — just read its `imports` |

---

## 4. Anatomy of a Standalone Component

```typescript
import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgClass, DatePipe, CurrencyPipe } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { HeaderComponent } from './layout/header.component';
import { UserService } from './core/services/user.service';

@Component({
  selector: 'app-root',
  standalone: true, // ← THE KEY FLAG. Removes need for NgModule declaration.

  // ← EXPLICIT imports: Only list what THIS component's template actually uses.
  // Prefer specific imports (NgClass) over barrel imports (CommonModule) for
  // maximum tree-shaking.
  imports: [
    NgClass,            // For [ngClass]="..." in template
    DatePipe,           // For {{ date | date:'fullDate' }} in template
    CurrencyPipe,       // For {{ price | currency }} in template
    RouterOutlet,       // For <router-outlet> in template
    RouterLink,         // For routerLink="..." in template
    RouterLinkActive,   // For routerLinkActive="..." in template
    ReactiveFormsModule,// For [formGroup]="..." in template
    HeaderComponent,    // For <app-header> in template
  ],

  // ChangeDetectionStrategy.OnPush = major performance gain.
  // Component only re-renders when:
  // (a) An @Input reference changes
  // (b) An event originates from the component
  // (c) An async pipe resolves
  // (d) A Signal value changes
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <app-header (logout)="onLogout()"></app-header>
    <main [ngClass]="{ 'is-dark': isDark() }">
      <p>Today: {{ today | date:'fullDate' }}</p>
      <router-outlet></router-outlet>
    </main>
  `,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  // Modern: use inject() instead of constructor injection
  private userService = inject(UserService);

  // Reactive state using Signals
  isDark = signal(false);
  today = new Date();

  onLogout() {
    this.userService.logout();
  }
}
```

### Why `ChangeDetectionStrategy.OnPush`?

In the default strategy, Angular re-checks the entire component tree on every event (button click, timer, HTTP response). `OnPush` tells Angular to skip this component unless something specifically relevant to it changed. For large apps with dozens of components, this can dramatically reduce CPU usage.

**Use `OnPush` everywhere by default in scalable apps.**

---

## 5. Bootstrapping the Application

Without `AppModule`, the app needs a new bootstrapping mechanism.

### 5.1 — `app.config.ts` (Global Configuration)

This file is the new `AppModule`. It's where you register providers for the entire application.

```typescript
// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,  // Auto-binds URL params to @Input() / input()
  withViewTransitions,         // Native browser View Transitions API
  withPreloading,              // Preload lazy routes in background
  PreloadAllModules
} from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Coalesces multiple rapid events into a single change detection cycle.
    // Prevents redundant processing (e.g., when both keydown and input fire).
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(
      routes,
      withComponentInputBinding(),   // Route params → @Input() automatically
      withViewTransitions(),          // Smooth page transition animations
      withPreloading(PreloadAllModules) // Load lazy routes when browser is idle
    ),

    // withFetch() uses the modern Fetch API under the hood (required for SSR edge)
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, loggingInterceptor])
    ),
  ]
};
```

### 5.2 — `main.ts` (Entry Point)

```typescript
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => {
    // In production, send this to your monitoring service (e.g., Sentry)
    console.error('Application bootstrap failed:', err);
  });
```

### 5.3 — `app.routes.ts` (Root Route Configuration)

```typescript
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Redirect root to /dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Lazy-load entire feature: no NgModule needed, just loadChildren!
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes')
                          .then(m => m.DASHBOARD_ROUTES),
    canActivate: [authGuard]
  },

  // Lazy-load a single component directly
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component')
                           .then(m => m.LoginComponent)
  },

  // 404 catch-all
  {
    path: '**',
    loadComponent: () => import('./shared/components/not-found.component')
                           .then(m => m.NotFoundComponent)
  }
];
```

---

## 6. Scalable Project Folder Structure

This is the most important architectural decision you'll make. Use a **feature-based** structure:

```
src/
├── app/
│   ├── core/                    # Singleton services, interceptors, guards — loaded ONCE
│   │   ├── guards/
│   │   │   └── auth.guard.ts
│   │   ├── interceptors/
│   │   │   ├── auth.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── user.service.ts
│   │   └── models/
│   │       └── user.model.ts
│   │
│   ├── features/                # Lazy-loaded feature areas
│   │   ├── dashboard/
│   │   │   ├── dashboard.routes.ts   # Feature-level routing
│   │   │   ├── dashboard.component.ts
│   │   │   ├── widgets/
│   │   │   │   └── stats-card.component.ts
│   │   │   └── services/
│   │   │       └── stats.service.ts  # Feature-scoped service (not singleton!)
│   │   │
│   │   ├── products/
│   │   │   ├── products.routes.ts
│   │   │   ├── list/
│   │   │   │   └── products-list.component.ts
│   │   │   └── detail/
│   │   │       └── product-detail.component.ts
│   │   │
│   │   └── auth/
│   │       ├── login.component.ts
│   │       └── register.component.ts
│   │
│   ├── shared/                  # Reusable, dumb/presentational components & pipes
│   │   ├── components/
│   │   │   ├── button.component.ts
│   │   │   ├── modal.component.ts
│   │   │   └── not-found.component.ts
│   │   ├── pipes/
│   │   │   └── truncate.pipe.ts
│   │   └── directives/
│   │       └── click-outside.directive.ts
│   │
│   ├── app.component.ts         # Root shell component (just router-outlet + header)
│   ├── app.config.ts            # Global providers
│   └── app.routes.ts            # Root routes
│
├── environments/
│   ├── environment.ts           # Development config
│   └── environment.prod.ts      # Production config
└── styles/
    ├── _variables.scss
    └── styles.scss
```

### The Rules of This Structure

- **`core/`**: Services here use `providedIn: 'root'`. They are singletons — one instance for the app's lifetime. Things like `AuthService`, `UserProfileService`, interceptors, guards.
- **`features/`**: Each feature is a self-contained island. It has its own routes, components, and optionally its own services. Features are lazy-loaded so they don't add to the initial bundle.
- **`shared/`**: Pure, presentational components that have no knowledge of business logic. A `ButtonComponent` in `shared` knows nothing about users or products.

---

## 7. Feature Modules vs. Feature Folders

You no longer need NgModules for features. Instead, you use **feature routes files** that define a child router configuration.

```typescript
// src/app/features/dashboard/dashboard.routes.ts
import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    // When parent route is 'dashboard', render DashboardComponent
    path: '',
    loadComponent: () => import('./dashboard.component')
                           .then(m => m.DashboardComponent),
    // Provide a feature-scoped service (each user of dashboard gets their own instance)
    providers: [
      import('./services/stats.service').then(m => m.StatsService)
    ]
  },
  {
    path: 'analytics',
    loadComponent: () => import('./analytics/analytics.component')
                           .then(m => m.AnalyticsComponent)
  }
];
```

---

## 8. Mixing Standalone & NgModules

You don't have to rewrite your entire app at once. Standalone components and NgModules coexist perfectly.

### 8.1 — Importing an NgModule into a Standalone Component

If a third-party library (like Angular Material) still uses NgModules internally, you can import the module directly into your standalone component's `imports` array.

```typescript
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';   // Third-party NgModule
import { MatTableModule } from '@angular/material/table';     // Third-party NgModule

@Component({
  selector: 'app-products-table',
  standalone: true,
  imports: [
    MatButtonModule,  // ✅ Perfectly valid to import an NgModule into a standalone component
    MatTableModule,
  ],
  template: `
    <table mat-table [dataSource]="products">
      <!-- ... -->
    </table>
    <button mat-raised-button color="primary">Add Product</button>
  `
})
export class ProductsTableComponent {}
```

### 8.2 — Importing a Standalone Component into an NgModule

If you have legacy code using `AppModule` and want to introduce new standalone components incrementally:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NewStandaloneCardComponent } from './card/card.component'; // Standalone

@NgModule({
  declarations: [LegacyListComponent],  // Old-style component
  imports: [
    CommonModule,
    NewStandaloneCardComponent  // ✅ Import it in 'imports', NOT 'declarations'!
  ],
  exports: [LegacyListComponent]
})
export class LegacyListModule {}
```

> ⚠️ **Critical Rule**: A standalone component must NEVER appear in the `declarations` array of an NgModule. It will throw a fatal compile error. Standalone components go in `imports`.

---

## 9. Common Pitfalls

### Pitfall 1: Forgetting to import what you use
In the NgModule world, `CommonModule` was often globally available. In standalone, you must import every directive and pipe at the component level.

```typescript
// ❌ Template error: "The pipe 'date' could not be found"
@Component({
  standalone: true,
  imports: [],  // Forgot to import DatePipe!
  template: `<p>{{ today | date:'fullDate' }}</p>`
})

// ✅ Fix:
@Component({
  standalone: true,
  imports: [DatePipe],  // Import it where you use it
  template: `<p>{{ today | date:'fullDate' }}</p>`
})
```

### Pitfall 2: Importing entire barrels unnecessarily

```typescript
// ❌ Bad for bundle size — imports ALL of CommonModule
imports: [CommonModule]

// ✅ Better — tree-shakes everything else out
imports: [NgClass, AsyncPipe, DatePipe]
```

### Pitfall 3: Declaring a Standalone Component in NgModule

```typescript
// ❌ FATAL ERROR: "StandaloneComponent is already standalone and cannot be declared"
@NgModule({
  declarations: [StandaloneComponent]  // WRONG
})
```

### Pitfall 4: Not using OnPush

```typescript
// ❌ Default change detection — re-checks every component on every event
@Component({ selector: 'app-product-card' })

// ✅ Optimal — only re-checks when inputs change or signals update
@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush
})
```

### Pitfall 5: Not lazy-loading features

```typescript
// ❌ Eager loading — all features load at startup, slowing initial load
import { DashboardComponent } from './features/dashboard/dashboard.component';
{ path: 'dashboard', component: DashboardComponent }

// ✅ Lazy loading — only loads when the user navigates to /dashboard
{
  path: 'dashboard',
  loadComponent: () => import('./features/dashboard/dashboard.component')
                         .then(m => m.DashboardComponent)
}
```

---

## 10. Try It Yourself

**Scenario**: You have a standalone `NavbarComponent` that needs to:
1. Use `routerLink` for navigation
2. Use `routerLinkActive` to highlight the current page link
3. Display the current date using the `date` pipe

**Broken Code:**
```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [], // ← FIX THIS
  template: `
    <nav>
      <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
      <a routerLink="/settings" routerLinkActive="active">Settings</a>
      <span>{{ today | date:'shortDate' }}</span>
    </nav>
  `
})
export class NavbarComponent {
  today = new Date();
}
```

> **Hint**: Each directive and pipe you use in a template must be explicitly imported in standalone components. Check which module `routerLink`, `routerLinkActive`, and `DatePipe` come from.

<details>
<summary>✅ View Solution</summary>

```typescript
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router'; // ← Routing directives
import { DatePipe } from '@angular/common';                     // ← DatePipe

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, DatePipe], // ← All three are now imported
  template: `
    <nav>
      <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
      <a routerLink="/settings" routerLinkActive="active">Settings</a>
      <span>{{ today | date:'shortDate' }}</span>
    </nav>
  `
})
export class NavbarComponent {
  today = new Date();
}
```
</details>

---

## 11. Knowledge Check

1. What is the core benefit of `standalone: true` for initial load performance?
2. What is the difference between `loadComponent` and `loadChildren` in routing?
3. In a scalable app, why should feature-level services NOT use `providedIn: 'root'`?
4. If `provideRouter(routes, withComponentInputBinding())` is set up, how does a route param `/:id` reach the component?
5. What is the risk of NOT using `ChangeDetectionStrategy.OnPush` in a large app?

<details>
<summary>✅ View Answers</summary>

1. **Lazy loading is simpler**: You can use `loadComponent` to lazy-load a single component directly in the router without needing a boilerplate `NgModule` wrapper. This means smaller initial bundles and faster startup times.

2. **`loadComponent`** lazy-loads a single standalone component (for simple routes). **`loadChildren`** lazy-loads an entire route configuration file (useful for feature areas with multiple nested routes).

3. If a feature service uses `providedIn: 'root'`, it becomes a global singleton. This means its state persists across the app lifetime and could be incorrectly shared between users or features. Feature services should be provided at the feature route level using `providers: [FeatureService]` in the route definition, so they are created and destroyed with the feature.

4. When `withComponentInputBinding()` is active, the router automatically reads the route parameter (e.g., `id = '42'`) and passes it as an `@Input()` or `input()` property to the component. No need to manually inject `ActivatedRoute`.

5. In the default `CheckAlways` strategy, Angular traverses and re-checks every component in the entire tree on every browser event (click, timer, keystroke). In an app with 50+ components, this causes massive, unnecessary CPU work. `OnPush` tells Angular to skip the component unless something specific changed, dramatically reducing DOM operations and keeping the UI smooth.
</details>

---

*Next: [02 - Signals & State Management →](./02-signals.md)*
