using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class WorkRepository : IWorkRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public WorkRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task CreateAsync(Work work, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.Work
            (
                Id,
                Title,
                Subtitle,
                SortTitle,
                Description,
                NormalizedTitle,
                OriginalTitle,
                Language,
                MetadataJson,
                CreatedUtc
            )
            values
            (
                @Id,
                @Title,
                @Subtitle,
                @SortTitle,
                @Description,
                @NormalizedTitle,
                @OriginalTitle,
                @Language,
                @MetadataJson,
                @CreatedUtc
            );
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = work.Id.Value,
            work.Title,
            work.Subtitle,
            work.SortTitle,
            work.Description,
            work.NormalizedTitle,
            work.OriginalTitle,
            work.Language,
            work.MetadataJson,
            work.CreatedUtc
        }, cancellationToken: ct));
    }

    public async Task<Work?> GetByIdAsync(WorkId id, CancellationToken ct)
    {
        const string sql = """
            select Id, Title, Subtitle, SortTitle, Description, NormalizedTitle, OriginalTitle, Language, MetadataJson, CreatedUtc
            from dbo.Work
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<WorkRow>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    public async Task<bool> UpdateAsync(WorkId id, string title, string? subtitle, string? sortTitle, string? description, string? originalTitle, string? language, string? metadataJson, CancellationToken ct)
    {
        const string sql = """
            update dbo.Work
            set Title = @Title,
                Subtitle = coalesce(@Subtitle, Subtitle),
                SortTitle = coalesce(@SortTitle, SortTitle),
                Description = coalesce(@Description, Description),
                OriginalTitle = coalesce(@OriginalTitle, OriginalTitle),
                Language = coalesce(@Language, Language),
                MetadataJson = coalesce(@MetadataJson, MetadataJson),
                NormalizedTitle = @NormalizedTitle
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = id.Value,
            Title = title,
            Subtitle = subtitle,
            SortTitle = sortTitle,
            Description = description,
            OriginalTitle = originalTitle,
            Language = language,
            MetadataJson = metadataJson,
            NormalizedTitle = NormalizeTitle(title)
        }, cancellationToken: ct));
        return affected > 0;
    }

    private static string NormalizeTitle(string title) =>
        string.Join(' ', title.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();

    private static Work Map(WorkRow r) => new()
    {
        Id = new WorkId(r.Id),
        Title = r.Title,
        Subtitle = r.Subtitle,
        SortTitle = r.SortTitle,
        Description = r.Description,
        NormalizedTitle = r.NormalizedTitle,
        OriginalTitle = r.OriginalTitle,
        Language = r.Language,
        MetadataJson = r.MetadataJson,
        CreatedUtc = r.CreatedUtc
    };

    private sealed record WorkRow(
        Guid Id,
        string Title,
        string? Subtitle,
        string? SortTitle,
        string? Description,
        string? NormalizedTitle,
        string? OriginalTitle,
        string? Language,
        string? MetadataJson,
        DateTimeOffset CreatedUtc);
}
