# Local database setup (SQL Server)

This API uses SQL Server via `Microsoft.Data.SqlClient` + Dapper.

You have two local options:
- **SQL Server Developer/Express (Windows service)** (recommended for shared/multi-user machines)
- SQL Server **LocalDB** (per-user)

## Option C (recommended): SQL Server Developer/Express (local service)

### Prereqs

- Windows
- Install **SQL Server Developer** or **SQL Server Express**
- Ensure the **Database Engine** service is running
- Your Windows user has permissions (typically local admin will)

### 1) Create the database + schema

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Init-SqlServer.ps1 -Server localhost
```

### 2) Configure the API connection string

Use the `http-sqlserver` launch profile (sets `ConnectionStrings__Collections`) or set:

`ConnectionStrings:Collections = Server=localhost;Database=CollectionsUltimate;Trusted_Connection=True;TrustServerCertificate=True`

If you installed SQL Express named instance, use for example:

`Server=localhost\\SQLEXPRESS;Database=CollectionsUltimate;Trusted_Connection=True;TrustServerCertificate=True`

### 3) Run the API

```powershell
dotnet run --project .\src\Api
```

## Option A/B: SQL Server LocalDB (per-user)

### Prereqs

- Windows
- Visual Studio (recommended) with **SQL Server Express LocalDB**
- .NET SDK (for running the bootstrap tool)

### 1) Create the database + schema

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Init-LocalDb.ps1
```

## Quick smoke test

```powershell
# create household
curl -X POST http://localhost:5258/api/households -H "Content-Type: application/json" -d "{\"name\":\"Test Household\"}"

# list households
curl http://localhost:5258/api/households
