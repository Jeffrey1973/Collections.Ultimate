using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface ILibraryItemLookupRepository
{
    Task<ItemId?> FindItemByHouseholdAndBarcodeAsync(HouseholdId householdId, string barcode, CancellationToken ct);
    Task<ItemId?> FindItemByHouseholdAndWorkAsync(HouseholdId householdId, WorkId workId, CancellationToken ct);

    /// <summary>
    /// Returns all existing barcodes and normalized titles for a household,
    /// used for import deduplication.
    /// </summary>
    Task<LibraryDedupIndex> GetDedupIndexAsync(HouseholdId householdId, CancellationToken ct);
}

/// <summary>
/// Lightweight index of existing library items for fast dedup checks.
/// </summary>
public sealed record LibraryDedupIndex(
    IReadOnlySet<string> Barcodes,
    IReadOnlySet<string> NormalizedTitles,
    IReadOnlyDictionary<string, string> IdentifierValues);
