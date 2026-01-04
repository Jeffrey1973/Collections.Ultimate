param(
    [string]$Server = "localhost",
    [string]$DatabaseName = "CollectionsUltimate",
    [string]$CreateDbScript = "${PSScriptRoot}\sql\000_create_db.sql",
    [string]$MigrationsFolder = "${PSScriptRoot}\..\src\Db\migrations"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $CreateDbScript)) {
    throw "Create-db script not found: $CreateDbScript"
}

if (-not (Test-Path $MigrationsFolder)) {
    throw "Migrations folder not found: $MigrationsFolder"
}

$bootstrapProject = Join-Path $PSScriptRoot "..\tools\DbBootstrap\DbBootstrap.csproj"

if (-not (Test-Path $bootstrapProject)) {
    throw "DbBootstrap project not found: $bootstrapProject"
}

Write-Host "Ensuring database exists: $DatabaseName on $Server"
$createConn = "Server=$Server;Database=master;Trusted_Connection=True;TrustServerCertificate=True"

dotnet run --project $bootstrapProject -- --connection="$createConn" --schema="$CreateDbScript" | Out-Host

Write-Host "Applying migrations: $MigrationsFolder"
$schemaConn = "Server=$Server;Database=$DatabaseName;Trusted_Connection=True;TrustServerCertificate=True"

dotnet run --project $bootstrapProject -- --connection="$schemaConn" --migrations="$MigrationsFolder" | Out-Host

Write-Host "Done. Connection string: $schemaConn"
