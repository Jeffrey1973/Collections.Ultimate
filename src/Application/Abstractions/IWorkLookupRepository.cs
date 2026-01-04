using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IWorkLookupRepository
{
    Task<WorkId?> FindWorkByNormalizedTitleAndFirstAuthorAsync(string normalizedTitle, string? firstAuthorDisplayName, CancellationToken ct);
}
