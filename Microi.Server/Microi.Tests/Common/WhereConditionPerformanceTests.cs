using System.Data.Common;
using System.Reflection;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection(MicroiEngineWhereConditionCollection.Name)]
public sealed class WhereConditionPerformanceTests : IDisposable
{
    private static readonly FieldInfo ServiceProviderField = typeof(MicroiEngine)
        .GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("MicroiEngine service-provider field was not found.");

    private readonly object? _previousServiceProvider;

    public WhereConditionPerformanceTests()
    {
        _previousServiceProvider = ServiceProviderField.GetValue(null);
        ServiceProviderField.SetValue(null, new WhereConditionTestServiceProvider());
    }

    public void Dispose()
    {
        ServiceProviderField.SetValue(null, _previousServiceProvider);
    }

    [Fact]
    public async Task GetWhereSql_IsSynchronousCaseInsensitiveAndParameterized()
    {
        var session = CreateSession();
        var parameters = new List<DbParameter>();
        var fields = new List<JObject>
        {
            new()
            {
                ["Name"] = JValue.CreateNull(),
                ["TableId"] = "main"
            },
            new()
            {
                ["Name"] = "DisplayName",
                ["Type"] = "varchar",
                ["TableId"] = "main"
            }
        };
        var where = new List<DiyWhere>
        {
            new() { Name = "displayname", Type = "LIKE", Value = "Alice" },
            new() { Name = "isdeleted", Type = "=", Value = 0, AndOr = "and" }
        };

        var task = new WhereCondition().GetWhereSql(
            where,
            fields,
            new List<DiyTable>(),
            CreateDbInfo(),
            parameters,
            session,
            "UPDATE");

        Assert.True(task.IsCompletedSuccessfully);
        var sql = await task;
        Assert.Contains("DisplayName", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("IsDeleted", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("A.", sql, StringComparison.Ordinal);
        Assert.Equal(2, parameters.Count);
        Assert.Contains(parameters, item => Equals(item.Value, "%Alice%"));
        Assert.Contains(parameters, item => string.Equals(
            Convert.ToString(item.Value, System.Globalization.CultureInfo.InvariantCulture),
            "0",
            StringComparison.Ordinal));
    }

    [Fact]
    public async Task GetWhereSql_FormEngineKeyToleratesSparseMetadata()
    {
        var session = CreateSession();
        var parameters = new List<DbParameter>();
        var fields = new List<JObject>
        {
            new()
            {
                ["Name"] = "Code",
                ["Type"] = "varchar",
                ["TableId"] = "table-1",
                ["TableName"] = JValue.CreateNull()
            }
        };
        var where = new List<DiyWhere>
        {
            new()
            {
                FormEngineKey = "TABLE-1",
                Name = "code",
                Type = "Equal",
                Value = "A-001"
            }
        };

        var sql = await new WhereCondition().GetWhereSql(
            where,
            fields,
            new List<DiyTable>(),
            CreateDbInfo(),
            parameters,
            session);

        Assert.Contains("A.", sql, StringComparison.Ordinal);
        Assert.Single(parameters);
        Assert.Equal("A-001", parameters[0].Value);
    }

    [Fact]
    public async Task GetWhereSql_RejectsMissingExecutionDependencies()
    {
        var session = CreateSession();
        var dbInfo = CreateDbInfo();
        var parameters = new List<DbParameter>();
        var where = new List<DiyWhere>
        {
            new() { Name = "Id", Type = "=", Value = "1" }
        };

        Assert.Equal(
            string.Empty,
            await new WhereCondition().GetWhereSql(
                new List<DiyWhere>(), null, null, null, null, null));
        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            new WhereCondition().GetWhereSql(where, null, null, null, parameters, session));
        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            new WhereCondition().GetWhereSql(where, null, null, dbInfo, null, session));
        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            new WhereCondition().GetWhereSql(where, null, null, dbInfo, parameters, null));
    }

    private static DbSession CreateSession()
    {
        return new DbSession(
            DatabaseType.MySql,
            "Server=127.0.0.1;Database=microi_where_test;Uid=test;Pwd=test;");
    }

    private static DbInfo CreateDbInfo()
    {
        return new DbInfo
        {
            L = '`',
            R = '`',
            P = '@',
            DbType = DatabaseType.MySql
        };
    }

    private sealed class WhereConditionTestServiceProvider : IServiceProvider
    {
        private static readonly IDbFactory DbFactory = new WhereConditionTestDbFactory();

        public object? GetService(Type serviceType)
        {
            return serviceType == typeof(IDbFactory) ? DbFactory : null;
        }
    }

    private sealed class WhereConditionTestDbFactory : IDbFactory
    {
        private static readonly IMicroiORM MySql = new MySqlService();

        public IMicroiORM Create(DatabaseType dbType)
        {
            return dbType == DatabaseType.MySql
                ? MySql
                : throw new ArgumentOutOfRangeException(nameof(dbType), dbType, "Unsupported test database type.");
        }
    }
}

[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class MicroiEngineWhereConditionCollection
{
    public const string Name = "MicroiEngine.WhereCondition serial tests";
}
