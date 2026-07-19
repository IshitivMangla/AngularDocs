# Angular: Route Guards & Resolvers

> **Goal**: Protect routes from unauthorized access and pre-fetch data before components render — essential patterns for any production application.

---

## 📋 Table of Contents
1. [Guards vs Resolvers — Mental Model](#1-guards-vs-resolvers)
2. [Guard Types Reference](#2-guard-types-reference)
3. [Functional Guards (Modern Approach)](#3-functional-guards)
4. [`canActivate` — Authentication Guard](#4-canactivate--authentication-guard)
5. [`canActivateChild` — Protect All Children](#5-canactivatechild)
6. [`canMatch` — Conditional Route Matching](#6-canmatch)
7. [`canDeactivate` — Unsaved Changes Guard](#7-candeactivate--unsaved-changes-guard)
8. [`canLoad` — Prevent Lazy Loading](#8-canload-prevent-lazy-loading)
9. [Resolvers — Pre-fetch Data](#9-resolvers)
10. [Composing Multiple Guards](#10-composing-multiple-guards)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Try It Yourself](#12-try-it-yourself)
13. [Knowledge Check](#13-knowledge-check)

---

## 1. Guards vs Resolvers — Mental Model

| | Guards | Resolvers |
|---|---|---|
| **Job** | Bouncer — decides if you can enter | Personal shopper — prepares what you need before you enter |
| **Returns** | `true` (allow), `false` (block), `UrlTree` (redirect) | Data (Observable, Promise, or raw value) |
| **Controls** | Whether navigation proceeds | Whether navigation waits for data |
| **Failure** | Blocks navigation or redirects | Cancels navigation (if EMPTY or error) |
| **Use case** | Auth checks, permission checks | Pre-loading required page data |

---

## 2. Guard Types Reference

| Guard | When it runs | Use case |
|---|---|---|
| `canActivate` | Before component is activated | Require login |
| `canActivateChild` | Before any child route activates | Protect entire feature's children |
| `canMatch` | Before route even tries to match | Choose different routes based on user role |
| `canDeactivate` | Before leaving the current route | Warn about unsaved form changes |
| `canLoad` | Before a lazy chunk is loaded | Prevent downloading code for unauthorized users |

---

## 3. Functional Guards (Modern Approach)

Since Angular v15, guards are just **plain functions** — no need for classes or decorating with `@Injectable()`. You can use `inject()` inside them.

```typescript
// Modern functional guard — clean, composable, testable
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Return a UrlTree to redirect (never call router.navigate() and return void!)
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};
```

---

## 4. `canActivate` — Authentication Guard

The most common guard. Checks if a user is authenticated before allowing access to a route.

### Complete Auth Guard

```typescript
// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Check if user has a valid session/token
  if (auth.isAuthenticated()) {
    return true;
  }

  // Save the URL they were trying to access so we can redirect after login
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url }
  });
};
```

### Role-Based Permission Guard

```typescript
// src/app/core/guards/permission.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Read required permission from route's data property
  const requiredPermission = route.data['requiredPermission'] as string;

  if (!requiredPermission || auth.hasPermission(requiredPermission)) {
    return true;
  }

  // Redirect to an "access denied" page
  return router.createUrlTree(['/access-denied']);
};
```

```typescript
// Using in routes
{
  path: 'admin',
  loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent),
  canActivate: [authGuard, permissionGuard],
  data: { requiredPermission: 'admin:access' }  // ← Read by permissionGuard
}
```

### Consuming `returnUrl` After Login

```typescript
// login.component.ts
export class LoginComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  onLogin(credentials: LoginDto) {
    this.authService.login(credentials).subscribe(() => {
      // Redirect to where the user was trying to go
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] ?? '/dashboard';
      this.router.navigateByUrl(returnUrl, { replaceUrl: true });
    });
  }
}
```

---

## 5. `canActivateChild`

Protects all child routes under a parent without adding the guard to each child individually.

```typescript
// src/app/core/guards/auth.guard.ts — same function handles both!
import { CanActivateFn, CanActivateChildFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => { /* ... */ };

// Re-export as canActivateChild type (same logic)
export const authChildGuard: CanActivateChildFn = (childRoute, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() || router.createUrlTree(['/login']);
};
```

```typescript
// Applying to protect all children
{
  path: 'app',
  component: AppLayoutComponent,
  canActivateChild: [authChildGuard],  // ← Protects ALL children automatically
  children: [
    { path: 'dashboard', component: DashboardComponent },  // Protected!
    { path: 'profile', component: ProfileComponent },      // Protected!
    { path: 'settings', component: SettingsComponent },    // Protected!
  ]
}
```

---

## 6. `canMatch`

`canMatch` controls whether a **route even tries to match** the URL. If it returns false, the router continues to the next route in the array. This is powerful for showing completely different layouts/components based on user role.

```typescript
// admin-route.guard.ts
import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminRouteGuard: CanMatchFn = () => {
  return inject(AuthService).isAdmin();
};
```

```typescript
// routes.ts — same URL, different components based on role!
export const routes: Routes = [
  {
    path: 'dashboard',
    canMatch: [adminRouteGuard],                    // ← Only matches if admin
    loadComponent: () => import('./admin-dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: 'dashboard',
    // ← This matches for non-admins (adminRouteGuard returned false above)
    loadComponent: () => import('./user-dashboard.component').then(m => m.UserDashboardComponent)
  }
];
```

---

## 7. `canDeactivate` — Unsaved Changes Guard

Prevents users from accidentally losing their work when navigating away from a form with unsaved changes.

### Define the Guard Interface

```typescript
// src/app/core/guards/unsaved-changes.guard.ts
import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { DialogService } from '../services/dialog.service';

// Interface that "deactivatable" components must implement
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
  if (!component.hasUnsavedChanges()) {
    return true; // No changes — allow navigation
  }

  // Use a proper modal dialog instead of window.confirm (which blocks the UI)
  const dialogService = inject(DialogService);
  const confirmed = await dialogService.confirm({
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. If you leave, your changes will be lost.',
    confirmText: 'Leave anyway',
    cancelText: 'Stay and save'
  });

  return confirmed;
};
```

### Apply to a Form Component

```typescript
// product-edit.component.ts
import { Component, inject, signal } from '@angular/core';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';

@Component({ ... })
export class ProductEditComponent implements HasUnsavedChanges {
  private originalValue = signal<any>(null);
  form = inject(FormBuilder).group({ /* ... */ });

  ngOnInit() {
    // Store the original state
    this.originalValue.set(this.form.value);
  }

  // Guard calls this to check if navigation should be blocked
  hasUnsavedChanges(): boolean {
    return this.form.dirty; // True if any control has been modified
  }

  save() {
    // After saving, mark form as pristine (no longer "dirty")
    this.form.markAsPristine();
  }
}
```

```typescript
// Route configuration
{
  path: 'products/:id/edit',
  loadComponent: () => import('./product-edit.component').then(m => m.ProductEditComponent),
  canDeactivate: [unsavedChangesGuard]
}
```

---

## 8. `canLoad` — Prevent Lazy Loading

Prevents the router from even **downloading the JavaScript bundle** for a route if the user doesn't have access. More security than `canActivate` because the code is never sent to the client.

```typescript
import { CanLoadFn } from '@angular/router';

export const adminLoadGuard: CanLoadFn = () => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) {
    return true;
  }
  inject(Router).navigate(['/access-denied']);
  return false;
};
```

```typescript
// Route — prevents downloading admin bundle entirely for non-admins
{
  path: 'admin',
  canLoad: [adminLoadGuard],
  loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
}
```

> **Note**: In Angular v15+, `canMatch` largely supersedes `canLoad` because it's more flexible. Use `canMatch` in new code.

---

## 9. Resolvers — Pre-fetch Data

A resolver fetches data **before** the component renders, so the component always receives its data immediately without flashing empty states.

### When to Use Resolvers

✅ Use resolvers when:
- The data is small/fast to load
- The component CANNOT function without the data
- You want to prevent the user from seeing an empty/broken state

❌ Avoid resolvers when:
- The API is slow (user sees a frozen page with no feedback)
- The data isn't critical (show a skeleton loader instead)

### Complete Resolver Example

```typescript
// src/app/features/products/resolvers/product.resolver.ts
import { inject } from '@angular/core';
import { ResolveFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, EMPTY } from 'rxjs';
import { Product } from '../product.model';

export const productResolver: ResolveFn<Product> = (route: ActivatedRouteSnapshot) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const productId = route.paramMap.get('id');

  if (!productId) {
    router.navigate(['/404']);
    return EMPTY;  // EMPTY completes without emitting — cancels navigation
  }

  return http.get<Product>(`/api/products/${productId}`).pipe(
    catchError(error => {
      if (error.status === 404) {
        router.navigate(['/404']);
      } else {
        router.navigate(['/error']);
      }
      return EMPTY;
    })
  );
};
```

### Using Resolved Data in the Component

```typescript
// Route definition
{
  path: 'products/:id',
  loadComponent: () => import('./product-detail.component').then(m => m.ProductDetailComponent),
  resolve: { product: productResolver },  // ← Resolver result available as 'product'
  data: { breadcrumb: 'Product Details' }
}
```

```typescript
// product-detail.component.ts
// With withComponentInputBinding() — resolved data is auto-bound to @Input()
import { Component, input } from '@angular/core';
import { Product } from '../product.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  template: `
    @if (product(); as p) {
      <h1>{{ p.name }}</h1>
      <p>{{ p.description }}</p>
      <span>{{ p.price | currency }}</span>
    }
  `
})
export class ProductDetailComponent {
  // ✅ The resolver's result is automatically passed as an input!
  product = input<Product>();
}
```

### Multiple Resolvers

```typescript
// Resolve multiple data sources before showing the component
{
  path: 'checkout',
  loadComponent: () => import('./checkout.component').then(m => m.CheckoutComponent),
  resolve: {
    cart: cartResolver,        // Cart items
    user: currentUserResolver, // User profile
    addresses: addressResolver // Saved addresses
  }
}

// All three are available as inputs in CheckoutComponent!
export class CheckoutComponent {
  cart = input<CartItem[]>([]);
  user = input<User | null>(null);
  addresses = input<Address[]>([]);
}
```

---

## 10. Composing Multiple Guards

Guards in the same array are evaluated in order. If any guard returns `false` or a `UrlTree`, navigation stops.

```typescript
// Order matters: auth first, then permissions
{
  path: 'admin/users',
  canActivate: [
    authGuard,         // ← Must be logged in first
    permissionGuard,   // ← Then check admin permission
  ],
  data: { requiredPermission: 'users:manage' }
}
```

### Utility: Creating a Guard Factory

```typescript
// A guard factory that creates a guard for a specific permission
export function requirePermission(permission: string): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.hasPermission(permission) || router.createUrlTree(['/access-denied']);
  };
}

// Usage — clean and readable!
{
  path: 'reports',
  canActivate: [authGuard, requirePermission('reports:view')],
}
{
  path: 'billing',
  canActivate: [authGuard, requirePermission('billing:manage')],
}
```

---

## 11. Common Pitfalls

### Pitfall 1: Calling `router.navigate()` and returning void in a guard

```typescript
// ❌ Guard returns void (undefined) — Angular doesn't know what to do
export const badGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!isLoggedIn()) {
    router.navigate(['/login']);  // Fires, but guard returns nothing!
    return;                       // undefined — navigation may continue!
  }
  return true;
};

// ✅ Always return a UrlTree for redirects
export const goodGuard: CanActivateFn = () => {
  const router = inject(Router);
  return isLoggedIn() || router.createUrlTree(['/login']);
};
```

### Pitfall 2: Guarding the login route with authGuard

```typescript
// ❌ Infinite redirect loop!
// authGuard on /login redirects to /login, which runs authGuard again...
{ path: 'login', component: LoginComponent, canActivate: [authGuard] }

// ✅ Login page should be PUBLIC
{ path: 'login', component: LoginComponent }  // No guard!
```

### Pitfall 3: Slow resolvers with bad UX

```typescript
// ❌ If /api/products takes 3 seconds, the user sees a frozen screen for 3 seconds
// after clicking a link. No progress indicator, no feedback.
resolve: { products: productsResolver }

// ✅ Better: Use resolver only for critical, fast data.
// For slow data, let the component show a skeleton loader.
```

### Pitfall 4: Resolver returning an error observable instead of EMPTY

```typescript
// ❌ If the observable errors out (not EMPTY), Angular may throw an unhandled error
return http.get('/api/product/999').pipe(
  catchError(() => throwError(() => new Error('Not found')))  // ERROR!
);

// ✅ Return EMPTY to cancel navigation silently
return http.get('/api/product/999').pipe(
  catchError(() => {
    router.navigate(['/404']);
    return EMPTY;  // Silently cancels navigation
  })
);
```

---

## 12. Try It Yourself

You need a `roleGuard` that:
1. Checks if the user is logged in (if not, redirect to `/login`)
2. Checks if the user has the role `'admin'` (if not, redirect to `/home`)
3. Reads the required role from `route.data['role']` so it can be reused

**Broken Code:**
```typescript
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const requiredRole = route.data['role'];

  // ❌ BUG 1: not returning the redirect UrlTree properly
  // ❌ BUG 2: doesn't check if user is logged in first
  if (auth.userRole !== requiredRole) {
    inject(Router).navigate(['/home']);
  }
  return true;
};
```

<details>
<summary>✅ View Solution</summary>

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requiredRole = route.data['role'] as string;

  // ✅ Step 1: Check authentication first
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  // ✅ Step 2: Check role
  if (requiredRole && !auth.hasRole(requiredRole)) {
    return router.createUrlTree(['/home']);
  }

  // ✅ Step 3: All good — allow navigation
  return true;
};
```

Usage:
```typescript
{
  path: 'admin/reports',
  canActivate: [roleGuard],
  data: { role: 'admin' },
  loadComponent: () => import('./reports.component').then(m => m.ReportsComponent)
}
```
</details>

---

## 13. Knowledge Check

1. What is the difference between `canActivate` and `canMatch`?
2. Why should you return `router.createUrlTree(['/login'])` instead of calling `router.navigate(['/login'])` and returning `false` in a guard?
3. What happens to router navigation when a resolver returns `EMPTY`?
4. Why is `canDeactivate` important for forms?
5. In what order do `canActivate` guards in an array execute?

<details>
<summary>✅ View Answers</summary>

1. `canActivate` runs **after** the route has been matched (Angular already decided this route applies). If it returns `false`, the component is not rendered, but the URL has already "matched". `canMatch` runs **before** matching — if it returns `false`, Angular skips this route entirely and tries the next one in the routes array. `canMatch` is more powerful: the same URL can render different components based on user role.

2. `router.navigate()` is imperative and doesn't tell the router what to do with the guard's return value. By returning `void` after a navigate, the guard technically returns `undefined`, which Angular treats as a failed guard without a clean redirect. Returning a `UrlTree` from `router.createUrlTree()` cleanly instructs the router's internal navigation pipeline to perform a redirect, handling browser history correctly.

3. When a resolver returns `EMPTY` (an Observable that completes without emitting any values), Angular **cancels the navigation entirely**. The user stays on their current page. This is the correct pattern for "data not found" scenarios where you also want to redirect to a 404 page.

4. Without `canDeactivate`, if a user has filled out a form and accidentally clicks the Back button or navigates to another page, all their input is silently lost. `canDeactivate` intercepts the navigation event and gives the user a chance to confirm they want to leave, preventing accidental data loss.

5. Guards in the `canActivate` array execute **in order from left to right**. If the first guard returns `false` or a `UrlTree`, the remaining guards **do not execute**. This means you should put cheaper/faster guards first (e.g., `authGuard` before `permissionGuard`) to avoid unnecessary computation.
</details>

---

*Next: [14 - Deferrable Views →](./14-deferrable-views.md)*
