using System.Data;
using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class WorkMetadataRepository : IWorkMetadataRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public WorkMetadataRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task AddContributorAsync(WorkId workId, Person person, ContributorRoleId roleId, int ordinal, CancellationToken ct)
    {
        const string ensurePersonSql = """
            if not exists (select 1 from dbo.Person where Id = @Id)
            begin
                insert into dbo.Person (Id, DisplayName, SortName, BirthYear, DeathYear, CreatedUtc)
                values (@Id, @DisplayName, @SortName, @BirthYear, @DeathYear, @CreatedUtc);
            end
            """;

        const string insertSql = """
            insert into dbo.WorkContributor (WorkId, PersonId, RoleId, Ordinal)
            values (@WorkId, @PersonId, @RoleId, @Ordinal);
            """;

        using var conn = _connectionFactory.Create();
        if (conn.State != ConnectionState.Open)
            conn.Open();

        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync(new CommandDefinition(ensurePersonSql, new
        {
            Id = person.Id.Value,
            person.DisplayName,
            person.SortName,
            person.BirthYear,
            person.DeathYear,
            person.CreatedUtc
        }, transaction: tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(insertSql, new
        {
            WorkId = workId.Value,
            PersonId = person.Id.Value,
            RoleId = roleId.Value,
            Ordinal = ordinal
        }, transaction: tx, cancellationToken: ct));

        tx.Commit();
    }

    public async Task AddTagAsync(WorkId workId, HouseholdId householdId, string tagName, CancellationToken ct)
    {
        var normalized = NormalizeKey(tagName);

        const string upsertTagSql = """
            declare @TagId uniqueidentifier;

            select @TagId = Id
            from dbo.Tag
            where HouseholdId = @HouseholdId
              and NormalizedName = @NormalizedName;

            if @TagId is null
            begin
                set @TagId = newid();
                insert into dbo.Tag (Id, HouseholdId, Name, NormalizedName)
                values (@TagId, @HouseholdId, @Name, @NormalizedName);
            end

            select @TagId;
            """;

        const string linkSql = """
            if not exists (select 1 from dbo.WorkTag where WorkId = @WorkId and TagId = @TagId)
                insert into dbo.WorkTag (WorkId, TagId) values (@WorkId, @TagId);
            """;

        using var conn = _connectionFactory.Create();
        if (conn.State != ConnectionState.Open)
            conn.Open();

        using var tx = conn.BeginTransaction();

        var tagId = await conn.ExecuteScalarAsync<Guid>(new CommandDefinition(upsertTagSql, new
        {
            HouseholdId = householdId.Value,
            Name = tagName.Trim(),
            NormalizedName = normalized
        }, transaction: tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(linkSql, new
        {
            WorkId = workId.Value,
            TagId = tagId
        }, transaction: tx, cancellationToken: ct));

        tx.Commit();
    }

    public async Task AddSubjectAsync(WorkId workId, SubjectSchemeId schemeId, string text, CancellationToken ct)
    {
        var normalized = NormalizeKey(text);

        const string upsertSql = """
            declare @SubjectId uniqueidentifier;

            select @SubjectId = Id
            from dbo.SubjectHeading
            where SchemeId = @SchemeId
              and NormalizedText = @NormalizedText;

            if @SubjectId is null
            begin
                set @SubjectId = newid();
                insert into dbo.SubjectHeading (Id, SchemeId, Text, NormalizedText)
                values (@SubjectId, @SchemeId, @Text, @NormalizedText);
            end

            select @SubjectId;
            """;

        const string linkSql = """
            if not exists (select 1 from dbo.WorkSubject where WorkId = @WorkId and SubjectHeadingId = @SubjectId)
                insert into dbo.WorkSubject (WorkId, SubjectHeadingId) values (@WorkId, @SubjectId);
            """;

        using var conn = _connectionFactory.Create();
        if (conn.State != ConnectionState.Open)
            conn.Open();

        using var tx = conn.BeginTransaction();

        var subjectId = await conn.ExecuteScalarAsync<Guid>(new CommandDefinition(upsertSql, new
        {
            SchemeId = schemeId.Value,
            Text = text.Trim(),
            NormalizedText = normalized
        }, transaction: tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(linkSql, new
        {
            WorkId = workId.Value,
            SubjectId = subjectId
        }, transaction: tx, cancellationToken: ct));

        tx.Commit();
    }

    public async Task AddEditionIdentifierAsync(EditionId editionId, IdentifierTypeId typeId, string value, bool isPrimary, CancellationToken ct)
        {
            var normalized = NormalizeIdentifierValue(value);

            const string sql = """
                if not exists (
                    select 1
                    from dbo.EditionIdentifier
                    where EditionId = @EditionId
                      and IdentifierTypeId = @IdentifierTypeId
                      and NormalizedValue = @NormalizedValue
                )
                begin
                    insert into dbo.EditionIdentifier (EditionId, IdentifierTypeId, Value, NormalizedValue, IsPrimary)
                    values (@EditionId, @IdentifierTypeId, @Value, @NormalizedValue, @IsPrimary);
                end
                """;

            using var conn = _connectionFactory.Create();
            await conn.ExecuteAsync(new CommandDefinition(sql, new
            {
                EditionId = editionId.Value,
                IdentifierTypeId = typeId.Value,
                Value = value.Trim(),
                NormalizedValue = normalized,
                IsPrimary = isPrimary
            }, cancellationToken: ct));
        }

        public async Task AddSeriesAsync(WorkId workId, string seriesName, string? volumeNumber, int? ordinal, CancellationToken ct)
        {
            var normalized = NormalizeKey(seriesName);

            const string upsertSeriesSql = """
                declare @SeriesId uniqueidentifier;

                select @SeriesId = Id
                from dbo.Series
                where NormalizedName = @NormalizedName;

                if @SeriesId is null
                begin
                    set @SeriesId = newid();
                    insert into dbo.Series (Id, Name, NormalizedName, CreatedUtc)
                    values (@SeriesId, @Name, @NormalizedName, sysdatetimeoffset());
                end

                select @SeriesId;
                """;

            const string linkSql = """
                if not exists (select 1 from dbo.WorkSeries where WorkId = @WorkId and SeriesId = @SeriesId)
                    insert into dbo.WorkSeries (WorkId, SeriesId, VolumeNumber, Ordinal)
                    values (@WorkId, @SeriesId, @VolumeNumber, @Ordinal);
                """;

            using var conn = _connectionFactory.Create();
            if (conn.State != System.Data.ConnectionState.Open)
                conn.Open();

            using var tx = conn.BeginTransaction();

            var seriesId = await conn.ExecuteScalarAsync<Guid>(new CommandDefinition(upsertSeriesSql, new
            {
                Name = seriesName.Trim(),
                NormalizedName = normalized
            }, transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(linkSql, new
            {
                WorkId = workId.Value,
                SeriesId = seriesId,
                VolumeNumber = volumeNumber,
                Ordinal = ordinal
            }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }

        private static string NormalizeKey(string value)
            => string.Join(' ', value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();

        private static string NormalizeIdentifierValue(string value)
            => new string(value.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

    public async Task ReplaceContributorsAsync(WorkId workId, IReadOnlyList<(Person Person, ContributorRoleId RoleId, int Ordinal)> contributors, CancellationToken ct)
    {
        using var conn = _connectionFactory.Create();
        if (conn.State != ConnectionState.Open)
            conn.Open();
        using var tx = conn.BeginTransaction();

        // Remove existing contributors
        await conn.ExecuteAsync(new CommandDefinition(
            "delete from dbo.WorkContributor where WorkId = @WorkId;",
            new { WorkId = workId.Value }, transaction: tx, cancellationToken: ct));

        // Re-add
        foreach (var c in contributors)
        {
            const string ensurePersonSql = """
                if not exists (select 1 from dbo.Person where Id = @Id)
                begin
                    insert into dbo.Person (Id, DisplayName, SortName, BirthYear, DeathYear, CreatedUtc)
                    values (@Id, @DisplayName, @SortName, @BirthYear, @DeathYear, @CreatedUtc);
                end
                else
                begin
                    update dbo.Person set DisplayName = @DisplayName, SortName = @SortName where Id = @Id;
                end
                """;

            await conn.ExecuteAsync(new CommandDefinition(ensurePersonSql, new
            {
                Id = c.Person.Id.Value,
                c.Person.DisplayName,
                c.Person.SortName,
                c.Person.BirthYear,
                c.Person.DeathYear,
                c.Person.CreatedUtc
            }, transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                "insert into dbo.WorkContributor (WorkId, PersonId, RoleId, Ordinal) values (@WorkId, @PersonId, @RoleId, @Ordinal);",
                new { WorkId = workId.Value, PersonId = c.Person.Id.Value, RoleId = c.RoleId.Value, Ordinal = c.Ordinal },
                transaction: tx, cancellationToken: ct));
        }

        tx.Commit();
    }

    public async Task ReplaceSubjectsAsync(WorkId workId, IReadOnlyList<(SubjectSchemeId SchemeId, string Text)> subjects, CancellationToken ct)
    {
        using var conn = _connectionFactory.Create();
        if (conn.State != ConnectionState.Open)
            conn.Open();
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync(new CommandDefinition(
            "delete from dbo.WorkSubject where WorkId = @WorkId;",
            new { WorkId = workId.Value }, transaction: tx, cancellationToken: ct));

        // Dedup by (SchemeId, NormalizedText) to prevent PK violations on WorkSubject
        var insertedSubjectIds = new HashSet<Guid>();
        foreach (var s in subjects)
        {
            if (string.IsNullOrWhiteSpace(s.Text)) continue;

            var normalized = NormalizeKey(s.Text);
            var subjectId = await conn.ExecuteScalarAsync<Guid>(new CommandDefinition("""
                declare @SubjectId uniqueidentifier;
                select @SubjectId = Id from dbo.SubjectHeading where SchemeId = @SchemeId and NormalizedText = @NormalizedText;
                if @SubjectId is null
                begin
                    set @SubjectId = newid();
                    insert into dbo.SubjectHeading (Id, SchemeId, Text, NormalizedText) values (@SubjectId, @SchemeId, @Text, @NormalizedText);
                end
                select @SubjectId;
                """,
                new { SchemeId = s.SchemeId.Value, Text = s.Text.Trim(), NormalizedText = normalized },
                transaction: tx, cancellationToken: ct));

            // Skip if this SubjectHeadingId was already linked (dedup across casing differences)
            if (!insertedSubjectIds.Add(subjectId)) continue;

            await conn.ExecuteAsync(new CommandDefinition(
                "insert into dbo.WorkSubject (WorkId, SubjectHeadingId) values (@WorkId, @SubjectId);",
                new { WorkId = workId.Value, SubjectId = subjectId },
                transaction: tx, cancellationToken: ct));
        }

        tx.Commit();
    }

    public async Task ReplaceIdentifiersAsync(EditionId editionId, IReadOnlyList<(IdentifierTypeId TypeId, string Value, bool IsPrimary)> identifiers, CancellationToken ct)
    {
        using var conn = _connectionFactory.Create();
        if (conn.State != ConnectionState.Open)
            conn.Open();
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync(new CommandDefinition(
            "delete from dbo.EditionIdentifier where EditionId = @EditionId;",
            new { EditionId = editionId.Value }, transaction: tx, cancellationToken: ct));

        // Dedup by (TypeId, Value) and truncate values to fit nvarchar(50)
        var insertedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var i in identifiers)
        {
            if (string.IsNullOrWhiteSpace(i.Value)) continue;

            var trimmedValue = i.Value.Trim();
            if (trimmedValue.Length > 50) trimmedValue = trimmedValue[..50];

            var dedupeKey = $"{i.TypeId.Value}:{trimmedValue.ToUpperInvariant()}";
            if (!insertedKeys.Add(dedupeKey)) continue;

            var normalized = NormalizeIdentifierValue(trimmedValue);
            if (normalized.Length > 50) normalized = normalized[..50];

            await conn.ExecuteAsync(new CommandDefinition(
                "insert into dbo.EditionIdentifier (EditionId, IdentifierTypeId, Value, NormalizedValue, IsPrimary) values (@EditionId, @IdentifierTypeId, @Value, @NormalizedValue, @IsPrimary);",
                new { EditionId = editionId.Value, IdentifierTypeId = i.TypeId.Value, Value = trimmedValue, NormalizedValue = normalized, IsPrimary = i.IsPrimary },
                transaction: tx, cancellationToken: ct));
        }

        tx.Commit();
    }

    public async Task ReplaceSeriesAsync(WorkId workId, string? seriesName, string? volumeNumber, int? ordinal, CancellationToken ct)
    {
        using var conn = _connectionFactory.Create();
        if (conn.State != ConnectionState.Open)
            conn.Open();
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync(new CommandDefinition(
            "delete from dbo.WorkSeries where WorkId = @WorkId;",
            new { WorkId = workId.Value }, transaction: tx, cancellationToken: ct));

        if (!string.IsNullOrWhiteSpace(seriesName))
        {
            var normalized = NormalizeKey(seriesName);
            var seriesId = await conn.ExecuteScalarAsync<Guid>(new CommandDefinition("""
                declare @SeriesId uniqueidentifier;
                select @SeriesId = Id from dbo.Series where NormalizedName = @NormalizedName;
                if @SeriesId is null
                begin
                    set @SeriesId = newid();
                    insert into dbo.Series (Id, Name, NormalizedName, CreatedUtc) values (@SeriesId, @Name, @NormalizedName, sysdatetimeoffset());
                end
                select @SeriesId;
                """,
                new { Name = seriesName.Trim(), NormalizedName = normalized },
                transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                "insert into dbo.WorkSeries (WorkId, SeriesId, VolumeNumber, Ordinal) values (@WorkId, @SeriesId, @VolumeNumber, @Ordinal);",
                new { WorkId = workId.Value, SeriesId = seriesId, VolumeNumber = volumeNumber, Ordinal = ordinal },
                transaction: tx, cancellationToken: ct));
        }

        tx.Commit();
    }
    }
