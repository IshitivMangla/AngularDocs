# Angular: Custom Form Validators

> **Goal**: Build sync and async validators for production-grade forms — from simple field validations to server-side uniqueness checks.

---

## 📋 Table of Contents
1. [Sync vs Async Validators](#1-sync-vs-async-validators)
2. [Building Sync Validators](#2-building-sync-validators)
3. [Cross-Field Validators (Group Level)](#3-cross-field-validators)
4. [Building Async Validators](#4-building-async-validators)
5. [Displaying Validation Errors](#5-displaying-validation-errors)
6. [Validator Factories — Configurable Validators](#6-validator-factories)
7. [Composing Multiple Validators](#7-composing-multiple-validators)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Try It Yourself](#9-try-it-yourself)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. Sync vs Async Validators

| | Sync Validator | Async Validator |
|---|---|---|
| **When it runs** | Instantly on every keystroke | Only after all sync validators pass |
| **Returns** | `ValidationErrors \| null` | `Observable<ValidationErrors \| null>` or `Promise<...>` |
| **Use cases** | Format checks, range checks, cross-field checks | API calls (unique username, email exists) |
| **Performance** | Very fast | Debounce it! Expensive API calls |
| **Angular status** | Sets control to `INVALID` or `VALID` | Sets control to `PENDING` while running |

**The optimization**: Angular only runs async validators if ALL sync validators have already passed. This prevents sending API calls when the field is already invalid (e.g., empty field won't trigger the "is username taken?" API call).

---

## 2. Building Sync Validators

A sync validator is a **function that returns another function** (a `ValidatorFn`).

### Pattern: Standalone Validator Functions

```typescript
// src/app/shared/validators/custom-validators.ts
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// ✅ Validator 1: No whitespace allowed
export function noWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value ?? '';
    return /\s/.test(value) ? { noWhitespace: true } : null;
  };
}

// ✅ Validator 2: Strong password (uppercase, lowercase, number, special char)
export function strongPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = control.value ?? '';
    const errors: ValidationErrors = {};

    if (!/[A-Z]/.test(val)) errors['missingUppercase'] = true;
    if (!/[a-z]/.test(val)) errors['missingLowercase'] = true;
    if (!/[0-9]/.test(val)) errors['missingNumber'] = true;
    if (!/[!@#$%^&*]/.test(val)) errors['missingSpecial'] = true;

    return Object.keys(errors).length ? errors : null;
  };
}

// ✅ Validator 3: URL format validator
export function urlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value ?? '';
    if (!value) return null; // Don't validate empty (use Validators.required for that)

    try {
      new URL(value);
      return null; // Valid URL
    } catch {
      return { invalidUrl: true };
    }
  };
}

// ✅ Validator 4: Must be one of a list of allowed values
export function allowedValuesValidator(allowed: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;
    return allowed.includes(value)
      ? null
      : { notAllowed: { value, allowed } };
  };
}

// ✅ Validator 5: Date must be in the future
export const futureDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (!value) return null;
  const date = new Date(value);
  return date > new Date() ? null : { pastDate: true };
};
```

### Using Sync Validators

```typescript
const form = this.fb.group({
  username: ['', [
    Validators.required,
    Validators.minLength(3),
    noWhitespaceValidator()
  ]],
  password: ['', [
    Validators.required,
    Validators.minLength(8),
    strongPasswordValidator()
  ]],
  website: ['', [urlValidator()]],
  role: ['', [allowedValuesValidator(['admin', 'editor', 'viewer'])]],
  launchDate: ['', [Validators.required, futureDateValidator]],
});
```

---

## 3. Cross-Field Validators (Group Level)

Cross-field validators are attached to the `FormGroup`, not individual controls. They receive the entire group as the `AbstractControl`.

```typescript
// Validate that password === confirmPassword
export const passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password');
  const confirm = group.get('confirmPassword');

  if (!password || !confirm) return null;
  if (password.value !== confirm.value) {
    return { passwordsMismatch: true };
  }
  return null;
};

// Validate that end date is after start date
export const dateRangeValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const start = group.get('startDate');
  const end = group.get('endDate');

  if (!start?.value || !end?.value) return null;

  const startDate = new Date(start.value);
  const endDate = new Date(end.value);

  return startDate < endDate ? null : { invalidDateRange: true };
};
```

```typescript
// Applying group validators
const registrationForm = this.fb.group({
  password: ['', [Validators.required, Validators.minLength(8)]],
  confirmPassword: ['', Validators.required],
}, {
  validators: [passwordsMatchValidator]  // ← Applied to the GROUP
});

const bookingForm = this.fb.group({
  startDate: ['', Validators.required],
  endDate: ['', Validators.required],
}, {
  validators: [dateRangeValidator]
});
```

```html
<!-- Reading group-level errors -->
@if (form.errors?.['passwordsMismatch'] && form.get('confirmPassword')?.touched) {
  <p class="error">Passwords do not match!</p>
}
@if (form.errors?.['invalidDateRange']) {
  <p class="error">End date must be after start date!</p>
}
```

---

## 4. Building Async Validators

Async validators make HTTP calls. **Always debounce them** — otherwise you send a request for every single character typed.

### Injectable Async Validator Service

```typescript
// src/app/shared/validators/unique-username.validator.ts
import { Injectable, inject } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { switchMap, map, catchError, first } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class UniqueUsernameValidator {
  private http = inject(HttpClient);

  validate(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const username = control.value?.trim();

      // Don't validate empty or too-short values
      if (!username || username.length < 3) {
        return of(null);
      }

      // Debounce: wait 500ms after user stops typing before making API call
      return timer(500).pipe(
        switchMap(() =>
          this.http.get<{ exists: boolean }>(`/api/users/check-username?username=${username}`).pipe(
            map(response => response.exists ? { usernameTaken: true } : null),
            catchError(() => of(null))  // Network error → treat as valid (don't block user)
          )
        ),
        first()  // Complete the observable after one emission (prevents hanging)
      );
    };
  }
}

// Alternative: Standalone function approach (no injection)
export function uniqueEmailValidator(http: HttpClient): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const email = control.value?.trim();
    if (!email) return of(null);

    return timer(400).pipe(
      switchMap(() =>
        http.post<{ available: boolean }>('/api/auth/check-email', { email }).pipe(
          map(res => res.available ? null : { emailTaken: true }),
          catchError(() => of(null))
        )
      ),
      first()
    );
  };
}
```

### Using Async Validators

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { UniqueUsernameValidator } from './validators/unique-username.validator';
import { HttpClient } from '@angular/common/http';
import { uniqueEmailValidator } from './validators/unique-email.validator';

@Component({ ... })
export class RegistrationComponent {
  private fb = inject(FormBuilder);
  private usernameValidator = inject(UniqueUsernameValidator);
  private http = inject(HttpClient);

  form = this.fb.group({
    username: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(20)],  // Sync (2nd arg)
      [this.usernameValidator.validate()]                                          // Async (3rd arg)
    ],
    email: [
      '',
      [Validators.required, Validators.email],
      [uniqueEmailValidator(this.http)]  // Standalone function approach
    ]
  });
}
```

### Showing Async Validation State

```html
<div class="field">
  <label>Username</label>
  <input formControlName="username" placeholder="Choose a username">

  <!-- PENDING means async validator is running -->
  @if (form.controls.username.pending) {
    <span class="checking">⏳ Checking availability...</span>
  }

  @if (form.controls.username.invalid && form.controls.username.touched) {
    @if (form.controls.username.errors?.['required']) {
      <small class="error">Username is required</small>
    }
    @if (form.controls.username.errors?.['minlength']) {
      <small class="error">Minimum 3 characters</small>
    }
    @if (form.controls.username.errors?.['usernameTaken']) {
      <small class="error">❌ This username is already taken</small>
    }
  }

  @if (form.controls.username.valid && !form.controls.username.pending) {
    <span class="success">✅ Available!</span>
  }
</div>
```

---

## 5. Displaying Validation Errors

### Pattern: Error Component for Reusability

```typescript
// src/app/shared/components/field-error.component.ts
import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-field-error',
  standalone: true,
  template: `
    @if (control() && control()!.invalid && (control()!.touched || control()!.dirty)) {
      <div class="field-errors">
        @if (control()!.errors?.['required']) {
          <small>This field is required.</small>
        }
        @if (control()!.errors?.['email']) {
          <small>Please enter a valid email address.</small>
        }
        @if (control()!.errors?.['minlength']) {
          <small>Minimum {{ control()!.errors?.['minlength'].requiredLength }} characters.</small>
        }
        @if (control()!.errors?.['maxlength']) {
          <small>Maximum {{ control()!.errors?.['maxlength'].requiredLength }} characters.</small>
        }
        @if (control()!.errors?.['pattern']) {
          <small>Invalid format.</small>
        }
        @if (control()!.errors?.['noWhitespace']) {
          <small>No spaces allowed.</small>
        }
        @if (control()!.errors?.['usernameTaken']) {
          <small>This username is already taken.</small>
        }
        @if (control()!.errors?.['invalidUrl']) {
          <small>Please enter a valid URL (including https://).</small>
        }
      </div>
    }
  `
})
export class FieldErrorComponent {
  control = input<AbstractControl | null>(null);
}
```

```html
<!-- Usage — clean and consistent error display -->
<div class="field">
  <input formControlName="username">
  <app-field-error [control]="form.get('username')"></app-field-error>
</div>
```

---

## 6. Validator Factories

Validators can accept configuration parameters to make them reusable:

```typescript
// A range validator factory
export function rangeValidator(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = Number(control.value);
    if (isNaN(value)) return { invalidNumber: true };
    if (value < min || value > max) {
      return { outOfRange: { min, max, actual: value } };
    }
    return null;
  };
}

// A max file size validator factory
export function maxFileSizeValidator(maxMB: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const file = control.value as File | null;
    if (!file) return null;
    const maxBytes = maxMB * 1024 * 1024;
    return file.size > maxBytes ? { fileTooLarge: { maxMB, actualMB: (file.size / 1024 / 1024).toFixed(2) } } : null;
  };
}
```

```typescript
// Usage
const form = this.fb.group({
  age: ['', [Validators.required, rangeValidator(18, 120)]],
  discount: ['', [rangeValidator(0, 100)]],
  profilePicture: [null, [maxFileSizeValidator(5)]]  // Max 5MB
});
```

---

## 7. Composing Multiple Validators

```typescript
import { Validators, AbstractControl, ValidatorFn } from '@angular/forms';

// Compose multiple validators into one reusable set
export const USERNAME_VALIDATORS: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(3),
  Validators.maxLength(20),
  noWhitespaceValidator(),
  Validators.pattern(/^[a-zA-Z0-9_-]+$/)  // Only letters, numbers, underscore, hyphen
];

export const EMAIL_VALIDATORS: ValidatorFn[] = [
  Validators.required,
  Validators.email,
  Validators.maxLength(100)
];

// Use them consistently across your forms
const signupForm = this.fb.group({
  username: ['', USERNAME_VALIDATORS, [uniqueUsernameValidator]],
  email: ['', EMAIL_VALIDATORS, [uniqueEmailValidator]],
});

const profileForm = this.fb.group({
  username: ['', USERNAME_VALIDATORS],  // Same validators, no async check on profile edit
  email: ['', EMAIL_VALIDATORS],
});
```

---

## 8. Common Pitfalls

### Pitfall 1: Reading cross-field errors from the wrong place

```typescript
// ❌ Error is on the GROUP, not on the control!
form.get('confirmPassword')?.hasError('passwordsMismatch')  // Always null!

// ✅ Read group-level errors from the form itself
form.hasError('passwordsMismatch')
form.errors?.['passwordsMismatch']
```

### Pitfall 2: Async validator not debouncing

```typescript
// ❌ Sends HTTP request on every single keystroke!
return (control: AbstractControl) => {
  return this.http.get(`/api/check?val=${control.value}`).pipe(
    map(res => res.exists ? { taken: true } : null)
  );
};

// ✅ Always debounce async validators!
return (control: AbstractControl) => {
  return timer(500).pipe(
    switchMap(() => this.http.get(`/api/check?val=${control.value}`))
  );
};
```

### Pitfall 3: Forgetting to call `first()` on async validators

```typescript
// ❌ Observable never completes — Angular keeps the control in PENDING state!
return timer(500).pipe(
  switchMap(() => this.http.get('/api/check'))
);

// ✅ Always complete the observable with first() or take(1)
return timer(500).pipe(
  switchMap(() => this.http.get('/api/check')),
  first()  // Complete after first emission
);
```

### Pitfall 4: Showing async errors before the check completes

```html
<!-- ❌ Shows "Username taken" even while the check is still running! -->
@if (ctrl.errors?.['usernameTaken']) {
  <small>Username taken!</small>
}

<!-- ✅ Only show when not pending -->
@if (ctrl.errors?.['usernameTaken'] && !ctrl.pending) {
  <small>Username taken!</small>
}
```

---

## 9. Try It Yourself

Build a `creditCardValidator` that:
1. Accepts only 16-digit numbers (spaces optional: `4111 1111 1111 1111` is valid)
2. Validates using the Luhn algorithm (each second digit from right, doubled; if > 9, subtract 9; sum all; must be divisible by 10)
3. Returns `{ invalidCreditCard: true }` if invalid

<details>
<summary>✅ View Solution</summary>

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function creditCardValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').replace(/\s+/g, '');  // Remove spaces

    // Must be exactly 16 digits
    if (!/^\d{16}$/.test(value)) {
      return { invalidCreditCard: true };
    }

    // Luhn algorithm
    let sum = 0;
    let shouldDouble = false;

    for (let i = value.length - 1; i >= 0; i--) {
      let digit = parseInt(value[i]);

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0 ? null : { invalidCreditCard: true };
  };
}
```

Usage:
```typescript
const paymentForm = this.fb.group({
  cardNumber: ['', [Validators.required, creditCardValidator()]],
  expiryDate: ['', Validators.required],
  cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
});
```
</details>

---

## 10. Knowledge Check

1. In what position in `FormBuilder.group()`'s control array do async validators go?
2. If a field fails `Validators.required`, does the async validator still run?
3. What does Angular set a control's status to while an async validator is running?
4. Why should you always return `of(null)` in the `catchError` of an async validator?

<details>
<summary>✅ View Answers</summary>

1. Async validators go in the **third** array element: `['initialValue', [syncValidators], [asyncValidators]]`. This is different from sync validators which go in the second position.

2. **No.** Angular only runs async validators after ALL synchronous validators have passed. If `Validators.required` fails (empty field), the async validator is never called. This is an intentional optimization to prevent unnecessary API calls.

3. Angular sets the control's `status` to **`PENDING`**. You can check this with `control.pending` — useful for showing a "Checking..." spinner in the template. The status changes to `VALID` or `INVALID` once the async validator resolves.

4. If an async validator's HTTP request fails (network error, server error), and you don't catch the error, the control status stays `PENDING` indefinitely — blocking the user from submitting the form. Returning `of(null)` on error treats the validation as "passed" (graceful degradation), allowing the user to proceed. Alternatively, you could return a specific error like `of({ serverError: true })`.
</details>

---

*Next: [19 - HTTP Interceptors →](./19-http-interceptors.md)*
