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

    public async Task<LibraryDedupIndex> GetDedupIndexAsync(HouseholdId householdId, CancellationToken ct)
    {
        // 1. All barcodes for this household
        const string barcodesSql = """
            select distinct Barcode
            from dbo.LibraryItem
            where HouseholdId = @HouseholdId
              and Barcode is not null
              and Barcode <> '';
            """;

        // 2. All normalized work titles for this household
        const string titlesSql = """
            select distinct w.NormalizedTitle
            from dbo.LibraryItem i
            inner join dbo.Work w on w.Id = i.WorkId
            where i.HouseholdId = @HouseholdId
              and w.NormalizedTitle is not null;
            """;

        // 3. All edition identifiers (ISBN-10, ISBN-13, etc.) linked to this household's items
        const string identifiersSql = """
            select distinct
                cast(ei.IdentifierTypeId as varchar) + ':' + ei.NormalizedValue as Ident
            from dbo.LibraryItem i
            inner join dbo.EditionIdentifier ei on ei.EditionId = i.EditionId
            where i.HouseholdId = @HouseholdId
              and i.EditionId is not null;
            """;

        using var conn = _connectionFactory.Create();
        var param = new { HouseholdId = householdId.Value };

        var barcodes = (await conn.QueryAsync<string>(new CommandDefinition(barcodesSql, param, cancellationToken: ct)))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var titles = (await conn.QueryAsync<string>(new CommandDefinition(titlesSql, param, cancellationToken: ct)))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var identifiers = (await conn.QueryAsync<string>(new CommandDefinition(identifiersSql, param, cancellationToken: ct)))
            .ToDictionary(
                i => i,
                i => i,
                StringComparer.OrdinalIgnoreCase);

        return new LibraryDedupIndex(barcodes, titles, identifiers);
    }
}
