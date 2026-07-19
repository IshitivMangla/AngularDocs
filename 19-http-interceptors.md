# Angular: HTTP Interceptors

> **Goal**: Understand how to use functional interceptors to centralize cross-cutting concerns — auth tokens, logging, error handling, and loading states — for every HTTP request in your app.

---

## 📋 Table of Contents
1. [What is an Interceptor?](#1-what-is-an-interceptor)
2. [The Request/Response Pipeline](#2-the-requestresponse-pipeline)
3. [Creating a Functional Interceptor](#3-creating-a-functional-interceptor)
4. [Auth Token Interceptor](#4-auth-token-interceptor)
5. [Global Loading Spinner Interceptor](#5-global-loading-spinner-interceptor)
6. [Error Handling Interceptor](#6-error-handling-interceptor)
7. [Logging/Analytics Interceptor](#7-logginganalytics-interceptor)
8. [Caching Interceptor](#8-caching-interceptor)
9. [Registering Interceptors & Ordering](#9-registering-interceptors--ordering)
10. [Bypassing an Interceptor](#10-bypassing-an-interceptor)
11. [Token Refresh Pattern (Advanced)](#11-token-refresh-pattern-advanced)
12. [Common Pitfalls](#12-common-pitfalls)
13. [Try It Yourself](#13-try-it-yourself)
14. [Knowledge Check](#14-knowledge-check)

---

## 1. What is an Interceptor?

An interceptor is **middleware** for your HTTP layer. Every single HTTP request and response passes through your registered interceptors in order.

Use interceptors for concerns that apply to **many or all HTTP calls**:
- Attaching auth tokens to request headers
- Adding correlation IDs for distributed tracing
- Showing a global loading indicator
- Handling 401/403/5xx errors globally
- Logging request durations for performance monitoring
- Response caching

**Without interceptors**: You'd repeat the same logic (add auth header, catch errors, show spinner) inside every service method.

**With interceptors**: Write it once, applies to every request automatically.

---

## 2. The Request/Response Pipeline

```
Component calls http.get()
        ↓
[Interceptor 1] → modify request
        ↓
[Interceptor 2] → modify request
        ↓
[Interceptor 3] → modify request
        ↓
   Network Request (actual HTTP call)
        ↑
[Interceptor 3] → modify response
        ↑
[Interceptor 2] → modify response
        ↑
[Interceptor 1] → modify response
        ↑
Component receives the response
```

The interceptors **wrap** each other like layers of an onion. The first interceptor is the outermost layer.

### The Immutable Request Rule

`HttpRequest` objects are **immutable**. You **cannot** mutate them directly. You must:
1. Call `.clone()` to create a modified copy
2. Pass the clone to `next(clone)`

```typescript
// ❌ WRONG: Mutating the request directly — this is not allowed!
req.headers.set('Authorization', 'Bearer token');  // Returns NEW headers, doesn't mutate!

// ✅ CORRECT: Clone with modifications
const cloned = req.clone({
  setHeaders: { 'Authorization': 'Bearer token' }
});
return next(cloned);
```

---

## 3. Creating a Functional Interceptor

```typescript
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';

// A functional interceptor is just a function with this signature:
export const myInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,  // The outgoing request
  next: HttpHandlerFn          // The next handler in the chain
) => {
  // 1. Optionally modify the request (clone it first!)
  const modifiedReq = req.clone({ /* changes */ });

  // 2. Call next() to pass to the next interceptor (or the HTTP backend)
  //    next() returns an Observable<HttpEvent<unknown>>
  return next(modifiedReq).pipe(
    // 3. Optionally modify the response
  );
};
```

---

## 4. Auth Token Interceptor

The most common interceptor — attaches a JWT to every API request.

```typescript
// src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  // Don't add auth headers to:
  // - Requests without tokens (e.g., public API)
  // - Non-API requests (e.g., loading local assets like /assets/logo.svg)
  // - The token refresh endpoint itself (prevents infinite loops!)
  const isApiCall = req.url.startsWith('/api') || req.url.startsWith('https://api.');
  const isRefreshCall = req.url.includes('/auth/refresh');

  if (token && isApiCall && !isRefreshCall) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }

  return next(req);
};
```

### Adding Multiple Headers

```typescript
const enrichedReq = req.clone({
  setHeaders: {
    'Authorization': `Bearer ${token}`,
    'X-Request-ID': crypto.randomUUID(),         // For distributed tracing
    'X-App-Version': '2.5.0',                     // For API version tracking
    'Accept-Language': navigator.language         // For i18n
  }
});
```

---

## 5. Global Loading Spinner Interceptor

Track ongoing requests and show a spinner when any request is in-flight.

### Loading Service

```typescript
// src/app/core/services/loading.service.ts
import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  // Track count of active requests (multiple can run simultaneously)
  private _activeRequests = signal(0);
  readonly isLoading = computed(() => this._activeRequests() > 0);

  show() {
    this._activeRequests.update(count => count + 1);
  }

  hide() {
    this._activeRequests.update(count => Math.max(0, count - 1));
  }
}
```

### Loading Interceptor

```typescript
// src/app/core/interceptors/loading.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Skip spinner for certain low-priority requests (e.g., analytics pings)
  const skipLoading = req.headers.get('X-Skip-Loading') === 'true';
  if (skipLoading) {
    return next(req);
  }

  loadingService.show();

  return next(req).pipe(
    // finalize() runs when the observable COMPLETES or ERRORS
    // This is the Angular equivalent of a try/finally block
    finalize(() => loadingService.hide())
  );
};
```

### Spinner Component

```typescript
// src/app/shared/components/loading-spinner.component.ts
import { Component, inject } from '@angular/core';
import { LoadingService } from '../../core/services/loading.service';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    @if (loadingService.isLoading()) {
      <div class="spinner-overlay">
        <div class="spinner"></div>
      </div>
    }
  `,
  styles: [`
    .spinner-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.2);
    }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class SpinnerComponent {
  readonly loadingService = inject(LoadingService);
}
```

---

## 6. Error Handling Interceptor

Centrally handle common HTTP error codes across all requests.

```typescript
// src/app/core/interceptors/error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 0:
          // Network error (offline, CORS issue)
          toastService.showError('No internet connection. Please check your network.');
          break;

        case 401:
          // Unauthorized — session expired, invalid token
          authService.logout();
          router.navigate(['/login'], {
            queryParams: { reason: 'session_expired' }
          });
          break;

        case 403:
          // Forbidden — logged in but doesn't have permission
          router.navigate(['/access-denied']);
          break;

        case 404:
          // Not found — let the component handle it (don't show a generic toast)
          break;

        case 429:
          // Rate limited
          toastService.showWarning('Too many requests. Please wait a moment.');
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          // Server error
          toastService.showError('Server error. Our team has been notified.');
          break;
      }

      // Always re-throw so components can handle specific errors too
      return throwError(() => error);
    })
  );
};
```

---

## 7. Logging/Analytics Interceptor

Record request timing and log analytics for performance monitoring.

```typescript
// src/app/core/interceptors/logging.interceptor.ts
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { AnalyticsService } from '../services/analytics.service';

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const analytics = inject(AnalyticsService);
  const startTime = Date.now();

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const duration = Date.now() - startTime;

          // Log slow requests for performance monitoring
          if (duration > 2000) {
            console.warn(`[SLOW REQUEST] ${req.method} ${req.url} took ${duration}ms`);
          }

          // Send to analytics
          analytics.trackApiCall({
            method: req.method,
            url: req.url,
            status: event.status,
            duration
          });
        }
      },
      error: (error) => {
        const duration = Date.now() - startTime;
        console.error(`[FAILED REQUEST] ${req.method} ${req.url} failed after ${duration}ms`, error.status);
        analytics.trackApiError({ url: req.url, status: error.status, duration });
      }
    })
  );
};
```

---

## 8. Caching Interceptor

Cache GET request responses to reduce network usage.

```typescript
// src/app/core/interceptors/cache.interceptor.ts
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of, tap } from 'rxjs';
import { CacheService } from '../services/cache.service';

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  const cache = inject(CacheService);

  // Only cache GET requests
  if (req.method !== 'GET') {
    return next(req);
  }

  // Check custom header to opt out of caching
  if (req.headers.get('X-No-Cache') === 'true') {
    return next(req);
  }

  // Check if we have a cached response
  const cachedResponse = cache.get(req.url);
  if (cachedResponse) {
    return of(cachedResponse);  // Return cached response immediately!
  }

  // No cache hit — make the request and cache the response
  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse && event.status === 200) {
        cache.set(req.url, event, { ttlSeconds: 60 });  // Cache for 60 seconds
      }
    })
  );
};
```

---

## 9. Registering Interceptors & Ordering

```typescript
// app.config.ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';
import { cacheInterceptor } from './core/interceptors/cache.interceptor';

export const appConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([
        // Order matters! Executed top-down on request, bottom-up on response.
        loggingInterceptor,    // 1st — starts the timer for the full pipeline
        cacheInterceptor,      // 2nd — intercept before auth (cached responses don't need auth)
        authInterceptor,       // 3rd — add auth header
        loadingInterceptor,    // 4th — show spinner
        errorInterceptor,      // 5th — catch errors on the way back up
      ])
    )
  ]
};
```

### Execution Order Visualization

```
Request Flow (top to bottom):
1. logging   → starts timer
2. cache     → returns early if cache hit!
3. auth      → adds Bearer token
4. loading   → shows spinner
5. error     → (just passes through on request)
    ↓ Network request ↓
Response Flow (bottom to top):
5. error     → catches any 401/500 errors
4. loading   → hides spinner (via finalize)
3. auth      → (just passes through on response)
2. cache     → stores response in cache
1. logging   → logs duration
```

---

## 10. Bypassing an Interceptor

Sometimes you need to skip specific interceptors for certain requests (e.g., the token refresh call shouldn't go through the auth interceptor).

### Method 1: URL Check Inside Interceptor

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/auth/refresh')) {
    return next(req);  // Skip auth header for refresh requests
  }
  // ... add header for all other requests
};
```

### Method 2: Custom Context

```typescript
import { HttpContextToken, HttpContext } from '@angular/common/http';

// Define a context token
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

// In the interceptor
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) {
    return next(req);  // Skip this interceptor
  }
  // ... add auth header
};

// In a service — opt out of auth for a specific request
this.http.post('/auth/refresh', body, {
  context: new HttpContext().set(SKIP_AUTH, true)
});
```

---

## 11. Token Refresh Pattern (Advanced)

When a 401 is received, automatically refresh the token and retry the original request.

```typescript
// src/app/core/interceptors/token-refresh.interceptor.ts
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SKIP_AUTH } from './auth.interceptor';

let isRefreshing = false;
let refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const tokenRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only handle 401 errors that aren't from the refresh endpoint itself
      if (error.status !== 401 || req.url.includes('/auth/refresh')) {
        return throwError(() => error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshTokenSubject.next(null);

        return authService.refreshToken().pipe(
          switchMap(({ accessToken }) => {
            isRefreshing = false;
            refreshTokenSubject.next(accessToken);

            // Retry the original request with the new token
            return next(req.clone({
              setHeaders: { Authorization: `Bearer ${accessToken}` }
            }));
          }),
          catchError(refreshError => {
            isRefreshing = false;
            authService.logout();  // Refresh failed — force logout
            return throwError(() => refreshError);
          })
        );
      } else {
        // Another request is already refreshing — wait for it to complete
        return refreshTokenSubject.pipe(
          filter(token => token !== null),
          take(1),
          switchMap(token =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
          )
        );
      }
    })
  );
};
```

---

## 12. Common Pitfalls

### Pitfall 1: Mutating instead of cloning

```typescript
// ❌ WRONG: req.headers.set() returns a NEW HttpHeaders object — doesn't mutate!
req.headers.set('Authorization', 'Bearer token');  // The header is NOT added!
return next(req);

// ✅ CORRECT: Clone the request with the new header
return next(req.clone({ setHeaders: { Authorization: 'Bearer token' } }));
```

### Pitfall 2: Using `headers` instead of `setHeaders` in clone

```typescript
// ❌ This REPLACES all existing headers!
req.clone({ headers: new HttpHeaders({ 'X-Custom': 'true' }) });

// ✅ This ADDS to existing headers (preserves Content-Type, Accept, etc.)
req.clone({ setHeaders: { 'X-Custom': 'true' } });
```

### Pitfall 3: Infinite loop in token refresh

```typescript
// ❌ If auth interceptor intercepts the refresh call and gets 401 again...
// → calls refresh → 401 → calls refresh → infinite loop!

// ✅ Always skip the auth interceptor for refresh requests
const isRefreshCall = req.url.includes('/auth/refresh');
if (token && !isRefreshCall) {
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
}
return next(req);
```

### Pitfall 4: Interceptor ordering for spinner

```typescript
// ❌ If errorInterceptor is before loadingInterceptor, the spinner won't be hidden on error!
withInterceptors([errorInterceptor, loadingInterceptor])

// ✅ loadingInterceptor wraps errorInterceptor using finalize()
withInterceptors([loadingInterceptor, errorInterceptor])
```

---

## 13. Try It Yourself

Create an interceptor that adds a **request timestamp header** `X-Request-Time` to every outgoing request, and on the response, **logs** the time elapsed.

<details>
<summary>✅ View Solution</summary>

```typescript
// src/app/core/interceptors/timing.interceptor.ts
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export const timingInterceptor: HttpInterceptorFn = (req, next) => {
  const startTime = new Date();
  const timestamp = startTime.toISOString();

  // Add timestamp to request header
  const timedReq = req.clone({
    setHeaders: { 'X-Request-Time': timestamp }
  });

  return next(timedReq).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const elapsed = Date.now() - startTime.getTime();
          console.log(
            `[HTTP] ${req.method} ${req.url} completed in ${elapsed}ms with status ${event.status}`
          );
        }
      },
      error: (error) => {
        const elapsed = Date.now() - startTime.getTime();
        console.error(
          `[HTTP ERROR] ${req.method} ${req.url} failed in ${elapsed}ms — Status: ${error.status}`
        );
      }
    })
  );
};
```
</details>

---

## 14. Knowledge Check

1. Why must you clone an `HttpRequest` instead of mutating it directly?
2. What does `setHeaders` do differently from `headers` in the `.clone()` options?
3. If you have interceptors `[A, B, C]`, in what order do they process the request? The response?
4. What RxJS operator should you use to run cleanup code after an HTTP request, whether it succeeds or fails?
5. How do you prevent an interceptor from running for a specific request?

<details>
<summary>✅ View Answers</summary>

1. `HttpRequest` is **immutable by design** to prevent unintended side effects, especially when requests are retried. If the request object were mutable, retrying a request could accidentally apply modifications multiple times (e.g., appending the same auth header twice). Immutability ensures each retry gets a fresh, clean copy.

2. `setHeaders` **merges** new headers with existing ones — it only adds or overwrites the specified keys, leaving all other headers intact. `headers` **completely replaces** the entire headers object — all previously set headers (like `Content-Type`) are lost.

3. **Request flow** (outgoing): A → B → C → Network. **Response flow** (incoming): Network → C → B → A. Interceptors wrap each other like concentric circles — the first registered is the outermost wrapper.

4. `finalize()` — it runs when the Observable **completes successfully OR errors out**, equivalent to a `finally` block. This makes it perfect for hiding a loading spinner regardless of whether the request succeeded.

5. Two approaches: (1) **URL check inside the interceptor** — check `req.url` and call `return next(req)` to skip your logic. (2) **HttpContext** — define an `HttpContextToken`, check it in the interceptor, and pass it via `context: new HttpContext().set(MY_TOKEN, true)` in the service call.
</details>

---

*Next: [20 - Error Handling →](./20-error-handling.md)*
