using System.Diagnostics;
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;

/// <summary>Full 真实 MySQL + 双进程验收。只在隔离测试库运行故障注入，清理不触及业务库。</summary>
internal static class IncidentDurabilityAcceptance
{
    public static async Task Run(string directory)
    {
        var configured = Environment.GetEnvironmentVariable("MICROI_INCIDENT_TEST_MYSQL");
        var options = new MySqlConnectionStringBuilder(configured ?? Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_MYSQL")
            ?? throw new InvalidOperationException("Full requires isolated scheduling MySQL"));
        var ownsDatabase = configured == null;
        var adminOptions = new MySqlConnectionStringBuilder(options.ConnectionString) { Database = "" };
        if (ownsDatabase) options.Database = "microi_diag_" + Guid.NewGuid().ToString("N");
        if (!options.Database.StartsWith("microi_diag_", StringComparison.Ordinal)) throw new InvalidOperationException("Refusing non-fixture database");
        var database = options.Database;
        var children = new List<Process>();
        async Task Sql(string sql)
        {
            await using var connection = new MySqlConnection(adminOptions.ConnectionString); await connection.OpenAsync();
            await using var command = connection.CreateCommand(); command.CommandText = sql; command.CommandTimeout = 10; await command.ExecuteNonQueryAsync();
        }
        try
        {
            if (ownsDatabase)
            {
                await Sql($"CREATE DATABASE `{database}` CHARACTER SET utf8mb4");
                // 测试夹具 DDL 仅限随机 microi_diag_ 库；生产表由商城包安装。
                await Sql($"CREATE TABLE `{database}`.mci_runtime_incident (Id varchar(36) PRIMARY KEY,Tenant varchar(80),IncidentId varchar(32),OccurredAtUtc varchar(25),UpdatedVersion bigint,Payload mediumtext,Summary mediumtext,INDEX idx_runtime_incident_tenant_time(Tenant,OccurredAtUtc,Id))");
            }
            Environment.SetEnvironmentVariable("MICROI_INCIDENT_TEST_MYSQL", options.ConnectionString);
            IncidentDurabilityFixture.RepositoryRegression();
            async Task<(Process Process, string Url, string Boot)> Start(string name, bool unwritable)
            {
                var root = Path.Combine(directory, name); Directory.CreateDirectory(root);
                var start = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true,
                    RedirectStandardOutput = true, RedirectStandardError = true };
                start.ArgumentList.Add(typeof(IncidentDurabilityAcceptance).Assembly.Location);
                foreach (var arg in new[] { "incident", root, unwritable ? "unwritable" : "writable" }) start.ArgumentList.Add(arg);
                var process = Process.Start(start)!; children.Add(process);
                // 持续排空管道，不让测试日志本身阻塞故障节点。
                var output = process.StandardOutput.ReadToEndAsync(); var error = process.StandardError.ReadToEndAsync();
                var ready = Path.Combine(root, "ready.json");
                await Until(async () => {
                    if (process.HasExited) throw new InvalidOperationException("Fixture exited: " + (await error).Replace(options.ConnectionString, "<redacted>"));
                    return File.Exists(ready);
                }, 30, "node-ready:" + name);
                var state = JObject.Parse(await File.ReadAllTextAsync(ready));
                return (process, state.Value<string>("Url")!, state.Value<string>("BootId")!);
            }
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(85) };
            async Task<JObject> Get(string url, string path) => JObject.Parse(await http.GetStringAsync(url + path));
            var a = await Start("a-unwritable", true); var b = await Start("b-independent", false);
            var work1 = Get(a.Url, "/work/incident-a/30"); await Task.Delay(1000);
            var work2 = Get(a.Url, "/work/incident-a/15"); await Task.Delay(1000);
            var started = Stopwatch.StartNew(); var other = await Get(a.Url, "/work/incident-b/0");
            Check(other.Value<int>("code") == 1 && started.ElapsedMilliseconds < 2000, "OtherTenantBlocked");
            var otherMs = started.ElapsedMilliseconds;
            JObject? memory = null;
            await Until(async () => {
                memory = await Get(a.Url, "/memory/incident-a");
                return memory["Evidence"]?["CriticalStorage"]?.Value<long>("AcknowledgedWrites") > 0;
            }, 25, "mysql-acknowledgement");
            Check(!string.IsNullOrEmpty(memory!["Evidence"]?.Value<string>("LocalStorageError")), "LocalDirectoryWasWritable");
            var groups = (JArray)memory["RequestWaits"]!["Groups"]!;
            Check(groups.Any(g => g.Value<string>("Stage") == "Gate:V8Tenant" && g.Value<int>("Count") == 1), "MissingGateWait");
            Check(groups.Any(g => g.Value<string>("Kind") == "Http"), "MissingDependencyWait");
            var history = await Get(b.Url, "/incidents/incident-a");
            Check(history.Value<string>("RelationalStorage") == "Available", "NoCrossNodeStorage");
            var id = history["Items"]![0]!.Value<string>("Id")!;
            async Task<JObject> Detail(string url, string tenant) => (JObject)(await Get(url, "/incident/" + tenant + "/" + id))["Items"]![0]!;
            var detail = await Detail(b.Url, "incident-a");
            Check(detail.Value<string>("BootId") == a.Boot && detail.Value<string>("StorageKind") == "MySqlCriticalEvidence", "WrongNodeEvidence");
            foreach (var row in (JArray)(await Get(b.Url, "/incident/incident-b/" + id))["Items"]!)
            {
                Check(row.Value<string>("Tenant") == "incident-b", "TenantLeak");
                foreach (var key in new[] { "RequestWaits", "WaitEvidence" })
                    foreach (var list in new[] { "Groups", "Samples", "Recent" })
                        Check((row[key]?[list] as JArray ?? new()).All(x => x.Value<string>("OsClient") == "incident-b"), "WaitTenantLeak");
                Check((row["Executions"] as JArray ?? new()).All(x => x.Value<string>("OsClient") == "incident-b"), "ExecutionTenantLeak");
            }
            await http.GetStringAsync(a.Url + "/starve");
            try { await Until(async () => (await Detail(b.Url, "incident-a"))["WaitEvidence"]?["WorstThreadPoolFrame"]?.Value<int>("ThreadPoolAvailableWorkers") == 0, 35, "threadpool-starvation-snapshot"); }
            catch {
                Console.WriteLine((await Get(a.Url, "/injection")).ToString());
                var live = await Get(a.Url, "/memory/incident-a"); Console.WriteLine(live["Evidence"]);
                Console.WriteLine(new JArray(((JArray)live["History"]!).Select(f => new JObject { ["At"] = f["AtUtc"], ["Max"] = f["ThreadPoolMaxWorkers"], ["Available"] = f["ThreadPoolAvailableWorkers"] })));
                throw;
            }
            Check((await work1).Value<int>("code") == 1 && (await work2).Value<int>("code") == 1, "LongBusinessInterrupted");
            a.Process.Kill(entireProcessTree: true); await a.Process.WaitForExitAsync();
            var fresh = await Start("a-recreated-empty-filesystem", false);
            Check(fresh.Boot != a.Boot, "BootDidNotChange");
            var restored = await Detail(fresh.Url, "incident-a");
            Check(restored.Value<string>("BootId") == a.Boot && restored["WaitEvidence"]?["Groups"] is JArray saved && saved.Count > 0, "EvidenceLostAfterRecreation");
            Console.WriteLine(new JObject { ["Passed"] = true, ["MongoUnavailable"] = true, ["LocalUnwritable"] = true,
                ["OtherTenantMilliseconds"] = otherMs, ["SamplingDuringThreadPoolStarvation"] = true,
                ["TenantIsolation"] = true, ["LongBusinessCompleted"] = true, ["CrossNodeRead"] = true,
                ["NewProcessEmptyFilesystemRead"] = true, ["IncidentId"] = id }.ToString(Newtonsoft.Json.Formatting.None));
        }
        finally
        {
            foreach (var process in children) { try { if (!process.HasExited) process.Kill(entireProcessTree: true); await process.WaitForExitAsync(); } finally { process.Dispose(); } }
            if (ownsDatabase) await Sql($"DROP DATABASE `{database}`");
        }
    }
    private static void Check(bool passed, string message) { if (!passed) throw new InvalidOperationException(message); }
    private static async Task Until(Func<Task<bool>> condition, int seconds, string stage)
    {
        var deadline = DateTime.UtcNow.AddSeconds(seconds);
        do { if (await condition()) return; await Task.Delay(500); } while (DateTime.UtcNow < deadline);
        throw new TimeoutException("Incident acceptance condition not met: " + stage);
    }
}
