using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
using Microi.Panel;
using Microi.Panel.Panel;

internal static class GuardIntegrationChecks
{
    public static async Task Run(Action<bool, string> check)
    {
        var resource = PanelCatalog.Prepare(new() { PluginId = "redis", Version = PanelCatalog.Get("redis").Versions[0].Id,
            Name = "cache", Password = "Fixture-only-password-287" }, "test-owner");
        var config = PanelDockerConfig.Create(resource, "sha256:" + new string('1', 64));
        check(resource.RedisAuthProxy && config["HostConfig"]!["PortBindings"]!.AsObject().Count == 0, "new Redis never publishes an unobserved direct authentication port");
        check(config["HostConfig"]!["NetworkMode"]!.ToString() == "mci-panel-test-owner-cache-guard", "new Redis has an instance-specific isolated network");
        check(config["Labels"]!["io.microi.panel.auth-guard.redis-proxy-port"]!.ToString() == "16379", "guard receives only the explicitly selected listening port");
        check(!JsonSerializer.Serialize(resource.Public()).Contains("Fixture-only-password"), "public resource does not expose Redis credential");
        var legacy = JsonSerializer.Deserialize<PanelResource>("{\"id\":\"legacy\",\"ownerId\":\"test-owner\",\"pluginId\":\"redis\",\"ports\":{\"database\":16380}}", JsonDefaults.Options)!;
        check(!legacy.RedisAuthProxy && PanelDockerConfig.Create(legacy, "image")["HostConfig"]!["PortBindings"]!["6379/tcp"] != null,
            "missing legacy flag preserves the recorded direct port until explicit migration");
        var mysql = PanelCatalog.Prepare(new() { PluginId = "mysql", Version = PanelCatalog.Get("mysql").Versions[0].Id, Name = "db", Password = "Fixture-only-password-287" }, "test-owner");
        check(mysql.Command.Contains("--log-error-verbosity=3") && mysql.Command.Contains("--skip-name-resolve"), "new MySQL records authentication failures with numeric source addresses");
        var mongo = PanelCatalog.Prepare(new() { PluginId = "mongodb", Version = PanelCatalog.Get("mongodb").Versions[0].Id, Name = "docs", Password = "Fixture-only-password-287" }, "test-owner");
        check(mongo.Command.Contains("enableDetailedConnectionHealthMetricLogLines=true"), "new MongoDB enables structured authentication result logging");
        var handler = new GuardHandler(); using var client = new PanelAuthGuardClient(handler);
        check((await client.Check("198.51.100.8", default))?["banned"]?.GetValue<bool>() == false, "typed guard check reads an actual HTTP response");
        check(handler.Path == "/check" && handler.Body?["ip"]?.ToString() == "198.51.100.8", "guard client submits only typed source-IP data to its fixed route");
        check(handler.KnownLengthBeforeRead == handler.Bytes.Length && !handler.Chunked && !handler.ExpectContinue,
            "guard POST has a known Content-Length before transport reads its body");
        await client.Failure("198.51.100.8", "中文认证事件-1", default);
        check(handler.Path == "/failures" && handler.Body?["service"]?.ToString() == "panel", "panel failures are attributed to the fixed panel service");
        check(handler.KnownLengthBeforeRead == handler.Bytes.Length && handler.Body?["eventId"]?.ToString() == "中文认证事件-1"
            && handler.ContentType == "application/json; charset=utf-8", "Chinese guard event JSON retains its value and exact serialized UTF-8 byte length");
        await client.SavePolicy(new() { ["expectedRevision"] = "策略版本-1", ["enabled"] = true }, default);
        check(handler.Path == "/policy" && handler.KnownLengthBeforeRead == handler.Bytes.Length && !handler.Chunked,
            "guard policy PUT also has explicit body framing");
        await client.Unban("198.51.100.8", default);
        check(handler.Path == "/unban" && handler.KnownLengthBeforeRead == handler.Bytes.Length && !handler.Chunked,
            "guard unban POST also has explicit body framing");
        await client.Status(default);
        check(handler.Path == "/status" && handler.KnownLengthBeforeRead == null && handler.Bytes.Length == 0,
            "guard status GET does not invent a JSON body");
        handler.Status = HttpStatusCode.Conflict;
        var conflict = false; try { await client.SavePolicy(new(), default); } catch (OpsException error) { conflict = error.Status == 409; }
        check(conflict, "guard CAS failure cannot become a successful policy save");
        handler.Unavailable = true;
        check(await client.Status(default) == null, "host service outage is represented as unavailable rather than protected");
        var failed = false; try { await client.Unban("198.51.100.8", default); } catch (HttpRequestException) { failed = true; }
        check(failed, "host unban cannot silently succeed when host service is offline");
        handler.Unavailable = false; handler.Status = HttpStatusCode.OK;
        handler.Response = "{\"adapters\":[{\"id\":\"cache\",\"service\":\"redis\",\"status\":\"degraded\"}]}";
        failed = false; try { await client.RequireRedisReady("cache", default); } catch (OpsException) { failed = true; }
        check(failed, "a running Redis without a verified authentication entry cannot be installed as ready");
        handler.Response = RedisReceipt().ToJsonString();
        await client.RequireRedisReady("cache", default);
        check(true, "Redis readiness accepts the matching protected resource receipt");
        handler.Response = RedisReceipt(enabled:false, adapterStatus:"disabled").ToJsonString();
        failed = false; try { await client.RequireRedisReady("cache", default); } catch (OpsException) { failed = true; }
        check(!failed, "disabled authentication counting still permits a verified transparent Redis listener");
        foreach (var receipt in new[]
        {
            RedisReceipt(verified:false), RedisReceipt(listener:"error"), RedisReceipt(enabled:true, adapterStatus:"disabled"),
            RedisReceipt(id:"different-resource"), RedisReceipt(observedAt:DateTimeOffset.UtcNow.AddMinutes(-2))
        })
        {
            handler.Response = receipt.ToJsonString();
            failed = false; try { await client.RequireRedisReady("cache", default); } catch (OpsException) { failed = true; }
            check(failed, "Redis readiness rejects unverified, nonlistening, mismatched, or stale receipt: " + receipt.ToJsonString());
        }
        await DeliveryReceiptChecks(check);
    }

    private static JsonObject RedisReceipt(bool enabled = true, string adapterStatus = "protecting", bool verified = true,
        string listener = "listening", string id = "cache", DateTimeOffset? observedAt = null) => new()
    {
        ["policy"] = new JsonObject { ["enabled"] = enabled },
        ["observedAt"] = (observedAt ?? DateTimeOffset.UtcNow).ToUnixTimeMilliseconds() / 1000d,
        ["firewall"] = new JsonObject { ["verified"] = verified, ["observedAt"] = (observedAt ?? DateTimeOffset.UtcNow).ToUnixTimeMilliseconds() / 1000d },
        ["adapters"] = new JsonArray(new JsonObject { ["id"] = id, ["service"] = "redis", ["status"] = adapterStatus,
            ["proxy"] = new JsonObject { ["state"] = listener } })
    };

    // This fixture follows the Python daemon's JSON types, including fractional Unix seconds,
    // policy generations, exact rolling timestamps and a distinct durable delivery decision.
    private static JsonObject HostReceipt(string ip, DateTimeOffset observedAt, int count = 0, bool banned = false,
        long generation = 10, bool accepted = true, string? ignored = null, bool enabled = true) => new()
    {
        ["ip"] = ip, ["accepted"] = accepted, ["ignoredReason"] = ignored, ["banned"] = banned,
        ["failedAttempts"] = count, ["observedAt"] = observedAt.ToUnixTimeMilliseconds() / 1000d,
        ["lastFailure"] = count > 0 ? JsonValue.Create(observedAt.AddMilliseconds(-10).ToUnixTimeMilliseconds() / 1000d) : null,
        ["resetEpoch"] = count == 0 ? JsonValue.Create(observedAt.ToUnixTimeMilliseconds() / 1000d) : null,
        ["recentFailureTimes"] = new JsonArray(),
        ["ban"] = banned ? new JsonObject { ["ip"] = ip, ["expiresAt"] = observedAt.AddHours(24).ToUnixTimeMilliseconds() / 1000d,
            ["bannedAt"] = observedAt.ToUnixTimeMilliseconds() / 1000d, ["applied"] = true, ["failedAttempts"] = count } : null,
        ["policy"] = JsonSerializer.SerializeToNode(new PanelLoginPolicy(Enabled:enabled, Allowlist:[], Revision:"host-generation-" + generation, Generation:generation), JsonDefaults.Options),
        ["firewall"] = new JsonObject { ["verified"] = true, ["observedAt"] = observedAt.ToUnixTimeMilliseconds() / 1000d }
    };

    private static async Task DeliveryReceiptChecks(Action<bool, string> check)
    {
        var args = Environment.GetCommandLineArgs();
        var workspace = Path.GetFullPath(args.Length > 1 ? args[1] : Directory.GetCurrentDirectory());
        if (!File.Exists(Path.Combine(workspace, "Microi.Server", "Microi.Panel", "Microi.Panel.csproj"))) throw new Exception("Guard integration fixture requires the source workspace.");
        var scratch = Path.Combine(workspace, ".tmp", "guard-receipt-integration-" + Guid.NewGuid().ToString("N"));
        var options = new OpsOptions { DataDir = scratch, LogDir = Path.Combine(scratch, "logs") };
        try
        {
            using var store = new OpsStore(options);
            var clock = new ReceiptClock();
            var login = new PanelLoginSecurity(options, store, new OpsAudit(store, options), clock);
            var handler = new GuardHandler(); using var client = new PanelAuthGuardClient(handler);
            const string ip = "198.51.100.51";
            string Event() => Guid.NewGuid().ToString("N");
            var malformed = new List<(string Name, string Json)> { ("empty object", "{}"), ("invalid JSON", "not-json"), ("only banned flag", "{\"banned\":false}") };
            void Invalid(string name, Action<JsonObject> change)
            {
                var value = HostReceipt(ip, clock.GetUtcNow()); change(value); malformed.Add((name, value.ToJsonString()));
            }
            Invalid("wrong source IP", value => value["ip"] = "198.51.100.52");
            Invalid("missing durable decision", value => value.Remove("accepted"));
            Invalid("unknown rejection reason", value => { value["accepted"] = false; value["ignoredReason"] = "overflow"; });
            Invalid("malformed rolling timestamps", value => value["recentFailureTimes"] = "not-an-array");
            Invalid("malformed ban object", value => value["ban"] = "not-an-object");
            Invalid("ban flag inconsistent with missing ban", value => { value["banned"] = true; value["ban"] = null; });
            Invalid("future observation", value => value["observedAt"] = clock.GetUtcNow().AddDays(1).ToUnixTimeMilliseconds() / 1000d);
            foreach (var sample in malformed)
            {
                login.Failure(ip, Event()); handler.Response = sample.Json;
                try { await PanelSecurityEndpoints.FlushFailures(client, login, default, ip); }
                catch (Exception error) when (error is OpsException or JsonException or InvalidOperationException or FormatException) { }
                check(login.HasPendingFailures(ip), "HTTP 200 cannot acknowledge an invalid host receipt: " + sample.Name);
                login.Unban(ip, "fixture-reset"); clock.Advance(TimeSpan.FromMilliseconds(10));
            }

            var events = Enumerable.Range(0, 3).Select(_ => Event()).ToArray();
            foreach (var id in events) login.Failure(ip, id);
            var originalTime = login.PendingFailures(3, ip)[0].OccurredAt;
            clock.Advance(TimeSpan.FromMilliseconds(25));
            handler.Response = HostReceipt(ip, clock.GetUtcNow(), 3, banned:true).ToJsonString();
            await PanelSecurityEndpoints.FlushFailures(client, login, default, ip);
            check(!login.HasPendingFailures(ip) && login.Check(ip).Banned, "complete typed host receipts acknowledge the outbox and mirror a cross-service ban");
            var sent = handler.Requests.Where(x => x.Path == "/failures" && events.Contains(x.Body?["eventId"]?.ToString())).ToArray();
            check(sent.Length == 3 && sent.All(x => x.Body?["service"]?.ToString() == "panel"
                && x.Body?["occurredAt"]?.GetValue<double>() == originalTime.ToUnixTimeMilliseconds() / 1000d), "replayed panel events retain original event identities and occurrence times");

            var oldObservation = clock.GetUtcNow(); clock.Advance(TimeSpan.FromMilliseconds(25));
            handler.Response = HostReceipt(ip, clock.GetUtcNow()).ToJsonString();
            var unlocked = await PanelSecurityEndpoints.CheckHost(client, login, ip, default);
            check(unlocked?["banned"]?.GetValue<bool>() == false && !login.Check(ip).Banned && login.Check(ip).FailedAttempts == 0,
                "a typed host console-unban receipt clears the old local ban through CheckHost");
            handler.Response = HostReceipt(ip, oldObservation, 3, banned:true).ToJsonString();
            check(await PanelSecurityEndpoints.CheckHost(client, login, ip, default) == null && !login.Check(ip).Banned,
                "a delayed older HTTP receipt cannot restore a ban cleared by the host");
            handler.Response = HostReceipt(ip, clock.GetUtcNow(), 3, banned:true, generation:9, enabled:false).ToJsonString();
            check(await PanelSecurityEndpoints.CheckHost(client, login, ip, default) == null && login.Policy().Generation == 10 && login.Policy().Enabled,
                "older host generations cannot overwrite either policy or login protection through CheckHost");

            login.Failure(ip, Event()); clock.Advance(TimeSpan.FromMilliseconds(25));
            handler.Response = HostReceipt(ip, clock.GetUtcNow(), accepted:false, ignored:"stale").ToJsonString();
            await PanelSecurityEndpoints.FlushFailures(client, login, default, ip);
            check(!login.HasPendingFailures(ip) && login.Check(ip).FailedAttempts == 0 && !login.Check(ip).Banned,
                "a host reset-cutoff receipt safely retires delayed old failures without recreating a local ban");
            clock.Advance(TimeSpan.FromMilliseconds(25));
            handler.Response = HostReceipt(ip, clock.GetUtcNow(), generation:11, enabled:false).ToJsonString();
            check(await PanelSecurityEndpoints.CheckHost(client, login, ip, default) != null && !login.Policy().Enabled,
                "a newer disabled host policy is mirrored with a typed unbanned state");
        }
        finally
        {
            foreach (var explicitPooling in new[] { false, true })
            {
                var connection = new SqliteConnectionStringBuilder { DataSource = Path.Combine(scratch, "ops.db") };
                if (explicitPooling) connection.Pooling = true;
                using var pooled = new SqliteConnection(connection.ToString()); SqliteConnection.ClearPool(pooled);
            }
            var boundary = Path.Combine(workspace, ".tmp") + Path.DirectorySeparatorChar;
            if (!Path.GetFullPath(scratch).StartsWith(boundary, StringComparison.Ordinal) || new DirectoryInfo(scratch).LinkTarget != null) throw new Exception("Unsafe guard fixture cleanup path");
            if (Directory.Exists(scratch)) Directory.Delete(scratch, recursive:true);
        }
    }

    private sealed class ReceiptClock : TimeProvider
    {
        private DateTimeOffset now = DateTimeOffset.FromUnixTimeMilliseconds(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan elapsed) => now += elapsed;
    }
    private sealed class GuardHandler : HttpMessageHandler
    {
        public string Path = "";
        public JsonObject? Body;
        public HttpStatusCode Status = HttpStatusCode.OK;
        public string Response = "{\"banned\":false}";
        public bool Unavailable;
        public long? KnownLengthBeforeRead;
        public byte[] Bytes = [];
        public bool Chunked, ExpectContinue;
        public string? ContentType;
        public List<(string Path, JsonObject? Body)> Requests { get; } = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (Unavailable) throw new HttpRequestException("fixture-unavailable");
            Path = request.RequestUri!.AbsolutePath;
            // 必须先读取头；ReadAsByteArrayAsync 会缓冲 JsonContent，之后才检查长度会漏掉真实线上 chunked 缺陷。
            KnownLengthBeforeRead = request.Content?.Headers.ContentLength;
            Chunked = request.Headers.TransferEncodingChunked == true;
            ExpectContinue = request.Headers.ExpectContinue == true;
            ContentType = request.Content?.Headers.ContentType?.ToString();
            Bytes = request.Content == null ? [] : await request.Content.ReadAsByteArrayAsync(cancellationToken);
            Body = request.Content == null ? null : JsonNode.Parse(Bytes) as JsonObject;
            Requests.Add((Path, Body?.DeepClone() as JsonObject));
            return new(Status) { Content = new StringContent(Response) };
        }
    }
}
