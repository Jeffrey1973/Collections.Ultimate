using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IBookRepository
{
    Task<Book?> GetByIdAsync(ItemId id, CancellationToken ct);
    Task<IReadOnlyList<Book>> SearchAsync(HouseholdId householdId, string? query, int take, int skip, CancellationToken ct);
    Task CreateAsync(Book book, CancellationToken ct);
}
