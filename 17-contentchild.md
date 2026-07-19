# Angular: ContentChild & ContentChildren

> **Goal**: Inspect and interact with projected content inside container components using `@ContentChild`, `@ContentChildren`, and modern `contentChild()` / `contentChildren()` signal queries.

---

## 📋 Table of Contents
1. [View Queries vs Content Queries](#1-view-queries-vs-content-queries)
2. [Single Content Query: `contentChild()`](#2-single-content-query-contentchild)
3. [Multiple Content Queries: `contentChildren()`](#3-multiple-content-queries-contentchildren)
4. [Building a Complex Accordion Component](#4-building-a-complex-accordion-component)
5. [Building a Tab Group Component](#5-building-a-tab-group-component)
6. [Lifecycle Timing & `ngAfterContentInit`](#6-lifecycle-timing--ngaftercontentinit)
7. [Common Pitfalls](#7-common-pitfalls)
8. [Try It Yourself](#8-try-it-yourself)
9. [Knowledge Check](#9-knowledge-check)

---

## 1. View Queries vs Content Queries

| Feature | View Queries (`viewChild`) | Content Queries (`contentChild`) |
|---|---|---|
| **Target** | Elements in component's OWN template | Elements projected via `<ng-content>` |
| **Origin** | Declared inside child template | Declared in PARENT component template |
| **Lifecycle** | `ngAfterViewInit` | `ngAfterContentInit` |
| **Use cases** | Access DOM inputs, canvas, child component methods | Building Accordions, Tabs, Steppers, Menus |

```
Parent Template:
<app-accordion>
  <app-panel title="Step 1"></app-panel>   ← PROJECTED CONTENT
  <app-panel title="Step 2"></app-panel>   ← PROJECTED CONTENT
</app-accordion>

Accordion Component uses contentChildren(PanelComponent) to find these panels!
```

---

## 2. Single Content Query: `contentChild()`

```typescript
// child-item.component.ts
@Component({
  selector: 'app-card-header',
  standalone: true,
  template: `<h2><ng-content></ng-content></h2>`
})
export class CardHeaderComponent { }
```

```typescript
// parent-container.component.ts
import { Component, contentChild, effect } from '@angular/core';
import { CardHeaderComponent } from './card-header.component';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div class="card" [class.has-header]="hasHeader()">
      <ng-content select="app-card-header"></ng-content>
      <div class="card-body">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class CardComponent {
  // Query projected CardHeaderComponent
  header = contentChild(CardHeaderComponent);

  // Derived state checking if header was provided
  hasHeader = computed(() => !!this.header());

  constructor() {
    effect(() => {
      console.log('Card header projected?', this.hasHeader());
    });
  }
}
```

---

## 3. Multiple Content Queries: `contentChildren()`

```typescript
import { Component, contentChildren, effect } from '@angular/core';
import { MenuItemDirective } from './menu-item.directive';

@Component({
  selector: 'app-dropdown-menu',
  standalone: true,
  template: `
    <div class="menu" role="menu">
      <ng-content></ng-content>
    </div>
  `
})
export class DropdownMenuComponent {
  // Query all projected elements with [appMenuItem] directive
  items = contentChildren(MenuItemDirective);

  constructor() {
    effect(() => {
      console.log(`Dropdown contains ${this.items().length} items`);
    });
  }

  focusFirstItem() {
    const first = this.items()[0];
    first?.focus();
  }
}
```

---

## 4. Building a Complex Accordion Component

A single-expand accordion where opening one panel automatically closes all others.

```typescript
// accordion-panel.component.ts
@Component({
  selector: 'app-accordion-panel',
  standalone: true,
  template: `
    <div class="panel">
      <button class="panel-header" (click)="toggle()">
        <span>{{ title() }}</span>
        <span>{{ isOpen() ? '−' : '+' }}</span>
      </button>
      @if (isOpen()) {
        <div class="panel-body">
          <ng-content></ng-content>
        </div>
      }
    </div>
  `
})
export class AccordionPanelComponent {
  title = input.required<string>();
  isOpen = signal(false);

  toggle() {
    this.isOpen.update(o => !o);
  }

  close() {
    this.isOpen.set(false);
  }
}
```

```typescript
// accordion.component.ts
import { Component, contentChildren, effect } from '@angular/core';
import { AccordionPanelComponent } from './accordion-panel.component';

@Component({
  selector: 'app-accordion',
  standalone: true,
  template: `<ng-content></ng-content>`
})
export class AccordionComponent {
  // Query all projected panels
  panels = contentChildren(AccordionPanelComponent);
  allowMultiple = input<boolean>(false);

  constructor() {
    effect(() => {
      const panelList = this.panels();

      // Listen to toggle events on each panel
      panelList.forEach(panel => {
        // Enforce single-panel expansion if allowMultiple is false
      });
    });
  }

  closeAllExcept(activePanel: AccordionPanelComponent) {
    if (this.allowMultiple()) return;
    this.panels().forEach(panel => {
      if (panel !== activePanel) {
        panel.close();
      }
    });
  }
}
```

---

## 5. Building a Tab Group Component

```typescript
// tab.component.ts
@Component({
  selector: 'app-tab',
  standalone: true,
  template: `
    @if (active()) {
      <div class="tab-pane">
        <ng-content></ng-content>
      </div>
    }
  `
})
export class TabComponent {
  title = input.required<string>();
  active = signal(false);
}
```

```typescript
// tab-group.component.ts
import { Component, contentChildren, effect, signal } from '@angular/core';
import { TabComponent } from './tab.component';

@Component({
  selector: 'app-tab-group',
  standalone: true,
  template: `
    <div class="tab-nav">
      @for (tab of tabs(); track tab.title; let i = $index) {
        <button
          [class.active]="tab.active()"
          (click)="selectTab(tab)">
          {{ tab.title() }}
        </button>
      }
    </div>
    <div class="tab-body">
      <ng-content></ng-content>
    </div>
  `
})
export class TabGroupComponent {
  // Query all projected tabs
  tabs = contentChildren(TabComponent);

  constructor() {
    // Activate the first tab by default
    effect(() => {
      const tabList = this.tabs();
      if (tabList.length > 0 && !tabList.some(t => t.active())) {
        tabList[0].active.set(true);
      }
    });
  }

  selectTab(selectedTab: TabComponent) {
    this.tabs().forEach(tab => {
      tab.active.set(tab === selectedTab);
    });
  }
}
```

```html
<!-- Usage in parent page -->
<app-tab-group>
  <app-tab title="Overview">
    <p>General overview details...</p>
  </app-tab>
  <app-tab title="Specifications">
    <p>Technical specs table...</p>
  </app-tab>
  <app-tab title="Reviews">
    <p>User review list...</p>
  </app-tab>
</app-tab-group>
```

---

## 6. Lifecycle Timing & `ngAfterContentInit`

With traditional `@ContentChild` decorators, content queries resolve during `ngAfterContentInit`.

```typescript
// Order of lifecycle execution:
1. constructor()
2. ngOnInit()
3. ngAfterContentInit()  ← @ContentChild / @ContentChildren resolved HERE
4. ngAfterViewInit()     ← @ViewChild / @ViewChildren resolved HERE
```

With Signal queries (`contentChild()`, `contentChildren()`), query values are Signals that update reactively. You can safely read them inside `effect()` without worrying about lifecycle hook timing!

---

## 7. Common Pitfalls

### Pitfall 1: Using `viewChildren` instead of `contentChildren`

```typescript
// ❌ Returns empty array because TabComponent is PROJECTED, not in own template!
tabs = viewChildren(TabComponent);

// ✅ Use contentChildren for projected content
tabs = contentChildren(TabComponent);
```

### Pitfall 2: Querying elements not wrapped in `<ng-content>`

If the parent doesn't actually project the elements inside `<app-container>`, `contentChildren()` returns an empty array.

### Pitfall 3: Accessing legacy `@ContentChild` in `ngOnInit`

```typescript
// ❌ Undefined in ngOnInit!
@ContentChild(TabComponent) tab!: TabComponent;
ngOnInit() {
  console.log(this.tab); // undefined!
}

// ✅ Access in ngAfterContentInit or use signal contentChild()
```

---

## 8. Try It Yourself

Build a `ButtonGroupComponent` that:
1. Projects custom `<app-button>` components
2. Uses `contentChildren(ButtonComponent)` to query them
3. Automatically applies a `group-item` class to all buttons and disables all buttons if `disabled` input on the group is true

<details>
<summary>✅ View Solution</summary>

```typescript
import { Component, contentChildren, effect, input } from '@angular/core';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'app-button-group',
  standalone: true,
  template: `
    <div class="btn-group" [class.disabled]="disabled()">
      <ng-content select="app-button"></ng-content>
    </div>
  `
})
export class ButtonGroupComponent {
  disabled = input(false);
  buttons = contentChildren(ButtonComponent);

  constructor() {
    effect(() => {
      const isGroupDisabled = this.disabled();
      this.buttons().forEach(btn => {
        btn.isDisabled.set(isGroupDisabled);
      });
    });
  }
}
```
</details>

---

## 9. Knowledge Check

1. What is the key structural difference between a view query and a content query?
2. In what lifecycle hook do legacy `@ContentChild` queries resolve?
3. What happens if you use `contentChildren()` to query a component that isn't wrapped in `<ng-content>`?
4. How do signal-based `contentChild()` queries improve upon legacy `@ContentChild` decorators?

<details>
<summary>✅ View Answers</summary>

1. A **view query** (`viewChild`) queries elements located in the component's **own template**. A **content query** (`contentChild`) queries elements that were **projected into the component from a parent** via `<ng-content>`.

2. Legacy `@ContentChild` queries resolve during **`ngAfterContentInit()`**. They are `undefined` in `ngOnInit()`.

3. `contentChildren()` will return an **empty collection** (an empty array signal) because the target components were never projected into the component.

4. Signal-based `contentChild()` queries return read-only Signals that update **reactively** whenever projected content changes (e.g. when items are added or removed dynamically by the parent). They can be read inside `effect()` and `computed()` without relying on lifecycle hook timing rules.
</details>

---

*Next: [18 - Custom Validators →](./18-custom-validators.md)*
