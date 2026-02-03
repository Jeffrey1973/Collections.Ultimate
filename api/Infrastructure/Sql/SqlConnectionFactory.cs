using System.Data;
using Microsoft.Data.SqlClient;

namespace CollectionsUltimate.Infrastructure.Sql;

public sealed class SqlConnectionFactory
{
    private readonly string _connectionString;

    public SqlConnectionFactory(string connectionString)
    {
        _connectionString = connectionString;
    }

    public IDbConnection Create() => new SqlConnection(_connectionString);
}
