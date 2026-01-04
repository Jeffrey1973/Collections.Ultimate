using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface ILibraryItemLookupRepository
{
    Task<ItemId?> FindItemByHouseholdAndBarcodeAsync(HouseholdId householdId, string barcode, CancellationToken ct);
    Task<ItemId?> FindItemByHouseholdAndWorkAsync(HouseholdId householdId, WorkId workId, CancellationToken ct);
}
