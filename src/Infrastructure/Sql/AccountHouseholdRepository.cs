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

    public async Task AddAsync(AccountId accountId, HouseholdId householdId, CancellationToken ct)
    {
        const string sql = """
            if not exists (
                select 1
                from dbo.AccountHouseholds
                where AccountId = @AccountId and HouseholdId = @HouseholdId
            )
                insert into dbo.AccountHouseholds (AccountId, HouseholdId)
                values (@AccountId, @HouseholdId);
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new { AccountId = accountId.Value, HouseholdId = householdId.Value }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<HouseholdId>> ListHouseholdsAsync(AccountId accountId, CancellationToken ct)
    {
        const string sql = """
            select HouseholdId
            from dbo.AccountHouseholds
            where AccountId = @AccountId
            order by CreatedUtc;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<Guid>(new CommandDefinition(sql, new { AccountId = accountId.Value }, cancellationToken: ct));
        return rows.Select(id => new HouseholdId(id)).ToList();
    }
}
