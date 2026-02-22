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
            insert into dbo.Account (Id, DisplayName, FirstName, LastName, Email, Auth0Sub, CreatedUtc)
            values (@Id, @DisplayName, @FirstName, @LastName, @Email, @Auth0Sub, @CreatedUtc);
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = account.Id.Value,
            account.DisplayName,
            account.FirstName,
            account.LastName,
            account.Email,
            account.Auth0Sub,
            account.CreatedUtc
        }, cancellationToken: ct));
    }

    public async Task<Account?> GetByIdAsync(AccountId id, CancellationToken ct)
    {
        const string sql = """
            select Id, DisplayName, FirstName, LastName, Email, Auth0Sub, CreatedUtc
            from dbo.Account
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<AccountRow>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    public async Task<Account?> GetByAuth0SubAsync(string auth0Sub, CancellationToken ct)
    {
        const string sql = """
            select Id, DisplayName, FirstName, LastName, Email, Auth0Sub, CreatedUtc
            from dbo.Account
            where Auth0Sub = @Auth0Sub;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<AccountRow>(new CommandDefinition(sql, new { Auth0Sub = auth0Sub }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    public async Task<Account?> GetByEmailAsync(string email, CancellationToken ct)
    {
        const string sql = """
            select Id, DisplayName, FirstName, LastName, Email, CAST(NULL AS NVARCHAR(200)) as Auth0Sub, CreatedUtc
            from dbo.Account
            where Email = @Email;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<AccountRow>(new CommandDefinition(sql, new { Email = email }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    public async Task UpdateAuth0SubAsync(AccountId id, string auth0Sub, CancellationToken ct)
    {
        const string sql = """
            update dbo.Account
            set Auth0Sub = @Auth0Sub
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = id.Value, Auth0Sub = auth0Sub }, cancellationToken: ct));
    }

    public async Task UpdateNameAsync(AccountId id, string? firstName, string? lastName, string displayName, string? email, CancellationToken ct)
    {
        const string sql = """
            update dbo.Account
            set FirstName = COALESCE(NULLIF(@FirstName, ''), FirstName),
                LastName  = COALESCE(NULLIF(@LastName, ''), LastName),
                DisplayName = COALESCE(NULLIF(@DisplayName, ''), DisplayName),
                Email = COALESCE(NULLIF(@Email, ''), Email)
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = id.Value, FirstName = firstName, LastName = lastName, DisplayName = displayName, Email = email }, cancellationToken: ct));
    }

    private static Account Map(AccountRow r) => new()
    {
        Id = new AccountId(r.Id),
        DisplayName = r.DisplayName,
        FirstName = r.FirstName,
        LastName = r.LastName,
        Email = r.Email,
        Auth0Sub = r.Auth0Sub,
        CreatedUtc = r.CreatedUtc
    };

    private sealed record AccountRow(Guid Id, string DisplayName, string? FirstName, string? LastName, string? Email, string? Auth0Sub, DateTimeOffset CreatedUtc);
}
