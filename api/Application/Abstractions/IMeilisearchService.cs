using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

/// <summary>
/// Abstracts Meilisearch indexing and searching for library items.
/// </summary>
public interface IMeilisearchService
{
    /// <summary>Index or update a single item. Called after create/update.</summary>
    Task IndexItemAsync(Guid householdId, ItemSearchResult item, CancellationToken ct);

    /// <summary>Remove a single item from the index. Called after delete.</summary>
    Task RemoveItemAsync(Guid itemId, CancellationToken ct);

    /// <summary>Bulk-index all items for a household (used during initial sync).</summary>
    Task BulkIndexAsync(Guid householdId, IReadOnlyList<ItemSearchResult> items, CancellationToken ct);

    /// <summary>
    /// Search across all fields with typo tolerance.
    /// Returns (totalHits, matchedItemIds) — caller re-fetches full data from SQL.
    /// </summary>
    Task<MeilisearchSearchResult> SearchAsync(
        Guid householdId,
        string query,
        int take,
        int skip,
        CancellationToken ct);

    /// <summary>True if the Meilisearch server is reachable.</summary>
    Task<bool> IsHealthyAsync(CancellationToken ct);
}

public sealed record MeilisearchSearchResult(
    int EstimatedTotalHits,
    IReadOnlyList<Guid> ItemIds);
