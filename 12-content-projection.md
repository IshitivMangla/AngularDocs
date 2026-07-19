# Angular: Content Projection (`<ng-content>`)

> **Goal**: Build truly reusable container components — modals, cards, tabs, accordions — using Angular's content projection system with single and multi-slot patterns.

---

## 📋 Table of Contents
1. [What is Content Projection?](#1-what-is-content-projection)
2. [Basic Single-Slot Projection](#2-basic-single-slot-projection)
3. [Multi-Slot Projection with `select`](#3-multi-slot-projection-with-select)
4. [Conditional Content Projection](#4-conditional-content-projection)
5. [`ng-template` and `ngTemplateOutlet`](#5-ng-template-and-ngtemplateoutlet)
6. [`ContentChild` & `ContentChildren`](#6-contentchild--contentchildren)
7. [Real-World Example: Card Component](#7-real-world-example-card-component)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Try It Yourself](#9-try-it-yourself)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. What is Content Projection?

When a parent component puts HTML **inside** a child component's tags, that HTML is "projected" into a slot defined by `<ng-content>` in the child's template.

```
Parent uses:                    Child's template renders:
<app-card>                      <div class="card">
  <p>My content</p>     →         <p>My content</p>   ← Projected here!
</app-card>                     </div>
```

**Key rule**: Projected content is **initialized in the parent's context**. Variables, events, and styles belong to the parent — not the child.

---

## 2. Basic Single-Slot Projection

```typescript
// card.component.ts — container that accepts any content
@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div class="card">
      <div class="card-body">
        <!-- Single slot: projects all content from the parent -->
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class CardComponent { }
```

```html
<!-- Parent usage -->
<app-card>
  <h2>Product Name</h2>
  <p>Description here...</p>
  <button (click)="addToCart()">Add to Cart</button>
  <!-- All of this is projected into <ng-content> -->
</app-card>
```

---

## 3. Multi-Slot Projection with `select`

`select` takes any valid CSS selector:
- `[attr]` — elements with a specific attribute
- `.class` — elements with a specific class
- `tag` — elements matching a tag name
- Multiple: `h1, h2` — elements matching either selector

```typescript
// modal.component.ts
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick()"></div>
    <div class="modal-dialog" role="dialog">

      <!-- Slot 1: Elements with the 'modalHeader' attribute -->
      <div class="modal-header">
        <ng-content select="[modalHeader]"></ng-content>
        <button class="close-btn" (click)="closed.emit()">✕</button>
      </div>

      <!-- Slot 2: Elements with 'modal-body' CSS class -->
      <div class="modal-body">
        <ng-content select=".modal-body"></ng-content>
      </div>

      <!-- Slot 3: Default fallback — catches everything that didn't match above -->
      <div class="modal-footer">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class ModalComponent {
  closed = output<void>();
  clickOutside = input<boolean>(true);

  onBackdropClick() {
    if (this.clickOutside()) this.closed.emit();
  }
}
```

```html
<!-- Using the Modal with multi-slot projection -->
<app-modal (closed)="isOpen.set(false)">

  <!-- → Goes to [modalHeader] slot -->
  <h2 modalHeader>Confirm Delete</h2>

  <!-- → Goes to .modal-body slot -->
  <div class="modal-body">
    <p>Are you sure you want to delete "{{ productName() }}"?</p>
    <p>This action cannot be undone.</p>
  </div>

  <!-- → Goes to default footer slot (no matching selector) -->
  <button (click)="isOpen.set(false)">Cancel</button>
  <button class="btn-danger" (click)="confirmDelete()">Delete</button>

</app-modal>
```

---

## 4. Conditional Content Projection

`<ng-content>` cannot be wrapped with `@if` because the projected content is **always instantiated** in the parent, regardless of whether it's displayed in the child. Use `ngTemplateOutlet` for truly lazy content.

```typescript
// panel.component.ts
import { Component, signal, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-accordion-panel',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div class="panel">
      <button (click)="isOpen.set(!isOpen())" class="panel-header">
        <ng-content select="[panelTitle]"></ng-content>
        <span>{{ isOpen() ? '▼' : '▶' }}</span>
      </button>

      @if (isOpen()) {
        <!-- ng-content INSIDE @if still instantiates content in the parent! -->
        <div class="panel-body">
          <ng-content></ng-content>
        </div>
      }
    </div>
  `
})
export class AccordionPanelComponent {
  isOpen = signal(false);
}
```

---

## 5. `ng-template` and `ngTemplateOutlet`

When you need **truly lazy** content that's only created when rendered, use `ng-template` with `ngTemplateOutlet`.

```typescript
// tabs.component.ts
import { Component, ContentChildren, QueryList, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TabPanelComponent } from './tab-panel.component';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div class="tabs">
      <div class="tab-headers">
        @for (tab of tabs(); track tab.label) {
          <button
            [class.active]="activeTab() === tab"
            (click)="activeTab.set(tab)">
            {{ tab.label }}
          </button>
        }
      </div>

      <!-- Only renders the active tab's content! -->
      <div class="tab-content">
        @if (activeTab(); as tab) {
          <ng-container *ngTemplateOutlet="tab.template"></ng-container>
        }
      </div>
    </div>
  `
})
export class TabsComponent {
  tabs = input<{ label: string; template: any }[]>([]);
  activeTab = signal<any>(null);

  ngOnInit() {
    if (this.tabs().length > 0) {
      this.activeTab.set(this.tabs()[0]);
    }
  }
}
```

---

## 6. `ContentChild` & `ContentChildren`

`@ContentChild` gets a reference to a projected element, and `@ContentChildren` gets a list.

```typescript
// alert.component.ts — wraps content with dismissible behavior
import { Component, ContentChild, AfterContentInit, ElementRef } from '@angular/core';

@Component({
  selector: 'app-alert-wrapper',
  standalone: true,
  template: `
    <div class="alert-container" [class.has-icon]="hasIcon">
      <ng-content select="[alertIcon]"></ng-content>
      <ng-content></ng-content>
    </div>
  `
})
export class AlertWrapperComponent implements AfterContentInit {
  // Reference to projected content matching [alertIcon]
  @ContentChild('alertIcon') alertIcon?: ElementRef;
  hasIcon = false;

  ngAfterContentInit() {
    // ContentChild is available here (not in ngOnInit!)
    this.hasIcon = !!this.alertIcon;
    console.log('Alert has an icon:', this.hasIcon);
  }
}
```

---

## 7. Real-World Example: Card Component

A complete, production-ready card with all slots:

```typescript
// card.component.ts
@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <article class="card" [class]="variant()">
      <!-- Optional image slot -->
      <div class="card-image">
        <ng-content select="[cardImage]"></ng-content>
      </div>

      <!-- Header: title + optional badge -->
      <div class="card-header">
        <ng-content select="[cardTitle]"></ng-content>
        <ng-content select="[cardBadge]"></ng-content>
      </div>

      <!-- Body: main content -->
      <div class="card-body">
        <ng-content></ng-content>
      </div>

      <!-- Footer: action buttons -->
      <div class="card-footer">
        <ng-content select="[cardActions]"></ng-content>
      </div>
    </article>
  `
})
export class CardComponent {
  variant = input<'default' | 'featured' | 'minimal'>('default');
}
```

```html
<!-- Usage -->
<app-card variant="featured">
  <img cardImage [src]="product.imageUrl" [alt]="product.name">

  <h3 cardTitle>{{ product.name }}</h3>
  <span cardBadge class="badge-sale">SALE</span>

  <!-- This goes to the default <ng-content> slot (card body) -->
  <p>{{ product.description | truncate:100 }}</p>
  <p class="price">{{ product.price | currency }}</p>

  <div cardActions>
    <button (click)="addToCart(product)">🛒 Add to Cart</button>
    <button (click)="addToWishlist(product)">♡</button>
  </div>
</app-card>
```

---

## 8. Common Pitfalls

### Pitfall 1: Projected content is always instantiated

```html
<!-- ❌ Even though @if hides the content, AppHeavyComponent is STILL created! -->
<app-panel>
  <app-heavy-component></app-heavy-component>  <!-- Instantiated immediately! -->
</app-panel>

<!-- ✅ Use @defer for truly lazy content -->
@defer (when panelOpen()) {
  <app-heavy-component></app-heavy-component>
}
```

### Pitfall 2: Styling projected content from the child

```css
/* ❌ Child component's CSS cannot reach projected content (due to View Encapsulation) */
.card-body p { color: red; }  /* Won't work for projected <p> elements */

/* ✅ Option 1: Style from the PARENT (where content is declared) */
/* In parent's CSS */
.product-description { color: red; }

/* ✅ Option 2: Use ViewEncapsulation.None (not recommended — leaks globally) */
/* ✅ Option 3: Use CSS custom properties (variables) for theming */
```

### Pitfall 3: Wrong CSS selector in `select`

```html
<!-- ❌ Selects an element named <icon>, not elements with class="icon" -->
<ng-content select="icon"></ng-content>

<!-- ✅ .icon selects elements with class="icon" -->
<ng-content select=".icon"></ng-content>

<!-- ✅ [data-slot="icon"] selects by attribute -->
<ng-content select="[data-slot='icon']"></ng-content>
```

### Pitfall 4: Accessing `@ContentChild` in `ngOnInit`

```typescript
// ❌ ContentChild is not available in ngOnInit!
@ContentChild(IconComponent) icon?: IconComponent;

ngOnInit() {
  console.log(this.icon);  // undefined!
}

// ✅ Use ngAfterContentInit
ngAfterContentInit() {
  console.log(this.icon);  // IconComponent instance!
}
```

---

## 9. Try It Yourself

Build a reusable `<app-dialog>` component that:
1. Projects content into three named slots: title, body, footer
2. Uses attributes as slot selectors: `[dialogTitle]`, `[dialogBody]`, `[dialogFooter]`
3. Has a close button in the header that emits a `(closed)` event
4. Accepts a `showFooter` input that hides the footer when false

<details>
<summary>✅ View Solution</summary>

```typescript
// dialog.component.ts
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-dialog',
  standalone: true,
  template: `
    <div class="dialog-overlay" (click)="closed.emit()">
      <div class="dialog" (click)="$event.stopPropagation()" role="dialog">

        <div class="dialog-header">
          <ng-content select="[dialogTitle]"></ng-content>
          <button class="close" (click)="closed.emit()" aria-label="Close">✕</button>
        </div>

        <div class="dialog-body">
          <ng-content select="[dialogBody]"></ng-content>
          <!-- Default slot for unslotted content -->
          <ng-content></ng-content>
        </div>

        @if (showFooter()) {
          <div class="dialog-footer">
            <ng-content select="[dialogFooter]"></ng-content>
          </div>
        }
      </div>
    </div>
  `
})
export class DialogComponent {
  showFooter = input<boolean>(true);
  closed = output<void>();
}
```

Usage:
```html
<app-dialog (closed)="isOpen.set(false)" [showFooter]="true">
  <h2 dialogTitle>Edit Profile</h2>

  <div dialogBody>
    <form>
      <input placeholder="Name">
      <input type="email" placeholder="Email">
    </form>
  </div>

  <div dialogFooter>
    <button (click)="isOpen.set(false)">Cancel</button>
    <button (click)="save()">Save</button>
  </div>
</app-dialog>
```
</details>

---

## 10. Knowledge Check

1. When a parent projects a `<button (click)="save()">` into a child component, where must `save()` exist?
2. What's the difference between `<ng-content select="icon">` and `<ng-content select=".icon">`?
3. Does content inside `<ng-content>` that's hidden by `@if` still get instantiated?
4. When is `@ContentChild` available (which lifecycle hook)?

<details>
<summary>✅ View Answers</summary>

1. In the **parent component**. Projected content retains the scope of the component where it was *declared* (the parent), not where it's *displayed* (the child). The child component has no knowledge of `save()`.

2. `select="icon"` selects elements with the **tag name** `<icon>` (a custom HTML element). `select=".icon"` selects elements with the **CSS class** `class="icon"`. This is the standard CSS selector syntax — the same as `document.querySelector()`.

3. **Yes.** Content projected with `<ng-content>` is always instantiated in the parent context when the parent renders. `@if` only controls whether the rendered DOM is *visible*. The component inside is still created. To prevent instantiation, use `ng-template` with `ngTemplateOutlet` or `@defer`.

4. `@ContentChild` is only available from **`ngAfterContentInit()`** onwards. Accessing it in `ngOnInit()` returns `undefined` because the projected content hasn't been initialized yet at that point.
</details>

---

*Next: [13 - Route Guards & Resolvers →](./13-route-guards-resolvers.md)*
