using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Dapper;
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

static string Require(string? s, string name)
{
    if (string.IsNullOrWhiteSpace(s))
        throw new InvalidOperationException($"Missing {name}");
    return s;
}

var connectionString = GetArg(args, "--connection")
    ?? Environment.GetEnvironmentVariable("LTIMPORT_CONNECTION");

var filePath = GetArg(args, "--file")
    ?? Environment.GetEnvironmentVariable("LTIMPORT_FILE");

var householdIdRaw = GetArg(args, "--household")
    ?? Environment.GetEnvironmentVariable("LTIMPORT_HOUSEHOLD");

var source = GetArg(args, "--source")
    ?? Environment.GetEnvironmentVariable("LTIMPORT_SOURCE")
    ?? "librarything";

connectionString = Require(connectionString, "--connection (or LTIMPORT_CONNECTION)");
filePath = Require(filePath, "--file (or LTIMPORT_FILE)");
householdIdRaw = Require(householdIdRaw, "--household (or LTIMPORT_HOUSEHOLD)");

if (!Guid.TryParse(householdIdRaw, out var householdId))
    throw new InvalidOperationException("--household must be a GUID");

if (!File.Exists(filePath))
    throw new FileNotFoundException("JSON file not found", filePath);

var fileName = Path.GetFileName(filePath);
var json = await File.ReadAllTextAsync(filePath);

using var doc = JsonDocument.Parse(json);
if (doc.RootElement.ValueKind != JsonValueKind.Object)
    throw new InvalidOperationException("Expected JSON object root (LibraryThing export format)");

var batchId = Guid.NewGuid();
var startedUtc = DateTimeOffset.UtcNow;

await using var conn = new SqlConnection(connectionString);
await conn.OpenAsync();

// Create batch
{
    const string sql = """
        insert into dbo.ImportBatches (Id, OwnerHouseholdId, Source, FileName, StartedUtc, Status)
        values (@Id, @OwnerHouseholdId, @Source, @FileName, @StartedUtc, @Status);
        """;

    await conn.ExecuteAsync(sql, new
    {
        Id = batchId,
        OwnerHouseholdId = householdId,
        Source = source,
        FileName = fileName,
        StartedUtc = startedUtc,
        Status = "Pending"
    });
}

var inserted = 0;
var skipped = 0;

foreach (var prop in doc.RootElement.EnumerateObject())
{
    var externalId = prop.Name;
    var payloadJson = prop.Value.GetRawText();
    var bytes = Encoding.UTF8.GetBytes(payloadJson);
    var hash = Sha256(bytes);

    var recordId = Guid.NewGuid();

    try
    {
        const string sql = """
            insert into dbo.ImportRecords
            (
                Id,
                BatchId,
                ExternalId,
                PayloadJson,
                PayloadSha256,
                Status
            )
            values
            (
                @Id,
                @BatchId,
                @ExternalId,
                @PayloadJson,
                @PayloadSha256,
                @Status
            );
            """;

        await conn.ExecuteAsync(sql, new
        {
            Id = recordId,
            BatchId = batchId,
            ExternalId = externalId,
            PayloadJson = payloadJson,
            PayloadSha256 = hash,
            Status = "Pending"
        });

        inserted++;
    }
    catch (SqlException ex) when (ex.Number is 2601 or 2627)
    {
        // Unique constraint violation (e.g., duplicate ExternalId in same batch)
        skipped++;
        continue;
    }
}

var finishedUtc = DateTimeOffset.UtcNow;

// Complete batch
{
    const string sql = """
        update dbo.ImportBatches
        set FinishedUtc = @FinishedUtc,
            Status = @Status
        where Id = @Id;
        """;

    await conn.ExecuteAsync(sql, new
    {
        Id = batchId,
        FinishedUtc = finishedUtc,
        Status = "Completed"
    });
}

Console.WriteLine($"Batch {batchId} completed. Inserted={inserted}, Skipped={skipped}");
