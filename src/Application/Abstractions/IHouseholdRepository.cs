using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IHouseholdRepository
{
    Task<Household?> GetByIdAsync(HouseholdId id, CancellationToken ct);
    Task<IReadOnlyList<Household>> ListAsync(CancellationToken ct);
    Task CreateAsync(Household household, CancellationToken ct);
}
