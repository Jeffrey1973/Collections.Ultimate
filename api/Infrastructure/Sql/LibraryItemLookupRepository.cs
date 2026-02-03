using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class LibraryItemLookupRepository : ILibraryItemLookupRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public LibraryItemLookupRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<ItemId?> FindItemByHouseholdAndBarcodeAsync(HouseholdId householdId, string barcode, CancellationToken ct)
    {
        const string sql = """
            select top (1) Id
            from dbo.LibraryItem
            where HouseholdId = @HouseholdId
              and Barcode = @Barcode
            order by CreatedUtc asc;
            """;

        using var conn = _connectionFactory.Create();
        var id = await conn.QuerySingleOrDefaultAsync<Guid?>(new CommandDefinition(sql, new
        {
            HouseholdId = householdId.Value,
            Barcode = barcode
        }, cancellationToken: ct));

        return id is null ? null : new ItemId(id.Value);
    }

    public async Task<ItemId?> FindItemByHouseholdAndWorkAsync(HouseholdId householdId, WorkId workId, CancellationToken ct)
    {
        const string sql = """
            select top (1) Id
            from dbo.LibraryItem
            where HouseholdId = @HouseholdId
              and WorkId = @WorkId
            order by CreatedUtc asc;
            """;

        using var conn = _connectionFactory.Create();
        var id = await conn.QuerySingleOrDefaultAsync<Guid?>(new CommandDefinition(sql, new
        {
            HouseholdId = householdId.Value,
            WorkId = workId.Value
        }, cancellationToken: ct));

        return id is null ? null : new ItemId(id.Value);
    }
}
