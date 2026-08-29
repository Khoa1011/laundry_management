# Design Documentation Instructions

These instructions apply to files inside `docs/design`.

Root `AGENTS.md`, root `PRODUCT.md`, and root `DESIGN.md` remain the project-level sources of truth. Do not create competing product or design contracts in this folder.

When updating solid admin guidance:

- Keep `SOLID_ADMIN_RULES.md` aligned with root `DESIGN.md`.
- Keep `UI_IMPLEMENTATION_CHECKLIST.md` aligned with actual scripts and dependencies in `frontend/package.json`.
- Do not claim Radix, Shadcn, Ein UI, Quidlass, or any other UI library is installed unless it exists in `frontend/package.json`.
- Keep examples implementation-oriented and compatible with repository-owned components and semantic tokens.
- Preserve mobile-first, Vietnamese operations UI, permission awareness, accessibility, reduced motion, and opaque surface requirements.
- Avoid duplicating large sections from root `AGENTS.md`, `PRODUCT.md`, or `DESIGN.md`; link to them instead.
