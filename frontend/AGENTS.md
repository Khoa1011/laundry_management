# Frontend Guidance

These rules apply to all files under `frontend/`.

## Required Design Reading

Before any frontend visual or interaction change, read:

1. root `DESIGN.md`;
2. `docs/design/LIQUID_GLASS_ADMIN_RULES.md`;
3. `docs/design/UI_IMPLEMENTATION_CHECKLIST.md`;
4. `.agents/skills/laundry-admin-liquid-glass/SKILL.md`.

Use `impeccable` and the repository Liquid Glass skill for UI work.

## Shared Interaction Foundation

- Reuse semantic tokens from `src/styles/tokens.css` and `src/styles/themes.css`.
- Reuse `src/components/ui/Button.tsx`, `src/components/ui/IconButton.tsx`, `src/components/navigation/LiquidNavLink.tsx`, and the glass/motion primitives before adding a feature-local control.
- Do not add raw brand colors, blur, shadow, radius, z-index, spacing, or motion constants inside a feature.
- New feature code must not depend on `LiquidInteractionRoot`; it is only a compatibility bridge during migration.
- Pointer ripple, keyboard feedback, press state, loading, disabled behavior, and cleanup belong to shared primitives.
- Preserve the three render levels: `premium`, `standard`, and `reduced`. Premium must fall back without changing semantics or layout.
- Keep dense tables, permission matrices, sensitive employee data, audit data, and notification rows opaque or nearly opaque.
- Keep both `-webkit-backdrop-filter` and `backdrop-filter` in shared glass implementations.

## Behavior Protection

Preserve routes, APIs, payloads, i18n, auth, branch scope, permissions, SSE behavior, unread state, notification and sound preferences, and business rules. Frontend visibility never replaces backend authorization. Never infer access from a role name or introduce an ADMIN bypass.

## Validation

Run lint, typecheck, relevant tests, and production build. Verify mobile, tablet/POS, desktop, reduced height, reduced motion, reduced transparency, keyboard use, and page-level horizontal overflow.
