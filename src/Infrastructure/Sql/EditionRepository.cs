using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class EditionRepository : IEditionRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public EditionRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task CreateAsync(Edition edition, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.Editions
            (
                Id,
                WorkId,
                EditionTitle,
                EditionSubtitle,
                Publisher,
                PublishedYear,
                PageCount,
                Description,
                CreatedUtc
            )
            values
            (
                @Id,
                @WorkId,
                @EditionTitle,
                @EditionSubtitle,
                @Publisher,
                @PublishedYear,
                @PageCount,
                @Description,
                @CreatedUtc
            );
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = edition.Id.Value,
            WorkId = edition.WorkId.Value,
            edition.EditionTitle,
            edition.EditionSubtitle,
            edition.Publisher,
            edition.PublishedYear,
            edition.PageCount,
            edition.Description,
            edition.CreatedUtc
        }, cancellationToken: ct));
    }

    public async Task<Edition?> GetByIdAsync(EditionId id, CancellationToken ct)
    {
        const string sql = """
            select
                Id,
                WorkId,
                EditionTitle,
                EditionSubtitle,
                Publisher,
                PublishedYear,
                PageCount,
                Description,
                CreatedUtc
            from dbo.Editions
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<EditionRow>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    private static Edition Map(EditionRow r) => new()
    {
        Id = new EditionId(r.Id),
        WorkId = new WorkId(r.WorkId),
        EditionTitle = r.EditionTitle,
        EditionSubtitle = r.EditionSubtitle,
        Publisher = r.Publisher,
        PublishedYear = r.PublishedYear,
        PageCount = r.PageCount,
        Description = r.Description,
        CreatedUtc = r.CreatedUtc
    };

    private sealed record EditionRow(
        Guid Id,
        Guid WorkId,
        string? EditionTitle,
        string? EditionSubtitle,
        string? Publisher,
        int? PublishedYear,
        int? PageCount,
        string? Description,
        DateTimeOffset CreatedUtc);
}
