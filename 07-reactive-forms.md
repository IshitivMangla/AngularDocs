# Angular: Reactive Forms

> **Goal**: Build complex, dynamic, and validated forms using Angular's Reactive Forms API — the industry standard for enterprise Angular applications.

---

## 📋 Table of Contents
1. [Template-Driven vs Reactive Forms](#1-template-driven-vs-reactive-forms)
2. [Building Blocks](#2-building-blocks)
3. [FormBuilder — Shorthand Syntax](#3-formbuilder)
4. [Typed Forms (Angular 14+)](#4-typed-forms)
5. [Validation](#5-validation)
6. [Nested FormGroups](#6-nested-formgroups)
7. [Dynamic Fields with FormArray](#7-dynamic-fields-with-formarray)
8. [Listening to Form Changes](#8-listening-to-form-changes)
9. [Form Submission Pattern](#9-form-submission-pattern)
10. [Resetting & Patching Forms](#10-resetting--patching-forms)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Try It Yourself](#12-try-it-yourself)
13. [Knowledge Check](#13-knowledge-check)

---

## 1. Template-Driven vs Reactive Forms

| Feature | Template-Driven | Reactive |
|---|---|---|
| Form defined in | HTML template | TypeScript class |
| Access to form state | `ngModel` directives | `FormControl`, `FormGroup` |
| Validation | HTML attributes | TypeScript validators |
| Testing | Hard (requires DOM) | Easy (pure TypeScript) |
| Dynamic fields | Complex | Simple (`FormArray`) |
| Use case | Simple forms (contact, login) | Complex/enterprise forms |

**Use Reactive Forms** for anything more complex than a simple login form.

---

## 2. Building Blocks

| Class | Purpose |
|---|---|
| `FormControl` | Tracks value and status of a single input (`<input>`, `<select>`, etc.) |
| `FormGroup` | Groups multiple `FormControl`s into a logical unit (e.g., an address section) |
| `FormArray` | A dynamic, ordered array of `FormControl`s or `FormGroup`s |
| `FormBuilder` | Shorthand factory service for creating the above |

### Status Values

Every control and group has a `status`:
- `VALID` — All validators pass
- `INVALID` — At least one validator fails
- `PENDING` — An async validator is running
- `DISABLED` — Control is disabled

---

## 3. FormBuilder

`FormBuilder` (`inject(FormBuilder)`) provides a shorthand syntax to avoid verbose `new FormControl()` calls.

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
      <input formControlName="email" type="email" placeholder="Email">
      <input formControlName="password" type="password" placeholder="Password">
      <button type="submit" [disabled]="loginForm.invalid">Login</button>
    </form>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  onSubmit() {
    if (this.loginForm.valid) {
      console.log(this.loginForm.value);  // { email: '...', password: '...' }
    }
  }
}
```

---

## 4. Typed Forms (Angular 14+)

Angular 14+ introduced **strictly typed reactive forms**. The compiler knows exactly what type each control's value is.

```typescript
import { FormControl, FormGroup, Validators } from '@angular/forms';

// ✅ Fully typed form — TypeScript knows each control's type
const profileForm = new FormGroup({
  name: new FormControl('', { validators: Validators.required, nonNullable: true }),
  age: new FormControl<number | null>(null),
  role: new FormControl<'admin' | 'editor' | 'viewer'>('viewer', { nonNullable: true }),
});

// TypeScript knows the return type!
const nameValue: string = profileForm.controls.name.value;        // string
const ageValue: number | null = profileForm.controls.age.value;   // number | null
const roleValue: 'admin' | 'editor' | 'viewer' = profileForm.controls.role.value;

// getRawValue() returns typed object!
const allValues = profileForm.getRawValue();
// Type: { name: string; age: number | null; role: 'admin' | 'editor' | 'viewer'; }
```

### `nonNullable: true`

By default, calling `form.reset()` sets control values to `null`. `nonNullable: true` makes `reset()` restore the initial value instead.

```typescript
// Without nonNullable: reset() → value becomes null
const name = new FormControl('John');
name.reset();
console.log(name.value);  // null

// With nonNullable: reset() → value becomes 'John' (initial value)
const name = new FormControl('John', { nonNullable: true });
name.reset();
console.log(name.value);  // 'John'
```

Using `FormBuilder.nonNullable`:

```typescript
private fb = inject(FormBuilder);

// All controls are automatically nonNullable!
form = this.fb.nonNullable.group({
  name: ['', Validators.required],
  email: ['', [Validators.required, Validators.email]],
  age: [18],
});
// form.controls.name.value is string (not string | null)
```

---

## 5. Validation

### Built-in Validators

```typescript
import { Validators } from '@angular/forms';

const form = this.fb.group({
  username: ['', [
    Validators.required,           // Must have a value
    Validators.minLength(3),       // At least 3 characters
    Validators.maxLength(20),      // No more than 20 characters
    Validators.pattern(/^[a-zA-Z0-9_]+$/)  // Only letters, numbers, underscores
  ]],
  email: ['', [Validators.required, Validators.email]],
  website: ['', Validators.pattern(/^https?:\/\/.+/)],
  age: [null, [Validators.required, Validators.min(18), Validators.max(100)]],
});
```

### Displaying Validation Errors in Template

```html
<form [formGroup]="form" (ngSubmit)="submit()">
  <div class="field">
    <label for="email">Email</label>
    <input
      id="email"
      formControlName="email"
      type="email"
      [class.invalid]="emailCtrl.invalid && emailCtrl.touched"
    >

    <!-- Show errors only after the user has interacted with the field -->
    @if (emailCtrl.invalid && emailCtrl.touched) {
      <div class="error-messages">
        @if (emailCtrl.errors?.['required']) {
          <small>Email is required.</small>
        }
        @if (emailCtrl.errors?.['email']) {
          <small>Please enter a valid email address.</small>
        }
      </div>
    }
  </div>

  <button type="submit" [disabled]="form.invalid">Submit</button>
</form>
```

```typescript
// Helper getter for cleaner template access
get emailCtrl() { return this.form.controls.email; }
```

### Cross-Field Validation (Group Validators)

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Custom group validator — checks if password and confirmPassword match
function passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
};

// Apply it at the group level
const form = this.fb.group({
  password: ['', [Validators.required, Validators.minLength(8)]],
  confirmPassword: ['', Validators.required]
}, {
  validators: passwordMatchValidator  // ← Applied to the GROUP, not individual controls
});
```

```html
@if (form.errors?.['passwordMismatch'] && form.get('confirmPassword')?.touched) {
  <p class="error">Passwords do not match!</p>
}
```

---

## 6. Nested FormGroups

Use nested `FormGroup` for logically grouped fields like addresses.

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="checkoutForm" (ngSubmit)="onSubmit()">
      <h3>Personal Info</h3>
      <input formControlName="fullName" placeholder="Full Name">
      <input formControlName="phone" placeholder="Phone">

      <!-- Nested group: prefix with formGroupName -->
      <h3>Shipping Address</h3>
      <div formGroupName="shippingAddress">
        <input formControlName="street" placeholder="Street">
        <input formControlName="city" placeholder="City">
        <input formControlName="state" placeholder="State">
        <input formControlName="zip" placeholder="ZIP Code">
      </div>

      <button type="submit" [disabled]="checkoutForm.invalid">Place Order</button>
    </form>
  `
})
export class CheckoutComponent {
  private fb = inject(FormBuilder);

  checkoutForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', Validators.required],
    shippingAddress: this.fb.group({  // ← Nested group
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', [Validators.required, Validators.minLength(2)]],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]]
    })
  });

  onSubmit() {
    if (this.checkoutForm.valid) {
      const order = this.checkoutForm.getRawValue();
      // TypeScript knows the exact shape: { fullName, phone, shippingAddress: { street, city, state, zip } }
      console.log('Order:', order);
    } else {
      this.checkoutForm.markAllAsTouched();  // Show all validation errors
    }
  }
}
```

### Accessing Nested Controls

```typescript
// ✅ Method 1: Strongly typed access (recommended)
this.checkoutForm.controls.shippingAddress.controls.city.value

// ✅ Method 2: get() with dot-notation path
this.checkoutForm.get('shippingAddress.city')?.value

// ❌ Method 3: Does NOT work — can't use dot-notation in bracket access
this.checkoutForm.controls['shippingAddress.city']  // undefined!
```

---

## 7. Dynamic Fields with FormArray

Use `FormArray` when the user can add or remove fields dynamically (e.g., "Add another phone number", "Add team member").

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-team-builder',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="teamForm" (ngSubmit)="submit()">
      <h2>Build Your Team</h2>
      <input formControlName="projectName" placeholder="Project Name">

      <h3>Team Members</h3>
      <div formArrayName="members">

        @for (member of members.controls; track $index; let i = $index) {
          <div [formGroupName]="i" class="member-row">
            <input formControlName="name" placeholder="Name">
            <input formControlName="email" placeholder="Email" type="email">

            <select formControlName="role">
              <option value="developer">Developer</option>
              <option value="designer">Designer</option>
              <option value="manager">Manager</option>
            </select>

            <!-- Prevent removing if only 1 member left -->
            <button type="button" (click)="removeMember(i)" [disabled]="members.length === 1">
              Remove
            </button>
          </div>
        }
      </div>

      <button type="button" (click)="addMember()">+ Add Member</button>
      <button type="submit" [disabled]="teamForm.invalid">Create Team</button>
    </form>
  `
})
export class TeamBuilderComponent {
  private fb = inject(FormBuilder);

  teamForm = this.fb.group({
    projectName: ['', Validators.required],
    members: this.fb.array([
      this.createMemberGroup()  // Start with one empty member
    ])
  });

  // Helper getter for type-safe access to the array
  get members(): FormArray {
    return this.teamForm.get('members') as FormArray;
  }

  // Factory function for a member FormGroup
  private createMemberGroup() {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['developer', Validators.required]
    });
  }

  addMember() {
    this.members.push(this.createMemberGroup());
  }

  removeMember(index: number) {
    this.members.removeAt(index);
  }

  submit() {
    if (this.teamForm.valid) {
      console.log('Team data:', this.teamForm.getRawValue());
    } else {
      this.teamForm.markAllAsTouched();
    }
  }
}
```

---

## 8. Listening to Form Changes

```typescript
import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({ ... })
export class ProductFilterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  filterForm = this.fb.group({
    search: [''],
    category: ['all'],
    minPrice: [0],
    maxPrice: [1000],
    inStockOnly: [false]
  });

  ngOnInit() {
    // React to the entire form changing
    this.filterForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(filters => {
      console.log('Filters changed:', filters);
      this.applyFilters(filters);
    });

    // React to a single control changing
    this.filterForm.controls.category.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(category => {
      // When category changes, reset price range
      this.filterForm.patchValue({ minPrice: 0, maxPrice: 1000 }, { emitEvent: false });
    });
  }

  applyFilters(filters: any) { /* ... */ }
}
```

---

## 9. Form Submission Pattern

```typescript
onSubmit() {
  // 1. Stop if form is invalid — show all errors
  if (this.form.invalid) {
    this.form.markAllAsTouched();  // Force-show all error messages
    return;
  }

  // 2. Disable to prevent double-submission
  this.form.disable();
  this.isSubmitting.set(true);

  // 3. Get all values (including disabled controls)
  const formData = this.form.getRawValue();

  // 4. Submit
  this.userService.save(formData).subscribe({
    next: (result) => {
      this.isSubmitting.set(false);
      this.form.enable();
      this.toastService.showSuccess('Saved successfully!');
      this.router.navigate(['/users', result.id]);
    },
    error: (err) => {
      this.isSubmitting.set(false);
      this.form.enable();
      this.error.set(err.message);
    }
  });
}
```

---

## 10. Resetting & Patching Forms

```typescript
// Reset entire form to initial/empty state
this.form.reset();                     // All controls → null (or initial if nonNullable)
this.form.reset({ name: '', email: '' });  // Reset with specific values

// Patch: Update only specific controls (rest unchanged)
this.form.patchValue({
  email: 'new@email.com',
  // Only 'email' is updated — other controls are untouched
});

// setValue: Update ALL controls — must provide a value for every control!
this.form.setValue({
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
  role: 'admin'
  // All fields required — omitting any throws an error!
});

// Disable/Enable specific controls
this.form.get('email')?.disable();  // Disable email field
this.form.get('email')?.enable();   // Re-enable it

// Set validators dynamically
this.form.get('phone')?.setValidators([Validators.required, Validators.pattern(/^\d{10}$/)]);
this.form.get('phone')?.updateValueAndValidity();  // Trigger re-validation
```

---

## 11. Common Pitfalls

### Pitfall 1: Forgetting `ReactiveFormsModule` in imports

```typescript
// ❌ Console error: "Can't bind to 'formGroup' since it isn't a known property of 'form'"
@Component({
  standalone: true,
  imports: [],  // Missing ReactiveFormsModule!
  template: `<form [formGroup]="form">...</form>`
})
```

### Pitfall 2: Using `.value` when controls are disabled

```typescript
// ❌ .value OMITS disabled controls!
const data = this.form.value;       // disabled controls are excluded

// ✅ .getRawValue() includes everything
const data = this.form.getRawValue();  // All controls included
```

### Pitfall 3: Accessing nested controls with bracket notation + dots

```typescript
// ❌ Returns undefined!
this.form.controls['address.city']

// ✅ Use .get() for nested dot-path access
this.form.get('address.city')?.value
```

### Pitfall 4: Not calling `markAllAsTouched()` on invalid submit

```typescript
// ❌ User clicks Submit — form is invalid — but NO error messages appear
// (because errors only show when the field is "touched")
if (this.form.invalid) return;

// ✅ Mark all touched so error messages show up!
if (this.form.invalid) {
  this.form.markAllAsTouched();
  return;
}
```

---

## 12. Try It Yourself

Build a **User Registration Form** with:
- `firstName` (required, min 2 chars)
- `lastName` (required)
- `email` (required, must be valid email)
- `password` (required, min 8 chars)
- `confirmPassword` (required, must match password)
- Show each field's error only when the user has touched it
- Disable the submit button when form is invalid
- On valid submit, log the form value and reset the form

<details>
<summary>✅ View Solution</summary>

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';

function passwordMatch(group: AbstractControl): ValidationErrors | null {
  const pwd = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pwd === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div class="field">
        <input formControlName="firstName" placeholder="First Name">
        @if (c('firstName').invalid && c('firstName').touched) {
          @if (c('firstName').errors?.['required']) { <small>First name is required</small> }
          @if (c('firstName').errors?.['minlength']) { <small>Minimum 2 characters</small> }
        }
      </div>

      <div class="field">
        <input formControlName="lastName" placeholder="Last Name">
        @if (c('lastName').invalid && c('lastName').touched) {
          <small>Last name is required</small>
        }
      </div>

      <div class="field">
        <input formControlName="email" type="email" placeholder="Email">
        @if (c('email').invalid && c('email').touched) {
          @if (c('email').errors?.['required']) { <small>Email is required</small> }
          @if (c('email').errors?.['email']) { <small>Must be a valid email</small> }
        }
      </div>

      <div class="field">
        <input formControlName="password" type="password" placeholder="Password">
        @if (c('password').invalid && c('password').touched) {
          @if (c('password').errors?.['minlength']) { <small>Minimum 8 characters</small> }
        }
      </div>

      <div class="field">
        <input formControlName="confirmPassword" type="password" placeholder="Confirm Password">
        @if (form.errors?.['mismatch'] && c('confirmPassword').touched) {
          <small>Passwords do not match!</small>
        }
      </div>

      <button type="submit" [disabled]="form.invalid">Register</button>
    </form>
  `
})
export class RegisterComponent {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordMatch });

  c(name: string) { return this.form.get(name)!; }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    console.log('Registered:', this.form.getRawValue());
    this.form.reset();
  }
}
```
</details>

---

## 13. Knowledge Check

1. What is the difference between `.value` and `.getRawValue()`?
2. How do you apply validation across two fields (e.g., passwords match)?
3. When does `markAllAsTouched()` need to be called?
4. What is the `nonNullable` option on `FormControl` used for?
5. Can you have a `FormArray` of `FormGroup`s? Give a use case.

<details>
<summary>✅ View Answers</summary>

1. `.value` returns only the values of **enabled** controls. **Disabled** controls are excluded. `.getRawValue()` returns all controls' values regardless of disabled status. Use `.getRawValue()` when you need all data at form submission.

2. Apply a **group-level validator** using the second argument to `this.fb.group({...}, { validators: myGroupValidator })`. Group validators receive the entire `AbstractControl` and can access any control via `.get('controlName')`.

3. Call `markAllAsTouched()` on form submission when the form is invalid. Angular only shows validation error messages for "touched" controls (controls the user has interacted with). Calling this forces all error messages to appear so the user knows exactly what needs to be fixed.

4. By default, calling `form.reset()` sets all control values to `null`. With `nonNullable: true`, `reset()` restores the control to its **initial value** (the value provided when creating the `FormControl`). This is useful for forms that need to be reset to a default state rather than blank.

5. Yes — a `FormArray` can contain `FormGroup` instances. Use case: "Add another phone number" where each entry is a group of `{ type: 'mobile' | 'home', number: '...' }`. Or a team builder where each member has `{ name, email, role }`.
</details>

---

*Next: [08 - Component Communication →](./08-component-communication.md)*
