namespace CollectionsUltimate.Domain;

public readonly record struct WorkId(Guid Value);
public readonly record struct EditionId(Guid Value);
public readonly record struct PersonId(Guid Value);
public readonly record struct TagId(Guid Value);
public readonly record struct SubjectHeadingId(Guid Value);
public readonly record struct SeriesId(Guid Value);

public sealed class Work
{
    public WorkId Id { get; init; } = new(Guid.NewGuid());
    public required string Title { get; init; }
    public string? Subtitle { get; init; }
    public string? SortTitle { get; init; }
    public string? Description { get; init; }
    public string? NormalizedTitle { get; init; }

    // Extended fields
    public string? OriginalTitle { get; init; }
    public string? Language { get; init; }

    /// <summary>
    /// Extended metadata stored as JSON for flexible field storage.
    /// Includes: churchHistoryPeriod, dateWritten, religiousTradition, deweyDecimal, lcc, etc.
    /// </summary>
    public string? MetadataJson { get; init; }

    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

public sealed class Edition
{
    public EditionId Id { get; init; } = new(Guid.NewGuid());
    public required WorkId WorkId { get; init; }

    public string? EditionTitle { get; init; }
    public string? EditionSubtitle { get; init; }

    public string? Publisher { get; init; }
    public int? PublishedYear { get; init; }
    public int? PageCount { get; init; }
    public string? Description { get; init; }
    public string? CoverImageUrl { get; init; }

    // Extended fields
    public string? Format { get; init; }
    public string? Binding { get; init; }
    public string? EditionStatement { get; init; }
    public string? PlaceOfPublication { get; init; }
    public string? Language { get; init; }

    /// <summary>
    /// Extended metadata stored as JSON for flexible field storage.
    /// Includes: dimensions, weight, physicalDescription, etc.
    /// </summary>
    public string? MetadataJson { get; init; }

    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Represents a book series.
/// </summary>
public sealed class Series
{
    public SeriesId Id { get; init; } = new(Guid.NewGuid());
    public required string Name { get; init; }
    public string? NormalizedName { get; init; }
    public string? Description { get; init; }
    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Links a work to a series with volume information.
/// </summary>
public sealed class WorkSeries
{
    public required WorkId WorkId { get; init; }
    public required SeriesId SeriesId { get; init; }
    public string? VolumeNumber { get; init; }
    public int? Ordinal { get; init; }
}

/// <summary>
/// Represents a cover image at a specific size for an edition.
/// </summary>
public sealed class EditionImage
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required EditionId EditionId { get; init; }
    public required string ImageSize { get; init; }
    public required string Url { get; init; }
    public int? Width { get; init; }
    public int? Height { get; init; }
    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

public sealed class LibraryItem
{
    public ItemId Id { get; init; } = new(Guid.NewGuid());
    public required HouseholdId OwnerHouseholdId { get; init; }
    public required ItemKind Kind { get; init; }

    public required WorkId WorkId { get; init; }
    public EditionId? EditionId { get; init; }

    public required string Title { get; init; }
    public string? Subtitle { get; init; }

    public string? Notes { get; init; }

    public string? Barcode { get; init; }
    public string? Location { get; init; }
    public string? Status { get; init; }
    public string? Condition { get; init; }
    public DateOnly? AcquiredOn { get; init; }
    public decimal? Price { get; init; }

    // Promoted reading/user fields (formerly in MetadataJson)
    public string? ReadStatus { get; init; }
    public string? CompletedDate { get; init; }
    public string? DateStarted { get; init; }
    public decimal? UserRating { get; init; }

    /// <summary>
    /// The order in which this book was entered into the library (1 = first).
    /// </summary>
    public int? LibraryOrder { get; init; }

    /// <summary>
    /// Flexible JSON storage for type-specific metadata (e.g., ISBN, authors for books).
    /// </summary>
    public string? MetadataJson { get; init; }

    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

public sealed class Person
{
    public PersonId Id { get; init; } = new(Guid.NewGuid());
    public required string DisplayName { get; init; }
    public string? SortName { get; init; }
    public int? BirthYear { get; init; }
    public int? DeathYear { get; init; }
    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

public readonly record struct ContributorRoleId(int Value);

public sealed class Tag
{
    public TagId Id { get; init; } = new(Guid.NewGuid());
    public required HouseholdId OwnerHouseholdId { get; init; }
    public required string Name { get; init; }
    public required string NormalizedName { get; init; }
    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

public readonly record struct SubjectSchemeId(int Value);

public sealed class SubjectHeading
{
    public SubjectHeadingId Id { get; init; } = new(Guid.NewGuid());
    public required SubjectSchemeId SchemeId { get; init; }
    public required string Text { get; init; }
    public required string NormalizedText { get; init; }
    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

public readonly record struct IdentifierTypeId(int Value);

public sealed class EditionIdentifier
{
    public required EditionId EditionId { get; init; }
    public required IdentifierTypeId IdentifierTypeId { get; init; }
    public required string Value { get; init; }
    public required string NormalizedValue { get; init; }
    public bool IsPrimary { get; init; }
}

// =============================================================================
// FULL NESTED RESPONSE MODELS
// =============================================================================

/// <summary>
/// Full item response with nested Work, Edition, Contributors, Tags, Subjects, Series, and Identifiers.
/// </summary>
public sealed class ItemFullResponse
{
    public required Guid ItemId { get; init; }
    public required Guid HouseholdId { get; init; }
    public required int Kind { get; init; }

    // Item-level fields
    public required string Title { get; init; }
    public string? Subtitle { get; init; }
    public string? Authors { get; init; }
    public string? Notes { get; init; }
    public string? Barcode { get; init; }
    public string? Location { get; init; }
    public string? Status { get; init; }
    public string? Condition { get; init; }
    public DateOnly? AcquiredOn { get; init; }
    public decimal? Price { get; init; }
    public string? ReadStatus { get; init; }
    public string? CompletedDate { get; init; }
    public string? DateStarted { get; init; }
    public decimal? UserRating { get; init; }
    public int? LibraryOrder { get; init; }
    public string? MetadataJson { get; init; }
    public DateTimeOffset CreatedUtc { get; init; }

    // Nested objects
    public required WorkResponse Work { get; init; }
    public EditionResponse? Edition { get; init; }
    public IReadOnlyList<ContributorResponse> Contributors { get; init; } = [];
    public IReadOnlyList<TagResponse> Tags { get; init; } = [];
    public IReadOnlyList<SubjectResponse> Subjects { get; init; } = [];
    public IReadOnlyList<IdentifierResponse> Identifiers { get; init; } = [];
    public SeriesResponse? Series { get; init; }
}

public sealed class WorkResponse
{
    public required Guid WorkId { get; init; }
    public required string Title { get; init; }
    public string? Subtitle { get; init; }
    public string? SortTitle { get; init; }
    public string? Description { get; init; }
    public string? OriginalTitle { get; init; }
    public string? Language { get; init; }
    public string? MetadataJson { get; init; }
    public DateTimeOffset CreatedUtc { get; init; }
}

public sealed class EditionResponse
{
    public required Guid EditionId { get; init; }
    public string? EditionTitle { get; init; }
    public string? EditionSubtitle { get; init; }
    public string? Publisher { get; init; }
    public int? PublishedYear { get; init; }
    public int? PageCount { get; init; }
    public string? Description { get; init; }
    public string? CoverImageUrl { get; init; }
    public string? Format { get; init; }
    public string? Binding { get; init; }
    public string? EditionStatement { get; init; }
    public string? PlaceOfPublication { get; init; }
    public string? Language { get; init; }
    public string? MetadataJson { get; init; }
    public DateTimeOffset CreatedUtc { get; init; }
}

public sealed class ContributorResponse
{
    public required Guid PersonId { get; init; }
    public required string DisplayName { get; init; }
    public string? SortName { get; init; }
    public required int RoleId { get; init; }
    public required string RoleName { get; init; }
    public int Ordinal { get; init; }
    public int? BirthYear { get; init; }
    public int? DeathYear { get; init; }
}

public sealed class TagResponse
{
    public required Guid TagId { get; init; }
    public required string Name { get; init; }
}

public sealed class SubjectResponse
{
    public required Guid SubjectHeadingId { get; init; }
    public required int SchemeId { get; init; }
    public required string SchemeName { get; init; }
    public required string Text { get; init; }
}

public sealed class IdentifierResponse
{
    public required int IdentifierTypeId { get; init; }
    public required string IdentifierTypeName { get; init; }
    public required string Value { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class SeriesResponse
{
    public required Guid SeriesId { get; init; }
    public required string Name { get; init; }
    public string? VolumeNumber { get; init; }
    public int? Ordinal { get; init; }
}

/// <summary>
/// Request model for patching a library item, including tag names.
/// </summary>
public sealed class ItemPatchRequest
{
    public string? Title { get; init; }
    public string? Subtitle { get; init; }
    public string? Notes { get; init; }
    public string? Barcode { get; init; }
    public string? Location { get; init; }
    public string? Status { get; init; }
    public string? Condition { get; init; }
    public DateOnly? AcquiredOn { get; init; }
    public decimal? Price { get; init; }

    /// <summary>
    /// Tag names to associate with this item's work.
    /// New tags will be created automatically.
    /// Null = leave tags unchanged, empty array = clear all tags.
    /// </summary>
    public IReadOnlyList<string>? TagNames { get; init; }
}
