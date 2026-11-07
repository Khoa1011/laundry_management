# Adding a New Business Module

Every module follows this sequence before it is complete:

1. Identify module capabilities.
2. Separate permissions, data scope, and business policies.
3. Copy `access-control/modules/_module-template.yml`.
4. Define permission codes using `<module>[.<resource>].<action>`.
5. Assign `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL` risk.
6. Define explicit default role grants.
7. Run permission generation.
8. Run permission validation.
9. Register permissions with a new Flyway migration.
10. Confirm each permission appears in the future dynamic Permission Matrix API.
11. Implement the module database schema.
12. Implement backend behavior.
13. Add backend permission checks using generated constants.
14. Add branch, tenant, ownership, and record-scope checks.
15. Implement the frontend.
16. Guard navigation, routes, pages, and actions with backend-returned effective permissions.
17. Add authorization, scope, validation, and regression tests.
18. Run backend, security, performance, and UI reviews as relevant.
19. Run Docker validation.

PowerShell-friendly commands from the repository root:

```powershell
node scripts/access-control/generate-permissions.mjs
node scripts/access-control/validate-permissions.mjs
node scripts/access-control/check-generated-permissions.mjs
node --test scripts/access-control/access-control.test.mjs
```

## Capability examples

These examples describe permission design only. They do not implement the modules.

### Service Catalog

Possible codes:

- `service.read`
- `service.create`
- `service.update`
- `service.price.update`
- `service.deactivate`

Branch availability is data scope. Price approval limits are business policy.

### Order Management

Possible codes:

- `order.read`
- `order.create`
- `order.update`
- `order.status.update`
- `order.cancel`

The order's branch and ownership are data scope. Valid state transitions and whether posted orders can be edited are business policies.

### Finance / Cash Vouchers

Possible codes:

- `finance.ledger.read`
- `finance.receipt.create`
- `finance.expense.create`
- `finance.document.update`
- `finance.document.cancel`

For Finance/Inventory, follow the mandatory Single-Operator Workflow in AGENTS.md. Saving has immediate effect; editing saved documents and cancellation use linked corrections with immutable ledger history. Do not add approval, thresholds or a separate posting command. Branch or cash-drawer ownership remains a separate data-scope check.

HIGH and CRITICAL permissions are never granted implicitly. Wildcards are not persisted as effective permissions. Role names never authorize operations, and no ADMIN bypass is permitted.
