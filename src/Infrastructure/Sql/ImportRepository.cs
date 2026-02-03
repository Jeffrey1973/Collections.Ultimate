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
            insert into dbo.ImportBatch
            (
                Id,
                HouseholdId,
                FileName,
                Status,
                TotalRows,
                ProcessedRows,
                SuccessRows,
                FailedRows,
                StartedUtc,
                CompletedUtc,
                CreatedUtc
            )
            values
            (
                @Id,
                @HouseholdId,
                @FileName,
                @Status,
                @TotalRows,
                @ProcessedRows,
                @SuccessRows,
                @FailedRows,
                @StartedUtc,
                @CompletedUtc,
                @CreatedUtc
            );
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = batch.Id.Value,
            HouseholdId = batch.HouseholdId.Value,
            batch.FileName,
            Status = batch.Status.ToString(),
            batch.TotalRows,
            batch.ProcessedRows,
            batch.SuccessRows,
            batch.FailedRows,
            batch.StartedUtc,
            batch.CompletedUtc,
            batch.CreatedUtc
        }, cancellationToken: ct));
    }

    public async Task CompleteBatchAsync(ImportBatchId batchId, ImportStatus status, DateTimeOffset completedUtc, CancellationToken ct)
    {
        const string sql = """
            update dbo.ImportBatch
            set CompletedUtc = @CompletedUtc,
                Status = @Status
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = batchId.Value,
            CompletedUtc = completedUtc,
            Status = status.ToString()
        }, cancellationToken: ct));
    }

    public async Task AddRowAsync(ImportRow row, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.ImportRow
            (
                Id,
                BatchId,
                RowNumber,
                Status,
                RawData,
                ErrorMessage,
                CreatedItemId,
                ProcessedUtc
            )
            values
            (
                @Id,
                @BatchId,
                @RowNumber,
                @Status,
                @RawData,
                @ErrorMessage,
                @CreatedItemId,
                @ProcessedUtc
            );
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = row.Id.Value,
            BatchId = row.BatchId.Value,
            row.RowNumber,
            Status = row.Status.ToString(),
            row.RawData,
            row.ErrorMessage,
            row.CreatedItemId,
            row.ProcessedUtc
        }, cancellationToken: ct));
    }

    public async Task<ImportBatch?> GetBatchAsync(ImportBatchId batchId, CancellationToken ct)
    {
        const string sql = """
            select Id, HouseholdId, FileName, Status, TotalRows, ProcessedRows, SuccessRows, FailedRows, StartedUtc, CompletedUtc, CreatedUtc
            from dbo.ImportBatch
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
                HouseholdId,
                FileName,
                Status,
                TotalRows,
                ProcessedRows,
                SuccessRows,
                FailedRows,
                StartedUtc,
                CompletedUtc,
                CreatedUtc
            from dbo.ImportBatch
            where HouseholdId = @HouseholdId
            order by CreatedUtc desc
            offset @Skip rows fetch next @Take rows only;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ImportBatchRow>(new CommandDefinition(sql, new
        {
            HouseholdId = householdId.Value,
            Take = take,
            Skip = skip
        }, cancellationToken: ct));

        return rows.Select(Map).ToList();
    }

    public async Task<IReadOnlyDictionary<string, int>> GetBatchStatusCountsAsync(ImportBatchId batchId, CancellationToken ct)
    {
        const string sql = """
            select Status, count(*) as C
            from dbo.ImportRow
            where BatchId = @BatchId
            group by Status;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<StatusCountRow>(new CommandDefinition(sql, new { BatchId = batchId.Value }, cancellationToken: ct));
        return rows.ToDictionary(r => r.Status, r => r.C, StringComparer.OrdinalIgnoreCase);
    }

    public async Task<IReadOnlyList<ImportRowFailure>> ListFailuresAsync(ImportBatchId batchId, int take, int skip, CancellationToken ct)
    {
        const string sql = """
            select
                Id,
                RowNumber,
                ProcessedUtc,
                ErrorMessage
            from dbo.ImportRow
            where BatchId = @BatchId
              and Status = 'Failed'
            order by RowNumber
            offset @Skip rows fetch next @Take rows only;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<FailureRow>(new CommandDefinition(sql, new { BatchId = batchId.Value, Take = take, Skip = skip }, cancellationToken: ct));

        return rows.Select(r => new ImportRowFailure(
            new ImportRowId(r.Id),
            r.RowNumber,
            r.ProcessedUtc,
            r.ErrorMessage ?? string.Empty)).ToList();
    }

    public async Task<IReadOnlyList<ImportRow>> ListPendingRowsAsync(ImportBatchId batchId, int take, CancellationToken ct)
    {
        const string sql = """
            select top (@Take)
                Id,
                BatchId,
                RowNumber,
                Status,
                RawData,
                ErrorMessage,
                CreatedItemId,
                ProcessedUtc
            from dbo.ImportRow
            where BatchId = @BatchId
              and Status = 'Pending'
            order by RowNumber;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ImportRowRow>(new CommandDefinition(sql, new { BatchId = batchId.Value, Take = take }, cancellationToken: ct));
        return rows.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<ImportRow>> ListFailedRowsAsync(ImportBatchId batchId, int take, CancellationToken ct)
    {
        const string sql = """
            select top (@Take)
                Id,
                BatchId,
                RowNumber,
                Status,
                RawData,
                ErrorMessage,
                CreatedItemId,
                ProcessedUtc
            from dbo.ImportRow
            where BatchId = @BatchId
              and Status = 'Failed'
            order by RowNumber;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ImportRowRow>(new CommandDefinition(sql, new { BatchId = batchId.Value, Take = take }, cancellationToken: ct));
        return rows.Select(Map).ToList();
    }

    public async Task ResetFailedRowsAsync(ImportBatchId batchId, CancellationToken ct)
    {
        const string sql = """
            update dbo.ImportRow
            set Status = 'Pending',
                ErrorMessage = null,
                ProcessedUtc = null,
                CreatedItemId = null
            where BatchId = @BatchId
              and Status = 'Failed';
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new { BatchId = batchId.Value }, cancellationToken: ct));
    }

    public async Task MarkRowCompletedAsync(ImportRowId rowId, Guid? createdItemId, DateTimeOffset processedUtc, CancellationToken ct)
    {
        const string sql = """
            update dbo.ImportRow
            set Status = @Status,
                ErrorMessage = null,
                CreatedItemId = @CreatedItemId,
                ProcessedUtc = @ProcessedUtc
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = rowId.Value,
            Status = ImportStatus.Completed.ToString(),
            CreatedItemId = createdItemId,
            ProcessedUtc = processedUtc
        }, cancellationToken: ct));
    }

    public async Task MarkRowFailedAsync(ImportRowId rowId, string errorMessage, DateTimeOffset processedUtc, CancellationToken ct)
    {
        const string sql = """
            update dbo.ImportRow
            set Status = @Status,
                ErrorMessage = @ErrorMessage,
                ProcessedUtc = @ProcessedUtc
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = rowId.Value,
            Status = ImportStatus.Failed.ToString(),
            ErrorMessage = errorMessage,
            ProcessedUtc = processedUtc
        }, cancellationToken: ct));
    }

    private static ImportBatch Map(ImportBatchRow r)
        => new()
        {
            Id = new ImportBatchId(r.Id),
            HouseholdId = new HouseholdId(r.HouseholdId),
            FileName = r.FileName,
            Status = Enum.TryParse<ImportStatus>(r.Status, out var s) ? s : ImportStatus.Pending,
            TotalRows = r.TotalRows,
            ProcessedRows = r.ProcessedRows,
            SuccessRows = r.SuccessRows,
            FailedRows = r.FailedRows,
            StartedUtc = r.StartedUtc,
            CompletedUtc = r.CompletedUtc,
            CreatedUtc = r.CreatedUtc
        };

    private static ImportRow Map(ImportRowRow r)
        => new()
        {
            Id = new ImportRowId(r.Id),
            BatchId = new ImportBatchId(r.BatchId),
            RowNumber = r.RowNumber,
            Status = Enum.TryParse<ImportStatus>(r.Status, out var s) ? s : ImportStatus.Pending,
            RawData = r.RawData,
            ErrorMessage = r.ErrorMessage,
            CreatedItemId = r.CreatedItemId,
            ProcessedUtc = r.ProcessedUtc
        };

    private sealed record ImportBatchRow(
        Guid Id,
        Guid HouseholdId,
        string? FileName,
        string Status,
        int? TotalRows,
        int? ProcessedRows,
        int? SuccessRows,
        int? FailedRows,
        DateTimeOffset? StartedUtc,
        DateTimeOffset? CompletedUtc,
        DateTimeOffset CreatedUtc);

    private sealed record ImportRowRow(
        Guid Id,
        Guid BatchId,
        int RowNumber,
        string Status,
        string? RawData,
        string? ErrorMessage,
        Guid? CreatedItemId,
        DateTimeOffset? ProcessedUtc);

    private sealed record StatusCountRow(string Status, int C);

    private sealed record FailureRow(Guid Id, int RowNumber, DateTimeOffset? ProcessedUtc, string? ErrorMessage);
}
