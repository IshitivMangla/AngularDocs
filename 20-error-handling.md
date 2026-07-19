# Angular: Global Error Handling & Resilience

> **Goal**: Build production-ready error handling strategies — custom global `ErrorHandler`, centralized logging, Sentry/Datadog integration, and local RxJS error recovery.

---

## 📋 Table of Contents
1. [Error Handling Architecture](#1-error-handling-architecture)
2. [Global Error Handler (`ErrorHandler`)](#2-global-error-handler-errorhandler)
3. [Zone-Safe Error Dispatching](#3-zone-safe-error-dispatching)
4. [Integrating Remote Monitoring (Sentry, Datadog)](#4-integrating-remote-monitoring-sentry-datadog)
5. [Local Error Handling with RxJS](#5-local-error-handling-with-rxjs)
6. [HTTP Error Interceptor vs Global Handler](#6-http-error-interceptor-vs-global-handler)
7. [User-Facing Error UI (Toast & Dialog)](#7-user-facing-error-ui-toast--dialog)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Try It Yourself](#9-try-it-yourself)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. Error Handling Architecture

A robust Angular app uses a multi-layered error handling strategy:

```
Uncaught Exceptions / Runtime Errors / Unhandled Promises
                         │
                         ▼
             [Global ErrorHandler]
             ├── Logs stack trace to console
             ├── Sends error report to Sentry / Datadog
             └── Displays user-friendly Toast/Notification (via NgZone)

HTTP API Errors (4xx, 5xx, Network failure)
                         │
                         ▼
             [HTTP Error Interceptor]
             ├── Handles 401 (redirect to login)
             ├── Handles 403 (access denied)
             ├── Retries transient 5xx errors
             └── Passes domain errors to feature services

Feature Services / Components
                         │
                         ▼
             [RxJS catchError()]
             └── Graceful fallback UI (empty state, inline alert)
```

---

## 2. Global Error Handler (`ErrorHandler`)

By default, Angular logs uncaught errors to `console.error()`. Override `ErrorHandler` to handle uncaught exceptions globally.

```typescript
// src/app/core/errors/global-error-handler.ts
import { ErrorHandler, Injectable, inject, NgZone } from '@angular/core';
import { ToastService } from '../services/toast.service';
import { LoggerService } from '../services/logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private toastService = inject(ToastService);
  private logger = inject(LoggerService);
  private zone = inject(NgZone);

  handleError(error: unknown): void {
    // 1. Extract error details
    const message = this.extractMessage(error);
    const stack = this.extractStack(error);

    // 2. Log locally to console
    console.error('[GlobalErrorHandler]', error);

    // 3. Log to external monitoring (Sentry / Datadog)
    this.logger.logError({ message, stack, originalError: error });

    // 4. Show user-friendly toast (must be wrapped in zone.run!)
    this.zone.run(() => {
      this.toastService.showError(
        'An unexpected error occurred. Our engineering team has been notified.'
      );
    });
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as any).message);
    }
    return 'Unknown error';
  }

  private extractStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }
}
```

### Register in `app.config.ts`

```typescript
import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './core/errors/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    // Override default ErrorHandler provider
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
```

---

## 3. Zone-Safe Error Dispatching

Global errors (especially unhandled Promise rejections) frequently occur **outside Angular's Change Detection Zone**.

If you attempt to update UI state or trigger a Toast inside `handleError` without `NgZone.run()`, the UI update will be missed until the next user click!

```typescript
// ❌ WRONG: UI might not update immediately
handleError(error: any) {
  this.toastService.showError('Error occurred!'); // Might fail to render!
}

// ✅ CORRECT: Force change detection by running inside NgZone
handleError(error: any) {
  this.zone.run(() => {
    this.toastService.showError('Error occurred!'); // Renders immediately
  });
}
```

---

## 4. Integrating Remote Monitoring (Sentry, Datadog)

```typescript
// src/app/core/services/logger.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface LogPayload {
  message: string;
  stack?: string;
  originalError?: unknown;
}

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  logError(payload: LogPayload): void {
    if (!this.isBrowser) return;

    // Send to Sentry (if installed)
    // Sentry.captureException(payload.originalError ?? new Error(payload.message));

    // Send to custom logging endpoint
    if (location.hostname !== 'localhost') {
      fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: payload.message,
          stack: payload.stack,
          url: location.href,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {/* Ignore logging network failures */});
    }
  }
}
```

---

## 5. Local Error Handling with RxJS

Catch and recover from errors at the service or component level.

### Graceful Fallback Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/products').pipe(
      retry({ count: 2, delay: 1000 }), // Retry up to 2 times with 1s delay
      catchError(error => {
        console.warn('Failed to load products, returning empty list fallback', error);
        // Recover gracefully with an empty list instead of throwing
        return of([]);
      })
    );
  }
}
```

### Re-throwing Custom Errors

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  login(credentials: LoginDto): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', credentials).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return throwError(() => new Error('Invalid email or password.'));
        }
        if (error.status === 429) {
          return throwError(() => new Error('Too many login attempts. Please try again later.'));
        }
        return throwError(() => new Error('Authentication failed. Please try again.'));
      })
    );
  }
}
```

---

## 6. HTTP Error Interceptor vs Global Handler

| Feature | HTTP Interceptor | Global `ErrorHandler` |
|---|---|---|
| **Catches** | HTTP network requests | Any uncaught runtime JS error |
| **Scope** | Network layer | Entire application |
| **Examples** | 401 Unauthorized, 404, 500 | `undefined is not a function`, template rendering bugs |
| **Recovery** | Retries, token refresh, redirects | Reporting, global alert banner |

---

## 7. User-Facing Error UI (Toast & Dialog)

```typescript
// toast.service.ts — simple toast state using signals
@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<{ id: number; message: string; type: 'error' | 'success' }[]>([]);
  readonly toasts = this._toasts.asReadonly();

  showError(message: string) {
    const id = Date.now();
    this._toasts.update(list => [...list, { id, message, type: 'error' }]);
    setTimeout(() => this.remove(id), 5000);
  }

  showSuccess(message: string) {
    const id = Date.now();
    this._toasts.update(list => [...list, { id, message, type: 'success' }]);
    setTimeout(() => this.remove(id), 3000);
  }

  remove(id: number) {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }
}
```

---

## 8. Common Pitfalls

### Pitfall 1: Swallowing errors blindly

```typescript
// ❌ Error is completely hidden — developer never knows it failed!
this.http.get('/api/data').pipe(
  catchError(() => of(null))  // Silent swallow!
);

// ✅ Log or report the error before returning fallback
this.http.get('/api/data').pipe(
  tap({ error: err => console.warn('Fetch failed', err) }),
  catchError(() => of(null))
);
```

### Pitfall 2: Forgetting `NgZone.run()` in global error handler

```typescript
// ❌ UI toast notification does not update until next user click
handleError(error: any) {
  this.toast.show('Error!');
}

// ✅ Wrap UI updates in zone.run()
handleError(error: any) {
  this.zone.run(() => this.toast.show('Error!'));
}
```

---

## 9. Try It Yourself

Build a custom `ErrorHandler` that:
1. Filters out benign errors (like `ResizeObserver loop limit exceeded`)
2. Formats and logs all other errors to `console.error`
3. Dispatches a toast notification via `ToastService` inside `NgZone`

<details>
<summary>✅ View Solution</summary>

```typescript
import { ErrorHandler, Injectable, inject, NgZone } from '@angular/core';
import { ToastService } from './toast.service';

@Injectable()
export class FilteredErrorHandler implements ErrorHandler {
  private toast = inject(ToastService);
  private zone = inject(NgZone);

  // Ignored benign browser messages
  private ignoredErrors = [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications'
  ];

  handleError(error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);

    // Skip benign errors
    if (this.ignoredErrors.some(ignored => msg.includes(ignored))) {
      return;
    }

    console.error('[App Error]', error);

    this.zone.run(() => {
      this.toast.showError('An unexpected error occurred.');
    });
  }
}
```
</details>

---

## 10. Knowledge Check

1. What is the difference between an HTTP Interceptor error handler and the global `ErrorHandler`?
2. Why is `NgZone.run()` required when showing UI notifications inside a global `ErrorHandler`?
3. What happens if an RxJS stream catches an error with `catchError()` and returns `of([])`? Does the global `ErrorHandler` get triggered?
4. How do you prevent transient network failures from breaking user experience?

<details>
<summary>✅ View Answers</summary>

1. An **HTTP Interceptor** specifically catches outgoing network request failures (401, 403, 500 status codes) and handles network concerns like token refresh. The **global `ErrorHandler`** catches all uncaught JavaScript runtime exceptions (null pointer exceptions, template errors, unhandled promise rejections) across the entire app.

2. Global errors (especially unhandled promise rejections or errors from third-party async callbacks) often execute outside Angular's change detection zone. Without `NgZone.run()`, state changes made to UI services won't trigger change detection immediately, causing toast notifications or dialogs to stay hidden until another event occurs.

3. **No.** By catching the error with `catchError()` and returning a new observable (`of([])`), you have gracefully recovered from the error and converted the error stream into a successful emission. The error is considered handled locally, so it never reaches the global `ErrorHandler`.

4. Use the RxJS `retry()` operator (e.g. `retry({ count: 3, delay: 1000 })`) on HTTP requests to automatically retry transient network failures before passing errors downstream.
</details>

---

*Next: [21 - Testing Components →](./21-testing-components.md)*
