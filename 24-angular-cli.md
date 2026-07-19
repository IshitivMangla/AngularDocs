# Angular: Angular CLI — Essential Commands

> **Goal**: Master the Angular CLI to scaffold, develop, build, test, and maintain Angular applications efficiently and consistently.

---

## 📋 Table of Contents
1. [How the CLI Works](#1-how-the-cli-works)
2. [Project Commands](#2-project-commands)
3. [Code Generation (`ng generate`)](#3-code-generation)
4. [Serving & Building](#4-serving--building)
5. [Testing Commands](#5-testing-commands)
6. [Updating Angular](#6-updating-angular)
7. [Key Flags Reference](#7-key-flags-reference)
8. [Angular.json — Key Sections](#8-angularjson)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Quick Reference Card](#10-quick-reference-card)

---

## 1. How the CLI Works

The CLI reads `angular.json` in your workspace root. This file defines:
- **Architect targets**: `build`, `serve`, `test`, `lint`, `extract-i18n`
- **Configurations**: `development`, `production`, `staging`
- **File replacements**: How environment files are swapped per build
- **Assets**: Which files get copied to the output (`dist/`) folder
- **Styles/Scripts**: Global CSS files and scripts to include in every page

The CLI uses **esbuild** (default in Angular 17+) for extremely fast builds — typically 3-5x faster than the old Webpack builder.

---

## 2. Project Commands

```bash
# Create a new Angular project
ng new my-app

# With flags:
ng new my-app \
  --style=scss \          # Use SCSS instead of CSS
  --routing=true \         # Generate app.routes.ts
  --standalone=true \      # Use standalone components (default in modern Angular)
  --ssr=true              # Include SSR from the start

# Check Angular version
ng version
ng v

# Get help for any command
ng help
ng generate --help
ng build --help
```

---

## 3. Code Generation

```bash
# === COMPONENTS ===
ng generate component features/users/user-list
ng g c features/users/user-list                         # Shorthand

# Generate with inline template and styles (single file)
ng g c shared/components/loading-spinner --inline-template --inline-style

# Without test file
ng g c pages/about --skip-tests

# Generate in a specific path (relative to src/app)
ng g c features/products/list/products-list

# === SERVICES ===
ng g service core/services/auth
ng g s core/services/user

# === GUARDS ===
ng g guard core/guards/auth
# CLI prompts: CanActivate? CanDeactivate? CanMatch?

# === DIRECTIVES ===
ng g directive shared/directives/tooltip
ng g d shared/directives/highlight

# === PIPES ===
ng g pipe shared/pipes/truncate
ng g p shared/pipes/time-ago

# === INTERFACES / CLASSES ===
ng g interface core/models/user
ng g class core/models/product

# === ENVIRONMENTS ===
ng generate environments     # Creates src/environments/ folder

# === ENTIRE FEATURE (schematic) ===
# Some teams use custom schematics to scaffold entire features at once
```

### Generated File Structure

When you run `ng g c features/products/detail/product-detail`, it creates:
```
src/app/features/products/detail/
├── product-detail.component.ts      ← TypeScript class
├── product-detail.component.html    ← Template (unless inline)
├── product-detail.component.scss    ← Styles (unless inline)
└── product-detail.component.spec.ts ← Tests (unless --skip-tests)
```

---

## 4. Serving & Building

```bash
# === DEVELOPMENT SERVER ===
ng serve                          # Start dev server at localhost:4200
ng serve --open                   # Open browser automatically
ng serve -o --port 8080           # Open on port 8080
ng serve --host 0.0.0.0           # Expose to local network (mobile testing)
ng serve --ssl                    # Serve over HTTPS

# Using a specific configuration
ng serve --configuration staging  # Uses staging environment + build settings

# === PRODUCTION BUILDS ===
ng build                          # Build with production defaults (AOT, minification, etc.)
ng build --configuration production  # Explicit (same as default)
ng build --configuration staging     # Staging build

# === ANALYZE BUNDLE SIZE ===
# Install: npm install -g webpack-bundle-analyzer
ng build --stats-json
npx webpack-bundle-analyzer dist/my-app/stats.json
```

### What `ng build` Does

- **AOT Compilation**: Compiles templates at build time (not runtime) — faster app startup
- **Tree Shaking**: Removes unused code (including unused Angular modules)
- **Minification**: Shrinks JS/CSS by removing whitespace, shortening names
- **Code Splitting**: Lazy-loaded routes become separate chunks
- **Source Maps**: (Development only) Maps minified code back to TypeScript

---

## 5. Testing Commands

```bash
# Run unit tests (Karma + Jasmine by default)
ng test
ng test --watch=false   # Run once without file watcher
ng test --code-coverage # Generate coverage report in coverage/

# Run end-to-end tests (requires separate e2e setup, e.g., Cypress, Playwright)
ng e2e

# Check code style
ng lint

# Run tests for a specific file
ng test --include='**/*.spec.ts' --include='**/user.service.spec.ts'
```

### Switching to Jest (Faster, More Popular)

```bash
ng add jest-preset-angular
# OR
npm install jest jest-preset-angular --save-dev
```

---

## 6. Updating Angular

```bash
# 1. See what can be updated
ng update

# 2. Update to the next major version
ng update @angular/core @angular/cli

# 3. For cross-version jumps (e.g., v16 → v19)
ng update @angular/core@19 @angular/cli@19

# 4. Update all packages to their latest compatible versions
ng update @angular/cdk @angular/material @ngrx/store

# 5. Check for outdated packages (npm command)
npm outdated
```

The `ng update` command also runs **automatic code migrations** — it rewrites your source code to fix breaking changes between versions!

---

## 7. Key Flags Reference

| Flag | Command | Description |
|---|---|---|
| `--dry-run` | `ng g ...` | Preview what would be generated without creating files |
| `--skip-tests` | `ng g ...` | Don't generate `.spec.ts` test file |
| `--inline-template` | `ng g c ...` | Put template inside the component TS file |
| `--inline-style` | `ng g c ...` | Put styles inside the component TS file |
| `--flat` | `ng g c ...` | Don't create a subdirectory |
| `--standalone` | `ng g c ...` | Standalone component (default in Angular 19+) |
| `-o` / `--open` | `ng serve` | Automatically open browser |
| `--port` | `ng serve` | Serve on a different port |
| `--watch=false` | `ng test` | Run tests once without watching |
| `--configuration` | `ng build/serve` | Use a specific build configuration |
| `--stats-json` | `ng build` | Output bundle stats for analysis |

---

## 8. Angular.json

```json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "options": {
            "outputPath": "dist/my-app",          // Where built files go
            "index": "src/index.html",             // HTML shell
            "browser": "src/main.ts",              // Entry point
            "polyfills": ["zone.js"],              // Polyfills (remove for zoneless)
            "assets": [
              "src/favicon.ico",
              "src/assets"                         // Copied to dist/ as-is
            ],
            "styles": [
              "src/styles.scss"                    // Global CSS/SCSS
            ],
            "scripts": []                          // Global JS scripts
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kB",       // Warn if bundle > 500KB
                  "maximumError": "1MB"            // Fail build if bundle > 1MB
                }
              ],
              "outputHashing": "all"               // Adds hash to filenames for cache busting
            },
            "staging": {
              "fileReplacements": [{
                "replace": "src/environments/environment.ts",
                "with": "src/environments/environment.staging.ts"
              }]
            }
          }
        }
      }
    }
  }
}
```

---

## 9. Common Pitfalls

### Pitfall 1: Generating in the wrong directory

```bash
# ❌ Creates at src/app/user-list (root level)
ng g c user-list

# ✅ Creates at src/app/features/users/user-list
ng g c features/users/user-list
```

### Pitfall 2: Using `ng serve` in production

```bash
# ❌ ng serve is a development-only server — not secure, not optimized!
ng serve  # For production? NEVER!

# ✅ Build first, then serve the static files with a real server
ng build
# Then use: nginx, express, firebase serve, netlify serve, etc.
```

### Pitfall 3: Not using `--dry-run` before generating

```bash
# ✅ Preview what will be generated BEFORE actually creating files
ng g c features/users/user-detail --dry-run
# Shows all files that WOULD be created, without touching the filesystem
```

---

## 10. Quick Reference Card

```bash
# Project
ng new my-app                           # Create new project
ng serve -o                             # Start dev server + open browser

# Generate
ng g c features/dash/dashboard          # Component
ng g s core/services/auth               # Service
ng g g core/guards/auth                 # Guard
ng g d shared/directives/tooltip        # Directive
ng g p shared/pipes/truncate            # Pipe
ng g i core/models/user                 # Interface
ng generate environments                # Environments folder

# Build & Test
ng build                                # Production build → dist/
ng test                                 # Run unit tests
ng test --watch=false --code-coverage   # Coverage report
ng lint                                 # Run linter

# Maintenance
ng update                               # Show available updates
ng update @angular/core @angular/cli    # Update Angular
ng add @angular/material                # Add Material Design
ng add @angular/pwa                     # Add PWA support
ng add @angular/ssr                     # Add SSR
```

---

*Next: [25 - Environments →](./25-environments.md)*
