# Frontend Guidance

These rules apply to all files under `frontend/`.

## Required Design Reading

Before any frontend visual or interaction change, read:

1. root `DESIGN.md`;
2. `docs/design/SOLID_ADMIN_RULES.md`;
3. `docs/design/UI_IMPLEMENTATION_CHECKLIST.md`;
4. the repository-owned shared component and token implementations.

Use `impeccable` for UI work.

## Shared Interaction Foundation

- Reuse semantic tokens from `src/styles/tokens.css` and `src/styles/themes.css`.
- Reuse `src/components/ui/Button.tsx`, `src/components/ui/IconButton.tsx`, `src/components/ui/Surface.tsx`, `src/components/navigation/AppNavLink.tsx`, and shared motion primitives before adding a feature-local control.
- Do not add raw brand colors, shadow, radius, z-index, spacing, or motion constants inside a feature.
- Pointer and keyboard feedback, press state, loading, disabled behavior, and cleanup belong to shared primitives.
- Keep all structural and data surfaces opaque. Do not add backdrop blur or translucent material.

## Behavior Protection

Finance and Inventory follow `FINANCE & INVENTORY — SINGLE-OPERATOR WORKFLOW` in root `AGENTS.md`. Do not add approval controls or a separate posting action after Save. Authorized saved-document edits/cancellation use backend revision/correction commands, not direct ledger changes. Reuse `src/components/UnsavedBranchDialog.tsx` for dirty or pending Finance/Inventory forms so an explicit branch change cannot discard work silently.

Preserve routes, APIs, payloads, i18n, auth, branch scope, permissions, SSE behavior, unread state, notification and sound preferences, and business rules. Frontend visibility never replaces backend authorization. Never infer access from a role name or introduce an ADMIN bypass.

## Validation

Run lint, typecheck, relevant tests, and production build. Verify mobile, tablet/POS, desktop, reduced height, reduced motion, keyboard use, and page-level horizontal overflow.
