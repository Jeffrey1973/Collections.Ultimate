using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class WorkLookupRepository : IWorkLookupRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public WorkLookupRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<WorkId?> FindWorkByNormalizedTitleAndFirstAuthorAsync(string normalizedTitle, string? firstAuthorDisplayName, CancellationToken ct)
    {
        const string sql = """
            select top (1) w.Id
            from dbo.Works w
            where w.NormalizedTitle = @NormalizedTitle
              and (
                    @FirstAuthor is null
                 or exists (
                        select 1
                        from dbo.WorkContributors wc
                        inner join dbo.People p on p.Id = wc.PersonId
                        where wc.WorkId = w.Id
                          and wc.RoleId = 1
                          and wc.Ordinal = 1
                          and p.DisplayName = @FirstAuthor
                 )
              )
            order by w.CreatedUtc asc;
            """;

        using var conn = _connectionFactory.Create();
        var id = await conn.QuerySingleOrDefaultAsync<Guid?>(new CommandDefinition(sql, new
        {
            NormalizedTitle = normalizedTitle,
            FirstAuthor = string.IsNullOrWhiteSpace(firstAuthorDisplayName) ? null : firstAuthorDisplayName.Trim()
        }, cancellationToken: ct));

        return id is null ? null : new WorkId(id.Value);
    }
}
