using Dos.ORM;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json.Linq;

/// <summary>仅专项验收宿主，独立数据库、目录与端口；可故障注入，不能注册到正式 API。</summary>
internal static class IncidentDurabilityFixture
{
    public static void RepositoryRegression()
    {
        var connection = Environment.GetEnvironmentVariable("MICROI_INCIDENT_TEST_MYSQL")!;
        var options = new MySql.Data.MySqlClient.MySqlConnectionStringBuilder(connection);
        if (!options.Database.StartsWith("microi_diag_")) throw new InvalidOperationException("Dedicated database required");
        options.MaximumPoolSize = 1;
        var db = new DbSession(DatabaseType.MySql, options.ConnectionString);
        var repository = new RelationalIncidentRepository(_ => db);
        var id = Guid.NewGuid().ToString("N"); var at = DateTime.UtcNow;
        var value = new JObject { ["Id"] = id, ["Tenant"] = "replay-a", ["OccurredAtUtc"] = at, ["UpdatedAtUtc"] = at, ["Status"] = "Old" };
        using var busy = new MySql.Data.MySqlClient.MySqlConnection(options.ConnectionString); busy.Open();
        using var transaction = busy.BeginTransaction();
        repository.Save("replay-a", value);
        var newer = (JObject)value.DeepClone(); newer["UpdatedAtUtc"] = at.AddSeconds(1); newer["Status"] = "New";
        repository.Save("replay-a", newer); repository.Save("replay-a", value); transaction.Rollback();
        if (repository.Read("replay-a", id).Single().Value<string>("Status") != "New") throw new Exception("StaleReplayOverwroteNewerEvidence");
        if (repository.Read("replay-b", id).Count != 0) throw new Exception("TenantLeak");
        var other = (JObject)value.DeepClone(); other["Tenant"] = "replay-b"; repository.Save("replay-b", other);
        if (repository.Read("replay-b", id).Count != 1 || repository.Read("replay-a", id).Count != 1) throw new Exception("TenantIdentityCollision");
        try { repository.Save("replay-b", value); throw new Exception("AcceptedTenantMismatch"); } catch (ArgumentException) { }
        var spoolRoot = Path.Combine(Path.GetTempPath(), "microi-mysql-spool-" + Guid.NewGuid().ToString("N"));
        try
        {
            var store = new MemoryDiagnosticsStore(spoolRoot); var persisted = (JObject)value.DeepClone();
            persisted["Id"] = Guid.NewGuid().ToString("N"); persisted["Status"] = "PersistedDuringDatabaseOutage";
            var file = store.SaveIncident(Guid.NewGuid().ToString("N"), persisted);
            File.WriteAllText(file + ".ack", "Mongo already stored this version");
            using (var failed = new CriticalIncidentWriter((_, _) => throw new IOException("injected database outage"), store))
                if (!SpinWait.SpinUntil(() => failed.Health().Value<string>("Error") == nameof(IOException), 3000)) throw new Exception("SpoolFailureNotObserved");
            using (var recovered = new CriticalIncidentWriter(repository.Save, store))
                if (!SpinWait.SpinUntil(() => recovered.Health().Value<long>("AcknowledgedWrites") == 1, 5000)) throw new Exception("SpoolReplayNotAcknowledged");
            if (repository.Read("replay-a", persisted.Value<string>("Id")).Single().Value<string>("Status") != "PersistedDuringDatabaseOutage") throw new Exception("SpoolNotInActualMySql");
        }
        finally { if (Directory.Exists(spoolRoot)) Directory.Delete(spoolRoot, true); }
        Console.WriteLine(new JObject { ["Passed"] = true, ["OldReplayIgnored"] = true, ["TenantIsolation"] = true,
            ["BusinessPoolExhaustedButEvidenceWritten"] = true, ["BusinessRollbackDidNotRollbackEvidence"] = true, ["PersistedSpoolReplayedToMySqlAfterWriterRestart"] = true }.ToString(Newtonsoft.Json.Formatting.None));
    }

    public static async Task Run(string root, bool unwritable, string listen)
    {
        var connection = Environment.GetEnvironmentVariable("MICROI_INCIDENT_TEST_MYSQL") ?? throw new InvalidOperationException("Dedicated test database required");
        var builderConn = new MySql.Data.MySqlClient.MySqlConnectionStringBuilder(connection);
        if (!builderConn.Database.StartsWith("microi_diag_", StringComparison.Ordinal)) throw new InvalidOperationException("Refusing non-fixture database");
        var db = new DbSession(DatabaseType.MySql, connection);
        // 安装与生产同一商城导出的 DDL，由专项脚本先准备；运行时不擅自建表。
        Environment.SetEnvironmentVariable("OsClient", "incident-a");
        foreach (var tenant in new[] { "incident-a", "incident-b" })
            OsClientExtend.ClientList[tenant] = new OsClientSecret { OsClient = tenant, Db = db, DbRead = db,
                OsClientModel = new JObject { ["Id"] = tenant, ["PressV8ReqMax"] = 1,
                    ["DbMongoConnection"] = "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500&connectTimeoutMS=500" } };
        Directory.CreateDirectory(root);
        if (unwritable) File.WriteAllText(Path.Combine(root, "logs"), "regular file blocks diagnostic directory creation");
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { ContentRootPath = root });
        builder.WebHost.UseUrls(listen);
        builder.Services.AddSingleton<IMemoryIncidentRepository, V8MongoDB>();
        builder.Services.AddSingleton<RelationalIncidentRepository>();
        builder.Services.AddSingleton<MemoryDiagnosticsService>();
        builder.Services.AddSingleton<IMemoryDiagnosticsRuntime>(p => p.GetRequiredService<MemoryDiagnosticsService>());
        builder.Services.AddHostedService(p => p.GetRequiredService<MemoryDiagnosticsService>());
        var app = builder.Build();
        JObject injection = new();
        app.UseMiddleware<SystemObservabilityMiddleware>();
        app.MapGet("/memory/{tenant}", async (string tenant, IMemoryDiagnosticsRuntime runtime) => (await runtime.QueryAsync("memory", tenant, "", default)).ToString());
        app.MapGet("/incidents/{tenant}", async (string tenant, IMemoryDiagnosticsRuntime runtime) => (await runtime.QueryAsync("memoryincidents", tenant, "", default)).ToString());
        app.MapGet("/incident/{tenant}/{id}", async (string tenant, string id, IMemoryDiagnosticsRuntime runtime) => (await runtime.QueryAsync("memoryincident", tenant, id, default)).ToString());
        app.MapGet("/upstream/{seconds:int}", async (int seconds) => { await Task.Delay(TimeSpan.FromSeconds(Math.Clamp(seconds, 0, 30))); return "ok"; });
        app.MapGet("/work/{tenant}/{seconds:int}", async (string tenant, int seconds, HttpContext context) =>
        {
            if (tenant != "incident-a" && tenant != "incident-b") return Results.BadRequest();
            using var trace = MicroiTraceContext.StartActivity("fixture-work");
            using var execution = ExecutionObservation.Enter("ApiEngine", "device-read", tenant);
            using var lease = await RequestPressureGuardService.TryEnterAsync("/apiengine/device-read", tenant, new RequestPressureGuardOptions(), context.RequestAborted);
            if (!lease.IsEntered) return Results.StatusCode(429);
            var url = app.Urls.Single().Replace("0.0.0.0", "127.0.0.1") + "/upstream/" + Math.Clamp(seconds, 0, 30);
            var response = await new DiyHttp().GetResponseAsync(new DiyHttpParam { Url = url, Timeout = 600 });
            return Results.Json(new { Code = (int)response.StatusCode == 200 ? 1 : 0 });
        });
        app.MapGet("/starve", () =>
        {
            // 用独立恢复线程释放真实线程池等待；采样必须在池没有空余工作线程时继续留证。
            var release = new ManualResetEventSlim();
            new Thread(() => {
                Thread.Sleep(500); // 先把故障注入回执发送完成，避免客户端误以为注入失败而重试。
                var minSet = ThreadPool.SetMinThreads(4, 4); var maxSet = ThreadPool.SetMaxThreads(4, 4);
                ThreadPool.GetMaxThreads(out var max, out var io);
                injection = new JObject { ["MinSet"] = minSet, ["MaxSet"] = maxSet, ["Max"] = max, ["IoMax"] = io };
                for (var i = 0; i < 4; i++) ThreadPool.QueueUserWorkItem(_ => release.Wait());
                Thread.Sleep(8000); ThreadPool.GetAvailableThreads(out var available, out _); injection["ObservedAvailable"] = available;
                Thread.Sleep(8000); release.Set(); ThreadPool.SetMaxThreads(32767, 1000);
            }) { IsBackground = true }.Start();
            return Results.Ok();
        });
        app.MapGet("/injection", () => injection.ToString());
        app.MapGet("/liveness", () => "Healthy");
        await app.StartAsync();
        File.WriteAllText(Path.Combine(root, "ready.json"), new JObject { ["Url"] = app.Urls.Single(), ["BootId"] = ExecutionObservation.BootId }.ToString());
        await app.WaitForShutdownAsync();
    }
}
