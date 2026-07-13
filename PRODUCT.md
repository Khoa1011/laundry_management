# Product

## Register

product

## Platform

web

## Users

Primary users are laundry shop staff working on mobile phones and Android POS devices at the counter or during daily operations. They need to create and update orders, look up customers, collect payments, check inventory, record revenue and expenses, manage employee-related work, and print receipts without losing speed during busy service windows.

Future users include managers using wider desktop screens for oversight, reporting, configuration, and review. Desktop support should extend the same product model rather than introduce a separate management experience.

## Product Purpose

This product is an operations system for a laundry shop. It should help staff move through everyday work in Vietnamese with clear task flow, readable information, and reliable action feedback on small touch screens.

Success means staff can complete frequent counter tasks quickly, recover from mistakes safely, and understand the current state of orders, payments, inventory, cash movement, and receipts without needing hidden knowledge.

Business behavior remains governed by `docs/BUSINESS_RULES.md`. Rules currently marked `NEEDS CONFIRMATION` are not confirmed by this document.

## Positioning

A mobile-first Vietnamese operations console that keeps laundry shop counter work fast, legible, and accountable from order intake through receipt printing.

## Brand Personality

Rõ ràng, bình tĩnh, thực dụng.

The product voice should feel direct and steady: short Vietnamese labels, plain confirmations, specific error messages, and no decorative copy that slows down staff during real shop work.

## Anti-references

Avoid marketing-page styling, decorative dashboards, playful consumer-app gestures, oversized hero sections, glassy panels, chart-heavy screens where task controls are needed, and dense desktop-first admin layouts compressed onto phones.

Avoid confirming or implying business rules that are still unresolved, including pricing behavior, payment timing, debt handling, inventory valuation, employee permissions, revenue recognition, and receipt numbering.

## Design Principles

1. Mobile counter work first: every primary workflow must be usable on a phone-width screen and an Android POS touch display before desktop refinements are added.
2. State before decoration: order status, payment state, inventory risk, and receipt outcome should be visually clearer than brand expression.
3. Vietnamese operational clarity: labels, actions, validation, empty states, and receipt-related messages should use concise Vietnamese that matches shop language.
4. Fast recovery: edits, cancellations, failed printing, failed payments, and incomplete forms need visible recovery paths without inventing unconfirmed business outcomes.
5. Accountable by default: sensitive operational actions should leave room for timestamps, actors, reasons, and audit cues where the business rules later require them.

## Accessibility & Inclusion

Target readable, touch-friendly mobile web UI. Use strong text contrast, minimum 44px touch targets for primary controls, visible focus states, reduced-motion support, and layouts that remain usable on Android POS browsers.

No WCAG conformance level has been confirmed yet. Until confirmed, design and implementation should aim for WCAG 2.2 AA for contrast, keyboard access, focus visibility, form labels, and error identification.
