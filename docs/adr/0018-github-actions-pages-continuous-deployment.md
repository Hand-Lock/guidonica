# ADR 0018: Continuous Deployment to GitHub Pages via GitHub Actions & Custom Domain Readiness

## Status
Accepted

## Date
2026-09-17

## Context
**Solfège Scroller** is a client-only static web application. To make the tool globally accessible for musicians and students without recurring hosting costs or complex server infrastructure, the application needs to be automatically compiled, tested, and published to **GitHub Pages** upon every commit pushed to the `main` branch. Furthermore, the deployment architecture must allow attaching a custom root domain (e.g., `https://solfegescroller.com`) in the future with zero code modifications or build adjustments.

Several architectural and platform constraints were addressed:
1. **Repository Subpath vs. Custom Apex Root Routing**:
   Standard GitHub Pages repositories are hosted under a path prefix: `https://<username>.github.io/<repository>/` (in this case, `/solfege-scroller/`). Vite's default base path is `'/'`, which results in `404 Not Found` errors when fetching scripts and stylesheets from the root instead of the repository subfolder. When a custom domain is attached later, the site will be served from the root `'/'`. The configuration must support both hosting scenarios without requiring separate build targets.
2. **VexFlow Asset Volume & Client Cache Invalidation**:
   The VexFlow 5 notation rendering engine bundles complete SMuFL font tables and geometry calculations, resulting in a minified bundle exceeding 1.1 MB. In an un-chunked build, any change to application logic forces every client to re-download this large payload.
3. **Jekyll Static Site Interference**:
   By default, GitHub Pages routes deployments through the Jekyll engine, which ignores files starting with underscores and can introduce unnecessary processing latency or MIME-type complications for modern Vite-bundled assets.
4. **Pipeline Efficiency & Secure Concurrency**:
   Pull requests must validate code correctness (strict TypeScript checking, unit tests, production build) without attempting deployment, while commits to `main` must atomically deploy using GitHub's modern OpenID Connect (OIDC) token architecture (`id-token: write`).

## Decisions & Implementation

### 1. Relative & Environment-Driven Base Path Resolution
In `vite.config.ts`, the base path was configured as:
```typescript
base: process.env.BASE_PATH || './'
```
- **Relative Path Resolution (`./`)**: Assets in `index.html` are linked relatively (e.g., `./assets/index-[hash].js`). When accessed via `https://hand-lock.github.io/solfege-scroller/`, the browser resolves assets relative to `/solfege-scroller/`. When later pointed to an apex custom domain (`https://solfegescroller.com/`), assets resolve relative to `/`.
- **Environment Override**: Should an explicit absolute CDN path ever be required in custom build environments, `BASE_PATH` can be passed without altering repository code.

### 2. Rollup Manual Chunk Partitioning for VexFlow
To optimize browser cache lifetimes and eliminate Vite's `> 500 kB` chunk warning, Rollup chunk splitting was configured:
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vexflow: ['vexflow'],
      },
    },
  },
}
```
This isolates VexFlow into `dist/assets/vexflow-[hash].js`. When application features or UI styles are updated, users' browsers retain the cached ~1.1 MB VexFlow library and only download the updated application bundle (~30 KB).

### 3. Jekyll Bypass (`.nojekyll`)
An empty `.nojekyll` file was placed in the `public/` directory (`public/.nojekyll`). Vite automatically copies root public files directly into `dist/`. The presence of `dist/.nojekyll` instructs GitHub Pages to bypass Jekyll processing completely and serve static assets directly from GitHub's CDN.

### 4. Unified GitHub Actions CI/CD Pipeline
The existing test-only workflow (`ci.yml`) was replaced by a single, comprehensive workflow (`.github/workflows/deploy.yml`):
- **Validation Job (`build-and-test`)**:
  - Runs on every `push` to `main` and `pull_request` to `main`.
  - Configures Node.js 22 (`pnpm@11.8.0` requires Node.js >= 22.13 due to its internal use of `node:sqlite`), pnpm 11.8.0 with frozen lockfile validation, and native pnpm store caching via `actions/setup-node@v4` with `cache: 'pnpm'`. (Manual shell script store extraction was deprecated as it caused empty cache paths).
  - Executes strict TypeScript typechecking (`pnpm run typecheck`), all 27 unit tests (`pnpm test`), and the production build (`pnpm run build`).
- **Pages Artifact & Deployment Job (`deploy`)**:
  - Gated to run only on `push` to `main` (or manual `workflow_dispatch`).
  - Uses `actions/upload-pages-artifact@v3` to bundle `dist/`.
  - Uses `actions/deploy-pages@v4` with `pages: write` and `id-token: write` permissions.
  - Sets concurrency group `'pages'` with `cancel-in-progress: false` to enforce strictly ordered, atomic deployments.

### 5. Custom Domain Migration Protocol
When a custom domain is acquired:
1. In DNS provider, configure standard GitHub Pages DNS records (`CNAME` pointing to `<username>.github.io` or `A` records to GitHub Pages IP addresses `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`).
2. In GitHub repository **Settings** > **Pages**, input the custom domain and enable **Enforce HTTPS**.
3. Zero code changes in Vite or GitHub Actions are required.

## Consequences

- **Zero Hosting Cost**: The sight-reading webapp is hosted globally on GitHub's fast CDN at zero financial cost.
- **Zero-Touch Continuous Deployment**: Every git commit pushed to `main` automatically runs verification tests and publishes updates within ~60 seconds.
- **Maximized Client Caching**: Separating VexFlow from application logic prevents re-downloading 1.1 MB on minor bug fixes or visual adjustments.
- **Smooth Custom Domain Onboarding**: Switching to a branded custom domain requires only DNS and GitHub UI configuration.
