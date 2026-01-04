param(
    [string]$Server = "localhost",
    [string]$DatabaseName = "CollectionsUltimate",
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

$bootstrapProject = Join-Path $PSScriptRoot "..\tools\DbBootstrap\DbBootstrap.csproj"

if (-not (Test-Path $bootstrapProject)) {
    throw "DbBootstrap project not found: $bootstrapProject"
}

Write-Host "Ensuring database exists: $DatabaseName on $Server"
$createConn = "Server=$Server;Database=master;Trusted_Connection=True;TrustServerCertificate=True"

dotnet run --project $bootstrapProject -- --connection="$createConn" --schema="$CreateDbScript" | Out-Host

Write-Host "Applying schema: $SchemaScript"
$schemaConn = "Server=$Server;Database=$DatabaseName;Trusted_Connection=True;TrustServerCertificate=True"

dotnet run --project $bootstrapProject -- --connection="$schemaConn" --schema="$SchemaScript" | Out-Host

Write-Host "Done. Connection string: $schemaConn"
