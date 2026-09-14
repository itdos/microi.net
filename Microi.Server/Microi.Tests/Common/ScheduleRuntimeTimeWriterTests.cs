using System.Data.Common;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class ScheduleRuntimeTimeWriterTests
{
    [Theory]
    [InlineData(null, null, "", "", false)]
    [InlineData("", "", null, null, false)]
    [InlineData("2026-09-13 12:00:00", "2026-09-13 12:01:00", "2026-09-13 12:00:00", "2026-09-13 12:01:00", false)]
    [InlineData(null, "", "2026-09-13 12:00:00", "2026-09-13 12:01:00", true)]
    [InlineData("2026-09-13 12:00:00", "2026-09-13 12:01:00", "2026-09-13 12:00:00", "", true)]
    public void UnchangedRuntimeDoesNotNeedPersistence(string? oldLast, string? oldNext, string? last, string? next, bool changed)
        => Assert.Equal(changed, ScheduleRuntimeTimeWriter.HasChanged(new JObject { ["LastTime"] = oldLast, ["NextTime"] = oldNext }, last!, next!));

    [Fact]
    public void DateTokenUsesStableDatabaseTimeFormat()
    {
        var row = new JObject { ["LastTime"] = new DateTime(2026, 9, 13, 12, 0, 0), ["NextTime"] = "" };
        Assert.False(ScheduleRuntimeTimeWriter.HasChanged(row, "2026-09-13 12:00:00", ""));
    }

    [Fact]
    public async Task UnchangedRuntimeDoesNotOpenUnavailableDatabase()
    {
        var db = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Port=1;Database=never_connect;Uid=test;Pwd=test;Connection Timeout=1");
        Assert.Equal(0, await ScheduleRuntimeTimeWriter.WriteAsync(db, new JObject { ["Id"] = "row" }, "", ""));
        await Assert.ThrowsAsync<ArgumentException>(() => ScheduleRuntimeTimeWriter.WriteAsync(db, new JObject(), "", ""));
        await Assert.ThrowsAsync<ArgumentException>(() => ScheduleRuntimeTimeWriter.WriteAsync("", new JObject(), "", ""));
    }
}

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public class ScheduleRuntimeTimeWriterIntegrationTests
{
    private static string? Connection => Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN")
        ?? Environment.GetEnvironmentVariable("XQC_TEST_MYSQL_CONN");
    public static bool HasConnection => !string.IsNullOrWhiteSpace(Connection);

    [Fact(Skip = "Requires an isolated local MySQL upgrade_fixture or xqc_verify connection", SkipUnless = nameof(HasConnection))]
    public async Task TwoWritersAreIdempotentAndCannotOverwritePausedDeletedOrNewerRows()
    {
        var parts = new DbConnectionStringBuilder { ConnectionString = Connection! };
        Assert.Equal("127.0.0.1", parts["Server"]);
        Assert.Contains(Convert.ToString(parts["Database"]), new[] { "upgrade_fixture", "xqc_verify" });
        Assert.InRange(Convert.ToInt32(parts["Port"]), 1, 65535);
        var name = "microi_schedule_runtime_" + Guid.NewGuid().ToString("N");
        parts["Database"] = "mysql";
        var master = new DbSession(DatabaseType.MySql, parts.ConnectionString);
        master.FromSql($"CREATE DATABASE `{name}` CHARACTER SET utf8mb4").ExecuteNonQuery();
        parts["Database"] = name;
        var db = new DbSession(DatabaseType.MySql, parts.ConnectionString);
        var second = new DbSession(DatabaseType.MySql, parts.ConnectionString);
        var tenant = "schedule-runtime-" + Guid.NewGuid().ToString("N");
        parts["Database"] = name + "_missing_replica";
        OsClientExtend.ClientList[tenant] = new OsClientSecret { OsClient = tenant, Db = db, DbRead = new DbSession(DatabaseType.MySql, parts.ConnectionString) };
        try
        {
            // 不建版本表：运行时间写回若触发通用表单/数据版本链路，测试必须失败。
            db.FromSql("CREATE TABLE diy_schedule_job (Id varchar(36) PRIMARY KEY, JobName varchar(200), Status varchar(20), IsDeleted int NULL, LastTime varchar(50) NULL, NextTime varchar(50) NULL, CronExpression varchar(100), UpdateTime varchar(50))").ExecuteNonQuery();
            db.FromSql("INSERT INTO diy_schedule_job VALUES ('row','sameName','正常',0,NULL,NULL,'original-cron','config-time')").ExecuteNonQuery();
            var observed = new JObject { ["Id"] = "row", ["JobName"] = "sameName" };
            var updates = await Task.WhenAll(ScheduleRuntimeTimeWriter.WriteAsync(tenant, observed, "2026-09-13 12:00:00", "2026-09-13 12:01:00"),
                ScheduleRuntimeTimeWriter.WriteAsync(second, observed, "2026-09-13 12:00:00", "2026-09-13 12:01:00"));
            Assert.Equal(1, updates.Sum());
            Assert.Equal(0, await ScheduleRuntimeTimeWriter.WriteAsync(db, observed, "stale", "stale"));
            Assert.Equal("original-cron", db.FromSql("SELECT CronExpression FROM diy_schedule_job WHERE Id='row'").ToScalar<string>());
            Assert.Equal("config-time", db.FromSql("SELECT UpdateTime FROM diy_schedule_job WHERE Id='row'").ToScalar<string>());
            observed["LastTime"] = "2026-09-13 12:00:00";
            observed["NextTime"] = "2026-09-13 12:01:00";
            Assert.Equal(0, await ScheduleRuntimeTimeWriter.WriteAsync(db, observed, observed["LastTime"]!.ToString(), observed["NextTime"]!.ToString()));
            db.FromSql("UPDATE diy_schedule_job SET Status='暂停' WHERE Id='row'").ExecuteNonQuery();
            Assert.Equal(0, await ScheduleRuntimeTimeWriter.WriteAsync(db, observed, "next", "next"));
            db.FromSql("UPDATE diy_schedule_job SET Status='正常',IsDeleted=1 WHERE Id='row'").ExecuteNonQuery();
            Assert.Equal(0, await ScheduleRuntimeTimeWriter.WriteAsync(db, observed, "next", "next"));
            db.FromSql("UPDATE diy_schedule_job SET IsDeleted=NULL,JobName='renamed' WHERE Id='row'").ExecuteNonQuery();
            Assert.Equal(0, await ScheduleRuntimeTimeWriter.WriteAsync(db, observed, "next", "next"));
            observed["JobName"] = "renamed";
            // 类似 SQL 的数据只能写入单行字段，不能改变固定表/语句范围。
            const string quoted = "'; UPDATE diy_schedule_job SET Status='hacked'; --";
            Assert.Equal(1, await ScheduleRuntimeTimeWriter.WriteAsync(db, observed, quoted, ""));
            Assert.Equal(quoted, db.FromSql("SELECT LastTime FROM diy_schedule_job WHERE Id='row'").ToScalar<string>());
            Assert.Equal("正常", db.FromSql("SELECT Status FROM diy_schedule_job WHERE Id='row'").ToScalar<string>());
            await Assert.ThrowsAnyAsync<Exception>(() => ScheduleRuntimeTimeWriter.WriteAsync("schedule-runtime-missing-tenant", observed, "next", "next"));
        }
        finally
        {
            OsClientExtend.ClientList.TryRemove(tenant, out _);
            master.FromSql($"DROP DATABASE `{name}`").ExecuteNonQuery();
        }
    }
}
