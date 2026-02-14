# Deploying Collections Ultimate to Azure

## Architecture

```
┌──────────────────┐      ┌───────────────────────────┐
│  Azure Static     │─────▶│  Azure App Service (API)  │
│  Web Apps (SPA)  │      │  .NET 10 · Linux           │
└──────────────────┘      │  + built-in CORS proxy     │
                          └────────┬──────────┬────────┘
                                   │          │
                          ┌────────▼──┐  ┌────▼─────────┐
                          │ Azure SQL │  │ Azure Blob   │
                          │ Database  │  │ Storage      │
                          └───────────┘  └──────────────┘
                                   │
                          ┌────────▼──────────┐
                          │ Meilisearch       │
                          │ (Docker/ACI/VM)   │
                          └───────────────────┘
```

## Prerequisites

- Azure subscription (free trial works)
- .NET 10 SDK (installed locally for building)
- Node.js 18+ (installed locally for building frontend)
- Auth0 account (already configured)

---

## Step 1: Create a Resource Group

> If you already created `collections-ultimate-rg`, skip to Step 2.

1. Go to [portal.azure.com](https://portal.azure.com)
2. In the top search bar, type **Resource groups** and click it
3. Click **+ Create**
4. Fill in:
   - **Subscription**: Select your subscription
   - **Resource group**: `collections-ultimate-rg`
   - **Region**: `East US` (or whichever is closest to you)
5. Click **Review + create** → **Create**

---

## Step 2: Create the App Service (API)

1. In the portal search bar, type **App Services** and click it
2. Click **+ Create** → **Web App**
3. Fill in the **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource Group**: `collections-ultimate-rg`
   - **Name**: `collections-api` (this becomes `collections-api.azurewebsites.net` — must be globally unique, add a suffix like `collections-api-yourname` if taken)
   - **Publish**: Code
   - **Runtime stack**: .NET 10 (STS)  — if not listed, choose the newest .NET available
   - **Operating System**: Linux
   - **Region**: Same as your resource group (East US)
4. Under **App Service Plan**:
   - Click **Create new** → Name: `collections-api-plan`
   - **Pricing plan**: Click **Explore pricing plans**
     - Choose **Free F1** (under Dev/Test tab) — good enough for testing
     - Or **Basic B1** (~$13/mo) if F1 has quota issues
5. Click **Review + create** → **Create**
6. Wait for deployment to complete (1-2 minutes)

**Write down your app name** — you'll need it. Your API URL will be:
`https://YOUR_APP_NAME.azurewebsites.net`

---

## Step 3: Create Azure SQL Database

### 3a. Create the SQL Server

1. In the portal search bar, type **SQL servers** and click it (under "Services", NOT "SQL databases")
2. Click **+ Create**
3. Fill in:
   - **Resource Group**: `collections-ultimate-rg`
   - **Server name**: `collections-sql` (must be globally unique — add a suffix if taken)
   - **Location**: Same region (East US)
   - **Authentication method**: Select **Use SQL authentication**
   - **Server admin login**: `sqladmin`
   - **Password**: Pick a strong password — **write this down!**
4. Click **Review + create** → **Create**

### 3b. Create the Database

1. In the portal search bar, type **SQL databases** and click it
2. Click **+ Create**
3. Fill in:
   - **Resource Group**: `collections-ultimate-rg`
   - **Database name**: `CollectionsUltimate`
   - **Server**: Select the `collections-sql` server you just created
   - **Want to use SQL elastic pool?**: No
   - **Workload environment**: Development
4. Under **Compute + storage**: Click **Configure database**
   - Choose **Basic** tier (5 DTUs, 2 GB — ~$5/mo)
   - Click **Apply**
5. Click **Review + create** → **Create**

### 3c. Allow Connections

1. Go to your **SQL server** (not database) — search "SQL servers" → click `collections-sql`
2. In the left menu, click **Networking** (under Security)
3. Under **Firewall rules**:
   - Toggle **Allow Azure services and resources to access this server** → **Yes**
   - Click **+ Add your client IPv4 address** (so you can run migrations from your PC)
4. Click **Save**

### 3d. Get Connection String

1. Go to your **SQL database** — search "SQL databases" → click `CollectionsUltimate`
2. In the left menu, click **Connection strings**
3. Copy the **ADO.NET (SQL authentication)** string
4. It looks like: `Server=tcp:collections-sql.database.windows.net,1433;Initial Catalog=CollectionsUltimate;Persist Security Info=False;User ID=sqladmin;Password={your_password};...`
5. **Replace `{your_password}`** with your actual password
6. **Save this connection string** — you'll need it in Step 6

### 3e. Create Schema

From PowerShell on your local machine, run the **single full-schema script** (not the individual migrations — those are for incremental LocalDB upgrades):

```powershell
cd c:\Collections.Ultimate

# Set your values
$sqlServer = "collections-sql.database.windows.net"  # your server name + .database.windows.net
$sqlAdmin  = "sqladmin"
$sqlPass   = "YOUR_PASSWORD_HERE"

# Run the full schema script
sqlcmd -S $sqlServer -d CollectionsUltimate -U $sqlAdmin -P $sqlPass -i api\Db\schema\full_schema.sql
```

You should see `=== Schema creation complete ===` at the end with no errors.

> **Note:** If you need to start over, drop all tables first:
> ```powershell
> sqlcmd -S $sqlServer -d CollectionsUltimate -U $sqlAdmin -P $sqlPass -Q "
>   EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';
>   EXEC sp_MSforeachtable 'DROP TABLE ?';
> "
> ```
> Then re-run the schema script above.

---

## Step 4: Create Storage Account (for cover images)

1. In the portal search bar, type **Storage accounts** and click it
2. Click **+ Create**
3. Fill in:
   - **Resource Group**: `collections-ultimate-rg`
   - **Storage account name**: `collectionsstorage` (must be globally unique, lowercase, no hyphens — add random letters if taken, e.g. `collectionsstorage123`)
   - **Region**: Same region (East US)
   - **Performance**: Standard
   - **Redundancy**: LRS (Locally-redundant storage) — cheapest, fine for testing
4. Click **Review + create** → **Create**

### 4a. Create the Container

1. Open your new storage account
2. In the left menu, click **Containers** (under Data storage)
3. Click **+ Container**
   - **Name**: `covers`
   - **Public access level**: Blob (anonymous read access for blobs only) — so cover images can be displayed
4. Click **Create**

### 4b. Get Connection String

1. In the storage account left menu, click **Access keys** (under Security + networking)
2. Click **Show** next to key1
3. Copy the **Connection string** (the full one starting with `DefaultEndpointsProtocol=https;...`)
4. **Save this** — you'll need it in Step 6

---

## Step 5: Deploy the API Code

### 5a. Build Locally

```powershell
cd c:\Collections.Ultimate\api\Api
dotnet publish -c Release -o ./publish
```

### 5b. Deploy via Portal (Zip Deploy)

```powershell
# Create the zip
Compress-Archive -Path ./publish/* -DestinationPath deploy.zip -Force
```

**Option A — Use Kudu (drag & drop):**
1. Go to `https://YOUR_APP_NAME.scm.azurewebsites.net/ZipDeployUI`
   (e.g., `https://collections-api.scm.azurewebsites.net/ZipDeployUI`)
2. Drag `api/Api/deploy.zip` onto the page
3. Wait for deployment to complete

**Option B — Use Azure CLI** (one command, no session needed):
```powershell
az login
az webapp deploy --name YOUR_APP_NAME --resource-group collections-ultimate-rg `
  --src-path deploy.zip --type zip
```

---

## Step 6: Configure App Service Settings

1. In the portal, go to **App Services** → click your app (e.g., `collections-api`)
2. In the left menu, click **Environment variables**

### 6a. Application Settings

Click **+ Add** for each of these settings (Name → Value):

| Name | Value |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `Storage__Provider` | `Azure` |
| `Storage__Azure__ConnectionString` | *(paste storage connection string from Step 4b)* |
| `Storage__Azure__ContainerName` | `covers` |
| `Cors__AllowedOrigins__0` | `https://YOUR_FRONTEND_DOMAIN` *(fill in after Step 8, or use `http://localhost:5173` for now)* |
| `Auth0__Domain` | `dev-3817i0s85bpfq13x.us.auth0.com` |
| `Auth0__Audience` | `Collections` |

> Skip the Meilisearch settings for now — the API falls back to SQL search automatically.

### 6b. Connection Strings

1. Switch to the **Connection strings** tab
2. Click **+ Add**:
   - **Name**: `Collections`
   - **Value**: *(paste the SQL connection string from Step 3d, with your real password)*
   - **Type**: `SQLAzure`
3. Click **Apply** → **Confirm**

The app will restart automatically.

### 6c. Verify

Open your browser and go to:
```
https://YOUR_APP_NAME.azurewebsites.net/health
```

You should see JSON like:
```json
{ "status": "healthy", "meilisearch": "unavailable (using SQL fallback)" }
```

If you see an error page, check **App Services** → your app → **Log stream** (in left menu) for errors.

---

## Step 7: Deploy Meilisearch (Optional — Skip for Now)

> The API gracefully falls back to SQL search when Meilisearch is unavailable. **Skip this step** and come back later if you want faster full-text search.

If you want to set it up later, create an Azure Container Instance:

1. Portal search → **Container Instances** → **+ Create**
2. Fill in:
   - **Resource Group**: `collections-ultimate-rg`
   - **Container name**: `collections-meili`
   - **Image source**: Other registry
   - **Image**: `getmeili/meilisearch:v1.12`
   - **OS type**: Linux
   - **Size**: 1 vCPU, 1.5 GB memory
3. **Networking** tab: Public, Port `7700` TCP
4. **Advanced** tab: Add environment variables:
   - `MEILI_MASTER_KEY` = pick a strong key
   - `MEILI_ENV` = `production`
5. **Create**
6. Once running, copy the **Public IP**, then go back to App Service → Environment variables and add:
   - `Meilisearch__Url` = `http://THAT_IP:7700`
   - `Meilisearch__MasterKey` = same key you picked

---

## Step 8: Deploy the Frontend

### 8a. Build Locally

First, update the production environment file with your real API URL:

1. Open `web/.env.production` and set:
   ```
   VITE_API_BASE_URL=https://YOUR_APP_NAME.azurewebsites.net
   VITE_PROXY_URL=https://YOUR_APP_NAME.azurewebsites.net/proxy
   ```

2. Build:
   ```powershell
   cd c:\Collections.Ultimate\web
   npm ci
   npm run build
   ```
   This produces a `dist/` folder.

### 8b. Deploy to Azure Static Web Apps

1. Portal search → **Static Web Apps** → **+ Create**
2. Fill in:
   - **Resource Group**: `collections-ultimate-rg`
   - **Name**: `collections-frontend`
   - **Plan type**: Free
   - **Region**: East US 2 (or closest available)
   - **Source**: Other (we'll upload manually)
3. Click **Review + create** → **Create**
4. Once created, open the Static Web App
5. Copy the **URL** shown (something like `https://happy-river-abc123.azurestaticapps.net`)

**Upload the build:**

Install the SWA CLI and deploy:
```powershell
npm install -g @azure/static-web-apps-cli
cd c:\Collections.Ultimate\web
swa deploy ./dist --app-name collections-frontend
```

If prompted to log in, follow the browser instructions.

### 8c. Update the API's CORS Setting

Now that you know your frontend URL, go back to:
**App Services** → your API app → **Environment variables** → edit `Cors__AllowedOrigins__0`:

Set it to your Static Web App URL (e.g., `https://happy-river-abc123.azurestaticapps.net`)

Click **Apply** → **Confirm**.

---

## Step 9: Update Auth0

1. Go to [Auth0 Dashboard](https://manage.auth0.com/) → **Applications** → **Applications** → click your app
2. Scroll to **Application URIs** and **add your frontend URL** to each field (keep the existing localhost entries):

| Field | Add this value |
|---|---|
| **Allowed Callback URLs** | `https://YOUR_FRONTEND_URL` |
| **Allowed Logout URLs** | `https://YOUR_FRONTEND_URL` |
| **Allowed Web Origins** | `https://YOUR_FRONTEND_URL` |

Separate multiple URLs with commas. For example:
```
http://localhost:5173, https://happy-river-abc123.azurestaticapps.net
```

3. Click **Save Changes** at the bottom

---

## Step 10: Verify End-to-End

1. Open your frontend URL in a browser (e.g., `https://happy-river-abc123.azurestaticapps.net`)
2. You should see the login page
3. Log in via Auth0
4. Verify your library loads and search works
5. Try adding a book to confirm write operations work

**Troubleshooting:**
- **Blank page**: Check browser console (F12) for errors. Usually a CORS or Auth0 config issue.
- **401 Unauthorized**: Check Auth0 settings — make sure Audience matches `Collections`.
- **CORS errors**: Make sure `Cors__AllowedOrigins__0` in App Service matches your exact frontend URL (no trailing slash).
- **API errors**: Go to App Services → your app → **Log stream** to see live server logs.
- **Database errors**: Check the connection string has the correct password and the firewall allows Azure services.

---

## Cost Estimate (User Testing)

| Resource | Tier | ~Monthly |
|---|---|---|
| App Service (API) | Free F1 | $0 |
| Azure SQL | Basic (2 GB) | $5 |
| Storage (Blob) | Standard LRS | < $1 |
| Static Web Apps (frontend) | Free | $0 |
| **Total (no Meilisearch)** | | **~$5/mo** |

> Upgrade App Service to B1 (~$13/mo) if you need always-on, custom domain, or SSL. Add Meilisearch ACI (~$30/mo) later if needed.

---

## Quick Reference: Your Values

Fill these in as you go — you'll need them in multiple steps:

| What | Value |
|---|---|
| Resource Group | `collections-ultimate-rg` |
| App Service Name | _________________________ |
| App Service URL | `https://_________.azurewebsites.net` |
| SQL Server Name | _________________________ |
| SQL Admin User | `sqladmin` |
| SQL Password | _________________________ |
| SQL Connection String | _________________________ |
| Storage Account Name | _________________________ |
| Storage Connection String | _________________________ |
| Frontend URL | `https://_________.azurestaticapps.net` |

---

## Secrets Checklist

These values must NOT be committed to git (they're in `.gitignore`):

- [ ] `appsettings.Production.json` — SQL connection string, Azure Storage key, Meilisearch key
- [ ] `web/.env.production` — API keys (Google Books, ISBNdb)
- [ ] Auth0 client secret (managed in Auth0 dashboard, not in code)

Use Azure App Service Configuration (Environment variables) for production secrets — not config files.
