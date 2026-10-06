# Security Policy

## Reporting a vulnerability

Report security vulnerabilities privately, through either channel:

- email **[security@guidonica.it](mailto:security@guidonica.it)**;
- GitHub's private vulnerability reporting: **[Report a vulnerability](https://github.com/Hand-Lock/guidonica/security/advisories/new)** on the repository's Security tab. Use it if the email bounces or gets no reply.

Never open a public GitHub issue, pull request or discussion for one: that discloses it before a fix is deployed.

Please include:

- what the vulnerability is and what an attacker could do with it;
- the steps to reproduce it, or a proof of concept;
- the affected URL, file or commit, and the browser and operating system you tested with;
- whether you want to be credited, and under which name.

Reports in English or Italian are welcome. The same contact is published in [`/.well-known/security.txt`](https://guidonica.it/.well-known/security.txt) ([RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)).

## Scope

- The web app at [guidonica.it](https://guidonica.it), its nightly build at [guidonica.it/nightly/](https://guidonica.it/nightly/), and the language pages [/it/](https://guidonica.it/it/), [/fr/](https://guidonica.it/fr/), [/de/](https://guidonica.it/de/) and [/es/](https://guidonica.it/es/). The old `hand-lock.github.io/guidonica/` address only redirects to guidonica.it.
- This repository: the source code, the service worker, the build scripts and the GitHub Actions workflows.

Guidonica is a client-only static app. It has no server, accounts, cookies or analytics, and stores its settings only in the browser's `localStorage`. Issues in GitHub Pages itself, or in third-party services, belong to their own vendors.

## Supported versions

Two builds are supported: the latest release at guidonica.it and the nightly build of `main` at guidonica.it/nightly/. A fix lands on `main` and ships to nightly first, then reaches guidonica.it in a patch release (ADR 0078). Older releases are not patched.

## What to expect

This is a one-person project, so responses are best effort. You will get an acknowledgement as soon as possible, and updates while the fix is prepared. Please allow time for a fix to be deployed before you disclose the issue publicly. If you wish, you will be credited in the fix's commit message and release notes.
