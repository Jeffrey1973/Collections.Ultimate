using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IAccountRepository
{
    Task CreateAsync(Account account, CancellationToken ct);
    Task<Account?> GetByIdAsync(AccountId id, CancellationToken ct);
}
