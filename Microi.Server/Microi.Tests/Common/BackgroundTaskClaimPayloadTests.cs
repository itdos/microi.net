using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using System.Text.RegularExpressions;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class BackgroundTaskClaimPayloadTests
{
    [Fact]
    public void SlowLargePayloadDoesNotUseTheTwoSecondDispatcherScanBudget()
    {
        var row = Claim();
        row.Status = "Pending";
        row.ParamJson = "{\"Package\":\"" + new string('x', 1_688_880) + "\"}";
        var factory = new Factory(row) { PayloadDelay = TimeSpan.FromMilliseconds(2200) };
        var client = Client(factory);
        var candidate = BackgroundTaskStore.TryReadCandidate(client, row.OsClient, DateTime.Now,
            "Product", "Internal", Array.Empty<string>(), row.ApiEngineKey);
        Assert.NotNull(candidate);
        Assert.Null(candidate.ParamJson);
        Assert.Null(candidate.TrustedUserJson);
        Assert.Null(candidate.CheckpointJson);
        Assert.Equal(2, Assert.Single(factory.Reads).Timeout);
        Assert.DoesNotContain("ParamJson", factory.Reads[0].Sql);
        Assert.DoesNotContain("ResultJson", factory.Reads[0].Sql);
        Assert.DoesNotContain("CheckpointJson", factory.Reads[0].Sql);

        // Model the successful CAS. The production worker loads this data on
        // its Task.Run slot; the bounded queue dispatcher has already returned.
        row.Status = "Running";
        var stopwatch = Stopwatch.StartNew();
        var loaded = BackgroundTaskStore.ReadClaimedPayload(client, row, DateTime.Now);
        Assert.NotNull(loaded);
        Assert.Equal(row.ParamJson, loaded.ParamJson);
        Assert.Equal(row.TrustedUserJson, loaded.TrustedUserJson);
        Assert.True(stopwatch.Elapsed >= TimeSpan.FromSeconds(2));
        Assert.Equal(30, factory.Reads[1].Timeout);
        Assert.True(factory.Reads[1].Timeout < BackgroundTaskStore.ResolveLeaseSeconds(row.ApiEngineKey));
    }

    [Theory]
    [InlineData("owner")]
    [InlineData("fence")]
    [InlineData("tenant")]
    [InlineData("id")]
    [InlineData("expired")]
    [InlineData("canceled")]
    [InlineData("status")]
    public void PayloadReadIsBoundToTheCurrentUnexpiredClaim(string change)
    {
        var claim = Claim();
        var persisted = Claim();
        switch (change)
        {
            case "owner": persisted.LeaseOwner = "other-owner"; break;
            case "fence": persisted.FencingToken++; break;
            case "tenant": persisted.OsClient = "other-tenant"; break;
            case "id": persisted.Id = "other-task"; break;
            case "expired": persisted.LeaseExpiresAt = DateTime.Now.AddSeconds(-1); break;
            case "canceled": persisted.CancelRequested = true; break;
            case "status": persisted.Status = "Pending"; break;
        }
        var factory = new Factory(persisted);
        Assert.Null(BackgroundTaskStore.ReadClaimedPayload(Client(factory), claim, DateTime.Now));
        Assert.Single(factory.Reads);
    }

    [Fact]
    public void OwnershipChangeWhilePayloadIsBeingReadPreventsExecution()
    {
        var claim = Claim();
        var released = 0;
        var checks = 0;
        var payload = BackgroundTaskClaimPayload.Prepare(claim, Claim,
            () => { checks++; return false; }, () => released++,
            _ => throw new Exception("Expected ownership loss is not a read error"), CancellationToken.None);
        Assert.Null(payload);
        Assert.Equal(1, checks);
        Assert.Equal(1, released);
    }

    [Fact]
    public void LeaseExpiringDuringTheOwnershipReadCannotAuthorizeExecution()
    {
        var payload = Claim();
        var released = 0;
        var result = BackgroundTaskClaimPayload.Prepare(Claim(), () => payload,
            () =>
            {
                payload.LeaseExpiresAt = DateTime.Now.AddMilliseconds(100);
                Thread.Sleep(150);
                return true; // The database compared an earlier timestamp.
            }, () => released++, _ => { }, CancellationToken.None);
        Assert.Null(result);
        Assert.Equal(1, released);
    }

    [Fact]
    public void PostReadOwnershipQueryHasItsOwnBoundedCommandTimeout()
    {
        var claim = Claim();
        claim.OsClient = "payload-check-" + Guid.NewGuid().ToString("N");
        var factory = new Factory(claim);
        Assert.True(OsClientExtend.ClientList.TryAdd(claim.OsClient, Client(factory)));
        try
        {
            Assert.True(BackgroundTaskStore.IsClaimedPayloadLeaseCurrent(claim));
            Assert.Equal(2, factory.ScalarTimeout);
        }
        finally { OsClientExtend.ClientList.TryRemove(claim.OsClient, out _); }
    }

    [Theory]
    [InlineData("owner")]
    [InlineData("fence")]
    [InlineData("tenant")]
    [InlineData("id")]
    [InlineData("engine")]
    [InlineData("status")]
    [InlineData("null")]
    public void UnconfirmedPayloadCannotReplaceTheOriginalReleaseIdentity(string change)
    {
        var claim = Claim();
        var returned = Claim();
        switch (change)
        {
            case "owner": returned.LeaseOwner = "other"; break;
            case "fence": returned.FencingToken++; break;
            case "tenant": returned.OsClient = "other"; break;
            case "id": returned.Id = "other"; break;
            case "engine": returned.ApiEngineKey = "other"; break;
            case "status": returned.Status = "Pending"; break;
        }
        var released = 0;
        var ownershipChecks = 0;
        var payload = BackgroundTaskClaimPayload.Prepare(claim, () => change == "null" ? null! : returned,
            () => { ownershipChecks++; return true; },
            () => { released++; Assert.Equal("owner", claim.LeaseOwner); Assert.Equal(7L, claim.FencingToken); },
            _ => { }, CancellationToken.None);
        Assert.Null(payload);
        Assert.Equal(1, released);
        Assert.Equal(0, ownershipChecks);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void ReadFailureReleasesClaimWithoutSpendingBusinessAttempts(bool releaseFails)
    {
        var claim = Claim();
        var released = 0;
        var failures = new List<Exception>();
        var payload = BackgroundTaskClaimPayload.Prepare(claim,
            () => throw new TimeoutException("payload read exceeded its budget"),
            () => throw new Exception("Failed read cannot execute"),
            () => { released++; if (releaseFails) throw new IOException("release unavailable"); },
            failures.Add, CancellationToken.None);
        Assert.Null(payload);
        Assert.Equal(1, released);
        Assert.Equal(0, claim.AttemptCount);
        Assert.Equal(1, claim.MaxAttempts);
        Assert.Equal(releaseFails ? 2 : 1, failures.Count);
        Assert.IsType<TimeoutException>(failures[0]);
    }

    [Fact]
    public void HostStopBeforeOrDuringReadReturnsClaimWithoutExecuting()
    {
        foreach (var beforeRead in new[] { true, false })
        {
            using var cancellation = new CancellationTokenSource();
            if (beforeRead) cancellation.Cancel();
            var reads = 0;
            var released = 0;
            var payload = BackgroundTaskClaimPayload.Prepare(Claim(),
                () => { reads++; cancellation.Cancel(); return Claim(); }, () => true,
                () => released++, _ => { }, cancellation.Token);
            Assert.Null(payload);
            Assert.Equal(beforeRead ? 0 : 1, reads);
            Assert.Equal(1, released);
        }
    }

    [Fact]
    public void ConfirmedReadReturnsTheExactCompletePayload()
    {
        var payload = Claim();
        payload.ParamJson = "{\"Checkpoint\":42}";
        payload.TrustedUserJson = "{\"Id\":\"authorized-user\"}";
        var result = BackgroundTaskClaimPayload.Prepare(Claim(), () => payload, () => true,
            () => throw new Exception("A valid read must not release the lease"),
            _ => throw new Exception("A valid read must not report an error"), CancellationToken.None);
        Assert.Same(payload, result);
        Assert.Equal(payload.ParamJson, result.ParamJson);
    }

    [Fact]
    public void FailedReadUsesTheOwnedReleaseSqlAndRestoresTheLastRecoveryBudget()
    {
        var claim = Claim();
        claim.OsClient = "payload-release-" + Guid.NewGuid().ToString("N");
        claim.AttemptCount = 1;
        var persisted = Claim();
        persisted.OsClient = claim.OsClient;
        persisted.AttemptCount = 1;
        var factory = new Factory(persisted);
        var client = Client(factory);
        Assert.True(OsClientExtend.ClientList.TryAdd(claim.OsClient, client));
        try
        {
            var result = BackgroundTaskClaimPayload.Prepare(claim,
                () => throw new TimeoutException(), () => true,
                () => Assert.True(BackgroundTaskStore.ReleaseToPending(claim, "payload read retry", 5)),
                _ => { }, CancellationToken.None);
            Assert.Null(result);
            Assert.Equal(1, factory.Updates);
            Assert.Equal("Pending", persisted.Status);
            Assert.Equal(0, persisted.AttemptCount);
            Assert.Equal(1, persisted.MaxAttempts);
            Assert.Equal("", persisted.LeaseOwner);
        }
        finally { OsClientExtend.ClientList.TryRemove(claim.OsClient, out _); }
    }

    [Fact]
    public async Task LostClaimCannotReleaseOrWakeAnotherOwnersTaskThroughTheRealWorkerEntry()
    {
        var claim = Claim();
        claim.OsClient = "payload-lost-" + Guid.NewGuid().ToString("N");
        var persisted = Claim();
        persisted.OsClient = claim.OsClient;
        persisted.LeaseOwner = "new-owner";
        persisted.FencingToken++;
        var factory = new Factory(persisted);
        Assert.True(OsClientExtend.ClientList.TryAdd(claim.OsClient, Client(factory)));
        try
        {
            var queue = (BackgroundTaskWakeQueue)typeof(BackgroundTaskService)
                .GetField("WorkerWakeQueue", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!;
            var before = queue.PendingLaneCount;
            var process = typeof(BackgroundTaskService).GetMethod("ProcessClaimedAsync", BindingFlags.Static | BindingFlags.NonPublic)!;
            await (Task)process.Invoke(null, [claim, CancellationToken.None])!;
            Assert.Equal(1, factory.Updates);
            Assert.Equal(0, factory.Affected);
            Assert.Equal("Running", persisted.Status);
            Assert.Equal("new-owner", persisted.LeaseOwner);
            Assert.Equal(8L, persisted.FencingToken);
            // A wrong wake is delayed until NextRunTime by the real worker;
            // checking immediately would miss that regression.
            Assert.NotNull(claim.NextRunTime);
            var remaining = claim.NextRunTime.Value - DateTime.Now + TimeSpan.FromMilliseconds(750);
            if (remaining > TimeSpan.Zero) await Task.Delay(remaining, TestContext.Current.CancellationToken);
            Assert.Equal(before, queue.PendingLaneCount);
        }
        finally { OsClientExtend.ClientList.TryRemove(claim.OsClient, out _); }
    }

    private static BackgroundTaskRecord Claim() => new()
    {
        Id = "task", OsClient = "tenant", ApiEngineKey = "bulk-import-microi-store-packages",
        Status = "Running", LeaseOwner = "owner", FencingToken = 7,
        AttemptCount = 0, MaxAttempts = 1, ExecutionCount = 1,
        LeaseExpiresAt = DateTime.Now.AddSeconds(90), CreateTime = DateTime.Now,
        StartTime = DateTime.Now, ParamJson = "{}", TrustedUserJson = "{\"Id\":\"user\"}",
        RuntimeOsClientType = "Product", RuntimeOsClientNetwork = "Internal"
    };

    private static OsClientSecret Client(Factory factory)
    {
        var session = new DbSession(new Database(new Dos.ORM.SqlServer.SqlServerProvider("Database=claim-payload-fixture", factory)));
        return new OsClientSecret { OsClient = factory.Tenant, Db = session, DbRead = session,
            OsClientModel = new JObject { ["DbType"] = "SqlServer" } };
    }

    // Exercises production SqlSection construction, bound parameters, command
    // timeout and ORM materialization without using an external database.
    private sealed class Factory(BackgroundTaskRecord persisted) : DbProviderFactory
    {
        public readonly List<(string Sql, int Timeout)> Reads = [];
        public string Tenant => persisted.OsClient;
        public int Updates;
        public int Affected;
        public int ScalarTimeout;
        public TimeSpan PayloadDelay;
        public override DbConnection CreateConnection() => new Connection(this);
        public override DbCommand CreateCommand() => new Command(this);
        public override DbParameter CreateParameter() => new System.Data.SqlClient.SqlParameter();
        public DbDataReader Read(string sql, int timeout, DbParameterCollection parameters)
        {
            Reads.Add((sql, timeout));
            var full = sql.Contains("ParamJson");
            var eligible = true;
            if (sql.Contains("WHERE 1=0")) eligible = false;
            else if (full)
            {
                foreach (var predicate in new[] { "[Id]=@id", "[OsClient]=@tenant", "[Status]='Running'",
                    "[LeaseOwner]=@owner", "[FencingToken]=@fence", "[LeaseExpiresAt]>@now", "[CancelRequested]=0" })
                    Assert.Contains(predicate, sql);
                eligible = persisted.Id == (string)parameters["@id"].Value
                    && persisted.OsClient == (string)parameters["@tenant"].Value
                    && persisted.LeaseOwner == (string)parameters["@owner"].Value
                    && persisted.FencingToken == Convert.ToInt64(parameters["@fence"].Value)
                    && persisted.LeaseExpiresAt > DateTime.Parse((string)parameters["@now"].Value, CultureInfo.InvariantCulture)
                    && persisted.Status == "Running" && !persisted.CancelRequested;
                if (PayloadDelay.TotalSeconds > timeout)
                    throw new TimeoutException("A large payload cannot fit the candidate scan deadline");
                if (PayloadDelay > TimeSpan.Zero) Thread.Sleep(PayloadDelay);
            }
            var projection = Regex.Replace(sql[..sql.IndexOf(" FROM ", StringComparison.Ordinal)],
                @"^SELECT\s+(TOP\s+\d+\s+)?", "");
            var table = new DataTable();
            var properties = new List<PropertyInfo>();
            foreach (var field in projection.Split(','))
            {
                var name = Regex.Split(field.Trim(), @"\s+AS\s+", RegexOptions.IgnoreCase)[^1].Trim('[', ']');
                var property = typeof(BackgroundTaskRecord).GetProperty(name)!;
                Assert.NotNull(property);
                properties.Add(property);
                table.Columns.Add(name, Nullable.GetUnderlyingType(property.PropertyType) ?? property.PropertyType);
            }
            if (eligible) table.Rows.Add(properties.Select(property => property.GetValue(persisted) ?? DBNull.Value).ToArray());
            return table.CreateDataReader();
        }

        public int Update(string sql, DbParameterCollection parameters)
        {
            Updates++;
            foreach (var predicate in new[] { "[Id]=@ownerId", "[OsClient]=@ownerOsClient", "[Status]='Running'",
                "[LeaseOwner]=@ownerLease", "[FencingToken]=@ownerFence" })
                Assert.Contains(predicate, sql);
            if (persisted.Status != "Running" || persisted.Id != (string)parameters["@ownerId"].Value
                || persisted.OsClient != (string)parameters["@ownerOsClient"].Value
                || persisted.LeaseOwner != (string)parameters["@ownerLease"].Value
                || persisted.FencingToken != Convert.ToInt64(parameters["@ownerFence"].Value)) return 0;
            Assert.Contains("[AttemptCount]>=[MaxAttempts]", sql);
            Assert.Contains("[MaxAttempts]-1", sql);
            persisted.Status = persisted.CancelRequested ? "Canceled" : "Pending";
            persisted.LeaseOwner = "";
            persisted.LeaseExpiresAt = null;
            if (!persisted.CancelRequested && persisted.AttemptCount >= persisted.MaxAttempts)
                persisted.AttemptCount = Math.Max(0, persisted.MaxAttempts - 1);
            return ++Affected;
        }

        public object Scalar(string sql, int timeout, DbParameterCollection parameters)
        {
            ScalarTimeout = timeout;
            Assert.Contains("SELECT COUNT(1)", sql);
            Assert.Contains("[LeaseOwner]=@p2", sql);
            Assert.Contains("[FencingToken]=@p3", sql);
            Assert.Contains("[LeaseExpiresAt]>@p4", sql);
            return persisted.Id == (string)parameters["@p0"].Value
                && persisted.OsClient == (string)parameters["@p1"].Value
                && persisted.LeaseOwner == (string)parameters["@p2"].Value
                && persisted.FencingToken == Convert.ToInt64(parameters["@p3"].Value)
                && persisted.LeaseExpiresAt > DateTime.Parse((string)parameters["@p4"].Value, CultureInfo.InvariantCulture)
                && persisted.Status == "Running" && !persisted.CancelRequested ? 1 : 0;
        }
    }

    private sealed class Connection(Factory factory) : DbConnection
    {
        private ConnectionState state;
        public override string ConnectionString { get; set; } = "";
        public override string Database => "claim-payload-fixture";
        public override string DataSource => "in-process";
        public override string ServerVersion => "1";
        public override ConnectionState State => state;
        public override void Open() => state = ConnectionState.Open;
        public override void Close() => state = ConnectionState.Closed;
        public override void ChangeDatabase(string databaseName) => throw new NotSupportedException();
        protected override DbTransaction BeginDbTransaction(IsolationLevel level) => throw new NotSupportedException();
        protected override DbCommand CreateDbCommand() => factory.CreateCommand();
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
        public override int ExecuteNonQuery() => factory.Update(CommandText, owner.Parameters);
        public override object ExecuteScalar() => factory.Scalar(CommandText, CommandTimeout, owner.Parameters);
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => factory.Read(CommandText, CommandTimeout, owner.Parameters);
        protected override void Dispose(bool disposing) { if (disposing) owner.Dispose(); base.Dispose(disposing); }
    }
}
