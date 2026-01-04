using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IItemSearchRepository
{
    Task<IReadOnlyList<ItemSearchResult>> SearchAsync(
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
}
