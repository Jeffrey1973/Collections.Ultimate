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
    string? ReadStatus,
    string? CompletedDate,
    string? DateStarted,
    decimal? UserRating,
    DateTimeOffset CreatedUtc,
    string? WorkTitle,
    string? Authors,
    string[]? Tags,
    string[]? Subjects,
    // Work fields
    string? WorkDescription,
    string? OriginalTitle,
    string? WorkLanguage,
    string? WorkMetadataJson,
    // Edition fields
    string? Publisher,
    int? PublishedYear,
    int? PageCount,
    string? CoverImageUrl,
    string? Format,
    string? Binding,
    string? EditionStatement,
    string? PlaceOfPublication,
    string? EditionLanguage,
    string? EditionMetadataJson,
    // Item metadata
    string? ItemMetadataJson,
    string? Notes,
    // Identifiers (pipe-delimited: "type:value" pairs)
    string? Identifiers,
    // Series
    string? SeriesName,
    string? VolumeNumber);
