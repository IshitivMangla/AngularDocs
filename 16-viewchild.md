# Angular: ViewChild & ViewChildren

> **Goal**: Master DOM querying in Angular — from traditional `@ViewChild` decorators to modern Signal-based `viewChild()` and `viewChildren()` queries.

---

## 📋 Table of Contents
1. [View Queries Mental Model](#1-view-queries-mental-model)
2. [Decorator vs Signal Queries](#2-decorator-vs-signal-queries)
3. [Single Queries: `viewChild()`](#3-single-queries-viewchild)
4. [Multiple Queries: `viewChildren()`](#4-multiple-queries-viewchildren)
5. [Querying Elements, Components, and Directives](#5-querying-elements-components-and-directives)
6. [The `read` Option](#6-the-read-option)
7. [`{ static: true }` vs `{ static: false }`](#7-static-true-vs-static-false)
8. [`TemplateRef` and `ViewContainerRef`](#8-templateref-and-viewcontainerref)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Try It Yourself](#10-try-it-yourself)
11. [Knowledge Check](#11-knowledge-check)

---

## 1. View Queries Mental Model

View queries allow a parent component to obtain direct references to elements, child components, or directives located **inside its own template**.

```
Component Template:
<input #usernameInput>                        ← ElementRef
<app-custom-card #card></app-custom-card>     ← Child Component Instance
<div appHighlight></div>                     ← Directive Instance
```

### Rule of Thumb
- Use **data binding / signals** for 90% of UI interactions.
- Use **view queries** ONLY when you need to call native DOM APIs (focus, scroll, canvas), call child component public methods, or integrate 3rd-party non-Angular libraries.

---

## 2. Decorator vs Signal Queries

| Feature | Legacy `@ViewChild` | Modern `viewChild()` (Angular 17.2+) |
|---|---|---|
| Return type | Raw value / `undefined` | Read-only `Signal` |
| Availability | `ngAfterViewInit` | Reactive signal (works in `effect()`) |
| Null safety | Needs `!`, `?`, or optional chaining | `Signal<T \| undefined>` or `required()` |
| Boilerplate | High | Low |

---

## 3. Single Queries: `viewChild()`

### Basic Syntax

```typescript
import { Component, viewChild, ElementRef, effect } from '@angular/core';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  template: `
    <input #searchInput placeholder="Type to search...">
    <button (click)="clearInput()">Clear</button>
  `
})
export class SearchBarComponent {
  // Signal query — returns Signal<ElementRef<HTMLInputElement> | undefined>
  searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  // Required signal query — throws if element isn't in template
  requiredInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    // React when the view child becomes available in the DOM
    effect(() => {
      const inputEl = this.searchInput()?.nativeElement;
      if (inputEl) {
        inputEl.focus();
      }
    });
  }

  clearInput() {
    const el = this.searchInput()?.nativeElement;
    if (el) {
      el.value = '';
      el.focus();
    }
  }
}
```

---

## 4. Multiple Queries: `viewChildren()`

When you need to reference multiple matching elements in a loop or template.

```typescript
import { Component, viewChildren, ElementRef, effect } from '@angular/core';

@Component({
  selector: 'app-step-wizard',
  standalone: true,
  template: `
    @for (step of steps; track step.id; let i = $index) {
      <div #stepCard class="step-card">
        <h3>Step {{ i + 1 }}: {{ step.title }}</h3>
      </div>
    }
    <button (click)="scrollToStep(2)">Go to Step 3</button>
  `
})
export class StepWizardComponent {
  steps = [
    { id: 1, title: 'Personal Info' },
    { id: 2, title: 'Shipping Address' },
    { id: 3, title: 'Payment Method' }
  ];

  // Returns Signal<readonly ElementRef<HTMLDivElement>[]>
  stepCards = viewChildren<ElementRef<HTMLDivElement>>('stepCard');

  constructor() {
    effect(() => {
      console.log(`Found ${this.stepCards().length} step cards rendered in DOM`);
    });
  }

  scrollToStep(index: number) {
    const cards = this.stepCards();
    if (cards[index]) {
      cards[index].nativeElement.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
```

---

## 5. Querying Elements, Components, and Directives

### 1. Querying a Child Component

```typescript
// Child component
@Component({
  selector: 'app-audio-player',
  standalone: true,
  template: `<audio #audioEl [src]="src()"></audio>`
})
export class AudioPlayerComponent {
  src = input.required<string>();

  play() { /* ... */ }
  pause() { /* ... */ }
  seek(seconds: number) { /* ... */ }
}
```

```typescript
// Parent component calling child methods
@Component({
  selector: 'app-music-page',
  standalone: true,
  imports: [AudioPlayerComponent],
  template: `
    <app-audio-player #player src="/assets/song.mp3"></app-audio-player>
    <button (click)="playSong()">Play</button>
  `
})
export class MusicPageComponent {
  // Query child component by its class type
  player = viewChild(AudioPlayerComponent);

  // Or query by template reference variable
  playerRef = viewChild<AudioPlayerComponent>('player');

  playSong() {
    this.player()?.play();
  }
}
```

### 2. Querying a Directive

```typescript
@Component({
  selector: 'app-form-page',
  standalone: true,
  imports: [TooltipDirective],
  template: `
    <button appTooltip="Click to submit">Submit</button>
  `
})
export class FormPageComponent {
  // Query by directive type
  tooltip = viewChild(TooltipDirective);
}
```

---

## 6. The `read` Option

Sometimes an element has multiple things attached to it (DOM element, component, directives). Use `read` to specify what to retrieve.

```html
<app-custom-input #myInput appHighlight appTooltip="Help text"></app-custom-input>
```

```typescript
// Default: reads CustomInputComponent instance
inputComp = viewChild('myInput');

// Read the raw DOM ElementRef
inputEl = viewChild('myInput', { read: ElementRef });

// Read the Directive instance attached to the element
tooltip = viewChild('myInput', { read: TooltipDirective });
highlight = viewChild('myInput', { read: HighlightDirective });

// Read ViewContainerRef (for dynamic component insertion)
container = viewChild('myInput', { read: ViewContainerRef });
```

---

## 7. `{ static: true }` vs `{ static: false }`

*Applies to decorator queries (`@ViewChild`). Signal queries handle this automatically!*

```typescript
// static: true — Query resolved BEFORE ngOnInit
// ONLY works if element is NOT inside @if, @for, or <ng-template>
@ViewChild('staticInput', { static: true }) staticInput!: ElementRef;

// static: false (DEFAULT) — Query resolved AFTER ngAfterViewInit
// Works for elements inside @if, @for, etc.
@ViewChild('dynamicInput', { static: false }) dynamicInput?: ElementRef;
```

> **With Signal `viewChild()`**: You don't need `static` options anymore. Signal queries update reactively whenever the element is created or destroyed in the DOM.

---

## 8. `TemplateRef` and `ViewContainerRef`

Used for dynamic template rendering and custom structural directives.

```typescript
@Component({
  selector: 'app-modal-wrapper',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #defaultHeader>
      <h2>Default Title</h2>
    </ng-template>

    <div class="modal">
      <ng-container *ngTemplateOutlet="customHeader() ?? defaultHeaderRef()"></ng-container>
    </div>
  `
})
export class ModalWrapperComponent {
  defaultHeaderRef = viewChild.required<TemplateRef<any>>('defaultHeader');
  customHeader = input<TemplateRef<any>>();
}
```

---

## 9. Common Pitfalls

### Pitfall 1: Accessing `@ViewChild` in `ngOnInit`

```typescript
// ❌ Undefined in ngOnInit with static: false (default)!
@ViewChild('input') input!: ElementRef;
ngOnInit() {
  this.input.nativeElement.focus(); // TypeError: Cannot read property of undefined
}

// ✅ Use Signal viewChild() + effect() instead!
input = viewChild<ElementRef>('input');
constructor() {
  effect(() => this.input()?.nativeElement.focus());
}
```

### Pitfall 2: Element inside `@if` returned `undefined`

```typescript
// Element is hidden initially
showForm = signal(false);

// Query returns undefined until showForm becomes true!
formEl = viewChild<ElementRef>('form');

openForm() {
  this.showForm.set(true);
  // ❌ Immediate access after set() is still undefined — DOM hasn't updated yet!
  this.formEl()?.nativeElement.focus();

  // ✅ Use effect() or queueMicrotask / setTimeout
}
```

### Pitfall 3: Direct DOM manipulation breaking SSR

```typescript
// ❌ Crashes Node.js server during SSR!
this.canvas().nativeElement.getContext('2d');

// ✅ Wrap in browser check or afterNextRender()
constructor() {
  afterNextRender(() => {
    const ctx = this.canvas()?.nativeElement.getContext('2d');
  });
}
```

---

## 10. Try It Yourself

Build an `ImageGalleryComponent` that:
1. Has 5 thumbnail images in a `@for` loop
2. Uses `viewChildren()` to query all thumbnail elements
3. Has a `scrollToThumbnail(index)` method that scrolls the chosen thumbnail into view with `scrollIntoView({ behavior: 'smooth' })`

<details>
<summary>✅ View Solution</summary>

```typescript
import { Component, viewChildren, ElementRef } from '@angular/core';

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  template: `
    <div class="thumbnails-track">
      @for (img of images; track img.id; let i = $index) {
        <img
          #thumb
          [src]="img.url"
          [alt]="img.title"
          (click)="scrollToThumbnail(i)"
          class="thumb"
        >
      }
    </div>
  `
})
export class ImageGalleryComponent {
  images = [
    { id: 1, url: '/img1.jpg', title: 'Image 1' },
    { id: 2, url: '/img2.jpg', title: 'Image 2' },
    { id: 3, url: '/img3.jpg', title: 'Image 3' },
    { id: 4, url: '/img4.jpg', title: 'Image 4' },
    { id: 5, url: '/img5.jpg', title: 'Image 5' }
  ];

  thumbnails = viewChildren<ElementRef<HTMLImageElement>>('thumb');

  scrollToThumbnail(index: number) {
    const thumbs = this.thumbnails();
    if (thumbs[index]) {
      thumbs[index].nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }
}
```
</details>

---

## 11. Knowledge Check

1. What is the difference between `@ViewChild` and `viewChild()`?
2. When would you use the `{ read: ... }` option in a view query?
3. Can a view query access an element inside a child component's template?
4. Why is `effect()` preferred over `ngAfterViewInit` when working with `viewChild()` signals?

<details>
<summary>✅ View Answers</summary>

1. `@ViewChild` is a legacy decorator that returns a raw value or `undefined`, available starting at `ngAfterViewInit`. `viewChild()` is a modern signal query introduced in Angular 17.2+ that returns a read-only `Signal`. Signal queries update reactively whenever the template structure changes (e.g. elements toggled by `@if`).

2. Use `{ read: ... }` when an element has multiple features attached (such as a component, host directives, and `ElementRef`) and you want to read something other than the default. For example, `{ read: ElementRef }` retrieves the DOM reference of a component element, while `{ read: ViewContainerRef }` retrieves the container for dynamic rendering.

3. **No.** View queries only query within the component's **own template**. They cannot cross component encapsulation boundaries into a child component's template. However, you CAN query the child component class instance itself and call public methods on it.

4. `effect()` automatically tracks signal dependencies and re-executes whenever the `viewChild()` signal updates (e.g. when an element appears inside an `@if` block later in the component lifecycle). `ngAfterViewInit` only runs once on initial component rendering, so it misses elements that appear conditionally later.
</details>

---

*Next: [17 - ContentChild & ContentChildren →](./17-contentchild.md)*
