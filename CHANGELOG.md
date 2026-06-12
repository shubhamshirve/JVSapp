# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-06-12

### Fixed
- **Database Seeding**: Downgraded MongoDB image in `docker-compose.yml` from `mongo:7` to `mongo:4.4`. This resolves a startup crash (exit code 132 / Illegal Instruction) on cloud environments/CPUs that do not support AVX instructions. Downgrading Mongo enables the database container to stay up and the FastAPI backend to successfully connect and run its `@app.on_event("startup")` routine to seed the admin user and 18 default vegetables.

### Added
- **Environment Template**: Created `.env.example` file with baseline configurations (`SITE_ADDRESS`, `SITE_URL`, `DB_NAME`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- **Deployment Automation**: Added `deploy.sh` script to streamline pulling code and rebuilding docker-compose containers on the remote host.
- **Dockerfile Frontend Memory Limit**: Configured `NODE_OPTIONS="--max-old-space-size=2048"` in `Dockerfile.frontend` to prevent out-of-memory crashes during yarn build.
