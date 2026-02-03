using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IAccountHouseholdRepository
{
    Task AddAsync(AccountId accountId, HouseholdId householdId, CancellationToken ct);
    Task<IReadOnlyList<HouseholdId>> ListHouseholdsAsync(AccountId accountId, CancellationToken ct);
    Task DeleteByHouseholdIdAsync(HouseholdId householdId, CancellationToken ct);
}
