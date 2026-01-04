namespace CollectionsUltimate.Domain;

public readonly record struct ImportBatchId(Guid Value);
public readonly record struct ImportRecordId(Guid Value);

public enum ImportStatus
{
    Pending = 0,
    Completed = 1,
    Failed = 2
}

public sealed class ImportBatch
{
    public ImportBatchId Id { get; init; } = new(Guid.NewGuid());
    public required HouseholdId OwnerHouseholdId { get; init; }
    public required string Source { get; init; }
    public string? FileName { get; init; }
    public DateTimeOffset StartedUtc { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FinishedUtc { get; init; }
    public ImportStatus Status { get; init; } = ImportStatus.Pending;
}

public sealed class ImportRecord
{
    public ImportRecordId Id { get; init; } = new(Guid.NewGuid());
    public required ImportBatchId BatchId { get; init; }
    public string? ExternalId { get; init; }
    public required string PayloadJson { get; init; }
    public required byte[] PayloadSha256 { get; init; }
    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
    public ImportStatus Status { get; init; } = ImportStatus.Pending;
    public string? Error { get; init; }
}

public sealed record ImportRecordFailure(
    ImportRecordId Id,
    string? ExternalId,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? ProcessedUtc,
    string Error);
