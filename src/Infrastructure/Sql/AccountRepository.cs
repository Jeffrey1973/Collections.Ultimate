using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class AccountRepository : IAccountRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public AccountRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task CreateAsync(Account account, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.Account (Id, DisplayName, Email, CreatedUtc)
            values (@Id, @DisplayName, @Email, @CreatedUtc);
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = account.Id.Value,
            account.DisplayName,
            account.Email,
            account.CreatedUtc
        }, cancellationToken: ct));
    }

    public async Task<Account?> GetByIdAsync(AccountId id, CancellationToken ct)
    {
        const string sql = """
            select Id, DisplayName, Email, CreatedUtc
            from dbo.Account
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<AccountRow>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    private static Account Map(AccountRow r) => new()
    {
        Id = new AccountId(r.Id),
        DisplayName = r.DisplayName,
        Email = r.Email,
        CreatedUtc = r.CreatedUtc
    };

    private sealed record AccountRow(Guid Id, string DisplayName, string? Email, DateTimeOffset CreatedUtc);
}
