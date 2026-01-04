using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class EditionLookupRepository : IEditionLookupRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public EditionLookupRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<EditionId?> FindEditionByIdentifierAsync(IdentifierTypeId typeId, string normalizedValue, CancellationToken ct)
    {
        const string sql = """
            select top (1) EditionId
            from dbo.EditionIdentifiers
            where IdentifierTypeId = @IdentifierTypeId
              and NormalizedValue = @NormalizedValue;
            """;

        using var conn = _connectionFactory.Create();
        var id = await conn.QuerySingleOrDefaultAsync<Guid?>(new CommandDefinition(sql, new
        {
            IdentifierTypeId = typeId.Value,
            NormalizedValue = normalizedValue
        }, cancellationToken: ct));

        return id is null ? null : new EditionId(id.Value);
    }
}
