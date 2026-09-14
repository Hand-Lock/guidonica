# Architectural Decision Records (ADRs)

This directory documents the core architectural decisions, implementation methods, algorithms, and subsystem designs for **Solfège Scroller**. Future LLM agents and human developers should consult these records to understand what has been developed, how the systems work, and the rationale behind technical decisions.

## Index of Records

| ADR | Title | Status | Date |
| --- | ----- | ------ | ---- |
| [0001](0001-core-architecture-and-rendering-pipeline.md) | Core Architecture, Metric Linearity & Blitting Pipeline | Accepted | 2026-09-14 |
| [0002](0002-light-theme-standardization.md) | Light Theme Standardization & High-Contrast Canvas Rendering | Accepted | 2026-09-14 |
| [0003](0003-infinite-stream-stave-alignment-and-barlines.md) | Infinite Streaming Buffer, Stave Alignment & Barline Rendering | Accepted | 2026-09-14 |
| [0004](0004-beaming-geometry-and-stave-attachment.md) | Beaming Geometry, Stave Attachment & Stem Extension Alignment | Accepted | 2026-09-14 |

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
