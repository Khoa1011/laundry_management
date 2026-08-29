# Design

## Overview

This is the canonical visual contract for the React, TypeScript, and Tailwind CSS v4 frontend. Update this file before making a deliberate system-wide visual change.

The product is a Vietnamese laundry operations application. Mobile browsers and Android POS devices are the primary surfaces; tablet and desktop administration layouts extend the same workflows and state.

## Design intent

The interface is a calm, bright operational workspace inspired by the approved admin reference: an icy-blue canvas, opaque white panels, deep navy text, sky-blue primary actions, cyan operational accents, soft yellow warnings, and coral attention states.

The system is intentionally solid and opaque. Do not use backdrop blur, translucent glass, liquid refraction, decorative gradient orbs, or glass-on-glass nesting. Visual quality comes from hierarchy, spacing, typography, restrained borders, and short state-driven motion.

The authentication entry surface is the only bounded spatial-brand exception. Its illustration may use opaque CSS-built laundry objects, layered depth, soft palette gradients, and pointer-driven parallax to match the approved login reference. The form panel itself remains opaque, stable, and fully usable without motion. Spatial movement is available only to fine pointers at `full` or `balanced` motion levels; `reduced`, `off`, coarse-pointer, and narrow-screen presentations use a static composition. This exception must not spread into operational tables, forms, dialogs, or navigation.

## Color

Feature code must consume semantic tokens from `frontend/src/styles/tokens.css` and `frontend/src/styles/themes.css`. Raw colors belong only in those theme files.

Core palette:

```css
:root {
  --sky-500: #3b82f6;
  --cyan-500: #06b6d4;
  --yellow-400: #fbbf24;
  --coral-400: #fb7185;
  --navy-950: #0f172a;
  --slate-600: #475569;
  --slate-400: #94a3b8;
  --slate-200: #e2e8f0;
  --canvas: #f5f9fd;
  --white: #ffffff;
}
```

- Sky blue: primary actions, active navigation, focus, selected controls.
- Cyan: operational information, secondary highlights, selected data cues.
- Yellow: warnings and time-sensitive attention.
- Coral: destructive actions, errors, overdue or exceptional states.
- Navy and slate: readable content hierarchy.
- Semantic status must always include text or an icon; color is never the only cue.

## Typography

Use one UI stack:

```css
--font-ui: "Noto Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
```

- Page title: 24px / 32px, 700.
- Section title: 18px / 26px, 700.
- Body: 15px / 22px, 400.
- Dense body and table: 14px / 20px, 400.
- Label: 13px / 18px, 600.
- Helper text: 13px / 18px, 400.

Keep Vietnamese labels concise and normally cased. Avoid display typography, excessive weight changes, and uppercase tracking in operational screens.

## Layout

Build mobile first, then enhance at tablet and desktop widths. Mobile is not a scaled desktop layout.

- Mobile: one task column, 16px page gutter, card-based data, filter sheet, safe-area-aware bottom navigation.
- Tablet: use extra width for paired fields and split context only where it improves the task.
- Desktop: 248px expanded or 84px collapsed inset sidebar, 72px inset header, dense filters and tables, main content capped at 1440px.
- Standard panels use opaque white backgrounds, 12-16px radii, a subtle border, and little or no shadow.
- Stat cards are a deliberate elevated exception: use an opaque white surface, no decorative border, a short `--shadow-sm`, a 12px radius, and a semantic tinted icon tile. Labels remain quiet while the primary value carries the strongest type weight. Stat cards must use the shared `StatCard` primitive and responsive `stat-card-grid`; do not recreate metric tiles inside a feature.
- Avoid nested cards and avoid stretching simple forms across wide displays.
- Focused transaction screens hide bottom navigation and use a clear back action plus fixed action area when needed.

Required test viewports are defined in `docs/design/UI_IMPLEMENTATION_CHECKLIST.md`.

## Navigation

Desktop navigation uses an opaque icy-blue inset sidebar with a restrained 16px outer radius and canvas gutter. Each destination owns a 40px semantic icon tile; the active item uses one shared moving pale-blue full-row fill and a primary icon tile, without a side-stripe indicator. Hover may change the tile and row fill subtly but must not move layout. Collapsed items remain direct links with accessible labels and desktop tooltips.

The desktop header is an opaque white inset panel aligned to the application canvas, with a restrained 16px radius and compact shadow. Branch context stays on the left; notification, appearance, language, user identity, and logout controls form a coherent right-hand command cluster. It must remain readable at laptop heights and may collapse secondary labels before controls become compressed.

Mobile uses a drawer plus an opaque bottom navigation bar with no more than five destinations. It must never overlap the final page content. Desktop sidebar and mobile bottom navigation are never visible together.

## Components

Canonical shared primitives include:

- `Button`, `ButtonLink`, `IconButton`, `IconButtonLink`, portaled `ActionMenu`, and `CollapsibleFilterPanel`.
- `Surface` for opaque panels and grouped regions.
- `StatCard` for single operational metrics, counts, status summaries, and compact comparison values.
- `AppNavLink` for sidebar, drawer, bottom navigation, and module tabs.
- `OverlayDialog`, state panels, toasts, badges, fields, filters, tables, and fixed actions.

Every interactive component needs default, hover where relevant, active, focus-visible, disabled, and loading states. Data-driven screens also need loading, empty, error, success, long-content, and permission-denied behavior.

Shared primitives own interaction styling. Feature modules must not recreate buttons, moving navigation indicators, surface elevation, focus rings, or motion curves.

## Interaction and motion

- Touch targets are at least 44 x 44px.
- Routine control feedback runs for 120-180ms.
- Drawers, dialogs, sidebar transitions, and shared indicators run for 180-240ms.
- Create and add commands use the shared `create` button variant. It keeps the leading action icon and uses one left-to-right primary fill over 250ms with standard `ease` timing on hover, keyboard focus, and press; disabled and loading states do not animate, and reduced motion changes state instantly.
- No bounce, elastic movement, page-load choreography, pointer ripples, or decorative looping animation.
- Use CSS for primitive states and `motion` for mounted overlays and shared indicators.
- Respect reduced-motion preferences. Motion-off must remain fully usable.
- Motion must never delay navigation, form submission, or business commands.
- Login parallax responds directly to pointer position and returns to rest on pointer exit. It must not run as a decorative loop, move form controls, or exceed the shared 240ms structural timing when settling.
- Table action menus use the shared portaled fan-out interaction. A compact sky-blue Phosphor trigger expands semantic filled action icons away from the nearest viewport edge over 240ms; the icons begin overlapped with distinct rotations and settle upright. View actions use operational cyan, edit actions use primary sky blue, and a third generic action uses neutral slate unless its business meaning requires a dedicated semantic tone. Click and hover must play the same entrance motion; touch, keyboard, Escape, outside press, and reduced motion must all remain usable.
- Advanced filter groups start collapsed behind the shared `CollapsibleFilterPanel` toggle while primary search remains visible. The toggle uses a restrained sky-blue surface with a cyan Phosphor icon tile. On tablet and desktop, search and the collapsed toggle share the first toolbar row; the expanded controls occupy a full-width row below. Mobile may stack the search and toggle to preserve usable control widths. Opening uses the action-menu motion language: the filled funnel settles upright while filter controls fan from a slightly overlapped, rotated state into a responsive grid over 240ms. Closing reverses the movement. Active-filter counts remain visible when collapsed; collapsed controls are inert and hidden from assistive technology.

## Forms and data

Inputs have visible labels, appropriate input modes, nearby validation, and visible focus. On invalid submit, focus or scroll to the first invalid field. Important forms warn before leaving only after actual changes.

Desktop may use tables for comparison and bulk work. Mobile uses cards for primary business lists unless the data is inherently tabular. Mobile and desktop presentations share the same query, filters, permissions, mutations, and business state.

## Content and accessibility

Vietnamese is the default language. Use concise operational verbs only where behavior is confirmed by `docs/BUSINESS_RULES.md`. Do not turn unresolved rules into final copy.

Target WCAG 2.2 AA:

- Visible focus on every interactive control.
- Programmatic labels and field-linked errors.
- Minimum 4.5:1 contrast for normal text.
- Keyboard, mouse, touch, and reduced-motion support.
- No unintended horizontal scrolling at 360px.
- Essential information and actions must not depend on hover.

## Canonical implementation sources

```text
frontend/src/styles/tokens.css
frontend/src/styles/themes.css
frontend/src/styles/global.css
frontend/src/styles/redesign.css
frontend/src/styles/solid-admin.css
frontend/src/styles/auth.css
frontend/src/styles/landing.css
frontend/src/styles/motion.css
frontend/src/providers/ThemeProvider.tsx
frontend/src/providers/MotionProvider.tsx
frontend/src/components/ui/Surface.tsx
frontend/src/components/auth/LoginBrandScene.tsx
frontend/src/components/ui/Button.tsx
frontend/src/components/ui/IconButton.tsx
frontend/src/components/navigation/AppNavLink.tsx
frontend/src/components
docs/design/SOLID_ADMIN_RULES.md
docs/design/UI_IMPLEMENTATION_CHECKLIST.md
```

Feature code must not introduce raw brand colors, arbitrary spacing, radii, shadows, z-index values, or animation curves. Preserve API contracts, permissions, branch scope, validation, loading, empty, error, success, and keyboard behavior during visual changes.
