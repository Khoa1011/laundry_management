# Access Control Catalog

This directory is the repository source of truth for permission metadata and explicit default role grants.

The authorization model is:

```text
effectivePermissions =
  (rolePermissions UNION userAllowPermissions)
  MINUS userDenyPermissions
```

Precedence is `DENY > ALLOW > ROLE`. Role names never bypass effective permissions, including OWNER or any future ADMIN role.

Each business module owns one manifest in `access-control/modules/<module>.yml`. The files use JSON syntax, which is valid YAML 1.2, so the repository can validate and generate artifacts with the built-in Node.js runtime and no network-installed parser.

Permission segments use lowercase dot notation. A resource segment may use
kebab-case when the registered domain term requires it, for example
`access.effective-permission.read`; uppercase, underscores, wildcards, and
leading or trailing hyphens remain invalid.

Run from the repository root:

```powershell
node scripts/access-control/generate-permissions.mjs
node scripts/access-control/validate-permissions.mjs
node scripts/access-control/check-generated-permissions.mjs
node --test scripts/access-control/access-control.test.mjs
```

The generator writes:

- Backend constants: `backend/src/main/java/com/laundry/management/auth/security/permission/PermissionCodes.java`
- Frontend constants and type: `frontend/src/auth/permissionCodes.generated.ts`

Generated files must never be edited manually.

## Database registration

Manifests define permission metadata and default grants. Flyway remains the production database authority:

- New permissions require an explicit new migration.
- A migration inserts or updates known metadata deterministically.
- Removing a manifest entry does not delete database rows.
- Renaming a permission requires an explicit migration and compatibility decision.
- Runtime startup must not blindly delete permissions missing from manifests.
- Historical grants and audit references must be preserved.

Permission, data scope, and business policy are separate checks:

```text
Effective permission
-> branch or tenant scope
-> ownership scope
-> business policy
-> execute operation
```
