# Repository Guidance

## Project

- Laundry shop management system with a Java Spring Boot backend, Spring Security, Spring Data JPA, MySQL, and a React/TypeScript frontend.
- Primary clients are mobile browsers and Android POS devices.
- No Maven or Gradle build descriptor or wrapper is present yet. Re-check the repository before running backend commands; do not introduce or change the build tool unless requested.

## Working rules

- Inspect the existing architecture, conventions, and dependency boundaries before modifying code.
- Preserve existing APIs and business behavior unless the task explicitly requests a change.
- Treat `docs/BUSINESS_RULES.md` as the business-rule reference and surface uncertainty or conflicts instead of guessing.
- Never modify an existing applied database migration. Add a new migration only when a requested database change requires one.
- Never expose secrets, tokens, passwords, or sensitive configuration in code, logs, documentation, or responses.
- Keep changes within task scope. Do not modify the frontend for backend-only work.
- After backend changes, run the available backend tests and the build command supported by the repository.

## Handoff

Report files changed, tests run, build results, API changes, database changes, and remaining risks. State explicitly when a category has no changes or when a command could not be run.
