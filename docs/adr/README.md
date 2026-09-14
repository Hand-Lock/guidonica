# Architectural Decision Records (ADRs)

This directory documents the core architectural decisions, implementation methods, algorithms, and subsystem designs for **Solfège Scroller**. Future LLM agents and human developers should consult these records to understand what has been developed, how the systems work, and the rationale behind technical decisions.

## Index of Records

| ADR | Title | Status | Date |
| --- | ----- | ------ | ---- |
| [0001](0001-core-architecture-and-rendering-pipeline.md) | Core Architecture, Metric Linearity & Blitting Pipeline | Accepted | 2026-09-14 |

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
