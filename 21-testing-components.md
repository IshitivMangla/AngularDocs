# Angular: Testing Components

> **Goal**: Write effective unit and integration tests for Angular standalone components using `TestBed`, covering inputs, outputs, DOM interactions, service mocking, and signal-based components.

---

## 📋 Table of Contents
1. [Testing Pyramid for Angular](#1-testing-pyramid)
2. [Setting Up: `TestBed` and Fixtures](#2-setting-up-testbed-and-fixtures)
3. [Testing Inputs & DOM](#3-testing-inputs--dom)
4. [Testing Outputs (Events)](#4-testing-outputs-events)
5. [Mocking Services](#5-mocking-services)
6. [Testing Signal-Based Components](#6-testing-signal-based-components)
7. [Testing with `By.css()` — The Angular Way](#7-testing-with-bycss)
8. [Async Tests: HTTP and Observables](#8-async-tests)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Try It Yourself](#10-try-it-yourself)
11. [Knowledge Check](#11-knowledge-check)

---

## 1. Testing Pyramid

```
        /\
       /  \
      / E2E \        (Cypress, Playwright) — Few, slow, expensive
     /--------\
    / Integration \  (TestBed with real services) — Some, moderate
   /--------------\
  /   Unit Tests   \  (Jest/Jasmine in isolation) — Many, fast, cheap
 /------------------\
```

For Angular components, **integration tests with TestBed** are the sweet spot — you test the component + template together, but mock external dependencies (HTTP, services).

---

## 2. Setting Up: `TestBed` and Fixtures

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCardComponent } from './product-card.component';
import { CurrencyPipe } from '@angular/common';
import { UserService } from '../../core/services/user.service';

describe('ProductCardComponent', () => {
  let component: ProductCardComponent;
  let fixture: ComponentFixture<ProductCardComponent>;
  let userServiceSpy: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    // Create mock service
    userServiceSpy = jasmine.createSpyObj('UserService', ['getCurrentUser']);
    userServiceSpy.getCurrentUser.and.returnValue({ id: 1, name: 'Alice' });

    await TestBed.configureTestingModule({
      // Import standalone components directly
      imports: [ProductCardComponent],

      // Override providers with mocks
      providers: [
        { provide: UserService, useValue: userServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;

    // First detectChanges() triggers ngOnInit and renders the initial DOM
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });
});
```

### The `ComponentFixture` API

```typescript
// fixture.componentInstance → Access the TypeScript class directly
component.somePublicMethod();
component.someSignal.set('newValue');

// fixture.nativeElement → The raw DOM element <app-product-card>
const el: HTMLElement = fixture.nativeElement;
el.querySelector('.price');

// fixture.debugElement → Angular's enhanced DOM wrapper
fixture.debugElement.query(By.css('.price'));
fixture.debugElement.query(By.directive(RouterLink));

// fixture.detectChanges() → Runs Angular's change detection
// MUST be called after any state change to update the DOM
fixture.detectChanges();

// fixture.whenStable() → Wait for async operations to complete
await fixture.whenStable();
```

---

## 3. Testing Inputs & DOM

```typescript
// product-card.component.ts
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="card" [class.featured]="isFeatured()">
      <h3 data-testid="product-name">{{ product().name }}</h3>
      <span data-testid="product-price">{{ product().price | currency }}</span>
      @if (isFeatured()) {
        <span data-testid="featured-badge">FEATURED</span>
      }
    </div>
  `
})
export class ProductCardComponent {
  product = input.required<{ name: string; price: number; }>();
  isFeatured = input(false);
}
```

```typescript
// product-card.component.spec.ts
describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;
  let component: ProductCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;
  });

  it('should display product name and price', () => {
    // Set required signal input
    fixture.componentRef.setInput('product', { name: 'Angular Shirt', price: 29.99 });
    fixture.detectChanges();

    const name = fixture.nativeElement.querySelector('[data-testid="product-name"]');
    const price = fixture.nativeElement.querySelector('[data-testid="product-price"]');

    expect(name.textContent).toContain('Angular Shirt');
    expect(price.textContent).toContain('$29.99');
  });

  it('should show featured badge when isFeatured is true', () => {
    fixture.componentRef.setInput('product', { name: 'T-Shirt', price: 10 });
    fixture.componentRef.setInput('isFeatured', true);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="featured-badge"]');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('FEATURED');
  });

  it('should NOT show featured badge by default', () => {
    fixture.componentRef.setInput('product', { name: 'T-Shirt', price: 10 });
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="featured-badge"]');
    expect(badge).toBeNull();
  });

  it('should apply .featured class when isFeatured is true', () => {
    fixture.componentRef.setInput('product', { name: 'T-Shirt', price: 10 });
    fixture.componentRef.setInput('isFeatured', true);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.card');
    expect(card.classList.contains('featured')).toBeTrue();
  });
});
```

> **Best Practice**: Use `data-testid` attributes as testing hooks — they're stable and don't change when you refactor CSS classes or HTML structure.

---

## 4. Testing Outputs (Events)

```typescript
// user-card.component.ts
@Component({
  selector: 'app-user-card',
  standalone: true,
  template: `
    <div class="card">
      <h3>{{ user().name }}</h3>
      <button data-testid="edit-btn" (click)="editUser.emit(user())">Edit</button>
      <button data-testid="delete-btn" (click)="deleteUser.emit(user().id)">Delete</button>
    </div>
  `
})
export class UserCardComponent {
  user = input.required<User>();
  editUser = output<User>();
  deleteUser = output<number>();
}
```

```typescript
describe('UserCardComponent - outputs', () => {
  let fixture: ComponentFixture<UserCardComponent>;
  const mockUser: User = { id: 42, name: 'Alice', email: 'alice@example.com' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
    fixture.componentRef.setInput('user', mockUser);
    fixture.detectChanges();
  });

  it('should emit the user when Edit is clicked', () => {
    // Spy on the output
    const emittedValues: User[] = [];
    fixture.componentInstance.editUser.subscribe(u => emittedValues.push(u));

    // Click the button
    const editBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="edit-btn"]');
    editBtn.click();

    expect(emittedValues.length).toBe(1);
    expect(emittedValues[0]).toEqual(mockUser);
  });

  it('should emit the user ID when Delete is clicked', () => {
    const emittedIds: number[] = [];
    fixture.componentInstance.deleteUser.subscribe(id => emittedIds.push(id));

    fixture.nativeElement.querySelector('[data-testid="delete-btn"]').click();

    expect(emittedIds[0]).toBe(42);
  });
});
```

---

## 5. Mocking Services

```typescript
// user-list.component.ts — uses UserService
@Component({
  selector: 'app-user-list',
  standalone: true,
  template: `
    @if (isLoading()) {
      <div data-testid="spinner">Loading...</div>
    } @else {
      @for (user of users(); track user.id) {
        <div data-testid="user-row">{{ user.name }}</div>
      } @empty {
        <p data-testid="empty-state">No users found.</p>
      }
    }
  `
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);
  users = signal<User[]>([]);
  isLoading = signal(true);

  ngOnInit() {
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.isLoading.set(false);
      }
    });
  }
}
```

```typescript
import { of, throwError } from 'rxjs';

describe('UserListComponent', () => {
  let fixture: ComponentFixture<UserListComponent>;
  let userServiceMock: jasmine.SpyObj<UserService>;

  const mockUsers: User[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];

  beforeEach(async () => {
    userServiceMock = jasmine.createSpyObj('UserService', ['getUsers']);

    await TestBed.configureTestingModule({
      imports: [UserListComponent],
      providers: [
        { provide: UserService, useValue: userServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserListComponent);
  });

  it('should show spinner initially', () => {
    // Return a never-completing observable so component stays in loading state
    userServiceMock.getUsers.and.returnValue(new Subject<User[]>().asObservable());
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="spinner"]')).toBeTruthy();
  });

  it('should render user rows after loading', () => {
    userServiceMock.getUsers.and.returnValue(of(mockUsers));
    fixture.detectChanges();  // Triggers ngOnInit + immediate observable emission

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="user-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Alice');
    expect(rows[1].textContent).toContain('Bob');
  });

  it('should show empty state when no users', () => {
    userServiceMock.getUsers.and.returnValue(of([]));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="empty-state"]')).toBeTruthy();
  });
});
```

---

## 6. Testing Signal-Based Components

```typescript
// counter.component.ts
@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <p data-testid="count">{{ count() }}</p>
    <button data-testid="increment" (click)="increment()">+</button>
    <button data-testid="decrement" (click)="decrement()">-</button>
    <button data-testid="reset" (click)="count.set(0)">Reset</button>
  `
})
export class CounterComponent {
  count = signal(0);
  increment() { this.count.update(c => c + 1); }
  decrement() { this.count.update(c => Math.max(0, c - 1)); }
}
```

```typescript
describe('CounterComponent', () => {
  let fixture: ComponentFixture<CounterComponent>;
  let component: CounterComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CounterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function getCount(): string {
    return fixture.nativeElement.querySelector('[data-testid="count"]').textContent;
  }

  it('should start at 0', () => {
    expect(getCount()).toContain('0');
  });

  it('should increment when + is clicked', () => {
    fixture.nativeElement.querySelector('[data-testid="increment"]').click();
    fixture.detectChanges();
    expect(getCount()).toContain('1');
  });

  it('should not go below 0 when decrement is clicked at 0', () => {
    fixture.nativeElement.querySelector('[data-testid="decrement"]').click();
    fixture.detectChanges();
    expect(getCount()).toContain('0');
  });

  it('should reset to 0 on reset click', () => {
    // Set via signal directly
    component.count.set(10);
    fixture.detectChanges();
    expect(getCount()).toContain('10');

    fixture.nativeElement.querySelector('[data-testid="reset"]').click();
    fixture.detectChanges();
    expect(getCount()).toContain('0');
  });
});
```

---

## 7. Testing with `By.css()`

`By.css()` returns `DebugElement` which has more Angular context than raw `nativeElement.querySelector()`.

```typescript
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

// Check if a directive is applied to an element
it('should have a routerLink on the logo', () => {
  const logoLink = fixture.debugElement.query(By.css('[data-testid="logo"]'));
  expect(logoLink).toBeTruthy();

  // Check if the RouterLink directive is applied to it
  const routerLink = logoLink.injector.get(RouterLink, null);
  expect(routerLink).toBeTruthy();
  expect(routerLink!.routerLink).toEqual(['/home']);
});

// Query multiple elements
const allItems = fixture.debugElement.queryAll(By.css('.list-item'));
expect(allItems.length).toBe(3);
```

---

## 8. Async Tests

```typescript
import { fakeAsync, tick, flush } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('SearchComponent (async)', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchComponent, HttpClientTestingModule]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Verify no outstanding HTTP requests
  });

  it('should call the search API with debounce', fakeAsync(() => {
    fixture.detectChanges();

    // Simulate user typing
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = 'angular';
    input.dispatchEvent(new Event('input'));

    // Advance time by 300ms (debounce time)
    tick(300);
    fixture.detectChanges();

    // Expect one HTTP request was made
    const req = httpMock.expectOne(r => r.url.includes('/api/search'));
    expect(req.request.params.get('q')).toBe('angular');

    // Flush the request with mock data
    req.flush([{ id: 1, title: 'Angular Guide' }]);
    fixture.detectChanges();

    // Verify results are displayed
    const results = fixture.nativeElement.querySelectorAll('.result');
    expect(results.length).toBe(1);
  }));
});
```

---

## 9. Common Pitfalls

### Pitfall 1: Forgetting `detectChanges()`

```typescript
// ❌ State changed but DOM not updated!
component.users.set([{ id: 1, name: 'Alice' }]);
const rows = fixture.nativeElement.querySelectorAll('.user-row');
expect(rows.length).toBe(1);  // FAILS — DOM is stale!

// ✅ Trigger change detection after state change
component.users.set([{ id: 1, name: 'Alice' }]);
fixture.detectChanges();
const rows = fixture.nativeElement.querySelectorAll('.user-row');
expect(rows.length).toBe(1);  // PASSES ✅
```

### Pitfall 2: Using real services with HTTP

```typescript
// ❌ Actually makes HTTP calls in tests!
providers: [UserService]

// ✅ Always mock services that make HTTP calls
providers: [{ provide: UserService, useValue: userServiceMock }]
// OR use HttpClientTestingModule + HttpTestingController
```

### Pitfall 3: Testing implementation details instead of behavior

```typescript
// ❌ Testing internal implementation — brittle!
expect(component.filteredUsers.length).toBe(2);

// ✅ Test what the USER sees — resilient to refactoring!
const visibleRows = fixture.nativeElement.querySelectorAll('[data-testid="user-row"]');
expect(visibleRows.length).toBe(2);
```

---

## 10. Try It Yourself

Write tests for this `ToggleComponent`:

```typescript
@Component({
  selector: 'app-toggle',
  standalone: true,
  template: `
    <button
      data-testid="toggle-btn"
      [class.active]="isOn()"
      (click)="isOn.set(!isOn())"
      [attr.aria-pressed]="isOn()">
      {{ isOn() ? labelOn() : labelOff() }}
    </button>
  `
})
export class ToggleComponent {
  isOn = model(false);
  labelOn = input('ON');
  labelOff = input('OFF');
}
```

Write 4 tests:
1. Shows "OFF" text by default
2. Shows "ON" text when isOn is true
3. Clicking the button toggles the state and emits the new value
4. Has `aria-pressed="false"` by default and `aria-pressed="true"` when toggled

<details>
<summary>✅ View Solution</summary>

```typescript
describe('ToggleComponent', () => {
  let fixture: ComponentFixture<ToggleComponent>;
  let component: ToggleComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToggleComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function getBtn(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-testid="toggle-btn"]');
  }

  it('should show OFF text by default', () => {
    expect(getBtn().textContent?.trim()).toBe('OFF');
  });

  it('should show ON text when isOn is true', () => {
    fixture.componentRef.setInput('isOn', true);
    fixture.detectChanges();
    expect(getBtn().textContent?.trim()).toBe('ON');
  });

  it('clicking button toggles state and emits', () => {
    const emitted: boolean[] = [];
    component.isOn.subscribe(val => emitted.push(val));

    getBtn().click();
    fixture.detectChanges();

    expect(component.isOn()).toBeTrue();
    expect(emitted).toEqual([false, true]);  // initial false, then toggled true
    expect(getBtn().textContent?.trim()).toBe('ON');
  });

  it('should have correct aria-pressed attribute', () => {
    expect(getBtn().getAttribute('aria-pressed')).toBe('false');

    getBtn().click();
    fixture.detectChanges();

    expect(getBtn().getAttribute('aria-pressed')).toBe('true');
  });
});
```
</details>

---

## 11. Knowledge Check

1. Why doesn't Angular run change detection automatically in tests?
2. What is the difference between `fixture.nativeElement` and `fixture.debugElement`?
3. What does `HttpClientTestingModule` do, and why is it needed?
4. What is `fakeAsync()` and when should you use it over a regular `async` test?

<details>
<summary>✅ View Answers</summary>

1. Angular tests run synchronously by default for speed and control. Automatic change detection in tests would be unpredictable — your assertions might run before Angular finishes updating the DOM. By requiring `fixture.detectChanges()`, you have precise control over when the DOM is updated, making tests deterministic and easy to reason about.

2. `fixture.nativeElement` returns the **raw browser DOM element** (`HTMLElement`). You use native DOM methods on it (`querySelector`, `click`, `textContent`). `fixture.debugElement` is Angular's **wrapper** around the DOM that provides Angular-specific query helpers (`query(By.css())`, `query(By.directive())`), and access to the injector for getting service instances.

3. `HttpClientTestingModule` replaces the real HTTP backend with a test-friendly mock. Instead of sending real network requests, you intercept them with `HttpTestingController`, specify what response to return, and verify the correct URL/params were called. Without it, unit tests would send real HTTP requests, making them slow and unreliable.

4. `fakeAsync()` gives you **synchronous control over async operations** like timers (`setTimeout`, `setInterval`, `debounceTime`) by using `tick(ms)` to manually advance fake time. Use it when testing code with timers or debounced operators. Use regular `async/await` with `fixture.whenStable()` when testing real Promises and Observables without timers.
</details>

---

*Next: [22 - Testing Services →](./22-testing-services.md)*
