---
name: spring-performance-audit
description: Performance and scalability audit workflow for this Java Spring Boot laundry-management repository. Use when Codex is asked to review, audit, measure, diagnose, benchmark, tune, or fix backend API latency, throughput, load capacity, JPA/Hibernate query behavior, database performance, transaction duration, connection-pool pressure, resource usage, caching, observability, or load-testing concerns.
---

# Spring Performance Audit

Audit measurable backend performance, scalability, and load capacity. Measure before optimizing. Do not claim an optimization worked without before-and-after evidence. Do not make broad configuration changes based only on assumptions.

Do not modify code unless the user explicitly requests a fix. Produce findings before changing anything. Apply only approved, high-confidence changes, one performance area at a time, and measure again after each meaningful change.

## Required Context

Before auditing:

1. Read `AGENTS.md` and follow repository guidance.
2. Read `docs/BUSINESS_RULES.md`; surface unresolved rules instead of guessing.
3. Inspect the actual backend architecture, build files, package layout, dependency boundaries, APIs, database access patterns, migrations, configuration, tests, and monitoring tools.
4. Identify whether the project is only a scaffold or has real workloads, controllers, repositories, persistence paths, and production-like data.
5. Do not invent performance problems that cannot be demonstrated. Separate confirmed bottlenecks from possible future risks.

Respect repository boundaries:

- Preserve existing APIs and business behavior unless the user explicitly requests a change.
- Do not modify frontend code for backend performance work.
- Do not modify applied migrations; add a new migration only when an approved database change requires one.
- Do not expose secrets or sensitive configuration in reports, logs, code, or responses.
- Detect the available backend test and build commands before running them; do not introduce or change the build tool unless requested.

## Baseline First

Establish a baseline before recommending optimizations. Capture the environment, dataset size, workload, commands, duration, concurrency, request mix, and measurement source.

Prefer existing project tooling and available observability. When no load or metric tooling exists, state that limitation and use the safest available evidence, such as code-path tracing, tests, logs, Actuator/Micrometer metrics, SQL logs in a non-production environment, or database `EXPLAIN` plans when database access is available.

Track at least:

- Response latency: p50, p95, p99 where possible.
- Throughput and concurrency.
- Error rate and status-code distribution.
- Response payload size for list and report endpoints.
- Query count per request and slow queries where measurable.
- CPU, memory, garbage collection, thread count, and HikariCP metrics where available.

## Audit Areas

### API Performance

Review response latency, throughput, error rate, response payload size, unbounded list endpoints, missing pagination, excessive serialization, repeated transformations, blocking operations, external API timeouts, retry behavior, and payloads that are too large for mobile browsers or Android POS devices.

### Spring Data JPA and Hibernate

Review N+1 queries, eager fetching, oversized fetch joins, accidental lazy loading during serialization, excessive entity loading, DTO projections, unnecessary save calls, large persistence contexts, dirty checking overhead, batch insert or update opportunities, and query count per request.

Prefer measured SQL/query-count evidence over assumptions. If evidence is unavailable, label the item as a risk and explain how to verify it.

### Database

Review missing indexes, inefficient filters, joins and sorting, leading wildcard searches, repeated count queries, slow queries, lock contention, long transactions, lost-update and concurrency risks, and connection-pool pressure.

Use `EXPLAIN` or equivalent plans when database access is available in a safe test environment. Do not run destructive SQL or production-impacting diagnostics.

### Transactions

Review transaction boundaries, network or file operations inside transactions, transactions that are too large or too long, isolation choices, and locking where inventory or payment consistency matters.

Do not weaken transactions for payment, inventory, debt, or order-state correctness without evidence and explicit approval.

### Resources

Review HikariCP configuration, server thread usage, HTTP client connection reuse, timeouts, retry storms, unbounded queues, scheduled-job overlap, memory allocation, large in-memory collections, garbage collection, and file or image processing.

Do not increase thread counts, connection-pool sizes, queue limits, or retry settings blindly. Tie configuration changes to measured resource saturation and expected trade-offs.

### Caching

Identify genuinely expensive, stable read operations before recommending caching. Require a cache invalidation strategy before adding caching.

Do not cache sensitive or rapidly changing payment, inventory, debt, customer, or order state without explicit correctness analysis. When caching exists, inspect cache hit and miss measurements, eviction behavior, and stale-data risks.

### Observability

Inspect Spring Boot Actuator, Micrometer, HTTP request latency metrics, status-code distribution, JVM memory, garbage collection, CPU, thread count, HikariCP metrics, cache metrics, logs, tracing, and custom business-operation metrics.

Do not expose sensitive Actuator endpoints publicly. Recommend safe monitoring coverage when performance cannot be measured confidently.

### Load Testing

Use existing load-test tooling when present. Do not load-test production. Require an explicit test environment and permission before generating load.

Define concurrent users, ramp-up, duration, target throughput, acceptable p50/p95/p99 latency, acceptable error rate, dataset assumptions, and realistic workflows before running a load test.

Representative workflows may include login, create laundry order, search customer by phone number, list today's orders, update order status, record payment, create inventory transaction, view dashboard, generate report, and print or reprint receipt.

## Finding Standards

Classify findings as:

- Critical: confirmed bottleneck likely to cause outage, data corruption from concurrency pressure, or severe production failure under realistic load.
- High: measured issue that materially degrades core workflows or sharply limits realistic load capacity.
- Medium: meaningful inefficiency, scalability limit, or observability gap with likely user or operational impact.
- Low: minor optimization, measurement improvement, or future scalability risk.

For every finding include:

- Severity.
- Title.
- Affected endpoint or file.
- Evidence.
- Baseline measurement.
- Root cause.
- Possible impact.
- Recommended change.
- Verification method.
- Expected trade-offs.

Use concrete file paths, endpoint names, commands, metrics, query counts, SQL plans, logs, or code evidence. State explicitly when a finding is a possible future risk rather than a confirmed bottleneck.

## Approved Fix Workflow

When the user explicitly requests a performance fix:

1. Reconfirm the affected behavior and baseline measurement.
2. Change one performance area at a time.
3. Keep the smallest scoped change that preserves APIs, business behavior, correctness, and security.
4. Avoid dependency additions unless the benefit and compatibility risk are clear.
5. Add or update focused tests when the repository supports them.
6. Re-run the baseline or the closest safe measurement after the change.
7. Report before-and-after metrics without overstating causality.

## Safety Rules

Do not:

- Load-test production.
- Generate destructive traffic.
- Disable correctness or security controls for speed.
- Weaken transactions for payment, inventory, debt, or order consistency without evidence.
- Add caching without invalidation rules.
- Increase thread or connection-pool sizes blindly.
- Add dependencies without explaining why.
- Modify code unless explicitly requested.
- Claim improvement without measurements.
- Include general UI design, full security auditing, or business-feature implementation.

## Completion Report

Report:

- Environment used.
- Workload tested.
- Files inspected.
- Files changed.
- Commands run.
- Baseline metrics.
- After-change metrics.
- Test results.
- Build result.
- API changes.
- Database changes.
- Remaining bottlenecks.
- Monitoring recommendations.
- Remaining risks or unavailable measurements.

State explicitly when a category has no changes, no metrics, or could not be run.
