# Liquid Glass Admin Rules

This document extends the root `DESIGN.md`. It defines how Liquid Glass is applied in the laundry-management admin/PWA without creating a second design system.

If this document conflicts with root `DESIGN.md`, update root `DESIGN.md` first or treat root `DESIGN.md` as the source of truth.

## 1. Design Intent

Use a light, mobile-first operations interface with medium-strength Liquid Glass. The UI should feel premium, calm, and modern, but staff must still be able to read dense data quickly during counter work.

Liquid Glass is a hierarchy tool, not decoration. Use it to separate navigation, overlays, selected summaries, and high-priority actions from routine content.

## 2. Source Of Truth

The implementation source of truth remains:

```text
DESIGN.md
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
```

New shared Liquid Glass primitives live under repository-owned component layers:

```text
frontend/src/components/glass/
frontend/src/components/motion/
frontend/src/components/navigation/
frontend/src/components/ui/
```

Create these folders only when implementation needs them. Do not create empty architecture.

## 3. Dependency Policy

The current frontend already has repository-owned components and the `motion` package. It does not currently depend on a third-party Liquid Glass or UI library. `motion` remains the animation owner.

Rules:

- Do not assume those libraries exist.
- Do not install UI dependencies just to achieve a visual effect unless the user explicitly approves the dependency decision.
- If an external Liquid Glass example is useful, adapt the pattern into repository-owned components.
- Feature modules must not directly import experimental glass effects from third-party libraries.
- If a future dependency is approved, wrap it behind repository-owned components first.
- A dependency approval does not authorize feature modules to import it directly or replace the shared component API.

## 4. Brand Direction

Balanced green is the Liquid Glass direction. Use it through semantic tokens for:

- primary actions;
- active navigation;
- focus and selection;
- restrained glass tint and highlights;
- positive KPI emphasis where semantically correct.

Do not color every surface green. Do not use green to mean every positive, active, paid, done, or safe state unless the business meaning actually matches.

Use OKLCH and semantic token names in implementation. Raw hex/RGB values belong only in design notes, never in feature CSS or TSX.

## 5. Surface Strength

Use controlled variants:

```text
subtle
standard
strong
opaque
```

Recommended mapping:

- `subtle`: search, filters, low-priority summaries.
- `standard`: sidebar, header, mobile bottom navigation, common KPI cards.
- `strong`: dialogs, sheets, notification center, command palette.
- `opaque`: dense or sensitive operational data.

Rendering level is separate from surface strength:

- `premium`: progressive highlights/refraction for a very small number of high-priority controls on capable devices.
- `standard`: normal repository Liquid Glass.
- `reduced`: no-blur, lower-cost, opaque or nearly opaque rendering.

Dense tables, long forms, audit logs, permission matrices, finance records, and reconciliation views should use opaque or nearly opaque surfaces.

## 6. Token Requirements

Add or migrate Liquid Glass values through shared tokens only. Suggested semantic roles:

```css
:root {
  --glass-bg-subtle: color-mix(in oklch, var(--surface) 88%, transparent);
  --glass-bg-standard: color-mix(in oklch, var(--surface) 78%, transparent);
  --glass-bg-strong: color-mix(in oklch, var(--surface) 68%, transparent);
  --glass-tint: color-mix(in oklch, var(--primary) 8%, transparent);
  --glass-border: color-mix(in oklch, var(--primary) 18%, var(--border-default));
  --glass-highlight: color-mix(in oklch, white 76%, transparent);
  --glass-shadow: 0 10px 28px oklch(0.22 0.035 165 / 0.10);
  --glass-blur-subtle: 8px;
  --glass-blur-standard: 14px;
  --glass-blur-strong: 20px;
}
```

Tune these in `frontend/src/styles/tokens.css` and `frontend/src/styles/themes.css`, not inside feature modules.

Every glass primitive must provide a no-blur fallback:

```css
.glass-surface {
  background: var(--surface);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-sm);
}

@supports (backdrop-filter: blur(1px)) {
  .glass-surface {
    background: var(--glass-bg-standard);
    border-color: var(--glass-border);
    -webkit-backdrop-filter: blur(var(--glass-blur-standard)) saturate(1.12);
    backdrop-filter: blur(var(--glass-blur-standard)) saturate(1.12);
  }
}
```

## 7. Component Architecture

The repository owns the final component API:

```text
semantic tokens
-> repository UI primitives
-> glass and motion adapters
-> feature components
-> pages
```

Feature code consumes `GlassSurface`, `PremiumLiquidSurface`, `Button`, `ButtonLink`, `IconButton`, `IconButtonLink`, and `LiquidNavLink` as applicable. `LiquidInteractionRoot` is a migration bridge for legacy shared classes, not the API for new feature code.

Do not scatter direct backdrop-filter declarations across pages. If two pages need the same glass behavior, extract or extend a shared primitive first.

Buttons own default, hover, press, focus-visible, disabled, loading, and ripple behavior. Pointer ripple starts at the click/tap coordinate and reaches the farthest corner; keyboard activation starts at center. Actions execute immediately. Completed and repeated ripples must clean up, reduced motion uses a brief highlight, and motion-off emits no decorative feedback.

Desktop sidebar destinations remain direct links and use one shared moving active indicator. Drawer and mobile navigation use the same interaction foundation without inheriting desktop collapse state.

## 8. Motion

Use `MotionProvider` and shared motion tokens. Motion may be visible, but it must stay fast and functional.

Preferred uses:

- sidebar collapse;
- mobile drawer;
- tab indicator;
- filter expansion;
- dialog and sheet enter/exit;
- KPI update;
- status transition;
- realtime notification;
- success confirmation.

Avoid:

- looping decorative movement;
- bounce or elastic effects;
- animating every table row during routine loading;
- cursor-following effects across large page areas;
- continuous blur, gradient, or shadow animation;
- animation that delays reading, typing, or clicking.

Primitive press/color transitions stay within 120-180ms. Overlays and structural transitions stay within 180-240ms. The ripple opacity/scale afterimage may run longer only because it is non-blocking, does not affect layout, and never delays the command.

Respect `prefers-reduced-motion`. Future user-facing motion preferences should follow this priority:

1. operating-system reduced-motion preference;
2. explicit user setting;
3. automatic weak-device downgrade;
4. product default.

## 9. Responsive Data Display

Operational records may become cards on mobile:

- laundry orders;
- customers;
- employees;
- notifications;
- machines;
- delivery;
- complaints;
- shifts.

Dense records may keep table semantics with contained horizontal scrolling:

- income and expense;
- payment history;
- cash reconciliation;
- inventory movement;
- audit logs;
- permission matrices;
- detailed reports.

Rules:

- never allow accidental page-level horizontal scrolling;
- keep table scrolling inside the table container;
- show a visual cue when horizontal scrolling is available;
- keep action controls reachable;
- use sticky identifier columns only when useful and tested.

## 10. Dashboard Hierarchy

Do not render every dashboard metric as an identical glass card. Use hierarchy:

1. Revenue today, week, and month.
2. Income, expense, and net cash flow.
3. Revenue trend.
4. Laundry operation pipeline.
5. Alerts and exceptions.

Operational pipeline states should remain distinct from payment, delivery, print, and debt states.

## 11. Accessibility

- Maintain WCAG AA contrast where practical.
- Keep focus rings visible on glass.
- Do not communicate status by color alone.
- Provide accessible names for icon-only controls.
- Tooltips must not be required to understand essential actions.
- Critical action text must remain readable over translucent surfaces.
- Disabled and unavailable states must remain visually and semantically clear.
- Dialogs and sheets must trap focus and restore focus on close.
- Support reduced motion and reduced transparency.

## 12. Performance

- Avoid more than a small number of large blurred surfaces in one viewport.
- Never apply backdrop blur to every table row or cell.
- Disable pointer-reactive effects on touch-only devices.
- Pause nonessential animation when the document is hidden.
- Avoid page-wide animated gradients on low-power devices.
- Lazy-load heavy visualization code.
- Virtualize large lists only when real data volume requires it.
- Do not trade typing responsiveness or scroll smoothness for decoration.
- Keep notification rows opaque or nearly opaque while the notification panel and toasts may use strong glass.
- Realtime insertion may highlight only the newly received record and bell; it must not replay for initial data.

## 13. Forbidden Patterns

Do not:

- create page-local random glass styles;
- stack glass cards inside glass cards;
- replace all borders with glow;
- add shiny borders around every action;
- animate all rows during data refresh;
- hide required data behind hover states;
- remove labels for minimalism;
- hard-code production data or permission decisions;
- change business statuses to fit the visual design;
- create separate mobile and desktop business logic for the same data.
