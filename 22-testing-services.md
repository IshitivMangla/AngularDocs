# Angular: Testing Services & HTTP

> **Goal**: Master unit testing for Angular services and HTTP requests using `TestBed`, `HttpTestingController`, and modern mock patterns.

---

## 📋 Table of Contents
1. [Why Testing Services is Easy](#1-why-testing-services-is-easy)
2. [Testing Synchronous Services](#2-testing-synchronous-services)
3. [Testing HTTP Services with `HttpTestingController`](#3-testing-http-services)
4. [Testing HTTP Errors](#4-testing-http-errors)
5. [Testing Services with Dependent Services](#5-testing-services-with-dependent-services)
6. [Testing RxJS Streams in Services](#6-testing-rxjs-streams-in-services)
7. [Testing Signal-Based Services](#7-testing-signal-based-services)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Try It Yourself](#9-try-it-yourself)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. Why Testing Services is Easy

Services are pure TypeScript classes without HTML templates or DOM bindings. They are fast, reliable, and straightforward to unit test.

```typescript
// Simple service test structure
describe('CalculatorService', () => {
  let service: CalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CalculatorService]
    });
    service = TestBed.inject(CalculatorService);
  });

  it('should add numbers', () => {
    expect(service.add(2, 3)).toBe(5);
  });
});
```

---

## 2. Testing Synchronous Services

```typescript
// cart.service.ts
@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = signal<CartItem[]>([]);
  readonly items = this._items.asReadonly();
  readonly total = computed(() =>
    this._items().reduce((sum, item) => sum + (item.price * item.quantity), 0)
  );

  addItem(item: CartItem) {
    this._items.update(list => [...list, item]);
  }

  clear() {
    this._items.set([]);
  }
}
```

```typescript
// cart.service.spec.ts
describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  it('should start with an empty cart', () => {
    expect(service.items()).toEqual([]);
    expect(service.total()).toBe(0);
  });

  it('should add item and update total', () => {
    service.addItem({ id: 1, name: 'Shirt', price: 20, quantity: 2 });

    expect(service.items().length).toBe(1);
    expect(service.total()).toBe(40);
  });

  it('should clear all items', () => {
    service.addItem({ id: 1, name: 'Shirt', price: 20, quantity: 1 });
    service.clear();

    expect(service.items()).toEqual([]);
    expect(service.total()).toBe(0);
  });
});
```

---

## 3. Testing HTTP Services with `HttpTestingController`

`provideHttpClientTesting()` intercepts all HTTP calls, allowing you to verify request parameters and flush mock data.

```typescript
// product.service.ts
@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);

  getProducts(category?: string): Observable<Product[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);

    return this.http.get<Product[]>('/api/products', { params });
  }

  createProduct(product: CreateProductDto): Observable<Product> {
    return this.http.post<Product>('/api/products', product);
  }
}
```

```typescript
// product.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProductService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // CRITICAL: Ensures no unexpected extra HTTP requests were made!
    httpMock.verify();
  });

  it('should fetch products via GET', () => {
    const dummyProducts: Product[] = [
      { id: 1, name: 'Item A', price: 10 },
      { id: 2, name: 'Item B', price: 20 }
    ];

    service.getProducts().subscribe(products => {
      expect(products.length).toBe(2);
      expect(products).toEqual(dummyProducts);
    });

    const req = httpMock.expectOne('/api/products');
    expect(req.request.method).toBe('GET');
    req.flush(dummyProducts); // Resolve with mock data
  });

  it('should pass query params when category is provided', () => {
    service.getProducts('electronics').subscribe();

    const req = httpMock.expectOne(r => r.url === '/api/products');
    expect(req.request.params.get('category')).toBe('electronics');
    req.flush([]);
  });

  it('should send POST request with body', () => {
    const newProduct = { name: 'New Item', price: 99 };

    service.createProduct(newProduct).subscribe(res => {
      expect(res.id).toBe(101);
    });

    const req = httpMock.expectOne('/api/products');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newProduct);
    req.flush({ id: 101, ...newProduct });
  });
});
```

---

## 4. Testing HTTP Errors

```typescript
it('should handle 404 error gracefully', () => {
  service.getProducts().subscribe({
    next: () => fail('Should have failed with 404 error'),
    error: (error) => {
      expect(error.status).toBe(404);
      expect(error.statusText).toBe('Not Found');
    }
  });

  const req = httpMock.expectOne('/api/products');
  req.flush('Product not found', { status: 404, statusText: 'Not Found' });
});

it('should handle network connection error', () => {
  service.getProducts().subscribe({
    next: () => fail('Should have failed with network error'),
    error: (error) => {
      expect(error.error.type).toBe('error');
    }
  });

  const req = httpMock.expectOne('/api/products');
  // Simulate network failure
  req.error(new ProgressEvent('error'));
});
```

---

## 5. Testing Services with Dependent Services

```typescript
// auth-facade.service.ts
@Injectable({ providedIn: 'root' })
export class AuthFacadeService {
  private api = inject(AuthApiService);
  private storage = inject(StorageService);

  login(credentials: LoginDto): Observable<boolean> {
    return this.api.login(credentials).pipe(
      map(res => {
        this.storage.setToken(res.accessToken);
        return true;
      })
    );
  }
}
```

```typescript
describe('AuthFacadeService', () => {
  let facade: AuthFacadeService;
  let apiSpy: jasmine.SpyObj<AuthApiService>;
  let storageSpy: jasmine.SpyObj<StorageService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('AuthApiService', ['login']);
    storageSpy = jasmine.createSpyObj('StorageService', ['setToken']);

    TestBed.configureTestingModule({
      providers: [
        AuthFacadeService,
        { provide: AuthApiService, useValue: apiSpy },
        { provide: StorageService, useValue: storageSpy }
      ]
    });

    facade = TestBed.inject(AuthFacadeService);
  });

  it('should store token on successful login', () => {
    apiSpy.login.and.returnValue(of({ accessToken: 'test-jwt-token' }));

    facade.login({ email: 'a@b.com', password: 'secret' }).subscribe(success => {
      expect(success).toBeTrue();
      expect(storageSpy.setToken).toHaveBeenCalledWith('test-jwt-token');
    });
  });
});
```

---

## 6. Testing RxJS Streams in Services

```typescript
it('should debounce search queries', fakeAsync(() => {
  const service = TestBed.inject(SearchService);
  const emittedResults: any[] = [];

  service.searchResults$.subscribe(res => emittedResults.push(res));

  service.search('a');
  service.search('ab');
  service.search('abc');

  tick(200); // Before debounce threshold (300ms)
  expect(emittedResults.length).toBe(0);

  tick(100); // Reaches 300ms threshold
  expect(emittedResults.length).toBe(1);
}));
```

---

## 7. Testing Signal-Based Services

```typescript
describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ThemeService] });
    service = TestBed.inject(ThemeService);
  });

  it('should toggle theme signal state', () => {
    expect(service.isDark()).toBeFalse();

    service.toggleTheme();
    expect(service.isDark()).toBeTrue();

    service.toggleTheme();
    expect(service.isDark()).toBeFalse();
  });
});
```

---

## 8. Common Pitfalls

### Pitfall 1: Forgetting `httpMock.verify()`

```typescript
// ❌ If an extra unexpected HTTP request occurs, the test might silently pass!
afterEach(() => {
  httpMock.verify(); // Always include this to catch unhandled requests!
});
```

### Pitfall 2: Expecting sync evaluation of observables before `flush()`

```typescript
// ❌ Subscription callback won't execute until flush() is called!
service.getData().subscribe(data => expect(data).toBeDefined());
// Assertion hasn't run yet!
req.flush({ id: 1 });
```

---

## 9. Try It Yourself

Write a complete unit test for `UserService.updateUser(id, changes)` that:
1. Sends a `PATCH` request to `/api/users/42`
2. Verifies the request payload matches `{ name: 'Updated' }`
3. Flushes the updated user object

<details>
<summary>✅ View Solution</summary>

```typescript
it('should update user via PATCH request', () => {
  const changes = { name: 'Updated Name' };
  const mockResponse = { id: 42, name: 'Updated Name', email: 'user@app.com' };

  service.updateUser(42, changes).subscribe(user => {
    expect(user).toEqual(mockResponse);
  });

  const req = httpMock.expectOne('/api/users/42');
  expect(req.request.method).toBe('PATCH');
  expect(req.request.body).toEqual(changes);

  req.flush(mockResponse);
});
```
</details>

---

## 10. Knowledge Check

1. Why should you never hit a real backend API during service unit testing?
2. What is the purpose of `httpMock.verify()` in `afterEach()`?
3. How do you simulate a 500 server error when testing an HTTP service?
4. Why are service tests generally faster and easier to write than component tests?

<details>
<summary>✅ View Answers</summary>

1. Hitting real APIs makes tests slow, flaky (fails if the network drops or server is down), requires active server infrastructure, and pollutes production/test databases with junk test data.

2. `httpMock.verify()` asserts that there are **no outstanding, unhandled HTTP requests** left unverified by `expectOne()`. This catches subtle bugs where your code triggers unexpected secondary HTTP requests.

3. Use `req.flush('Server error message', { status: 500, statusText: 'Internal Server Error' })` on the `TestRequest` object returned by `httpMock.expectOne()`.

4. Services have no HTML templates, DOM manipulation, dynamic rendering, or Angular change detection cycles. They are pure TypeScript classes that can be instantiated and tested directly in memory.
</details>

---

*Next: [23 - Zoneless Angular →](./23-zoneless-angular.md)*
