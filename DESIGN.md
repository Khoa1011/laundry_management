# Design

## Overview

Initial design context for the laundry management application. This is a pre-implementation design direction for a React, TypeScript, and Tailwind CSS v4 frontend. It should guide the first UI build without changing backend behavior or confirming unresolved business rules.

The interface language is Vietnamese. The primary surfaces are mobile phones and Android POS devices, with future desktop management screens.

## Design Intent

Physical scene: a laundry counter during a bright morning rush, one hand on a phone-sized screen, customers waiting, receipt printer nearby, and staff needing calm confirmation instead of visual noise.

Use a restrained product UI. The surface should stay bright and practical; brand color is an accent for primary action and selection, not a decorative wash over the app.

## Color

Use OKLCH tokens. The seed hue is carried by a deep cranberry primary, balanced by a teal operational accent so the interface does not become a single red system.

```css
:root {
  --color-bg: oklch(1.000 0.000 0);
  --color-surface: oklch(0.972 0.004 355);
  --color-surface-raised: oklch(0.945 0.006 355);
  --color-ink: oklch(0.190 0.018 355);
  --color-muted: oklch(0.420 0.016 355);
  --color-border: oklch(0.870 0.010 355);
  --color-primary: oklch(0.455 0.155 355);
  --color-primary-hover: oklch(0.405 0.165 355);
  --color-primary-soft: oklch(0.930 0.030 355);
  --color-accent: oklch(0.560 0.125 190);
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

Use a single UI sans stack for the first implementation:

```css
--font-sans: Inter, "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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

Design mobile-first. The default viewport assumption is a narrow phone or Android POS browser.

- Use one primary task column on mobile.
- Keep primary actions in reach near the bottom or immediately after the active form section.
- Use sticky headers only when they preserve task context.
- Avoid nested cards. Use panels for grouped forms, repeated cards for order/customer rows, and full-width bands for major screen regions.
- Future desktop layouts can add side navigation, split panes, and wider data tables without changing mobile information hierarchy.

Recommended structural breakpoints:

- `0-479px`: phone counter flow, single column, bottom action area
- `480-767px`: large phone and POS, denser rows, larger touch controls
- `768-1199px`: tablet and small desktop, two-column detail views where useful
- `1200px+`: desktop management, persistent navigation and comparison tables

## Components

Initial component vocabulary:

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

## Interaction

Primary actions should use clear Vietnamese verbs such as `Tạo đơn`, `Lưu`, `Thu tiền`, `In hóa đơn`, and `Xác nhận` only where the underlying behavior is confirmed. When business behavior is unresolved, UI copy should be framed as placeholders or design examples, not final rules.

Touch targets should be at least 44px high. Destructive or irreversible actions should require clear confirmation space once domain rules define what is reversible.

Forms should support fast correction: inline validation, field-level hints, and visible summaries for totals or required missing data. Error messages should explain what to fix, not only that something failed.

## Motion

Use short, state-driven motion only:

- 150-200ms for button, tab, row, and sheet transitions
- 200-250ms for bottom sheets or detail panels
- No page-load choreography
- Respect `prefers-reduced-motion: reduce`

Motion should confirm state changes, loading progress, selection, and panel transitions. It should not decorate routine operations.

## Content

Vietnamese should be the default UI language. Prefer concise operational copy:

- Short labels for repeated controls
- Specific status text
- Plain error explanations
- No marketing copy inside task screens

Do not encode unresolved business rules as final UI language. For example, payment timing, refund behavior, debt handling, order cancellation, stock adjustments, and receipt numbering all depend on future confirmation in `docs/BUSINESS_RULES.md`.

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

No frontend implementation exists yet in this document. No backend behavior is changed by this design context.
