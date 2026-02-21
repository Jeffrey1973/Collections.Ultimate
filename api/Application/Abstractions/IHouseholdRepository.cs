using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IHouseholdRepository
{
    Task<Household?> GetByIdAsync(HouseholdId id, CancellationToken ct);
    Task<IReadOnlyList<Household>> ListAsync(CancellationToken ct);
    Task CreateAsync(Household household, CancellationToken ct);
    Task<bool> UpdateAsync(HouseholdId id, string name, CancellationToken ct);
    Task<bool> DeleteAsync(HouseholdId id, CancellationToken ct);
}
