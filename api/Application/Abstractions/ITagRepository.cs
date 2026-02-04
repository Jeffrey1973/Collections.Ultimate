using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface ITagRepository
{
    Task<Tag?> GetByNameAsync(HouseholdId householdId, string name, CancellationToken ct);
    Task<IReadOnlyList<Tag>> GetByNamesAsync(HouseholdId householdId, IEnumerable<string> names, CancellationToken ct);
    Task<Tag> CreateAsync(Tag tag, CancellationToken ct);
    Task<IReadOnlyList<Tag>> GetByWorkIdAsync(WorkId workId, CancellationToken ct);
    Task SetWorkTagsAsync(WorkId workId, IEnumerable<TagId> tagIds, CancellationToken ct);
}
