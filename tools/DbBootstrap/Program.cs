using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

static string? GetArg(string[] args, string name)
{
    var prefix = name + "=";
    foreach (var a in args)
    {
        if (a.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            return a[prefix.Length..];
    }

    return null;
}

static byte[] Sha256(byte[] data)
{
    using var sha = SHA256.Create();
    return sha.ComputeHash(data);
}

static int ParseVersionFromFileName(string fileName)
{
    var stem = Path.GetFileNameWithoutExtension(fileName);
    var idx = stem.IndexOf('_');
    var token = idx >= 0 ? stem[..idx] : stem;

    if (!int.TryParse(token, out var v))
        throw new InvalidOperationException($"Migration file name must start with an integer version: {fileName}");

    return v;
}

var connectionString = GetArg(args, "--connection")
    ?? Environment.GetEnvironmentVariable("DBBOOTSTRAP_CONNECTION")
    ?? "";

var migrationsPath = GetArg(args, "--migrations")
    ?? Environment.GetEnvironmentVariable("DBBOOTSTRAP_MIGRATIONS")
    ?? "";

var schemaPath = GetArg(args, "--schema")
    ?? Environment.GetEnvironmentVariable("DBBOOTSTRAP_SCHEMA")
    ?? "";

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("Missing --connection=<connectionString> (or DBBOOTSTRAP_CONNECTION). Use database=master for create-db step.");
    return 2;
}

await using var conn = new SqlConnection(connectionString);
await conn.OpenAsync();

if (!string.IsNullOrWhiteSpace(schemaPath))
{
    if (!File.Exists(schemaPath))
    {
        Console.Error.WriteLine($"Schema file not found: {schemaPath}");
        return 2;
    }

    var sql = await File.ReadAllTextAsync(schemaPath);

    await using var cmd = conn.CreateCommand();
    cmd.CommandText = sql;
    cmd.CommandTimeout = 60;
    await cmd.ExecuteNonQueryAsync();

    Console.WriteLine("Schema applied successfully (legacy mode).");
    return 0;
}

if (string.IsNullOrWhiteSpace(migrationsPath))
{
    Console.Error.WriteLine("Missing --migrations=<pathToFolder> (or DBBOOTSTRAP_MIGRATIONS). Alternatively specify --schema=<pathToSqlFile> for legacy mode.");
    return 2;
}

if (!Directory.Exists(migrationsPath))
{
    Console.Error.WriteLine($"Migrations folder not found: {migrationsPath}");
    return 2;
}

// Ensure SchemaVersions exists before attempting to read it.
{
    const string ensureSql = """
        set nocount on;
        if schema_id(N'dbo') is null exec(N'create schema dbo');
        if object_id(N'dbo.SchemaVersions', N'U') is null
        begin
            create table dbo.SchemaVersions
            (
                Version int not null,
                AppliedUtc datetimeoffset(7) not null,
                ScriptName nvarchar(260) not null,
                Checksum varbinary(32) not null,
                constraint PK_SchemaVersions primary key clustered (Version)
            );
            create unique index UX_SchemaVersions_ScriptName on dbo.SchemaVersions(ScriptName);
        end
        """;
    Console.WriteLine(ensureSql);
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = ensureSql;
    cmd.CommandTimeout = 60;
    await cmd.ExecuteNonQueryAsync();
}

var migrationFiles = Directory
    .EnumerateFiles(migrationsPath, "*.sql", SearchOption.TopDirectoryOnly)
    .OrderBy(f => ParseVersionFromFileName(f))
    .ThenBy(f => f, StringComparer.OrdinalIgnoreCase)
    .ToList();

if (migrationFiles.Count == 0)
{
    Console.WriteLine("No migrations found.");
    return 0;
}

var applied = new Dictionary<int, (string ScriptName, byte[] Checksum)>();
{
    const string selectSql = "select Version, ScriptName, Checksum from dbo.SchemaVersions";
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = selectSql;
    cmd.CommandTimeout = 60;

    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        var version = reader.GetInt32(0);
        var scriptName = reader.GetString(1);
        var checksum = (byte[])reader[2];
        applied[version] = (scriptName, checksum);
    }
}

foreach (var file in migrationFiles)
{
    var version = ParseVersionFromFileName(file);
    var scriptName = Path.GetFileName(file);
    var bytes = await File.ReadAllBytesAsync(file);
    var checksum = Sha256(bytes);

    if (applied.TryGetValue(version, out var existing))
    {
        if (!existing.Checksum.SequenceEqual(checksum) || !string.Equals(existing.ScriptName, scriptName, StringComparison.OrdinalIgnoreCase))
        {
            Console.Error.WriteLine($"Migration {version} already applied but differs from current file: {scriptName}." +
                                    $" Applied as: {existing.ScriptName}.");
            return 3;
        }

        continue;
    }

    var sql = Encoding.UTF8.GetString(bytes);

    await using var tx = await conn.BeginTransactionAsync();
    try
    {
        await using (var cmd = conn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = sql;
            cmd.CommandTimeout = 60;
            await cmd.ExecuteNonQueryAsync();
        }

        await using (var cmd = conn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = """
                insert into dbo.SchemaVersions(Version, AppliedUtc, ScriptName, Checksum)
                values (@Version, sysdatetimeoffset(), @ScriptName, @Checksum);
                """;
            cmd.CommandTimeout = 60;
            cmd.Parameters.AddWithValue("@Version", version);
            cmd.Parameters.AddWithValue("@ScriptName", scriptName);
            cmd.Parameters.AddWithValue("@Checksum", checksum);
            await cmd.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();
        Console.WriteLine($"Applied {version}: {scriptName}");
    }
    catch
    {
        await tx.RollbackAsync();
        throw;
    }
}

Console.WriteLine("Migrations applied successfully.");
return 0;
