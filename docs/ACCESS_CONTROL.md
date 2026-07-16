# Access Control

## Model

The application authorizes business capabilities with effective permission codes, not role names.

```text
effectivePermissions =
  (rolePermissions UNION userAllows)
  MINUS userDenies
```

`DENY > ALLOW > ROLE`. A user-level DENY overrides both a role grant and a user ALLOW. OWNER, ADMIN, or any other role name must remain subject to DENY.

Roles provide explicit default grants. User overrides refine those defaults. Branch/tenant scope, record ownership, and business policies remain independent and are evaluated after permission authorization.

## Sources of truth

- `access-control/modules/*.yml`: permission metadata and explicit default role grants.
- Flyway migrations: production schema and deterministic database registration.
- Generated Java and TypeScript files: compile-time permission references.

The generator validates manifests before writing output. The validator checks references, drift, wildcard usage, Customer registration, and dangerous role-name bypass patterns.

## Database synchronization

The Customer catalog was initially registered by `V1__create_access_control_foundation.sql`. Later metadata and user override support are added through a new migration. Applied migrations are never edited.

For future modules:

1. Add the manifest first.
2. Generate and validate constants.
3. Add a new Flyway migration that inserts the new permission rows and explicit role grants.
4. Never delete missing permissions automatically at application startup.
5. Treat removal or rename as a deliberate migration that preserves role, override, and audit history.

The future Permission Matrix API should read the database catalog after migrations have registered the manifest-defined permissions. Runtime synchronization may compare and report drift, but it must not destructively reconcile production data.

## Enforcement

Backend enforcement is authoritative. Controllers may delegate authorization to application services, but every endpoint must reach an explicit permission check before business logic. Data-scope checks must follow permission checks.

Frontend guards improve navigation and interaction but are not security boundaries. The frontend uses the effective permission list returned by the backend and never derives access from role names.

## Legacy bypass scan

Run:

```powershell
node scripts/access-control/validate-permissions.mjs
```

Potential `hasRole("ADMIN")`, `hasAnyRole`, `ROLE_ADMIN`, role comparisons, `isAdmin`, and `showEverything` patterns are reported for review. Findings are not automatically rewritten.
