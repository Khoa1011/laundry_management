# Codex UI Task Template

Use this template for future frontend UI tasks.

```text
Use Impeccable and `docs/design/SOLID_ADMIN_RULES.md`.

Before changing code:
1. Read the closest applicable AGENTS.md.
2. Read PRODUCT.md.
3. Read root DESIGN.md.
4. Read docs/design/LIQUID_GLASS_ADMIN_RULES.md.
5. Read docs/design/UI_IMPLEMENTATION_CHECKLIST.md.
6. Inspect the existing page, shared UI components, route, API types, permission guards, i18n keys, tests, and related screens.
7. Inspect `components/ui`, `components/motion`, and `components/navigation` before creating interaction behavior.
8. Briefly summarize the current implementation and implementation plan.

Task:
<Describe the page or component to create, redesign, or fix.>

Goal:
<Describe the user outcome and visual/interaction problem.>

Preserve:
- current business logic;
- API contracts;
- permission behavior;
- i18n architecture;
- sidebar and header structure;
- existing routing unless explicitly requested;
- working desktop/mobile behavior that is not part of the problem.

Required design:
- mobile-first Vietnamese operations UI;
- light mode;
- icy-blue canvas, opaque white surfaces, sky-blue primary and cyan operational accents through semantic tokens;
- solid surfaces with borders, spacing, and restrained elevation;
- opaque or nearly opaque dense forms, finance data, audit logs, permission matrices, and tables;
- state-driven motion that respects reduced motion;
- no page-local material, color, shadow, radius, z-index, or motion constants;
- repository-owned shared components before feature-local variants.
- shared Button/IconButton and navigation primitives for all new commands and destinations;
- restrained press feedback, keyboard activation, reduced-motion fallback, and motion-off behavior through shared primitives;
- premium/standard/reduced rendering selected by capability and appearance preferences without semantic drift;
- opaque notification/data rows inside shared raised panels.

Required states:
- loading;
- refreshing when relevant;
- empty;
- no search results when relevant;
- error and retry;
- permission denied;
- disabled/read-only;
- validation;
- success;
- destructive confirmation when relevant;
- offline/reconnecting when relevant.

Done when:
- the requested page/component is fully implemented;
- all relevant responsive sizes are handled;
- accessibility, reduced-motion, and no-blur/reduced-transparency behavior are complete;
- sidebar/header/button/notification behavior uses the shared interaction foundation rather than feature-local CSS;
- no accidental horizontal page overflow exists;
- relevant lint, type-check, tests, and production build commands pass or failures are honestly reported;
- the final response lists changed files, validation results, and remaining limitations.

Do not create a commit.
Do not install UI dependencies unless explicitly approved and shown to be maintained, compatible, and materially better than the repository-owned adapter.
Do not modify backend behavior unless a required contract issue is found; report that issue clearly.
```

## Short Version

```text
Use Impeccable and `docs/design/SOLID_ADMIN_RULES.md`.

Improve <page/component> according to AGENTS.md, PRODUCT.md, root DESIGN.md, docs/design/LIQUID_GLASS_ADMIN_RULES.md, and docs/design/UI_IMPLEMENTATION_CHECKLIST.md. Preserve business logic, APIs, permissions, i18n, routes, sidebar, and header. Implement complete responsive, state, accessibility, reduced-motion, and no-blur fallback behavior. Run the real frontend checks and report changed files and results. Do not commit.
```
