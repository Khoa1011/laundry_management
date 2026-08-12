# Design

## Overview

This document is the canonical design contract for the React, TypeScript, and Tailwind CSS v4 frontend. Every new screen, module, shared component, and visual refactor must follow it unless this document is deliberately updated first.

The interface language is Vietnamese. Mobile phones and Android POS devices are the primary surfaces; tablet, POS landscape, laptop, and desktop administration layouts are currently supported surfaces that extend the same information architecture and business workflows.

## Design Intent

Physical scene: a laundry counter during a bright morning rush, one hand on a phone-sized screen, customers waiting, receipt printer nearby, and staff needing calm confirmation instead of visual noise.

Use a restrained product UI. The surface should stay bright and practical; brand color is an accent for primary action and selection, not a decorative wash over the app.

## Color

Use OKLCH tokens. The Liquid Glass refresh direction uses a balanced laundry green as the primary brand family, with a restrained teal operational accent and explicit semantic status colors. The legacy cranberry tokens may exist during migration, but new UI work should depend on semantic tokens rather than raw palette names.

```css
:root {
  --color-bg: oklch(1.000 0.000 0);
  --color-surface: oklch(0.985 0.006 165);
  --color-surface-raised: oklch(0.965 0.008 165);
  --color-ink: oklch(0.235 0.030 165);
  --color-muted: oklch(0.505 0.030 165);
  --color-border: oklch(0.880 0.018 165);
  --color-primary: oklch(0.500 0.115 165);
  --color-primary-hover: oklch(0.430 0.105 165);
  --color-primary-soft: oklch(0.940 0.030 165);
  --color-accent: oklch(0.560 0.105 190);
  --color-accent-soft: oklch(0.925 0.035 190);
}
```

Semantic colors should be explicit rather than inferred from the brand palette:

```css
:root {
  --color-success: oklch(0.520 0.130 150);
  --color-success-soft: oklch(0.930 0.040 150);
  --color-warning: oklch(0.700 0.145 80);
  --color-warning-soft: oklch(0.955 0.050 80);
  --color-danger: oklch(0.500 0.180 28);
  --color-danger-soft: oklch(0.940 0.040 28);
  --color-info: oklch(0.540 0.125 250);
  --color-info-soft: oklch(0.935 0.035 250);
}
```

Use white text on saturated filled colors. Muted text must remain readable against white and raised surfaces.

## Typography

Use a single UI sans stack:

```css
--font-ui: "Noto Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
```

Type should be compact and steady:

- Page title: 24px / 32px, 700
- Section title: 18px / 26px, 700
- Body: 15px / 22px, 400
- Dense body and table text: 14px / 20px, 400
- Labels: 13px / 18px, 600
- Helper text: 13px / 18px, 400

Avoid display typography in operational screens. Vietnamese labels should not be uppercase-tracked by default because tone marks and quick scanning matter more than styling.

## Layout

Design mobile-first. The default workflow assumption is a phone-width or Android POS counter experience, but tablet, POS landscape, laptop, and desktop administration layouts must be intentionally designed and verified.

- Preserve the same business state and information architecture across mobile and desktop.
- Use one primary task column on mobile.
- Keep mobile primary actions in reach near the bottom or immediately after the active form section.
- Use sticky headers only when they preserve task context.
- Avoid nested cards. Use panels for grouped forms, repeated cards for order/customer rows, and full-width bands for major screen regions.
- Tablet and POS landscape layouts should use the extra space intentionally with compact two-column or split-context views where useful.
- Desktop layouts should use supported administration patterns such as sidebar navigation, split panes, denser filters, and comparison tables without changing the underlying workflow model.

Recommended structural breakpoints:

- `0-479px`: phone counter flow, single column, bottom action area
- `480-767px`: large phone and POS, denser rows, larger touch controls
- `768-1199px`: tablet, POS landscape, and small desktop, two-column detail views where useful
- `1200px+`: desktop administration, persistent navigation and comparison tables

## Components

Canonical component vocabulary:

- App shell: compact top bar, current shop/context area, primary navigation, user/session affordance
- Bottom navigation or task switcher for mobile-first core areas
- Order list row with status, customer cue, promised time, payment cue, and next action
- Order detail sections for items, notes, totals, payment, and receipt activity
- Customer lookup and customer summary
- Payment entry panel with clear collected/remaining/change/debt language after rules are confirmed
- Inventory item row with stock state and action controls
- Revenue and expense entry forms
- Employee list/detail surfaces
- Receipt print status and retry/reprint affordances

Every interactive component needs default, hover where relevant, pressed, focus-visible, disabled, loading, error, and success states. Loading should prefer skeletons in context rather than centered spinners.

Shared buttons and icon buttons own their interaction behavior. Feature modules must use the repository primitives instead of recreating hover, press, loading, focus, or ripple logic. Navigation destinations remain direct links; the active desktop sidebar destination uses one shared moving indicator rather than mounting an unrelated active decoration inside every item.

## Interaction

Primary actions should use clear Vietnamese verbs such as `Tạo đơn`, `Lưu`, `Thu tiền`, `In hóa đơn`, and `Xác nhận` only where the underlying behavior is confirmed. When business behavior is unresolved, UI copy should be framed as placeholders or design examples, not final rules.

Touch targets should be at least 44px high. Destructive or irreversible actions should require clear confirmation space once domain rules define what is reversible.

Forms should support fast correction: inline validation, field-level hints, and visible summaries for totals or required missing data. Error messages should explain what to fix, not only that something failed.

Pointer press feedback may originate from the exact click or tap location and expand to the farthest control corner. Keyboard activation originates from the control center. This feedback is visual only: it must never delay navigation, form submission, or command execution; disabled controls must not emit it; repeated activation must clean up completed effects. Reduced motion uses a brief static highlight, while motion-off uses no decorative feedback.

## Motion

Use short, state-driven motion only:

- 120-180ms for primitive controls, tabs, badges, and pressed states.
- 180-240ms for dialogs, sheets, sidebar transitions, and mounted/unmounted overlays.
- No visible bounce, elastic movement, or page-load choreography.
- Respect `prefers-reduced-motion: reduce`.

Motion should confirm state changes, loading progress, selection, and panel transitions. It should not decorate routine operations.

Press feedback begins immediately and releases with a restrained spring or equivalent non-bouncing easing. A ripple may outlive the 120-180ms press transition only as a non-blocking opacity/scale afterimage; it must not change layout, retain event handlers after completion, or replay on mount.

React Router view transitions are optional enhancements. They must never be the only transition path; every route or overlay interaction must remain usable with a non-blocking CSS transition, Motion transition, or instant reduced-motion fallback.

## Content

Vietnamese should be the default UI language. Prefer concise operational copy:

- Short labels for repeated controls
- Specific status text
- Plain error explanations
- No marketing copy inside task screens

Do not encode unresolved business rules as final UI language. For example, payment timing, refund behavior, debt handling, order cancellation, stock adjustments, revenue recognition, and receipt numbering all depend on future confirmation in `docs/BUSINESS_RULES.md`.

## Accessibility

Design toward WCAG 2.2 AA unless the project later confirms a different target.

- Visible focus state on all interactive controls
- Form labels always visible or programmatically associated
- Error text tied to fields
- Color never used as the only status cue
- Minimum 4.5:1 contrast for normal text
- Reduced-motion alternatives
- Layouts usable at mobile widths without horizontal scrolling except intentional data tables

## Implementation Notes

Tailwind CSS v4 should map these OKLCH values into theme tokens before components are built. Use semantic token names in components rather than raw colors so future business states and themes can evolve safely.

## Liquid Glass Direction

Liquid Glass is part of the project design contract for frontend UI work. Before creating, redesigning, polishing, or auditing any interface, read:

```text
.agents/skills/laundry-admin-liquid-glass/SKILL.md
docs/design/LIQUID_GLASS_ADMIN_RULES.md
docs/design/UI_IMPLEMENTATION_CHECKLIST.md
```

Use medium-strength Liquid Glass on structural surfaces where it helps hierarchy: sidebar, header, mobile bottom navigation, dialogs, sheets, notification center, command palette, selected KPI cards, and high-priority action affordances. Dense forms, tables, permission matrices, audit logs, finance records, and reconciliation views should stay opaque or nearly opaque.

Structural glass uses an iOS-inspired material treatment: layered translucency, backdrop saturation, a bright inner top edge, a restrained lower edge, and soft depth. The shared application canvas may use broad, static, semantic Laundry Green and teal radial washes solely to make translucent material depth perceptible; these washes must remain very pale, non-animated, and subordinate to operational content. On mobile, persistent navigation and context-specific actions may use separate floating glass docks only when they are physically separated, remain reachable, preserve safe-area spacing, and never cover page content. This direction does not authorize decorative gradients, discrete gradient orbs, decorative glass, glass-on-glass nesting, proprietary Apple assets, or reduced information clarity.

Glass must be implemented through repository-owned shared components and semantic tokens. Feature modules must not hard-code blur, tint, border, shadow, z-index, motion timing, or direct third-party glass effects. Every glass surface needs a readable solid fallback for browsers, weak devices, reduced transparency, and high-density data screens.

Shared Liquid Glass components expose three rendering levels:

- `premium`: progressive enhancement for selected high-priority controls on capable devices with advanced effects enabled.
- `standard`: the normal repository-owned translucent material for structural surfaces and controls.
- `reduced`: opaque or nearly opaque material with no backdrop blur for reduced transparency, weak devices, unsupported browsers, and lower-cost mobile/POS presentation.

Premium rendering is never a feature-level dependency. It must degrade to `standard` and then `reduced` without changing control semantics, dimensions, focus order, accessible names, or command timing.

Balanced green is the Liquid Glass brand direction. Use it for primary actions, active navigation, focus, selection, restrained glass tint, and positive KPI emphasis. Do not wash every surface green, and do not let visual treatment redefine business status meaning.

## Canonical Design-System Rule

The following existing files and directories are the implementation source of truth:

```text
frontend/src/styles/tokens.css
frontend/src/styles/themes.css
frontend/src/styles/redesign.css
frontend/src/styles/liquid-glass.css
frontend/src/styles/motion.css
frontend/src/providers/ThemeProvider.tsx
frontend/src/providers/MotionProvider.tsx
frontend/src/components/glass/GlassSurface.tsx
frontend/src/components/glass/PremiumLiquidSurface.tsx
frontend/src/components/motion/LiquidRipple.tsx
frontend/src/components/motion/LiquidInteractionRoot.tsx
frontend/src/components/navigation/LiquidNavLink.tsx
frontend/src/components/ui/Button.tsx
frontend/src/components/ui/IconButton.tsx
frontend/src/components
docs/design/LIQUID_GLASS_ADMIN_RULES.md
docs/design/UI_IMPLEMENTATION_CHECKLIST.md
```

These paths are the current implementation architecture. If the architecture changes later, update this list to match actual files and directories; do not create empty files just to satisfy this document.

Feature modules must reuse semantic tokens and shared primitives. They must not introduce raw brand colors, arbitrary spacing, radii, shadows, z-index values, blur values, glass tints, or animation curves.

Use CSS transitions for primitive control states and the `motion` package for mounted/unmounted overlays, toast layout changes, shared indicators, and structural transitions. React Router view transitions may be layered on top only as optional enhancements with non-blocking CSS, Motion, or instant fallbacks. Routine motion stays within the timing bands in this document, avoids visible bounce and page-load choreography, and respects reduced motion.

The shared interaction layer owns pointer-origin ripple geometry, keyboard-origin feedback, press state, cleanup, and compatibility behavior for legacy shared control classes during migration. New feature code must consume shared button, icon-button, glass, and navigation primitives directly; it must not depend on the compatibility layer as its long-term API.

Money input, evidence capture, media preview, overlays, state panels, toast behavior, buttons, fields, badges, tabs, filters, tables, and fixed actions must remain visually and behaviorally consistent across modules.

Desktop navigation uses a 232px expanded sidebar and a 76px collapsed sidebar. The collapse preference is stored per browser. In collapsed mode, every navigation icon remains a direct link; it must keep its active and focus-visible states and expose an accessible label plus a desktop tooltip. Mobile navigation continues to use the drawer and bottom navigation rather than inheriting the desktop collapse state.

Update this document first when a deliberate system-wide visual decision changes. Visual changes do not change backend behavior, API contracts, permissions, branch scope, or business rules.
