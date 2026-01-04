using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class ImportRepository : IImportRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public ImportRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task CreateBatchAsync(ImportBatch batch, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.ImportBatches
            (
                Id,
                OwnerHouseholdId,
                Source,
                FileName,
                StartedUtc,
                FinishedUtc,
                Status
            )
            values
            (
                @Id,
                @OwnerHouseholdId,
                @Source,
                @FileName,
                @StartedUtc,
                @FinishedUtc,
                @Status
            );
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = batch.Id.Value,
            OwnerHouseholdId = batch.OwnerHouseholdId.Value,
            batch.Source,
            batch.FileName,
            batch.StartedUtc,
            batch.FinishedUtc,
            Status = batch.Status.ToString()
        }, cancellationToken: ct));
    }

    public async Task CompleteBatchAsync(ImportBatchId batchId, ImportStatus status, DateTimeOffset finishedUtc, CancellationToken ct)
    {
        const string sql = """
            update dbo.ImportBatches
            set FinishedUtc = @FinishedUtc,
                Status = @Status
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = batchId.Value,
            FinishedUtc = finishedUtc,
            Status = status.ToString()
        }, cancellationToken: ct));
    }

    public async Task AddRecordAsync(ImportRecord record, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.ImportRecords
            (
                Id,
                BatchId,
                ExternalId,
                PayloadJson,
                PayloadSha256,
                CreatedUtc,
                Status,
                Error
            )
            values
            (
                @Id,
                @BatchId,
                @ExternalId,
                @PayloadJson,
                @PayloadSha256,
                @CreatedUtc,
                @Status,
                @Error
            );
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = record.Id.Value,
            BatchId = record.BatchId.Value,
            record.ExternalId,
            record.PayloadJson,
            record.PayloadSha256,
            record.CreatedUtc,
            Status = record.Status.ToString(),
            record.Error
        }, cancellationToken: ct));
    }

    public async Task<ImportBatch?> GetBatchAsync(ImportBatchId batchId, CancellationToken ct)
    {
        const string sql = """
            select Id, OwnerHouseholdId, Source, FileName, StartedUtc, FinishedUtc, Status
            from dbo.ImportBatches
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<ImportBatchRow>(new CommandDefinition(sql, new { Id = batchId.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<ImportBatch>> ListBatchesAsync(HouseholdId householdId, int take, int skip, CancellationToken ct)
    {
        const string sql = """
            select
                Id,
                OwnerHouseholdId,
                Source,
                FileName,
                StartedUtc,
                FinishedUtc,
                Status
            from dbo.ImportBatches
            where OwnerHouseholdId = @OwnerHouseholdId
            order by StartedUtc desc
            offset @Skip rows fetch next @Take rows only;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ImportBatchRow>(new CommandDefinition(sql, new
        {
            OwnerHouseholdId = householdId.Value,
            Take = take,
            Skip = skip
        }, cancellationToken: ct));

        return rows.Select(Map).ToList();
    }

    public async Task<IReadOnlyDictionary<string, int>> GetBatchStatusCountsAsync(ImportBatchId batchId, CancellationToken ct)
    {
        const string sql = """
            select Status, count(*) as C
            from dbo.ImportRecords
            where BatchId = @BatchId
            group by Status;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<StatusCountRow>(new CommandDefinition(sql, new { BatchId = batchId.Value }, cancellationToken: ct));
        return rows.ToDictionary(r => r.Status, r => r.C, StringComparer.OrdinalIgnoreCase);
    }

    public async Task<IReadOnlyList<ImportRecordFailure>> ListFailuresAsync(ImportBatchId batchId, int take, int skip, CancellationToken ct)
    {
        const string sql = """
            select
                Id,
                ExternalId,
                CreatedUtc,
                ProcessedUtc,
                Error
            from dbo.ImportRecords
            where BatchId = @BatchId
              and Status = 'Failed'
            order by ProcessedUtc desc, CreatedUtc desc
            offset @Skip rows fetch next @Take rows only;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<FailureRow>(new CommandDefinition(sql, new { BatchId = batchId.Value, Take = take, Skip = skip }, cancellationToken: ct));

        return rows.Select(r => new ImportRecordFailure(
            new ImportRecordId(r.Id),
            r.ExternalId,
            r.CreatedUtc,
            r.ProcessedUtc,
            r.Error ?? string.Empty)).ToList();
    }

    public async Task<IReadOnlyList<ImportRecord>> ListPendingRecordsAsync(ImportBatchId batchId, int take, CancellationToken ct)
    {
        const string sql = """
            select top (@Take)
                Id,
                BatchId,
                ExternalId,
                PayloadJson,
                PayloadSha256,
                CreatedUtc,
                Status,
                Error
            from dbo.ImportRecords
            where BatchId = @BatchId
              and ProcessedUtc is null
            order by CreatedUtc;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ImportRecordRow>(new CommandDefinition(sql, new { BatchId = batchId.Value, Take = take }, cancellationToken: ct));
        return rows.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<ImportRecord>> ListFailedRecordsAsync(ImportBatchId batchId, int take, CancellationToken ct)
    {
        const string sql = """
            select top (@Take)
                Id,
                BatchId,
                ExternalId,
                PayloadJson,
                PayloadSha256,
                CreatedUtc,
                Status,
                Error
            from dbo.ImportRecords
            where BatchId = @BatchId
              and Status = 'Failed'
            order by ProcessedUtc desc, CreatedUtc desc;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ImportRecordRow>(new CommandDefinition(sql, new { BatchId = batchId.Value, Take = take }, cancellationToken: ct));
        return rows.Select(Map).ToList();
    }

    public async Task ResetFailedRecordsAsync(ImportBatchId batchId, CancellationToken ct)
    {
        const string sql = """
            update dbo.ImportRecords
            set Status = 'Pending',
                Error = null,
                ProcessedUtc = null,
                WorkId = null,
                EditionId = null,
                ItemId = null
            where BatchId = @BatchId
              and Status = 'Failed';
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new { BatchId = batchId.Value }, cancellationToken: ct));
    }

    public async Task MarkRecordCompletedAsync(ImportRecordId recordId, Guid? workId, Guid? editionId, Guid? itemId, DateTimeOffset processedUtc, CancellationToken ct)
    {
        const string sql = """
            update dbo.ImportRecords
            set Status = @Status,
                Error = null,
                WorkId = @WorkId,
                EditionId = @EditionId,
                ItemId = @ItemId,
                ProcessedUtc = @ProcessedUtc
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = recordId.Value,
            Status = ImportStatus.Completed.ToString(),
            WorkId = workId,
            EditionId = editionId,
            ItemId = itemId,
            ProcessedUtc = processedUtc
        }, cancellationToken: ct));
    }

    public async Task MarkRecordFailedAsync(ImportRecordId recordId, string error, DateTimeOffset processedUtc, CancellationToken ct)
    {
        const string sql = """
            update dbo.ImportRecords
            set Status = @Status,
                Error = @Error,
                ProcessedUtc = @ProcessedUtc
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = recordId.Value,
            Status = ImportStatus.Failed.ToString(),
            Error = error,
            ProcessedUtc = processedUtc
        }, cancellationToken: ct));
    }

    private static ImportBatch Map(ImportBatchRow r)
        => new()
        {
            Id = new ImportBatchId(r.Id),
            OwnerHouseholdId = new HouseholdId(r.OwnerHouseholdId),
            Source = r.Source,
            FileName = r.FileName,
            StartedUtc = r.StartedUtc,
            FinishedUtc = r.FinishedUtc,
            Status = Enum.TryParse<ImportStatus>(r.Status, out var s) ? s : ImportStatus.Pending
        };

    private static ImportRecord Map(ImportRecordRow r)
        => new()
        {
            Id = new ImportRecordId(r.Id),
            BatchId = new ImportBatchId(r.BatchId),
            ExternalId = r.ExternalId,
            PayloadJson = r.PayloadJson,
            PayloadSha256 = r.PayloadSha256,
            CreatedUtc = r.CreatedUtc,
            Status = Enum.TryParse<ImportStatus>(r.Status, out var s) ? s : ImportStatus.Pending,
            Error = r.Error
        };

    private sealed record ImportBatchRow(Guid Id, Guid OwnerHouseholdId, string Source, string? FileName, DateTimeOffset StartedUtc, DateTimeOffset? FinishedUtc, string Status);

    private sealed record ImportRecordRow(
        Guid Id,
        Guid BatchId,
        string? ExternalId,
        string PayloadJson,
        byte[] PayloadSha256,
        DateTimeOffset CreatedUtc,
        string Status,
        string? Error);

    private sealed record StatusCountRow(string Status, int C);

    private sealed record FailureRow(Guid Id, string? ExternalId, DateTimeOffset CreatedUtc, DateTimeOffset? ProcessedUtc, string? Error);
}
