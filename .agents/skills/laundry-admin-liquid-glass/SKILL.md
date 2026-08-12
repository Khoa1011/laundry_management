---
name: laundry-admin-liquid-glass
description: Apply the laundry-management admin Liquid Glass design system. Use for frontend UI work in this repository, including creating, redesigning, polishing, auditing, or adapting React/TypeScript screens, app shell, navigation, dialogs, sheets, cards, tables, forms, dashboards, notifications, responsive layouts, motion, accessibility, or visual consistency where Liquid Glass styling must remain synchronized with the project design contract.
---

# Laundry Admin Liquid Glass

Use this skill with `impeccable` for any frontend or UI task in this repository. The goal is a mobile-first Vietnamese operations UI with medium-strength Liquid Glass, balanced green branding, restrained motion, strong readability, and no business-logic drift.

## Required Reading

Before planning or editing UI code, read these files in order:

1. `PRODUCT.md`
2. `DESIGN.md`
3. `docs/design/LIQUID_GLASS_ADMIN_RULES.md`
4. `docs/design/UI_IMPLEMENTATION_CHECKLIST.md`
5. The closest applicable `AGENTS.md`

If these documents conflict, root `DESIGN.md` wins unless the task explicitly asks to update the design system first.

## Workflow

1. Inspect the current screen, shared components, CSS tokens, theme tokens, motion provider, route, API types, permission guards, i18n keys, tests, and neighboring screens.
2. Summarize the current implementation and identify which shared primitives should be reused or extended.
3. Plan mobile first, then tablet/POS, then laptop/desktop.
4. Implement Liquid Glass only through repository-owned components and semantic tokens.
5. Keep dense forms, finance records, audit logs, permission matrices, and long tables opaque or nearly opaque.
6. Preserve business behavior, API contracts, permissions, i18n, routing, loading, empty, error, success, validation, keyboard, and touch behavior.
7. Run the real frontend checks from `frontend/package.json` when code changes: lint, typecheck, relevant tests, and build.
8. Report changed files, responsive behavior, state coverage, accessibility/motion behavior, command results, and remaining limitations.
9. For commands and navigation, inspect and reuse `frontend/src/components/ui`, `frontend/src/components/motion`, and `frontend/src/components/navigation` before editing feature CSS.

## Design Rules

- Use balanced green as the primary Liquid Glass direction through semantic tokens.
- Do not hard-code hex, RGB, blur, tint, shadow, radius, z-index, or animation values in feature modules.
- Use medium Liquid Glass for sidebar, header, bottom navigation, dialogs, sheets, notification center, command palette, selected KPI cards, and high-priority action affordances.
- Avoid glass-on-glass stacking. Never apply backdrop blur to every row, cell, or repeated dense record.
- Provide readable solid fallbacks for no-blur browsers, weak devices, reduced transparency, and dense data surfaces.
- Use motion for state changes only: drawer, collapse, tab indicator, dialog/sheet enter and exit, notification arrival, KPI/status update, success confirmation.
- Respect `prefers-reduced-motion`; do not add bounce, page-load choreography, or continuous decorative motion.
- Keep touch targets at least 44 x 44 CSS pixels.
- Do not rely on hover for required actions or critical information.
- Status meaning must be text or icon plus color, never color alone.
- Use `Button`, `ButtonLink`, `IconButton`, or `IconButtonLink` for new commands. Do not recreate press, loading, focus, or ripple behavior in a feature.
- Use `LiquidNavLink` for shared navigation behavior. Desktop sidebar active state uses one moving indicator and every destination remains a direct link.
- Pointer feedback starts at the press coordinate, keyboard feedback starts at center, and neither delays the command. Disabled/loading controls emit none.
- `premium` is progressive enhancement only. It must degrade to `standard` and `reduced` without changing semantics, dimensions, focus order, or command timing.
- Notification panels and toasts may use strong glass; notification rows remain opaque or nearly opaque. Realtime motion applies only to newly received items.

## Dependency Policy

The current frontend owns its design primitives in `frontend/src/components` and CSS tokens. Do not assume Radix, Shadcn, Ein UI, or Quidlass are installed. Do not install UI dependencies only for visual polish unless the user explicitly approves a dependency decision.

If an external Liquid Glass example is useful, adapt the idea into repository-owned components instead of coupling feature code directly to an external API. An approved dependency must be maintained, compatible with the current React/TypeScript stack, materially beneficial, and wrapped behind the repository API.
