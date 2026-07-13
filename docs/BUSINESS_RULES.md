# Business Rules

This is the initial business-rule template for the laundry shop management system. Every item below is unresolved unless later replaced by an explicitly confirmed rule. Do not infer final behavior from this template or from implementation details alone.

## Customers

- **NEEDS CONFIRMATION** - Define required customer information and uniqueness rules.
- **NEEDS CONFIRMATION** - Define how customer records may be updated, merged, deactivated, or deleted.
- **NEEDS CONFIRMATION** - Define customer history, consent, and retention requirements.

## Laundry orders

- **NEEDS CONFIRMATION** - Define required order data, order numbering, and ownership by shop or branch.
- **NEEDS CONFIRMATION** - Define how items, quantities, weights, services, notes, promised dates, and totals are recorded.
- **NEEDS CONFIRMATION** - Define rules for editing, cancelling, reopening, and retaining orders.

## Order status transitions

- **NEEDS CONFIRMATION** - Define the allowed statuses and their meanings.
- **NEEDS CONFIRMATION** - Define valid transitions, who may perform them, and required timestamps or reasons.
- **NEEDS CONFIRMATION** - Define terminal states and whether transitions may be reversed.

## Services and pricing

- **NEEDS CONFIRMATION** - Define service types, pricing units, minimum charges, rounding, discounts, surcharges, and taxes.
- **NEEDS CONFIRMATION** - Define when prices are captured and whether later catalog changes affect existing orders.
- **NEEDS CONFIRMATION** - Define who may override a price and what audit information is required.

## Payments

- **NEEDS CONFIRMATION** - Define supported payment methods and when payment may be collected.
- **NEEDS CONFIRMATION** - Define partial, split, excess, refunded, reversed, failed, and voided payments.
- **NEEDS CONFIRMATION** - Define reconciliation, receipt, and payment-reference requirements.

## Customer debt

- **NEEDS CONFIRMATION** - Define when debt is created, adjusted, settled, written off, or reopened.
- **NEEDS CONFIRMATION** - Define credit limits, due dates, aging, and whether new orders may be blocked.
- **NEEDS CONFIRMATION** - Define the authoritative debt balance and audit-history requirements.

## Inventory

- **NEEDS CONFIRMATION** - Define tracked items, units, locations, and stock ownership.
- **NEEDS CONFIRMATION** - Define receipts, consumption, transfers, adjustments, returns, and negative-stock behavior.
- **NEEDS CONFIRMATION** - Define reorder thresholds, valuation, and stock-count reconciliation.

## Employees and permissions

- **NEEDS CONFIRMATION** - Define employee roles and permissions for operational and administrative actions.
- **NEEDS CONFIRMATION** - Define authentication, account activation, branch access, and session requirements.
- **NEEDS CONFIRMATION** - Define approval and audit requirements for sensitive actions.

## Revenue and expenses

- **NEEDS CONFIRMATION** - Define when revenue is recognized and how it relates to orders, payments, refunds, debt, discounts, and taxes.
- **NEEDS CONFIRMATION** - Define expense categories, required evidence, approval, editing, and cancellation rules.
- **NEEDS CONFIRMATION** - Define reporting periods, time zone, cash-shift boundaries, and reconciliation rules.

## Receipts and POS printing

- **NEEDS CONFIRMATION** - Define when receipts are issued or reprinted and how receipt numbers are assigned.
- **NEEDS CONFIRMATION** - Define mandatory receipt content, language, currency, paper format, and branding.
- **NEEDS CONFIRMATION** - Define Android POS printer support, failure handling, duplicate prevention, and reprint audit history.
