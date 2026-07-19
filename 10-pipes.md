# Angular: Pipes & Custom Pipes

> **Goal**: Use Angular's built-in pipes for data transformation in templates, and build custom pipes for reusable formatting logic — while understanding performance implications.

---

## 📋 Table of Contents
1. [What is a Pipe?](#1-what-is-a-pipe)
2. [Built-in Pipes Reference](#2-built-in-pipes-reference)
3. [Chaining Pipes](#3-chaining-pipes)
4. [The `AsyncPipe` Deep Dive](#4-the-asyncpipe-deep-dive)
5. [Pure vs Impure Pipes](#5-pure-vs-impure-pipes)
6. [Building Custom Pipes](#6-building-custom-pipes)
7. [Pipes vs Computed Signals](#7-pipes-vs-computed-signals)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Try It Yourself](#9-try-it-yourself)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. What is a Pipe?

A pipe transforms data **for display in the template only**. It doesn't modify the underlying TypeScript variable — only how it appears on screen.

```
{{ value | pipeName:arg1:arg2 }}
```

Pipes are excellent for: formatting dates, currencies, percentages, truncating text, and other presentation-layer transformations.

---

## 2. Built-in Pipes Reference

Import these from `@angular/common` (except `AsyncPipe` which needs its own import in some contexts):

```typescript
import { DatePipe, CurrencyPipe, DecimalPipe, PercentPipe, UpperCasePipe, LowerCasePipe, TitleCasePipe, JsonPipe, KeyValuePipe, SlicePipe, AsyncPipe } from '@angular/common';
```

```html
<!-- DatePipe -->
{{ today | date }}                          <!-- Nov 24, 2024 -->
{{ today | date:'shortDate' }}              <!-- 11/24/24 -->
{{ today | date:'fullDate' }}               <!-- Sunday, November 24, 2024 -->
{{ today | date:'dd/MM/yyyy HH:mm' }}       <!-- 24/11/2024 14:30 -->
{{ today | date:'mediumDate':'UTC' }}       <!-- Force UTC timezone -->

<!-- CurrencyPipe -->
{{ 1234.5 | currency }}                     <!-- $1,234.50 -->
{{ 1234.5 | currency:'EUR' }}               <!-- €1,234.50 -->
{{ 1234.5 | currency:'GBP':'symbol-narrow':'1.0-0' }}  <!-- £1,235 -->

<!-- DecimalPipe (number) -->
{{ 3.14159 | number:'1.2-2' }}              <!-- 3.14 (min 1 integer, 2-2 decimal) -->
{{ 1000000 | number }}                      <!-- 1,000,000 -->

<!-- PercentPipe -->
{{ 0.25 | percent }}                        <!-- 25% -->
{{ 0.2568 | percent:'1.0-1' }}             <!-- 25.7% -->

<!-- String Pipes -->
{{ 'hello world' | uppercase }}             <!-- HELLO WORLD -->
{{ 'HELLO WORLD' | lowercase }}             <!-- hello world -->
{{ 'hello world' | titlecase }}             <!-- Hello World -->

<!-- JsonPipe — great for debugging! -->
{{ debugObject | json }}                    <!-- { "key": "value", ... } -->

<!-- SlicePipe — for arrays and strings -->
{{ [1,2,3,4,5] | slice:1:3 }}              <!-- [2,3] -->
{{ 'Hello World' | slice:0:5 }}            <!-- Hello -->

<!-- KeyValuePipe — iterate over object properties -->
@for (entry of myObject | keyvalue; track entry.key) {
  <p>{{ entry.key }}: {{ entry.value }}</p>
}
```

---

## 3. Chaining Pipes

You can chain multiple pipes together:

```html
<!-- Apply two pipes sequentially -->
{{ user.joinDate | date:'fullDate' | uppercase }}
<!-- "SUNDAY, NOVEMBER 24, 2024" -->

{{ product.description | slice:0:100 | titlecase }}
<!-- First 100 chars, then title-cased -->

{{ apiResponse | json | slice:0:200 }}
<!-- First 200 chars of the JSON string representation -->
```

---

## 4. The `AsyncPipe` Deep Dive

`AsyncPipe` automatically:
1. **Subscribes** to an Observable or Promise
2. **Returns** the latest emitted value
3. **Unsubscribes** when the component is destroyed (no memory leaks!)
4. **Triggers change detection** when a new value arrives

```typescript
import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <!-- AsyncPipe handles subscribe/unsubscribe for you -->
    @if (notifications$ | async; as notifications) {
      <span class="badge">{{ notifications.length }}</span>

      @for (n of notifications; track n.id) {
        <div class="notification">{{ n.message }}</div>
      }
    } @else {
      <p>Loading notifications...</p>
    }
  `
})
export class NotificationsComponent {
  private http = inject(HttpClient);

  // Note: If you use the pipe in multiple places in the template,
  // use shareReplay(1) to avoid multiple HTTP requests!
  notifications$: Observable<Notification[]> = this.http.get<Notification[]>('/api/notifications').pipe(
    shareReplay(1)  // Cache the result, prevent duplicate requests
  );
}
```

### `AsyncPipe` vs `toSignal()` — When to Use Which

| Approach | Template Syntax | Best For |
|---|---|---|
| `AsyncPipe` | `{{ obs$ \| async }}` | Simple, single observable binding |
| `toSignal()` | `{{ data() }}` | Complex component logic, combining with computed() |

```typescript
// With AsyncPipe — good for simple cases
template$ = this.http.get<Template>('/api/template');
// template: {{ template$ | async | json }}

// With toSignal — better for complex derived state
template = toSignal(this.http.get<Template>('/api/template'));
// In template: {{ template()?.title }}
processedTitle = computed(() => this.template()?.title.toUpperCase() ?? '');
```

---

## 5. Pure vs Impure Pipes

### Pure Pipes (Default)

Angular executes a pure pipe **only** when it detects a "pure change":
- Primitive: the value itself changes (`'a'` → `'b'`)
- Object/Array: the **reference** changes (new object/array)

```typescript
@Pipe({ name: 'formatName', standalone: true })  // pure: true by default
export class FormatNamePipe implements PipeTransform {
  transform(user: User): string {
    return `${user.firstName} ${user.lastName}`;
  }
}
// Only re-runs when the user reference changes, not when user.firstName changes!
```

### Impure Pipes (Avoid!)

Setting `pure: false` makes the pipe run on **every single change detection cycle** — every mouse move, every keystroke, every timer tick. This is devastating for performance.

```typescript
// ❌ NEVER do this for performance-critical pipes!
@Pipe({ name: 'liveFilter', pure: false })
export class LiveFilterPipe { /* ... */ }
```

The only built-in impure pipe is `AsyncPipe` — it needs to be impure because the Observable can emit new values without the Observable reference changing.

**The modern alternative to impure pipes**: Use `computed()` signals!

```typescript
// ❌ Impure pipe — runs on every change detection
@Pipe({ name: 'filter', standalone: true, pure: false })
export class FilterPipe implements PipeTransform {
  transform(items: Item[], search: string): Item[] {
    return items.filter(i => i.name.includes(search));
  }
}

// ✅ Computed signal — only re-runs when items or search actually changes
filteredItems = computed(() =>
  this.items().filter(i => i.name.includes(this.search()))
);
```

---

## 6. Building Custom Pipes

### Simple Formatting Pipe

```typescript
// src/app/shared/pipes/truncate.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true,
  // pure: true (default) — only re-runs when input changes
})
export class TruncatePipe implements PipeTransform {
  // transform(value, ...args)
  // value = what's on the left of the pipe
  // args = what's passed after the colon(s)
  transform(text: string, maxLength = 100, suffix = '...'): string {
    if (!text || text.length <= maxLength) {
      return text ?? '';
    }
    return text.substring(0, maxLength).trimEnd() + suffix;
  }
}
```

```html
<!-- Usage -->
{{ article.content | truncate }}                      <!-- Truncates at 100 chars -->
{{ article.content | truncate:50 }}                   <!-- Truncates at 50 chars -->
{{ article.content | truncate:50:'... Read more' }}    <!-- Custom suffix -->
```

### Relative Time Pipe ("3 minutes ago")

```typescript
// src/app/shared/pipes/time-ago.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  transform(value: Date | string): string {
    const now = new Date();
    const date = new Date(value);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }
}
```

```html
<small>Posted {{ comment.createdAt | timeAgo }}</small>
<!-- "Posted 3 minutes ago" -->
```

### Byte Size Pipe

```typescript
@Pipe({ name: 'fileSize', standalone: true })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
  }
}
```

```html
{{ 1536000 | fileSize }}         <!-- 1.46 MB -->
{{ 1024 | fileSize:0 }}          <!-- 1 KB -->
```

### Using a Custom Pipe in a Component

```typescript
import { Component } from '@angular/core';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { DatePipe, CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-article-card',
  standalone: true,
  imports: [TruncatePipe, TimeAgoPipe, DatePipe, CurrencyPipe],  // ← Import your pipes!
  template: `
    <article>
      <h2>{{ article.title }}</h2>
      <p>{{ article.body | truncate:150 }}</p>
      <time>{{ article.publishedAt | timeAgo }}</time>
    </article>
  `
})
export class ArticleCardComponent { /* ... */ }
```

---

## 7. Pipes vs Computed Signals

| Use Pipes When | Use Computed Signals When |
|---|---|
| Formatting a single value for display (date, currency, text) | Filtering/sorting arrays |
| Reusable display transformation across many templates | Combining multiple signals into one value |
| Quick, stateless transformations | The derived value is needed in TypeScript (not just template) |
| Using `AsyncPipe` for simple observable subscriptions | Complex async flows with `toSignal()` |

```typescript
// ✅ Pipe — good for formatting
{{ price | currency:'EUR' }}
{{ joinDate | date:'shortDate' }}
{{ bio | truncate:200 }}

// ✅ Computed signal — good for filtered/sorted collections
filteredProducts = computed(() =>
  this.products().filter(p => p.category === this.selectedCategory())
);
sortedByPrice = computed(() =>
  [...this.filteredProducts()].sort((a, b) => a.price - b.price)
);
```

---

## 8. Common Pitfalls

### Pitfall 1: Mutating arrays breaks pure pipes

```typescript
// ❌ Pure pipe won't re-run — array reference didn't change!
this.items.push(newItem);
// {{ items | myPipe }} → stale result!

// ✅ Create new array — pure pipe detects the reference change
this.items = [...this.items, newItem];
// {{ items | myPipe }} → fresh result!
```

### Pitfall 2: Using impure pipes for filtering

```typescript
// ❌ Runs on every change detection — will make your app sluggish!
@Pipe({ name: 'filter', pure: false })

// ✅ Use computed() for reactive filtering
filteredList = computed(() => this.list().filter(/* ... */));
```

### Pitfall 3: Forgetting to import the pipe

```typescript
// ❌ Template error: "The pipe 'truncate' could not be found"
@Component({
  standalone: true,
  imports: [],  // Missing TruncatePipe!
  template: `{{ text | truncate }}`
})

// ✅ Import it in the component
@Component({
  standalone: true,
  imports: [TruncatePipe],
  template: `{{ text | truncate }}`
})
```

### Pitfall 4: Using `JsonPipe` in production display

```html
<!-- ❌ Don't show raw JSON in production UI — format properly -->
{{ product | json }}

<!-- ✅ Only use JsonPipe for debugging -->
@if (isDevMode()) {
  <pre>{{ debugData | json }}</pre>
}
```

---

## 9. Try It Yourself

Build a `PhoneNumberPipe` that:
- Takes a string of digits like `"1234567890"`
- Returns it formatted as `"(123) 456-7890"`
- Returns the original value unchanged if it's not exactly 10 digits

<details>
<summary>✅ View Solution</summary>

```typescript
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phoneNumber',
  standalone: true
})
export class PhoneNumberPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';

    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');

    // Only format if exactly 10 digits
    if (digits.length !== 10) {
      return value; // Return original if invalid
    }

    const area = digits.slice(0, 3);
    const exchange = digits.slice(3, 6);
    const subscriber = digits.slice(6);

    return `(${area}) ${exchange}-${subscriber}`;
  }
}
```

Usage:
```html
{{ '1234567890' | phoneNumber }}   <!-- (123) 456-7890 -->
{{ '123-456-7890' | phoneNumber }} <!-- (123) 456-7890 (removes non-digits) -->
{{ '12345' | phoneNumber }}        <!-- 12345 (invalid — returned as-is) -->
```
</details>

---

## 10. Knowledge Check

1. What is the difference between a pure and an impure pipe?
2. Why is `AsyncPipe` impure, and what does it do automatically?
3. When should you use a `computed()` signal instead of a custom pipe?
4. If you update an array with `.push()` and your template uses a pure custom pipe, will the pipe re-run?

<details>
<summary>✅ View Answers</summary>

1. A **pure pipe** only re-executes when its input value changes by reference (for objects/arrays) or by value (for primitives). Angular caches the result between runs. An **impure pipe** (`pure: false`) re-executes on every single change detection cycle — every mouse move, keystroke, and timer tick. Impure pipes are a major performance hazard and should be avoided except for `AsyncPipe`.

2. `AsyncPipe` is impure because it subscribes to an Observable, and Observables can emit new values over time **without the Observable reference itself changing**. A pure pipe would only run once when the Observable is first passed to it, never updating. Being impure ensures it checks for new emissions on every cycle. Automatically: subscribes on first use, updates the template when new values arrive, and unsubscribes when the component is destroyed.

3. Use `computed()` when: (a) you're filtering or sorting a collection (pure pipes don't re-run when array items are mutated), (b) you need the derived value in TypeScript logic (not just the template), (c) the derivation depends on multiple signals, or (d) performance is critical (computed values are lazily evaluated and memoized by signal reference).

4. **No.** A pure pipe only re-runs when the input reference changes. `.push()` mutates the existing array without changing its reference. You must create a new array (`this.items = [...this.items, newItem]`) to trigger the pure pipe to re-execute.
</details>

---

*Next: [11 - Directives →](./11-directives.md)*
