using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface ILibraryItemRepository
{
    Task CreateAsync(LibraryItem item, CancellationToken ct);
    Task<LibraryItem?> GetByIdAsync(ItemId id, CancellationToken ct);
    Task<ItemFullResponse?> GetFullByIdAsync(ItemId id, CancellationToken ct);
}
