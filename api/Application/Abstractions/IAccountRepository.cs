using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IAccountRepository
{
    Task CreateAsync(Account account, CancellationToken ct);
    Task<Account?> GetByIdAsync(AccountId id, CancellationToken ct);
    Task<Account?> GetByAuth0SubAsync(string auth0Sub, CancellationToken ct);
    Task<Account?> GetByEmailAsync(string email, CancellationToken ct);
    Task UpdateAuth0SubAsync(AccountId id, string auth0Sub, CancellationToken ct);
    Task UpdateNameAsync(AccountId id, string? firstName, string? lastName, string displayName, CancellationToken ct);
}
