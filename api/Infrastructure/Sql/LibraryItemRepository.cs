using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class LibraryItemRepository : ILibraryItemRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public LibraryItemRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task CreateAsync(LibraryItem item, CancellationToken ct)
    {
        const string sql = """
            insert into dbo.LibraryItem
            (
                Id,
                HouseholdId,
                Kind,
                WorkId,
                EditionId,
                Title,
                Subtitle,
                Notes,
                Barcode,
                Location,
                Status,
                Condition,
                AcquiredOn,
                Price,
                ReadStatus,
                CompletedDate,
                DateStarted,
                UserRating,
                LibraryOrder,
                MetadataJson,
                CreatedUtc
            )
            values
            (
                @Id,
                @HouseholdId,
                @Kind,
                @WorkId,
                @EditionId,
                @Title,
                @Subtitle,
                @Notes,
                @Barcode,
                @Location,
                @Status,
                @Condition,
                @AcquiredOn,
                @Price,
                @ReadStatus,
                @CompletedDate,
                @DateStarted,
                @UserRating,
                @LibraryOrder,
                @MetadataJson,
                @CreatedUtc
            );
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = item.Id.Value,
            HouseholdId = item.OwnerHouseholdId.Value,
            Kind = (int)item.Kind,
            WorkId = item.WorkId.Value,
            EditionId = item.EditionId?.Value,
            item.Title,
            item.Subtitle,
            item.Notes,
            item.Barcode,
            item.Location,
            item.Status,
            item.Condition,
            AcquiredOn = item.AcquiredOn is null ? (DateTime?)null : item.AcquiredOn.Value.ToDateTime(TimeOnly.MinValue),
            item.Price,
            item.ReadStatus,
            item.CompletedDate,
            item.DateStarted,
            item.UserRating,
            item.LibraryOrder,
            item.MetadataJson,
            item.CreatedUtc
        }, cancellationToken: ct));
    }

    public async Task<LibraryItem?> GetByIdAsync(ItemId id, CancellationToken ct)
    {
        const string sql = """
            select
                Id,
                HouseholdId,
                Kind,
                WorkId,
                EditionId,
                Title,
                Subtitle,
                Notes,
                Barcode,
                Location,
                Status,
                Condition,
                AcquiredOn,
                Price,
                ReadStatus,
                CompletedDate,
                DateStarted,
                UserRating,
                LibraryOrder,
                MetadataJson,
                CreatedUtc
            from dbo.LibraryItem
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<ItemRow>(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    public async Task<bool> DeleteAsync(ItemId id, CancellationToken ct)
    {
        const string sql = """
            delete from dbo.LibraryItem
            where Id = @Id;
            """;

        using var conn = _connectionFactory.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
        return affected > 0;
    }

    public async Task<ItemFullResponse?> GetFullByIdAsync(ItemId id, CancellationToken ct)
    {
        const string mainSql = """
            select
                i.Id as ItemId,
                i.HouseholdId,
                i.Kind,
                i.Title,
                i.Subtitle,
                i.Notes,
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
                i.MetadataJson as ItemMetadataJson,
                i.CreatedUtc as ItemCreatedUtc,
                w.Id as WorkId,
                w.Title as WorkTitle,
                w.Subtitle as WorkSubtitle,
                w.SortTitle,
                w.Description as WorkDescription,
                w.OriginalTitle,
                w.Language as WorkLanguage,
                w.MetadataJson as WorkMetadataJson,
                w.CreatedUtc as WorkCreatedUtc,
                e.Id as EditionId,
                e.EditionTitle,
                e.EditionSubtitle,
                e.Publisher,
                e.PublishedYear,
                e.PageCount,
                e.Description as EditionDescription,
                e.CoverImageUrl,
                e.Format,
                e.Binding,
                e.EditionStatement,
                e.PlaceOfPublication,
                e.Language as EditionLanguage,
                e.MetadataJson as EditionMetadataJson,
                e.CreatedUtc as EditionCreatedUtc
            from dbo.LibraryItem i
            inner join dbo.Work w on w.Id = i.WorkId
            left join dbo.Edition e on e.Id = i.EditionId
            where i.Id = @Id;
            """;

        const string contributorsSql = """
            select
                p.Id as PersonId,
                p.DisplayName,
                p.SortName,
                wc.RoleId,
                cr.Name as RoleName,
                wc.Ordinal,
                p.BirthYear,
                p.DeathYear
            from dbo.WorkContributor wc
            inner join dbo.Person p on p.Id = wc.PersonId
            inner join dbo.ContributorRole cr on cr.Id = wc.RoleId
            where wc.WorkId = @WorkId
            order by wc.RoleId, wc.Ordinal;
            """;

        const string tagsSql = """
            select
                t.Id as TagId,
                t.Name
            from dbo.WorkTag wt
            inner join dbo.Tag t on t.Id = wt.TagId
            where wt.WorkId = @WorkId
            order by t.Name;
            """;

        const string subjectsSql = """
            select
                sh.Id as SubjectHeadingId,
                sh.SchemeId,
                ss.Name as SchemeName,
                sh.Text
            from dbo.WorkSubject ws
            inner join dbo.SubjectHeading sh on sh.Id = ws.SubjectHeadingId
            inner join dbo.SubjectScheme ss on ss.Id = sh.SchemeId
            where ws.WorkId = @WorkId
            order by ss.Name, sh.Text;
            """;

        const string identifiersSql = """
            select
                ei.IdentifierTypeId,
                it.Name as IdentifierTypeName,
                ei.Value,
                ei.IsPrimary
            from dbo.EditionIdentifier ei
            inner join dbo.IdentifierType it on it.Id = ei.IdentifierTypeId
            where ei.EditionId = @EditionId
            order by ei.IsPrimary desc, it.Name;
            """;

        const string seriesSql = """
            select top (1)
                s.Id as SeriesId,
                s.Name,
                ws.VolumeNumber,
                ws.Ordinal
            from dbo.WorkSeries ws
            inner join dbo.Series s on s.Id = ws.SeriesId
            where ws.WorkId = @WorkId;
            """;

        using var conn = _connectionFactory.Create();

        var mainRow = await conn.QuerySingleOrDefaultAsync<ItemFullRow>(
            new CommandDefinition(mainSql, new { Id = id.Value }, cancellationToken: ct));

        if (mainRow is null)
            return null;

        var contributors = (await conn.QueryAsync<ContributorRow>(
            new CommandDefinition(contributorsSql, new { WorkId = mainRow.WorkId }, cancellationToken: ct)))
            .Select(c => new ContributorResponse
            {
                PersonId = c.PersonId,
                DisplayName = c.DisplayName,
                SortName = c.SortName,
                RoleId = c.RoleId,
                RoleName = c.RoleName,
                Ordinal = c.Ordinal,
                BirthYear = c.BirthYear,
                DeathYear = c.DeathYear
            }).ToList();

        var tags = (await conn.QueryAsync<TagRow>(
            new CommandDefinition(tagsSql, new { WorkId = mainRow.WorkId }, cancellationToken: ct)))
            .Select(t => new TagResponse
            {
                TagId = t.TagId,
                Name = t.Name
            }).ToList();

        var subjects = (await conn.QueryAsync<SubjectRow>(
            new CommandDefinition(subjectsSql, new { WorkId = mainRow.WorkId }, cancellationToken: ct)))
            .Select(s => new SubjectResponse
            {
                SubjectHeadingId = s.SubjectHeadingId,
                SchemeId = s.SchemeId,
                SchemeName = s.SchemeName,
                Text = s.Text
            }).ToList();

        var series = await conn.QuerySingleOrDefaultAsync<SeriesRow>(
            new CommandDefinition(seriesSql, new { WorkId = mainRow.WorkId }, cancellationToken: ct));
        SeriesResponse? seriesResponse = series is null ? null : new SeriesResponse
        {
            SeriesId = series.SeriesId,
            Name = series.Name,
            VolumeNumber = series.VolumeNumber,
            Ordinal = series.Ordinal
        };

        List<IdentifierResponse> identifiers = new();
        if (mainRow.EditionId is not null)
        {
            identifiers = (await conn.QueryAsync<IdentifierRow>(
                new CommandDefinition(identifiersSql, new { mainRow.EditionId }, cancellationToken: ct)))
                .Select(i => new IdentifierResponse
                {
                    IdentifierTypeId = i.IdentifierTypeId,
                    IdentifierTypeName = i.IdentifierTypeName,
                    Value = i.Value,
                    IsPrimary = i.IsPrimary
                }).ToList();
        }

        var authors = string.Join(", ", contributors
            .Where(c => c.RoleName == "Author")
            .OrderBy(c => c.Ordinal)
            .Select(c => c.DisplayName));

        return new ItemFullResponse
        {
            ItemId = mainRow.ItemId,
            HouseholdId = mainRow.HouseholdId,
            Kind = mainRow.Kind,
            Title = mainRow.Title,
            Subtitle = mainRow.Subtitle,
            Authors = string.IsNullOrEmpty(authors) ? null : authors,
            Notes = mainRow.Notes,
            Barcode = mainRow.Barcode,
            Location = mainRow.Location,
            Status = mainRow.Status,
            Condition = mainRow.Condition,
            AcquiredOn = mainRow.AcquiredOn is null ? null : DateOnly.FromDateTime(mainRow.AcquiredOn.Value),
            Price = mainRow.Price,
            ReadStatus = mainRow.ReadStatus,
            CompletedDate = mainRow.CompletedDate,
            DateStarted = mainRow.DateStarted,
            UserRating = mainRow.UserRating,
            LibraryOrder = mainRow.LibraryOrder,
            MetadataJson = mainRow.ItemMetadataJson,
            CreatedUtc = mainRow.ItemCreatedUtc,
            Work = new WorkResponse
            {
                WorkId = mainRow.WorkId,
                Title = mainRow.WorkTitle,
                Subtitle = mainRow.WorkSubtitle,
                SortTitle = mainRow.SortTitle,
                Description = mainRow.WorkDescription,
                OriginalTitle = mainRow.OriginalTitle,
                Language = mainRow.WorkLanguage,
                MetadataJson = mainRow.WorkMetadataJson,
                CreatedUtc = mainRow.WorkCreatedUtc
            },
            Edition = mainRow.EditionId is null ? null : new EditionResponse
            {
                EditionId = mainRow.EditionId.Value,
                EditionTitle = mainRow.EditionTitle,
                EditionSubtitle = mainRow.EditionSubtitle,
                Publisher = mainRow.Publisher,
                PublishedYear = mainRow.PublishedYear,
                PageCount = mainRow.PageCount,
                Description = mainRow.EditionDescription,
                CoverImageUrl = mainRow.CoverImageUrl,
                Format = mainRow.Format,
                Binding = mainRow.Binding,
                EditionStatement = mainRow.EditionStatement,
                PlaceOfPublication = mainRow.PlaceOfPublication,
                Language = mainRow.EditionLanguage,
                MetadataJson = mainRow.EditionMetadataJson,
                CreatedUtc = mainRow.EditionCreatedUtc ?? default
            },
            Contributors = contributors,
            Tags = tags,
            Subjects = subjects,
            Identifiers = identifiers,
            Series = seriesResponse
        };
    }

    private static LibraryItem Map(ItemRow r) => new()
    {
        Id = new ItemId(r.Id),
        OwnerHouseholdId = new HouseholdId(r.HouseholdId),
        Kind = (ItemKind)r.Kind,
        WorkId = new WorkId(r.WorkId),
        EditionId = r.EditionId is null ? null : new EditionId(r.EditionId.Value),
        Title = r.Title,
        Subtitle = r.Subtitle,
        Notes = r.Notes,
        Barcode = r.Barcode,
        Location = r.Location,
        Status = r.Status,
        Condition = r.Condition,
        AcquiredOn = r.AcquiredOn is null ? null : DateOnly.FromDateTime(r.AcquiredOn.Value),
        Price = r.Price,
        ReadStatus = r.ReadStatus,
        CompletedDate = r.CompletedDate,
        DateStarted = r.DateStarted,
        UserRating = r.UserRating,
        LibraryOrder = r.LibraryOrder,
        MetadataJson = r.MetadataJson,
        CreatedUtc = r.CreatedUtc
    };

    private sealed record ItemRow(
        Guid Id,
        Guid HouseholdId,
        int Kind,
        Guid WorkId,
        Guid? EditionId,
        string Title,
        string? Subtitle,
        string? Notes,
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
        string? MetadataJson,
        DateTimeOffset CreatedUtc);

    private sealed record ItemFullRow(
        Guid ItemId,
        Guid HouseholdId,
        int Kind,
        string Title,
        string? Subtitle,
        string? Notes,
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
        string? ItemMetadataJson,
        DateTimeOffset ItemCreatedUtc,
        Guid WorkId,
        string WorkTitle,
        string? WorkSubtitle,
        string? SortTitle,
        string? WorkDescription,
        string? OriginalTitle,
        string? WorkLanguage,
        string? WorkMetadataJson,
        DateTimeOffset WorkCreatedUtc,
        Guid? EditionId,
        string? EditionTitle,
        string? EditionSubtitle,
        string? Publisher,
        int? PublishedYear,
        int? PageCount,
        string? EditionDescription,
        string? CoverImageUrl,
        string? Format,
        string? Binding,
        string? EditionStatement,
        string? PlaceOfPublication,
        string? EditionLanguage,
        string? EditionMetadataJson,
        DateTimeOffset? EditionCreatedUtc);

    private sealed record ContributorRow(
        Guid PersonId,
        string DisplayName,
        string? SortName,
        int RoleId,
        string RoleName,
        int Ordinal,
        int? BirthYear,
        int? DeathYear);

    private sealed record TagRow(Guid TagId, string Name);

    private sealed record SubjectRow(Guid SubjectHeadingId, int SchemeId, string SchemeName, string Text);

    private sealed record IdentifierRow(int IdentifierTypeId, string IdentifierTypeName, string Value, bool IsPrimary);

    private sealed record SeriesRow(Guid SeriesId, string Name, string? VolumeNumber, int? Ordinal);
}
