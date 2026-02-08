using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class ItemUpdateRepository : IItemUpdateRepository
{
    private readonly SqlConnectionFactory _connectionFactory;

    public ItemUpdateRepository(SqlConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<bool> UpdateInventoryAsync(ItemId itemId, ItemInventoryPatch patch, CancellationToken ct)
    {
        const string sql = """
            update dbo.LibraryItem
            set
                Barcode = case when @Barcode_IsSpecified = 1 then @Barcode else Barcode end,
                Location = case when @Location_IsSpecified = 1 then @Location else Location end,
                Status = case when @Status_IsSpecified = 1 then @Status else Status end,
                Condition = case when @Condition_IsSpecified = 1 then @Condition else Condition end,
                AcquiredOn = case when @AcquiredOn_IsSpecified = 1 then @AcquiredOn else AcquiredOn end,
                Price = case when @Price_IsSpecified = 1 then @Price else Price end,
                Notes = case when @Notes_IsSpecified = 1 then @Notes else Notes end,
                ReadStatus = case when @ReadStatus_IsSpecified = 1 then @ReadStatus else ReadStatus end,
                CompletedDate = case when @CompletedDate_IsSpecified = 1 then @CompletedDate else CompletedDate end,
                DateStarted = case when @DateStarted_IsSpecified = 1 then @DateStarted else DateStarted end,
                UserRating = case when @UserRating_IsSpecified = 1 then @UserRating else UserRating end
            where Id = @Id;
            """;

        try
        {
            using var conn = _connectionFactory.Create();
            var affected = await conn.ExecuteAsync(new CommandDefinition(sql, new
            {
                Id = itemId.Value,

                Barcode_IsSpecified = patch.Barcode.IsSpecified ? 1 : 0,
                Barcode = NormalizeNullable(patch.Barcode.Value),

                Location_IsSpecified = patch.Location.IsSpecified ? 1 : 0,
                Location = NormalizeNullable(patch.Location.Value),

                Status_IsSpecified = patch.Status.IsSpecified ? 1 : 0,
                Status = NormalizeNullable(patch.Status.Value),

                Condition_IsSpecified = patch.Condition.IsSpecified ? 1 : 0,
                Condition = NormalizeNullable(patch.Condition.Value),

                AcquiredOn_IsSpecified = patch.AcquiredOn.IsSpecified ? 1 : 0,
                AcquiredOn = patch.AcquiredOn.Value is null ? (DateTime?)null : patch.AcquiredOn.Value.Value.ToDateTime(TimeOnly.MinValue),

                Price_IsSpecified = patch.Price.IsSpecified ? 1 : 0,
                Price = patch.Price.Value,

                Notes_IsSpecified = patch.Notes.IsSpecified ? 1 : 0,
                Notes = NormalizeNullable(patch.Notes.Value),

                ReadStatus_IsSpecified = patch.ReadStatus.IsSpecified ? 1 : 0,
                ReadStatus = NormalizeNullable(patch.ReadStatus.Value),

                CompletedDate_IsSpecified = patch.CompletedDate.IsSpecified ? 1 : 0,
                CompletedDate = NormalizeNullable(patch.CompletedDate.Value),

                DateStarted_IsSpecified = patch.DateStarted.IsSpecified ? 1 : 0,
                DateStarted = NormalizeNullable(patch.DateStarted.Value),

                UserRating_IsSpecified = patch.UserRating.IsSpecified ? 1 : 0,
                UserRating = patch.UserRating.Value
            }, cancellationToken: ct));

            return affected > 0;
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            throw new InvalidOperationException("Update violates a uniqueness constraint.", ex);
        }
    }

    private static string? NormalizeNullable(string? s)
    {
        if (string.IsNullOrWhiteSpace(s))
            return null;
        return s.Trim();
    }
}
