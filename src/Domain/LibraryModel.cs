namespace CollectionsUltimate.Domain;

public readonly record struct WorkId(Guid Value);
public readonly record struct EditionId(Guid Value);
public readonly record struct PersonId(Guid Value);
public readonly record struct TagId(Guid Value);
public readonly record struct SubjectHeadingId(Guid Value);

public sealed class Work
{
    public WorkId Id { get; init; } = new(Guid.NewGuid());
    public required string Title { get; init; }
    public string? Subtitle { get; init; }
    public string? SortTitle { get; init; }
    public string? Description { get; init; }
    public string? NormalizedTitle { get; init; }
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
