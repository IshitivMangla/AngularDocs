# Angular: Zoneless Angular & Fine-Grained Reactivity

> **Goal**: Understand the shift from Zone.js monkey-patching to Zoneless Angular — why it's the biggest performance leap in Angular history, and how to write 100% zoneless-compatible code.

---

## 📋 Table of Contents
1. [What is Zone.js?](#1-what-is-zonejs)
2. [The Problems with Zone.js](#2-the-problems-with-zonejs)
3. [How Zoneless Angular Works](#3-how-zoneless-angular-works)
4. [Enabling Zoneless Mode](#4-enabling-zoneless-mode)
5. [Writing Zoneless-Compatible Code](#5-writing-zoneless-compatible-code)
6. [Signals as the Engine of Zoneless](#6-signals-as-the-engine-of-zoneless)
7. [Migrating Existing Apps to Zoneless](#7-migrating-existing-apps-to-zoneless)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Try It Yourself](#9-try-it-yourself)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. What is Zone.js?

Zone.js creates a global execution context ("zone") around your Angular app. It **monkey-patches** (overrides) all browser async APIs:
- `setTimeout`, `setInterval`, `requestAnimationFrame`
- Promises (`Promise.then`, `async/await`)
- Event listeners (`click`, `mousemove`, `keyup`, `scroll`, `fetch`)

```
Async event finishes (click, timer, HTTP response)
                     │
                     ▼
             Zone.js intercepts it
                     │
                     ▼
"Hey Angular, something happened! Run top-down change detection on the ENTIRE APP component tree!"
```

---

## 2. The Problems with Zone.js

1. **Massive Over-Rendering**: A single `mousemove` event triggers a full top-down check of every single component in the app — 60 times a second!
2. **Bundle Size**: Zone.js adds ~13KB of heavy JS polyfills to your initial download bundle.
3. **Debugging Nightmare**: Error stack traces are polluted with 50+ lines of unreadable Zone.js internal frames.
4. **Web Worker Incompatibility**: Zone.js struggles in Web Workers, Service Workers, and SSR edge runtimes.

---

## 3. How Zoneless Angular Works

With **Signals**, Angular has fine-grained reactivity. When a Signal's value changes (`.set()` or `.update()`), Angular knows **exactly which component and DOM node needs updating**.

```
Signal value changes (mySignal.set(newValue))
                     │
                     ▼
Angular knows EXACTLY which component node depends on mySignal
                     │
                     ▼
Targeted update: ONLY that specific DOM node is re-rendered! (Zero top-down tree checking!)
```

---

## 4. Enabling Zoneless Mode

```typescript
// src/app/app.config.ts (Angular 18+)
import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    // Enable Zoneless Change Detection!
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes)
  ]
};
```

### Remove Zone.js from `angular.json`

```json
// angular.json — remove zone.js from polyfills!
"polyfills": [
  // ❌ REMOVE THIS: "zone.js"
]
```

---

## 5. Writing Zoneless-Compatible Code

In a Zoneless app, **plain mutable variables do NOT update the UI when changed asynchronously**.

```typescript
// ❌ FAILS IN ZONELESS: UI will NEVER update!
export class StopwatchComponent {
  seconds = 0;

  start() {
    setInterval(() => {
      this.seconds++; // Plain variable — Angular doesn't know it changed!
    }, 1000);
  }
}

// ✅ WORKS IN ZONELESS: Signal notifies Angular automatically!
export class StopwatchComponent {
  seconds = signal(0);

  start() {
    setInterval(() => {
      this.seconds.update(s => s + 1); // Signal update notifies framework!
    }, 1000);
  }
}
```

---

## 6. Signals as the Engine of Zoneless

Every piece of state in a Zoneless application should be driven by:
- `signal()`, `computed()`, `model()`, `input()`
- Observables converted via `toSignal()`
- `ChangeDetectorRef.markForCheck()` (for legacy migration)

```typescript
// Modern Zoneless Component Pattern
@Component({
  selector: 'app-user-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <div class="spinner">Loading...</div>
    } @else if (user(); as u) {
      <h1>{{ u.name }}</h1>
      <p>{{ u.email }}</p>
    }
  `
})
export class UserProfileComponent {
  private userService = inject(UserService);

  // Observable converted directly to Signal
  user = toSignal(this.userService.getCurrentUser(), { initialValue: null });
  isLoading = computed(() => this.user() === null);
}
```

---

## 7. Migrating Existing Apps to Zoneless

```
Step 1: Set ChangeDetectionStrategy.OnPush on ALL components
Step 2: Replace @Input() / @Output() with input() / output() signals
Step 3: Convert local state to signals
Step 4: Enable provideExperimentalZonelessChangeDetection() in app.config.ts
Step 5: Remove zone.js from polyfills in angular.json
```

---

## 8. Common Pitfalls

### Pitfall 1: Mutating plain variables in async callbacks

```typescript
// ❌ UI will not update in Zoneless mode
fetch('/api/user').then(res => res.json()).then(data => {
  this.user = data; // Plain variable assignment ignored!
});

// ✅ Use signals
fetch('/api/user').then(res => res.json()).then(data => {
  this.userSignal.set(data); // Triggers DOM update!
});
```

### Pitfall 2: Using legacy 3rd-party libraries without Signals or `markForCheck()`

```typescript
// Legacy library callback
thirdPartyLib.on('update', (data) => {
  // If library doesn't use signals, notify Angular manually:
  this.cdr.markForCheck();
});
```

---

## 9. Try It Yourself

Convert this legacy Zone-dependent component to 100% Zoneless-compatible code:

```typescript
// ❌ Legacy Zone-dependent code
export class LiveClockComponent implements OnInit {
  currentTime = 'Loading...';

  ngOnInit() {
    setInterval(() => {
      this.currentTime = new Date().toLocaleTimeString();
    }, 1000);
  }
}
```

<details>
<summary>✅ View Solution</summary>

```typescript
import { Component, signal, OnInit, DestroyRef, inject } from '@angular/core';

@Component({
  selector: 'app-live-clock',
  standalone: true,
  template: `<p class="clock">{{ currentTime() }}</p>`
})
export class LiveClockComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  // ✅ Driven by Signal
  currentTime = signal(new Date().toLocaleTimeString());

  ngOnInit() {
    const timerId = setInterval(() => {
      this.currentTime.set(new Date().toLocaleTimeString());
    }, 1000);

    this.destroyRef.onDestroy(() => clearInterval(timerId));
  }
}
```
</details>

---

## 10. Knowledge Check

1. What is monkey-patching, and how did Zone.js use it?
2. Why does Zoneless mode drastically improve app performance during events like `mousemove` or `scroll`?
3. What happens when you update a plain variable inside `setTimeout()` in a Zoneless Angular app?
4. What Angular feature makes Zoneless mode possible?

<details>
<summary>✅ View Answers</summary>

1. Monkey-patching is the practice of overriding built-in browser functions at runtime. Zone.js monkey-patched all browser async APIs (`setTimeout`, `Promise`, `addEventListener`, `fetch`) so it could intercept when async work finished and trigger framework-wide change detection.

2. In Zone.js mode, every single `mousemove` or `scroll` event triggers a top-down change detection check of the **entire component tree**. In Zoneless mode, event listeners do NOT trigger tree-wide change detection — Angular only updates DOM nodes associated with Signals that actually changed value.

3. The plain variable value in memory will change, but **the UI will never update**. In Zoneless mode, Angular does not automatically scan components for plain variable changes. You must use Signals (`.set()`, `.update()`) or explicitly call `ChangeDetectorRef.markForCheck()`.

4. **Signals**. Signals provide explicit dependency tracking and notifications when values change, allowing Angular to perform pinpoint, surgical DOM updates without needing Zone.js to guess when change detection should run.
</details>

---

*Next: [24 - Angular CLI Commands →](./24-angular-cli.md)*
