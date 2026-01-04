namespace CollectionsUltimate.Domain;

public sealed record ItemSearchResult(
    Guid ItemId,
    Guid WorkId,
    Guid? EditionId,
    int Kind,
    string Title,
    string? Subtitle,
    string? Barcode,
    string? Location,
    string? Status,
    string? Condition,
    DateOnly? AcquiredOn,
    decimal? Price,
    DateTimeOffset CreatedUtc,
    string? WorkTitle,
    string? Authors);
