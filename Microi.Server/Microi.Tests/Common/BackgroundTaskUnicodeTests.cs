using System.Data.SqlClient;
using System.Reflection;
using System.Text.RegularExpressions;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class BackgroundTaskUnicodeTests
{
    public static bool HasSqlServerTestConnection => !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Fact]
    public void BackgroundTaskSql_HasNoCodePageDependentChineseLiterals()
    {
        var source = File.ReadAllText(Path.Combine(TestProjectPaths.ServerRoot(),
            "Microi.Core", "Runtime", "BackgroundTaskStore.cs"));
        Assert.Empty(Regex.Matches(source, @"'[^'\r\n]*[\u3400-\u9fff][^'\r\n]*'"));
    }

    [Fact(Skip = "Requires an isolated SQL Server fixture", SkipUnless = nameof(HasSqlServerTestConnection))]
    [Trait("Category", "FullStack")]
    [Trait("DatabaseProvider", "SqlServer")]
    public void Latin1Database_TaskLifecyclePersistsChineseAndKeepsFencing()
    {
        var connection = new SqlConnectionStringBuilder(
            Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN")!);
        SqlServerFixtureGuard.Verify(connection);
        var databaseName = "microi_task_unicode_" + Guid.NewGuid().ToString("N");
        connection.InitialCatalog = "master";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        var tenant = "task-unicode-" + Guid.NewGuid().ToString("N");
        var serviceField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previousProvider = serviceField.GetValue(null);
        // 必须使用新建的 Latin1 库，中文排序规则会掩盖普通 SQL 字面量的损坏。
        // 传入的连接只定位服务；不改 fixture 本身，更不读取或清空业务租户库。
        master.FromSql($"CREATE DATABASE [{databaseName}] COLLATE Latin1_General_100_CI_AS").ExecuteNonQuery();
        try
        {
            connection.InitialCatalog = databaseName;
            var database = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
            var client = new OsClientSecret { OsClient = tenant, Db = database, DbRead = database,
                OsClientModel = new JObject { ["DbType"] = "SqlServer" } };
            var services = new ServiceCollection(); services.AddMicroiORM();
            using var provider = services.BuildServiceProvider();
            MicroiEngine.Init(provider); OsClientExtend.ClientList[tenant] = client;
            Assert.NotEqual("执行失败", database.FromSql("SELECT CONVERT(nvarchar(30), '执行失败')").ToScalar<string>());
            CreateTaskTable(database);
            var item = new BackgroundTaskRecord { Id = Guid.NewGuid().ToString("N"), OsClient = tenant,
                UserKey = "owner", Title = "中文任务", ApiEngineKey = "test-unicode", CreateTime = DateTime.Now,
                IdempotencyKey = Guid.NewGuid().ToString("N"), MaxAttempts = 1, FencingToken = 4,
                LeaseOwner = "unicode-owner", RuntimeOsClientType = "", RuntimeOsClientNetwork = "" };
            BackgroundTaskStore.Insert(item, "owner", "管理员");
            AssertLabel("排队中");
            Assert.Equal(1, BackgroundTaskStore.RequestCancel(tenant, "owner", item.Id));
            AssertLabel("已停止");

            SetRunning(false);
            Assert.True(BackgroundTaskStore.RequeueChunk(item, new JObject(), new JObject(), 0, "继续处理", true));
            AssertLabel("等待下一批");
            SetRunning(true);
            Assert.True(BackgroundTaskStore.RequeueChunk(item, new JObject(), new JObject(), 0, "继续处理", true));
            AssertLabel("已停止");
            AssertMessage("任务已停止；失败或取消不会伪装成 100%。");

            SetRunning(false);
            Assert.True(BackgroundTaskStore.ReleaseToPending(item, "等待同一并发组的上一项任务完成", 1));
            AssertLabel("排队中");
            AssertMessage("等待同一并发组的上一项任务完成");
            SetRunning(true);
            Assert.True(BackgroundTaskStore.ReleaseToPending(item, "等待执行", 1));
            AssertLabel("已停止");

            SetRunning(false);
            Assert.True(BackgroundTaskStore.RetryOrFail(item, new InvalidOperationException("安装失败：模拟证书错误"), false));
            AssertLabel("执行失败");
            AssertMessage("安装失败：模拟证书错误");
            SetRunning(false);
            item.FencingToken--;
            Assert.False(BackgroundTaskStore.RetryOrFail(item, new InvalidOperationException("过期工作器"), false));
            Assert.Equal("Running", ReadColumn("Status"));
            AssertLabel("已领取");

            string ReadColumn(string name) => database.FromSql($"SELECT [{name}] FROM mci_background_task WHERE Id=@id")
                .AddInParameter("id", item.Id).ToScalar<string>();
            void AssertLabel(string expected) => Assert.Equal(expected, ReadColumn("StatusText"));
            void AssertMessage(string expected) => Assert.Equal(expected, ReadColumn("Msg"));
            void SetRunning(bool cancel)
            {
                item.Status = "Running"; item.CancelRequested = cancel; item.AttemptCount = 0;
                database.FromSql("UPDATE mci_background_task SET Status='Running',StatusText=@label,"
                    + "CancelRequested=@cancel,AttemptCount=0,LeaseOwner=@owner,FencingToken=@fence WHERE Id=@id")
                    .AddInParameter("label", "已领取").AddInParameter("cancel", cancel ? 1 : 0)
                    .AddInParameter("owner", item.LeaseOwner).AddInParameter("fence", item.FencingToken)
                    .AddInParameter("id", item.Id).ExecuteNonQuery();
            }
        }
        finally
        {
            OsClientExtend.ClientList.TryRemove(tenant, out _);
            serviceField.SetValue(null, previousProvider);
            master.FromSql($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]").ExecuteNonQuery();
        }
    }

    private static void CreateTaskTable(DbSession db)
    {
        // 夹具从持久记录投影取完整列名，保留真实数值/时间类型；状态文本固定 Unicode。
        var projection = (string)typeof(BackgroundTaskStore)
            .GetField("Projection", BindingFlags.NonPublic | BindingFlags.Static)!.GetRawConstantValue()!;
        var columns = projection.Split(',').Select(part => Regex.Split(part.Trim(), @"\s+AS\s+", RegexOptions.IgnoreCase)[0])
            .Concat(new[] { "UserId", "UserName", "IsDeleted", "UpdateTime" }).Distinct().Select(name =>
            {
                var propertyName = name == "WorkCurrent" ? "Current" : name == "WorkTotal" ? "Total" : name;
                var propertyType = typeof(BackgroundTaskRecord).GetProperty(propertyName)?.PropertyType;
                var type = propertyType == null ? null : Nullable.GetUnderlyingType(propertyType) ?? propertyType;
                var sqlType = name == "IsDeleted" || type == typeof(int) || type == typeof(bool) ? "int"
                    : type == typeof(long) ? "bigint" : type == typeof(double) ? "float"
                    : type == typeof(DateTime) ? "datetime2" : "nvarchar(max)";
                return $"[{name}] {sqlType} NULL";
            });
        db.FromSql("CREATE TABLE mci_background_task (" + string.Join(",", columns) + ")").ExecuteNonQuery();
    }
}
