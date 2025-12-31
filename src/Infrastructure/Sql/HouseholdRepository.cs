using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class HouseholdRepository : IHouseholdRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public HouseholdRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task CreateAsync(Household household, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.Households (Id, Name)
            values (@Id, @Name);
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = household.Id.Value, household.Name }, cancellationToken: ct));
    }

    public async Task<Household?> GetByIdAsync(HouseholdId id, CancellationToken ct)
    {
        const string sql = """
            select Id, Name
            from dbo.Households
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<HouseholdRow>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));

        return row is null
            ? null
            : new Household { Id = new HouseholdId(row.Id), Name = row.Name };
    }

    public async Task<IReadOnlyList<Household>> ListAsync(CancellationToken ct)
    {
        const string sql = """
            select Id, Name
            from dbo.Households
            order by Name;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<HouseholdRow>(new CommandDefinition(sql, cancellationToken: ct));

        return rows.Select(r => new Household { Id = new HouseholdId(r.Id), Name = r.Name }).ToList();
    }

    private sealed record HouseholdRow(Guid Id, string Name);
}
