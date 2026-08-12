# UI Implementation Checklist

Use this checklist before declaring a frontend UI task complete.

## A. Context And Scope

- [ ] Read the closest `AGENTS.md`.
- [ ] Use `impeccable`.
- [ ] Use `.agents/skills/laundry-admin-liquid-glass/SKILL.md`.
- [ ] Read `PRODUCT.md`.
- [ ] Read root `DESIGN.md`.
- [ ] Read `docs/design/LIQUID_GLASS_ADMIN_RULES.md`.
- [ ] Identify the exact pages/components in scope.
- [ ] Identify business logic, APIs, permissions, i18n keys, and routes that must remain unchanged.
- [ ] Inspect existing shared components and style tokens before adding new primitives.

## B. Design-System Compliance

- [ ] Uses semantic tokens from the project theme/style layer.
- [ ] Reuses or extends repository-owned components.
- [ ] No page-local duplicate glass primitive.
- [ ] No raw hex, RGB, blur, radius, shadow, z-index, or motion values inside feature modules.
- [ ] Liquid Glass strength matches the surface purpose.
- [ ] Dense tables/forms remain readable and opaque or nearly opaque.
- [ ] Status colors include text and/or icon.
- [ ] Sidebar/header information architecture is preserved unless explicitly changed.
- [ ] External UI effects are wrapped behind repository-owned components if approved.
- [ ] New commands use shared `Button`/`IconButton` primitives; new navigation uses shared navigation primitives.
- [ ] Premium rendering is limited and degrades to standard/reduced without semantic or layout changes.

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
- [ ] Focus is visible on glass and opaque surfaces.
- [ ] Focus returns correctly after dialog/sheet closes.
- [ ] Icon-only controls have accessible names.
- [ ] Critical meaning does not depend on color alone.
- [ ] Reduced motion works.
- [ ] Reduced transparency/no-blur fallback works where glass is used.
- [ ] Touch devices do not rely on hover or pointer-following effects.
- [ ] Long Vietnamese and English text does not overflow containers.
- [ ] Pointer ripple originates at the press location; keyboard feedback originates at center.
- [ ] Disabled/loading controls emit no ripple and repeated feedback cleans up.
- [ ] Motion-off removes decorative feedback; reduced motion uses a brief non-spatial alternative.

## F. Motion And Performance

- [ ] Motion is meaningful and does not delay actions.
- [ ] No excessive bounce or page-load choreography.
- [ ] Transform and opacity are preferred.
- [ ] No backdrop blur on every row/cell.
- [ ] Weak-device and no-blur fallbacks are available.
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
- [ ] No unapproved dependency installation.
- [ ] Feature code does not depend on `LiquidInteractionRoot`; it uses shared primitives directly.

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
