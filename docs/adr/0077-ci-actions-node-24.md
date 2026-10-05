# 0077. CI Actions on Node 24 Releases

- **Status**: Accepted (amends [0018](0018-github-actions-pages-continuous-deployment.md), [0068](0068-project-email-guidonica-it-migadu.md) and [0069](0069-security-privacy-audit.md))
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Every deploy showed the annotation "Node.js 20 is deprecated". Four of the actions pinned in [ADR 0069](0069-security-privacy-audit.md) §2 were built for Node 20, and GitHub now forces them onto Node 24. The fix is to move each pin to a release built for Node 24, without changing what the workflows do.

## Decision

Each action moves to the latest release whose `action.yml` declares `using: node24`. It stays pinned to a full commit SHA, resolved with the ADR 0069 recipe (`gh api repos/<r>/git/ref/tags/<tag>`, dereferencing annotated tags).

| Action | Was | Now | Runtime | Commit SHA |
| --- | --- | --- | --- | --- |
| `actions/checkout` (`deploy.yml`, `dco.yml`) | v4.4.0 | v7.0.1 | node24 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `pnpm/action-setup` | v4.3.0 | v6.1.0 | node24 | `ea17c68df8912ef543352723c149a84f56e3d413` |
| `actions/setup-node` | v4.4.0 | v7.0.0 | node24 | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/upload-pages-artifact` | v3.0.1 | v5.0.0 | composite; runs `upload-artifact` v7.0.0 (node24) | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/deploy-pages` | v4.0.5 | v5.0.1 | node24 | `368f82528645a54fb793d4d04e342629a3f51346` |

### Breaking changes and how each is handled

- **`checkout` v6+** keeps the persisted credentials in a separate file instead of `.git/config`. Neither workflow uses git credentials after checkout, so nothing changes. `dco.yml` keeps `fetch-depth: 0`.
- **`setup-node` v5+** turns on automatic caching only for npm. `deploy.yml` already sets `cache: 'pnpm'` explicitly, so the pnpm store is still cached.
- **`pnpm/action-setup` v6** adds pnpm 11/12 support. `version: 11.8.0` still matches `packageManager` in `package.json`.
- **`upload-pages-artifact` v4+** excludes dotfiles unless `include-hidden-files` is `'true'`. Without it, `/.well-known/security.txt` ([ADR 0068](0068-project-email-guidonica-it-migadu.md)) would silently disappear from the site. The upload step now sets `include-hidden-files: true`. `.git` and `.github` stay excluded either way.

## Consequences

- The Node 20 deprecation annotation is gone from deploy runs, and the build, test and deploy steps behave exactly as before.
- ADR 0068's maintenance warning about moving to `upload-pages-artifact` v4 is resolved. Any later bump of that action must keep `include-hidden-files: true`.
- The pin table in ADR 0069 §2 is superseded by the table above. The policy itself (full SHAs, version comment, least-privilege permissions) is unchanged.
- ADR 0018's mentions of `upload-pages-artifact@v3` and `deploy-pages@v4` now read v5.
