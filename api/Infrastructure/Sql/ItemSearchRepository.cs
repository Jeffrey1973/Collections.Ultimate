using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class ItemSearchRepository : IItemSearchRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public ItemSearchRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IReadOnlyList<ItemSearchResult>> SearchAsync(
        HouseholdId householdId,
        string? query,
        string? tag,
        string? subject,
        string? barcode,
        string? status,
        string? location,
        int take,
        int skip,
        CancellationToken ct)
    {
        var q = string.IsNullOrWhiteSpace(query) ? null : $"%{query.Trim()}%";
        var tagNorm = string.IsNullOrWhiteSpace(tag) ? null : NormalizeKey(tag);
        var subjectNorm = string.IsNullOrWhiteSpace(subject) ? null : NormalizeKey(subject);

        const string sql = """
            with Authors as
            (
                select
                    wc.WorkId,
                    string_agg(p.DisplayName, N', ') within group (order by wc.Ordinal) as Authors
                from dbo.WorkContributor wc
                inner join dbo.Person p on p.Id = wc.PersonId
                where wc.RoleId = 1
                group by wc.WorkId
            )
            select
                i.Id as ItemId,
                i.WorkId,
                i.EditionId,
                i.Kind,
                i.Title,
                i.Subtitle,
                i.Barcode,
                i.Location,
                i.Status,
                i.Condition,
                i.AcquiredOn,
                i.Price,
                i.CreatedUtc,
                w.Title as WorkTitle,
                a.Authors
            from dbo.LibraryItem i
            inner join dbo.Work w on w.Id = i.WorkId
            left join Authors a on a.WorkId = i.WorkId
            where i.HouseholdId = @HouseholdId
              and (@Barcode is null or i.Barcode = @Barcode)
              and (@Status is null or i.Status = @Status)
              and (@Location is null or i.Location = @Location)
              and (
                    @Q is null
                 or i.Title like @Q
                 or w.Title like @Q
                 or a.Authors like @Q
                 or i.Barcode like @Q
              )
              and (
                    @TagNorm is null
                 or exists (
                        select 1
                        from dbo.WorkTag wt
                        inner join dbo.Tag t on t.Id = wt.TagId
                        where wt.WorkId = i.WorkId
                          and t.HouseholdId = @HouseholdId
                          and t.NormalizedName = @TagNorm
                 )
              )
              and (
                    @SubjectNorm is null
                 or exists (
                        select 1
                        from dbo.WorkSubject ws
                        inner join dbo.SubjectHeading sh on sh.Id = ws.SubjectHeadingId
                        where ws.WorkId = i.WorkId
                          and sh.NormalizedText = @SubjectNorm
                 )
              )
            order by i.Title
            offset @Skip rows fetch next @Take rows only;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ItemRow>(new CommandDefinition(sql, new
        {
            HouseholdId = householdId.Value,
            Q = q,
            TagNorm = tagNorm,
            SubjectNorm = subjectNorm,
            Barcode = string.IsNullOrWhiteSpace(barcode) ? null : barcode.Trim(),
            Status = string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
            Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim(),
            Take = take,
            Skip = skip
        }, cancellationToken: ct));

        return rows.Select(Map).ToList();
    }

    private static string NormalizeKey(string value)
        => string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();

    private static ItemSearchResult Map(ItemRow r) => new(
        r.ItemId,
        r.WorkId,
        r.EditionId,
        r.Kind,
        r.Title,
        r.Subtitle,
        r.Barcode,
        r.Location,
        r.Status,
        r.Condition,
        r.AcquiredOn is null ? null : DateOnly.FromDateTime(r.AcquiredOn.Value),
        r.Price,
        r.CreatedUtc,
        r.WorkTitle,
        r.Authors);

    private sealed record ItemRow(
        Guid ItemId,
        Guid WorkId,
        Guid? EditionId,
        int Kind,
        string Title,
        string? Subtitle,
        string? Barcode,
        string? Location,
        string? Status,
        string? Condition,
        DateTime? AcquiredOn,
        decimal? Price,
        DateTimeOffset CreatedUtc,
        string WorkTitle,
        string? Authors);
}
