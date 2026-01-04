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

var connectionString = GetArg(args, "--connection")
    ?? Environment.GetEnvironmentVariable("DBBOOTSTRAP_CONNECTION")
    ?? "";

var schemaPath = GetArg(args, "--schema")
    ?? Environment.GetEnvironmentVariable("DBBOOTSTRAP_SCHEMA")
    ?? "";

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("Missing --connection=<connectionString> (or DBBOOTSTRAP_CONNECTION). Use database=master for create-db step.");
    return 2;
}

if (string.IsNullOrWhiteSpace(schemaPath))
{
    Console.Error.WriteLine("Missing --schema=<pathToSqlFile> (or DBBOOTSTRAP_SCHEMA).");
    return 2;
}

if (!File.Exists(schemaPath))
{
    Console.Error.WriteLine($"Schema file not found: {schemaPath}");
    return 2;
}

var sql = await File.ReadAllTextAsync(schemaPath);

await using var conn = new SqlConnection(connectionString);
await conn.OpenAsync();

// Execute as a single batch. The schema file avoids GO separators.
await using var cmd = conn.CreateCommand();
cmd.CommandText = sql;
cmd.CommandTimeout = 60;
await cmd.ExecuteNonQueryAsync();

Console.WriteLine("Schema applied successfully.");
return 0;
