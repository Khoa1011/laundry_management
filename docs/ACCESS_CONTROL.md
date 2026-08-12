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

## Employee module

The employee module is declared in `access-control/modules/employee.yml`. Its permissions deliberately separate profile, status, account, branch, position, audit, and cross-branch capabilities.

`employee.manage-all-branches` is a scope permission. It only widens the set of branches an already-authorized action may address. For example, a user with `employee.manage-all-branches` but without `employee.update` still cannot edit an employee.

Default grants are explicit:

- `OWNER` receives every employee permission.
- `MANAGER` receives operational employee permissions plus masked identity and private-file metadata reads, but not compensation, full identity, file content, `employee.position.manage`, or `employee.manage-all-branches`.
- `RECEPTIONIST` receives only `employee.read-self`.

Sensitive employee capabilities use dedicated permissions for compensation current/history/update, identity masked/full/update, and document metadata/upload/replace/delete/download. These permissions do not bypass employee branch scope. `OWNER` receives them explicitly through role grants; no role-name shortcut exists.

User overrides continue to apply with `DENY > ALLOW > ROLE`, including for OWNER and all employee permissions. The frontend protects `/employees`, `/employees/new`, `/employees/:id`, `/employees/:id/edit`, and `/employees/me` from the effective permission list returned by the backend. Backend method authorization remains authoritative.

## Notification module

The notification module is declared in `access-control/modules/notification.yml`. Repository convention uses kebab-case permission actions:

- `notification.read-own`
- `notification.mark-read-own`
- `notification.mark-all-read-own`
- `notification.dismiss-own`
- `notification.preferences.manage-own`
- `notification.send-specific`
- `notification.send-employee`
- `notification.broadcast-branch-users`
- `notification.broadcast-branch-employees`
- `notification.send-by-position`
- `notification.send-by-permission`
- `notification.manage`

Personal permissions never accept a target `userId`; the backend derives it from the principal. Send permissions are selected by audience type and branch scope is checked independently. `notification.manage` does not grant another user's personal content.

Default grants are explicit:

- `OWNER` receives every notification permission.
- `MANAGER` receives personal permissions plus specific user/employee, branch employee, position, and effective-permission sending.
- `RECEPTIONIST` receives only personal notification and preference permissions.

The `/notifications` route, bell, settings actions, and management controls use effective frontend permissions. REST and SSE services independently enforce generated Java constants. No role-name bypass exists.

## Legacy bypass scan

Run:

```powershell
node scripts/access-control/validate-permissions.mjs
```

Potential `hasRole("ADMIN")`, `hasAnyRole`, `ROLE_ADMIN`, role comparisons, `isAdmin`, and `showEverything` patterns are reported for review. Findings are not automatically rewritten.
