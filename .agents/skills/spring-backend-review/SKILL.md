---
name: spring-backend-review
description: Review Java Spring Boot backend code quality and correctness. Use for evidence-based reviews of controllers, services, repositories, entities, DTOs, validation, transactions, persistence behavior, migrations, and backend tests in this repository.
---

# Spring Backend Review

## Prepare

1. Read `AGENTS.md` first and follow its repository guidance.
2. Read `docs/BUSINESS_RULES.md` before reviewing business logic.
3. Inspect the backend architecture, build files, conventions, and relevant call paths.
4. Audit and report before modifying code. Treat review requests as read-only unless the user explicitly asks for fixes.

## Review

Trace relevant behavior across controllers, services, repositories, entities, DTOs, and tests. Review:

- API boundaries, request and response DTOs, and Jakarta Validation coverage.
- Service responsibilities, transaction boundaries, rollback behavior, and exception handling.
- Repository contracts, JPA query correctness, pagination and stable sorting, fetch behavior, and N+1 risks.
- Entity mappings, ownership, cascades, orphan removal, equality, nullability, and persistence lifecycle behavior.
- Concurrency risks such as lost updates, duplicate creation, stale writes, and missing locking or database constraints.
- Migration compatibility and alignment among migrations, entities, queries, and MySQL behavior.
- Tests for important success paths, failure paths, boundaries, transactions, and regressions.

Do not expose JPA entities directly from controllers. Preserve existing API contracts and business behavior unless the user explicitly requests changes. Never modify an existing applied migration; propose or create a new migration only when explicitly authorized and necessary.

Report conflicts between code and confirmed or unresolved rules in `docs/BUSINESS_RULES.md`. Do not resolve a `NEEDS CONFIRMATION` item by assumption.

## Findings

Classify each actionable finding:

- **Critical** - Likely data loss or corruption, broad outage, or severe correctness failure requiring immediate action.
- **High** - Materially incorrect behavior, broken contract, or serious reliability issue on a realistic path.
- **Medium** - Limited correctness, maintainability, or performance problem with meaningful impact.
- **Low** - Minor robustness, clarity, consistency, or test-gap issue.

For every finding, include the severity, affected file path and precise code evidence, observed or likely impact, and a concrete recommendation. Distinguish verified defects from risks that require reproduction or business confirmation. Keep summaries focused on findings; state explicitly when no actionable findings are identified.

## Boundaries

- Do not perform a full security audit. Note only security-relevant issues directly encountered in the reviewed code and recommend a dedicated audit when appropriate.
- Do not perform load testing.
- Do not expose secrets or sensitive configuration in evidence or output.
- Do not create any other skills.

## Verification and report

If fixes are explicitly requested, make the smallest scoped changes after the audit. Detect and use the repository's existing Maven or Gradle commands; do not introduce a build system. Run relevant backend tests and the available backend build.

Report findings first, ordered by severity. Then report files changed, tests run, build results, API changes, database changes, business-rule conflicts, and remaining risks. State when any item is none, unavailable, or not run.
