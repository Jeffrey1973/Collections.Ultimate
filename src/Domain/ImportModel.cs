namespace CollectionsUltimate.Domain;

public readonly record struct ImportBatchId(Guid Value);
public readonly record struct ImportRowId(Guid Value);

public enum ImportStatus
{
    Pending = 0,
    Completed = 1,
    Failed = 2
}

public sealed class ImportBatch
{
    public ImportBatchId Id { get; init; } = new(Guid.NewGuid());
    public required HouseholdId HouseholdId { get; init; }
    public string? FileName { get; init; }
    public ImportStatus Status { get; init; } = ImportStatus.Pending;
    public int? TotalRows { get; init; }
    public int? ProcessedRows { get; init; }
    public int? SuccessRows { get; init; }
    public int? FailedRows { get; init; }
    public DateTimeOffset? StartedUtc { get; init; }
    public DateTimeOffset? CompletedUtc { get; init; }
    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

public sealed class ImportRow
{
    public ImportRowId Id { get; init; } = new(Guid.NewGuid());
    public required ImportBatchId BatchId { get; init; }
    public required int RowNumber { get; init; }
    public ImportStatus Status { get; init; } = ImportStatus.Pending;
    public string? RawData { get; init; }
    public string? ErrorMessage { get; init; }
    public Guid? CreatedItemId { get; init; }
    public DateTimeOffset? ProcessedUtc { get; init; }
}

public sealed record ImportRowFailure(
    ImportRowId Id,
    int RowNumber,
    DateTimeOffset? ProcessedUtc,
    string ErrorMessage);
