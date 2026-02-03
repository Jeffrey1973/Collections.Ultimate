namespace CollectionsUltimate.Domain;

public readonly record struct AccountId(Guid Value);
public readonly record struct HouseholdId(Guid Value);
public readonly record struct ItemId(Guid Value);

public sealed class Account
{
    public AccountId Id { get; init; } = new(Guid.NewGuid());
    public required string DisplayName { get; init; }
    public string? Email { get; init; }
    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

public sealed record AccountHousehold(AccountId AccountId, HouseholdId HouseholdId, DateTimeOffset CreatedUtc);

public sealed class Household
{
    public HouseholdId Id { get; init; } = new(Guid.NewGuid());
    public required string Name { get; init; }
}

public enum ItemKind
{
    Book = 1,
    Other = 99
}

public abstract class CollectionItem
{
    public ItemId Id { get; init; } = new(Guid.NewGuid());
    public required HouseholdId OwnerHouseholdId { get; init; }
    public required ItemKind Kind { get; init; }

    public required string Title { get; init; }
    public string? Subtitle { get; init; }

    public string? Notes { get; init; }
    public DateTimeOffset CreatedUtc { get; init; } = DateTimeOffset.UtcNow;
}

public sealed class Book : CollectionItem
{
    public string? Isbn10 { get; init; }
    public string? Isbn13 { get; init; }
    public string? Authors { get; init; }
    public int? PublishedYear { get; init; }
    public string? Publisher { get; init; }
}
