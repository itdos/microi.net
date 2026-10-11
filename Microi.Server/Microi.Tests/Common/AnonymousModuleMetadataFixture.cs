using System.Data;
using System.Data.Common;
using Dos.ORM;
using Microi.net;

namespace Dos.Common.Tests;

// 仅替代匿名字段权限的元数据读取。保留真实 FormEngine 授权路径；不连接外部库，
// 不替换默认租户，不接受任意 SQL，也不能把此夹具计作正式租户或数据库验收。
internal sealed class AnonymousModuleMetadataFixture : IDisposable
{
    private readonly OsClientSecret client;
    private readonly MetadataFactory factory;
    public string Tenant { get; } = "anonymous-authz-" + Guid.NewGuid().ToString("N");
    public IReadOnlyList<string> Statements => factory.Statements;

    public AnonymousModuleMetadataFixture(bool hasMenuMetadata, string fieldPermissions = null)
    {
        factory = new MetadataFactory(hasMenuMetadata, fieldPermissions);
        var database = new Database(new Dos.ORM.SqlServer.SqlServerProvider("Database=anonymous-authz-fixture", factory));
        var session = new DbSession(database);
        client = new OsClientSecret { OsClient = Tenant, Db = session, DbRead = session };
        Assert.True(OsClientExtend.ClientList.TryAdd(Tenant, client));
    }

    public void Dispose()
    {
        Assert.True(OsClientExtend.ClientList.TryRemove(Tenant, out var removed));
        Assert.Same(client, removed);
    }

    private sealed class MetadataFactory(bool hasMenuMetadata, string fieldPermissions) : DbProviderFactory
    {
        public List<string> Statements { get; } = [];
        public override DbConnection CreateConnection() => new MetadataConnection(this);
        public override DbCommand CreateCommand() => new MetadataCommand(this);
        // Dos.ORM 的该提供程序使用 System.Data.SqlClient 参数类型。
        public override DbParameter CreateParameter() => new System.Data.SqlClient.SqlParameter();

        public object Scalar(string sql)
        {
            Statements.Add(sql);
            Assert.Contains("diy_field", sql, StringComparison.OrdinalIgnoreCase);
            return hasMenuMetadata ? 1 : 0;
        }

        public DbDataReader Reader(string sql)
        {
            Statements.Add(sql);
            var table = new DataTable();
            table.Columns.Add("Id", typeof(string));
            if (sql.Contains("diy_table", StringComparison.OrdinalIgnoreCase))
            {
                table.Columns.Add("Name", typeof(string));
                table.Columns.Add("IsDeleted", typeof(int));
                if (hasMenuMetadata) table.Rows.Add("fixture-menu-table", "sys_menu", 0);
            }
            else
            {
                Assert.Contains("FROM sys_menu", sql, StringComparison.OrdinalIgnoreCase);
                table.Columns.Add("DiyTableId", typeof(string));
                table.Columns.Add("FieldPermissions", typeof(string));
                if (fieldPermissions != null) table.Rows.Add("fixture-menu", "ordinary-id", fieldPermissions);
            }
            return table.CreateDataReader();
        }
    }

    private sealed class MetadataConnection(MetadataFactory factory) : DbConnection
    {
        private ConnectionState state;
        public override string ConnectionString { get; set; } = "";
        public override string Database => "anonymous-authz-fixture";
        public override string DataSource => "in-process-metadata";
        public override string ServerVersion => "1";
        public override ConnectionState State => state;
        public override void Open() => state = ConnectionState.Open;
        public override void Close() => state = ConnectionState.Closed;
        public override void ChangeDatabase(string databaseName) => throw new NotSupportedException();
        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) => throw new NotSupportedException();
        protected override DbCommand CreateDbCommand() => factory.CreateCommand();
        protected override void Dispose(bool disposing) { Close(); base.Dispose(disposing); }
    }

    private sealed class MetadataCommand(MetadataFactory factory) : DbCommand
    {
        private readonly System.Data.SqlClient.SqlCommand parameterOwner = new();
        public override string CommandText { get; set; } = "";
        public override int CommandTimeout { get; set; }
        public override CommandType CommandType { get; set; }
        public override bool DesignTimeVisible { get; set; }
        public override UpdateRowSource UpdatedRowSource { get; set; }
        protected override DbConnection DbConnection { get; set; }
        protected override DbTransaction DbTransaction { get; set; }
        protected override DbParameterCollection DbParameterCollection => parameterOwner.Parameters;
        protected override DbParameter CreateDbParameter() => parameterOwner.CreateParameter();
        public override void Prepare() { }
        public override void Cancel() { }
        public override int ExecuteNonQuery() => throw new NotSupportedException("只允许夹具元数据读取");
        public override object ExecuteScalar() => factory.Scalar(CommandText);
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => factory.Reader(CommandText);
        protected override void Dispose(bool disposing) { if (disposing) parameterOwner.Dispose(); base.Dispose(disposing); }
    }
}
