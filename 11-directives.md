# Angular: Directives — Attribute & Custom

> **Goal**: Understand Angular's directive system, build powerful custom attribute directives, and know when to use them vs. components for reusable DOM behaviors.

---

## 📋 Table of Contents
1. [Directive Types](#1-directive-types)
2. [Built-in Attribute Directives](#2-built-in-attribute-directives)
3. [Building a Custom Attribute Directive](#3-building-a-custom-attribute-directive)
4. [Host Bindings and Host Listeners](#4-host-bindings-and-host-listeners)
5. [Directive Inputs — Making Directives Configurable](#5-directive-inputs)
6. [Directive Composition API (Angular 15+)](#6-directive-composition-api)
7. [When to Use a Directive vs a Component](#7-directive-vs-component)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Try It Yourself](#9-try-it-yourself)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. Directive Types

| Type | Description | Example |
|---|---|---|
| **Component** | A directive with its own template | `@Component({ template: '...' })` |
| **Attribute Directive** | Changes appearance or behavior of an existing element | `[ngClass]`, `[tooltip]` |
| **Structural Directive** | Adds/removes DOM elements | `*ngIf`, `*ngFor` (replaced by `@if`, `@for`) |

In modern Angular, structural directives are largely replaced by the built-in `@if`, `@for`, `@switch` control flow. You'll mostly build **attribute directives**.

---

## 2. Built-in Attribute Directives

### `[ngClass]` — Dynamic Class Binding

```typescript
// In component — import NgClass specifically for tree-shaking
imports: [NgClass]
```

```html
<!-- Object syntax — key is class name, value is boolean condition -->
<div [ngClass]="{
  'text-red-500': hasError(),
  'text-green-500': isSuccess(),
  'opacity-50': isDisabled()
}">
  Status message
</div>

<!-- Array syntax — apply multiple conditional classes -->
<button [ngClass]="[
  isPrimary() ? 'btn-primary' : 'btn-secondary',
  isLarge() ? 'btn-lg' : 'btn-sm'
]">
  Click me
</button>

<!-- String syntax -->
<div [ngClass]="currentStatusClass()">Dynamic class</div>
```

### `[ngStyle]` — Dynamic Inline Styles

```html
<div [ngStyle]="{
  'background-color': product().color,
  'font-size.px': fontSize(),         <!-- .px suffix converts number to px -->
  'opacity': isAvailable() ? '1' : '0.5',
  'transform': 'rotate(' + rotation() + 'deg)'
}">
  Styled element
</div>
```

> **Tip**: Prefer CSS class bindings over `ngStyle` when possible. CSS classes are more maintainable and allow the browser to optimize rendering.

---

## 3. Building a Custom Attribute Directive

### Example: Click Outside Directive

```typescript
// src/app/shared/directives/click-outside.directive.ts
import {
  Directive,
  ElementRef,
  output,
  inject,
  OnInit,
  OnDestroy
} from '@angular/core';

@Directive({
  selector: '[appClickOutside]',
  standalone: true
})
export class ClickOutsideDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);

  // Modern output() — emits when click is detected OUTSIDE this element
  clickOutside = output<void>();

  private handler = (event: MouseEvent) => {
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.clickOutside.emit();
    }
  };

  ngOnInit() {
    // Add listener to the document, not the element itself!
    document.addEventListener('click', this.handler, true);
  }

  ngOnDestroy() {
    // Critical: Always remove the listener to prevent memory leaks!
    document.removeEventListener('click', this.handler, true);
  }
}
```

```html
<!-- Usage: Close dropdown when user clicks anywhere outside it -->
<div class="dropdown" [class.open]="isOpen()" appClickOutside (clickOutside)="isOpen.set(false)">
  <button (click)="isOpen.set(!isOpen())">Menu ▼</button>
  <ul class="dropdown-menu">
    <li>Item 1</li>
    <li>Item 2</li>
  </ul>
</div>
```

### Example: Intersection Observer Directive (Lazy Loading Images)

```typescript
// src/app/shared/directives/lazy-load.directive.ts
import { Directive, ElementRef, output, inject, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appLazyLoad]',
  standalone: true
})
export class LazyLoadDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);

  // Emits when the element enters the viewport
  visible = output<void>();

  private observer!: IntersectionObserver;

  ngOnInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.visible.emit();
            this.observer.disconnect(); // Only fire once!
          }
        });
      },
      { threshold: 0.1 }  // Trigger when 10% is visible
    );

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer.disconnect();
  }
}
```

```html
<!-- Image loads only when it scrolls into view -->
<img
  [src]="isLoaded() ? product.imageUrl : placeholder"
  appLazyLoad
  (visible)="isLoaded.set(true)"
  [alt]="product.name"
>
```

---

## 4. Host Bindings and Host Listeners

`@HostListener` and `@HostBinding` let a directive react to events and modify properties on the element it's attached to.

### Using `@HostListener` and `@HostBinding`

```typescript
// src/app/shared/directives/ripple.directive.ts
import { Directive, ElementRef, HostListener, HostBinding, inject, input } from '@angular/core';

@Directive({
  selector: '[appRipple]',
  standalone: true
})
export class RippleDirective {
  private el = inject(ElementRef);

  // @HostBinding binds a directive property to the host element's property
  @HostBinding('class.ripple-host') isRippleHost = true;
  @HostBinding('style.position') position = 'relative';
  @HostBinding('style.overflow') overflow = 'hidden';

  // @HostListener listens to events on the host element
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    this.createRipple(event);
  }

  private createRipple(event: MouseEvent) {
    const el = this.el.nativeElement as HTMLElement;
    const circle = document.createElement('span');
    const diameter = Math.max(el.clientWidth, el.clientHeight);
    const radius = diameter / 2;
    const rect = el.getBoundingClientRect();

    Object.assign(circle.style, {
      width: `${diameter}px`,
      height: `${diameter}px`,
      left: `${event.clientX - rect.left - radius}px`,
      top: `${event.clientY - rect.top - radius}px`,
      position: 'absolute',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.4)',
      transform: 'scale(0)',
      animation: 'ripple 600ms linear',
      pointerEvents: 'none'
    });

    el.appendChild(circle);
    circle.addEventListener('animationend', () => circle.remove());
  }
}
```

### Using `host` Property in Decorator (Modern Approach)

```typescript
@Directive({
  selector: '[appHighlight]',
  standalone: true,
  host: {
    // Static class/style bindings
    'class': 'highlighted-element',
    '[class.active]': 'isActive()',

    // Event listeners
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',

    // Attribute bindings
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.tabindex]': '0',
  }
})
export class HighlightDirective {
  isActive = signal(false);
  ariaLabel = signal('Highlighted element');

  onMouseEnter() { this.isActive.set(true); }
  onMouseLeave() { this.isActive.set(false); }
}
```

---

## 5. Directive Inputs — Making Directives Configurable

Directives can accept `input()` values to customize their behavior.

```typescript
// src/app/shared/directives/tooltip.directive.ts
import { Directive, input, ElementRef, inject, signal, OnInit, OnDestroy, HostListener } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
  host: {
    '[attr.title]': 'null',  // Remove native tooltip so our custom one shows
    '[attr.aria-describedby]': 'tooltipId()',
  }
})
export class TooltipDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);

  // Input signals for configuration
  appTooltip = input<string>('');          // Used when directive selector IS the input
  position = input<'top' | 'bottom' | 'left' | 'right'>('top');
  delay = input<number>(300);

  tooltipId = signal(`tooltip-${Math.random().toString(36).slice(2)}`);

  private tooltipEl?: HTMLElement;
  private showTimer?: ReturnType<typeof setTimeout>;

  @HostListener('mouseenter')
  onMouseEnter() {
    this.showTimer = setTimeout(() => this.showTooltip(), this.delay());
  }

  @HostListener('mouseleave')
  @HostListener('blur')
  onMouseLeave() {
    clearTimeout(this.showTimer);
    this.hideTooltip();
  }

  private showTooltip() {
    if (!this.appTooltip()) return;

    const tooltip = document.createElement('div');
    tooltip.id = this.tooltipId();
    tooltip.textContent = this.appTooltip();
    tooltip.setAttribute('role', 'tooltip');
    Object.assign(tooltip.style, {
      position: 'fixed',
      background: '#333',
      color: '#fff',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: '9999',
      pointerEvents: 'none',
    });

    document.body.appendChild(tooltip);
    this.tooltipEl = tooltip;
    this.positionTooltip(tooltip);
  }

  private positionTooltip(tooltip: HTMLElement) {
    const rect = this.el.nativeElement.getBoundingClientRect();
    const tRect = tooltip.getBoundingClientRect();

    const positions: Record<string, { top: number; left: number }> = {
      top:    { top: rect.top - tRect.height - 8, left: rect.left + (rect.width - tRect.width) / 2 },
      bottom: { top: rect.bottom + 8, left: rect.left + (rect.width - tRect.width) / 2 },
      left:   { top: rect.top + (rect.height - tRect.height) / 2, left: rect.left - tRect.width - 8 },
      right:  { top: rect.top + (rect.height - tRect.height) / 2, left: rect.right + 8 },
    };

    const pos = positions[this.position()];
    tooltip.style.top = `${pos.top}px`;
    tooltip.style.left = `${pos.left}px`;
  }

  private hideTooltip() {
    this.tooltipEl?.remove();
    this.tooltipEl = undefined;
  }

  ngOnDestroy() {
    clearTimeout(this.showTimer);
    this.hideTooltip();
  }
}
```

```html
<!-- Usage -->
<button appTooltip="Save your changes" position="top">Save</button>
<button appTooltip="This action cannot be undone!" position="bottom" [delay]="500">Delete</button>
```

---

## 6. Directive Composition API

Angular 15 introduced the ability to **compose multiple directives** onto a single component using `hostDirectives`.

```typescript
// Compose existing directives onto a component
@Component({
  selector: 'app-button',
  standalone: true,
  hostDirectives: [
    RippleDirective,        // Apply ripple effect to all app-buttons!
    { directive: TooltipDirective, inputs: ['appTooltip'], outputs: [] }
  ],
  template: `<ng-content></ng-content>`
})
export class ButtonComponent { }
```

```html
<!-- The button automatically gets ripple AND tooltip! -->
<app-button appTooltip="Create new item">+ New Item</app-button>
```

---

## 7. Directive vs Component

| Scenario | Use a... |
|---|---|
| Add behavior to existing HTML element | Directive |
| Reuse the same behavior across many element types | Directive |
| Need a template (HTML structure) | Component |
| Encapsulate a UI pattern with its own logic | Component |
| Apply styling logic (classes, styles) | Directive |
| Show loading state, skeleton UI | Component |

```typescript
// ✅ Directive: adds copy-to-clipboard behavior to ANY element
@Directive({ selector: '[appCopyToClipboard]' })
export class CopyToClipboardDirective { /* ... */ }

// ✅ Component: renders a complete copy-button widget with its own HTML
@Component({ selector: 'app-copy-button', template: '<button>📋 Copy</button>' })
export class CopyButtonComponent { /* ... */ }
```

---

## 8. Common Pitfalls

### Pitfall 1: Manipulating DOM directly without Renderer2

```typescript
// ❌ Direct DOM manipulation — breaks SSR!
this.el.nativeElement.style.color = 'red';

// ✅ Use Renderer2 — works in SSR and web workers
import { Renderer2 } from '@angular/core';
private renderer = inject(Renderer2);
this.renderer.setStyle(this.el.nativeElement, 'color', 'red');
this.renderer.addClass(this.el.nativeElement, 'active');
this.renderer.setAttribute(this.el.nativeElement, 'aria-expanded', 'true');
```

### Pitfall 2: Memory leaks — not removing event listeners

```typescript
// ❌ Native event listener never removed!
ngOnInit() {
  document.addEventListener('scroll', this.onScroll);
}
// Component destroys → listener still lives in memory!

// ✅ Always remove in ngOnDestroy (or use DestroyRef)
ngOnInit() {
  document.addEventListener('scroll', this.onScroll);
  this.destroyRef.onDestroy(() => document.removeEventListener('scroll', this.onScroll));
}
```

### Pitfall 3: Not importing the directive in standalone components

```html
<!-- ❌ Template error: "Can't bind to 'appTooltip' since it isn't a known property" -->
```

```typescript
// ✅ Import it in the component that uses it
@Component({
  imports: [TooltipDirective, RippleDirective],
  template: `<button appTooltip="Hello" appRipple>Click</button>`
})
```

---

## 9. Try It Yourself

Build an `AutoFocusDirective` that:
1. Automatically focuses the element it's applied to after the view renders
2. Accepts an optional `delay` input (default: 0ms) before focusing
3. Works properly with server-side rendering (only focuses in the browser)

<details>
<summary>✅ View Solution</summary>

```typescript
import { Directive, inject, input, OnInit, PLATFORM_ID, ElementRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appAutoFocus]',
  standalone: true
})
export class AutoFocusDirective implements OnInit {
  private el = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);

  delay = input<number>(0);

  ngOnInit() {
    // Only focus in the browser — not during SSR!
    if (!isPlatformBrowser(this.platformId)) return;

    // AfterViewInit equivalent — use setTimeout(0) to defer after render
    setTimeout(() => {
      this.el.nativeElement.focus();
    }, this.delay());
  }
}
```

Usage:
```html
<!-- Auto-focus when dialog opens -->
<input appAutoFocus placeholder="Search...">

<!-- With delay (e.g., wait for animation to complete) -->
<input appAutoFocus [delay]="300" placeholder="Username">
```
</details>

---

## 10. Knowledge Check

1. What is the difference between `@HostListener` and `@HostBinding`?
2. What does the `host` property in `@Directive()` do, and why is it preferred over `@HostListener`/`@HostBinding`?
3. When building a directive that attaches native DOM event listeners (e.g., `document.addEventListener`), what must you do to prevent memory leaks?
4. What is the Directive Composition API (`hostDirectives`), and what problem does it solve?

<details>
<summary>✅ View Answers</summary>

1. **`@HostListener`** listens to **events** on the host element (or document/window) and calls a method when that event fires. **`@HostBinding`** **binds** a directive class property to a **property, attribute, or class** on the host element — keeping the DOM in sync with the directive's state (e.g., `@HostBinding('class.active') isActive = true`).

2. The `host` property in the `@Directive()` decorator is a declarative, static alternative to `@HostListener` and `@HostBinding`. It's preferred in modern Angular because it's more readable (all host interactions in one place), works better with Angular's build optimizer, and is the approach recommended in official Angular documentation.

3. You must store a reference to the listener function and call `removeEventListener` with the same function reference in `ngOnDestroy()` (or register it with `DestroyRef.onDestroy()`). If you don't remove the listener, it keeps a reference to the directive/component in memory, preventing garbage collection — a classic memory leak.

4. The Directive Composition API allows a **component** to declare that it should behave as if certain **directives are already applied** to it, by listing them in the `hostDirectives` array. It solves the problem of having to manually apply the same set of directives to many components. Instead, you compose the behaviors into the component's definition, so consumers don't need to know or remember to add them.
</details>

---

*Next: [12 - Content Projection →](./12-content-projection.md)*
