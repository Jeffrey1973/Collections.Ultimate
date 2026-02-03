using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class LibraryItemRepository : ILibraryItemRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public LibraryItemRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task CreateAsync(LibraryItem item, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.LibraryItem
            (
                Id,
                HouseholdId,
                Kind,
                WorkId,
                EditionId,
                Title,
                Subtitle,
                Notes,
                Barcode,
                Location,
                Status,
                Condition,
                AcquiredOn,
                Price,
                MetadataJson,
                CreatedUtc
            )
            values
            (
                @Id,
                @HouseholdId,
                @Kind,
                @WorkId,
                @EditionId,
                @Title,
                @Subtitle,
                @Notes,
                @Barcode,
                @Location,
                @Status,
                @Condition,
                @AcquiredOn,
                @Price,
                @MetadataJson,
                @CreatedUtc
            );
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = item.Id.Value,
            HouseholdId = item.OwnerHouseholdId.Value,
            Kind = (int)item.Kind,
            WorkId = item.WorkId.Value,
            EditionId = item.EditionId?.Value,
            item.Title,
            item.Subtitle,
            item.Notes,
            item.Barcode,
            item.Location,
            item.Status,
            item.Condition,
            AcquiredOn = item.AcquiredOn is null ? (DateTime?)null : item.AcquiredOn.Value.ToDateTime(TimeOnly.MinValue),
            item.Price,
            item.MetadataJson,
            item.CreatedUtc
        }, cancellationToken: ct));
    }

    public async Task<LibraryItem?> GetByIdAsync(ItemId id, CancellationToken ct)
    {
        const string sql = """
            select
                Id,
                HouseholdId,
                Kind,
                WorkId,
                EditionId,
                Title,
                Subtitle,
                Notes,
                Barcode,
                Location,
                Status,
                Condition,
                AcquiredOn,
                Price,
                MetadataJson,
                CreatedUtc
            from dbo.LibraryItem
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<ItemRow>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    private static LibraryItem Map(ItemRow r) => new()
    {
        Id = new ItemId(r.Id),
        OwnerHouseholdId = new HouseholdId(r.HouseholdId),
        Kind = (ItemKind)r.Kind,
        WorkId = new WorkId(r.WorkId),
        EditionId = r.EditionId is null ? null : new EditionId(r.EditionId.Value),
        Title = r.Title,
        Subtitle = r.Subtitle,
        Notes = r.Notes,
        Barcode = r.Barcode,
        Location = r.Location,
        Status = r.Status,
        Condition = r.Condition,
        AcquiredOn = r.AcquiredOn is null ? null : DateOnly.FromDateTime(r.AcquiredOn.Value),
        Price = r.Price,
        MetadataJson = r.MetadataJson,
        CreatedUtc = r.CreatedUtc
    };

    private sealed record ItemRow(
        Guid Id,
        Guid HouseholdId,
        int Kind,
        Guid WorkId,
        Guid? EditionId,
        string Title,
        string? Subtitle,
        string? Notes,
        string? Barcode,
        string? Location,
        string? Status,
        string? Condition,
        DateTime? AcquiredOn,
        decimal? Price,
        string? MetadataJson,
        DateTimeOffset CreatedUtc);
}
