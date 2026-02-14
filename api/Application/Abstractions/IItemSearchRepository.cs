using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IItemSearchRepository
{
    Task<SearchPagedResult> SearchAsync(
        HouseholdId householdId,
        string? query,
        string? tag,
        string? subject,
        string? barcode,
        string? status,
        string? location,
        int take,
        int skip,
        CancellationToken ct);

    /// <summary>Fetch full item data for a list of item IDs (preserves order).</summary>
    Task<IReadOnlyList<ItemSearchResult>> GetByIdsAsync(
        HouseholdId householdId,
        IReadOnlyList<Guid> itemIds,
        CancellationToken ct);

    Task<IReadOnlyList<DuplicateGroup>> FindDuplicatesAsync(
        HouseholdId householdId,
        CancellationToken ct);
}

public sealed record DuplicateGroup(
    string GroupKey,
    string Title,
    string? Author,
    IReadOnlyList<DuplicateItem> Items);

public sealed record DuplicateItem(
    Guid ItemId,
    Guid WorkId,
    Guid? EditionId,
    string Title,
    string? Subtitle,
    string? Barcode,
    string? Location,
    string? Status,
    string? Condition,
    string? Notes,
    string? Authors,
    string? Publisher,
    int? PublishedYear,
    int? PageCount,
    string? CoverImageUrl,
    string? Format,
    decimal? UserRating,
    string? ReadStatus,
    DateTimeOffset CreatedUtc,
    string? Identifiers,
    string? Tags,
    string? Subjects);
