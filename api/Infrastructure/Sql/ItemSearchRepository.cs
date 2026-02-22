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

    public async Task<SearchPagedResult> SearchAsync(
        HouseholdId householdId,
        string? query,
        string? tag,
        string? subject,
        string? barcode,
        string? status,
        string? location,
        bool? verified,
        bool? enriched,
        int take,
        int skip,
        CancellationToken ct)
    {
        // Split query into individual words for AND matching — each word must match at least one field
        var terms = string.IsNullOrWhiteSpace(query)
            ? []
            : query.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);

        var tagNorm = string.IsNullOrWhiteSpace(tag) ? null : NormalizeKey(tag);
        var subjectNorm = string.IsNullOrWhiteSpace(subject) ? null : NormalizeKey(subject);

        // Build per-term AND clauses dynamically
        var parameters = new DynamicParameters();
        parameters.Add("HouseholdId", householdId.Value);
        parameters.Add("TagNorm", tagNorm);
        parameters.Add("SubjectNorm", subjectNorm);
        parameters.Add("Barcode", string.IsNullOrWhiteSpace(barcode) ? null : barcode.Trim());
        parameters.Add("Status", string.IsNullOrWhiteSpace(status) ? null : status.Trim());
        parameters.Add("Location", string.IsNullOrWhiteSpace(location) ? null : location.Trim());
        parameters.Add("Verified", verified.HasValue ? (verified.Value ? 1 : 0) : (int?)null);
        parameters.Add("Enriched", enriched.HasValue ? (enriched.Value ? 1 : 0) : (int?)null);
        parameters.Add("Take", take);
        parameters.Add("Skip", skip);

        var termClauses = new System.Text.StringBuilder();
        for (int idx = 0; idx < terms.Length; idx++)
        {
            var paramName = $"@Q{idx}";
            parameters.Add($"Q{idx}", $"%{terms[idx]}%");
            termClauses.AppendLine($"""
              and (
                    i.Title like {paramName}
                 or w.Title like {paramName}
                 or a.Authors like {paramName}
                 or i.Barcode like {paramName}
                 or i.Subtitle like {paramName}
                 or i.Notes like {paramName}
                 or i.Location like {paramName}
                 or i.Status like {paramName}
                 or i.Condition like {paramName}
                 or i.ReadStatus like {paramName}
                 or w.Description like {paramName}
                 or w.OriginalTitle like {paramName}
                 or w.Language like {paramName}
                 or w.MetadataJson like {paramName}
                 or e.Publisher like {paramName}
                 or cast(e.PublishedYear as varchar) like {paramName}
                 or e.Format like {paramName}
                 or e.Binding like {paramName}
                 or e.EditionStatement like {paramName}
                 or e.PlaceOfPublication like {paramName}
                 or e.Language like {paramName}
                 or e.MetadataJson like {paramName}
                 or i.MetadataJson like {paramName}
                 or s.Name like {paramName}
                 or exists (
                      select 1
                      from dbo.WorkTag wt
                      inner join dbo.Tag t on t.Id = wt.TagId
                      where wt.WorkId = i.WorkId
                        and t.Name like {paramName}
                 )
                 or exists (
                      select 1
                      from dbo.WorkSubject ws
                      inner join dbo.SubjectHeading sh on sh.Id = ws.SubjectHeadingId
                      where ws.WorkId = i.WorkId
                        and sh.Text like {paramName}
                 )
                 or exists (
                      select 1
                      from dbo.EditionIdentifier ei
                      where ei.EditionId = i.EditionId
                        and ei.Value like {paramName}
                 )
              )
            """);
        }

        var sql = $"""
            with Authors as
            (
                select
                    wc.WorkId,
                    string_agg(cast(p.DisplayName as nvarchar(max)), N', ') within group (order by wc.Ordinal) as Authors
                from dbo.WorkContributor wc
                inner join dbo.Person p on p.Id = wc.PersonId
                where wc.RoleId = 1
                group by wc.WorkId
            )
            select
                count(*) over() as TotalCount,
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
                i.LibraryOrder,
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
                i.CustomCoverUrl,
                e.Format,
                e.Binding,
                e.EditionStatement,
                e.PlaceOfPublication,
                e.Language as EditionLanguage,
                e.MetadataJson as EditionMetadataJson,
                (select string_agg(cast(t.Name as nvarchar(max)), N'||') from dbo.WorkTag wt2 inner join dbo.Tag t on t.Id = wt2.TagId where wt2.WorkId = i.WorkId) as Tags,
                (select string_agg(cast(sh.Text as nvarchar(max)), N'||') from dbo.WorkSubject ws2 inner join dbo.SubjectHeading sh on sh.Id = ws2.SubjectHeadingId where ws2.WorkId = i.WorkId) as Subjects,
                (select string_agg(cast(cast(ei.IdentifierTypeId as varchar) + N':' + ei.Value as nvarchar(max)), N'||') from dbo.EditionIdentifier ei where ei.EditionId = i.EditionId) as Identifiers,
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
              and (@Verified is null
                   or (@Verified = 1 and i.MetadataJson like N'%inventoryVerifiedDate%')
                   or (@Verified = 0 and (i.MetadataJson is null or i.MetadataJson not like N'%inventoryVerifiedDate%')))
              and (@Enriched is null
                   or (@Enriched = 1 and i.MetadataJson like N'%enrichedAt%')
                   or (@Enriched = 0 and (i.MetadataJson is null or i.MetadataJson not like N'%enrichedAt%')))
              {termClauses}
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
            order by coalesce(i.AcquiredOn, cast(i.CreatedUtc as date)) desc, i.Title
            offset @Skip rows fetch next @Take rows only;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ItemRow>(new CommandDefinition(sql, parameters, cancellationToken: ct));

        var list = rows.ToList();
        var totalCount = list.FirstOrDefault()?.TotalCount ?? 0;
        return new SearchPagedResult(totalCount, list.Select(Map).ToList());
    }

    public async Task<IReadOnlyList<ItemSearchResult>> GetByIdsAsync(
        HouseholdId householdId,
        IReadOnlyList<Guid> itemIds,
        CancellationToken ct)
    {
        if (itemIds.Count == 0)
            return [];

        const string sql = """
            with Authors as
            (
                select
                    wc.WorkId,
                    string_agg(cast(p.DisplayName as nvarchar(max)), N', ') within group (order by wc.Ordinal) as Authors
                from dbo.WorkContributor wc
                inner join dbo.Person p on p.Id = wc.PersonId
                where wc.RoleId = 1
                group by wc.WorkId
            )
            select
                0 as TotalCount,
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
                i.LibraryOrder,
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
                i.CustomCoverUrl,
                e.Format,
                e.Binding,
                e.EditionStatement,
                e.PlaceOfPublication,
                e.Language as EditionLanguage,
                e.MetadataJson as EditionMetadataJson,
                (select string_agg(cast(t.Name as nvarchar(max)), N'||') from dbo.WorkTag wt2 inner join dbo.Tag t on t.Id = wt2.TagId where wt2.WorkId = i.WorkId) as Tags,
                (select string_agg(cast(sh.Text as nvarchar(max)), N'||') from dbo.WorkSubject ws2 inner join dbo.SubjectHeading sh on sh.Id = ws2.SubjectHeadingId where ws2.WorkId = i.WorkId) as Subjects,
                (select string_agg(cast(cast(ei.IdentifierTypeId as varchar) + N':' + ei.Value as nvarchar(max)), N'||') from dbo.EditionIdentifier ei where ei.EditionId = i.EditionId) as Identifiers,
                s.Name as SeriesName,
                ws3.VolumeNumber
            from dbo.LibraryItem i
            inner join dbo.Work w on w.Id = i.WorkId
            left join Authors a on a.WorkId = i.WorkId
            left join dbo.Edition e on e.Id = i.EditionId
            left join dbo.WorkSeries ws3 on ws3.WorkId = i.WorkId
            left join dbo.Series s on s.Id = ws3.SeriesId
            where i.HouseholdId = @HouseholdId
              and i.Id in @ItemIds;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<ItemRow>(new CommandDefinition(sql, new
        {
            HouseholdId = householdId.Value,
            ItemIds = itemIds
        }, cancellationToken: ct));

        // Preserve the order from Meilisearch ranking
        var lookup = rows.ToDictionary(r => r.ItemId, r => Map(r));
        return itemIds.Where(lookup.ContainsKey).Select(id => lookup[id]).ToList();
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
        r.LibraryOrder,
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
        r.CustomCoverUrl,
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
        int TotalCount,
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
        int? LibraryOrder,
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
        string? CustomCoverUrl,
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

    public async Task<IReadOnlyList<DuplicateGroup>> FindDuplicatesAsync(
        HouseholdId householdId,
        CancellationToken ct)
    {
        const string sql = """
            ;with ItemAuthor as (
                -- Get a single primary author per item (the first alphabetically if multiple RoleId=1)
                select
                    i.Id as ItemId,
                    i.Title,
                    (select top 1 p.DisplayName
                       from dbo.WorkContributor wc
                       inner join dbo.Person p on p.Id = wc.PersonId
                       where wc.WorkId = i.WorkId and wc.RoleId = 1
                       order by p.DisplayName) as Author
                from dbo.LibraryItem i
                where i.HouseholdId = @HouseholdId
                  and (i.Status is null or i.Status <> 'Deleted')
            ),
            DupKeys as (
                select 
                    ia.Title,
                    ia.Author,
                    count(*) as Cnt
                from ItemAuthor ia
                group by ia.Title, ia.Author
                having count(*) > 1
            )
            select
                i.Id               as ItemId,
                i.WorkId,
                i.EditionId,
                i.Title,
                i.Subtitle,
                i.Barcode,
                i.Location,
                i.Status,
                i.Condition,
                i.Notes,
                i.UserRating,
                i.ReadStatus,
                i.CreatedUtc,
                dk.Author,
                e.Publisher,
                e.PublishedYear,
                e.PageCount,
                e.CoverImageUrl,
                e.Format,
                (select string_agg(cast(t2.Name as nvarchar(max)), N'||')
                   from dbo.WorkTag wt2
                   inner join dbo.Tag t2 on t2.Id = wt2.TagId
                   where wt2.WorkId = i.WorkId) as Tags,
                (select string_agg(cast(sh2.Text as nvarchar(max)), N'||')
                   from dbo.WorkSubject ws2
                   inner join dbo.SubjectHeading sh2 on sh2.Id = ws2.SubjectHeadingId
                   where ws2.WorkId = i.WorkId) as Subjects,
                (select string_agg(cast(cast(ei.IdentifierTypeId as varchar) + N':' + ei.Value as nvarchar(max)), N'||')
                   from dbo.EditionIdentifier ei
                   where ei.EditionId = i.EditionId) as Identifiers
            from DupKeys dk
            inner join ItemAuthor ia on ia.Title = dk.Title
                and ((dk.Author is null and ia.Author is null) or dk.Author = ia.Author)
            inner join dbo.LibraryItem i on i.Id = ia.ItemId
            left join dbo.Edition e on e.Id = i.EditionId
            order by dk.Title, dk.Author, i.CreatedUtc;
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<DupRow>(new CommandDefinition(sql, new
        {
            HouseholdId = householdId.Value
        }, cancellationToken: ct));

        // Group rows into DuplicateGroup objects
        var groups = new List<DuplicateGroup>();
        var currentKey = (string?)null;
        var currentItems = new List<DuplicateItem>();
        string? currentTitle = null;
        string? currentAuthor = null;

        foreach (var row in rows)
        {
            var key = $"{row.Title}|{row.Author}";
            if (key != currentKey)
            {
                if (currentKey is not null && currentItems.Count > 1)
                    groups.Add(new DuplicateGroup(currentKey, currentTitle!, currentAuthor, currentItems.ToList()));
                currentKey = key;
                currentTitle = row.Title;
                currentAuthor = row.Author;
                currentItems.Clear();
            }
            // Skip duplicate ItemIds (can happen when a Work has multiple contributors)
            if (currentItems.Any(x => x.ItemId == row.ItemId))
                continue;
            currentItems.Add(new DuplicateItem(
                row.ItemId, row.WorkId, row.EditionId,
                row.Title, row.Subtitle, row.Barcode, row.Location, row.Status, row.Condition, row.Notes,
                row.Author, row.Publisher, row.PublishedYear, row.PageCount, row.CoverImageUrl, row.Format,
                row.UserRating, row.ReadStatus, row.CreatedUtc,
                row.Identifiers, row.Tags, row.Subjects));
        }
        if (currentKey is not null && currentItems.Count > 1)
            groups.Add(new DuplicateGroup(currentKey, currentTitle!, currentAuthor, currentItems.ToList()));

        return groups;
    }

    private sealed record DupRow(
        Guid ItemId,
        Guid WorkId,
        Guid? EditionId,
        string Title,
        string? Subtitle,
        string? Barcode,
        string? Location,
        string? Status,
        string? Condition,
        string? Notes,
        decimal? UserRating,
        string? ReadStatus,
        DateTimeOffset CreatedUtc,
        string? Author,
        string? Publisher,
        int? PublishedYear,
        int? PageCount,
        string? CoverImageUrl,
        string? Format,
        string? Tags,
        string? Subjects,
        string? Identifiers);
}
