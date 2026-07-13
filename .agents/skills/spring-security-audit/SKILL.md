---
name: spring-security-audit
description: Defensive security audit workflow for this Java Spring Boot laundry-management repository. Use when Codex is asked to review, audit, assess, triage, or fix Spring Security, authentication, authorization, REST API exposure, secrets, file upload, payment/webhook, business-security, data protection, or security-relevant dependency risks in this application.
---

# Spring Security Audit

Use this skill for defensive security auditing only. Audit before modifying code. Do not modify code unless the user explicitly requests a fix.

## Required Context

Before auditing:

1. Read `AGENTS.md`.
2. Read `docs/BUSINESS_RULES.md`.
3. Inspect the actual authentication and authorization architecture in the repository.
4. Identify public, authenticated, employee, manager, and admin operations from controllers, security configuration, services, routes, and tests.
5. Do not invent security architecture, roles, permissions, token handling, sessions, or business rules that do not exist.

Respect repository guidance:

- Preserve existing APIs and business behavior unless the task explicitly requests a change.
- Do not modify backend source, frontend source, build files, migrations, app YAML, AGENTS.md, docs, existing skills, README, or docker-compose unless the user explicitly requests that exact change.
- Never expose secrets, tokens, passwords, private keys, or sensitive configuration in reports, logs, code, or responses.

## Audit Scope

### Authentication

Review:

- Password storage and password encoding.
- Login behavior and authentication error handling.
- JWT or session configuration if present.
- Token expiration, refresh, revocation, and logout.
- Account enumeration risks.
- Brute-force and rate-limit risks.

### Authorization

Review:

- Route-level authorization.
- Method-level authorization.
- Role and permission checks.
- Resource ownership enforcement.
- IDOR and broken object-level authorization.
- Cross-branch data access.
- Admin and financial operations.
- Backend enforcement instead of frontend-only restrictions.

Never trust role, user ID, price, branch ID, payment status, order ownership, or inventory values sent by the frontend.

### Input and API Security

Review:

- Request body validation.
- Path and query parameter validation.
- Pagination and sorting allowlists.
- Mass assignment.
- Excessive data exposure.
- SQL, JPQL, command, template, and log injection.
- Unsafe dynamic queries.
- Error responses and stack-trace leakage.

### Browser Security

Review according to the actual authentication mechanism:

- CORS configuration.
- CSRF exposure.
- Cookie flags if cookies are used.
- Security headers.
- Credentialed cross-origin requests.

### Secrets and Configuration

Review:

- Hard-coded secrets, passwords, API keys, tokens, and private keys.
- Environment configuration.
- Sensitive Actuator endpoints.
- Sensitive logging.

If a secret-like value is found, identify only the file path, key name, and risk. Never print the actual value.

### File Security

Review:

- Upload size limits.
- File type validation.
- Generated server-side filenames.
- Path traversal.
- Public file exposure.
- Malicious file handling.

Consider future customer images and other uploads even when the current implementation is partial.

### Business-Security Risks

Review:

- Client-controlled prices.
- Unauthorized discounts.
- Duplicate order creation.
- Duplicate payment callbacks.
- Webhook signature verification.
- Replay attacks.
- Idempotency.
- Refund authorization.
- Inventory manipulation.
- Customer debt modification.
- Revenue and expense manipulation.
- Receipt reprinting abuse.
- Audit-log integrity.
- Race conditions involving payment, inventory, or order status.

Use `docs/BUSINESS_RULES.md` as the reference for expected behavior. Surface uncertainty or conflicts instead of guessing.

### Data Protection

Review:

- Customer personal information.
- Phone numbers and addresses.
- Sensitive data in logs.
- API response data minimization.
- Export and reporting permissions.
- Backup and download endpoints.

### Dependencies

Review security-relevant dependencies and existing scan tooling. Do not automatically upgrade major framework versions. Explain compatibility risks before dependency changes.

## Finding Standards

Classify findings as:

- Critical: likely unauthenticated or low-effort compromise of accounts, money, branch data, secrets, or system integrity.
- High: practical privilege escalation, broken object-level authorization, sensitive data exposure, payment or inventory manipulation, or exploitable authentication weakness.
- Medium: meaningful hardening gap or bug requiring conditions, insider access, or chained issues.
- Low: defense-in-depth issue, minor information exposure, or maintainability risk with security relevance.

Separate confirmed vulnerabilities from missing hardening. Never claim that the application is completely secure.

For every finding include:

- Severity.
- Title.
- Affected endpoint or file.
- Code evidence with file paths and relevant identifiers.
- Attack or misuse scenario.
- Impact.
- Recommended fix.
- Verification method.

Use concrete evidence from the codebase. If evidence is incomplete, state what was inspected and what remains unknown.

## Safety Rules

Do not:

- Display actual secret values.
- Copy secrets into reports.
- Disable security controls to make tests pass.
- Weaken authentication or authorization.
- Perform destructive testing.
- Attack external or production systems.
- Load-test production.
- Modify code unless the user explicitly requests a fix.
- Include general performance optimization or UI design review.

## Approved Fix Workflow

When the user explicitly requests a security fix:

1. Reconfirm the finding and affected behavior from source code.
2. Make the smallest correction that preserves existing APIs and business behavior.
3. Keep enforcement on the backend.
4. Add or update focused tests when the repository supports them.
5. Avoid dependency upgrades unless necessary; explain compatibility risk first.

After approved fixes, run what is available:

- Unit tests.
- Integration tests.
- Maven test and verify when a Maven project exists.
- Existing dependency or secret scans when configured.

If a command cannot be run because the repository lacks a build descriptor, wrapper, configured scanner, dependency, or environment service, report that explicitly.

## Final Report

Lead with findings ordered by severity. Then report:

- Files inspected.
- Files changed.
- Tests run.
- Build result.
- Dependency-scan result.
- API changes.
- Database changes.
- Remaining risks.

State explicitly when a category has no changes or when a command could not be run.
