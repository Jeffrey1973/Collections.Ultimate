param(
    [string]$DatabaseName = "CollectionsUltimate",
    [string]$LocalDbInstance = "MSSQLLocalDB",
    [string]$CreateDbScript = "${PSScriptRoot}\sql\000_create_db.sql",
    [string]$SchemaScript = "${PSScriptRoot}\sql\001_init.sql"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $CreateDbScript)) {
    throw "Create-db script not found: $CreateDbScript"
}

if (-not (Test-Path $SchemaScript)) {
    throw "Schema script not found: $SchemaScript"
}

Write-Host "Ensuring LocalDB instance exists: $LocalDbInstance"
& sqllocaldb create $LocalDbInstance 2>$null | Out-Null
& sqllocaldb start $LocalDbInstance | Out-Null

# Get the instance pipe name for direct connection (avoids name resolution issues)
$infoOutput = & sqllocaldb info $LocalDbInstance | Out-String
if ($infoOutput -match 'Instance pipe name:\s*(.+)') {
    $pipeName = $matches[1].Trim()
    Write-Host "Using instance pipe: $pipeName"
    $server = $pipeName
} else {
    Write-Host "Pipe name not found, falling back to instance name"
    $server = "(localdb)\\$LocalDbInstance"
}

$bootstrapProject = Join-Path $PSScriptRoot "..\tools\DbBootstrap\DbBootstrap.csproj"

if (-not (Test-Path $bootstrapProject)) {
    throw "DbBootstrap project not found: $bootstrapProject"
}

Write-Host "Ensuring database exists: $DatabaseName"
$createConn = "Server=$server;Database=master;Trusted_Connection=True;TrustServerCertificate=True"

dotnet run --project $bootstrapProject -- --connection="$createConn" --schema="$CreateDbScript" | Out-Host

Write-Host "Applying schema: $SchemaScript"
$schemaConn = "Server=$server;Database=$DatabaseName;Trusted_Connection=True;TrustServerCertificate=True"

dotnet run --project $bootstrapProject -- --connection="$schemaConn" --schema="$SchemaScript" | Out-Host

Write-Host ""
Write-Host "Done! To use in your app, set:"
Write-Host "ConnectionStrings:Collections = Server=$server;Database=$DatabaseName;Trusted_Connection=True;TrustServerCertificate=True"
