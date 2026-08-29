# Laundry Management

Laundry shop management system with a Java 17 Spring Boot backend, a React/TypeScript frontend, and MySQL 8. The default Docker Compose stack is a production-style local deployment: Nginx serves the built frontend and proxies browser API traffic to Spring Boot over the internal Docker network.

## Prerequisites

- Docker Desktop, or Docker Engine with Docker Compose v2
- Docker Desktop/Engine running before startup

No host Java, Maven, Node.js, Nginx, or MySQL installation is required for the default stack.

## First-time setup

From the repository root, create a local environment file:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```sh
cp .env.example .env
```

Review `.env`, replace both example MySQL passwords, and set `APP_EMPLOYEE_IDENTITY_KEY` to exactly 32 random bytes encoded as Base64 before using employee identity features. Store the production key in a secret manager and plan a data migration before rotating it. The committed values in `.env.example` are local-development placeholders, not production credentials. `.env` is ignored by Git.

Private employee documents are persisted in the Docker volume `employee_private_data`; they are not served by Nginx or exposed through a public path.

Start the complete application with one command:

```powershell
docker compose up -d --build --wait
```

Or use the PowerShell helper:

```powershell
.\scripts\start-all.ps1
```

Shell helpers can be run with `sh scripts/start-all.sh` on macOS or Linux.

Compose waits for this dependency chain:

```text
MySQL healthy
-> backend startup and Flyway migration complete
-> backend healthy
-> frontend healthy
```

The application endpoints are:

- Frontend: <http://localhost:5173>
- Backend health: <http://localhost:8080/actuator/health>
- Frontend-proxied backend health: <http://localhost:5173/api/health>

Shared frontend standards for money inputs, camera capture, and media preview are documented in [docs/FRONTEND_FOUNDATIONS.md](docs/FRONTEND_FOUNDATIONS.md).

Ports bind to `127.0.0.1` by default. Other devices cannot access them unless the Compose configuration is intentionally changed.

### Demo service catalog seed

Demo data is opt-in and disabled by default. For a disposable local database, enable bootstrap and the seed in `.env`:

```dotenv
APP_BOOTSTRAP_ENABLED=true
APP_BOOTSTRAP_USERNAME=demo-owner
APP_BOOTSTRAP_PASSWORD=replace-with-a-local-password
APP_DEMO_SEED_ENABLED=true
APP_DEMO_SEED_ACTOR_USERNAME=demo-owner
APP_DEMO_SEED_BRANCH_CODE=MAIN
```

Then rebuild/restart the backend with `docker compose up -d --build backend frontend`. The seed creates six Vietnamese laundry services, 29 item types, explicit leaf eligibility, and a safe DRAFT price list named `Giá bán tiêu chuẩn`. It is idempotent, does not truncate or overwrite existing records, and refuses to run with the `prod` or `production` profile. To reset a disposable demo database, stop the stack and remove its Compose volumes explicitly; never use that reset procedure for a database containing user data.

## Routine commands

Show service status:

```powershell
docker compose ps
```

Follow all logs:

```powershell
docker compose logs -f --tail=200
```

Follow backend logs only:

```powershell
docker compose logs -f backend
```

Stop containers while preserving MySQL data:

```powershell
docker compose down
```

Restart the existing containers:

```powershell
docker compose restart
```

Rebuild after dependency, source, or Dockerfile changes:

```powershell
docker compose up -d --build --wait
```

Equivalent helpers are available in `scripts/`:

- `stop-all.ps1` / `stop-all.sh` preserves the MySQL volume.
- `restart-all.ps1` / `restart-all.sh` performs a clean down/up rebuild while preserving data.
- `logs-all.ps1` / `logs-all.sh` follows the last 200 log lines.
- `reset-all.ps1` / `reset-all.sh` requires typing `DELETE` before removing volumes.

## Destructive reset

The following command deletes the named MySQL volume and all local database data for this Compose project:

```powershell
docker compose down -v
```

Use it only when a complete local database reset is intended. Normal `docker compose down` and subsequent startup preserve data.

## Environment variables

| Variable | Purpose | Example default |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | Compose resource prefix | `laundry-management` |
| `MYSQL_DATABASE` | Application database | `laundry_management` |
| `MYSQL_USER` | Application database user | `laundry` |
| `MYSQL_PASSWORD` | Application database password | local placeholder; replace it |
| `MYSQL_ROOT_PASSWORD` | MySQL administrative password | local placeholder; replace it |
| `MYSQL_PORT` | MySQL host port | `3306` |
| `BACKEND_PORT` | Spring Boot host port | `8080` |
| `FRONTEND_PORT` | Nginx/frontend host port | `5173` |
| `DB_CONNECTION_TIMEOUT_MS` | Hikari connection timeout | `30000` |

The Compose service pins `SPRING_PROFILES_ACTIVE=docker`; containers do not use the local Spring profile. The Docker profile requires `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`, enables Flyway, retains `spring.jpa.hibernate.ddl-auto=validate`, and exposes only the non-detailed Actuator health endpoint.

## Networking and persistence

- MySQL data is stored in the named `mysql_data` volume.
- Backend connects to `mysql:3306` on the private `laundry_network` network.
- Nginx connects to `backend:8080` internally.
- Browser JavaScript uses the relative `/api` path and never receives Docker service hostnames.
- `/api/health` is mapped to the backend Actuator health endpoint; other `/api/` paths are forwarded unchanged.
- Direct frontend routes such as `/customers` fall back to `index.html`, so browser refresh does not return an Nginx 404.

## Automatic restart behavior

MySQL, backend, and frontend use `restart: unless-stopped`. After the stack has been created once, Docker restarts the containers when Docker Engine starts. Containers intentionally stopped by the user remain stopped.

For restart after machine login, configure Docker Desktop itself to start with the operating system. This repository does not create operating-system startup tasks.

## Local builds and tests

Backend tests and build:

```powershell
Set-Location backend
.\mvnw.cmd test
.\mvnw.cmd -DskipTests package
```

Frontend checks and production build:

```powershell
Set-Location frontend
npm ci
npm run typecheck
npm run lint
npm run build
```

Permission catalog quality gates from the repository root:

```powershell
node scripts/access-control/generate-permissions.mjs
node scripts/access-control/validate-permissions.mjs
node scripts/access-control/check-generated-permissions.mjs
node --test scripts/access-control/access-control.test.mjs
```

See `docs/ACCESS_CONTROL.md` and `docs/ADDING_A_NEW_MODULE.md` before adding a business capability.

The frontend currently provides a responsive system-readiness shell only. It contains no mock business data and does not decide any unresolved rules from `docs/BUSINESS_RULES.md`.

## Troubleshooting

If startup fails, inspect status and logs without hiding the original error:

```powershell
docker compose ps
docker compose logs --no-color --tail=300
```

Common causes are an unreviewed or missing `.env`, Docker Engine not running, host ports already in use, or a failed Flyway migration. A migration failure prevents the backend health check from passing, which also prevents the frontend from starting.
