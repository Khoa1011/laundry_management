# Business Rules

This is the initial business-rule template for the laundry shop management system. Every item below is unresolved unless later replaced by an explicitly confirmed rule. Do not infer final behavior from this template or from implementation details alone.

## Customers

- Quick customer intake prioritizes full name, phone number, customer type, note, and whether delivery is requested. Advanced profile information may be completed later.
- Pickup at the shop is the default. A delivery address is only requested when the customer needs delivery or collection.
- When the receiver is the customer, the initial delivery address reuses the customer name and phone number instead of asking staff to enter them again. A different receiver may be entered explicitly.
- A customer may keep multiple delivery addresses. One active address may be marked as the default, and an existing address may be updated when the customer moves without recreating the customer profile.
- Current Vietnamese addresses use the V2 province/city and ward structure. Staff may switch to the legacy V1 province/city, district, and ward structure for addresses from before July 2025.
- Structured addresses retain both display names and administrative codes. Existing unstructured addresses remain valid and may continue to be edited manually.
- **NEEDS CONFIRMATION** - Define customer uniqueness, merge, consent, and retention requirements.

## Laundry orders

- **NEEDS CONFIRMATION** - Define required order data, order numbering, and ownership by shop or branch.
- **NEEDS CONFIRMATION** - Define how items, quantities, weights, services, notes, promised dates, and totals are recorded.
- **NEEDS CONFIRMATION** - Define rules for editing, cancelling, reopening, and retaining orders.

## Order status transitions

- **NEEDS CONFIRMATION** - Define the allowed statuses and their meanings.
- **NEEDS CONFIRMATION** - Define valid transitions, who may perform them, and required timestamps or reasons.
- **NEEDS CONFIRMATION** - Define terminal states and whether transitions may be reversed.

## Services and pricing

- Services and item types are independent catalogs. A service explicitly records the active leaf item types it accepts; selecting a parent category never implicitly covers current or future descendants.
- A price is resolved from a price list, service, eligible item type, quantity, sharing context, priority context, and effective time. The backend is authoritative for both price selection and calculation.
- Price lists retain the lifecycle `DRAFT`, `ACTIVE`, `SCHEDULED`, `EXPIRED`, and `ARCHIVED`. Only drafts may be edited. Active lists must be copied before changing; scheduled, expired, and archived lists are read-only. Drafts may be previewed against their own rules before publication.
- Supported unit pricing maps kilograms, items, pairs, and sets to `BY_WEIGHT`, `BY_ITEM`, `BY_PAIR`, and `BY_SET`. Fixed pricing, per-load pricing, and base-plus-excess (`HYBRID`) remain supported.
- Exact quantity-package pricing stores a total price for an exact whole-number quantity and supports `ITEM`, `PAIR`, and `SET` only. It does not apply to kilograms. When no exact quantity exists, the system rejects the quote instead of interpolating or guessing.
- Tiered pricing supports `VOLUME` (one tier rate applied to the entire quantity) and `PROGRESSIVE` (each tier rate applied only to its interval). Tiers must be continuous, non-overlapping, and end with an open upper bound.
- Minimum charge is represented as a separate pricing adjustment in the calculation breakdown. Base, unit, excess, tier, quantity-package, and minimum-charge components remain visible in preview and pricing snapshots.
- Price coverage is calculated only across explicit service-item eligibility combinations. A service-wide default rule covers all its eligible item types when the rule is otherwise quotable.
- Services and item types are never hard deleted through this module. Archiving is final and is blocked while an active or scheduled price list references the record. An eligibility association used by an active or scheduled price rule cannot be removed.
- Eligibility changes, price-list lifecycle changes, and pricing-rule changes are authorized independently and audited. Permission grants remain separate from branch scope and pricing business policy.
- **NEEDS CONFIRMATION** - Define taxes, general discounts, order-level surcharges, VND rounding policy, order-time price capture, later catalog-change behavior for existing orders, and order price-override authority/audit requirements.

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

- Employee profiles and authentication accounts are separate records. An employee may have no linked account, and one account may be linked to at most one employee.
- Employee codes use the global, concurrency-safe sequence `NV-000001`, are generated by the system, are unique, and cannot be edited.
- Employee positions describe work responsibilities only. They are not access-control roles and never grant permissions. Used positions may be deactivated to prevent future assignment, but are not hard deleted.
- Every non-terminated employee must have at least one active branch assignment and exactly one active primary branch. Assignment history is retained instead of overwritten.
- Permission authorization, employee branch scope, account branch scope, and business status policies are independent checks. `employee.manage-all-branches` expands scope only and never grants an employee action by itself.
- Users without `employee.manage-all-branches` can only read or change employee profiles whose active branch assignments overlap their own branch access. Newly selected employee branches and linked accounts must also be within that scope.
- An employee profile uses `ACTIVE`, `INACTIVE`, `SUSPENDED`, or `TERMINATED`. `TERMINATED` is final. Suspension and termination require a reason.
- Suspending or terminating an employee locks the linked account in the same transaction. Reactivating an employee does not automatically unlock that account. Unlinking an account does not delete it, unlock it, deactivate it, or change its permissions and branches.
- A user with `employee.read-self` may read only the employee profile linked to the current account. This does not grant employee-directory access.
- Profile updates, work-status changes, position changes, branch assignment changes, account links, account unlinks, and linked-account locks are separately authorized and audited.
- Employee audit metadata contains identifiers, states, and changed field names. It must not copy raw phone numbers, addresses, email addresses, salaries, passwords, tokens, identity numbers, storage keys, checksums, or document contents into audit JSON.
- Employee records, branch-assignment history, and audit history are not hard deleted through the Employee API.
- Compensation uses non-overlapping effective periods. A new period may only follow existing periods; the previous open period ends on the day before the new effective date. A future period is scheduled, while a current or past effective date becomes active.
- Compensation read, update, and history read are separately authorized. Compensation data is never included in the ordinary employee profile response.
- Citizen IDs contain exactly 12 digits, are encrypted with AES-GCM using an externally supplied key, and use a keyed deterministic hash only for duplicate detection. APIs never return ciphertext, hashes, or database storage fields.
- Identity reads are masked by default. Full reveal requires a separate permission and explicit request. Identity update and verification are separately authorized; rejection requires a reason.
- Private employee documents accept only content-validated JPEG, PNG, or PDF files. Images are limited to 10 MB and PDFs to 20 MB by default. Storage is private, outside web-static roots, and has no public URL.
- Document metadata, upload, replace, soft delete, and content download are separately authorized. Replacement creates a new version; deletion does not physically remove retained content.
- Sensitive Employee v1 does not grant self-service access. Payroll calculation, shifts, attendance, external messaging, and public document sharing remain out of scope.

## Internal notifications

- Notification recipients are materialized by `user_id`. Employee, position, branch, and permission audiences are resolution inputs, not recipient ownership.
- Personal notification list, unread state, read state, dismissal state, preferences, and SSE streams always derive the owning user from the authenticated principal.
- Valid recipients must have an ACTIVE, unlocked user account in the required branch scope. Employee audiences additionally require an ACTIVE employee, an active branch assignment, and a linked user.
- The actor is excluded after recipient resolution by default. Inclusion must be explicit for a legitimate system or personal-confirmation case.
- Business transactions commit before notification creation. Notification creation runs after commit in a new transaction and cannot roll back the completed business operation.
- The database is the durable source of notification truth. SSE is a best-effort realtime optimization; reconnecting clients reconcile through REST.
- Notification metadata contains translation interpolation values only. Salary, full identity numbers, passwords, tokens, private document data, storage keys, checksums, and executable markup are prohibited.
- Employee branch changes are the first guaranteed realtime integration. Status changes and account links also publish internal events; locked or inactive accounts are not expected to receive realtime delivery.
- Internal notifications do not add customer-facing push, email, SMS, Zalo, PWA push, or guaranteed cross-device delivery.

## Revenue and expenses

- **NEEDS CONFIRMATION** - Define when revenue is recognized and how it relates to orders, payments, refunds, debt, discounts, and taxes.
- **NEEDS CONFIRMATION** - Define expense categories, required evidence, approval, editing, and cancellation rules.
- **NEEDS CONFIRMATION** - Define reporting periods, time zone, cash-shift boundaries, and reconciliation rules.

## Receipts and POS printing

- **NEEDS CONFIRMATION** - Define when receipts are issued or reprinted and how receipt numbers are assigned.
- **NEEDS CONFIRMATION** - Define mandatory receipt content, language, currency, paper format, and branding.
- **NEEDS CONFIRMATION** - Define Android POS printer support, failure handling, duplicate prevention, and reprint audit history.
