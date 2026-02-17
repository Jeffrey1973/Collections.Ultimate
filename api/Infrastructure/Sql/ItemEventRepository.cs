using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class ItemEventRepository : IItemEventRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public ItemEventRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IReadOnlyList<ItemEventType>> ListEventTypesAsync(CancellationToken ct)
    {
        const string sql = "SELECT Id, Name, Label, Icon, SortOrder FROM dbo.ItemEventType ORDER BY SortOrder, Name";

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ItemEventType>(sql);
        return rows.ToList();
    }

    public async Task CreateAsync(ItemEvent evt, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.ItemEvent (Id, ItemId, EventTypeId, OccurredUtc, Notes, DetailJson, CreatedUtc)
            VALUES (@Id, @ItemId, @EventTypeId, @OccurredUtc, @Notes, @DetailJson, @CreatedUtc)
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(sql, new
        {
            evt.Id,
            ItemId = evt.ItemId.Value,
            evt.EventTypeId,
            evt.OccurredUtc,
            evt.Notes,
            evt.DetailJson,
            evt.CreatedUtc
        });
    }

    public async Task<IReadOnlyList<ItemEventEntry>> GetTimelineAsync(ItemId itemId, CancellationToken ct)
    {
        const string sql = """
            SELECT
                e.Id,
                e.ItemId,
                e.EventTypeId,
                t.Name   AS EventTypeName,
                t.Label  AS EventTypeLabel,
                t.Icon   AS EventTypeIcon,
                e.OccurredUtc,
                e.Notes,
                e.DetailJson,
                e.CreatedUtc
            FROM dbo.ItemEvent e
            INNER JOIN dbo.ItemEventType t ON t.Id = e.EventTypeId
            WHERE e.ItemId = @ItemId
            ORDER BY e.OccurredUtc DESC
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ItemEventEntry>(sql, new { ItemId = itemId.Value });
        return rows.ToList();
    }

    public async Task<bool> DeleteAsync(Guid eventId, CancellationToken ct)
    {
        const string sql = "DELETE FROM dbo.ItemEvent WHERE Id = @Id";

        using var conn = _connectionFactory.Create();
        var affected = await conn.ExecuteAsync(sql, new { Id = eventId });
        return affected > 0;
    }
}
