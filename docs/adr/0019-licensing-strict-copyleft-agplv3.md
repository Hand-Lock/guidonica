# ADR 0019: Strict Copyleft Open-Source Licensing (GNU AGPLv3)

## Status
Accepted

## Date
2026-09-17

## Context
**Guidonica** is an open-source, client-only web application designed for sight-reading and solfège practice. To protect the project's long-term educational mission, prevent proprietary commercial enclosement, and ensure all future enhancements remain free and open to the music education community, the repository required a **strict copyleft license**.

Several open-source licensing archetypes were evaluated:
1. **Permissive Licenses (MIT, Apache 2.0, BSD)**:
   - Permissive licenses allow downstream developers and commercial entities to take the source code, modify it, compile it into closed-source proprietary products, or bundle it into commercial paid platforms without returning source code improvements to the public.
2. **Weak Copyleft Licenses (LGPLv3, MPL 2.0)**:
   - Weak copyleft licenses only require sharing modifications made to the library or file itself. They allow proprietary applications to dynamically link or wrap the code without releasing the surrounding application's source code.
3. **Standard Strong Copyleft (GPLv3)**:
   - GNU General Public License v3 mandates source code reciprocity whenever a modified binary or executable is *distributed* to users.
   - However, for web applications, SaaS platforms, and cloud-hosted tools, traditional GPLv3 suffers from the **Application Service Provider (ASP) / SaaS loophole**: hosting a modified service on a server and granting users remote access over a network is legally not considered "distribution" or "conveyance" in many jurisdictions. A third party could fork Guidonica, add substantial proprietary features, host it commercially online, and legally withhold their source code modifications from students and teachers.
4. **Network Copyleft (GNU AGPLv3 - GNU Affero General Public License v3.0 or later)**:
   - Specifically engineered by the Free Software Foundation to close the SaaS loophole via **Section 13 ("Remote Network Interaction")**.
   - Requires that any entity modifying the software and offering it to users over a computer network must make the complete Corresponding Source code of the modified version available to all network users free of charge.

## Decisions & Implementation

### 1. License Selection: `AGPL-3.0-or-later`
The project is licensed under the **GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`)**:
- Full verbatim FSF license text placed in the repository root [`LICENSE`](../../LICENSE).
- Standard FSF preamble, warranty disclaimers, and copyright attribution assigned to **A. C. Lo Cascio** (`Copyright (C) 2026 A. C. Lo Cascio`).
- `"or later"` designation enables perpetual forward compatibility with any future revisions published by the Free Software Foundation.

### 2. Upstream Dependency Compatibility
The sole runtime dependency of Guidonica is **VexFlow** (`vexflow: ^5.0.0`).
- VexFlow is licensed under the permissive **MIT License**.
- The MIT license explicitly permits sublicensing, modification, and incorporation into copyleft projects, including GPLv3 and AGPLv3.
- All devDependencies (`vite`, `vitest`, `happy-dom`, `typescript`) are build/test tooling governed by MIT and Apache-2.0 licenses, creating zero runtime legal friction.

### 3. Metadata & Identification
- `package.json`: Updated `"license"` field to `"AGPL-3.0-or-later"` and `"author"` field to `"A. C. Lo Cascio"`.
- `README.md`: Added official AGPLv3 badge, updated the `## License` section with explicit copyleft terms, copyright statement, and third-party VexFlow acknowledgement.
- Source files: Added SPDX license identifier header (`// SPDX-License-Identifier: AGPL-3.0-or-later`) to entrypoints.

### 4. AGPLv3 Section 13 Network Interaction Compliance
To fulfill the specific remote network interaction recommendation in Section 13 of the AGPLv3:
- Added a permanent, clean link in the web user interface footer (`shortcuts-hint` in `index.html`):
  ```html
  <span class="footer-source"><a href="https://github.com/Hand-Lock/guidonica" target="_blank" rel="noopener noreferrer" title="View Source Code on GitHub (AGPL-3.0-or-later)">AGPL-3.0 Source</a></span>
  ```
- Styled with high-contrast accessibility in both light and dark themes in `src/style.css`.
- Ensures any user practicing sight-reading on any hosted instance can directly access the corresponding source code.

## Consequences

### Positive
- **Guaranteed Open Source Perpetuity**: Ensures that any enhancements, pedagogical algorithms, or new notation features developed by third parties must remain open-source under AGPL-3.0.
- **Closure of SaaS Loophole**: Prevents edtech companies from turning Guidonica into a closed-source SaaS product without contributing improvements back to the community.
- **Clear Legal Authorship**: Vesting copyright under real name `A. C. Lo Cascio` establishes unambiguous legal ownership under the Berne Convention and international copyright treaties.
- **Zero Runtime Overhead**: Compliance is fully metadata-driven and static; no performance penalty is imposed on the 60/120 FPS canvas blitting loop.

### Considerations
- Commercial organizations that refuse to use AGPL software internally or externally will not be able to embed Guidonica into proprietary closed-source applications without releasing their code under AGPLv3. This is the desired reciprocal behavior of strict copyleft.
