using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface ILibraryRepository
{
    Task<Library?> GetByIdAsync(LibraryId id, CancellationToken ct);
    Task<IReadOnlyList<Library>> ListByHouseholdAsync(HouseholdId householdId, CancellationToken ct);
    Task<Library?> GetDefaultAsync(HouseholdId householdId, CancellationToken ct);
    Task CreateAsync(Library library, CancellationToken ct);
    Task UpdateAsync(LibraryId id, string name, string? description, CancellationToken ct);
    Task DeleteAsync(LibraryId id, CancellationToken ct);

    // Members
    Task<IReadOnlyList<LibraryMemberDetail>> ListMembersAsync(LibraryId libraryId, CancellationToken ct);
    Task AddMemberAsync(LibraryId libraryId, AccountId accountId, string role, CancellationToken ct);
    Task UpdateMemberRoleAsync(LibraryId libraryId, AccountId accountId, string role, CancellationToken ct);
    Task RemoveMemberAsync(LibraryId libraryId, AccountId accountId, CancellationToken ct);
    Task<LibraryMember?> GetMemberAsync(LibraryId libraryId, AccountId accountId, CancellationToken ct);

    /// <summary>
    /// Gets all libraries a given account has access to within a household.
    /// </summary>
    Task<IReadOnlyList<Library>> ListByAccountAsync(HouseholdId householdId, AccountId accountId, CancellationToken ct);
}
