using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class AccountHouseholdRepository : IAccountHouseholdRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public AccountHouseholdRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task AddAsync(AccountId accountId, HouseholdId householdId, string role, CancellationToken ct)
    {
        const string sql = """
            if not exists (
                select 1
                from dbo.AccountHousehold
                where AccountId = @AccountId and HouseholdId = @HouseholdId
            )
                insert into dbo.AccountHousehold (AccountId, HouseholdId, Role, CreatedUtc)
                values (@AccountId, @HouseholdId, @Role, @CreatedUtc);
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new { AccountId = accountId.Value, HouseholdId = householdId.Value, Role = role, CreatedUtc = DateTimeOffset.UtcNow }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<AccountHousehold>> ListHouseholdsAsync(AccountId accountId, CancellationToken ct)
    {
        const string sql = """
            select AccountId, HouseholdId, Role, CreatedUtc
            from dbo.AccountHousehold
            where AccountId = @AccountId
            order by CreatedUtc;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<AccountHouseholdRow>(new CommandDefinition(sql, new { AccountId = accountId.Value }, cancellationToken: ct));
        return rows.Select(r => new AccountHousehold(new AccountId(r.AccountId), new HouseholdId(r.HouseholdId), r.Role, r.CreatedUtc)).ToList();
    }

    public async Task DeleteByHouseholdIdAsync(HouseholdId householdId, CancellationToken ct)
    {
        const string sql = """
            delete from dbo.AccountHousehold
            where HouseholdId = @HouseholdId;
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new { HouseholdId = householdId.Value }, cancellationToken: ct));
    }

    private sealed record AccountHouseholdRow(Guid AccountId, Guid HouseholdId, string Role, DateTimeOffset CreatedUtc);
}
