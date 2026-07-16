---
name: module-access-control-first
description: Mandatory permission-first workflow for new business modules or capabilities, backend endpoints, frontend routes, menus, forms, buttons, approvals, payments, finance, inventory, administrative actions, sensitive fields, exports, or reports in this repository.
---

# Module Access Control First

Use this skill before implementing any new business capability.

## Effective permissions

```text
effectivePermissions =
  (rolePermissions UNION userAllows)
  MINUS userDenies
```

Precedence is `DENY > ALLOW > ROLE`.

Never add an ADMIN role-name bypass. Never authorize frontend behavior from role names. Permissions answer whether an action type may be performed; data scope answers which branches, tenants, or records are accessible; business policies answer under which business conditions the action is valid.

## Workflow

1. Discover every capability, endpoint, route, page, action, sensitive field, export, and report.
2. Design narrowly scoped permission codes using `<module>[.<resource>].<action>`.
3. Classify each permission as LOW, MEDIUM, HIGH, or CRITICAL.
4. Create or update `access-control/modules/<module>.yml` before business implementation.
5. Run the generator and register every permission through a new Flyway migration.
6. Define explicit default role grants; never infer grants from role names.
7. Enforce generated permission constants on every backend endpoint or application-service path.
8. Enforce branch, tenant, ownership, and record scope separately after permission authorization.
9. Guard frontend navigation, routes, pages, fields, and actions using effective permissions returned by the backend.
10. Test allowed, denied, user ALLOW, user DENY, DENY-over-role, DENY-over-ALLOW, and cross-scope behavior.
11. Run generation, validation, drift checking, relevant builds, and security review.
12. Report capabilities, permissions, grants, backend enforcement, data scope, frontend guards, tests, and remaining risks.

## Required commands

```powershell
node scripts/access-control/generate-permissions.mjs
node scripts/access-control/validate-permissions.mjs
node scripts/access-control/check-generated-permissions.mjs
```

Missing permission coverage is a blocking quality-gate failure. Do not complete business implementation while a permission is unregistered, a generated file is stale, a backend path is unprotected, or frontend access is derived from a role name.
