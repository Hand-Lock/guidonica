# Contributing to Guidonica

Thank you for helping. Guidonica is free sight-reading practice, and contributions of every size are welcome:

- **Issues**: bug reports (browser, device, steps to reproduce) and ideas for practice features.
- **Translations**: new languages or fixes to the existing ones in `src/i18n/locales/`.
- **Code**: fixes and features. For anything large, open an issue first so we can agree on the approach.

To get a working copy, follow the [Quickstart](README.md#quickstart--local-development) in the README.

## Before you open a pull request

The full rules are in [`AGENTS.md`](AGENTS.md). In short:

- `pnpm typecheck`, `pnpm test` and `pnpm build` all pass.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `chore:`).
- Architectural changes come with a new or amended ADR in [`docs/adr/`](docs/adr/README.md), registered in its index.
- New or changed UI text is updated in **every** locale; `en.ts` is the reference, and the compiler rejects an incomplete locale.
- Generator changes keep the Ergodic Generation Principle: every valid rhythm and interval within the selected settings stays reachable.
- No new runtime dependencies, frameworks or third-party origins without discussing it in an issue first.

## Licensing of contributions

**The project stays under the [GNU AGPL v3.0 or later](LICENSE).** Every public build of Guidonica, including your contribution, remains free software under the AGPL.

By contributing to this repository (code, documentation, translations, images or any other material), you:

1. **certify the [Developer Certificate of Origin 1.1](#developer-certificate-of-origin-11)** for that contribution, by signing off each commit (see below); and
2. **license your contribution to everyone under the [MIT License](#mit-license)**, with you as the copyright holder.

For the purposes of the DCO, "the open source license indicated" for your contribution is the MIT License as stated here, even when the file you change carries an AGPL header. You keep the copyright in your work; nothing here transfers it.

**Why MIT and not just the AGPL?** Besides the free web app, the maintainer ships paid builds (app-store versions and Guidonica Studio for teachers and creators) and may offer commercial licenses for the engine. That income funds the free app. An MIT license on contributions lets your work go into those builds as well as the AGPL one. Contributors are credited in every build that includes their work, as the MIT License requires.

### Third-party material

Only include material you have the right to contribute under MIT:

- Code, fonts, images or data from elsewhere must be under a **permissive** license compatible with MIT (MIT, BSD, ISC, Apache-2.0, SIL OFL for fonts), and marked as such: name the source and license in the pull request, and keep the original notices.
- **Not accepted:** GPL, AGPL, LGPL or other copyleft material; non-commercial licenses such as CC BY-NC; anything of unknown origin (snippets from forums or blogs without a clear license).
- AI-assisted work is fine, as long as you have reviewed it and can honestly make the DCO certification for it.

### Trademarks

Contributing does not grant any right to use the name "Guidonica" or the Guidonian Hand logo. See [`TRADEMARKS.md`](TRADEMARKS.md).

## Signing off your commits

A sign-off is a `Signed-off-by` line at the end of the commit message, with the same name and email as the commit author:

```
Signed-off-by: Jane Doe <jane@example.com>
```

Git adds it for you with `-s`:

```bash
git commit -s -m "fix(scroller): keep the playhead aligned after resize"
```

A check on every pull request verifies the sign-off. If you forgot it:

- **Single commit:**
  ```bash
  git commit --amend -s --no-edit
  git push --force-with-lease
  ```
- **Several commits:**
  ```bash
  git fetch origin
  git rebase --signoff origin/main
  git push --force-with-lease
  ```

Commits made in the GitHub web editor are signed off automatically.

---

## Appendix

### Developer Certificate of Origin 1.1

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

### MIT License

Each contribution is licensed under these terms, where `<year>` is the year of the contribution and `<contributor>` is its author:

```
MIT License

Copyright (c) <year> <contributor>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
