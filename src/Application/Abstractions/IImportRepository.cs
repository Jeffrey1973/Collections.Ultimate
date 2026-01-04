using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IImportRepository
{
    Task CreateBatchAsync(ImportBatch batch, CancellationToken ct);
    Task CompleteBatchAsync(ImportBatchId batchId, ImportStatus status, DateTimeOffset finishedUtc, CancellationToken ct);
    Task AddRecordAsync(ImportRecord record, CancellationToken ct);

    Task<ImportBatch?> GetBatchAsync(ImportBatchId batchId, CancellationToken ct);
    Task<IReadOnlyList<ImportBatch>> ListBatchesAsync(HouseholdId householdId, int take, int skip, CancellationToken ct);
    Task<IReadOnlyDictionary<string, int>> GetBatchStatusCountsAsync(ImportBatchId batchId, CancellationToken ct);
    Task<IReadOnlyList<ImportRecordFailure>> ListFailuresAsync(ImportBatchId batchId, int take, int skip, CancellationToken ct);

    Task<IReadOnlyList<ImportRecord>> ListPendingRecordsAsync(ImportBatchId batchId, int take, CancellationToken ct);
    Task<IReadOnlyList<ImportRecord>> ListFailedRecordsAsync(ImportBatchId batchId, int take, CancellationToken ct);
    Task ResetFailedRecordsAsync(ImportBatchId batchId, CancellationToken ct);

    Task MarkRecordCompletedAsync(ImportRecordId recordId, Guid? workId, Guid? editionId, Guid? itemId, DateTimeOffset processedUtc, CancellationToken ct);
    Task MarkRecordFailedAsync(ImportRecordId recordId, string error, DateTimeOffset processedUtc, CancellationToken ct);
}
