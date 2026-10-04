# Security Policy

## Reporting a vulnerability

Report security vulnerabilities privately to **[security@guidonica.it](mailto:security@guidonica.it)**. Never open a public GitHub issue, pull request or discussion for one: that discloses it before a fix is deployed.

Please include:

- what the vulnerability is and what an attacker could do with it;
- the steps to reproduce it, or a proof of concept;
- the affected URL, file or commit, and the browser and operating system you tested with;
- whether you want to be credited, and under which name.

Reports in English or Italian are welcome. The same contact is published in [`/.well-known/security.txt`](https://guidonica.it/.well-known/security.txt) ([RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)).

## Scope

- The web app at [guidonica.it](https://guidonica.it), and its mirror at [hand-lock.github.io/guidonica](https://hand-lock.github.io/guidonica/).
- This repository: the source code, the service worker, the build scripts and the GitHub Actions workflows.

Guidonica is a client-only static app. It has no server, accounts, cookies or analytics, and stores its settings only in the browser's `localStorage`. Issues in GitHub Pages itself, or in third-party services, belong to their own vendors.

## Supported versions

Only the latest deploy of `main` is supported. Every push to `main` is built and published, so fixes ship there and older builds are not patched.

## What to expect

This is a one-person project, so responses are best effort. You will get an acknowledgement as soon as possible, and updates while the fix is prepared. Please allow time for a fix to be deployed before you disclose the issue publicly. If you wish, you will be credited in the fix's commit message and release notes.
