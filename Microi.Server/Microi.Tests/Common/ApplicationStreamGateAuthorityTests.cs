using System.Data;
using System.Data.Common;
using System.Reflection;
using Dos.ORM;
using Microi.net;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class ApplicationStreamGateAuthorityTests
{
    [Theory]
    [InlineData(1, true)]
    [InlineData(0, false)]
    [InlineData(2, false)]
    public void ChildWithNoLocalRegistry_UsesOnlyMainDatabaseAndExactChildTuple(int rows, bool ready)
    {
        using var fixture = new GateFixture(rows);
        var result = V8McpLogic.BuildApplicationAssetStreamGateStatusData(fixture.Child, "Product", "Internal");
        Assert.Equal(ready, result.Value<bool>("ApplicationAssetStreamGateReady"));
        Assert.Equal("SaaSMainDatabase", result.Value<string>("ApplicationAssetStreamGateSource"));
        Assert.Equal(fixture.Child, result.Value<string>("ApplicationAssetStreamGateTenant"));
        Assert.Equal(1, fixture.MainReads);
        Assert.Equal(0, fixture.ChildReads);
        if (ready)
        {
            Assert.Equal("V3Only", result.Value<string>("ApplicationStreamPublishMode"));
            Assert.Equal("7", result.Value<string>("GateEpoch"));
        }
        else
            Assert.Contains("Actual=" + rows, result.Value<string>("ApplicationAssetStreamGateReadError"));
    }

    [Fact]
    public void FinalizationLease_LocksTheAuthorityAndNeverTheChildDatabase()
    {
        using var fixture = new GateFixture(1);
        var leaseType = typeof(V8McpLogic).GetNestedType("ApplicationStreamGateReadLease", BindingFlags.NonPublic)!;
        var read = typeof(V8McpLogic).GetMethod("ReadApplicationAssetStreamGateStrong", BindingFlags.Static | BindingFlags.NonPublic)!;
        using (var lease = (IDisposable)Activator.CreateInstance(leaseType)!)
        {
            var result = (V8McpLogic.ApplicationAssetStreamGateSnapshot)read.Invoke(null,
                [fixture.Child, "Product", "Internal", lease, true])!;
            Assert.Equal(7, result.ApplicationStreamGateEpoch);
            Assert.True(fixture.LockHeld);
            Assert.Equal(0, fixture.ChildReads);
        }
        Assert.False(fixture.LockHeld);
    }

    [Fact]
    public void MissingAuthority_DoesNotFallbackToBusinessTenant()
    {
        var calls = new List<string>();
        Assert.Throws<InvalidOperationException>(() => V8McpLogic.ResolveApplicationStreamGateAuthority("main", name =>
        {
            calls.Add(name); return null!;
        }));
        Assert.Equal(new[] { "main" }, calls);
        Assert.Throws<InvalidOperationException>(() => V8McpLogic.ResolveApplicationStreamGateAuthority("", _ => throw new Exception()));
    }

    [Fact]
    public void AuditKeys_AreTenantAndPartitionScoped_AndKeepMainReplay()
    {
        string Key(string tenant, string type = "Product", string network = "Internal") =>
            V8McpLogic.BuildApplicationStreamGateStorageTransitionId("main", tenant, type, network, "same-request");
        Assert.Equal("same-request", Key("main"));
        Assert.Equal(Key("a"), Key("a"));
        Assert.Equal(4, new[] { Key("a"), Key("b"), Key("a", "Dev"), Key("a", "Product", "External") }.Distinct().Count());
        Assert.Throws<ArgumentException>(() => V8McpLogic.BuildApplicationStreamGateStorageTransitionId("main", "main", "Product", "Internal", Key("a")));
        Assert.True(Key("a").Length <= 100);
    }

    [Theory]
    [InlineData("ApplicationStreamPublishMode")]
    [InlineData("ApplicationStreamMinProtocol")]
    [InlineData("ApplicationStreamGateEpoch")]
    public void NewTenant_DoesNotInheritParentPublishState(string field) =>
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain(field));

    // In-process provider fixture exercises the production reader and transaction
    // selection. It is not a claim of real database/server or customer acceptance.
    private sealed class GateFixture : IDisposable
    {
        private readonly string previous = OsClientDefault.OsClient;
        private readonly string main = "gate-main-" + Guid.NewGuid().ToString("N");
        public string Child { get; } = "gate-child-" + Guid.NewGuid().ToString("N");
        private readonly Factory mainFactory;
        private readonly Factory childFactory;
        public int MainReads => mainFactory.Reads;
        public int ChildReads => childFactory.Reads;
        public bool LockHeld => mainFactory.LockHeld;
        public GateFixture(int rows)
        {
            mainFactory = new Factory(Child, rows);
            childFactory = new Factory(Child, 0, true);
            OsClientExtend.ClientList.TryAdd(main, Client(main, mainFactory));
            OsClientExtend.ClientList.TryAdd(Child, Client(Child, childFactory));
            OsClientDefault.OsClient = main;
        }
        private static OsClientSecret Client(string name, Factory factory)
        {
            var db = new DbSession(new Database(new Dos.ORM.SqlServer.SqlServerProvider("Database=" + name, factory)));
            return new OsClientSecret { OsClient = name, Db = db, DbRead = db };
        }
        public void Dispose()
        {
            OsClientDefault.OsClient = previous;
            OsClientExtend.ClientList.TryRemove(main, out _);
            OsClientExtend.ClientList.TryRemove(Child, out _);
        }
    }
    private sealed class Factory(string child, int rows, bool business = false) : DbProviderFactory
    {
        public int Reads;
        public bool LockHeld;
        public override DbConnection CreateConnection() => new Connection(this);
        public override DbCommand CreateCommand() => new Command(this);
        public override DbParameter CreateParameter() => new System.Data.SqlClient.SqlParameter();
        public DbDataReader Read(string sql, DbParameterCollection parameters, DbTransaction? transaction)
        {
            Reads++;
            Assert.False(business, "Child business database must not supply SaaS gate rows");
            Assert.Contains("[IsEnable]=1", sql);
            Assert.Contains("[IsDeleted]", sql);
            Assert.Equal(child, parameters["@os"].Value);
            Assert.Equal("Product", parameters["@type"].Value);
            Assert.Equal("Internal", parameters["@network"].Value);
            if (sql.Contains("UPDLOCK")) { Assert.NotNull(transaction); LockHeld = true; }
            var table = new DataTable();
            foreach (var name in new[] { "OsClient", "OsClientType", "OsClientNetwork", "ApplicationStreamPublishMode" }) table.Columns.Add(name, typeof(string));
            table.Columns.Add("ApplicationStreamMinProtocol", typeof(int));
            table.Columns.Add("ApplicationStreamGateEpoch", typeof(long));
            for (var i = 0; i < rows; i++) table.Rows.Add(child, "Product", "Internal", "V3Only", 3, 7L);
            return table.CreateDataReader();
        }
    }
    private sealed class Connection(Factory factory) : DbConnection
    {
        private ConnectionState state;
        public override string ConnectionString { get; set; } = "";
        public override string Database => "gate-fixture";
        public override string DataSource => "in-process";
        public override string ServerVersion => "1";
        public override ConnectionState State => state;
        public override void Open() => state = ConnectionState.Open;
        public override void Close() => state = ConnectionState.Closed;
        public override void ChangeDatabase(string databaseName) => throw new NotSupportedException();
        protected override DbTransaction BeginDbTransaction(IsolationLevel level) => new Transaction(this, factory);
        protected override DbCommand CreateDbCommand() => factory.CreateCommand();
    }
    private sealed class Transaction(Connection connection, Factory factory) : DbTransaction
    {
        public override IsolationLevel IsolationLevel => IsolationLevel.ReadCommitted;
        protected override DbConnection DbConnection => connection;
        public override void Commit() => factory.LockHeld = false;
        public override void Rollback() => factory.LockHeld = false;
    }
    private sealed class Command(Factory factory) : DbCommand
    {
        private readonly System.Data.SqlClient.SqlCommand owner = new();
        public override string CommandText { get; set; } = "";
        public override int CommandTimeout { get; set; }
        public override CommandType CommandType { get; set; }
        public override bool DesignTimeVisible { get; set; }
        public override UpdateRowSource UpdatedRowSource { get; set; }
        protected override DbConnection? DbConnection { get; set; }
        protected override DbTransaction? DbTransaction { get; set; }
        protected override DbParameterCollection DbParameterCollection => owner.Parameters;
        protected override DbParameter CreateDbParameter() => owner.CreateParameter();
        public override void Prepare() { }
        public override void Cancel() { }
        public override int ExecuteNonQuery() => throw new NotSupportedException();
        public override object ExecuteScalar() => throw new NotSupportedException();
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => factory.Read(CommandText, owner.Parameters, DbTransaction);
        protected override void Dispose(bool disposing) { if (disposing) owner.Dispose(); base.Dispose(disposing); }
    }
}
