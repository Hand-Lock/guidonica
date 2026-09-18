# 31. Custom Domain Infrastructure (guidonica.it) via Register.it and GitHub Pages

Date: 2026-09-18

## Status
Accepted

## Context
Following the formal project rebranding to **Guidonica** (ADR 0021), the domain **`guidonica.it`** was acquired on Register.it to serve as the permanent, authoritative home for the web application.

Hosting remains strictly client-only and serverless on **GitHub Pages**, supported by the automated GitHub Actions CI/CD deployment pipeline established in ADR 0018.

Connecting an external custom apex domain (`guidonica.it`) and subdomain (`www.guidonica.it`) from an Italian registrar (Register.it) to GitHub Pages requires:
1. Converting Register.it's default DNS configuration (which includes parking IPs, default webmail MX, SPF, SRV, and FTP records) into an ultra-minimal, bloat-free zone dedicated purely to static web delivery.
2. Directing apex traffic to GitHub Pages Anycast edge servers.
3. Directing `www` subdomain traffic to GitHub Pages routing infrastructure with automatic HTTPS redirection.
4. Integrating a persistent `CNAME` declaration into Vite's production build pipeline so deployments via GitHub Actions continuously retain the custom domain binding.

---

## Decisions

### 1. Minimal Anycast DNS Architecture on Register.it
All default parking and email records (MX, SPF TXT, autodiscover SRV, authsmtp/autoconfig/ftp CNAMEs) were pruned from the Register.it zone.

The authoritative DNS zone was reduced to:
- **Apex Domain (`guidonica.it`)**:
  Mapped across GitHub's four distributed Anycast IP addresses for high availability and low latency:
  - `A 185.199.108.153`
  - `A 185.199.109.153`
  - `A 185.199.110.153`
  - `A 185.199.111.153`
  *(TTL: 900 seconds / 15 minutes)*
- **Subdomain (`www.guidonica.it`)**:
  Mapped via standard canonical alias:
  - `CNAME hand-lock.github.io.`
  GitHub Pages automatically handles redirecting `https://www.guidonica.it` to `https://guidonica.it`.

### 2. Automated Static CNAME Build Distribution
In Vite projects, files placed in the `public/` directory are copied unmodified into the root of `dist/` upon executing `vite build`.

A static declaration file was added at `public/CNAME`:
```text
guidonica.it
```
When GitHub Actions workflow (`.github/workflows/deploy.yml`) executes `pnpm run build` and runs `actions/upload-pages-artifact@v3` targeting `./dist`, the resulting deployment bundle contains `dist/CNAME`. This instructs GitHub Pages to maintain `guidonica.it` as the active custom domain without relying solely on ephemeral repository UI settings.

### 3. Automatic TLS Provisioning & HTTPS Enforcement
GitHub Pages automatically provisions a Let's Encrypt TLS certificate for `guidonica.it` and `www.guidonica.it` once DNS Anycast propagation is verified. Strict HTTPS enforcement is enabled to ensure all client traffic is encrypted.

---

## Consequences

- **Authoritative Identity**: The application is globally reachable via clean, branded Italian domain `https://guidonica.it`.
- **Zero Hosting & Certificate Costs**: Retains zero operational overhead and zero recurring server costs.
- **Continuous Deployment Continuity**: Commits pushed to `origin/main` continue to build and publish automatically with zero custom domain disruption.
- **Preserved Relative Asset Paths**: Thanks to `base: './'` in `vite.config.ts` (ADR 0018), scripts, stylesheets, and font glyphs resolve seamlessly at the root domain (`/`).
