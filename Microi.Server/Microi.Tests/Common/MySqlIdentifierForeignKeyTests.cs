using Dos.ORM;
using Microi.net;
using System.Data.Common;
using Jint;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public class MySqlIdentifierForeignKeyTests
{
    public static bool HasConnection => MarketplaceMetadataBootstrapIntegrationTests.HasMySqlTestConnection;

    [Fact(Skip = "Requires isolated upgrade_fixture on localhost:62606", SkipUnless = nameof(HasConnection))]
    public void WideningFromV8_PreservesForeignKeysRowsDefaultsAndCollation_AndReplaysWithoutChanges()
    {
        var connection = Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN")!;
        var options = new DbConnectionStringBuilder { ConnectionString = connection };
        Assert.Equal("upgrade_fixture", options["Database"]);
        Assert.Equal("127.0.0.1", options["Server"]);
        Assert.Equal("62606", Convert.ToString(options["Port"]));
        var db = MicroiORMExtensions.CreateDbSession(connection, DatabaseType.MySql);
        try
        {
            db.FromSql("CREATE TABLE fk_parent (Id char(36) COLLATE utf8mb4_bin NOT NULL COMMENT 'keep,id',ParentId char(36) DEFAULT '',PRIMARY KEY(Id))").ExecuteNonQuery();
            db.FromSql("CREATE TABLE fk_child (Id int PRIMARY KEY,ParentId char(36) COLLATE utf8mb4_bin,CONSTRAINT fk_fixture FOREIGN KEY(ParentId) REFERENCES fk_parent(Id) ON DELETE RESTRICT ON UPDATE CASCADE)").ExecuteNonQuery();
            db.FromSql("INSERT INTO fk_parent(Id) VALUES('c74d669c-a3d4-11e5-b60d-b870f43edd03')").ExecuteNonQuery();
            db.FromSql("INSERT INTO fk_child VALUES(1,'c74d669c-a3d4-11e5-b60d-b870f43edd03')").ExecuteNonQuery();
            var engine = new Engine().SetValue("db", db);
            Assert.Equal(2, engine.Evaluate("db.WidenMySqlIdentifierColumns('fk_parent','Id:36,ParentId:50')").AsNumber());
            Assert.Equal(0, db.WidenMySqlIdentifierColumns("fk_parent", "Id:36,ParentId:50"));
            Assert.Equal(1, Convert.ToInt32(db.FromSql("SELECT COUNT(*) FROM fk_child").ToScalar()));
            Assert.ThrowsAny<Exception>(() => db.FromSql("INSERT INTO fk_child VALUES(2,'missing')").ExecuteNonQuery());
            const string ulid = "01M1RETESTULID0000000000001";
            db.FromSql("INSERT INTO fk_parent(Id) VALUES(@p0)").AddInParameter("p0", ulid).ExecuteNonQuery();
            Assert.Equal(ulid, Convert.ToString(db.FromSql("SELECT Id FROM fk_parent WHERE Id=@p0").AddInParameter("p0", ulid).ToScalar()));
            Assert.Equal("", Convert.ToString(db.FromSql("SELECT ParentId FROM fk_parent WHERE Id=@p0").AddInParameter("p0", ulid).ToScalar()));
            Assert.Equal("utf8mb4_bin", Convert.ToString(db.FromSql("SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fk_parent' AND COLUMN_NAME='Id'").ToScalar()));
            Assert.Equal("keep,id", Convert.ToString(db.FromSql("SELECT COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fk_parent' AND COLUMN_NAME='Id'").ToScalar()));
            Assert.Equal(1, Convert.ToInt32(db.FromSql("SELECT @@SESSION.foreign_key_checks").ToScalar()));

            // Force ALTER failure after the isolated session has suspended checks.
            db.FromSql("CREATE TABLE fk_fail (Id char(36) PRIMARY KEY,Code varchar(700),KEY width_limit(Id,Code)) CHARSET=utf8mb4").ExecuteNonQuery();
            db.FromSql("INSERT INTO fk_fail(Id) VALUES('c74d669c-a3d4-11e5-b60d-b870f43edd03')").ExecuteNonQuery();
            Assert.ThrowsAny<Exception>(() => db.WidenMySqlIdentifierColumns("fk_fail", "Id:255"));
            Assert.Equal("char(36)", Convert.ToString(db.FromSql("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fk_fail' AND COLUMN_NAME='Id'").ToScalar()));
            Assert.Equal(1, Convert.ToInt32(db.FromSql("SELECT @@SESSION.foreign_key_checks").ToScalar()));
            Assert.Throws<ArgumentException>(() => db.WidenMySqlIdentifierColumns("fk_parent;DROP TABLE fk_child", "Id:36"));
            Assert.Throws<ArgumentException>(() => db.WidenMySqlIdentifierColumns("fk_parent", "Id:35"));
            Assert.Throws<ArgumentException>(() => db.WidenMySqlIdentifierColumns("fk_parent", "Name:36"));
        }
        finally
        {
            db.FromSql("DROP TABLE IF EXISTS fk_child").ExecuteNonQuery();
            db.FromSql("DROP TABLE IF EXISTS fk_parent").ExecuteNonQuery();
            db.FromSql("DROP TABLE IF EXISTS fk_fail").ExecuteNonQuery();
        }
    }
}
