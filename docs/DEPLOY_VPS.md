# Deploying Collections Ultimate to a VPS

A single cheap VPS runs **everything** — API, database, search, and frontend — using Docker Compose with automatic HTTPS.

## Architecture

```
                        ┌─────────────────────────────────────────┐
  users ──▶ HTTPS ──▶   │  Caddy (reverse proxy, auto-SSL)        │
                        │  ├─ /api/*    → .NET API  (:5259)       │
                        │  ├─ /uploads  → .NET API  (static)      │
                        │  ├─ /health   → .NET API                │
                        │  └─ /*        → React SPA (:80)         │
                        │                                         │
                        │  SQL Server 2022 Express (Docker)       │
                        │  Meilisearch (Docker)                   │
                        └─────────────────────────────────────────┘
                              Your VPS  ($6-12/mo)
```

## Cost

| Provider | Plan | RAM | Disk | Price |
|---|---|---|---|---|
| **DigitalOcean** | Basic Droplet | 2 GB | 50 GB | $12/mo |
| **Hetzner** | CX22 | 4 GB | 40 GB | €4.35/mo (~$5) |
| **Linode** | Shared 2 GB | 2 GB | 50 GB | $12/mo |
| **Vultr** | Cloud Compute | 2 GB | 55 GB | $12/mo |

> **Minimum specs**: 2 GB RAM, 25 GB disk. SQL Server Express in Docker needs ~1 GB RAM.
> Hetzner is the cheapest option with excellent performance.

---

## Prerequisites

- A **domain name** (e.g., `collectionsultimate.com`) — needed for HTTPS
- An **Auth0 account** (already configured from local development)
- Your local project working at `c:\Collections.Ultimate`

---

## Step 1: Create a VPS

Pick any provider above. Example with **DigitalOcean**:

1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Click **Create** → **Droplets**
3. Choose:
   - **Image**: Ubuntu 24.04 LTS
   - **Plan**: Basic, Regular, $12/mo (2 GB / 1 vCPU / 50 GB)
   - **Region**: Closest to you
   - **Authentication**: SSH key (recommended) or password
4. Click **Create Droplet**
5. Note the **IP address** (e.g., `164.90.xxx.xxx`)

---

## Step 2: Point Your Domain

Go to your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.) and add a DNS **A record**:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `collections` (or `@` for root) | `164.90.xxx.xxx` (your VPS IP) | 300 |

Wait a few minutes for DNS to propagate. You can check with:
```
nslookup collections.yourdomain.com
```

---

## Step 3: Set Up the VPS

SSH into your server:

```bash
ssh root@164.90.xxx.xxx
```

### 3a. Install Docker

```bash
# Update packages
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

> **Note:** You do NOT need to install `sqlcmd` on the server. The SQL Server Docker container
> includes it, and we use `docker exec` to run it in Step 6.

---

## Step 4: Deploy the Code

### 4a. Copy project to VPS

From your **local machine** (PowerShell):

```powershell
# Option A: Git (recommended — push to GitHub/GitLab first)
# On VPS:
# git clone https://github.com/yourusername/Collections.Ultimate.git /opt/collections~

# Option B: Direct copy via SCP (no git needed)
scp -r C:\Collections.Ultimate root@164.90.xxx.xxx:/opt/collections~
```

### 4b. Configure environment

On the VPS:

```bash
cd /opt/collections~

# Create .env from example
cp .env.example .env

# Edit with your values
nano .env
```

Fill in your `.env`:

> **Never commit real values here.** This file is tracked in git. Keep the only
> copy of your secrets in a password manager, and treat anything that has ever
> appeared in this repository as compromised and in need of rotation.

```dotenv
DOMAIN=your-domain.example.com

# Must be 8+ chars with uppercase, lowercase, number, and symbol
SA_PASSWORD=<from password manager>

MEILI_MASTER_KEY=<from password manager>

AUTH0_DOMAIN=<your-tenant>.us.auth0.com
AUTH0_CLIENT_ID=<from Auth0 dashboard>
AUTH0_AUDIENCE=Collections

# Optional — external metadata API keys
# Google Books API (get from: https://console.cloud.google.com/apis/library/books.googleapis.com)
VITE_GOOGLE_BOOKS_API_KEY=<from Google Cloud console>

# ISBNdb API (get from: https://isbndb.com/apidocs/v2)
VITE_ISBNDB_API_KEY=<from ISBNdb dashboard>
```

> **Note on the `VITE_` keys:** anything prefixed `VITE_` is compiled into the
> public JavaScript bundle at build time and is extractable from any visitor's
> browser. These are not secrets in the deployed app. Move external metadata
> lookups behind a server-side endpoint before charging money — see the
> enrichment worker in the productization plan.

Save and exit (`Ctrl+X`, `Y`, `Enter` in nano).

---
## Step 5: Start Everything

```bash
cd /opt/collections~
docker compose -f docker-compose.prod.yml up -d --build
```

This will:
1. Build the .NET API Docker image
2. Build the React frontend Docker image
3. Start SQL Server, Meilisearch, the API, the frontend, and Caddy
4. Caddy automatically gets an HTTPS certificate from Let's Encrypt

First build takes 3-5 minutes. Watch progress with:
```bash
docker compose -f docker-compose.prod.yml logs -f
```

Wait until you see the API and SQL Server are healthy:
```bash
docker compose -f docker-compose.prod.yml ps
```

All services should show `Up (healthy)` or `Up`

---

## Step 6: Initialize the Database

The database starts empty. Run the schema script **once**:

```bash
cd /opt/collections~

# Wait for SQL Server to be fully ready (30 seconds after starting)
sleep 10

# Create the database
docker exec cu-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$(grep SA_PASSWORD .env | cut -d= -f2)" -C \
  -Q "CREATE DATABASE CollectionsUltimate"

# Run the full schema
docker exec -i cu-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$(grep SA_PASSWORD .env | cut -d= -f2)" -C \
  -d CollectionsUltimate < api/Db/schema/full_schema.sql
```

You should see `=== Schema creation complete ===` at the end.

---

## Step 7: Update Auth0 Settings

In your [Auth0 Dashboard](https://manage.auth0.com):

1. Go to **Applications** → your app
2. Update these fields:
   - **Allowed Callback URLs**: Add `https://collections.yourdomain.com`
   - **Allowed Logout URLs**: Add `https://collections.yourdomain.com`
   - **Allowed Web Origins**: Add `https://collections.yourdomain.com`
3. Click **Save Changes**

---

## Step 8: Verify

Open your browser and visit:

- **`https://collections.yourdomain.com`** — should load the React app
- **`https://collections.yourdomain.com/health`** — should return JSON health status
- **`https://collections.yourdomain.com/swagger`** — should show API docs

That's it! Your app is live with automatic HTTPS.

---

## Common Operations

### View logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Just the API
docker compose -f docker-compose.prod.yml logs -f api

# Just SQL Server
docker compose -f docker-compose.prod.yml logs -f sqlserver
```

### Restart after code changes
```bash
cd /opt/collections~
git pull                        # if using git
docker compose -f docker-compose.prod.yml up -d --build
```

### Stop everything
```bash
docker compose -f docker-compose.prod.yml down
```

### Stop everything AND delete data

> **This command is deliberately not written out here.**
>
> Adding `-v` to `docker compose down` irreversibly destroys all five volumes:
> the database, every uploaded cover photo, the Meilisearch index, and the TLS
> certificates. The volumes are anonymous and project-scoped — there is no
> external declaration protecting them.
>
> There is no legitimate reason to run it against production. If you genuinely
> need to reset a *local* environment, type the flag yourself, having first
> confirmed which Docker context you are pointed at.

### Backup and restore

**See [`ops/README.md`](../ops/README.md).** Do not use an ad-hoc `BACKUP DATABASE`
here.

The procedure that used to live in this section wrote the `.bak` to
`/var/opt/mssql/backup/`, which `docker-compose.prod.yml` mounts **from the same
volume as the live `.mdf` and `.ldf` files** — so the backup shared a failure
domain with the thing it was backing up. It also never touched the `api_uploads`
volume, meaning every cover photo (the only data that cannot be re-fetched from an
external API) was silently excluded.

`ops/cu-backup.sh` replaces it: host-side storage, verified backups, an offsite
push with append-only credentials, a database-to-blob referential check, and a
dead-man's switch. `ops/verify.sql` is the assertion set that proves a restore
actually worked.

### Set up automatic backups (cron)
```bash
# Create backup directory
mkdir -p /opt/collections~/backups

# Add daily backup cron job
crontab -e
# Add this line (backs up daily at 2 AM):
0 2 * * * docker exec cu-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "YOUR_SA_PASSWORD" -C -Q "BACKUP DATABASE CollectionsUltimate TO DISK='/var/opt/mssql/backup/cu_daily.bak' WITH INIT" && docker cp cu-sqlserver:/var/opt/mssql/backup/cu_daily.bak /opt/collections~/backups/cu_$(date +\%Y\%m\%d).bak
```

### Update the server OS
```bash
apt update && apt upgrade -y
docker compose -f docker-compose.prod.yml restart
```

---

## Troubleshooting

### API won't start — "Missing connection string"
Check that SQL Server is healthy first:
```bash
docker compose -f docker-compose.prod.yml ps sqlserver
docker compose -f docker-compose.prod.yml logs sqlserver
```
SQL Server needs ~30 seconds to start. The API should retry automatically.

### "Certificate not issued" / HTTPS not working
- Make sure your domain's A record points to the VPS IP
- Check DNS propagation: `nslookup collections.yourdomain.com`
- Caddy logs: `docker compose -f docker-compose.prod.yml logs caddy`
- Ports 80 and 443 must be open (check VPS firewall/security group)

### SQL Server out of memory
If running on a 1 GB VPS, SQL Server may not start. Use 2 GB minimum. You can also limit its memory:
```yaml
# Add to sqlserver service in docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 1G
```

### Frontend shows blank page
Check that the `VITE_API_BASE_URL` build arg matches your domain:
```bash
docker compose -f docker-compose.prod.yml logs frontend
```
Rebuild if needed: `docker compose -f docker-compose.prod.yml up -d --build frontend`

---

## Migrating to Azure Later

If you outgrow the VPS, see [DEPLOY_AZURE.md](DEPLOY_AZURE.md). Migration steps:

1. **Database**: Backup from Docker SQL → restore to Azure SQL (~10 min)
2. **Cover images**: Copy `/app/wwwroot/uploads` → Azure Blob Storage (~10 min)
3. **API**: Deploy to Azure App Service (change env vars only)
4. **Frontend**: Deploy to Azure Static Web Apps
5. **DNS**: Point domain to Azure

Zero code changes required. Total migration time: ~1 hour.
