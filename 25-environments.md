# Angular: Environments & Multi-Stage Configurations

> **Goal**: Master multi-environment configuration in Angular — managing local, staging, and production API endpoints, feature flags, and deployment settings safely.

---

## 📋 Table of Contents
1. [Why Environment Configurations?](#1-why-environment-configurations)
2. [How File Replacement Works](#2-how-file-replacement-works)
3. [Setting Up Environments](#3-setting-up-environments)
4. [Consuming Environment Variables](#4-consuming-environment-variables)
5. [Adding a Custom Staging Environment](#5-adding-a-custom-staging-environment)
6. [Feature Flags via Environments](#6-feature-flags-via-environments)
7. [Security Warning: Client-Side Secrets](#7-security-warning-client-side-secrets)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Try It Yourself](#9-try-it-yourself)
10. [Knowledge Check](#10-knowledge-check)

---

## 1. Why Environment Configurations?

Real-world applications connect to different resources depending on where they run:

```
Developer Laptop  → http://localhost:3000/api        (Development)
QA / Staging      → https://staging-api.app.com/v1   (Staging)
Production Server → https://api.app.com/v1           (Production)
```

Hardcoding URLs in your services breaks builds and risks accidentally pointing production users at localhost or test databases.

---

## 2. How File Replacement Works

Angular swaps environment files **at build time**:

```
Build Command: ng build --configuration production

Angular CLI reads angular.json fileReplacements:
src/environments/environment.ts  ◄── REPLACED BY ── src/environments/environment.production.ts

Your application code ALWAYS imports:
import { environment } from './environments/environment';

At compile time, esbuild/Webpack substitutes the production file content!
```

---

## 3. Setting Up Environments

Generate environment files if they don't exist:

```bash
ng generate environments
```

This creates:
- `src/environments/environment.ts` (Development default)
- `src/environments/environment.development.ts`

### `src/environments/environment.ts` (Development Default)

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api/v1',
  appName: 'My Enterprise App (DEV)',
  enableAnalytics: false,
  logLevel: 'debug',
  stripePublicKey: 'pk_test_1234567890'
};
```

### `src/environments/environment.production.ts` (Production)

```typescript
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.myenterpriseapp.com/v1',
  appName: 'My Enterprise App',
  enableAnalytics: true,
  logLevel: 'error',
  stripePublicKey: 'pk_live_0987654321'
};
```

---

## 4. Consuming Environment Variables

```typescript
// src/app/core/services/api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// ✅ GOLDEN RULE: Always import the BASE environment file!
// NEVER import environment.production.ts directly!
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Dynamic API URL based on current environment configuration
  private readonly baseUrl = environment.apiBaseUrl;

  getUsers() {
    return this.http.get(`${this.baseUrl}/users`);
  }

  logDebug(message: string) {
    if (environment.logLevel === 'debug') {
      console.log(`[DEBUG] ${message}`);
    }
  }
}
```

---

## 5. Adding a Custom Staging Environment

### Step 1: Create `src/environments/environment.staging.ts`

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'https://staging-api.myenterpriseapp.com/v1',
  appName: 'My Enterprise App (STAGING)',
  enableAnalytics: true,
  logLevel: 'info',
  stripePublicKey: 'pk_test_staging1234'
};
```

### Step 2: Configure `angular.json`

```json
"architect": {
  "build": {
    "configurations": {
      "production": {
        "fileReplacements": [
          {
            "replace": "src/environments/environment.ts",
            "with": "src/environments/environment.production.ts"
          }
        ]
      },
      "staging": {
        "fileReplacements": [
          {
            "replace": "src/environments/environment.ts",
            "with": "src/environments/environment.staging.ts"
          }
        ]
      }
    }
  }
}
```

### Step 3: Build using the configuration

```bash
ng build --configuration staging
```

---

## 6. Feature Flags via Environments

Environment files are a simple way to toggle features on or off per environment:

```typescript
export const environment = {
  production: false,
  features: {
    darkMode: true,
    newCheckoutFlow: true,
    betaDashboard: false
  }
};
```

```typescript
// Guard using feature flag
export const betaDashboardGuard: CanMatchFn = () => {
  return environment.features.betaDashboard;
};
```

---

## 7. Security Warning: Client-Side Secrets

> ⚠️ **CRITICAL SECURITY RULE**: Environment files are compiled directly into the JavaScript bundle sent to the user's browser.

**NEVER put secrets in environment files**:
- ❌ Database credentials / Connection strings
- ❌ API Secret keys (Stripe Secret, AWS Secret Key)
- ❌ Private JWT signing keys

Anyone can open Chrome DevTools, inspect `main.js`, and see all values inside `environment.ts`!

---

## 8. Common Pitfalls

### Pitfall 1: Importing the environment file directly

```typescript
// ❌ Direct import breaks file replacement!
import { environment } from '../../environments/environment.production';

// ✅ Always import base file
import { environment } from '../../environments/environment';
```

### Pitfall 2: Different interfaces across environment files

```typescript
// ❌ If environment.production.ts has keys that environment.ts doesn't,
// TypeScript won't catch it because it compiles against environment.ts!

// ✅ Create a shared interface to ensure exact property matching
export interface AppEnvironment {
  production: boolean;
  apiBaseUrl: string;
  enableAnalytics: boolean;
}

export const environment: AppEnvironment = { /* ... */ };
```

---

## 9. Try It Yourself

Create an `EnvironmentService` that:
1. Exposes an `isProduction` signal
2. Exposes a `buildApiUrl(path: string)` method that appends the given path to `environment.apiBaseUrl`

<details>
<summary>✅ View Solution</summary>

```typescript
import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  readonly isProduction = signal(environment.production);
  readonly appName = signal(environment.appName);

  buildApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${environment.apiBaseUrl}${cleanPath}`;
  }
}
```
</details>

---

## 10. Knowledge Check

1. When does environment file replacement happen: during build time or runtime?
2. What happens if you import `environment.production.ts` directly in a service?
3. Why are environment files unsafe for storing database passwords or API secret keys?
4. How do you trigger a build using a custom `staging` configuration?

<details>
<summary>✅ View Answers</summary>

1. Environment file replacement happens at **build time** (during `ng build` / `ng serve`). The Angular CLI bundler physically substitutes the content of `environment.ts` with the target environment file specified in `angular.json`.

2. The file replacement mechanism in `angular.json` will be bypassed. The app will ALWAYS use the production environment values, even during local development (`ng serve`), breaking local testing.

3. Environment files are compiled into public JavaScript bundle files (`main.js`) that are downloaded by the user's browser. Anyone can inspect browser source files and read any secret keys stored there.

4. Run `ng build --configuration staging` (or `ng serve --configuration staging` for dev server).
</details>

---

*Next: [00 - Master Index →](./00-index.md)*
