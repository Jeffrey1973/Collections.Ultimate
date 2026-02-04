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
    }
