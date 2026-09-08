using System.Data.SqlClient;
using System.Reflection;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class SqlServerMenuCapacityTests
{
    [Theory]
    [InlineData("nvarchar", 100, 255, true, "nvarchar(255)", "NULL")]
    [InlineData("nvarchar", 500, 255, false, "nvarchar(255)", "NOT NULL")]
    [InlineData("varchar", 50, 255, false, "varchar(255)", "NOT NULL")]
    public void WideningUsesCharacterCapacityAndPreservesTypeCollationAndNullability(
        string type, int bytes, int required, bool nullable, string expectedType, string nullability)
    {
        var column = Column(type, bytes, nullable);
        Assert.Equal("ALTER TABLE [tenant].[sys_menu] ALTER COLUMN [SelectApi] " + expectedType
            + " COLLATE Chinese_PRC_CI_AS " + nullability,
            SqlServerStringColumnCapacity.BuildAlterSql("sys_menu", "SelectApi", column, required));
    }

    [Theory]
    [InlineData("nvarchar", -1, 255)]
    [InlineData("varchar", -1, 255)]
    [InlineData("text", 16, 255)]
    [InlineData("ntext", 16, 255)]
    [InlineData("nvarchar", 510, 255)]
    [InlineData("nvarchar", 1000, 255)]
    [InlineData("varchar", 500, 255)]
    public void ExistingWideOrUnboundedColumnsAreNeverNarrowed(string type, int bytes, int required)
        => Assert.Null(SqlServerStringColumnCapacity.BuildAlterSql("sys_menu", "SelectApi", Column(type, bytes), required));

    [Fact]
    public void UnsupportedColumnsAreRejectedWithoutRewritingTypeOrExecutableSql()
    {
        foreach (var column in new[]
        {
            Column("int", 4), Column("varbinary", -1),
            new JObject(Column("nvarchar", 100)) { ["IsComputed"] = true },
            new JObject(Column("nvarchar", 100)) { ["IsUserDefined"] = true },
            new JObject(Column("nvarchar", 100)) { ["CollationName"] = "Chinese_PRC_CI_AS; DROP TABLE sys_menu" }
        })
            Assert.Throws<InvalidOperationException>(() => SqlServerStringColumnCapacity.BuildAlterSql("sys_menu", "SelectApi", column, 255));
    }

    public static bool HasSqlServerFixture => !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Theory(Skip = "Requires an isolated local SQL Server fixture", SkipUnless = nameof(HasSqlServerFixture))]
    [InlineData(DatabaseType.SqlServer)]
    [InlineData(DatabaseType.SqlServer9)]
    [Trait("Category", "FullStack")]
    public async Task LegacyMenuMigrationWidensBeforeBackfillAndKeepsConstraintsAcrossRestart(DatabaseType provider)
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN")!);
        Assert.Matches(@"^127\.0\.0\.1,\d{1,5}$", connection.DataSource);
        Assert.Equal("upgrade_fixture", connection.InitialCatalog);
        var databaseName = "microi_menu_capacity_" + Guid.NewGuid().ToString("N");
        connection.InitialCatalog = "master";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, provider);
        master.FromSql($"CREATE DATABASE [{databaseName}]").ExecuteNonQuery();
        connection.InitialCatalog = databaseName;
        var database = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, provider);
        try
        {
            database.FromSql(@"CREATE TABLE dbo.sys_menu (
                Id varchar(36) NOT NULL PRIMARY KEY, DiyConfig nvarchar(max) NULL,
                SelectApi nvarchar(50) COLLATE Chinese_PRC_CI_AS NOT NULL CONSTRAINT DF_menu_select DEFAULT N'',
                ExportApi varchar(50) COLLATE Latin1_General_100_BIN2 NULL CONSTRAINT DF_menu_export DEFAULT '/default',
                ImportApi nvarchar(250) NULL, ImportProgressApi nvarchar(max) NULL,
                AddBtnText nvarchar(100) NULL, SaveBtnText nvarchar(max) NULL,
                AddBtnType nvarchar(50) NULL, SaveType nvarchar(50) NULL,
                HiddenIndex int NULL, GeneralSeaarch int NULL,
                CONSTRAINT CK_menu_export CHECK (ExportApi IS NULL OR LEN(ExportApi)>0));
                CREATE UNIQUE INDEX ux_menu_select ON dbo.sys_menu(SelectApi);
                CREATE INDEX ix_menu_export ON dbo.sys_menu(ExportApi) INCLUDE (ImportApi) WHERE ExportApi IS NOT NULL;
                CREATE INDEX ix_menu_import ON dbo.sys_menu(ImportApi DESC) INCLUDE (SaveType) WHERE ImportApi IS NOT NULL
                    WITH (FILLFACTOR=80, PAD_INDEX=ON, STATISTICS_NORECOMPUTE=ON, ALLOW_PAGE_LOCKS=OFF, DATA_COMPRESSION=ROW);
                INSERT INTO sys_menu (Id,SelectApi,ExportApi) VALUES ('keep',N'/保留旧菜单','/keep');").ExecuteNonQuery();
            var expected = new JObject
            {
                ["SelectApi"] = "https://example.invalid/查询?probe=" + new string('x', 220),
                ["ExportApi"] = "https://example.invalid/export?probe=" + new string('x', 200),
                ["ImportApi"] = new string('i', 255),
                ["ImportProgressApi"] = new string('p', 600),
                ["AddBtnText"] = "新增", ["SaveBtnText"] = "保存"
            };
            var serialized = expected.ToString(Formatting.None);
            database.FromSql("INSERT INTO sys_menu (Id,DiyConfig,ExportApi) VALUES ('legacy',@config,NULL)")
                .AddInParameter("config", serialized).ExecuteNonQuery();
            // 真实数据库先证明相同旧字段与配置会截断，避免仅测试 DDL 字符串。
            var truncated = Assert.Throws<SqlException>(() => database.FromSql("UPDATE sys_menu SET SelectApi=@value WHERE Id='legacy'")
                .AddInParameter("value", expected.Value<string>("SelectApi")).ExecuteNonQuery());
            Assert.Contains(truncated.Number, new[] { 8152, 2628 });
            var beforeConstraints = Constraints(database);
            var client = new OsClientSecret { OsClient = databaseName, Db = database, DbRead = database,
                OsClientModel = new JObject { ["DbType"] = "SqlServer" } };
            var contracts = Contracts();
            Assert.False(SqlServerStringColumnCapacity.Ready(client, "sys_menu", contracts));
            await RunLegacyMigration(client);
            Assert.True(SqlServerStringColumnCapacity.Ready(client, "sys_menu", contracts));
            foreach (var pair in expected)
                Assert.Equal(pair.Value!.ToString(), database.FromSql("SELECT [" + pair.Key + "] FROM sys_menu WHERE Id='legacy'").ToScalar<string>());
            Assert.Equal(serialized, database.FromSql("SELECT DiyConfig FROM sys_menu WHERE Id='legacy'").ToScalar<string>());
            Assert.Equal("/保留旧菜单", database.FromSql("SELECT SelectApi FROM sys_menu WHERE Id='keep'").ToScalar<string>());
            Assert.Equal(510, database.FromSql("SELECT max_length FROM sys.columns WHERE object_id=OBJECT_ID('sys_menu') AND name='SelectApi'").ToScalar<int>());
            Assert.Equal(255, database.FromSql("SELECT max_length FROM sys.columns WHERE object_id=OBJECT_ID('sys_menu') AND name='ExportApi'").ToScalar<int>());
            Assert.Equal(510, database.FromSql("SELECT max_length FROM sys.columns WHERE object_id=OBJECT_ID('sys_menu') AND name='ImportApi'").ToScalar<int>());
            Assert.Equal(-1, database.FromSql("SELECT max_length FROM sys.columns WHERE object_id=OBJECT_ID('sys_menu') AND name='ImportProgressApi'").ToScalar<int>());
            Assert.Equal(200, database.FromSql("SELECT max_length FROM sys.columns WHERE object_id=OBJECT_ID('sys_menu') AND name='AddBtnText'").ToScalar<int>());
            Assert.Equal(beforeConstraints, Constraints(database));
            var reopened = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, provider);
            client.Db = reopened; client.DbRead = reopened;
            Assert.Equal(0, SqlServerStringColumnCapacity.EnsureUnderLease(client, "sys_menu", contracts));
            await RunLegacyMigration(client);
            Assert.Equal(beforeConstraints, Constraints(reopened));
            Assert.Equal(2, reopened.FromSql("SELECT COUNT(*) FROM sys_menu").ToScalar<int>());
            Assert.Equal(serialized, reopened.FromSql("SELECT DiyConfig FROM sys_menu WHERE Id='legacy'").ToScalar<string>());
            // ALTER 没有丢弃默认值或唯一约束；用新增与重复写入验证实际约束仍生效。
            reopened.FromSql("INSERT INTO sys_menu (Id) VALUES ('defaults')").ExecuteNonQuery();
            Assert.Equal(string.Empty, reopened.FromSql("SELECT SelectApi FROM sys_menu WHERE Id='defaults'").ToScalar<string>());
            Assert.Equal("/default", reopened.FromSql("SELECT ExportApi FROM sys_menu WHERE Id='defaults'").ToScalar<string>());
            Assert.Throws<SqlException>(() => reopened.FromSql("INSERT INTO sys_menu (Id,SelectApi,ExportApi) VALUES ('duplicate',N'/保留旧菜单',NULL)").ExecuteNonQuery());
            // 外键阻止第二列扩容时，第一列扩容和已经 DROP 的筛选索引必须一起回滚。
            reopened.FromSql(@"CREATE UNIQUE INDEX ux_menu_export_fk ON sys_menu(ExportApi);
                CREATE TABLE menu_reference (Id int PRIMARY KEY, ExportApi varchar(255) COLLATE Latin1_General_100_BIN2 NULL,
                    CONSTRAINT FK_menu_export FOREIGN KEY (ExportApi) REFERENCES sys_menu(ExportApi));").ExecuteNonQuery();
            var beforeFailure = Constraints(reopened);
            Assert.Throws<SqlException>(() => SqlServerStringColumnCapacity.EnsureUnderLease(client, "sys_menu",
                new Dictionary<string, string> { ["SelectApi"] = "varchar(400)", ["ExportApi"] = "varchar(400)" }));
            Assert.Equal(510, reopened.FromSql("SELECT max_length FROM sys.columns WHERE object_id=OBJECT_ID('sys_menu') AND name='SelectApi'").ToScalar<int>());
            Assert.Equal(255, reopened.FromSql("SELECT max_length FROM sys.columns WHERE object_id=OBJECT_ID('sys_menu') AND name='ExportApi'").ToScalar<int>());
            Assert.Equal(beforeFailure, Constraints(reopened));
            Assert.Equal(serialized, reopened.FromSql("SELECT DiyConfig FROM sys_menu WHERE Id='legacy'").ToScalar<string>());
        }
        finally
        {
            master.FromSql($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]").ExecuteNonQuery();
        }
    }

    private static async Task RunLegacyMigration(OsClientSecret client)
    {
        var migrate = typeof(MicroiUpgrade).GetMethod("EnsureLegacyMenuDiyConfigCompatibilityAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
        await (Task)migrate.Invoke(new MicroiUpgrade(), new object[] { client })!;
    }

    private static IReadOnlyDictionary<string, string> Contracts()
        => (IReadOnlyDictionary<string, string>)typeof(MicroiUpgrade)
            .GetField("LegacyMenuConfigColumnTypes", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!;

    private static string Constraints(DbSession database)
    {
        var columns = database.FromSql(@"SELECT name,is_nullable,collation_name,default_object_id
            FROM sys.columns WHERE object_id=OBJECT_ID('sys_menu') ORDER BY column_id").ToList<dynamic>();
        var indexes = database.FromSql(@"SELECT i.index_id,i.name,i.is_unique,i.filter_definition,i.fill_factor,
                i.is_padded,i.allow_row_locks,i.allow_page_locks,st.no_recompute,p.data_compression_desc
            FROM sys.indexes i JOIN sys.stats st ON st.object_id=i.object_id AND st.stats_id=i.index_id
            JOIN sys.partitions p ON p.object_id=i.object_id AND p.index_id=i.index_id AND p.partition_number=1
            WHERE i.object_id=OBJECT_ID('sys_menu') ORDER BY i.index_id").ToList<dynamic>();
        var indexColumns = database.FromSql(@"SELECT index_id,column_id,key_ordinal,is_descending_key,is_included_column
            FROM sys.index_columns WHERE object_id=OBJECT_ID('sys_menu') ORDER BY index_id,index_column_id").ToList<dynamic>();
        var checks = database.FromSql(@"SELECT object_id,name,definition FROM sys.check_constraints
            WHERE parent_object_id=OBJECT_ID('sys_menu') ORDER BY name").ToList<dynamic>();
        return JsonConvert.SerializeObject(new { columns, indexes, indexColumns, checks });
    }

    private static JObject Column(string type, int bytes, bool nullable = true) => new()
    {
        ["SchemaName"] = "tenant", ["TypeName"] = type, ["MaxLength"] = bytes,
        ["IsNullable"] = nullable, ["CollationName"] = "Chinese_PRC_CI_AS",
        ["IsComputed"] = false, ["IsUserDefined"] = false
    };
}
