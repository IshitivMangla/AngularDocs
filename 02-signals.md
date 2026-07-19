# Angular: Advanced Signals & State Management

> **Goal**: Master Angular's reactive primitive — `signal()` — and understand how to manage local state, derived state, and complex application state for scalable apps.

---

## 📋 Table of Contents
1. [Why Signals? The Problem with Zone.js](#1-why-signals)
2. [The Reactivity Graph — Mental Model](#2-the-reactivity-graph)
3. [Core Signal Types](#3-core-signal-types)
4. [Signal Template Binding](#4-signal-template-binding)
5. [Two-Way Binding with `model()`](#5-two-way-binding-with-model)
6. [Signal Inputs: `input()` & `input.required()`](#6-signal-inputs)
7. [Signal Outputs: `output()`](#7-signal-outputs)
8. [Managing Collections Immutably](#8-managing-collections-immutably)
9. [Connecting RxJS to Signals](#9-connecting-rxjs-to-signals)
10. [NgRx SignalStore (Scalable State Management)](#10-ngrx-signalstore)
11. [Signals vs RxJS — When to Use Which](#11-signals-vs-rxjs)
12. [Common Pitfalls](#12-common-pitfalls)
13. [Try It Yourself](#13-try-it-yourself)
14. [Knowledge Check](#14-knowledge-check)

---

## 1. Why Signals?

### The Zone.js Problem

Before Signals, Angular used a library called **Zone.js** to detect when state changed. Zone.js worked by monkey-patching all asynchronous browser APIs (`setTimeout`, `Promise`, `fetch`, DOM events). Whenever any of these fired, Angular would run change detection on the **entire component tree** — even components whose state hadn't changed at all.

This approach was clever but had serious drawbacks:
- **Unpredictable performance**: A single button click could trigger re-rendering of hundreds of unrelated components.
- **"Magic" behavior**: It was hard to understand *why* a component was re-rendering because Zone.js did it invisibly.
- **Large bundle overhead**: Zone.js adds ~98KB to your app.

### The Signal Solution

Signals create a **precise dependency graph**. Angular knows *exactly* which piece of UI depends on which signal. When `userCount` changes, only the components and computed values that read `userCount` are updated. Everything else is untouched.

```
signal(userCount) ──→ computed(isOverCapacity) ──→ Template renders isOverCapacity()
                    ↘ effect(logToAnalytics)
```

---

## 2. The Reactivity Graph — Mental Model

Angular's signal system has three types of nodes:

| Type | Role | Example |
|---|---|---|
| **Producer** | Holds and emits values | `signal()` |
| **Consumer** | Reads from producers, reacts to changes | `effect()`, template |
| **Intermediary** | Both reads and produces | `computed()` |

### How It Works

1. When you call `count()` inside a `computed()` or `effect()`, Angular automatically **tracks** the dependency.
2. When `count.set(5)` is called, Angular marks all consumers as **dirty** (stale).
3. Angular evaluates dirty computed values **lazily** — only when something actually reads them.
4. This is **glitch-free**: if two signals update simultaneously, Angular ensures effects see a consistent snapshot, not intermediate states.

```typescript
const a = signal(1);
const b = signal(2);
// This computed reads both a and b, so it depends on both
const sum = computed(() => a() + b());

// Even if a and b update in rapid succession,
// the effect below will only run ONCE with the final stable values
effect(() => console.log('Sum:', sum()));
```

---

## 3. Core Signal Types

### 3.1 — Writable Signals: `signal()`

The root nodes of your reactive graph. They are the **source of truth**.

```typescript
import { signal } from '@angular/core';

// Primitive values
const count = signal(0);
const name = signal('Angular');
const isLoading = signal(false);

// Complex types — always use generics for type safety
const user = signal<User | null>(null);
const items = signal<Product[]>([]);

// Reading a signal — always call it like a function!
console.log(count());    // 0
console.log(name());     // 'Angular'

// Writing: .set() — replaces the value entirely
count.set(10);
user.set({ id: 1, name: 'Alice' });

// Writing: .update() — updates based on the current value
count.update(current => current + 1);       // 11
items.update(list => [...list, newItem]);    // Adds to array immutably

// Advanced: Custom equality function
// By default, signals use === to check if a new value is "different".
// You can override this with a deep equality check for objects:
const config = signal({ theme: 'dark', lang: 'en' }, {
  // If custom equal returns true, the signal does NOT notify consumers
  equal: (a, b) => JSON.stringify(a) === JSON.stringify(b)
});
```

### 3.2 — Computed Signals: `computed()`

Derived values that are **automatically memoized and lazily evaluated**.

```typescript
import { signal, computed } from '@angular/core';

const price = signal(100);
const quantity = signal(3);
const discountRate = signal(0.1); // 10% discount

// This is MEMOIZED. It only recalculates when price, quantity, or discountRate changes.
const subtotal = computed(() => price() * quantity());
const discount = computed(() => subtotal() * discountRate());
const total = computed(() => subtotal() - discount());

// You can read a computed just like a signal:
console.log(total()); // 270

// Chain computed signals for complex derivations:
const formattedTotal = computed(() => `$${total().toFixed(2)}`);
console.log(formattedTotal()); // "$270.00"
```

> **Key insight**: `computed()` values are NOT recalculated when you read them — they are recalculated only when a dependency changes. If you read `total()` 1000 times and nothing has changed, it executes the function only once and caches the result.

### 3.3 — Effects: `effect()`

Functions that run as **side effects** when signals change. Use for DOM manipulation, logging, syncing with localStorage, or making API calls in response to state changes.

```typescript
import { effect, untracked, Component, inject } from '@angular/core';
import { AnalyticsService } from './analytics.service';

@Component({ ... })
export class ShoppingCartComponent {
  private analytics = inject(AnalyticsService);
  cartItems = signal<CartItem[]>([]);
  userId = signal<string>('user-123');

  constructor() {
    // --- Basic Effect ---
    // Runs immediately on creation, then again whenever cartItems changes.
    effect(() => {
      console.log(`Cart updated. Now has ${this.cartItems().length} items`);
    });

    // --- Effect with untracked() ---
    // You need userId for the analytics call, but you DON'T want this effect
    // to re-run every time userId changes — only when cartItems changes.
    effect(() => {
      const items = this.cartItems(); // ← TRACKED dependency

      // untracked() reads userId WITHOUT adding it to this effect's dependency graph
      const uid = untracked(this.userId); // ← NOT tracked

      this.analytics.track('cart_updated', { uid, itemCount: items.length });
    });

    // --- Cleanup in effects ---
    // If an effect starts a subscription or timer, you can return a cleanup function:
    effect((onCleanup) => {
      const timer = setInterval(() => console.log('polling'), 5000);
      // This runs before the effect re-runs or when the component is destroyed:
      onCleanup(() => clearInterval(timer));
    });
  }
}
```

> ⚠️ **Warning**: By default, Angular throws an error if you try to call `signal.set()` inside an `effect()`. This prevents infinite loops. If you need to derive a new value from a signal, use `computed()` instead.

---

## 4. Signal Template Binding

Signals in templates must be **called with `()`** because they are getter functions.

```html
<!-- ✅ CORRECT: Call the signal to get its value -->
<h1>Welcome, {{ user().name }}!</h1>

<!-- ❌ WRONG: Will render "[object Function]" -->
<h1>Welcome, {{ user.name }}!</h1>

<!-- Property Binding — value updates automatically when signal changes -->
<button [disabled]="isSubmitting()">Save Changes</button>

<!-- Class Binding -->
<div [class.active]="isMenuOpen()"></div>
<div [ngClass]="{ 'loading': isLoading(), 'error': hasError() }"></div>

<!-- Style Binding -->
<div [style.opacity]="opacity()"></div>

<!-- Control Flow with Signals -->
@if (currentUser()) {
  <p>Hello, {{ currentUser()!.name }}</p>
} @else {
  <p>Please log in.</p>
}

<!-- The 'as' alias — evaluates once and avoids repeated function calls -->
@if (currentUser(); as user) {
  <p>Hello, {{ user.name }}</p>    <!-- user is now a plain object, not a Signal! -->
  <p>Email: {{ user.email }}</p>
}

@for (item of cartItems(); track item.id) {
  <li>{{ item.name }} — {{ item.price | currency }}</li>
}
```

---

## 5. Two-Way Binding with `model()`

`model()` replaces the old `@Input()` + `@Output() EventEmitter` pattern for two-way binding. It creates a writable signal that automatically emits a change event when updated.

### Child Component

```typescript
import { Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-quantity-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <button (click)="decrement()">-</button>
    <input type="number" [(ngModel)]="quantity" min="1">
    <button (click)="increment()">+</button>
  `
})
export class QuantityPickerComponent {
  // model() = Input AND Output in one declaration
  // The parent binds with [(quantity)]="someSignal"
  quantity = model<number>(1);  // Default value is 1

  increment() {
    this.quantity.update(q => q + 1);
    // Angular automatically emits a 'quantityChange' event to the parent!
  }

  decrement() {
    if (this.quantity() > 1) {
      this.quantity.update(q => q - 1);
    }
  }
}
```

### Parent Component

```typescript
import { Component, signal, computed } from '@angular/core';
import { QuantityPickerComponent } from './quantity-picker.component';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [QuantityPickerComponent, CurrencyPipe],
  template: `
    <h2>Product: Widget Pro</h2>
    <p>Unit Price: {{ unitPrice() | currency }}</p>

    <!-- Standard two-way banana-in-a-box binding -->
    <app-quantity-picker [(quantity)]="selectedQuantity"></app-quantity-picker>

    <p>Total: {{ totalPrice() | currency }}</p>
  `
})
export class ProductPageComponent {
  unitPrice = signal(29.99);
  selectedQuantity = signal(1);

  // Reacts automatically when selectedQuantity or unitPrice changes
  totalPrice = computed(() => this.unitPrice() * this.selectedQuantity());
}
```

---

## 6. Signal Inputs

`input()` is the modern replacement for `@Input()`. It returns a **read-only signal**, which means you can use it with `computed()` and `effect()` without `ngOnChanges`.

```typescript
import { Component, input, computed, effect } from '@angular/core';

export interface User { id: number; name: string; role: 'admin' | 'user'; }

@Component({
  selector: 'app-user-badge',
  standalone: true,
  template: `
    <div [class]="badgeClass()">
      {{ user().name }}
      @if (isAdmin()) {
        <span class="crown">👑</span>
      }
    </div>
  `
})
export class UserBadgeComponent {
  // input.required() — TypeScript error if parent forgets to pass it
  user = input.required<User>();

  // input() — optional with a default value
  size = input<'sm' | 'md' | 'lg'>('md');

  // input() with an alias — parent uses [userData]="...", class uses this.user
  // user = input.required<User>({ alias: 'userData' });

  // Derived values from inputs — automatically recalculate when input changes
  isAdmin = computed(() => this.user().role === 'admin');
  badgeClass = computed(() => `badge badge-${this.size()} ${this.isAdmin() ? 'badge-admin' : ''}`);

  constructor() {
    // React to input changes without ngOnChanges!
    effect(() => {
      console.log(`User changed to: ${this.user().name}`);
    });
  }
}
```

### Using in the Parent Template

```html
<!-- Required input — must be provided -->
<app-user-badge [user]="currentUser()"></app-user-badge>

<!-- With optional input -->
<app-user-badge [user]="currentUser()" size="lg"></app-user-badge>
```

---

## 7. Signal Outputs: `output()`

`output()` is the modern replacement for `@Output() EventEmitter`. It's type-safe and requires no RxJS.

```typescript
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-product-card',
  standalone: true,
  template: `
    <div class="card">
      <h3>{{ product().name }}</h3>
      <p>{{ product().price | currency }}</p>
      <button (click)="addToCart()">Add to Cart</button>
      <button (click)="remove()">Remove</button>
    </div>
  `
})
export class ProductCardComponent {
  product = input.required<Product>();

  // Modern output — emits a Product when user clicks "Add to Cart"
  cartAdd = output<Product>();

  // Modern output — emits the product ID when deleted
  productRemove = output<number>();

  addToCart() {
    this.cartAdd.emit(this.product());
  }

  remove() {
    this.productRemove.emit(this.product().id);
  }
}
```

```html
<!-- Parent listens to outputs -->
<app-product-card
  [product]="p"
  (cartAdd)="onAddToCart($event)"
  (productRemove)="onRemoveProduct($event)">
</app-product-card>
```

---

## 8. Managing Collections Immutably

**The Golden Rule**: Never mutate an array or object stored in a signal directly. Instead, always create a new reference using spread syntax or `.filter()` / `.map()`.

```typescript
import { Injectable, signal, computed } from '@angular/core';

export interface Task {
  id: number;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

@Injectable({ providedIn: 'root' })
export class TaskStore {
  private _tasks = signal<Task[]>([]);

  // Public read-only views of the data
  readonly tasks = this._tasks.asReadonly();
  readonly completedTasks = computed(() => this._tasks().filter(t => t.completed));
  readonly activeTasks = computed(() => this._tasks().filter(t => !t.completed));
  readonly highPriorityCount = computed(() =>
    this._tasks().filter(t => t.priority === 'high' && !t.completed).length
  );

  // CREATE
  addTask(title: string, priority: Task['priority'] = 'medium') {
    const newTask: Task = {
      id: Date.now(),       // Use a UUID library in production
      title,
      completed: false,
      priority
    };
    // ✅ Correct: create a NEW array
    this._tasks.update(tasks => [...tasks, newTask]);
  }

  // READ — just read the signal
  getTaskById(id: number): Task | undefined {
    return this._tasks().find(t => t.id === id);
  }

  // UPDATE — map over the array, replace the matching item
  toggleTask(id: number) {
    this._tasks.update(tasks =>
      tasks.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  updateTask(id: number, changes: Partial<Task>) {
    this._tasks.update(tasks =>
      tasks.map(task =>
        task.id === id ? { ...task, ...changes } : task
      )
    );
  }

  // DELETE — filter it out
  deleteTask(id: number) {
    this._tasks.update(tasks => tasks.filter(task => task.id !== id));
  }

  // BULK
  completeAll() {
    this._tasks.update(tasks => tasks.map(t => ({ ...t, completed: true })));
  }

  clearCompleted() {
    this._tasks.update(tasks => tasks.filter(t => !t.completed));
  }
}
```

> ❌ **Never do this — it mutates the array reference:**
> ```typescript
> // WRONG: This pushes to the EXISTING array. The signal's reference doesn't change,
> // so Angular's reactivity system doesn't see any change!
> this._tasks().push(newTask);
> ```

---

## 9. Connecting RxJS to Signals

RxJS is still useful for complex async operations (debouncing, combining streams). Angular provides two bridge utilities:

### 9.1 — `toSignal()` — Observable to Signal

```typescript
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({
  selector: 'app-search',
  standalone: true,
  template: `
    <input (input)="query.set($any($event.target).value)" placeholder="Search...">

    @if (results()) {
      @for (item of results(); track item.id) {
        <div>{{ item.name }}</div>
      }
    }
  `
})
export class SearchComponent {
  private http = inject(HttpClient);

  query = signal('');

  // Convert the RxJS pipeline result into a Signal
  // toSignal() auto-subscribes and auto-unsubscribes when component is destroyed
  results = toSignal(
    // We need to bridge from signal to RxJS — use a Subject or toObservable()
    // (see below), but for simplicity here we use the query signal value
    this.http.get<any[]>('/api/search'),
    { initialValue: [] }
  );
}
```

### 9.2 — `toObservable()` — Signal to Observable

```typescript
import { Component, signal, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';

@Component({
  selector: 'app-user-search',
  standalone: true,
  template: `
    <input (input)="searchQuery.set($any($event.target).value)" placeholder="Search users...">
    <p>{{ results().length }} results found</p>
    @for (user of results(); track user.id) {
      <div>{{ user.name }}</div>
    }
  `
})
export class UserSearchComponent {
  private http = inject(HttpClient);

  searchQuery = signal('');

  // 1. Convert signal to Observable so we can use RxJS operators
  private query$ = toObservable(this.searchQuery);

  // 2. Apply RxJS magic: debounce, deduplicate, cancel stale requests
  private results$ = this.query$.pipe(
    debounceTime(300),           // Wait 300ms after user stops typing
    distinctUntilChanged(),       // Ignore if same value as before
    switchMap(query =>           // Cancel previous request when new query comes in
      this.http.get<User[]>(`/api/users?q=${query}`).pipe(
        catchError(() => of([]))  // Return empty array on error
      )
    )
  );

  // 3. Convert the Observable result back to a Signal for the template
  results = toSignal(this.results$, { initialValue: [] as User[] });
}
```

---

## 10. NgRx SignalStore (Scalable State Management)

For complex applications, plain signals in a service can become unwieldy. **NgRx SignalStore** is the official solution for scalable, feature-level state management.

### Installation
```bash
npm install @ngrx/signals
```

### Defining the Store

```typescript
// products/product.store.ts
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withEntities, updateEntity, addEntity, removeEntity } from '@ngrx/signals/entities';
import { computed, inject } from '@angular/core';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';
import { ProductService } from './product.service';
import { Product } from './product.model';

// 1. Define the shape of the state
type ProductState = {
  isLoading: boolean;
  error: string | null;
  filter: string;
};

const initialState: ProductState = {
  isLoading: false,
  error: null,
  filter: ''
};

// 2. Create the store using composable "features"
export const ProductStore = signalStore(
  // Provide at feature level (not root) to scope state to the products feature
  { providedIn: 'root' },

  // withState: defines writable signals for each property
  withState(initialState),

  // withEntities: adds CRUD helpers for a collection of Product objects
  withEntities<Product>(),

  // withComputed: derived signals (memoized)
  withComputed((state) => ({
    filteredProducts: computed(() => {
      const filter = state.filter().toLowerCase();
      return state.entities().filter(p =>
        p.name.toLowerCase().includes(filter)
      );
    }),
    productCount: computed(() => state.entities().length),
    hasProducts: computed(() => state.entities().length > 0),
    errorMessage: computed(() => state.error() ?? ''),
  })),

  // withMethods: actions / reducers / effects
  withMethods((state, productService = inject(ProductService)) => ({

    // --- Sync actions ---
    setFilter(filter: string) {
      patchState(state, { filter });
    },

    clearError() {
      patchState(state, { error: null });
    },

    // --- Async action using rxMethod for RxJS integration ---
    loadProducts: rxMethod<void>(
      pipe(
        tap(() => patchState(state, { isLoading: true, error: null })),
        switchMap(() =>
          productService.getAll().pipe(
            tap((products) => {
              // withEntities provides setAllEntities, addEntity, etc.
              patchState(state, setAllEntities(products), { isLoading: false });
            }),
            catchError((error) => {
              patchState(state, { isLoading: false, error: error.message });
              return of(null);
            })
          )
        )
      )
    ),

    addProduct: rxMethod<Omit<Product, 'id'>>(
      pipe(
        switchMap((newProduct) =>
          productService.create(newProduct).pipe(
            tap((created) => patchState(state, addEntity(created)))
          )
        )
      )
    ),

    deleteProduct: rxMethod<number>(
      pipe(
        switchMap((id) =>
          productService.delete(id).pipe(
            tap(() => patchState(state, removeEntity(id)))
          )
        )
      )
    ),
  }))
);
```

### Using the Store in a Component

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { ProductStore } from './product.store';
import { AsyncPipe, CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <input (input)="store.setFilter($any($event.target).value)" placeholder="Filter...">

    @if (store.isLoading()) {
      <div class="skeleton-loader">Loading products...</div>
    }

    @if (store.error()) {
      <div class="error-banner">{{ store.error() }}</div>
    }

    <p>Showing {{ store.filteredProducts().length }} of {{ store.productCount() }} products</p>

    @for (product of store.filteredProducts(); track product.id) {
      <div class="product-card">
        <h3>{{ product.name }}</h3>
        <p>{{ product.price | currency }}</p>
        <button (click)="store.deleteProduct(product.id)">Delete</button>
      </div>
    } @empty {
      <p>No products match your filter.</p>
    }
  `
})
export class ProductsListComponent implements OnInit {
  // Inject like a regular service
  readonly store = inject(ProductStore);

  ngOnInit() {
    // rxMethod auto-manages the subscription lifecycle
    this.store.loadProducts();
  }
}
```

---

## 11. Signals vs RxJS — When to Use Which

| Use Case | Use Signals | Use RxJS |
|---|---|---|
| Simple component state (toggle, counter) | ✅ | |
| Derived/computed data | ✅ | |
| Two-way binding between components | ✅ (`model()`) | |
| React to @Input changes | ✅ (`effect()`) | |
| Simple HTTP request (no complex flows) | ✅ (with `toSignal()`) | |
| Auto-search with debounce + cancel | | ✅ (`switchMap` + `debounceTime`) |
| Multiple HTTP calls in sequence/parallel | | ✅ (`concatMap`, `forkJoin`) |
| WebSocket streams | | ✅ |
| Retry logic with exponential backoff | | ✅ |
| Polling every N seconds | | ✅ (`interval` + `switchMap`) |

---

## 12. Common Pitfalls

### Pitfall 1: Forgetting parentheses in templates
```html
<!-- ❌ Renders "[object Function]" -->
<p>{{ user.name }}</p>

<!-- ✅ Correct -->
<p>{{ user().name }}</p>
```

### Pitfall 2: Mutating arrays directly
```typescript
// ❌ Angular does NOT detect this change!
this.tasks().push(newTask);

// ✅ Correct: creates new reference
this.tasks.update(t => [...t, newTask]);
```

### Pitfall 3: Writing to signals inside `effect()`
```typescript
// ❌ Angular throws: "Writing to signals in effects is disabled by default"
effect(() => {
  if (this.count() > 10) {
    this.isMaxed.set(true);  // ERROR!
  }
});

// ✅ Use computed() instead
isMaxed = computed(() => this.count() > 10);
```

### Pitfall 4: Calling `signal()` outside of injection context
```typescript
// ❌ Calling toSignal() outside of a component/service constructor
ngOnInit() {
  // Error: toSignal() must be called in an injection context
  this.data = toSignal(this.http.get('/api/data'));
}

// ✅ Create signals as class properties or in constructor
data = toSignal(inject(HttpClient).get<any[]>('/api/data'), { initialValue: [] });
```

### Pitfall 5: Not using `asReadonly()` for public signals in services
```typescript
// ❌ External code can mutate the private state directly
export class CartService {
  cartItems = signal<CartItem[]>([]);  // Public and writable — dangerous!
}

// ✅ Expose only a read-only view
export class CartService {
  private _cartItems = signal<CartItem[]>([]);
  readonly cartItems = this._cartItems.asReadonly();  // Safe!

  addItem(item: CartItem) {
    this._cartItems.update(items => [...items, item]);
  }
}
```

---

## 13. Try It Yourself

You are building a shopping cart. The cart has a list of items. You want to:
1. Track a list of items in a signal
2. Compute the total price
3. Compute whether the cart is empty
4. Be able to add and remove items

**Starter Code:**
```typescript
export class ShoppingCartComponent {
  // TODO 1: Create a writable signal for the cart items array
  // TODO 2: Compute the total price (sum of item.price * item.quantity)
  // TODO 3: Compute whether the cart is empty
  // TODO 4: Write an addItem() and removeItem(id) method

  items = ???;
  totalPrice = ???;
  isEmpty = ???;

  addItem(product: Product) { ??? }
  removeItem(id: number) { ??? }
}
```

<details>
<summary>✅ View Solution</summary>

```typescript
import { Component, signal, computed } from '@angular/core';

interface CartItem { id: number; name: string; price: number; quantity: number; }

@Component({
  selector: 'app-shopping-cart',
  standalone: true,
  template: `
    @if (isEmpty()) {
      <p>Your cart is empty.</p>
    } @else {
      @for (item of items(); track item.id) {
        <div>
          {{ item.name }} × {{ item.quantity }} = {{ item.price * item.quantity | currency }}
          <button (click)="removeItem(item.id)">Remove</button>
        </div>
      }
      <strong>Total: {{ totalPrice() | currency }}</strong>
    }
  `
})
export class ShoppingCartComponent {
  // ✅ Writable signal for the cart
  items = signal<CartItem[]>([]);

  // ✅ Derived values — automatically update when items changes
  totalPrice = computed(() =>
    this.items().reduce((sum, item) => sum + (item.price * item.quantity), 0)
  );
  isEmpty = computed(() => this.items().length === 0);

  addItem(product: { id: number; name: string; price: number }) {
    const existing = this.items().find(i => i.id === product.id);
    if (existing) {
      // Increment quantity if already in cart
      this.items.update(items =>
        items.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      );
    } else {
      // Add new item
      this.items.update(items => [...items, { ...product, quantity: 1 }]);
    }
  }

  removeItem(id: number) {
    this.items.update(items => items.filter(i => i.id !== id));
  }
}
```
</details>

---

## 14. Knowledge Check

1. What is the difference between `signal()` and `computed()`?
2. Why can't you mutate an array inside a signal directly (e.g., `.push()`)?
3. What does `untracked()` do, and when would you use it in an `effect()`?
4. When should you use `toSignal()` vs `toObservable()`?
5. What is the advantage of `model()` over a traditional `@Input()` + `@Output() EventEmitter` pair?

<details>
<summary>✅ View Answers</summary>

1. `signal()` is a **writable producer** — you can call `.set()` or `.update()` on it. `computed()` is a **read-only derived value** — you define its formula once and Angular keeps it in sync automatically. You cannot manually set a computed signal.

2. Angular's reactivity system detects changes by comparing the **object reference**. If you push to the same array, the reference (`[]`) hasn't changed, so Angular sees no update. You must use `update(items => [...items, newItem])` to create a new array reference.

3. `untracked()` reads a signal without registering a dependency. Use it when your effect depends logically on Signal A, but also *needs* the value of Signal B without wanting to re-run every time B changes. This prevents unnecessary re-executions.

4. Use **`toSignal(observable$)`** to convert an RxJS Observable into a Signal for use in templates or with `computed()`. Use **`toObservable(mySignal)`** when you want to pipe a signal through RxJS operators (like `debounceTime`, `switchMap`) before consuming the result.

5. `model()` creates a single, writable, two-way-bindable property. With `@Input()` + `@Output()`, you need two separate declarations, the output must be named `{inputName}Change`, and you manage an `EventEmitter` instance. `model()` collapses all of that into one line, is type-safe, and works natively with the signal reactivity graph.
</details>

---

*Next: [03 - Control Flow Syntax →](./03-control-flow.md)*
