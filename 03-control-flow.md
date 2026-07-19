# Angular: Control Flow Syntax

> **Goal**: Master Angular's modern `@if`, `@for`, and `@switch` template syntax to write clean, performant, and type-safe templates.

---

## 📋 Table of Contents
1. [Why the New Syntax?](#1-why-the-new-syntax)
2. [Conditional Rendering — `@if`](#2-conditional-rendering--if)
3. [Iteration — `@for`](#3-iteration--for)
4. [The `@empty` block](#4-the-empty-block)
5. [Switch Statements — `@switch`](#5-switch-statements--switch)
6. [Performance Considerations](#6-performance-considerations)
7. [Migrating from Old Syntax](#7-migrating-from-old-syntax)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Try It Yourself](#9-try-it-yourself)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. Why the New Syntax?

Angular v17 replaced structural directives (`*ngIf`, `*ngFor`, `*ngSwitch`) with a built-in control flow syntax (`@if`, `@for`, `@switch`).

### Old Problems Solved

| Old Structural Directives | New `@` Block Syntax |
|---|---|
| `*ngIf` + `*ngFor` on same element was impossible | Works natively on the same element |
| Required `<ng-container>` for grouping | No wrapper needed — `@if { ... }` wraps a block |
| `trackBy` was optional in `*ngFor` (performance trap) | `track` is **mandatory** in `@for` |
| Required importing `NgIf`, `NgFor` from `CommonModule` | Zero imports needed — built into compiler |
| Type narrowing didn't work inside `*ngIf` templates | TypeScript type narrowing works natively inside `@if` |
| No built-in "else if" — needed `ng-template #elseRef` | Native `@else if` chain |

---

## 2. Conditional Rendering — `@if`

### Basic Usage

```html
<!-- Simple condition -->
@if (isLoggedIn()) {
  <app-dashboard></app-dashboard>
} @else {
  <app-login></app-login>
}
```

### With `@else if`

```html
@if (status() === 'loading') {
  <div class="spinner">Loading...</div>
} @else if (status() === 'error') {
  <div class="error-banner">
    <p>Something went wrong!</p>
    <button (click)="retry()">Try Again</button>
  </div>
} @else if (status() === 'empty') {
  <div class="empty-state">
    <img src="empty.svg" alt="No data">
    <p>No items found. Create one to get started.</p>
  </div>
} @else {
  <app-data-grid [data]="results()"></app-data-grid>
}
```

### The `as` Alias — Your Best Friend

The `as` keyword evaluates the expression **once** and assigns it a local alias. This is perfect for:
1. Avoiding repeated function/signal calls
2. Getting TypeScript to **narrow the type** (e.g., from `User | null` to `User`)

```typescript
// In the component
currentUser = signal<User | null>(null);
```

```html
<!-- Without alias — currentUser() called 3 times, type is User | null each time -->
@if (currentUser()) {
  <h1>Welcome, {{ currentUser()!.name }}</h1>       <!-- Need non-null assertion ! -->
  <p>Email: {{ currentUser()!.email }}</p>
  <p>Role: {{ currentUser()!.role }}</p>
}

<!-- ✅ With 'as' alias — called once, type is narrowed to 'User' inside the block -->
@if (currentUser(); as user) {
  <h1>Welcome, {{ user.name }}</h1>    <!-- No ! needed, TypeScript knows it's User -->
  <p>Email: {{ user.email }}</p>
  <p>Role: {{ user.role }}</p>
}
```

### Nested Conditions

```html
@if (hasPermission()) {
  @if (isFeatureEnabled()) {
    <app-advanced-feature></app-advanced-feature>
  } @else {
    <p>Feature coming soon!</p>
  }
} @else {
  <app-access-denied></app-access-denied>
}
```

---

## 3. Iteration — `@for`

### The `track` Expression is Mandatory

`track` is how Angular identifies which DOM element corresponds to which data item. When the array changes, Angular uses `track` to figure out:
- Which items were **added** (create new DOM elements)
- Which items were **removed** (destroy DOM elements)
- Which items were **moved** (move existing DOM elements — very cheap!)

```html
<!-- ✅ Best practice: Track by a unique identifier -->
@for (user of users(); track user.id) {
  <div class="user-row">{{ user.name }}</div>
}

<!-- ✅ Acceptable for primitives: Track by value itself -->
@for (color of ['red', 'green', 'blue']; track color) {
  <span [style.color]="color">{{ color }}</span>
}

<!-- ⚠️ Last resort: Track by index (only for static/immutable lists) -->
@for (item of items(); track $index) {
  <div>{{ item }}</div>
}
```

### Built-in Loop Variables

Angular provides implicit variables inside every `@for` block:

| Variable | Type | Description |
|---|---|---|
| `$index` | `number` | Zero-based position in the collection |
| `$count` | `number` | Total number of items |
| `$first` | `boolean` | `true` for the first item |
| `$last` | `boolean` | `true` for the last item |
| `$even` | `boolean` | `true` for even-indexed items (0, 2, 4...) |
| `$odd` | `boolean` | `true` for odd-indexed items (1, 3, 5...) |

```html
<ul class="notification-list">
  @for (notification of notifications(); track notification.id;
        let i = $index;
        let total = $count;
        let isFirst = $first;
        let isLast = $last;
        let isEven = $even) {

    <li
      [class.first-item]="isFirst"
      [class.zebra-stripe]="isEven"
      [class.no-border]="isLast">

      <!-- Show position like "3 of 12" -->
      <span class="counter">{{ i + 1 }} of {{ total }}</span>
      {{ notification.message }}

      <!-- Only show divider if NOT the last item -->
      @if (!isLast) { <hr> }
    </li>
  }
</ul>
```

### Nested `@for` loops

```html
<!-- Product categories with their products -->
@for (category of categories(); track category.id) {
  <section>
    <h2>{{ category.name }}</h2>

    @for (product of category.products; track product.id) {
      <app-product-card [product]="product"></app-product-card>
    }
  </section>
}
```

---

## 4. The `@empty` block

When the array is empty, the `@empty` block renders automatically. This completely replaces the old `*ngIf="items.length === 0"` pattern.

```html
@for (order of orders(); track order.id) {
  <div class="order-card">
    <span>Order #{{ order.id }}</span>
    <span>{{ order.status }}</span>
    <span>{{ order.total | currency }}</span>
  </div>
} @empty {
  <!-- This renders if orders() returns an empty array [] -->
  <div class="empty-state">
    <img src="/assets/empty-orders.svg" alt="No orders">
    <h3>No orders yet</h3>
    <p>When you place an order, it will appear here.</p>
    <a routerLink="/shop">Start Shopping</a>
  </div>
}
```

### Full Pattern: Loading + Error + Empty + Data

```html
@if (isLoading()) {
  <!-- Skeleton loading state -->
  @for (i of [1,2,3]; track i) {
    <div class="skeleton-card"></div>
  }
} @else if (errorMessage()) {
  <div class="error-state">{{ errorMessage() }}</div>
} @else {
  @for (product of products(); track product.id) {
    <app-product-card [product]="product"></app-product-card>
  } @empty {
    <app-empty-state message="No products found"></app-empty-state>
  }
}
```

---

## 5. Switch Statements — `@switch`

Use `@switch` when you need to render one of several options based on a value.

```html
<!-- Basic switch -->
@switch (user.role) {
  @case ('admin') {
    <app-admin-toolbar></app-admin-toolbar>
  }
  @case ('editor') {
    <app-editor-toolbar></app-editor-toolbar>
  }
  @case ('viewer') {
    <p>Read-only access</p>
  }
  @default {
    <p>Unknown role</p>
  }
}
```

### Switch on Computed Signals

```typescript
// Component
orderStatusLabel = computed(() => {
  const order = this.currentOrder();
  if (!order) return 'none';
  return order.status;
});
```

```html
<!-- Switch on a computed signal -->
@switch (orderStatusLabel()) {
  @case ('pending') {
    <span class="badge badge-warning">⏳ Pending</span>
  }
  @case ('processing') {
    <span class="badge badge-info">🔄 Processing</span>
  }
  @case ('shipped') {
    <span class="badge badge-primary">🚚 Shipped</span>
  }
  @case ('delivered') {
    <span class="badge badge-success">✅ Delivered</span>
  }
  @case ('cancelled') {
    <span class="badge badge-danger">❌ Cancelled</span>
  }
  @default {
    <span class="badge">Unknown</span>
  }
}
```

---

## 6. Performance Considerations

### Why `track` by `id` and not `$index`?

Consider a list of 5 users. The user deletes user #2:

**Tracking by `$index` (bad):**
```
Before: [Alice(0), Bob(1), Charlie(2), Diana(3), Eve(4)]
After:  [Alice(0), Charlie(1), Diana(2), Eve(3)]
         ^         ^           ^          ^
         Changed!  Changed!    Changed!   Changed!
```
Angular sees that indices 1, 2, 3, 4 all have new content, so it **destroys and recreates 4 DOM elements**. That's expensive!

**Tracking by `id` (good):**
```
Before: [Alice(id:1), Bob(id:2), Charlie(id:3), Diana(id:4), Eve(id:5)]
After:  [Alice(id:1), Charlie(id:3), Diana(id:4), Eve(id:5)]
         ^            ^              ^              ^
         Unchanged!   Unchanged!     Unchanged!     Unchanged!
```
Angular recognizes Bob (id:2) was removed, and simply **removes that one DOM element**. Everything else stays in place.

### Avoiding Function Calls in Templates

Every function call in a template re-executes on each render cycle. Use `computed()` to cache derived values.

```html
<!-- ❌ getFilteredItems() runs on EVERY change detection cycle -->
@for (item of getFilteredItems(); track item.id) { ... }

<!-- ✅ filteredItems is a computed signal — only recalculates when dependencies change -->
@for (item of filteredItems(); track item.id) { ... }
```

---

## 7. Migrating from Old Syntax

Here's a quick conversion reference:

### `*ngIf` → `@if`

```html
<!-- OLD -->
<div *ngIf="isVisible; else hiddenTemplate">Content</div>
<ng-template #hiddenTemplate><p>Hidden</p></ng-template>

<!-- NEW -->
@if (isVisible) {
  <div>Content</div>
} @else {
  <p>Hidden</p>
}
```

### `*ngFor` → `@for`

```html
<!-- OLD -->
<li *ngFor="let item of items; index as i; trackBy: trackById">
  {{ i }}: {{ item.name }}
</li>

<!-- NEW — track is mandatory and inline, no separate trackBy function needed! -->
@for (item of items; track item.id; let i = $index) {
  <li>{{ i }}: {{ item.name }}</li>
}
```

### `[ngSwitch]` → `@switch`

```html
<!-- OLD — verbose and confusing -->
<div [ngSwitch]="status">
  <p *ngSwitchCase="'active'">Active</p>
  <p *ngSwitchCase="'inactive'">Inactive</p>
  <p *ngSwitchDefault>Unknown</p>
</div>

<!-- NEW — clean and readable -->
@switch (status) {
  @case ('active') { <p>Active</p> }
  @case ('inactive') { <p>Inactive</p> }
  @default { <p>Unknown</p> }
}
```

### Removing Old Imports

Since the new syntax is built into the compiler, you can remove `NgIf`, `NgFor`, `NgSwitch` from your component imports:

```typescript
// ❌ OLD — needed these imports
imports: [NgIf, NgFor, NgSwitch, NgSwitchCase, CommonModule]

// ✅ NEW — none of these are needed for control flow
imports: [
  // Only import what you actually use (pipes, components, etc.)
  DatePipe,
  CurrencyPipe,
  ProductCardComponent,
]
```

---

## 8. Common Pitfalls

### Pitfall 1: Tracking by `$index` with mutable arrays

```html
<!-- ❌ If users are sorted/filtered/deleted, this causes unnecessary re-renders -->
@for (user of users(); track $index) { ... }

<!-- ✅ Always track by a unique, stable identifier -->
@for (user of users(); track user.id) { ... }
```

### Pitfall 2: Importing old directives unnecessarily

```typescript
// ❌ Remove these — they are no longer needed for control flow
@Component({
  imports: [NgIf, NgFor, CommonModule]
})
```

### Pitfall 3: Using `ng-template` for `@else` when not needed

```html
<!-- ❌ Old way — unnecessarily verbose -->
<div *ngIf="condition; else myTemplate">...</div>
<ng-template #myTemplate>...</ng-template>

<!-- ✅ New way -->
@if (condition) { ... } @else { ... }
```

### Pitfall 4: Not using `as` for complex signal expressions

```html
<!-- ❌ signal() called 5 times, potential unnecessary function calls -->
@if (productStore.selectedProduct()) {
  <h1>{{ productStore.selectedProduct()!.name }}</h1>
  <p>{{ productStore.selectedProduct()!.description }}</p>
  <img [src]="productStore.selectedProduct()!.imageUrl">
}

<!-- ✅ Evaluated once, TypeScript narrowed, clean code -->
@if (productStore.selectedProduct(); as product) {
  <h1>{{ product.name }}</h1>
  <p>{{ product.description }}</p>
  <img [src]="product.imageUrl">
}
```

---

## 9. Try It Yourself

**Task**: Refactor this legacy Angular template to use modern syntax. The component has:
- A `movies` signal with type `{ id: number; title: string; genre: string; rating: number }[]`
- An `isLoading` signal (boolean)
- A `selectedGenre` signal (string)

**Legacy Template:**
```html
<div *ngIf="!isLoading; else loadingBlock">
  <ng-container *ngIf="movies.length > 0; else emptyBlock">
    <div *ngFor="let movie of movies; let i = index; trackBy: trackByMovieId"
         [class.featured]="i === 0">
      <span>{{ i + 1 }}. {{ movie.title }}</span>
      <div [ngSwitch]="movie.genre">
        <span *ngSwitchCase="'Action'" class="genre-action">🎬 Action</span>
        <span *ngSwitchCase="'Comedy'" class="genre-comedy">😂 Comedy</span>
        <span *ngSwitchDefault class="genre-other">🎭 Other</span>
      </div>
    </div>
  </ng-container>

  <ng-template #emptyBlock>
    <p>No movies match your filter.</p>
  </ng-template>
</div>

<ng-template #loadingBlock>
  <div class="spinner">Loading movies...</div>
</ng-template>
```

> **Hint**: Use `@if`, `@for` with `@empty`, and `@switch`. Remove the `ng-template` references entirely.

<details>
<summary>✅ View Solution</summary>

```html
@if (isLoading()) {
  <div class="spinner">Loading movies...</div>
} @else {
  @for (movie of movies(); track movie.id; let i = $index; let isFirst = $first) {
    <div [class.featured]="isFirst">
      <span>{{ i + 1 }}. {{ movie.title }}</span>

      @switch (movie.genre) {
        @case ('Action') { <span class="genre-action">🎬 Action</span> }
        @case ('Comedy') { <span class="genre-comedy">😂 Comedy</span> }
        @default { <span class="genre-other">🎭 Other</span> }
      }
    </div>
  } @empty {
    <p>No movies match your filter.</p>
  }
}
```

**What changed:**
- No `ng-template` elements needed
- No `trackBy` function needed — tracking is inline
- `$first` replaces the `index === 0` check cleanly
- `@empty` replaces the complex empty-check condition
- No imports needed — everything is built into the compiler
</details>

---

## 10. Knowledge Check

1. Why is the `track` expression mandatory in `@for`, but `trackBy` was optional in `*ngFor`?
2. What is the TypeScript benefit of using `@if (user(); as u)` instead of `@if (user())`?
3. When would you use `track $index` instead of `track item.id`?
4. How does `@empty` improve code readability compared to the old `*ngIf="items.length === 0"` pattern?

<details>
<summary>✅ View Answers</summary>

1. The Angular team made it mandatory in the new syntax because tracking by index is a common performance anti-pattern that caused subtle bugs in production. By requiring `track`, they force developers to think about it, leading to better default performance across all Angular apps.

2. When you use `as u`, TypeScript **narrows the type** inside the block. If `user()` returns `User | null`, inside `@if (user(); as u)`, TypeScript knows `u` is of type `User` (not `User | null`). This means you don't need the non-null assertion operator `!` and get full autocomplete.

3. You should use `track $index` only when iterating over a **static, immutable array of primitives** (e.g., `['a', 'b', 'c']`) where items never change order, are never inserted/deleted from the middle. For any real-world data with IDs, always track by the unique identifier.

4. `@empty` is co-located with the `@for` loop — the empty state is visually adjacent to the list it corresponds to, making the intent immediately clear. The old pattern required a separate `*ngIf="items.length === 0"` element far from the `*ngFor`, which was easy to forget and hard to maintain.
</details>

---

*Next: [04 - Routing & Navigation →](./04-routing.md)*
