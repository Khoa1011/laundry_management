# Product

## Platform

web

## Users

Primary users are laundry shop staff working on mobile phones and Android POS devices at the counter or during daily operations. They need to create and update orders, look up customers, collect payments, check inventory, record revenue and expenses, manage employee-related work, receive realtime notifications, and print receipts without losing speed during busy service windows.

Current secondary users include owners and managers using tablet, laptop, and desktop administration screens for oversight, reporting, configuration, permission review, employee administration, and operational follow-up. Desktop is currently supported and extends the same business workflows rather than introducing a separate management product.

## Product Purpose

This product is an operations system for a laundry shop. It should help staff and managers move through everyday work in Vietnamese with clear task flow, readable information, reliable action feedback, and permission-aware controls across mobile, POS, tablet, laptop, and desktop surfaces.

Success means staff can complete frequent counter tasks quickly, managers can review and configure operational state on wider screens, users can recover from mistakes safely, and everyone can understand the current state of orders, payments, inventory, cash movement, notifications, employee records, and receipts without needing hidden knowledge.

Business behavior remains governed by `docs/BUSINESS_RULES.md`. Rules currently marked `NEEDS CONFIRMATION` are not confirmed by this document.

## Positioning

A mobile-first Vietnamese operations console and supported desktop administration surface that keeps laundry shop work fast, legible, accountable, and permission-aware from order intake through receipt printing and management review.

## Current Implemented Scope

The current implemented scope includes:

- authentication;
- roles and permissions;
- user permission overrides;
- customers;
- employees;
- employee sensitive data and private files;
- realtime notifications;
- notification preferences;
- shared application layout.

Backend packages, placeholder package folders, roadmap notes, or planning documents do not automatically authorize Codex to create unimplemented frontend modules. New business modules or capabilities still require an explicit user request and must follow the access-control-first workflow.

## Access-Control Contract

Effective permissions are computed as:

```text
Effective permissions = (ROLE UNION USER_ALLOW) MINUS USER_DENY
```

Priority is:

```text
DENY > ALLOW > ROLE
```

There is no ADMIN bypass, no role-name bypass, and no frontend-only authorization. Frontend visibility never replaces backend authorization; backend endpoints and application-service paths must independently enforce effective permissions.

## Notification Context

Notifications must preserve recipient scope, branch scope, unread state, realtime SSE delivery, reconnecting/offline behavior, user preferences, sound preferences, permissions, reduced motion, and accessibility.

Realtime notification behavior must not expose data outside the recipient's effective permission and branch scope. Notification UI should distinguish loading, reconnecting, empty, unread, read, error, permission denied, and preference-disabled states where relevant. Sound and motion feedback must respect user preferences, reduced-motion settings, browser autoplay limits, and accessible non-audio alternatives.

## Brand Personality

Rõ ràng, bình tĩnh, thực dụng.

The product voice should feel direct and steady: short Vietnamese labels, plain confirmations, specific error messages, and no decorative copy that slows down staff during real shop work.

## Anti-references

Avoid marketing-page styling, decorative dashboards, playful consumer-app gestures, oversized hero sections, chart-heavy screens where task controls are needed, and dense desktop-first admin layouts compressed onto phones.

Liquid Glass is allowed only according to root `DESIGN.md` and `docs/design/LIQUID_GLASS_ADMIN_RULES.md`. Avoid excessive decorative glass, glass-on-glass nesting, glass on dense tables or long forms, and glass on sensitive employee, finance, audit, permission, reconciliation, or private-file data surfaces.

Avoid confirming or implying business rules that are still unresolved, including pricing behavior, payment timing, debt handling, inventory valuation, revenue recognition, and receipt numbering.

## Design Principles

1. Mobile counter work first: every primary workflow must be usable on a phone-width screen and an Android POS touch display before tablet and desktop refinements are added.
2. Supported administration surfaces: tablet, POS landscape, laptop, and desktop layouts must intentionally extend the same business workflows and state model.
3. State before decoration: order status, payment state, inventory risk, notification state, permission state, sensitive-data state, and receipt outcome should be visually clearer than brand expression.
4. Vietnamese operational clarity: labels, actions, validation, empty states, notification states, and receipt-related messages should use concise Vietnamese that matches shop language.
5. Fast recovery: edits, cancellations, failed printing, failed payments, reconnecting notifications, and incomplete forms need visible recovery paths without inventing unconfirmed business outcomes.
6. Accountable by default: sensitive operational actions should leave room for timestamps, actors, reasons, permission decisions, and audit cues where the business rules require them.

## Accessibility & Inclusion

Target readable, touch-friendly mobile web UI and efficient desktop administration. Use strong text contrast, minimum 44px touch targets for primary controls, visible focus states, reduced-motion support, non-audio notification alternatives, and layouts that remain usable on Android POS browsers and desktop browsers.

No WCAG conformance level has been confirmed yet. Until confirmed, design and implementation should aim for WCAG 2.2 AA for contrast, keyboard access, focus visibility, form labels, error identification, notification feedback, and permission-denied states.
