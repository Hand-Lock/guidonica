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
| [0006](0006-multi-interval-selection-and-clef-pitch-pools.md) | Multi-Interval Checkbox Selection & Clef-Dependent Pitch Pools (±3 Ledger Lines) | Accepted; amended by 0065, 0066, 0070 | 2026-09-14 |
| [0007](0007-comprehensive-system-audit-and-optimizations.md) | Comprehensive System Audit, Glitch Elimination & Performance Optimizations | Accepted | 2026-09-14 |
| [0008](0008-pause-and-resume-state-synchronization.md) | Pause and Resume State Synchronization & Beat Grid Phase Alignment | Accepted | 2026-09-14 |
| [0009](0009-cross-platform-portability-and-github-synchronization.md) | Cross-Platform Portability, macOS Apple Silicon Support & GitHub Synchronization | Accepted | 2026-09-14 |
| [0010](0010-separate-tuplet-subdivision-matrix-menu.md) | Separate Tuplet Subdivision Matrix Menu & Arbitrary n-Tuplet Engine | Accepted; amended by 0065 | 2026-09-14 |
| [0011](0011-tuplet-beam-stem-direction-unification.md) | Tuplet Beam Stem Direction Unification & Contiguous Non-Tuplet Grouping | Accepted; amended by 0065 | 2026-09-14 |
| [0012](0012-web-font-synchronization-and-clef-invalidation.md) | Web Font Loading Synchronization & Pinned Clef Cache Invalidation | Accepted; amended by 0058, 0060 | 2026-09-16 |
| [0013](0013-production-readiness-and-high-dpi-retina-pipeline.md) | Production Readiness, High-DPI Retina Pipeline & Audio Polish | Accepted; superseded in part by 0042 | 2026-09-16 |
| [0014](0014-solfege-label-transform-and-vertical-clearance.md) | Solfège Label Context Transform & Vertical Clearance Architecture | Accepted; superseded in part by 0041 | 2026-09-16 |
| [0015](0015-italian-solfege-and-cross-platform-auto-night-mode.md) | Italian Solfège Syllables and Cross-Platform OS-Aligned Auto Night Mode | Accepted; amended by 0059 | 2026-09-16 |
| [0016](0016-default-woodblock-metronome-and-auto-theme.md) | Default Woodblock Metronome Profile and Auto OS Theme Mode | Accepted | 2026-09-16 |
| [0017](0017-vector-music-icons-cross-platform-ui.md) | Vector Music Notation Icons for Cross-Platform UI Controls | Accepted | 2026-09-16 |
| [0018](0018-github-actions-pages-continuous-deployment.md) | Continuous Deployment to GitHub Pages via GitHub Actions & Custom Domain Readiness | Accepted; amended by 0069, 0077, 0078 | 2026-09-17 |
| [0019](0019-licensing-strict-copyleft-agplv3.md) | Strict Copyleft Open-Source Licensing (GNU AGPLv3) | Accepted; amended by 0067 | 2026-09-17 |
| [0020](0020-in-app-license-and-repository-ui.md) | In-App License and Repository Presentation Architecture | Accepted; amended by 0067 | 2026-09-17 |
| [0021](0021-project-rebranding-guidonica.md) | Project, Web-App, and Repository Rebranding to Guidonica | Accepted | 2026-09-17 |
| [0022](0022-aero-skeuomorphic-design-system-and-manifesto.md) | Aero-Guidonica Skeuomorphic Design System, Alegreya Typography, and Design Manifesto | Accepted | 2026-09-17 |
| [0023](0023-ubuntu-mono-monospace-typography.md) | Ubuntu Mono Monospace Typography and Numeric System | Accepted; amended by 0060 | 2026-09-18 |
| [0024](0024-haptic-feedback-feasibility-and-rejection.md) | Technical Feasibility Evaluation and Rejection of Web Haptic Motor Feedback | Decided (Rejected) | 2026-09-18 |
| [0025](0025-in-app-notation-zoom-and-mobile-ergonomics.md) | In-App Notation Zoom & Mobile Ergonomics | Accepted | 2026-09-18 |
| [0026](0026-stationary-time-signature-and-stave-header.md) | Stationary Selected Time Signature & Left Stave Header | Accepted | 2026-09-18 |
| [0027](0027-ios-silent-mode-dynamic-audio-session.md) | Dynamic iOS AudioSession: Ambient UI & Playback Metronome | Accepted | 2026-09-18 |
| [0028](0028-device-adaptive-zoom-and-sight-reading-forereading.md) | Device-Adaptive Zoom & Sight-Reading Forereading | Accepted | 2026-09-18 |
| [0029](0029-stationary-count-in-wait-in-place.md) | Stationary Count-In Wait-In-Place | Accepted | 2026-09-18 |
| [0030](0030-stacked-count-in-indicator-and-mobile-traffic-lights.md) | Stacked Count-In Indicator and Mobile Traffic Lights Geometry | Accepted; amended by 0072 | 2026-09-18 |
| [0031](0031-custom-domain-guidonica-it.md) | Custom Domain Infrastructure (guidonica.it) via Register.it and GitHub Pages | Accepted; amended by 0068 | 2026-09-18 |
| [0032](0032-olo-chromatic-accent-and-design-principle.md) | Olo (#00FFCC) Chromatic Accent, Perceptual Color Principle, and Liquid Gel Palette Architecture | Accepted | 2026-09-18 |
| [0033](0033-fullscreen-api-feature-detection-and-selective-ui-presentation.md) | Fullscreen API Capability Detection & Selective UI Presentation | Accepted | 2026-09-18 |
| [0034](0034-matched-segmented-square-fullscreen-icons.md) | Matched Segmented-Square Fullscreen Icons & Inverted Exit Geometry | Accepted | 2026-09-18 |
| [0035](0035-page-lifecycle-auto-pause-and-screen-wake-lock.md) | Page Lifecycle Auto-Pause, AudioContext State Recovery & Screen Wake Lock | Accepted | 2026-09-18 |
| [0036](0036-ergodic-metric-tree-procedural-generation-and-dotted-rhythms.md) | Ergodic Metric Tree Procedural Generation, Dotted Rhythms & Tied Notes | Accepted; rhythm sampler superseded by 0065 | 2026-09-19 |
| [0037](0037-toggleable-playhead-mark-visibility.md) | Toggleable Playhead Mark Visibility & Unassisted Sight-Reading Mode | Accepted | 2026-09-19 |
| [0038](0038-setticlavio-complete-clef-system.md) | Setticlavio Complete Clef System: Soprano, Mezzo-Soprano, and Dual Baritone (F & C) Integration | Accepted | 2026-09-19 |
| [0039](0039-repository-audit-ergodicity-and-clock-unification.md) | Repository Audit: Ergodicity Restoration, Clock Unification, and Configuration Hygiene | Accepted; superseded in part by 0040; amended by 0089 | 2026-09-25 |
| [0040](0040-engraving-grammar-for-ties-and-cross-barline-ties.md) | Engraving Grammar for Ties and Cross-Barline Ties | Accepted; amended by 0065 | 2026-09-25 |
| [0041](0041-solfege-labels-notehead-anchored.md) | Solfège Labels Anchored to Noteheads (dpr² Transform Fix) | Accepted; amended by 0057 | 2026-09-25 |
| [0042](0042-single-dpr-offscreen-backing-store.md) | Single-dpr Offscreen Backing Store (drop VexFlow `resize()`) | Accepted | 2026-09-25 |
| [0043](0043-thirty-second-notes.md) | Thirty-Second Notes & Dotted Sixteenths | Accepted; amended by 0064; rhythm sampler superseded by 0065 | 2026-09-27 |
| [0044](0044-user-selectable-ledger-lines.md) | User-Selectable Ledger Lines (Above / Below, 0–3) | Accepted; amended by 0059, 0065, 0066 | 2026-10-02 |
| [0045](0045-aero-guidonica-2-material-hierarchy-and-responsive-redesign.md) | Aero-Guidonica 2: Material Hierarchy & Responsive Redesign | Accepted; amended by 0054 | 2026-10-02 |
| [0046](0046-guidonian-hand-brand-mark.md) | Guidonian Hand Brand Mark, Favicon & App Icon | Superseded in part by [0047](0047-guidonian-hand-v2.md) | 2026-10-02 |
| [0047](0047-guidonian-hand-v2.md) | Guidonian Hand v2: Anatomical Proportions, Volume Shading & 3D Thread | Accepted | 2026-10-02 |
| [0048](0048-brand-mark-rollout-manifest-and-readme-logo.md) | Brand Mark Rollout: Web App Manifest & README Logo | Accepted; amended by 0063 | 2026-10-03 |
| [0049](0049-level-presets-onboarding-intro.md) | Level Presets & Onboarding Intro ("What's your level?") | Accepted; amended by 0053, 0059, 0070, 0071 | 2026-10-03 |
| [0050](0050-intro-notation-previews.md) | Procedural Notation Previews in the Onboarding Intro | Accepted; amended by 0051, 0052, 0071 | 2026-10-03 |
| [0051](0051-intro-preview-representation-presets.md) | Representation Presets for the Intro Level Previews | Accepted; amended by 0052, 0070 | 2026-10-03 |
| [0052](0052-intro-preview-signature-check.md) | Signature Check for the Intro Level Previews | Accepted; amended by 0070, 0071 | 2026-10-03 |
| [0053](0053-header-level-button.md) | Header Level Button with a Live Difficulty Meter | Accepted; amended by 0054, 0073 | 2026-10-03 |
| [0054](0054-responsive-header-fit-audit.md) | Responsive Header Fit Audit | Accepted; amended by 0055, 0076, 0090 | 2026-10-03 |
| [0055](0055-orientation-aware-auto-zoom-and-landscape-tip.md) | Orientation-Aware Auto Zoom & Portrait Landscape Tip | Accepted; amended by 0056, 0083, 0087 | 2026-10-03 |
| [0056](0056-notch-safe-notation-stage.md) | Notch-Safe Notation Stage | Accepted | 2026-10-03 |
| [0057](0057-canvas-bounded-beams-and-tuplet-numbers.md) | Canvas-Bounded Beams & Tuplet Numbers | Accepted | 2026-10-03 |
| [0058](0058-music-font-audit-and-bravura-subset.md) | Music Font Audit: Keep Bravura, Ship a Renamed Subset | Accepted | 2026-10-03 |
| [0059](0059-localization-and-national-note-naming.md) | Localization (en · it · fr · de · es) & National Note Naming | Accepted; amended by 0086 | 2026-10-03 |
| [0060](0060-self-hosted-text-fonts-and-privacy-note.md) | Self-Hosted Text Fonts & a No-Tracking Privacy Note | Accepted; amended by 0088 | 2026-10-03 |
| [0061](0061-social-preview-card-and-share-metadata.md) | Social Preview Card & Share Metadata | Accepted | 2026-10-03 |
| [0062](0062-robots-txt-and-sitemap.md) | robots.txt & sitemap.xml | Accepted; amended by 0086 | 2026-10-03 |
| [0063](0063-offline-service-worker.md) | Offline Service Worker | Accepted; amended by 0078, 0086 | 2026-10-03 |
| [0064](0064-two-beat-sub-eighth-slots.md) | Sub-Eighth Half-Beat Slots in Two-Beat Groups | Superseded by 0065 | 2026-10-03 |
| [0065](0065-grammar-driven-rhythm-sampler.md) | Grammar-Driven Rhythm Sampler, Rest Spelling & Tuplet Merges | Accepted; amended by 0066, 0076, 0090 | 2026-10-04 |
| [0066](0066-ergodicity-audit-connected-pitch-start-rest-runs-tuplet-shapes.md) | Ergodicity Audit: Connected Pitch Start, Rest Runs & Uniform Tuplet Shapes | Accepted; amended by 0070 | 2026-10-04 |
| [0067](0067-contribution-licensing-dco-and-trademark-policy.md) | Contribution Licensing (Inbound MIT + DCO) & Trademark Policy | Accepted; amended by 0068, 0069 | 2026-10-04 |
| [0068](0068-project-email-guidonica-it-migadu.md) | Project Email on guidonica.it (Migadu), Contact Addresses & security.txt | Accepted; amended by 0069, 0077, 0088 | 2026-10-04 |
| [0069](0069-security-privacy-audit.md) | Security & Privacy Audit: History Rewrite, CI Least Privilege & Repository Hardening | Accepted; amended by 0077, 0088 | 2026-10-04 |
| [0070](0070-note-selection-and-level-progression.md) | Note Selection Toggles & Reworked Level Progression | Accepted | 2026-10-05 |
| [0071](0071-intro-meter-step.md) | Time Signature Step in the Onboarding Intro | Accepted; amended by 0076, 0090 | 2026-10-05 |
| [0072](0072-three-level-beat-accent-hierarchy.md) | Three-Level Beat Accent Hierarchy in the Traffic Lights and Click | Accepted; amended by 0076, 0090 | 2026-10-05 |
| [0073](0073-level-button-dumbbell-icon.md) | Dumbbell Icon for the Header Level Button | Accepted | 2026-10-05 |
| [0074](0074-donations-ko-fi-link.md) | Donations: a Plain Ko-fi Link | Accepted; amended by 0088 | 2026-10-05 |
| [0075](0075-ai-assistance-disclosure.md) | AI-Assistance Disclosure in the About Dialog | Accepted | 2026-10-05 |
| [0076](0076-compound-triple-and-quadruple-meters.md) | Compound Triple and Quadruple Meters (9/8, 12/8) | Accepted; amended by 0090 | 2026-10-05 |
| [0077](0077-ci-actions-node-24.md) | CI Actions on Node 24 Releases | Accepted | 2026-10-05 |
| [0078](0078-release-channels-calver-changelog-whats-new.md) | Release Channels, CalVer Changelog and "What's New" | Accepted | 2026-10-05 |
| [0079](0079-social-profile-banners.md) | Social Profile Banners | Accepted | 2026-10-05 |
| [0080](0080-social-profiles-verification.md) | Social Profiles: rel="me" Verification and Bluesky Domain Handle | Accepted; amended by 0082, 0084 | 2026-10-06 |
| [0081](0081-release-announcements-bluesky-mastodon.md) | Release Announcements on Bluesky and Mastodon | Accepted | 2026-10-06 |
| [0082](0082-visible-social-links.md) | Visible Bluesky and Mastodon Links | Accepted; amended by 0084 | 2026-10-06 |
| [0083](0083-in-app-browser-landscape-tip.md) | In-App Browser Landscape Tip | Accepted | 2026-10-06 |
| [0084](0084-instagram-link.md) | Instagram Link | Accepted | 2026-10-06 |
| [0085](0085-shareable-exercise-links.md) | Shareable Exercise Links | Accepted | 2026-10-06 |
| [0086](0086-language-landing-pages.md) | Language Landing Pages | Accepted | 2026-10-06 |
| [0087](0087-rotating-tips.md) | Rotating Tips | Accepted | 2026-10-06 |
| [0088](0088-pre-release-audit-2026-10-06.md) | Pre-release Audit 2026-10-06: Second History Rewrite, Privacy Policy | Accepted | 2026-10-06 |
| [0089](0089-frame-locked-audio-clock.md) | Frame-Locked Audio Clock | Accepted; followed by 0091 | 2026-10-06 |
| [0090](0090-half-note-beat-meters.md) | Half-Note Beat Meters: 4/2, 3/2, 2/2, 6/4, 9/4, 12/4 | Accepted | 2026-10-06 |
| [0091](0091-jank-free-beat-and-measure-frames.md) | Jank-Free Beat and Measure Frames | Accepted | 2026-10-06 |

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
