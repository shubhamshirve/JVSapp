# Self-Hosting Jivdani Vegetable Suppliers (Docker + Caddy)

This guide deploys the full stack with **Docker Compose** behind **Caddy** (which
serves the React frontend *and* reverse-proxies the API). Three containers:

| Service   | Role                                              | Port |
|-----------|---------------------------------------------------|------|
| `mongo`   | MongoDB database (data persisted in a volume)     | internal |
| `backend` | FastAPI app (uvicorn)                              | internal `8001` |
| `caddy`   | Serves the built React SPA + proxies `/api/*`     | `80` / `443` |

All traffic enters through Caddy on a single domain, so there are **no CORS issues**
and HTTPS is automatic in production.

---

## 1. Prerequisites
- A server with **Docker** and the **Docker Compose plugin** installed.
- (Production) A domain name with an **A record** pointing to the server's IP, and
  ports **80** and **443** open in the firewall.

## 2. Configure environment
From the project root (`/app`):

```bash
cp .env.example .env
# edit .env
```

Set the values:

```env
# Local testing
SITE_ADDRESS=:80
SITE_URL=http://localhost

# --- OR --- Production (auto HTTPS via Let's Encrypt)
# SITE_ADDRESS=jivdani.example.com
# SITE_URL=https://jivdani.example.com

DB_NAME=jivdani
JWT_SECRET=<run: openssl rand -hex 32>
ADMIN_EMAIL=admin@jivdani.com
ADMIN_PASSWORD=<a strong password>
```

> `SITE_URL` is **baked into the frontend at build time** (it's the API base). If you
> later change the domain, rebuild the `caddy` image (`docker compose build caddy`).

## 3. Build & run

```bash
docker compose up -d --build
```

- Local: open **http://localhost**
- Production: open **https://your-domain** (Caddy fetches a TLS cert automatically)

The backend **seeds the admin account** on first start using `ADMIN_EMAIL` /
`ADMIN_PASSWORD`, plus 18 default vegetables.

## 4. Common commands

```bash
docker compose logs -f backend     # tail backend logs
docker compose logs -f caddy       # tail Caddy logs
docker compose ps                  # status
docker compose restart backend     # restart a service
docker compose down                # stop (keeps volumes/data)
docker compose down -v             # stop AND delete data volumes (DANGER)
```

## 5. Updating the app
After pulling new code:

```bash
docker compose up -d --build
```

## 6. Backups
The database lives in the `mongo_data` Docker volume. To back it up:

```bash
docker compose exec mongo mongodump --db jivdani --archive=/data/db/backup.archive
docker cp $(docker compose ps -q mongo):/data/db/backup.archive ./jivdani-backup.archive
```

Restore:

```bash
docker cp ./jivdani-backup.archive $(docker compose ps -q mongo):/tmp/backup.archive
docker compose exec mongo mongorestore --archive=/tmp/backup.archive
```

---

## How it fits together
- **Caddyfile** routes `/api/*` → `backend:8001` and serves everything else from the
  built SPA in `/srv` (with `try_files … /index.html` so client-side routes work).
- **Dockerfile.frontend** is multi-stage: Node builds the React app, then the static
  output is copied into the official `caddy` image.
- **Dockerfile.backend** installs Python deps and runs uvicorn on `8001`.
- The backend reads all config from environment variables (`MONGO_URL`, `DB_NAME`,
  `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGINS`) — no secrets in code.

## Troubleshooting
- **Login fails right after deploy**: ensure `JWT_SECRET`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD` are set in `.env`; check `docker compose logs backend` for the
  "Seeded admin user" line.
- **Frontend loads but API calls 404/blocked**: `SITE_URL` used at build time must match
  the domain you're visiting. Rebuild `caddy` after changing it.
- **No HTTPS cert**: confirm the domain's DNS points to this server and ports 80/443
  are reachable from the internet; Caddy needs them to complete the ACME challenge.

---

## CI/CD via GitHub Actions (GHCR-cached deploys)

The workflow at `.github/workflows/deploy.yml` runs on every push to `main`:

1. **Build job** (on a GitHub-hosted runner — fast, plenty of RAM):
   - Builds backend & frontend images using BuildKit with cache reuse
     (`type=gha,mode=max`).
   - Pushes them to **GitHub Container Registry** (`ghcr.io/<owner>/<repo>/backend:latest`
     and `…/frontend:latest`, plus a SHA-tagged copy for traceability).
2. **Deploy job** SSHes into the VPS and runs `docker compose pull && up -d`.
   The VPS never builds anything — it just pulls and restarts. Code-only deploys
   now take **~20–30 s** instead of 10–15 minutes.

### First-time GHCR setup
The first push will create two private packages at
`https://github.com/<owner>?tab=packages`. The workflow already logs the VPS into
GHCR using a temporary `GITHUB_TOKEN`, so **nothing extra is needed** unless you
want the images public (Packages → ⋯ → Change visibility → Public).

### Required GitHub Secrets
| Secret | Purpose |
|---|---|
| `VPS_HOST` | Your VPS IP / hostname |
| `VPS_USER` | SSH user (e.g. `root`) |
| `SSH_PRIVATE_KEY` | Private key matching the public key on the VPS |

### Local builds still work
`docker-compose.prod.yml` keeps a `build:` section as fallback. If `IMAGE_REPO`
isn't set, `docker compose build` builds locally exactly as before.

