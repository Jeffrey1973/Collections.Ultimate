using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IEditionLookupRepository
{
    Task<EditionId?> FindEditionByIdentifierAsync(IdentifierTypeId typeId, string normalizedValue, CancellationToken ct);
}
