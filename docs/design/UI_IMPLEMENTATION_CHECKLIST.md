# UI Implementation Checklist

Use this checklist before declaring a frontend UI task complete.

## A. Context And Scope

- [ ] Read the closest `AGENTS.md`.
- [ ] Use `impeccable`.
- [ ] Read `PRODUCT.md`.
- [ ] Read root `DESIGN.md`.
- [ ] Read `docs/design/SOLID_ADMIN_RULES.md`.
- [ ] Identify the exact pages/components in scope.
- [ ] Identify business logic, APIs, permissions, i18n keys, and routes that must remain unchanged.
- [ ] Inspect existing shared components and style tokens before adding new primitives.

## B. Design-System Compliance

- [ ] Uses semantic tokens from the project theme/style layer.
- [ ] Reuses or extends repository-owned components.
- [ ] No page-local duplicate surface or navigation primitive.
- [ ] No raw hex, RGB, blur, radius, shadow, z-index, or motion values inside feature modules.
- [ ] Structural and data surfaces are opaque and use the correct shared variant.
- [ ] Dense tables/forms remain readable and opaque.
- [ ] Status colors include text and/or icon.
- [ ] Sidebar/header information architecture is preserved unless explicitly changed.
- [ ] External UI effects are wrapped behind repository-owned components if approved.
- [ ] New commands use shared `Button`/`IconButton` primitives; new navigation uses shared navigation primitives.

## C. State Completeness

- [ ] Loading.
- [ ] Refreshing.
- [ ] Empty.
- [ ] No search results.
- [ ] Error and retry.
- [ ] Permission denied.
- [ ] Disabled/read-only.
- [ ] Success feedback.
- [ ] Validation feedback.
- [ ] Destructive confirmation.
- [ ] Offline/reconnecting state when realtime or network behavior is involved.

## D. Responsive Validation

- [ ] 360 x 800 mobile.
- [ ] 390 x 844 mobile.
- [ ] 390 x 600 reduced-height mobile.
- [ ] 412 x 915 large mobile when relevant.
- [ ] 768 x 1024 tablet portrait.
- [ ] 1024 x 768 or 1024 x 600 tablet/POS landscape.
- [ ] 1280 x 720 or 1366 x 768 laptop.
- [ ] 1440 x 900 desktop.
- [ ] Desktop at 125% zoom for important screens.
- [ ] No accidental page-level horizontal overflow.
- [ ] Intentional table scrolling is contained.
- [ ] Dialog footer remains reachable.
- [ ] Bottom navigation does not cover content or actions.
- [ ] Tablet layout is intentional, not just enlarged mobile.
- [ ] Mobile operational lists use cards when required.
- [ ] Mobile financial/audit/permission tables remain usable.

## E. Interaction And Accessibility

- [ ] Touch targets are at least 44 x 44 CSS pixels.
- [ ] Keyboard navigation works.
- [ ] Focus is visible on every surface.
- [ ] Focus returns correctly after dialog/sheet closes.
- [ ] Icon-only controls have accessible names.
- [ ] Critical meaning does not depend on color alone.
- [ ] Reduced motion works.
- [ ] Touch devices do not rely on hover or pointer-following effects.
- [ ] Long Vietnamese and English text does not overflow containers.
- [ ] Disabled/loading controls do not animate or accept repeated actions.
- [ ] Motion-off removes decorative feedback; reduced motion uses a brief non-spatial alternative.

## F. Motion And Performance

- [ ] Motion is meaningful and does not delay actions.
- [ ] No excessive bounce or page-load choreography.
- [ ] Transform and opacity are preferred.
- [ ] No backdrop blur or translucent structural material.
- [ ] No unnecessary continuous animation.
- [ ] Large lists are handled appropriately.
- [ ] Scrolling and typing remain responsive.
- [ ] Shared sidebar active indicator moves without remounting a separate decoration per destination.
- [ ] Notification arrival motion does not replay on initial list render.

## G. Code Quality

- [ ] Types are correct.
- [ ] No duplicated component logic.
- [ ] Existing i18n architecture is preserved.
- [ ] Existing permission guards are preserved.
- [ ] No hard-coded production data.
- [ ] No unrelated API or workflow changes.
- [ ] No unused dependencies or dead code introduced.
- [ ] Dependencies are necessary, scoped, and recorded.
- [ ] Feature code uses shared surface, button, icon-button, and navigation primitives.
- [ ] Operational metrics and count/status tiles use the shared `StatCard` primitive rather than feature-local metric cards.

## H. Validation Commands

Run commands that actually exist in `frontend/package.json`:

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] relevant `npm run test` target or focused tests
- [ ] `npm run build`

Record command results honestly. Do not claim a command passed unless it was run successfully.

## I. Final Report

The completion message must include:

- changed files;
- major UX/design decisions;
- responsive behavior;
- states covered;
- accessibility and motion behavior;
- commands run and results;
- known limitations;
- backend/API/database changes, or explicitly state none.
