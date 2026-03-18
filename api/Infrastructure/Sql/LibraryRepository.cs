using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class LibraryRepository : ILibraryRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public LibraryRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Library?> GetByIdAsync(LibraryId id, CancellationToken ct)
    {
        const string sql = """
            SELECT Id, HouseholdId, Name, Description, IsDefault, CreatedUtc
            FROM dbo.Library
            WHERE Id = @Id
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<LibraryRow>(
            new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<Library>> ListByHouseholdAsync(HouseholdId householdId, CancellationToken ct)
    {
        const string sql = """
            SELECT Id, HouseholdId, Name, Description, IsDefault, CreatedUtc
            FROM dbo.Library
            WHERE HouseholdId = @HouseholdId
            ORDER BY IsDefault DESC, Name
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<LibraryRow>(
            new CommandDefinition(sql, new { HouseholdId = householdId.Value }, cancellationToken: ct));
        return rows.Select(Map).ToList();
    }

    public async Task<Library?> GetDefaultAsync(HouseholdId householdId, CancellationToken ct)
    {
        const string sql = """
            SELECT TOP 1 Id, HouseholdId, Name, Description, IsDefault, CreatedUtc
            FROM dbo.Library
            WHERE HouseholdId = @HouseholdId AND IsDefault = 1
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<LibraryRow>(
            new CommandDefinition(sql, new { HouseholdId = householdId.Value }, cancellationToken: ct));
        return row is null ? null : Map(row);
    }

    public async Task CreateAsync(Library library, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.Library (Id, HouseholdId, Name, Description, IsDefault, CreatedUtc)
            VALUES (@Id, @HouseholdId, @Name, @Description, @IsDefault, @CreatedUtc)
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = library.Id.Value,
            HouseholdId = library.HouseholdId.Value,
            library.Name,
            library.Description,
            library.IsDefault,
            library.CreatedUtc
        }, cancellationToken: ct));
    }

    public async Task UpdateAsync(LibraryId id, string name, string? description, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.Library
            SET Name = @Name, Description = @Description
            WHERE Id = @Id
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = id.Value,
            Name = name,
            Description = description
        }, cancellationToken: ct));
    }

    public async Task DeleteAsync(LibraryId id, CancellationToken ct)
    {
        const string sql = "DELETE FROM dbo.Library WHERE Id = @Id AND IsDefault = 0";

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = id.Value }, cancellationToken: ct));
    }

    // ─── Members ──────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<LibraryMemberDetail>> ListMembersAsync(LibraryId libraryId, CancellationToken ct)
    {
        const string sql = """
            SELECT
                lm.AccountId,
                a.DisplayName,
                a.FirstName,
                a.LastName,
                a.Email,
                lm.Role,
                lm.CreatedUtc AS JoinedUtc
            FROM dbo.LibraryMember lm
            INNER JOIN dbo.Account a ON a.Id = lm.AccountId
            WHERE lm.LibraryId = @LibraryId
            ORDER BY lm.CreatedUtc
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<LibraryMemberDetail>(
            new CommandDefinition(sql, new { LibraryId = libraryId.Value }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task AddMemberAsync(LibraryId libraryId, AccountId accountId, string role, CancellationToken ct)
    {
        const string sql = """
            IF NOT EXISTS (SELECT 1 FROM dbo.LibraryMember WHERE LibraryId = @LibraryId AND AccountId = @AccountId)
                INSERT INTO dbo.LibraryMember (LibraryId, AccountId, Role)
                VALUES (@LibraryId, @AccountId, @Role)
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            LibraryId = libraryId.Value,
            AccountId = accountId.Value,
            Role = role
        }, cancellationToken: ct));
    }

    public async Task UpdateMemberRoleAsync(LibraryId libraryId, AccountId accountId, string role, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.LibraryMember
            SET Role = @Role
            WHERE LibraryId = @LibraryId AND AccountId = @AccountId
            """;

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            LibraryId = libraryId.Value,
            AccountId = accountId.Value,
            Role = role
        }, cancellationToken: ct));
    }

    public async Task RemoveMemberAsync(LibraryId libraryId, AccountId accountId, CancellationToken ct)
    {
        const string sql = "DELETE FROM dbo.LibraryMember WHERE LibraryId = @LibraryId AND AccountId = @AccountId";

        using var conn = _connectionFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            LibraryId = libraryId.Value,
            AccountId = accountId.Value
        }, cancellationToken: ct));
    }

    public async Task<LibraryMember?> GetMemberAsync(LibraryId libraryId, AccountId accountId, CancellationToken ct)
    {
        const string sql = """
            SELECT LibraryId, AccountId, Role, CreatedUtc
            FROM dbo.LibraryMember
            WHERE LibraryId = @LibraryId AND AccountId = @AccountId
            """;

        using var conn = _connectionFactory.Create();
        var row = await conn.QuerySingleOrDefaultAsync<MemberRow>(
            new CommandDefinition(sql, new { LibraryId = libraryId.Value, AccountId = accountId.Value }, cancellationToken: ct));
        return row is null ? null : new LibraryMember(new LibraryId(row.LibraryId), new AccountId(row.AccountId), row.Role, row.CreatedUtc);
    }

    public async Task<IReadOnlyList<Library>> ListByAccountAsync(HouseholdId householdId, AccountId accountId, CancellationToken ct)
    {
        const string sql = """
            SELECT l.Id, l.HouseholdId, l.Name, l.Description, l.IsDefault, l.CreatedUtc
            FROM dbo.Library l
            INNER JOIN dbo.LibraryMember lm ON lm.LibraryId = l.Id
            WHERE l.HouseholdId = @HouseholdId AND lm.AccountId = @AccountId
            ORDER BY l.IsDefault DESC, l.Name
            """;

        using var conn = _connectionFactory.Create();
        var rows = await conn.QueryAsync<LibraryRow>(
            new CommandDefinition(sql, new { HouseholdId = householdId.Value, AccountId = accountId.Value }, cancellationToken: ct));
        return rows.Select(Map).ToList();
    }

    // ─── Mapping ──────────────────────────────────────────────────────────────

    private static Library Map(LibraryRow row) => new()
    {
        Id = new LibraryId(row.Id),
        HouseholdId = new HouseholdId(row.HouseholdId),
        Name = row.Name,
        Description = row.Description,
        IsDefault = row.IsDefault,
        CreatedUtc = row.CreatedUtc
    };

    private sealed class LibraryRow
    {
        public Guid Id { get; init; }
        public Guid HouseholdId { get; init; }
        public string Name { get; init; } = "";
        public string? Description { get; init; }
        public bool IsDefault { get; init; }
        public DateTimeOffset CreatedUtc { get; init; }
    }

    private sealed class MemberRow
    {
        public Guid LibraryId { get; init; }
        public Guid AccountId { get; init; }
        public string Role { get; init; } = "";
        public DateTimeOffset CreatedUtc { get; init; }
    }
}
