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
                i.ReadStatus,
                i.CompletedDate,
                i.DateStarted,
                i.UserRating,
                i.CreatedUtc,
                i.Notes,
                i.MetadataJson as ItemMetadataJson,
                w.Title as WorkTitle,
                w.Description as WorkDescription,
                w.OriginalTitle,
                w.Language as WorkLanguage,
                w.MetadataJson as WorkMetadataJson,
                a.Authors,
                e.Publisher,
                e.PublishedYear,
                e.PageCount,
                e.CoverImageUrl,
                e.Format,
                e.Binding,
                e.EditionStatement,
                e.PlaceOfPublication,
                e.Language as EditionLanguage,
                e.MetadataJson as EditionMetadataJson,
                (select string_agg(t.Name, N'||') from dbo.WorkTag wt2 inner join dbo.Tag t on t.Id = wt2.TagId where wt2.WorkId = i.WorkId) as Tags,
                (select string_agg(sh.Text, N'||') from dbo.WorkSubject ws2 inner join dbo.SubjectHeading sh on sh.Id = ws2.SubjectHeadingId where ws2.WorkId = i.WorkId) as Subjects,
                (select string_agg(cast(ei.IdentifierTypeId as varchar) + N':' + ei.Value, N'||') from dbo.EditionIdentifier ei where ei.EditionId = i.EditionId) as Identifiers,
                s.Name as SeriesName,
                ws3.VolumeNumber
            from dbo.LibraryItem i
            inner join dbo.Work w on w.Id = i.WorkId
            left join Authors a on a.WorkId = i.WorkId
            left join dbo.Edition e on e.Id = i.EditionId
            left join dbo.WorkSeries ws3 on ws3.WorkId = i.WorkId
            left join dbo.Series s on s.Id = ws3.SeriesId
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
        r.ReadStatus,
        r.CompletedDate,
        r.DateStarted,
        r.UserRating,
        r.CreatedUtc,
        r.WorkTitle,
        r.Authors,
        r.Tags?.Split("||", StringSplitOptions.RemoveEmptyEntries),
        r.Subjects?.Split("||", StringSplitOptions.RemoveEmptyEntries),
        r.WorkDescription,
        r.OriginalTitle,
        r.WorkLanguage,
        r.WorkMetadataJson,
        r.Publisher,
        r.PublishedYear,
        r.PageCount,
        r.CoverImageUrl,
        r.Format,
        r.Binding,
        r.EditionStatement,
        r.PlaceOfPublication,
        r.EditionLanguage,
        r.EditionMetadataJson,
        r.ItemMetadataJson,
        r.Notes,
        r.Identifiers,
        r.SeriesName,
        r.VolumeNumber);

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
        string? ReadStatus,
        string? CompletedDate,
        string? DateStarted,
        decimal? UserRating,
        DateTimeOffset CreatedUtc,
        string? Notes,
        string? ItemMetadataJson,
        string? WorkTitle,
        string? WorkDescription,
        string? OriginalTitle,
        string? WorkLanguage,
        string? WorkMetadataJson,
        string? Authors,
        string? Publisher,
        int? PublishedYear,
        int? PageCount,
        string? CoverImageUrl,
        string? Format,
        string? Binding,
        string? EditionStatement,
        string? PlaceOfPublication,
        string? EditionLanguage,
        string? EditionMetadataJson,
        string? Tags,
        string? Subjects,
        string? Identifiers,
        string? SeriesName,
        string? VolumeNumber);
}
