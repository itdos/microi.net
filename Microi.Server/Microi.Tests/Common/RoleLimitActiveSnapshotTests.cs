using System.Reflection;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using MySql.Data.MySqlClient;
using System.Data.SqlClient;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public sealed class RoleLimitActiveSnapshotTests
{
    public static bool HasFixtures => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN"))
        && !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Theory(Skip = "Requires isolated local database fixtures", SkipUnless = nameof(HasFixtures))]
    [InlineData("MySql")]
    [InlineData("SqlServer")]
    public async Task RealRoleLoader_ExcludesDeletedGrantsAndRetainsLegacyNulls(string providerName)
    {
        var tenant = "role_snapshot_" + Guid.NewGuid().ToString("N");
        var mysql = providerName == "MySql";
        var type = mysql ? DatabaseType.MySql : DatabaseType.SqlServer;
        var connection = Environment.GetEnvironmentVariable(mysql ? "MICROI_UPGRADE_MYSQL_TEST_CONN" : "MICROI_UPGRADE_SQLSERVER_TEST_CONN")!;
        string WithDatabase(string name)
        {
            if (mysql) { var builder = new MySqlConnectionStringBuilder(connection); Assert.Equal("127.0.0.1", builder.Server); builder.Database = name; return builder.ConnectionString; }
            var sqlBuilder = new SqlConnectionStringBuilder(connection); Assert.StartsWith("127.0.0.1,", sqlBuilder.DataSource); sqlBuilder.InitialCatalog = name; return sqlBuilder.ConnectionString;
        }
        var master = MicroiORMExtensions.CreateDbSession(WithDatabase(mysql ? "mysql" : "master"), type);
        var quoted = mysql ? "`" + tenant + "`" : "[" + tenant + "]";
        master.FromSql("CREATE DATABASE " + quoted).ExecuteNonQuery();
        var db = MicroiORMExtensions.CreateDbSession(WithDatabase(tenant), type);
        var services = new ServiceCollection(); services.AddMicroiORM();
        using var provider = services.BuildServiceProvider();
        var providerField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previous = providerField.GetValue(null);
        MicroiEngine.Init(provider);
        OsClientExtend.ClientList[tenant] = new OsClientSecret { OsClient = tenant, Db = db, DbRead = db,
            OsClientModel = new JObject { ["DbType"] = providerName } };
        try
        {
            // 验证真实权限查询及跨数据库语义，不以字符串断言替代数据库执行。
            db.FromSql("CREATE TABLE sys_menu (Id varchar(50) PRIMARY KEY, Name varchar(100)); "
                + "CREATE TABLE sys_role (Id varchar(50) PRIMARY KEY,Name varchar(100),IsDeleted int,Sort int); "
                + "INSERT INTO sys_role VALUES ('role-a','A',0,1),('role-b','B',0,2),('unassigned','C',0,3),('deleted-role','D',1,4); "
                + "CREATE TABLE sys_rolelimit (Id varchar(50) PRIMARY KEY,RoleId varchar(50),FkId varchar(50),Type varchar(30),CreateTime datetime,Customer varchar(100),Permission varchar(100),IsDeleted int NULL); "
                + "INSERT INTO sys_menu VALUES ('menu-a','A'),('menu-b','B'); "
                + "INSERT INTO sys_rolelimit VALUES "
                + "('active','role-a','menu-a','Menu','2026-01-01',NULL,'View',0),"
                + "('legacy-null','role-a','menu-b','Menu','2026-01-01',NULL,'View',NULL),"
                + "('revoked','role-a','menu-a','Menu','2026-01-01',NULL,'Delete',1),"
                + "('other-role','role-b','menu-a','Menu','2026-01-01',NULL,'View',0),"
                + "('other-type','role-a','menu-a','Button','2026-01-01',NULL,'Add',0)").ExecuteNonQuery();
            var logic = new SysRoleLimitLogic();
            var filtered = await logic.GetSysRoleLimit(new SysRoleLimitParam { OsClient = tenant, RoleIds = ["role-a"], Type = "Menu" }, db);
            Assert.Equal(new[] { "active", "legacy-null" }, filtered.Select(x => x.Id).Order().ToArray());
            Assert.Equal("A", filtered.Single(x => x.Id == "active").FkName);
            Assert.Equal("View", filtered.Single(x => x.Id == "active").Permission);
            Assert.Empty(await logic.GetSysRoleLimit(new SysRoleLimitParam { OsClient = tenant, RoleIds = [] }, db));
            Assert.Empty(await logic.GetSysRoleLimit(new SysRoleLimitParam { OsClient = tenant, RoleId = "role-a' OR 1=1 --" }, db));
            var allTypes = await logic.GetSysRoleLimit(new SysRoleLimitParam { OsClient = tenant, RoleId = "role-a" });
            Assert.Equal(3, allTypes.Count);
            db.FromSql("UPDATE sys_rolelimit SET IsDeleted=1 WHERE Id='active'").ExecuteNonQuery();
            Assert.DoesNotContain(await logic.GetSysRoleLimit(new SysRoleLimitParam { OsClient = tenant, RoleId = "role-a" }, db), x => x.Id == "active");
            Assert.Equal(5, Convert.ToInt32(db.FromSql("SELECT COUNT(*) FROM sys_rolelimit").ToScalar()));
            var editor = await logic.GetSysRoleLimitByMenuId(new SysRoleLimitParam { OsClient = tenant, FkId = "menu-b" });
            Assert.Equal(3, editor.Data.Count);
            Assert.Equal("legacy-null", editor.Data.Single(x => x.RoleId == "role-a").Id);
            Assert.Null(editor.Data.Single(x => x.RoleId == "unassigned").Id);
            db.FromSql("UPDATE sys_rolelimit SET IsDeleted=1 WHERE Id='legacy-null'").ExecuteNonQuery();
            var revokedEditor = await logic.GetSysRoleLimitByMenuId(new SysRoleLimitParam { OsClient = tenant, FkId = "menu-b" });
            Assert.Equal(3, revokedEditor.Data.Count);
            Assert.Null(revokedEditor.Data.Single(x => x.RoleId == "role-a").Id);

            // 兼容旧表没有软删除列，并验证后续新增列不会被本机负缓存永久忽略。
            db.FromSql("ALTER TABLE sys_rolelimit DROP COLUMN IsDeleted").ExecuteNonQuery();
            Assert.Equal(4, (await logic.GetSysRoleLimit(new SysRoleLimitParam { OsClient = tenant, RoleId = "role-a" }, db)).Count);
            Assert.Equal(3, (await logic.GetSysRoleLimitByMenuId(new SysRoleLimitParam { OsClient = tenant, FkId = "menu-b" })).Data.Count);
            db.FromSql("ALTER TABLE sys_rolelimit ADD IsDeleted int NULL; UPDATE sys_rolelimit SET IsDeleted=1 WHERE Id='revoked'").ExecuteNonQuery();
            Assert.DoesNotContain(await logic.GetSysRoleLimit(new SysRoleLimitParam { OsClient = tenant, RoleId = "role-a" }, db), x => x.Id == "revoked");
            db.FromSql("DROP TABLE sys_rolelimit").ExecuteNonQuery();
            await Assert.ThrowsAnyAsync<Exception>(() => logic.GetSysRoleLimit(new SysRoleLimitParam { OsClient = tenant, RoleId = "role-a" }, db));
        }
        finally
        {
            providerField.SetValue(null, previous); OsClientExtend.ClientList.TryRemove(tenant, out _);
            if (!mysql) master.FromSql("ALTER DATABASE " + quoted + " SET SINGLE_USER WITH ROLLBACK IMMEDIATE").ExecuteNonQuery();
            master.FromSql("DROP DATABASE " + quoted).ExecuteNonQuery();
        }
    }
}
