using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IAccountHouseholdRepository
{
    Task AddAsync(AccountId accountId, HouseholdId householdId, string role, CancellationToken ct);
    Task<IReadOnlyList<AccountHousehold>> ListHouseholdsAsync(AccountId accountId, CancellationToken ct);
    Task DeleteByHouseholdIdAsync(HouseholdId householdId, CancellationToken ct);
}
