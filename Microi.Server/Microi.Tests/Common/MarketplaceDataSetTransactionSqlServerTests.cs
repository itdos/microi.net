using System.Data;
using System.Data.SqlClient;
using System.Text.RegularExpressions;
using Jint;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
[Trait("DatabaseProvider", "SqlServer")]
public sealed class MarketplaceDataSetTransactionSqlServerTests
{
    public static bool HasSqlServerTestConnection => !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Fact(Skip = "Requires an isolated SQL Server fixture", SkipUnless = nameof(HasSqlServerTestConnection))]
    public void LegacyMissingReadTransaction_BlocksSecondBusinessKeyQuery_AndRollsBack()
    {
        WithDatabase(fixture =>
        {
            var error = Assert.ThrowsAny<Exception>(() => fixture.Import(
                [Row("seed-a", "first"), Row("seed-b", "second")], legacyMissingReadTransaction: true));

            // 旧代码不是虚构失败：首行真实写入尚未提交，独立连接第二次扫描业务键被自身事务锁住。
            Assert.Contains("业务冲突键失败", error.ToString());
            Assert.Contains(1222, fixture.SqlErrors);
            Assert.Equal(1, fixture.Calls.Count(x => x.Operation == "Add"));
            Assert.Equal(2, fixture.Calls.Count(x => x.Operation == "Get" && x.Predicate == "ConfigKey"));
            Assert.All(fixture.Calls.Where(x => x.Operation == "Add"), x => Assert.True(x.Shared));
            Assert.All(fixture.Calls.Where(x => x.Operation == "Get" && x.Predicate == "ConfigKey"), x => Assert.False(x.Shared));
            Assert.Empty(fixture.ReadRows());
        });
    }

    [Fact(Skip = "Requires an isolated SQL Server fixture", SkipUnless = nameof(HasSqlServerTestConnection))]
    public void SharedTransaction_InsertsMultipleSeeds_AndReinstallCreatesNoDuplicates()
    {
        WithDatabase(fixture =>
        {
            var rows = new[] { Row("seed-a", "first"), Row("seed-b", "second"), Row("seed-c", "third") };
            var first = fixture.Import(rows);
            Assert.Equal(3, (int)first["DataInserted"]!);
            Assert.Equal(0, (int)first["DataSkipped"]!);

            var second = fixture.Import(rows);
            Assert.Equal(0, (int)second["DataInserted"]!);
            Assert.Equal(0, (int)second["DataUpdated"]!);
            Assert.Equal(3, (int)second["DataSkipped"]!);
            var stored = fixture.ReadRows();
            Assert.Equal(3, stored.Count);
            Assert.Equal(new[] { "first", "second", "third" }, stored.Select(x => (string)x["ConfigKey"]!).OrderBy(x => x).ToArray());
            Assert.All(stored, x => Assert.Equal("package-default", (string?)x["ConfigValue"]));
            Assert.Empty(fixture.SqlErrors);
            Assert.All(fixture.Calls, x => Assert.True(x.Shared, x.Operation + ":" + x.Predicate));
        });
    }

    [Fact(Skip = "Requires an isolated SQL Server fixture", SkipUnless = nameof(HasSqlServerTestConnection))]
    public void ExistingBusinessKeyWithDifferentId_PreservesValue_AndUpdatesOnlyDeclaredMetadata()
    {
        WithDatabase(fixture =>
        {
            fixture.Seed(Row("tenant-owned-id", "existing", "tenant-value", "old-category", "old-description", 7));
            var result = fixture.Import(
                [Row("official-different-id", "existing", "must-not-overwrite", "new-category", "new-description", 9)],
                updateMetadata: true);

            Assert.Equal(0, (int)result["DataInserted"]!);
            Assert.Equal(1, (int)result["DataUpdated"]!);
            var row = Assert.Single(fixture.ReadRows());
            Assert.Equal("tenant-owned-id", (string?)row["Id"]);
            Assert.Equal("tenant-value", (string?)row["ConfigValue"]);
            Assert.Equal("new-category", (string?)row["Category"]);
            Assert.Equal("new-description", (string?)row["Description"]);
            Assert.Equal(9, (int)row["Sort"]!);
            var update = Assert.Single(fixture.Calls.Where(x => x.Operation == "Update"));
            Assert.True(update.Shared);
            Assert.Equal("Category,Description,Sort", update.Predicate);
            Assert.Empty(fixture.SqlErrors);
            Assert.All(fixture.Calls, x => Assert.True(x.Shared));
        });
    }

    [Fact(Skip = "Requires an isolated SQL Server fixture", SkipUnless = nameof(HasSqlServerTestConnection))]
    public void RealQueryFailure_RollsBackInsertedSeedsAndPriorMetadataUpdate()
    {
        WithDatabase(fixture =>
        {
            fixture.Seed(Row("tenant-owned-id", "existing", "tenant-value", "old-category", "old-description", 7));
            var error = Assert.ThrowsAny<Exception>(() => fixture.Import(
                [Row("official-different-id", "existing", "must-not-overwrite", "new-category", "new-description", 9),
                 Row("seed-b", "new-seed"), Row("seed-c", "query-fault")],
                updateMetadata: true, failBusinessKey: "query-fault"));

            // 207 来自真实 SQL 无效列查询，安装器必须拒绝 Code=0；前序插入和展示元数据一起回滚。
            Assert.Contains("业务冲突键失败", error.ToString());
            Assert.Contains(207, fixture.SqlErrors);
            Assert.Equal(1, fixture.Calls.Count(x => x.Operation == "Add"));
            Assert.Equal(1, fixture.Calls.Count(x => x.Operation == "Update"));
            var row = Assert.Single(fixture.ReadRows());
            Assert.Equal("tenant-owned-id", (string?)row["Id"]);
            Assert.Equal("tenant-value", (string?)row["ConfigValue"]);
            Assert.Equal("old-category", (string?)row["Category"]);
            Assert.Equal("old-description", (string?)row["Description"]);
            Assert.Equal(7, (int)row["Sort"]!);
            Assert.All(fixture.Calls, x => Assert.True(x.Shared));
        });
    }

    private static JObject Row(string id, string key, string value = "package-default",
        string category = "package-category", string description = "package-description", int sort = 1) => new()
    {
        ["Id"] = id, ["ConfigKey"] = key, ["ConfigValue"] = value,
        ["Category"] = category, ["Description"] = description, ["Sort"] = sort
    };

    private static void WithDatabase(Action<SqlFixture> action)
    {
        var settings = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN")!);
        SqlServerFixtureGuard.Verify(settings);
        // 只复用通过持久归属标记的服务；每例库名是本例生成的 Guid，绝不写传入库或租户业务库。
        var databaseName = "microi_dataset_transaction_fixture_" + Guid.NewGuid().ToString("N");
        settings.InitialCatalog = "master";
        using var master = new SqlConnection(settings.ConnectionString);
        master.Open();
        using var create = new SqlCommand($"CREATE DATABASE [{databaseName}]", master) { CommandTimeout = 30 };
        create.ExecuteNonQuery();
        string? fixtureConnectionString = null;
        try
        {
            settings.InitialCatalog = databaseName;
            fixtureConnectionString = settings.ConnectionString;
            var fixture = new SqlFixture(fixtureConnectionString);
            fixture.CreateTable();
            action(fixture);
        }
        finally
        {
            // 各操作的 using 已释放连接，只清本夹具精确连接池；普通删除失败即报告，不强断未知连接。
            if (fixtureConnectionString != null)
            {
                using var poolConnection = new SqlConnection(fixtureConnectionString);
                SqlConnection.ClearPool(poolConnection);
            }
            using var drop = new SqlCommand($"DROP DATABASE [{databaseName}]", master) { CommandTimeout = 30 };
            drop.ExecuteNonQuery();
        }
    }

    private static string ReadDataSetBlock(bool legacyMissingReadTransaction)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        string? sourcePath = null;
        while (directory != null)
        {
            var candidate = Path.Combine(directory.FullName, "Microi.Server", "OfficialApplications", "Resource", "import-package.js");
            if (File.Exists(candidate)) { sourcePath = candidate; break; }
            directory = directory.Parent;
        }
        Assert.NotNull(sourcePath);
        var source = File.ReadAllText(sourcePath);
        var prerequisite = Regex.Match(source, @"function isEmptySharedTablePrerequisite\(dataSet\) \{[\s\S]*?\r?\n\}");
        Assert.True(prerequisite.Success, "Importer prerequisite must remain available");
        var start = source.IndexOf("    var packageDataSets = Package.DataSets", StringComparison.Ordinal);
        var end = source.IndexOf("    debugLog.step8Result = '随包数据处理完成", start, StringComparison.Ordinal);
        Assert.True(start >= 0 && end > start, "Actual DataSet importer boundaries must exist");
        var block = source[start..end];
        if (legacyMissingReadTransaction)
        {
            // 仅撤掉历史缺失的两处读取参数；其余导入器、真实写入和事务实现与修复用例完全相同。
            var idRead = "V8.FormEngine.GetFormData(dataTableName, { Id: String(sourceRow.Id) }, V8.DbTrans)";
            Assert.Contains(idRead, block);
            block = block.Replace(idRead, "V8.FormEngine.GetFormData(dataTableName, { Id: String(sourceRow.Id) })", StringComparison.Ordinal);
            var businessRead = new Regex(@"(var existingByConflict = V8\.FormEngine\.GetFormData\(dataTableName, \{[\s\S]*?\}), V8\.DbTrans\);");
            Assert.Single(businessRead.Matches(block).Cast<Match>());
            block = businessRead.Replace(block, "$1);", 1);
        }
        return prerequisite.Value + "\n" + block;
    }

    public sealed record BridgeCall(string Operation, bool Shared, string Predicate);

    private sealed class SqlFixture(string connectionString)
    {
        public List<BridgeCall> Calls { get; } = [];
        public List<int> SqlErrors { get; } = [];

        public void CreateTable()
        {
            using var connection = new SqlConnection(connectionString);
            connection.Open();
            using var command = new SqlCommand("""
                CREATE TABLE dbo.dataset_seed (
                    Id nvarchar(100) NOT NULL CONSTRAINT PK_dataset_seed PRIMARY KEY CLUSTERED,
                    ConfigKey nvarchar(100) NOT NULL,
                    ConfigValue nvarchar(200) NULL,
                    Category nvarchar(100) NULL,
                    Description nvarchar(200) NULL,
                    Sort int NOT NULL DEFAULT 0
                )
                """, connection);
            command.ExecuteNonQuery();
        }

        public void Seed(JObject row)
        {
            using var connection = new SqlConnection(connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction(IsolationLevel.ReadCommitted);
            var bridge = new FormBridge(connectionString, connection, transaction, [], []);
            Assert.Equal(1, (int)JObject.Parse(bridge.AddFormData("dataset_seed", row.ToString(Formatting.None), true))["Code"]!);
            transaction.Commit();
        }

        public JObject Import(JObject[] rows, bool legacyMissingReadTransaction = false, bool updateMetadata = false, string? failBusinessKey = null)
        {
            var package = new JObject
            {
                ["DataSets"] = new JArray(new JObject
                {
                    ["TableName"] = "dataset_seed", ["ConflictPolicy"] = "InsertIfMissing",
                    ["ConflictFields"] = new JArray("ConfigKey"),
                    ["MetadataFieldsIfExists"] = updateMetadata ? new JArray("Category", "Description", "Sort") : new JArray(),
                    ["Rows"] = new JArray(rows)
                })
            };
            using var connection = new SqlConnection(connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction(IsolationLevel.ReadCommitted);
            var bridge = new FormBridge(connectionString, connection, transaction, Calls, SqlErrors) { FailBusinessKey = failBusinessKey };
            using var engine = new Engine().SetValue("bridge", bridge).SetValue("packageJson", package.ToString(Formatting.None));
            engine.Execute("""
                var Package = JSON.parse(packageJson);
                var stats = { DataSkipped: 0, DataUpdated: 0, DataInserted: 0, DataSetCount: 0 };
                var debugLog = {}, reportProgress = function() {};
                var remapPackageDataRowReferences = function(table, row) { return JSON.parse(JSON.stringify(row)); };
                var V8 = { OsClient: 'dataset-fixture', DbTrans: {}, FormEngine: {} };
                ['GetFormData', 'GetTableData', 'AddFormData', 'UptFormData'].forEach(function(method) {
                    V8.FormEngine[method] = function(table, args, trans) {
                        return JSON.parse(bridge[method](table, JSON.stringify(args), trans === V8.DbTrans));
                    };
                });
                """);
            try
            {
                engine.Execute(ReadDataSetBlock(legacyMissingReadTransaction));
                var result = JObject.Parse(engine.Evaluate("JSON.stringify(stats)").AsString());
                transaction.Commit();
                return result;
            }
            catch
            {
                // 复现接口引擎安装事务的失败边界，不能让只完成的前半段配置种子独立提交。
                transaction.Rollback();
                throw;
            }
        }

        public JArray ReadRows()
        {
            using var connection = new SqlConnection(connectionString);
            connection.Open();
            using var command = new SqlCommand("SELECT Id,ConfigKey,ConfigValue,Category,Description,Sort FROM dbo.dataset_seed ORDER BY Id", connection);
            using var reader = command.ExecuteReader();
            var rows = new JArray();
            while (reader.Read()) rows.Add(ReadRow(reader));
            return rows;
        }
    }

    // 只有平台表/字段元数据使用固定夹具；业务 Get/Add/Upt 均经真实参数化 SQL，第三参身份选择连接。
    public sealed class FormBridge(string connectionString, SqlConnection connection, SqlTransaction transaction,
        List<BridgeCall> calls, List<int> errors)
    {
        private static readonly string[] Columns = ["Id", "ConfigKey", "ConfigValue", "Category", "Description", "Sort"];
        public string? FailBusinessKey { get; init; }

        public string GetTableData(string table, string json, bool shared)
        {
            Assert.Equal("diy_field", table);
            calls.Add(new("Fields", shared, "AutoNumber"));
            return new JObject { ["Code"] = 1, ["Data"] = new JArray(), ["DataCount"] = 0 }.ToString(Formatting.None);
        }

        public string GetFormData(string table, string json, bool shared)
        {
            var args = JObject.Parse(json);
            if (table == "diy_table")
            {
                calls.Add(new("Table", shared, "dataset_seed"));
                return Result(1, new JObject { ["Id"] = "fixture-table", ["Name"] = "dataset_seed" });
            }
            Assert.Equal("dataset_seed", table);
            var byId = args["Id"] != null;
            var field = byId ? "Id" : (string?)args["_Where"]?[0]?[0];
            Assert.Contains(field, new[] { "Id", "ConfigKey" });
            var value = byId ? args["Id"] : args["_Where"]![0]![2];
            calls.Add(new("Get", shared, field!));
            return Execute(shared, (activeConnection, activeTransaction) =>
            {
                // Id 的精确索引查重与未索引业务键扫描分开，稳定复现第二个 ConfigKey 的历史自锁。
                var hints = byId ? "INDEX(PK_dataset_seed), FORCESEEK, READCOMMITTEDLOCK" : "FORCESCAN, READCOMMITTEDLOCK";
                var selected = !byId && (string?)value == FailBusinessKey ? "MissingFixtureColumn" : string.Join(',', Columns);
                using var command = new SqlCommand($"SELECT TOP(1) {selected} FROM dbo.dataset_seed WITH ({hints}) WHERE [{field}]=@value", activeConnection, activeTransaction) { CommandTimeout = 5 };
                command.Parameters.AddWithValue("@value", (string?)value ?? "");
                using var reader = command.ExecuteReader();
                return reader.Read() ? Result(1, ReadRow(reader)) : Result(2);
            });
        }

        public string AddFormData(string table, string json, bool shared)
        {
            Assert.Equal("dataset_seed", table);
            var row = JObject.Parse(json);
            calls.Add(new("Add", shared, (string?)row["ConfigKey"] ?? ""));
            return Execute(shared, (activeConnection, activeTransaction) =>
            {
                using var command = new SqlCommand("INSERT INTO dbo.dataset_seed(Id,ConfigKey,ConfigValue,Category,Description,Sort) VALUES(@Id,@ConfigKey,@ConfigValue,@Category,@Description,@Sort)", activeConnection, activeTransaction) { CommandTimeout = 5 };
                foreach (var field in Columns) AddParameter(command, field, row[field]);
                command.ExecuteNonQuery();
                return Result(1, row);
            });
        }

        public string UptFormData(string table, string json, bool shared)
        {
            Assert.Equal("dataset_seed", table);
            var row = JObject.Parse(json);
            var fields = Columns.Where(x => x != "Id" && row[x] != null).ToArray();
            calls.Add(new("Update", shared, string.Join(',', fields)));
            Assert.NotEmpty(fields);
            return Execute(shared, (activeConnection, activeTransaction) =>
            {
                using var command = new SqlCommand("UPDATE dbo.dataset_seed SET " + string.Join(',', fields.Select(x => "[" + x + "]=@" + x)) + " WHERE Id=@Id", activeConnection, activeTransaction) { CommandTimeout = 5 };
                foreach (var field in fields.Append("Id")) AddParameter(command, field, row[field]);
                return Result(command.ExecuteNonQuery() == 1 ? 1 : 2);
            });
        }

        private string Execute(bool shared, Func<SqlConnection, SqlTransaction?, string> action)
        {
            SqlConnection? independent = null;
            try
            {
                var activeConnection = connection;
                SqlTransaction? activeTransaction = transaction;
                if (!shared)
                {
                    independent = new SqlConnection(connectionString);
                    independent.Open();
                    activeConnection = independent;
                    activeTransaction = null;
                }
                using var timeout = new SqlCommand("SET LOCK_TIMEOUT 500", activeConnection, activeTransaction) { CommandTimeout = 5 };
                timeout.ExecuteNonQuery();
                return action(activeConnection, activeTransaction);
            }
            catch (SqlException exception)
            {
                errors.Add(exception.Number);
                return new JObject { ["Code"] = 0, ["Msg"] = "SQL fixture error " + exception.Number }.ToString(Formatting.None);
            }
            finally
            {
                independent?.Dispose();
            }
        }

        private static void AddParameter(SqlCommand command, string name, JToken? value) =>
            command.Parameters.AddWithValue("@" + name, value is JValue scalar ? scalar.Value ?? DBNull.Value : DBNull.Value);
    }

    private static string Result(int code, JObject? data = null) => new JObject { ["Code"] = code, ["Data"] = data }.ToString(Formatting.None);

    private static JObject ReadRow(SqlDataReader reader)
    {
        var row = new JObject();
        for (var i = 0; i < reader.FieldCount; i++)
            row[reader.GetName(i)] = reader.IsDBNull(i) ? JValue.CreateNull() : JToken.FromObject(reader.GetValue(i));
        return row;
    }
}
