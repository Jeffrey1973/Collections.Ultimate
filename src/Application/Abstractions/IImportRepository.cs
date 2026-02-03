using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IImportRepository
{
    Task CreateBatchAsync(ImportBatch batch, CancellationToken ct);
    Task CompleteBatchAsync(ImportBatchId batchId, ImportStatus status, DateTimeOffset completedUtc, CancellationToken ct);
    Task AddRowAsync(ImportRow row, CancellationToken ct);

    Task<ImportBatch?> GetBatchAsync(ImportBatchId batchId, CancellationToken ct);
    Task<IReadOnlyList<ImportBatch>> ListBatchesAsync(HouseholdId householdId, int take, int skip, CancellationToken ct);
    Task<IReadOnlyDictionary<string, int>> GetBatchStatusCountsAsync(ImportBatchId batchId, CancellationToken ct);
    Task<IReadOnlyList<ImportRowFailure>> ListFailuresAsync(ImportBatchId batchId, int take, int skip, CancellationToken ct);

    Task<IReadOnlyList<ImportRow>> ListPendingRowsAsync(ImportBatchId batchId, int take, CancellationToken ct);
    Task<IReadOnlyList<ImportRow>> ListFailedRowsAsync(ImportBatchId batchId, int take, CancellationToken ct);
    Task ResetFailedRowsAsync(ImportBatchId batchId, CancellationToken ct);

    Task MarkRowCompletedAsync(ImportRowId rowId, Guid? createdItemId, DateTimeOffset processedUtc, CancellationToken ct);
    Task MarkRowFailedAsync(ImportRowId rowId, string errorMessage, DateTimeOffset processedUtc, CancellationToken ct);
}
