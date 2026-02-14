using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IItemUpdateRepository
{
    Task<bool> UpdateInventoryAsync(ItemId itemId, ItemInventoryPatch patch, CancellationToken ct);
    Task<bool> UpdateMetadataJsonAsync(ItemId itemId, string? metadataJson, CancellationToken ct);
}
