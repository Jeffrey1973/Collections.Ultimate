using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IAccountHouseholdRepository
{
    Task AddAsync(AccountId accountId, HouseholdId householdId, string role, CancellationToken ct);
    Task<IReadOnlyList<AccountHousehold>> ListHouseholdsAsync(AccountId accountId, CancellationToken ct);
    Task<IReadOnlyList<HouseholdMember>> ListMembersAsync(HouseholdId householdId, CancellationToken ct);
    Task UpdateRoleAsync(AccountId accountId, HouseholdId householdId, string role, CancellationToken ct);
    Task RemoveMemberAsync(AccountId accountId, HouseholdId householdId, CancellationToken ct);
    Task DeleteByHouseholdIdAsync(HouseholdId householdId, CancellationToken ct);
}
