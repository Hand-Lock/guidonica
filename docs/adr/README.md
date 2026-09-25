# Architectural Decision Records (ADRs)

This directory documents the core architectural decisions, implementation methods, algorithms, and subsystem designs for **Guidonica**. Future LLM agents and human developers should consult these records to understand what has been developed, how the systems work, and the rationale behind technical decisions.

## Index of Records

| ADR | Title | Status | Date |
| --- | ----- | ------ | ---- |
| [0001](0001-core-architecture-and-rendering-pipeline.md) | Core Architecture, Metric Linearity & Blitting Pipeline | Accepted | 2026-09-14 |
| [0002](0002-light-theme-standardization.md) | Light Theme Standardization & High-Contrast Canvas Rendering | Accepted | 2026-09-14 |
| [0003](0003-infinite-stream-stave-alignment-and-barlines.md) | Infinite Streaming Buffer, Stave Alignment & Barline Rendering | Accepted | 2026-09-14 |
| [0004](0004-beaming-geometry-and-stave-attachment.md) | Beaming Geometry, Stave Attachment & Stem Extension Alignment | Accepted | 2026-09-14 |
| [0005](0005-dynamic-subdivision-beat-width-and-stave-padding-compensation.md) | Dynamic Subdivision Beat Width & Stave Padding Compensation | Accepted | 2026-09-14 |
| [0006](0006-multi-interval-selection-and-clef-pitch-pools.md) | Multi-Interval Checkbox Selection & Clef-Dependent Pitch Pools (±3 Ledger Lines) | Accepted | 2026-09-14 |
| [0007](0007-comprehensive-system-audit-and-optimizations.md) | Comprehensive System Audit, Glitch Elimination & Performance Optimizations | Accepted | 2026-09-14 |
| [0008](0008-pause-and-resume-state-synchronization.md) | Pause and Resume State Synchronization & Beat Grid Phase Alignment | Accepted | 2026-09-14 |
| [0009](0009-cross-platform-portability-and-github-synchronization.md) | Cross-Platform Portability, macOS Apple Silicon Support & GitHub Synchronization | Accepted | 2026-09-14 |
| [0010](0010-separate-tuplet-subdivision-matrix-menu.md) | Separate Tuplet Subdivision Matrix Menu & Arbitrary n-Tuplet Engine | Accepted | 2026-09-14 |
| [0011](0011-tuplet-beam-stem-direction-unification.md) | Tuplet Beam Stem Direction Unification & Contiguous Non-Tuplet Grouping | Accepted | 2026-09-14 |
| [0012](0012-web-font-synchronization-and-clef-invalidation.md) | Web Font Loading Synchronization & Pinned Clef Cache Invalidation | Accepted | 2026-09-16 |
| [0013](0013-production-readiness-and-high-dpi-retina-pipeline.md) | Production Readiness, High-DPI Retina Pipeline & Audio Polish | Accepted | 2026-09-16 |
| [0014](0014-solfege-label-transform-and-vertical-clearance.md) | Solfège Label Context Transform & Vertical Clearance Architecture | Accepted | 2026-09-16 |
| [0015](0015-italian-solfege-and-cross-platform-auto-night-mode.md) | Italian Solfège Syllables and Cross-Platform OS-Aligned Auto Night Mode | Accepted | 2026-09-16 |
| [0016](0016-default-woodblock-metronome-and-auto-theme.md) | Default Woodblock Metronome Profile and Auto OS Theme Mode | Accepted | 2026-09-16 |
| [0017](0017-vector-music-icons-cross-platform-ui.md) | Vector Music Notation Icons for Cross-Platform UI Controls | Accepted | 2026-09-16 |
| [0018](0018-github-actions-pages-continuous-deployment.md) | Continuous Deployment to GitHub Pages via GitHub Actions & Custom Domain Readiness | Accepted | 2026-09-17 |
| [0019](0019-licensing-strict-copyleft-agplv3.md) | Strict Copyleft Open-Source Licensing (GNU AGPLv3) | Accepted | 2026-09-17 |
| [0020](0020-in-app-license-and-repository-ui.md) | In-App License and Repository Presentation Architecture | Accepted | 2026-09-17 |
| [0021](0021-project-rebranding-guidonica.md) | Project, Web-App, and Repository Rebranding to Guidonica | Accepted | 2026-09-17 |
| [0022](0022-aero-skeuomorphic-design-system-and-manifesto.md) | Aero-Guidonica Skeuomorphic Design System, Alegreya Typography, and Design Manifesto | Accepted | 2026-09-17 |
| [0023](0023-ubuntu-mono-monospace-typography.md) | Ubuntu Mono Monospace Typography and Numeric System | Accepted | 2026-09-18 |
| [0024](0024-haptic-feedback-feasibility-and-rejection.md) | Technical Feasibility Evaluation and Rejection of Web Haptic Motor Feedback | Decided | 2026-09-18 |
| [0025](0025-in-app-notation-zoom-and-mobile-ergonomics.md) | In-App Notation Zoom & Mobile Ergonomics | Accepted | 2026-09-18 |
| [0026](0026-stationary-time-signature-and-stave-header.md) | Stationary Selected Time Signature & Left Stave Header | Accepted | 2026-09-18 |
| [0027](0027-ios-silent-mode-dynamic-audio-session.md) | Dynamic iOS AudioSession: Ambient UI & Playback Metronome | Accepted | 2026-09-18 |
| [0028](0028-device-adaptive-zoom-and-sight-reading-forereading.md) | Device-Adaptive Zoom & Sight-Reading Forereading | Accepted | 2026-09-18 |
| [0029](0029-stationary-count-in-wait-in-place.md) | Stationary Count-In Wait-In-Place | Accepted | 2026-09-18 |
| [0030](0030-stacked-count-in-indicator-and-mobile-traffic-lights.md) | Stacked Count-In Indicator and Mobile Traffic Lights Geometry | Accepted | 2026-09-18 |
| [0031](0031-custom-domain-guidonica-it.md) | Custom Domain Infrastructure (guidonica.it) via Register.it and GitHub Pages | Accepted | 2026-09-18 |
| [0032](0032-olo-chromatic-accent-and-design-principle.md) | Olo (#00FFCC) Chromatic Accent, Perceptual Color Principle, and Liquid Gel Palette Architecture | Accepted | 2026-09-18 |
| [0033](0033-fullscreen-api-feature-detection-and-selective-ui-presentation.md) | Fullscreen API Capability Detection & Selective UI Presentation | Accepted | 2026-09-18 |
| [0034](0034-matched-segmented-square-fullscreen-icons.md) | Matched Segmented-Square Fullscreen Icons & Inverted Exit Geometry | Accepted | 2026-09-18 |
| [0035](0035-page-lifecycle-auto-pause-and-screen-wake-lock.md) | Page Lifecycle Auto-Pause, AudioContext State Recovery & Screen Wake Lock | Accepted | 2026-09-18 |
| [0036](0036-ergodic-metric-tree-procedural-generation-and-dotted-rhythms.md) | Ergodic Metric Tree Procedural Generation, Dotted Rhythms & Tied Notes | Accepted | 2026-09-19 |
| [0037](0037-toggleable-playhead-mark-visibility.md) | Toggleable Playhead Mark Visibility & Unassisted Sight-Reading Mode | Accepted | 2026-09-19 |
| [0038](0038-setticlavio-complete-clef-system.md) | Setticlavio Complete Clef System: Soprano, Mezzo-Soprano, and Dual Baritone (F & C) Integration | Accepted | 2026-09-19 |
| [0039](0039-repository-audit-ergodicity-and-clock-unification.md) | Repository Audit: Ergodicity Restoration, Clock Unification, and Configuration Hygiene | Accepted | 2026-09-25 |

---

## Guidelines for New ADRs
Whenever a significant architectural decision, algorithmic shift, or new subsystem is introduced:
1. Create a numbered record: `docs/adr/NNNN-<short-title>.md`.
2. Document:
   - **Context**: Problem statement, requirements, or pedagogical constraints.
   - **Decision**: Precise technical solution, libraries, or algorithms chosen.
   - **Implementation Details**: Key classes, math formulas, timing constraints, or data flows.
   - **Consequences**: Trade-offs, benefits, and maintenance considerations.
3. Update this index table.
