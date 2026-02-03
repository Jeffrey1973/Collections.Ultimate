using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class BookRepository : IBookRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public BookRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task CreateAsync(Book book, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.Book
            (
                Id,
                HouseholdId,
                Kind,
                Title,
                Subtitle,
                Notes,
                CreatedUtc,
                Isbn10,
                Isbn13,
                Authors,
                PublishedYear,
                Publisher
            )
            values
            (
                @Id,
                @HouseholdId,
                @Kind,
                @Title,
                @Subtitle,
                @Notes,
                @CreatedUtc,
                @Isbn10,
                @Isbn13,
                @Authors,
                @PublishedYear,
                @Publisher
            );
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = book.Id.Value,
            HouseholdId = book.OwnerHouseholdId.Value,
            Kind = (int)book.Kind,
            book.Title,
            book.Subtitle,
            book.Notes,
            book.CreatedUtc,
            book.Isbn10,
            book.Isbn13,
            book.Authors,
            book.PublishedYear,
            book.Publisher
        }, cancellationToken: ct));
    }

    public async Task<Book?> GetByIdAsync(ItemId id, CancellationToken ct)
    {
        const string sql = """
            select
                Id,
                HouseholdId,
                Kind,
                Title,
                Subtitle,
                Notes,
                CreatedUtc,
                Isbn10,
                Isbn13,
                Authors,
                PublishedYear,
                Publisher
            from dbo.Book
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<BookRow>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));

        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<Book>> SearchAsync(HouseholdId householdId, string? query, int take, int skip, CancellationToken ct)
    {
        var q = string.IsNullOrWhiteSpace(query) ? null : $"%{query.Trim()}%";

        const string sql = """
            select
                Id,
                HouseholdId,
                Kind,
                Title,
                Subtitle,
                Notes,
                CreatedUtc,
                Isbn10,
                Isbn13,
                Authors,
                PublishedYear,
                Publisher
            from dbo.Book
            where HouseholdId = @HouseholdId
              and (
                    @Q is null
                 or Title like @Q
                 or Authors like @Q
                 or Isbn10 like @Q
                 or Isbn13 like @Q
              )
            order by Title
            offset @Skip rows fetch next @Take rows only;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<BookRow>(new CommandDefinition(sql, new
        {
            HouseholdId = householdId.Value,
            Q = q,
            Take = take,
            Skip = skip
        }, cancellationToken: ct));

        return rows.Select(Map).ToList();
    }

    private static Book Map(BookRow r) => new()
    {
        Id = new ItemId(r.Id),
        OwnerHouseholdId = new HouseholdId(r.HouseholdId),
        Kind = (ItemKind)r.Kind,
        Title = r.Title,
        Subtitle = r.Subtitle,
        Notes = r.Notes,
        CreatedUtc = r.CreatedUtc,
        Isbn10 = r.Isbn10,
        Isbn13 = r.Isbn13,
        Authors = r.Authors,
        PublishedYear = r.PublishedYear,
        Publisher = r.Publisher
    };

    private sealed record BookRow(
        Guid Id,
        Guid HouseholdId,
        int Kind,
        string Title,
        string? Subtitle,
        string? Notes,
        DateTimeOffset CreatedUtc,
        string? Isbn10,
        string? Isbn13,
        string? Authors,
        int? PublishedYear,
        string? Publisher);
}
