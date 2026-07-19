# Angular: Component Communication

> **Goal**: Master every pattern for sharing data between components — from simple parent-child bindings to sibling components communicating through shared services.

---

## 📋 Table of Contents
1. [Data Flow Architecture](#1-data-flow-architecture)
2. [Parent → Child: Signal `input()`](#2-parent--child-signal-input)
3. [Child → Parent: Signal `output()`](#3-child--parent-signal-output)
4. [Two-Way Binding: `model()`](#4-two-way-binding-model)
5. [Sibling Communication via Service](#5-sibling-communication-via-service)
6. [Legacy: `@Input()` & `@Output()` Decorators](#6-legacy-input--output-decorators)
7. [Choosing the Right Pattern](#7-choosing-the-right-pattern)
8. [Real-World Example: Product List with Filters](#8-real-world-example)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. Data Flow Architecture

Angular enforces **Unidirectional Data Flow (UDF)**:

```
Parent Component
    ↓ [data] = input          Data flows DOWN via inputs
Child Component
    ↑ (event) = output        Events flow UP via outputs
```

For non-parent-child communication:
```
Component A  ←→  Shared Service (Signal)  ←→  Component B
```

This architecture makes state changes **predictable and debuggable** — you always know where data comes from.

---

## 2. Parent → Child: Signal `input()`

`input()` is the modern replacement for `@Input()`. It returns a **read-only Signal** directly.

```typescript
// child: product-card.component.ts
import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Product } from '../models/product.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,  // Optimal with signals!
  template: `
    <div class="card" [class.featured]="isFeatured()">
      <img [src]="product().imageUrl" [alt]="product().name">
      <h3>{{ product().name }}</h3>
      <p>{{ product().price | currency }}</p>
      @if (showDescription()) {
        <p class="description">{{ product().description }}</p>
      }
      <span class="badge">{{ stockLabel() }}</span>
    </div>
  `
})
export class ProductCardComponent {
  // Required input — TypeScript error if parent forgets to pass it
  product = input.required<Product>();

  // Optional input with default value
  showDescription = input<boolean>(false);

  // Input with alias — parent uses [isFeaturedProduct]="..." in template
  isFeatured = input<boolean>(false, { alias: 'isFeaturedProduct' });

  // Computed value derived from input — reactive and memoized
  stockLabel = computed(() => {
    const stock = this.product().stock;
    if (stock === 0) return '❌ Out of Stock';
    if (stock < 5) return `⚠️ Only ${stock} left!`;
    return `✅ In Stock`;
  });
}
```

```typescript
// parent: product-list.component.ts
import { Component, signal } from '@angular/core';
import { ProductCardComponent } from './product-card.component';
import { Product } from '../models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [ProductCardComponent],
  template: `
    <div class="grid">
      @for (product of products(); track product.id; let i = $index) {
        <app-product-card
          [product]="product"
          [showDescription]="true"
          [isFeaturedProduct]="i === 0">
        </app-product-card>
      }
    </div>
  `
})
export class ProductListComponent {
  products = signal<Product[]>([]);
}
```

### Reacting to Input Changes

With `input()`, you no longer need `ngOnChanges`. Use `effect()` or `computed()`:

```typescript
export class ProductCardComponent {
  product = input.required<Product>();

  // React to changes with computed()
  discountedPrice = computed(() => this.product().price * 0.9);

  constructor() {
    // React to changes with effect()
    effect(() => {
      console.log('Product changed:', this.product().name);
    });
  }
}
```

---

## 3. Child → Parent: Signal `output()`

`output()` replaces `@Output() EventEmitter`. It's a typed event emitter with no RxJS dependency.

```typescript
// child: product-card.component.ts
import { Component, input, output, computed } from '@angular/core';
import { Product } from '../models/product.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  template: `
    <div class="card">
      <h3>{{ product().name }}</h3>
      <button (click)="addToCart()">Add to Cart</button>
      <button (click)="wishlist()">♡ Save</button>
      <button (click)="remove()">🗑 Remove</button>
    </div>
  `
})
export class ProductCardComponent {
  product = input.required<Product>();

  // output() replaces @Output() EventEmitter — cleaner, type-safe
  cartAdd = output<Product>();
  wishlistAdd = output<Product>();
  productDelete = output<number>();  // Emits the product ID

  addToCart() {
    this.cartAdd.emit(this.product());
  }

  wishlist() {
    this.wishlistAdd.emit(this.product());
  }

  remove() {
    this.productDelete.emit(this.product().id);
  }
}
```

```html
<!-- parent template -->
<app-product-card
  [product]="p"
  (cartAdd)="handleAddToCart($event)"
  (wishlistAdd)="handleWishlist($event)"
  (productDelete)="handleDelete($event)">
</app-product-card>
```

---

## 4. Two-Way Binding: `model()`

`model()` is for two-way binding — the child can update a value AND notify the parent simultaneously. Replaces the `@Input()` + `@Output() XxxChange` boilerplate.

```typescript
// child: star-rating.component.ts
import { Component, model } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  template: `
    <div class="stars">
      @for (star of stars; track star) {
        <span
          [class.filled]="star <= rating()"
          (click)="rating.set(star)"
          (mouseenter)="hovered.set(star)"
          (mouseleave)="hovered.set(0)">
          {{ (hovered() >= star || (!hovered() && rating() >= star)) ? '★' : '☆' }}
        </span>
      }
    </div>
  `
})
export class StarRatingComponent {
  // model() = two-way bindable input
  rating = model<number>(0);

  stars = [1, 2, 3, 4, 5];
  hovered = signal(0);
}
```

```typescript
// parent
@Component({
  selector: 'app-product-review',
  standalone: true,
  imports: [StarRatingComponent],
  template: `
    <h2>Rate this product:</h2>
    <!-- [(rating)] = two-way binding syntax -->
    <app-star-rating [(rating)]="myRating"></app-star-rating>
    <p>You selected: {{ myRating() }} stars</p>
  `
})
export class ProductReviewComponent {
  myRating = signal(0);
}
```

---

## 5. Sibling Communication via Service

When components are not in a parent-child relationship, use a **shared service with signals** as the single source of truth.

```typescript
// src/app/features/products/services/product-filter.service.ts
import { Injectable, signal, computed } from '@angular/core';

export interface FilterState {
  search: string;
  category: string;
  minPrice: number;
  maxPrice: number;
  inStockOnly: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductFilterService {
  // Centralized filter state
  private _filters = signal<FilterState>({
    search: '',
    category: 'all',
    minPrice: 0,
    maxPrice: 1000,
    inStockOnly: false
  });

  // Expose read-only to prevent direct mutation
  readonly filters = this._filters.asReadonly();
  readonly hasActiveFilters = computed(() => {
    const f = this._filters();
    return f.search !== '' || f.category !== 'all' || f.inStockOnly;
  });

  setSearch(search: string) {
    this._filters.update(f => ({ ...f, search }));
  }

  setCategory(category: string) {
    this._filters.update(f => ({ ...f, category }));
  }

  setPriceRange(min: number, max: number) {
    this._filters.update(f => ({ ...f, minPrice: min, maxPrice: max }));
  }

  toggleInStock() {
    this._filters.update(f => ({ ...f, inStockOnly: !f.inStockOnly }));
  }

  resetFilters() {
    this._filters.set({ search: '', category: 'all', minPrice: 0, maxPrice: 1000, inStockOnly: false });
  }
}
```

```typescript
// Component A: FilterPanelComponent (sibling 1)
@Component({
  selector: 'app-filter-panel',
  template: `
    <input (input)="filterService.setSearch($any($event.target).value)" placeholder="Search...">
    <select (change)="filterService.setCategory($any($event.target).value)">
      <option value="all">All</option>
      <option value="electronics">Electronics</option>
    </select>
    @if (filterService.hasActiveFilters()) {
      <button (click)="filterService.resetFilters()">Clear Filters</button>
    }
  `
})
export class FilterPanelComponent {
  readonly filterService = inject(ProductFilterService);
}

// Component B: ProductsGridComponent (sibling 2)
@Component({
  selector: 'app-products-grid',
  template: `
    <p>Showing filtered results for: "{{ filterService.filters().search }}"</p>
    <!-- Products grid here, filtered by filterService.filters() -->
  `
})
export class ProductsGridComponent {
  readonly filterService = inject(ProductFilterService);
  // This component reads the same filterService instance — changes from FilterPanel
  // are immediately reflected here!
}
```

---

## 6. Legacy: `@Input()` & `@Output()` Decorators

Still valid and widely used in existing codebases. Understand both.

```typescript
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

@Component({ selector: 'app-user-card', template: `<h2>{{ user.name }}</h2>` })
export class UserCardComponent implements OnChanges {
  @Input({ required: true }) user!: { name: string; email: string };
  @Input() showEmail = false;
  @Output() userDelete = new EventEmitter<string>(); // Emits user ID

  // The OLD way to react to input changes — replaced by effect() in modern Angular
  ngOnChanges(changes: SimpleChanges) {
    if (changes['user']) {
      console.log('User changed from', changes['user'].previousValue, 'to', changes['user'].currentValue);
    }
  }

  delete() {
    this.userDelete.emit(this.user.email);
  }
}
```

> **Recommendation**: For **new components**, use `input()`, `output()`, and `model()`. For **existing components**, `@Input()` / `@Output()` are perfectly fine.

---

## 7. Choosing the Right Pattern

| Scenario | Pattern |
|---|---|
| Parent passes data to child | `input()` or `@Input()` |
| Child notifies parent of an event | `output()` or `@Output()` |
| Child reads AND writes a parent value | `model()` |
| Sibling A updates, Sibling B reacts | Shared `Injectable` service with signals |
| Deeply nested component needs root state | `providedIn: 'root'` service |
| Feature-scoped state | Service provided at feature route level |
| Descendant needs ancestor's data without passing through every level | `inject()` with a service OR Content Projection |

---

## 8. Real-World Example: Product List with Filters

```
AppShellComponent
  ├── FilterSidebarComponent    ← writes to ProductFilterService
  └── ProductsPageComponent
        ├── SortBarComponent    ← writes to ProductFilterService
        └── ProductGridComponent ← reads ProductFilterService + ProductService
```

```typescript
// product-filter.service.ts — the shared "state bus"
@Injectable({ providedIn: 'root' })
export class ProductFilterService {
  search = signal('');
  sortBy = signal<'price' | 'name' | 'rating'>('name');
  page = signal(1);

  // Reset page when search or sort changes
  constructor() {
    effect(() => {
      this.search();   // Track search
      this.sortBy();   // Track sort
      this.page.set(1); // Reset to page 1
    });
  }
}

// FilterSidebarComponent
export class FilterSidebarComponent {
  filterService = inject(ProductFilterService);
}

// SortBarComponent — same service, different location in the tree
export class SortBarComponent {
  filterService = inject(ProductFilterService);
}

// ProductGridComponent — consumes the current filter state
export class ProductGridComponent {
  private filterService = inject(ProductFilterService);
  private productService = inject(ProductService);

  private params = computed(() => ({
    q: this.filterService.search(),
    sort: this.filterService.sortBy(),
    page: this.filterService.page()
  }));

  // Automatically refetches when any filter changes
  products = toSignal(
    toObservable(this.params).pipe(
      debounceTime(300),
      switchMap(params => this.productService.getAll(params))
    ),
    { initialValue: [] }
  );
}
```

---

## 9. Common Pitfalls

### Pitfall 1: Mutating `@Input()` / `input()` data in the child

```typescript
// ❌ NEVER modify input data directly — this breaks unidirectional data flow!
export class UserCardComponent {
  user = input.required<User>();

  updateName() {
    this.user().name = 'Bob';  // WRONG! Mutating received data!
  }
}

// ✅ Emit an output so the parent handles the change
export class UserCardComponent {
  user = input.required<User>();
  userChange = output<User>();

  updateName(newName: string) {
    this.userChange.emit({ ...this.user(), name: newName });
  }
}
```

### Pitfall 2: Forgetting `$event` in output binding

```html
<!-- ❌ $event is not passed — handler receives undefined! -->
<app-product-card (cartAdd)="handleAdd()"></app-product-card>

<!-- ✅ Pass $event to capture the emitted payload -->
<app-product-card (cartAdd)="handleAdd($event)"></app-product-card>
```

### Pitfall 3: Using property binding for strings

```html
<!-- ❌ Passes the STRING "currentUser" to the child — not the variable! -->
<app-user-card user="currentUser"></app-user-card>

<!-- ✅ Property binding [] evaluates the expression -->
<app-user-card [user]="currentUser"></app-user-card>
<!-- Or for simple string literals: -->
<app-user-card [user]="{ name: 'Alice', email: 'alice@example.com' }"></app-user-card>
```

### Pitfall 4: Prop drilling (passing data through many layers)

```typescript
// ❌ Data passed through A → B → C → D just to get to D
// Components B and C become "middlemen" that pass-through data they don't use

// ✅ Use a service — D can inject the service directly
// No need for B and C to know about the data
```

---

## 10. Knowledge Check

1. What are the three main advantages of Signal `input()` over the `@Input()` decorator?
2. When should you use `model()` instead of a separate `@Input()` + `@Output()` pair?
3. If components A and B are on completely different branches of the component tree (not parent-child), how should they share state?
4. What is the `{ alias: 'xxx' }` option in `input()` used for?
5. Why should you never mutate data received via `@Input()` or `input()` in the child component?

<details>
<summary>✅ View Answers</summary>

1. **(a) Reactive by default**: An `input()` is a Signal, so you can use it directly with `computed()` and `effect()` without needing `ngOnChanges`. **(b) Type safety**: `input.required<T>()` provides a compile-time error if the parent forgets to pass the value. **(c) Derived state is simpler**: `computed(() => this.user().role === 'admin')` is cleaner than creating a property and updating it in `ngOnChanges`.

2. Use `model()` when the child component needs to **both receive a value from the parent AND update it**. Classic examples: custom form inputs (star ratings, color pickers, toggles), where the parent cares about the current value and the child can change it. It replaces the `@Input() value` + `@Output() valueChange` boilerplate.

3. Use a **shared `Injectable` service** with Signals as the source of truth. Both components inject the same service instance and read/write to it. Changes made by one component are immediately reflected in the other through signal reactivity.

4. `{ alias: 'xxx' }` allows the parent to use a **different attribute name** in the template than the property name inside the child class. For example, `input.required<User>({ alias: 'userData' })` means the parent writes `[userData]="user"` in HTML, but inside the child component class, the property is accessed as `this.user()`. Useful for creating more descriptive template APIs.

5. Mutating `@Input()` / `input()` data violates Angular's **Unidirectional Data Flow** principle. The parent owns the data — the child only has a reference to it. If the child mutates it directly, the parent doesn't know about the change, making state unpredictable and debugging very difficult. Instead, the child should emit an `output()` event requesting the parent to make the change.
</details>

---

*Next: [09 - Lifecycle Hooks →](./09-lifecycle-hooks.md)*
