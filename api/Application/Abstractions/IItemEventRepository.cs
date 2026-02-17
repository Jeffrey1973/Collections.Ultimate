using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IItemEventRepository
{
    /// <summary>List all event types (for dropdowns / pickers).</summary>
    Task<IReadOnlyList<ItemEventType>> ListEventTypesAsync(CancellationToken ct);

    /// <summary>Record a new event for an item.</summary>
    Task CreateAsync(ItemEvent evt, CancellationToken ct);

    /// <summary>Get the chronological timeline for a single item (newest first).</summary>
    Task<IReadOnlyList<ItemEventEntry>> GetTimelineAsync(ItemId itemId, CancellationToken ct);

    /// <summary>Delete a single event entry.</summary>
    Task<bool> DeleteAsync(Guid eventId, CancellationToken ct);
}
