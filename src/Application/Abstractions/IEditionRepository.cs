using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IEditionRepository
{
    Task CreateAsync(Edition edition, CancellationToken ct);
    Task<Edition?> GetByIdAsync(EditionId id, CancellationToken ct);
}
