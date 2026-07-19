# Angular: Lifecycle Hooks

> **Goal**: Understand the exact order Angular calls lifecycle hooks, know which hook to use for which task, and use modern alternatives like `DestroyRef` and `afterRender()`.

---

## 📋 Table of Contents
1. [The Component Lifecycle](#1-the-component-lifecycle)
2. [Hook Execution Order](#2-hook-execution-order)
3. [Core Hooks Deep Dive](#3-core-hooks-deep-dive)
4. [`ngOnChanges` — Input Change Detection](#4-ngonchanges--input-change-detection)
5. [`ngAfterViewInit` & `ngAfterViewChecked`](#5-ngafterviewinit--ngafterviewchecked)
6. [`ngAfterContentInit` & `ngAfterContentChecked`](#6-ngaftercontentinit--ngaftercontentchecked)
7. [`DestroyRef` — Modern Cleanup](#7-destroyref--modern-cleanup)
8. [`afterRender` & `afterNextRender` (Angular 17+)](#8-afterrender--afternextrender)
9. [`takeUntilDestroyed` for RxJS](#9-takeuntildestroyed-for-rxjs)
10. [Hooks with Signal Inputs](#10-hooks-with-signal-inputs)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Try It Yourself](#12-try-it-yourself)
13. [Knowledge Check](#13-knowledge-check)

---

## 1. The Component Lifecycle

Every Angular component goes through these phases:

```
Creation
  1. constructor()        — Dependencies injected
  2. ngOnChanges()        — @Input values set (before ngOnInit)
  3. ngOnInit()           — Component initialized (HTTP calls go here)

Change Detection (runs on every cycle)
  4. ngDoCheck()          — Custom dirty checking (expensive, avoid!)
  5. ngAfterContentInit() — Content projection (<ng-content>) complete (once)
  6. ngAfterContentChecked() — After content checked (every cycle)
  7. ngAfterViewInit()    — Template & child views complete (once)
  8. ngAfterViewChecked() — After view checked (every cycle)

Destruction
  9. ngOnDestroy()        — Cleanup: cancel subscriptions, clear timers
```

---

## 2. Hook Execution Order

```typescript
@Component({
  selector: 'app-lifecycle-demo',
  standalone: true,
  template: `<p>{{ data }}</p>`
})
export class LifecycleDemoComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() userId!: number;
  data = '';

  constructor() {
    // 1. FIRST hook to run.
    // Purpose: Dependency injection ONLY.
    // CANNOT: Access @Input values (they are undefined here!)
    // CANNOT: Access child view elements (ViewChild is undefined)
    console.log('1. constructor — userId is:', this.userId); // undefined!
  }

  ngOnChanges(changes: SimpleChanges) {
    // 2. Runs BEFORE ngOnInit, and AGAIN every time an @Input changes.
    // Use case: React to input changes, but prefer signal input() + effect() in modern code.
    console.log('2. ngOnChanges — userId changed to:', changes['userId']?.currentValue);
  }

  ngOnInit() {
    // 3. Runs ONCE after ngOnChanges, when all @Inputs are resolved.
    // Best place for: HTTP requests, subscriptions, business logic initialization.
    console.log('3. ngOnInit — userId is:', this.userId); // Now has the correct value!
  }

  ngAfterViewInit() {
    // 4. Runs ONCE after the template is rendered.
    // First time @ViewChild elements are available!
    console.log('4. ngAfterViewInit — DOM is ready');
  }

  ngOnDestroy() {
    // 5. Runs just before the component is removed from the DOM.
    // CRITICAL: Unsubscribe from observables, clear intervals/timeouts, detach listeners.
    console.log('5. ngOnDestroy — cleaning up!');
  }
}
```

---

## 3. Core Hooks Deep Dive

### `constructor()`

```typescript
@Component({ ... })
export class ProductComponent {
  // ✅ Use constructor ONLY for DI and simple property initialization
  private productService = inject(ProductService);
  private router = inject(Router);
  products = signal<Product[]>([]);

  // ❌ NEVER: Make HTTP requests in constructor
  // ❌ NEVER: Access @Input() values (they are undefined here)
  // ❌ NEVER: Manipulate the DOM (template not rendered yet)
}
```

### `ngOnInit()`

```typescript
@Component({ ... })
export class UserProfileComponent implements OnInit {
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);

  userId = input.required<string>();  // Available in ngOnInit!
  user = signal<User | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    // ✅ CORRECT: HTTP request in ngOnInit (userId is available)
    this.userService.getUserById(this.userId()).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (user) => {
        this.user.set(user);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.isLoading.set(false);
      }
    });
  }
}
```

### `ngOnDestroy()`

```typescript
@Component({ ... })
export class DashboardComponent implements OnDestroy {
  private wsConnection!: WebSocket;
  private resizeObserver!: ResizeObserver;

  ngOnInit() {
    this.wsConnection = new WebSocket('wss://api.example.com/live');
    this.resizeObserver = new ResizeObserver(() => { /* ... */ });
    this.resizeObserver.observe(document.body);
  }

  ngOnDestroy() {
    // ✅ Always clean up non-Angular resources!
    this.wsConnection.close();
    this.resizeObserver.disconnect();
    console.log('DashboardComponent destroyed — resources released');
  }
}
```

---

## 4. `ngOnChanges` — Input Change Detection

`ngOnChanges` provides a `SimpleChanges` object with previous and current values for each changed `@Input()`.

```typescript
import { Component, Input, OnChanges, SimpleChanges, signal, computed } from '@angular/core';

@Component({ ... })
export class UserAvatarComponent implements OnChanges {
  @Input({ required: true }) userId!: string;

  user = signal<User | null>(null);
  isLoading = signal(false);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['userId']) {
      const change = changes['userId'];
      console.log(`userId changed from ${change.previousValue} to ${change.currentValue}`);
      console.log('Is first change?', change.firstChange);

      // Fetch data when userId changes (including first time)
      this.fetchUser(change.currentValue);
    }
  }

  private fetchUser(id: string) {
    this.isLoading.set(true);
    // ... HTTP call
  }
}
```

> **Modern Alternative**: If using Signal `input()`, use `effect()` instead of `ngOnChanges`:
>
> ```typescript
> export class UserAvatarComponent {
>   userId = input.required<string>();
>
>   constructor() {
>     effect(() => {
>       // Automatically runs when userId changes — much cleaner!
>       this.fetchUser(this.userId());
>     });
>   }
> }
> ```

---

## 5. `ngAfterViewInit` & `ngAfterViewChecked`

`@ViewChild` elements are `undefined` until `ngAfterViewInit`.

```typescript
import { Component, ViewChild, ElementRef, AfterViewInit, signal } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <canvas #myCanvas></canvas>
    <div #scrollContainer class="list">
      <!-- list items -->
    </div>
  `
})
export class CanvasComponent implements AfterViewInit {
  @ViewChild('myCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

  ngOnInit() {
    // ❌ Too early! canvas is undefined here.
    // console.log(this.canvas.nativeElement);  // TypeError!
  }

  ngAfterViewInit() {
    // ✅ The template is now rendered — @ViewChild elements are available!
    const ctx = this.canvas.nativeElement.getContext('2d');
    ctx?.fillRect(0, 0, 100, 100);

    // Programmatically scroll to bottom
    const el = this.scrollContainer.nativeElement;
    el.scrollTop = el.scrollHeight;
  }
}
```

### `ngAfterViewChecked` — Use with Caution

Runs after **every change detection cycle**. Avoid putting heavy logic here.

```typescript
ngAfterViewChecked() {
  // ❌ Heavy computation here runs thousands of times!
  // ✅ Only use for lightweight checks that can't go elsewhere
  // Tip: Use computed() or signals instead of ngAfterViewChecked
}
```

---

## 6. `ngAfterContentInit` & `ngAfterContentChecked`

These run after `<ng-content>` (projected content) is rendered. See notes/12-content-projection.md for more.

```typescript
import { Component, ContentChild, AfterContentInit } from '@angular/core';
import { CardBodyComponent } from './card-body.component';

@Component({
  selector: 'app-card',
  template: `
    <div class="card">
      <ng-content select="[card-header]"></ng-content>
      <ng-content select="[card-body]"></ng-content>
    </div>
  `
})
export class CardComponent implements AfterContentInit {
  @ContentChild(CardBodyComponent) body!: CardBodyComponent;

  ngAfterContentInit() {
    // Projected content (CardBodyComponent) is now initialized!
    console.log('Card body content available:', this.body);
  }
}
```

---

## 7. `DestroyRef` — Modern Cleanup

`DestroyRef` is the modern alternative to implementing `ngOnDestroy`. It lets you register cleanup callbacks from anywhere in the class, including utility functions.

```typescript
import { Component, inject, OnInit, DestroyRef } from '@angular/core';

@Component({ ... })
export class NotificationsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // Timer cleanup
    const timerId = setInterval(() => this.checkNotifications(), 30_000);
    this.destroyRef.onDestroy(() => clearInterval(timerId));

    // WebSocket cleanup
    const ws = new WebSocket('wss://api.example.com/notifications');
    ws.onmessage = (event) => this.handleNotification(event.data);
    this.destroyRef.onDestroy(() => ws.close());

    // Remove event listeners
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', handler);
    this.destroyRef.onDestroy(() => document.removeEventListener('keydown', handler));
  }

  private checkNotifications() { /* ... */ }
  private handleNotification(data: any) { /* ... */ }
  private close() { /* ... */ }
}
```

### Why `DestroyRef` over `ngOnDestroy`?

```typescript
// ❌ Old way: ngOnDestroy — cleanup scattered from init code
export class OldComponent implements OnInit, OnDestroy {
  private timerId!: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.timerId = setInterval(() => { /* ... */ }, 5000);
    // → You have to scroll far down to find where it's cleaned up!
  }

  ngOnDestroy() {
    clearInterval(this.timerId);
    // → Setup and teardown are separated
  }
}

// ✅ New way: DestroyRef — setup and cleanup are co-located!
export class NewComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    const timerId = setInterval(() => { /* ... */ }, 5000);
    this.destroyRef.onDestroy(() => clearInterval(timerId));
    // → Cleanup is right next to the setup — much easier to maintain!
  }
}
```

---

## 8. `afterRender` & `afterNextRender` (Angular 17+)

These run after Angular has written to the DOM — equivalent to `ngAfterViewInit` but more precise and work in Zoneless apps.

```typescript
import { Component, afterRender, afterNextRender, ElementRef, inject } from '@angular/core';
import * as Chart from 'chart.js';

@Component({
  selector: 'app-analytics-chart',
  standalone: true,
  template: `<canvas #chart></canvas>`
})
export class AnalyticsChartComponent {
  private el = inject(ElementRef);

  constructor() {
    // afterNextRender: Runs once after the FIRST render
    // Use for: Third-party library initialization, chart creation, one-time DOM setup
    afterNextRender(() => {
      const canvas = this.el.nativeElement.querySelector('canvas');
      new Chart.Chart(canvas, { type: 'bar', data: { /* ... */ } });
    });

    // afterRender: Runs after EVERY render cycle
    // Use for: Keeping a third-party library in sync with Angular state
    afterRender(() => {
      // Update chart when data changes
    });
  }
}
```

---

## 9. `takeUntilDestroyed` for RxJS

The cleanest way to auto-unsubscribe from RxJS observables:

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

@Component({ ... })
export class PollComponent implements OnInit {
  // Note: takeUntilDestroyed() must be called in an injection context!
  // Assign the operator at property level or use destroyRef explicitly.
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // ✅ Auto-unsubscribes when component is destroyed
    interval(5000).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.refreshData());
  }

  private refreshData() { /* ... */ }
}

// Even cleaner — use at property initialization
@Component({ ... })
export class ModernPollComponent {
  // This works because it's in an injection context at property init time!
  private data$ = interval(5000).pipe(takeUntilDestroyed());

  ngOnInit() {
    this.data$.subscribe(() => this.refreshData());
  }
}
```

---

## 10. Hooks with Signal Inputs

When using Signal `input()`, most `ngOnChanges` usage is replaced by `effect()` and `computed()`:

```typescript
import { Component, input, effect, computed, signal, inject } from '@angular/core';
import { UserService } from '../user.service';

@Component({
  selector: 'app-user-posts',
  standalone: true,
  template: `
    <h2>Posts by {{ username() }}</h2>
    @for (post of posts(); track post.id) {
      <article>{{ post.title }}</article>
    }
  `
})
export class UserPostsComponent {
  private userService = inject(UserService);

  // Signal input — reactive out of the box
  userId = input.required<string>();
  username = input<string>('Unknown');

  posts = signal<Post[]>([]);

  constructor() {
    // Instead of ngOnChanges — automatically re-runs when userId changes
    effect(() => {
      const id = this.userId(); // Track dependency
      this.userService.getPostsByUser(id).subscribe(posts => this.posts.set(posts));
    });
  }

  // Derived data — instead of writing in ngOnChanges
  displayName = computed(() => `@${this.username().toLowerCase()}`);
}
```

---

## 11. Common Pitfalls

### Pitfall 1: Fetching data in the constructor

```typescript
// ❌ @Input values are undefined in constructor!
constructor(private userService: UserService) {
  this.userService.getUser(this.userId).subscribe(); // this.userId is undefined!
}

// ✅ Fetch in ngOnInit where inputs are available
ngOnInit() {
  this.userService.getUser(this.userId).subscribe();
}
```

### Pitfall 2: Memory leak — not unsubscribing

```typescript
// ❌ Subscription lives forever — memory leak!
ngOnInit() {
  this.router.events.subscribe(event => { /* ... */ });
}

// ✅ Always use takeUntilDestroyed or DestroyRef
ngOnInit() {
  this.router.events.pipe(
    takeUntilDestroyed(this.destroyRef)
  ).subscribe(event => { /* ... */ });
}
```

### Pitfall 3: Heavy logic in `ngDoCheck` or `ngAfterViewChecked`

```typescript
// ❌ Runs on EVERY single change detection — will cause major performance issues!
ngDoCheck() {
  this.filteredItems = this.items.filter(i => i.name.includes(this.search));
}

// ✅ Use computed() — only recalculates when dependencies change
filteredItems = computed(() => this.items().filter(i => i.name.includes(this.search())));
```

### Pitfall 4: Accessing `@ViewChild` in `ngOnInit`

```typescript
@ViewChild('myInput') myInput!: ElementRef;

ngOnInit() {
  // ❌ Template not rendered yet — myInput is undefined!
  this.myInput.nativeElement.focus();
}

ngAfterViewInit() {
  // ✅ Template is now rendered
  this.myInput.nativeElement.focus();
}
```

---

## 12. Try It Yourself

You are building an `AutoSaveComponent` that:
1. Has a `content = signal('')` for the text
2. Auto-saves every 5 seconds using `setInterval`
3. Also subscribes to a `websocketService.updates$` Observable
4. Properly cleans up the interval AND the subscription when destroyed

**Starter:**
```typescript
export class AutoSaveComponent implements OnInit {
  content = signal('');
  // TODO: Set up auto-save interval
  // TODO: Subscribe to websocket
  // TODO: Clean up both when destroyed
}
```

<details>
<summary>✅ View Solution</summary>

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsocketService } from './websocket.service';
import { DocumentService } from './document.service';

@Component({
  selector: 'app-auto-save',
  standalone: true,
  template: `
    <textarea [(ngModel)]="content" placeholder="Start writing..."></textarea>
    <p class="status">{{ status() }}</p>
  `
})
export class AutoSaveComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private documentService = inject(DocumentService);
  private wsService = inject(WebsocketService);

  content = signal('');
  status = signal('All changes saved');

  ngOnInit() {
    // ✅ Auto-save interval — registered with DestroyRef for clean co-location
    const autoSaveId = setInterval(() => {
      this.documentService.save(this.content()).subscribe(() => {
        this.status.set(`Saved at ${new Date().toLocaleTimeString()}`);
      });
    }, 5000);
    this.destroyRef.onDestroy(() => clearInterval(autoSaveId));

    // ✅ Websocket subscription — auto-unsubscribed via takeUntilDestroyed
    this.wsService.updates$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(update => {
      this.content.set(update.content);
      this.status.set('Updated from remote');
    });
  }
}
```
</details>

---

## 13. Knowledge Check

1. In which lifecycle hook are `@ViewChild` elements first available?
2. Why should you never make HTTP calls in the `constructor()`?
3. What is the difference between `afterNextRender()` and `afterRender()`?
4. How does `takeUntilDestroyed()` work, and why is it preferred over manual `unsubscribe()`?
5. Why is `ngOnChanges` rarely needed in modern Angular code?

<details>
<summary>✅ View Answers</summary>

1. `ngAfterViewInit()`. Before this hook runs, the component's template has not been rendered yet, so any `@ViewChild` reference will be `undefined`.

2. In the `constructor()`, Angular has just injected dependencies but has NOT yet resolved `@Input()` values — they will all be `undefined` or default values. Making an HTTP call that depends on an input (like `userId`) would send a request with `undefined` as the parameter, which is incorrect. Always use `ngOnInit()` for initialization that requires inputs.

3. `afterNextRender()` runs exactly **once** after the first successful render — ideal for one-time DOM setup like initializing a third-party chart library. `afterRender()` runs after **every** render cycle — use it when you need to keep a third-party library synchronized with Angular's state changes.

4. `takeUntilDestroyed()` is an RxJS operator that internally uses `DestroyRef` to automatically call `unsubscribe()` when the component/service is destroyed. It's preferred over manual unsubscription because: (a) you can't forget to call it, (b) setup and cleanup are co-located in the same pipe, (c) it handles edge cases like errors in the stream.

5. With Signal `input()`, input values are reactive signals. You can use `effect(() => { const id = this.userId(); ... })` to react to input changes, which is much cleaner and more idiomatic than implementing `ngOnChanges` with `SimpleChanges`. `ngOnChanges` is still used with the legacy `@Input()` decorator.
</details>

---

*Next: [10 - Pipes →](./10-pipes.md)*
