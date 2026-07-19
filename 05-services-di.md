# Angular: Services & Dependency Injection (DI)

> **Goal**: Understand Angular's DI system deeply enough to design clean, testable, and scalable service architectures — the backbone of any enterprise Angular app.

---

## 📋 Table of Contents
1. [What is a Service?](#1-what-is-a-service)
2. [The DI Injector Tree](#2-the-di-injector-tree)
3. [Creating Services — Modern `inject()` Function](#3-creating-services)
4. [Provider Scopes](#4-provider-scopes)
5. [Injection Tokens — Injecting Non-Classes](#5-injection-tokens)
6. [Multi-Providers](#6-multi-providers)
7. [Swapping Implementations (`useClass`, `useFactory`)](#7-swapping-implementations)
8. [Platform Injector & Environment Injector](#8-platform-injector)
9. [Designing a Scalable Service Layer](#9-designing-a-scalable-service-layer)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Try It Yourself](#11-try-it-yourself)
12. [Knowledge Check](#12-knowledge-check)

---

## 1. What is a Service?

A **service** is a plain TypeScript class decorated with `@Injectable()`. While components handle the UI, services handle **everything else**:

- **Data fetching**: HTTP requests, GraphQL, WebSockets
- **Shared state**: Shopping cart, user profile, notification count
- **Business logic**: Validation, calculations, transformations
- **Side effects**: Analytics, logging, local storage

### The Single Responsibility Principle

Each service should do **one thing well**. Don't create a giant `AppService` that does everything.

```
UserService       — CRUD operations for user data
AuthService       — authentication state & token management
CartService       — shopping cart state management
LoggingService    — centralized error/event logging
NotificationService — toast/alert UI notifications
```

---

## 2. The DI Injector Tree

Angular builds a **hierarchical tree of Injectors** that mirrors your component tree. When a component asks for a service, Angular walks **up** the injector tree until it finds a provider.

```
Platform Injector (highest — browser APIs like Document)
  └── Environment/Root Injector (app-wide singletons from providedIn: 'root')
        └── Route Injector (providers registered in route's providers: [])
              └── Component Injector (providers in @Component.providers: [])
                    └── Child Component Injector
```

### Practical Impact

```typescript
// auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  // ONE instance, shared by EVERY component in the app
  // All components see the same user state
}
```

```typescript
// user-dropdown.component.ts
@Component({
  selector: 'app-user-dropdown',
  providers: [DropdownStateService]  // NEW instance for THIS component only
})
export class UserDropdownComponent {
  // Each UserDropdownComponent gets its OWN DropdownStateService
  // Destroyed when the component is destroyed
}
```

---

## 3. Creating Services — Modern `inject()` Function

### Step 1: Create the Service

```typescript
// src/app/core/services/user.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'  // ← Singleton: one instance for the entire app
})
export class UserService {
  private http = inject(HttpClient);

  // Private writable signal — prevents external mutation
  private _currentUser = signal<User | null>(null);
  private _users = signal<User[]>([]);
  private _isLoading = signal(false);

  // Public read-only signals — what components get to see
  readonly currentUser = this._currentUser.asReadonly();
  readonly users = this._users.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);
  readonly userCount = computed(() => this._users().length);

  // --- HTTP Methods ---
  loadUsers(): Observable<User[]> {
    this._isLoading.set(true);
    return this.http.get<User[]>('/api/users').pipe(
      tap(users => {
        this._users.set(users);
        this._isLoading.set(false);
      }),
      catchError(err => {
        this._isLoading.set(false);
        return throwError(() => err);
      })
    );
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`/api/users/${id}`);
  }

  updateUser(id: number, changes: Partial<User>): Observable<User> {
    return this.http.patch<User>(`/api/users/${id}`, changes).pipe(
      tap(updated => {
        // Update the local cache
        this._users.update(users =>
          users.map(u => u.id === id ? { ...u, ...updated } : u)
        );
      })
    );
  }

  // --- State Methods ---
  setCurrentUser(user: User | null) {
    this._currentUser.set(user);
  }
}
```

### Step 2: Consume the Service in a Component

```typescript
// user-list.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { CurrencyPipe, DatePipe } from '@angular/common';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (userService.isLoading()) {
      <div class="skeleton-list">Loading users...</div>
    } @else {
      <p>{{ userService.userCount() }} users found</p>

      @for (user of userService.users(); track user.id) {
        <div class="user-card">
          <h3>{{ user.name }}</h3>
          <p>{{ user.email }}</p>
          <small>Joined: {{ user.createdAt | date:'mediumDate' }}</small>
        </div>
      } @empty {
        <p class="empty-state">No users yet.</p>
      }
    }
  `
})
export class UserListComponent implements OnInit {
  // ✅ Modern inject() — cleaner than constructor injection
  readonly userService = inject(UserService);

  ngOnInit() {
    // Subscribe to the observable and trigger the HTTP call
    this.userService.loadUsers().subscribe();
  }
}
```

### Why `inject()` Over Constructor Injection?

```typescript
// ❌ OLD: Constructor injection
export class UserListComponent {
  constructor(
    private userService: UserService,
    private router: Router,
    private analyticsService: AnalyticsService,
    private toastService: ToastService
  ) {
    // The constructor is bloated with dependency declarations
  }
}

// ✅ NEW: inject() — cleaner, works in inheritance, works in functions
export class UserListComponent {
  private userService = inject(UserService);
  private router = inject(Router);
  private analyticsService = inject(AnalyticsService);
  private toastService = inject(ToastService);
  // Constructor can now be empty or omitted entirely
}
```

**Benefits of `inject()`:**
1. **Inheritance**: Child class doesn't need to pass dependencies to `super()`.
2. **Reusable Functions**: You can use `inject()` inside standalone functions (guards, interceptors, resolvers) — not just class constructors.
3. **Less Boilerplate**: No need to annotate constructor parameters.

---

## 4. Provider Scopes

Understanding where to provide a service determines how many instances exist and who shares state.

### Scope 1: Root (Global Singleton)

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService { }
// ONE instance exists for the entire app lifetime.
// Perfect for: Authentication, user profile, shopping cart, notifications.
```

### Scope 2: Component-level (Local Instance)

```typescript
@Component({
  selector: 'app-accordion',
  providers: [AccordionStateService]  // ← New instance per component!
})
export class AccordionComponent { }
// Each AccordionComponent gets its own AccordionStateService.
// Destroyed when the component is destroyed.
// Perfect for: UI state, form state, local pagination.
```

### Scope 3: Feature-level (Route Providers)

```typescript
// products.routes.ts
export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./products-list.component').then(m => m.ProductsListComponent),
    // This service is only created when user enters the /products route
    // Destroyed when user leaves /products
    providers: [ProductsFilterService, ProductsPaginationService]
  }
];
```

### Summary

| Where to Provide | Instances | Lifespan | Use Case |
|---|---|---|---|
| `providedIn: 'root'` | 1 (global) | App lifetime | Auth, cart, user profile |
| `providers` in `@Component` | 1 per component | Component lifetime | Local UI state |
| `providers` in route | 1 per route visit | Route lifetime | Feature-scoped state |

---

## 5. Injection Tokens — Injecting Non-Classes

`InjectionToken` lets you inject strings, numbers, objects, or functions — anything that isn't a TypeScript class.

### Configuration Tokens

```typescript
// src/app/core/tokens/app-config.token.ts
import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiBaseUrl: string;
  maxUploadSizeMB: number;
  featureFlags: { darkMode: boolean; betaFeatures: boolean };
}

// Create a typed token
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
```

```typescript
// app.config.ts — provide the value
import { APP_CONFIG } from './core/tokens/app-config.token';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_CONFIG,
      useValue: {
        apiBaseUrl: environment.apiUrl,
        maxUploadSizeMB: 10,
        featureFlags: { darkMode: true, betaFeatures: !environment.production }
      }
    }
  ]
};
```

```typescript
// Any service or component — inject and use it
import { Component, inject } from '@angular/core';
import { APP_CONFIG } from './core/tokens/app-config.token';

@Component({ ... })
export class SettingsComponent {
  private config = inject(APP_CONFIG);

  showBetaFeatures = this.config.featureFlags.betaFeatures;
  maxUploadSize = this.config.maxUploadSizeMB;
}
```

### Platform Tokens (Injecting Browser APIs)

```typescript
import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);

  setTheme(theme: 'light' | 'dark') {
    // Only manipulate the DOM in the browser (not during SSR)
    if (isPlatformBrowser(this.platformId)) {
      this.document.documentElement.setAttribute('data-theme', theme);
    }
  }
}
```

---

## 6. Multi-Providers

Multi-providers let multiple classes contribute to the same token, creating an array. This is how Angular's own `HTTP_INTERCEPTORS` and validators work internally.

```typescript
// Define the token
export const ANALYTICS_PLUGINS = new InjectionToken<AnalyticsPlugin[]>('ANALYTICS_PLUGINS');

// Provide multiple implementations for the same token
export const appConfig = {
  providers: [
    { provide: ANALYTICS_PLUGINS, useClass: GoogleAnalyticsPlugin, multi: true },
    { provide: ANALYTICS_PLUGINS, useClass: MixpanelPlugin, multi: true },
    { provide: ANALYTICS_PLUGINS, useClass: DatadogPlugin, multi: true },
  ]
};

// Inject as an array
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private plugins = inject(ANALYTICS_PLUGINS);  // Type: AnalyticsPlugin[]

  track(event: string, data: any) {
    // Send to all registered analytics providers simultaneously
    this.plugins.forEach(plugin => plugin.track(event, data));
  }
}
```

---

## 7. Swapping Implementations

### `useClass` — Substitute a Different Class

```typescript
// Perfect for environment-based swapping or testing
import { LoggerService, ConsoleLogger, CloudLogger } from './logging';
import { environment } from '../environments/environment';

export const appConfig = {
  providers: [
    {
      provide: LoggerService,
      // Swap implementations without changing any component code!
      useClass: environment.production ? CloudLogger : ConsoleLogger
    }
  ]
};
```

### `useFactory` — Dynamic Creation

```typescript
// Use a factory function when the implementation depends on runtime conditions
export const appConfig = {
  providers: [
    {
      provide: StorageService,
      useFactory: () => {
        // Choose implementation based on browser support
        if (typeof IndexedDB !== 'undefined') {
          return new IndexedDBStorageService();
        } else {
          return new LocalStorageService();
        }
      },
      // Dependencies to inject into the factory function
      deps: [DOCUMENT, PLATFORM_ID]
    }
  ]
};
```

### `useExisting` — Alias One Token to Another

```typescript
// Make both tokens point to the same instance
export const appConfig = {
  providers: [
    UserService,
    // When someone asks for CurrentUserService, give them the UserService instance
    { provide: CurrentUserService, useExisting: UserService }
  ]
};
```

---

## 8. Platform Injector

Some APIs need to be different in the browser vs. SSR. Use platform-aware injections:

```typescript
import { Injectable, inject, PLATFORM_ID, InjectionToken } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private platformId = inject(PLATFORM_ID);

  readonly isBrowser = isPlatformBrowser(this.platformId);
  readonly isServer = isPlatformServer(this.platformId);

  getLocalStorage(): Storage | null {
    if (this.isBrowser) {
      return window.localStorage;
    }
    return null; // localStorage doesn't exist in Node.js (SSR)
  }
}
```

---

## 9. Designing a Scalable Service Layer

### Pattern 1: Repository Pattern (Data Access Layer)

Separate "what data to fetch" from "how to display it":

```typescript
// ✅ Repository: Pure data access, no UI concerns
@Injectable({ providedIn: 'root' })
export class UserRepository {
  private http = inject(HttpClient);

  findAll(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }

  findById(id: number): Observable<User> {
    return this.http.get<User>(`/api/users/${id}`);
  }

  save(user: Partial<User>): Observable<User> {
    if (user.id) {
      return this.http.patch<User>(`/api/users/${user.id}`, user);
    }
    return this.http.post<User>('/api/users', user);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}

// ✅ Service: Business logic, state management
@Injectable({ providedIn: 'root' })
export class UserFacadeService {
  private repo = inject(UserRepository);
  private users = signal<User[]>([]);
  readonly users$ = this.users.asReadonly();

  loadUsers() {
    return this.repo.findAll().pipe(tap(users => this.users.set(users)));
  }

  deactivateUser(id: number) {
    return this.repo.save({ id, isActive: false }).pipe(
      tap(updated => this.users.update(list =>
        list.map(u => u.id === id ? updated : u)
      ))
    );
  }
}
```

### Pattern 2: Facade Pattern

A facade service is the single public API for a feature, hiding complexity:

```typescript
@Injectable({ providedIn: 'root' })
export class ProductFacade {
  private productRepo = inject(ProductRepository);
  private categoryRepo = inject(CategoryRepository);
  private inventoryService = inject(InventoryService);

  // One method that coordinates multiple services
  loadProductsPage() {
    return forkJoin({
      products: this.productRepo.findAll(),
      categories: this.categoryRepo.findAll(),
      lowStock: this.inventoryService.getLowStockAlerts()
    });
  }
}
```

---

## 10. Common Pitfalls

### Pitfall 1: Using `inject()` outside of injection context

```typescript
// ❌ ERROR: inject() must be called during construction
@Component({ ... })
export class DemoComponent {
  ngOnInit() {
    const service = inject(UserService);  // Error! Too late.
  }
}

// ✅ Use it during construction (property initialization or constructor)
@Component({ ... })
export class DemoComponent {
  private userService = inject(UserService);  // Fine — during construction
}
```

### Pitfall 2: State leakage in SSR

```typescript
// ❌ DANGEROUS: This variable is shared across all users in SSR!
let globalCache: any[] = [];  // Module-level variable

@Injectable({ providedIn: 'root' })
export class CacheService {
  getData() { return globalCache; }
}

// ✅ Safe: State is inside the class instance (isolated per request in SSR)
@Injectable({ providedIn: 'root' })
export class CacheService {
  private cache: any[] = [];  // Instance property — per-request in SSR
  getData() { return this.cache; }
}
```

### Pitfall 3: Circular dependency

```typescript
// ❌ ServiceA imports ServiceB which imports ServiceA = circular!
// Angular throws: "Cannot instantiate cyclic dependency!"

// ✅ Extract shared logic into a third service that both use:
@Injectable({ providedIn: 'root' })
export class SharedLogicService { ... }

@Injectable({ providedIn: 'root' })
export class ServiceA {
  private shared = inject(SharedLogicService);  // No cycle!
}
```

### Pitfall 4: Not using `asReadonly()` for public signals in services

```typescript
// ❌ Components can directly mutate service state!
export class CartService {
  items = signal<CartItem[]>([]);  // Public & writable = chaos!
}

// ✅ Expose only read-only access
export class CartService {
  private _items = signal<CartItem[]>([]);
  readonly items = this._items.asReadonly();

  addItem(item: CartItem) {
    this._items.update(i => [...i, item]);
  }
}
```

---

## 11. Try It Yourself

Create a `ThemeService` that:
1. Stores the current theme (`'light' | 'dark'`) in a signal
2. Persists the theme to `localStorage`
3. Reads the initial value from `localStorage` on startup (fallback: `'light'`)
4. Has a `toggleTheme()` method
5. Exposes a computed signal `isDark` for easy template binding

<details>
<summary>✅ View Solution</summary>

```typescript
import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);

  // Read initial theme from localStorage, fallback to 'light'
  private _theme = signal<Theme>(this.getStoredTheme());

  // Expose read-only views
  readonly theme = this._theme.asReadonly();
  readonly isDark = computed(() => this._theme() === 'dark');

  constructor() {
    // Persist theme to localStorage whenever it changes
    effect(() => {
      const currentTheme = this._theme();
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('theme', currentTheme);
        document.documentElement.setAttribute('data-theme', currentTheme);
      }
    });
  }

  toggleTheme() {
    this._theme.update(t => t === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: Theme) {
    this._theme.set(theme);
  }

  private getStoredTheme(): Theme {
    if (isPlatformBrowser(this.platformId)) {
      return (localStorage.getItem('theme') as Theme) ?? 'light';
    }
    return 'light';
  }
}
```

Usage in a component:
```typescript
@Component({
  template: `
    <button (click)="themeService.toggleTheme()">
      {{ themeService.isDark() ? '☀️ Light Mode' : '🌙 Dark Mode' }}
    </button>
  `
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);
}
```
</details>

---

## 12. Knowledge Check

1. If two sibling components both inject `ThemeService` with `providedIn: 'root'`, do they share state?
2. What is the difference between `useValue`, `useClass`, and `useFactory`?
3. Why can't you call `inject()` inside `ngOnInit()`?
4. When would you choose to provide a service in `@Component.providers` instead of `providedIn: 'root'`?
5. What is the purpose of `InjectionToken`, and when is it needed over just providing a class?

<details>
<summary>✅ View Answers</summary>

1. **Yes** — `providedIn: 'root'` creates a single singleton instance in the Root Injector. Both components inject the exact same instance, so any state changes in one component are immediately visible in the other.

2. **`useValue`**: Provide a static, pre-created value (a string, object literal, boolean). **`useClass`**: Tell Angular to create an instance of a different class when this token is requested. **`useFactory`**: Provide a function that creates the value dynamically at runtime (useful when the implementation depends on other injected values or runtime conditions).

3. `inject()` is only valid during the **construction phase** of a class — i.e., as a class property initializer or inside the `constructor()`. By the time `ngOnInit()` runs, Angular's DI context has already completed. Calling `inject()` at that point results in a `NG0203` error.

4. Provide a service in `@Component.providers` when: (a) Each component instance needs its own isolated state (e.g., each `DatePickerComponent` has its own `DatePickerStateService`), or (b) you want the service destroyed when the component is destroyed.

5. `InjectionToken` is needed when you want to inject something that isn't a TypeScript class — such as a configuration string, a boolean feature flag, a plain object, or a function. Without a class to use as the token, Angular has no way to look up the correct value in the injector hierarchy. `InjectionToken` provides a unique, type-safe key for the DI system.
</details>

---

*Next: [06 - HttpClient & RxJS →](./06-http-rxjs.md)*
