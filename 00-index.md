# Angular Complete Study Guide — Master Index

> A comprehensive set of notes for building scalable, production-grade Angular applications. All notes use modern Angular patterns (Signals, Standalone Components, Functional APIs).

---

## 🗺️ Learning Path

Follow this sequence for the most effective learning experience:

```
Foundation → Reactivity → Template → Data Flow → Architecture → Advanced → Tooling
```

---

## 📚 All Notes

### 🏗️ Foundation

| Topic | Key Concepts |
|---|---|
| [**Architecture & Standalone**](./01-architecture-and-standalone.md) | Folder structure, `app.config.ts`, bootstrapping, standalone vs NgModule |
| [**Angular CLI**](./24-angular-cli.md) | `ng generate`, `ng serve`, `ng build`, `ng update`, `angular.json` |
| [**Environments**](./25-environments.md) | `environment.ts`, file replacements, multi-environment builds |

### ⚡ Reactivity (Core of Modern Angular)

| Topic | Key Concepts |
|---|---|
| [**Signals** ⭐](./02-signals.md) | `signal()`, `computed()`, `effect()`, `input()`, `output()`, `model()`, NgRx SignalStore |
| [**Zoneless Angular**](./23-zoneless-angular.md) | Zone.js removal, `provideExperimentalZonelessChangeDetection()` |

### 🖼️ Templates & Component Design

| Topic | Key Concepts |
|---|---|
| [**Control Flow**](./03-control-flow.md) | `@if`, `@for`, `@switch`, `@empty`, `track`, type narrowing |
| [**Pipes**](./10-pipes.md) | Built-in pipes, custom pipes, pure vs impure, `AsyncPipe` |
| [**Directives**](./11-directives.md) | Attribute directives, `@HostListener`, `@HostBinding`, Directive Composition API |
| [**Deferrable Views**](./14-deferrable-views.md) | `@defer`, triggers, prefetch, progressive loading |

### 🔀 Data Flow & Communication

| Topic | Key Concepts |
|---|---|
| [**Component Communication**](./08-component-communication.md) | `input()`, `output()`, `model()`, shared services |
| [**Lifecycle Hooks**](./09-lifecycle-hooks.md) | `ngOnInit`, `ngOnDestroy`, `DestroyRef`, `afterRender`, `takeUntilDestroyed` |
| [**Content Projection**](./12-content-projection.md) | `ng-content`, multi-slot, `ngTemplateOutlet`, `ContentChild` |
| [**ViewChild & ViewChildren**](./16-viewchild.md) | `viewChild()` signal, `@ViewChild`, template reference variables |
| [**ContentChild**](./17-contentchild.md) | `contentChildren()` signal, accordion pattern |

### 🏛️ Architecture & Services

| Topic | Key Concepts |
|---|---|
| [**Services & DI** ⭐](./05-services-di.md) | `inject()`, DI tree, `InjectionToken`, `providedIn`, `useClass`, `useFactory` |
| [**Routing** ⭐](./04-routing.md) | `loadComponent`, `loadChildren`, route params, `withComponentInputBinding()` |
| [**Guards & Resolvers**](./13-route-guards-resolvers.md) | `canActivate`, `canDeactivate`, `canMatch`, `ResolveFn`, `EMPTY` |
| [**HTTP Interceptors**](./19-http-interceptors.md) | Auth tokens, loading spinner, error handling, token refresh |

### 🌐 HTTP & State

| Topic | Key Concepts |
|---|---|
| [**HttpClient & RxJS** ⭐](./06-http-rxjs.md) | `switchMap`, `forkJoin`, `toSignal()`, `catchError`, `takeUntilDestroyed` |
| [**Reactive Forms** ⭐](./07-reactive-forms.md) | `FormBuilder`, typed forms, `FormArray`, `nonNullable`, validation |
| [**Custom Validators**](./18-custom-validators.md) | Sync validators, async validators, cross-field validation |

### 🔧 Advanced Features

| Topic | Key Concepts |
|---|---|
| [**SSR & Hydration**](./15-ssr-hydration.md) | Server rendering, `isPlatformBrowser()`, `afterNextRender()`, `withFetch()` |
| [**Error Handling**](./20-error-handling.md) | Global `ErrorHandler`, `catchError`, error boundaries |

### 🧪 Testing

| Topic | Key Concepts |
|---|---|
| [**Testing Components**](./21-testing-components.md) | `TestBed`, `ComponentFixture`, mocking, signal inputs, `fakeAsync` |
| [**Testing Services**](./22-testing-services.md) | `HttpTestingController`, service mocks, observable testing |

---

## ⭐ Most Important Files for Scalable Apps

If you only have time to master a subset, prioritize these:

1. **[Signals](./02-signals.md)** — Foundation of all modern Angular reactivity
2. **[Services & DI](./05-services-di.md)** — How Angular's entire architecture connects
3. **[Routing](./04-routing.md)** — Essential for multi-page SPAs
4. **[HttpClient & RxJS](./06-http-rxjs.md)** — Data fetching is in every app
5. **[Reactive Forms](./07-reactive-forms.md)** — Forms are ubiquitous in enterprise apps
6. **[Guards & Resolvers](./13-route-guards-resolvers.md)** — Security and UX
7. **[HTTP Interceptors](./19-http-interceptors.md)** — Cross-cutting HTTP concerns

---

## 🔑 Modern Angular Patterns Quick Reference

### Component Template

```typescript
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [/* pipes, directives, child components */],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`
})
export class ExampleComponent {
  // ✅ DI with inject()
  private service = inject(ExampleService);

  // ✅ Signal inputs (replace @Input())
  itemId = input.required<string>();

  // ✅ Signal outputs (replace @Output() EventEmitter)
  itemSelected = output<Item>();

  // ✅ Two-way binding (replace @Input() + @Output() XxxChange)
  value = model<string>('');

  // ✅ Local state
  items = signal<Item[]>([]);
  isLoading = signal(false);

  // ✅ Derived state
  filteredItems = computed(() =>
    this.items().filter(i => i.active)
  );

  // ✅ Side effects
  constructor() {
    effect(() => {
      console.log('itemId changed:', this.itemId());
    });
  }
}
```

### Service Template

```typescript
@Injectable({ providedIn: 'root' })
export class ExampleService {
  private http = inject(HttpClient);

  // Private writable state
  private _items = signal<Item[]>([]);

  // Public read-only signals
  readonly items = this._items.asReadonly();
  readonly count = computed(() => this._items().length);

  // HTTP method
  loadItems(): Observable<Item[]> {
    return this.http.get<Item[]>('/api/items').pipe(
      tap(items => this._items.set(items)),
      catchError(err => throwError(() => err))
    );
  }
}
```

### Route Configuration

```typescript
export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'protected',
    canActivate: [authGuard],
    loadChildren: () => import('./features/protected/protected.routes')
                          .then(m => m.PROTECTED_ROUTES)
  },
  { path: '**', loadComponent: () => import('./not-found.component').then(m => m.NotFoundComponent) }
];
```

### App Config Template

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    provideClientHydration(),  // For SSR projects
    // provideExperimentalZonelessChangeDetection()  // For zoneless projects
  ]
};
```

---

## 📐 Scalable Folder Structure

```
src/
├── app/
│   ├── core/                         # App-wide singletons
│   │   ├── guards/                   # Route guards
│   │   ├── interceptors/             # HTTP interceptors
│   │   ├── models/                   # TypeScript interfaces
│   │   ├── services/                 # Global services (AuthService, etc.)
│   │   └── tokens/                   # InjectionTokens
│   ├── features/                     # Lazy-loaded feature modules
│   │   ├── dashboard/
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── dashboard.component.ts
│   │   │   └── services/
│   │   └── products/
│   │       ├── products.routes.ts
│   │       ├── list/
│   │       ├── detail/
│   │       └── services/
│   ├── shared/                       # Reusable across features
│   │   ├── components/               # Dumb/presentational components
│   │   ├── directives/               # Custom directives
│   │   ├── pipes/                    # Custom pipes
│   │   └── validators/               # Custom form validators
│   ├── app.component.ts
│   ├── app.config.ts
│   └── app.routes.ts
├── environments/
│   ├── environment.ts                # Development
│   └── environment.production.ts    # Production
└── assets/
```

---

## 💡 Key Rules to Remember

1. **Always `track` in `@for`** — by unique ID, not `$index` (unless static data)
2. **`inject()` over constructor injection** — cleaner, works in functional guards
3. **`input.required<T>()` over `@Input()`** — type-safe, reactive signals
4. **`asReadonly()` for public signals in services** — prevent unauthorized mutations
5. **`takeUntilDestroyed()` for all subscriptions** — prevent memory leaks
6. **`loadComponent` / `loadChildren` for all routes** — code splitting
7. **`withComponentInputBinding()`** — auto-bind route params to component inputs
8. **`nonNullable: true` in FormBuilder** — `reset()` restores initial value, not null
9. **Never access `window`/`document` directly** — use `afterNextRender()` or `isPlatformBrowser()`
10. **`switchMap` for search, `exhaustMap` for form submit** — correct cancellation behavior
