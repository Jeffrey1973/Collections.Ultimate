using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IWorkRepository
{
    Task CreateAsync(Work work, CancellationToken ct);
    Task<Work?> GetByIdAsync(WorkId id, CancellationToken ct);
}
