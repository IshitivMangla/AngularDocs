# Angular: HttpClient & RxJS

> **Goal**: Build production-ready HTTP services using Angular's `HttpClient` and master the RxJS operators you'll use daily for async data management.

---

## 📋 Table of Contents
1. [Setup — `provideHttpClient`](#1-setup)
2. [Observables vs Promises — The Core Difference](#2-observables-vs-promises)
3. [Basic HTTP Operations (CRUD)](#3-basic-http-operations)
4. [Essential RxJS Operators](#4-essential-rxjs-operators)
5. [Error Handling Patterns](#5-error-handling-patterns)
6. [Advanced RxJS Patterns](#6-advanced-rxjs-patterns)
7. [toSignal() — Bridging HTTP to the Template](#7-tosignal)
8. [HTTP Options: Headers, Params, Response Types](#8-http-options)
9. [File Upload with Progress Tracking](#9-file-upload)
10. [Request Cancellation & Deduplication](#10-request-cancellation)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Try It Yourself](#12-try-it-yourself)
13. [Knowledge Check](#13-knowledge-check)

---

## 1. Setup

### Configure in `app.config.ts`

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      // Uses the modern browser Fetch API instead of legacy XMLHttpRequest.
      // Required for compatibility with SSR edge environments (Cloudflare Workers, Deno).
      withFetch(),

      // Register functional interceptors (see notes/19-http-interceptors.md)
      withInterceptors([authInterceptor])
    ),
  ]
};
```

---

## 2. Observables vs Promises — The Core Difference

| Feature | Promise | Observable (RxJS) |
|---|---|---|
| Execution | Eager — runs immediately | Lazy — only runs when subscribed |
| Values | Emits exactly one value | Can emit zero, one, or many values |
| Cancellation | Cannot be cancelled | Cancel by calling `.unsubscribe()` or using `takeUntil()` |
| Operators | Limited (.then, .catch) | Rich — 100+ operators (map, filter, switchMap, etc.) |
| Retry | Manual implementation | `.pipe(retry(3))` |
| Progress | No built-in support | Yes — can emit upload/download progress events |

### Why HttpClient Uses Observables

```typescript
// The HTTP request does NOT happen here — Observables are lazy!
const request$ = this.http.get('/api/users');

// The request happens HERE when you subscribe
const sub = request$.subscribe(users => console.log(users));

// Cancel the request (if it hasn't completed yet) — impossible with Promise!
sub.unsubscribe();
```

---

## 3. Basic HTTP Operations (CRUD)

```typescript
// src/app/core/services/product.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, CreateProductDto, UpdateProductDto } from '../models/product.model';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private readonly API = '/api/products';

  // --- GET (Read) ---
  getAll(page = 1, limit = 20, search = ''): Observable<PaginatedResponse<Product>> {
    // Use HttpParams for clean query string building
    const params = new HttpParams()
      .set('page', page)
      .set('limit', limit)
      .set('search', search);

    return this.http.get<PaginatedResponse<Product>>(this.API, { params });
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.API}/${id}`);
  }

  // --- POST (Create) ---
  create(product: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.API, product);
  }

  // --- PUT (Full Replace) ---
  replace(id: number, product: CreateProductDto): Observable<Product> {
    return this.http.put<Product>(`${this.API}/${id}`, product);
  }

  // --- PATCH (Partial Update) ---
  update(id: number, changes: UpdateProductDto): Observable<Product> {
    return this.http.patch<Product>(`${this.API}/${id}`, changes);
  }

  // --- DELETE ---
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}
```

---

## 4. Essential RxJS Operators

These are the operators you'll use in 80% of real-world scenarios:

### Transformation Operators

```typescript
import { map, pluck, switchMap, mergeMap, concatMap, exhaustMap } from 'rxjs/operators';

// map() — transform each emitted value
this.http.get<ApiUser[]>('/api/users').pipe(
  // Transform API shape to app shape
  map(apiUsers => apiUsers.map(u => ({
    id: u.user_id,
    name: `${u.first_name} ${u.last_name}`,
    email: u.email_address
  })))
);

// switchMap() — cancel previous, switch to new observable
// Perfect for search: if user types faster, cancel the previous request
this.searchQuery$.pipe(
  debounceTime(300),
  switchMap(query => this.http.get(`/api/search?q=${query}`))
);

// concatMap() — queue requests, execute one after another (order preserved)
// Use when order matters: e.g., saving form steps sequentially
this.formSteps$.pipe(
  concatMap(step => this.http.post('/api/wizard', step))
);

// mergeMap() — run all requests in parallel, order not guaranteed
// Use when order doesn't matter: e.g., loading multiple independent datasets
this.productIds$.pipe(
  mergeMap(id => this.http.get(`/api/products/${id}`))  // All fire simultaneously
);

// exhaustMap() — ignore new triggers while current is active
// Perfect for submit buttons: prevents double-submission
this.submitClick$.pipe(
  exhaustMap(() => this.http.post('/api/checkout', this.formData))
  // If user clicks submit 3 times rapidly, only the FIRST request runs.
  // The other clicks are IGNORED until the first completes.
);
```

### Filtering & Control Operators

```typescript
import { filter, take, takeUntil, takeUntilDestroyed, distinctUntilChanged, debounceTime } from 'rxjs/operators';

// filter() — only process values matching a condition
this.router.events.pipe(
  filter(event => event instanceof NavigationEnd)
).subscribe(event => { /* only NavigationEnd events */ });

// take(n) — complete after n emissions
this.someStream$.pipe(take(1)).subscribe();  // Only take the first value

// distinctUntilChanged() — skip if same as previous
this.searchQuery$.pipe(distinctUntilChanged());  // Prevents duplicate API calls

// debounceTime(ms) — wait for silence before emitting
this.searchInput.valueChanges.pipe(debounceTime(300));  // Wait 300ms after user stops typing

// takeUntilDestroyed() — auto-unsubscribe when component/service is destroyed
// Requires Angular 16+ and must be called in injection context
this.someService.data$.pipe(
  takeUntilDestroyed()
).subscribe(data => this.data.set(data));
```

### Combination Operators

```typescript
import { forkJoin, combineLatest, zip, merge, concat } from 'rxjs';

// forkJoin() — wait for ALL to complete, then emit combined results
// Perfect for loading a page that needs multiple data sources
forkJoin({
  user: this.http.get<User>('/api/me'),
  products: this.http.get<Product[]>('/api/products'),
  categories: this.http.get<Category[]>('/api/categories')
}).subscribe(({ user, products, categories }) => {
  // All three are available here simultaneously
});

// combineLatest() — emit when ANY changes, with latest value from all
// Perfect for computed/reactive values that depend on multiple observables
combineLatest([
  this.filterState$,
  this.sortState$,
  this.page$
]).pipe(
  debounceTime(0),  // Prevent double-emission if multiple change simultaneously
  switchMap(([filters, sort, page]) => this.productService.getAll(filters, sort, page))
).subscribe(products => this.products.set(products));

// merge() — emit from any of the sources as they come
merge(
  this.websocket.messages$,
  this.pollingService.updates$
).subscribe(update => this.handleUpdate(update));
```

### Error Handling Operators

```typescript
import { catchError, retry, retryWhen, tap } from 'rxjs/operators';
import { throwError, of, timer } from 'rxjs';

// retry(n) — retry up to n times on error
this.http.get('/api/data').pipe(
  retry(3)  // Try the request up to 3 total times before giving up
);

// catchError() — handle the error gracefully
this.http.get<User[]>('/api/users').pipe(
  catchError(error => {
    if (error.status === 404) {
      return of([]);  // Return empty array instead of crashing
    }
    return throwError(() => error);  // Re-throw unrecoverable errors
  })
);

// finalize() — runs whether success or error (like finally block)
this.http.get('/api/data').pipe(
  tap(() => this.isLoading.set(true)),
  finalize(() => this.isLoading.set(false))  // Always runs
);
```

---

## 5. Error Handling Patterns

### Pattern 1: Service-Level Error Handling

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/users').pipe(
      retry(2),  // Auto-retry on network failures

      // Transform HTTP error into a domain-specific error
      catchError((error: HttpErrorResponse) => {
        if (error.status === 0) {
          // Network error (no internet)
          return throwError(() => new Error('No internet connection. Please check your network.'));
        }
        if (error.status === 401) {
          return throwError(() => new Error('Session expired. Please log in again.'));
        }
        if (error.status === 403) {
          return throwError(() => new Error('You do not have permission to view this data.'));
        }
        if (error.status === 404) {
          return of([]);  // Not found — treat as empty
        }
        return throwError(() => new Error(`Server error (${error.status}). Please try again.`));
      })
    );
  }
}
```

### Pattern 2: Component-Level Error State

```typescript
@Component({
  standalone: true,
  template: `
    @if (isLoading()) {
      <div class="spinner"></div>
    } @else if (error()) {
      <div class="error-card">
        <h3>⚠️ Something went wrong</h3>
        <p>{{ error() }}</p>
        <button (click)="load()">Try Again</button>
      </div>
    } @else {
      @for (user of users(); track user.id) {
        <app-user-card [user]="user"></app-user-card>
      } @empty {
        <p>No users found.</p>
      }
    }
  `
})
export class UsersPageComponent implements OnInit {
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);

  users = signal<User[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading.set(true);
    this.error.set(null);

    this.userService.getUsers().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (users) => {
        this.users.set(users);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.isLoading.set(false);
      }
    });
  }
}
```

---

## 6. Advanced RxJS Patterns

### Pattern: Auto-Refresh with Polling

```typescript
import { timer, switchMap, retry } from 'rxjs';

// Poll every 30 seconds, cancel when component is destroyed
timer(0, 30_000).pipe(
  switchMap(() => this.dashboardService.getMetrics()),
  retry({ count: 3, delay: 5000 }),  // Retry up to 3x with 5s delay
  takeUntilDestroyed(this.destroyRef)
).subscribe(metrics => this.metrics.set(metrics));
```

### Pattern: Optimistic Updates

```typescript
deleteProduct(product: Product) {
  // 1. Immediately update the UI (optimistic)
  this.products.update(list => list.filter(p => p.id !== product.id));

  // 2. Send the actual HTTP request
  this.productService.delete(product.id).pipe(
    catchError(err => {
      // 3. If the request fails, roll back the UI change!
      this.products.update(list => [...list, product]);
      this.toastService.showError('Failed to delete product. Please try again.');
      return of(null);
    })
  ).subscribe();
}
```

### Pattern: Sequential Requests (Dependent Calls)

```typescript
// Need the user first, then their orders based on user.id
this.userService.getCurrentUser().pipe(
  switchMap(user => this.orderService.getOrdersByUser(user.id)),  // Use user.id
  switchMap(orders => {
    // Load order details for all orders in parallel
    return forkJoin(orders.map(o => this.orderService.getDetails(o.id)));
  })
).subscribe(detailedOrders => this.orders.set(detailedOrders));
```

---

## 7. `toSignal()` — Bridging HTTP to the Template

The cleanest way to use HTTP data in templates is to convert the Observable to a Signal:

```typescript
import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { map, catchError, of } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    @if (users()) {
      <p>{{ userCount() }} total users</p>
      @for (user of users()!; track user.id) {
        <div>{{ user.name }}</div>
      }
    }
  `
})
export class DashboardComponent {
  private http = inject(HttpClient);

  // One-liner: HTTP observable → Signal
  // Auto-subscribes, auto-unsubscribes when component is destroyed!
  users = toSignal(
    this.http.get<User[]>('/api/users').pipe(
      catchError(() => of([] as User[]))
    ),
    { initialValue: null }  // initialValue avoids undefined during first render
  );

  // Derive computed from the signal
  userCount = computed(() => this.users()?.length ?? 0);
}
```

---

## 8. HTTP Options: Headers, Params, Response Types

```typescript
import { HttpHeaders, HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Custom Headers
  getWithAuth(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`,
      'X-Request-ID': crypto.randomUUID(),
      'Content-Type': 'application/json'
    });

    return this.http.get('/api/secure-data', { headers });
  }

  // Query Parameters
  searchUsers(query: string, page: number, roles: string[]): Observable<User[]> {
    let params = new HttpParams()
      .set('q', query)
      .set('page', page.toString())
      .set('limit', '20');

    // Append multiple values for the same param
    roles.forEach(role => { params = params.append('role', role); });
    // Result: ?q=angular&page=1&limit=20&role=admin&role=editor

    return this.http.get<User[]>('/api/users', { params });
  }

  // Observe the full response (not just the body)
  getWithMetadata(): Observable<HttpResponse<User[]>> {
    return this.http.get<User[]>('/api/users', {
      observe: 'response'  // Get headers, status code, etc.
    });
    // response.body → User[]
    // response.status → 200
    // response.headers.get('X-Total-Count') → '150'
  }

  // Download a binary file (PDF, image, etc.)
  downloadFile(id: number): Observable<Blob> {
    return this.http.get(`/api/files/${id}`, {
      responseType: 'blob'  // Tell Angular to expect binary data, not JSON
    });
  }
}
```

---

## 9. File Upload with Progress Tracking

```typescript
import { HttpEventType, HttpClient } from '@angular/common/http';
import { filter, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private http = inject(HttpClient);

  uploadFile(file: File): Observable<number> {  // Emits 0–100 (progress percentage)
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post('/api/upload', formData, {
      reportProgress: true,     // Enable progress events
      observe: 'events'          // Observe ALL events (start, progress, complete)
    }).pipe(
      filter(event => event.type === HttpEventType.UploadProgress),
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          return Math.round(100 * event.loaded / (event.total ?? 1));
        }
        return 0;
      })
    );
  }
}

// Component usage
@Component({
  template: `
    <input type="file" (change)="onFileSelect($event)">
    @if (uploadProgress() > 0) {
      <progress [value]="uploadProgress()" max="100"></progress>
      <span>{{ uploadProgress() }}%</span>
    }
  `
})
export class UploadComponent {
  private uploadService = inject(FileUploadService);
  uploadProgress = signal(0);

  onFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.uploadService.uploadFile(file).subscribe({
      next: progress => this.uploadProgress.set(progress),
      complete: () => {
        this.uploadProgress.set(100);
        console.log('Upload complete!');
      }
    });
  }
}
```

---

## 10. Request Cancellation & Deduplication

### Cancellation with `switchMap`

```typescript
// search.component.ts
// When user types faster than the network responds, cancel stale requests!

searchQuery = signal('');

private query$ = toObservable(this.searchQuery);
private results$ = this.query$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(q =>  // switchMap cancels the previous HTTP request automatically
    this.http.get<SearchResult[]>(`/api/search?q=${q}`).pipe(
      catchError(() => of([]))
    )
  )
);

results = toSignal(this.results$, { initialValue: [] });
```

### Preventing Duplicate Requests with `shareReplay`

```typescript
// If multiple components subscribe to this, only ONE HTTP call is made!
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config$ = this.http.get<AppConfig>('/api/config').pipe(
    shareReplay(1)  // Cache the result, replay to late subscribers
  );

  getConfig(): Observable<AppConfig> {
    return this.config$;  // Multiple subscribers, one request
  }
}
```

---

## 11. Common Pitfalls

### Pitfall 1: Not subscribing (cold observable)

```typescript
// ❌ No request is sent! HTTP Observables are "cold" (lazy)
ngOnInit() {
  this.userService.getUsers();  // .subscribe() missing!
}

// ✅ Subscribe to trigger the request
ngOnInit() {
  this.userService.getUsers().subscribe(users => this.users.set(users));
}
```

### Pitfall 2: Memory leak — not unsubscribing

```typescript
// ❌ If user navigates away before the request completes,
// the callback fires on a destroyed component → error!
this.http.get('/api/data').subscribe(data => this.data.set(data));

// ✅ Option 1: Use takeUntilDestroyed()
this.http.get('/api/data').pipe(
  takeUntilDestroyed(this.destroyRef)
).subscribe(data => this.data.set(data));

// ✅ Option 2: Use toSignal() — handles subscription lifecycle automatically
this.data = toSignal(this.http.get('/api/data'), { initialValue: null });
```

### Pitfall 3: Using `mergeMap` instead of `switchMap` for search

```typescript
// ❌ mergeMap: All requests run in parallel, responses arrive out of order
searchInput.pipe(mergeMap(q => this.http.get(`/api/search?q=${q}`)));
// User types "cat" then "cats" — "cats" response might arrive BEFORE "cat",
// displaying stale results!

// ✅ switchMap: Cancels previous, always shows latest
searchInput.pipe(switchMap(q => this.http.get(`/api/search?q=${q}`)));
```

### Pitfall 4: Not handling errors in subscriptions

```typescript
// ❌ If the observable errors, Angular will throw an unhandled error
// and the application may crash or the stream terminates silently
this.userService.getUsers().subscribe(users => this.users.set(users));

// ✅ Always handle errors
this.userService.getUsers().subscribe({
  next: users => this.users.set(users),
  error: err => this.error.set(err.message)  // Handle gracefully!
});
```

---

## 12. Try It Yourself

Build a `SearchComponent` that:
1. Has an input field that the user types into
2. Only sends an API call after 400ms of inactivity (debounce)
3. Cancels the previous request if a new search starts
4. Shows a loading state while searching
5. Displays results or an "empty state" message
6. Auto-cleans up subscriptions when the component is destroyed

<details>
<summary>✅ View Solution</summary>

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError, startWith } from 'rxjs';
import { of } from 'rxjs';

interface SearchResult { id: number; title: string; description: string; }

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="search-container">
      <input
        [(ngModel)]="query"
        placeholder="Search..."
        class="search-input"
      >

      @if (isSearching()) {
        <div class="spinner">Searching...</div>
      } @else {
        @for (result of results(); track result.id) {
          <div class="result-card">
            <h3>{{ result.title }}</h3>
            <p>{{ result.description }}</p>
          </div>
        } @empty {
          @if (query()) {
            <div class="empty-state">No results for "{{ query() }}"</div>
          }
        }
      }
    </div>
  `
})
export class SearchComponent {
  private http = inject(HttpClient);

  // ✅ Track the search query in a signal
  query = signal('');
  isSearching = signal(false);

  // ✅ Convert signal to observable for RxJS operators
  private query$ = toObservable(this.query);

  // ✅ The search pipeline
  private results$ = this.query$.pipe(
    debounceTime(400),           // Wait 400ms after user stops typing
    distinctUntilChanged(),       // Skip if the query hasn't actually changed
    tap(() => this.isSearching.set(true)),  // Show loading spinner
    switchMap(query => {          // Cancel stale requests automatically
      if (!query.trim()) {
        this.isSearching.set(false);
        return of([]);            // Return empty for blank queries
      }
      return this.http.get<SearchResult[]>(`/api/search?q=${query}`).pipe(
        catchError(() => of([]))  // Handle errors gracefully
      );
    }),
    tap(() => this.isSearching.set(false))  // Hide spinner
  );

  // ✅ Convert result observable to signal — auto-subscribes and auto-unsubscribes!
  results = toSignal(this.results$, { initialValue: [] as SearchResult[] });
}
```
</details>

---

## 13. Knowledge Check

1. Why are Angular `HttpClient` Observables "cold", and what does that mean practically?
2. What is the difference between `switchMap` and `mergeMap`? Which should you use for a search autocomplete?
3. What does `retry(3)` do when a server returns a `404 Not Found` error?
4. Why is `finalize()` preferred over putting cleanup in both `next` and `error` callbacks?
5. When should you use `forkJoin` vs `combineLatest`?

<details>
<summary>✅ View Answers</summary>

1. "Cold" means the Observable is **lazy** — the HTTP request **doesn't happen** until a `subscribe()` call is made. Practically: if you call `this.http.get('/api/data')` and don't subscribe, no network request is ever sent. This is a common beginner bug.

2. `switchMap` **cancels** the previous inner observable before starting the new one — perfect for search, because you don't want stale results from an old query to overwrite fresh results. `mergeMap` runs **all inner observables in parallel** — good for things like parallel file processing where order doesn't matter.

3. `retry(3)` will re-subscribe to the observable (re-send the request) up to 3 total times. However, **a 404 is a server success response** — the server replied successfully with "this resource doesn't exist". `retry` is for network errors (status 0) or server errors (5xx). Retrying a 404 is usually pointless and you should `catchError` it instead.

4. `finalize()` runs when the observable **completes OR errors**, acting like a `finally` block. Without it, you'd need to write the same cleanup code in both the `next` and `error` callbacks, violating the DRY principle.

5. Use **`forkJoin`** when you want to fire multiple requests simultaneously and need all of them to **complete before doing anything** (one-shot operations). Use **`combineLatest`** when you have multiple ongoing Observables (streams) and want to react whenever **any of them emit a new value** — e.g., merging filter state, sort state, and pagination state into one derived stream.
</details>

---

*Next: [07 - Reactive Forms →](./07-reactive-forms.md)*
