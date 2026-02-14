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
            insert into dbo.Edition
            (
                Id,
                WorkId,
                EditionTitle,
                EditionSubtitle,
                Publisher,
                PublishedYear,
                PageCount,
                Description,
                CoverImageUrl,
                Format,
                Binding,
                EditionStatement,
                PlaceOfPublication,
                Language,
                MetadataJson,
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
                @CoverImageUrl,
                @Format,
                @Binding,
                @EditionStatement,
                @PlaceOfPublication,
                @Language,
                @MetadataJson,
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
            edition.CoverImageUrl,
            edition.Format,
            edition.Binding,
            edition.EditionStatement,
            edition.PlaceOfPublication,
            edition.Language,
            edition.MetadataJson,
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
                CoverImageUrl,
                Format,
                Binding,
                EditionStatement,
                PlaceOfPublication,
                Language,
                MetadataJson,
                CreatedUtc
            from dbo.Edition
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<EditionRow>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    public async Task<bool> UpdateCoverUrlAsync(EditionId id, string? coverImageUrl, CancellationToken ct)
    {
        const string sql = """
            update dbo.Edition
            set CoverImageUrl = @CoverImageUrl
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = id.Value,
            CoverImageUrl = coverImageUrl
        }, cancellationToken: ct));

        return affected > 0;
    }

    public async Task<string?> GetCoverUrlAsync(EditionId id, CancellationToken ct)
    {
        const string sql = """
            select CoverImageUrl
            from dbo.Edition
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        return await conn.QuerySingleOrDefaultAsync<string?>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
    }

    public async Task<bool> UpdateAsync(EditionId id, string? publisher, int? publishedYear, int? pageCount, string? description, string? format, string? binding, string? editionStatement, string? placeOfPublication, string? language, string? metadataJson, CancellationToken ct)
    {
        const string sql = """
            update dbo.Edition
            set Publisher = coalesce(@Publisher, Publisher),
                PublishedYear = coalesce(@PublishedYear, PublishedYear),
                PageCount = coalesce(@PageCount, PageCount),
                Description = coalesce(@Description, Description),
                Format = coalesce(@Format, Format),
                Binding = coalesce(@Binding, Binding),
                EditionStatement = coalesce(@EditionStatement, EditionStatement),
                PlaceOfPublication = coalesce(@PlaceOfPublication, PlaceOfPublication),
                Language = coalesce(@Language, Language),
                MetadataJson = coalesce(@MetadataJson, MetadataJson)
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = id.Value,
            Publisher = publisher,
            PublishedYear = publishedYear,
            PageCount = pageCount,
            Description = description,
            Format = format,
            Binding = binding,
            EditionStatement = editionStatement,
            PlaceOfPublication = placeOfPublication,
            Language = language,
            MetadataJson = metadataJson
        }, cancellationToken: ct));
        return affected > 0;
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
        CoverImageUrl = r.CoverImageUrl,
        Format = r.Format,
        Binding = r.Binding,
        EditionStatement = r.EditionStatement,
        PlaceOfPublication = r.PlaceOfPublication,
        Language = r.Language,
        MetadataJson = r.MetadataJson,
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
        string? CoverImageUrl,
        string? Format,
        string? Binding,
        string? EditionStatement,
        string? PlaceOfPublication,
        string? Language,
        string? MetadataJson,
        DateTimeOffset CreatedUtc);
}
