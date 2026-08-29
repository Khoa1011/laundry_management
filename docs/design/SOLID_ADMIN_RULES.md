# Solid Admin Rules

This document extends the root `DESIGN.md` for implementation work.

## Material and hierarchy

- The application canvas is pale icy blue.
- Sidebar, header, dialogs, bottom navigation, forms, cards, tables, and popovers are opaque.
- Desktop sidebar and header use inset canvas gutters. The sidebar uses the icy navigation surface; the header remains a white command panel. Both use the shared 16px shell radius.
- Use borders and spacing before shadows. Reserve the medium shadow for floating overlays.
- Do not use blur, transparency, refraction, gradient orbs, decorative sheen, or pointer ripples.
- A page normally has one visually dominant primary action.

## Sidebar

- Expanded width: 232px. Collapsed width: 76px.
- Active navigation uses one shared animated pale-blue full-row fill plus a primary semantic icon tile. Do not add a side-stripe indicator.
- Desktop navigation icons live in consistent 40px tiles. Inactive tiles are opaque neutral surfaces; selected and hovered tiles use semantic primary surfaces.
- The indicator moves between destinations in 180-240ms and becomes instant under reduced motion.
- Hover may tint the row and translate its icon by no more than 2px.
- Collapse changes width without hiding link semantics or accessible names.

## Surfaces

Use `Surface` variants instead of feature-local panel styling:

- `base`: routine white panel with a subtle border.
- `raised`: floating overlay with a restrained shadow.
- `subtle`: low-emphasis grouped region.
- `selected`: selected or active region using the primary soft token.

### Stat cards

- Use the shared `StatCard` primitive for one metric or status summary.
- Stat cards use an opaque white surface, no decorative border, `--shadow-sm`, `--radius-xl`, and a semantic 44px icon tile.
- Keep one clear value per card. Supporting status, date, or comparison content belongs in the supporting slot.
- Use semantic tones only: primary, operational, success, warning, danger, or neutral.
- The default mobile grid is one column, becomes two columns when space permits, and may become four columns on desktop.
- Do not apply the elevated stat-card treatment to ordinary list items, forms, or nested content panels.

## Responsive rules

- Mobile default: one column, 16px horizontal page padding, 12-16px control gaps.
- Tablet: introduce two-column layouts only when both columns remain readable.
- Desktop: cap main content at 1440px and standard forms at 960-1200px.
- Desktop tables convert to mobile cards unless column comparison is essential.
- Bottom navigation and fixed actions reserve their full height plus safe-area padding.

## Quality gates

- No unintended horizontal overflow at 360px.
- No overlap at 390x600 or 1366x600.
- Touch targets are at least 44px.
- Loading, empty, error, success, validation, permission-denied, and long-data states are covered where applicable.
- Typecheck, lint, production build, and the responsive test checklist pass.
