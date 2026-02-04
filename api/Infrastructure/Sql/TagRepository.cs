using System.Data;
using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class TagRepository : ITagRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public TagRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Tag?> GetByNameAsync(HouseholdId householdId, string name, CancellationToken ct)
    {
        const string sql = """
            select Id, HouseholdId, Name, NormalizedName, CreatedUtc
            from dbo.Tag
            where HouseholdId = @HouseholdId and NormalizedName = @NormalizedName;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<TagRow>(
            new CommandDefinition(sql, new { HouseholdId = householdId.Value, NormalizedName = Normalize(name) }, cancellationToken: ct));

        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<Tag>> GetByNamesAsync(HouseholdId householdId, IEnumerable<string> names, CancellationToken ct)
    {
        var normalizedNames = names.Select(Normalize).Distinct().ToList();
        if (normalizedNames.Count == 0)
            return [];

        const string sql = """
            select Id, HouseholdId, Name, NormalizedName, CreatedUtc
            from dbo.Tag
            where HouseholdId = @HouseholdId and NormalizedName in @NormalizedNames;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<TagRow>(
            new CommandDefinition(sql, new { HouseholdId = householdId.Value, NormalizedNames = normalizedNames }, cancellationToken: ct));

        return rows.Select(Map).ToList();
    }

    public async Task<Tag> CreateAsync(Tag tag, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.Tag (Id, HouseholdId, Name, NormalizedName, CreatedUtc)
            values (@Id, @HouseholdId, @Name, @NormalizedName, @CreatedUtc);
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = tag.Id.Value,
            HouseholdId = tag.OwnerHouseholdId.Value,
            tag.Name,
            tag.NormalizedName,
            tag.CreatedUtc
        }, cancellationToken: ct));

        return tag;
    }

    public async Task<IReadOnlyList<Tag>> GetByWorkIdAsync(WorkId workId, CancellationToken ct)
    {
        const string sql = """
            select t.Id, t.HouseholdId, t.Name, t.NormalizedName, t.CreatedUtc
            from dbo.WorkTag wt
            inner join dbo.Tag t on t.Id = wt.TagId
            where wt.WorkId = @WorkId
            order by t.Name;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<TagRow>(
            new CommandDefinition(sql, new { WorkId = workId.Value }, cancellationToken: ct));

        return rows.Select(Map).ToList();
    }

    public async Task SetWorkTagsAsync(WorkId workId, IEnumerable<TagId> tagIds, CancellationToken ct)
    {
        const string deleteSql = "delete from dbo.WorkTag where WorkId = @WorkId;";
        const string insertSql = "insert into dbo.WorkTag (WorkId, TagId) values (@WorkId, @TagId);";

        using var conn = (SqlConnection)_connectionFactory.Create();
        await conn.OpenAsync(ct);
        using var transaction = (SqlTransaction)await conn.BeginTransactionAsync(ct);

        try
        {
            await conn.ExecuteAsync(new CommandDefinition(deleteSql, new { WorkId = workId.Value }, transaction, cancellationToken: ct));

            foreach (var tagId in tagIds)
            {
                await conn.ExecuteAsync(new CommandDefinition(insertSql, new { WorkId = workId.Value, TagId = tagId.Value }, transaction, cancellationToken: ct));
            }

            await transaction.CommitAsync(ct);
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    private static string Normalize(string name) => name.Trim().ToUpperInvariant();

    private static Tag Map(TagRow r) => new()
    {
        Id = new TagId(r.Id),
        OwnerHouseholdId = new HouseholdId(r.HouseholdId),
        Name = r.Name,
        NormalizedName = r.NormalizedName,
        CreatedUtc = r.CreatedUtc
    };

    private sealed record TagRow(Guid Id, Guid HouseholdId, string Name, string NormalizedName, DateTimeOffset CreatedUtc);
}
