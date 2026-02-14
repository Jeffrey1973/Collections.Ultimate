using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IWorkRepository
{
    Task CreateAsync(Work work, CancellationToken ct);
    Task<Work?> GetByIdAsync(WorkId id, CancellationToken ct);
    Task<bool> UpdateAsync(WorkId id, string title, string? subtitle, string? sortTitle, string? description, string? originalTitle, string? language, string? metadataJson, CancellationToken ct);
}
