using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.FullStack;

// 只运行在新建的独占 StdAdmission_<32位nonce> 租户。
// 真实 HTTP DiyToken -> ApiEngine -> Jint -> Redis/Mongo；没有鉴权/store/锁替身。
[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
public sealed class ManagedStorageAdmissionHttpTests
{
    [Fact]
    public async Task Authenticated_plain_locked_and_Hub_compatibility_paths_share_durable_admission()
    {
        string HostRequired(string key) => Environment.GetEnvironmentVariable(key)
            ?? throw new InvalidOperationException("Missing isolated admission fixture setting: " + key);
        // 原 Full 协议只刷新主/子两个 Token。本专项从同次最终 runtime 的私有回执读身份，
        // 不让旧环境变量、其它候选/轮次的 Token 冒充本轮实际登录。
        var build = JObject.Parse(await File.ReadAllTextAsync(HostRequired("MICROI_TEST_RUNTIME_BUILD_FILE")));
        var ready = JObject.Parse(await File.ReadAllTextAsync(HostRequired("MICROI_TEST_RUNTIME_READY_FILE")));
        var admissionReady = JObject.Parse(await File.ReadAllTextAsync(HostRequired("MICROI_ADMISSION_READY_FILE")));
        Assert.Equal(ready.Value<string>("task"), admissionReady.Value<string>("task"));
        Assert.Equal(build.Value<string>("sourceHead"), admissionReady.Value<string>("sourceHead"));
        Assert.Equal(build.Value<string>("buildId"), admissionReady.Value<string>("buildId"));
        Assert.Equal(ready.Value<string>("attempt"), admissionReady.Value<string>("attempt"));
        Assert.Equal(admissionReady.Value<string>("runtimeBuildSha256"), Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(HostRequired("MICROI_TEST_RUNTIME_BUILD_FILE")))).ToLowerInvariant());
        Assert.Equal(admissionReady.Value<string>("runtimeReadySha256"), Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(HostRequired("MICROI_TEST_RUNTIME_READY_FILE")))).ToLowerInvariant());
        var environmentPath = Path.GetFullPath(HostRequired("MICROI_ADMISSION_ENVIRONMENT_FILE"));
        Assert.Equal(Path.GetFullPath(admissionReady.Value<string>("environmentPath")!), environmentPath);
        var bytes = await File.ReadAllBytesAsync(environmentPath);
        Assert.Equal(admissionReady.Value<string>("environmentSha256"), Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
        var admission = JObject.Parse(Encoding.UTF8.GetString(bytes));
        Assert.False(string.IsNullOrWhiteSpace(ready.Value<string>("task")));
        Assert.Equal(ready.Value<string>("task"), admission.Value<string>("task"));
        Assert.Equal(build.Value<string>("sourceHead"), admission.Value<string>("sourceHead"));
        Assert.Equal(build.Value<string>("buildId"), admission.Value<string>("buildId"));
        Assert.Equal(ready.Value<string>("attempt"), admission.Value<string>("attempt"));
        Assert.True(DateTimeOffset.Parse(admission.Value<string>("credentialsRefreshedAt")!) >= DateTimeOffset.Parse(build.Value<string>("builtAt")!));
        var admissionEnvironment = Assert.IsType<JObject>(admission["env"]);
        string Required(string key) => key.StartsWith("MICROI_ADMISSION_", StringComparison.Ordinal)
            ? admissionEnvironment.Value<string>(key) ?? throw new InvalidOperationException("Missing actual admission identity: " + key)
            : HostRequired(key);
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        var nonce = Required("MICROI_ADMISSION_TEST_OWNER");
        Assert.Matches("^[a-f0-9]{32}$", nonce);
        var tenant = Required("MICROI_ADMISSION_TEST_OSCLIENT");
        Assert.Equal("stdadmission_" + nonce, tenant.ToLowerInvariant());
        var endpoint = new Uri(Required("MICROI_TEST_API_BASE")); Assert.True(endpoint.IsLoopback);
        var token = Required("MICROI_ADMISSION_TEST_TOKEN");
        var did = Required("MICROI_ADMISSION_TEST_DID");
        using var http = new HttpClient { BaseAddress = endpoint, Timeout = TimeSpan.FromSeconds(30) };
        http.DefaultRequestHeaders.TryAddWithoutValidation("authorization", token);
        http.DefaultRequestHeaders.TryAddWithoutValidation("osclient", tenant);
        http.DefaultRequestHeaders.TryAddWithoutValidation("did", did);
        var ct = TestContext.Current.CancellationToken;
        var runId = Guid.NewGuid().ToString("N");
        var originalRowsHash = "";
        var originalBodies = new Dictionary<string, string>();
        var snapshotReady = false;
        var restorePermitted = true;
        async Task<JObject> Native(string action, JObject? values = null)
        {
            var script = Path.GetFullPath(Required("MICROI_ADMISSION_CONTROL_SCRIPT"));
            Assert.Equal(Required("MICROI_ADMISSION_CONTROL_SHA256"), Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(script, CancellationToken.None))).ToLowerInvariant());
            var start = new ProcessStartInfo(Required("MICROI_ADMISSION_CONTROL_PYTHON"))
            {
                UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true,
                RedirectStandardOutput = true, RedirectStandardError = true
            };
            var contextPath = Path.GetFullPath(Required("MICROI_ADMISSION_CONTEXT_FILE"));
            Assert.Equal(Path.GetFullPath(admissionReady.Value<string>("contextFile")!), contextPath);
            Assert.Equal(admissionReady.Value<string>("contextSha256"), Required("MICROI_ADMISSION_CONTEXT_SHA256"));
            start.ArgumentList.Add(script); start.ArgumentList.Add("--context"); start.ArgumentList.Add(contextPath);
            start.ArgumentList.Add("--context-sha256"); start.ArgumentList.Add(Required("MICROI_ADMISSION_CONTEXT_SHA256"));
            start.ArgumentList.Add("--stdio");
            using var child = Process.Start(start) ?? throw new InvalidOperationException("Could not start owned admission fixture control");
            var input = values == null ? new JObject() : (JObject)values.DeepClone();
            input["action"] = action; input["owner"] = nonce; input["tenant"] = tenant;
            input["runId"] = runId; input["requestId"] = Guid.NewGuid().ToString("N");
            await child.StandardInput.WriteAsync(input.ToString(Formatting.None)); child.StandardInput.Close();
            var stdout = child.StandardOutput.ReadToEndAsync(); var stderr = child.StandardError.ReadToEndAsync();
            // helper 每个网络操作有界；取消时仍等原子写入/回读落下结果，不因测试取消杀死未知提交。
            await child.WaitForExitAsync(CancellationToken.None);
            var raw = await stdout; _ = await stderr;
            Assert.True(child.ExitCode == 0, "Owned fixture control failed; preserve its private intent/readback receipts (no automatic mutation retry)");
            var result = JObject.Parse(raw); Assert.Equal(1, result.Value<int>("Code"));
            Assert.Equal(tenant, result.Value<string>("tenant")); Assert.Equal(nonce, result.Value<string>("owner"));
            return result;
        }
        async Task<JObject> Post(string route, JObject body, bool success = true, CancellationToken? cancellation = null)
        {
            var operationToken = cancellation ?? ct;
            using var content = new StringContent(body.ToString(Formatting.None), Encoding.UTF8, "application/json");
            using var response = await http.PostAsync(route, content, operationToken);
            response.EnsureSuccessStatusCode();
            var result = JObject.Parse(await response.Content.ReadAsStringAsync(operationToken));
            if (success) Assert.Equal(1, result.Value<int>("Code"));
            return result;
        }
        string Route(string key) => "apiengine/" + key + "--OsClient--" + tenant + "--";
        const string runtime = "platform-chat-runtime", maintenance = "platform-chat-maintenance";
        var probe = "std_admission_" + nonce;
        var keys = new[] { runtime, maintenance, probe };
        var ids = keys.ToDictionary(key => key, _ => Guid.NewGuid().ToString("N"));
        var probeAttempted = false;
        var cache = "Microi:" + tenant + ":admission-fixture:" + nonce;
        var jsNonce = JsonConvert.SerializeObject(nonce); var jsCache = JsonConvert.SerializeObject(cache);
        var source = "var nonce=" + jsNonce + ",key=" + jsCache + ";\n" + """
            if(!V8.CurrentUser || !V8.CurrentUser.Id) return {Code:0,Msg:'fixture requires actual identity'};
            var action=String(V8.Param.Action||'');
            if(action==='Ping') return {Code:1,Data:{Nonce:nonce,UserId:String(V8.CurrentUser.Id)}};
            if(action==='ListContacts') return {Code:1,Data:{Contacts:[]}};
            if(action==='GetHistoryAndMarkRead') {
              var trusted=V8.Method.RequireManagedProtocolContext();
              if(!trusted || trusted.Code!==1) return {Code:0,Msg:'missing actual Hub protocol'};
            } else if(action!=='Wait') return {Code:0,Msg:'unsupported fixture action'};
            V8.Cache.Set(key+':started',nonce+'|'+String(V8.CurrentUser.Id),60);
            var until=Date.now()+15000;
            while(String(V8.Cache.Get(key+':release')||'')!==nonce) {
              if(Date.now()>until) return {Code:0,Msg:'fixture wait timed out'};
              System.Threading.Thread.Sleep(20);
            }
            return {Code:1,Data:{Nonce:nonce,Messages:[],HasMore:false,NextCursor:''}};
            """;
        var control = "V8.Param.Scope='platform-chat-runtime';return V8.Method.ManageManagedStorageMaintenance(V8.Param);";
        var probeCode = "var nonce=" + jsNonce + ",key=" + jsCache + ";\n" + """
            var action=String(V8.Param.Action||'');
            if(action==='Reset'){V8.Cache.Remove(key+':started');V8.Cache.Remove(key+':release');return {Code:1};}
            if(action==='Started') return {Code:1,Data:String(V8.Cache.Get(key+':started')||'')};
            if(action==='Release'){V8.Cache.Set(key+':release',nonce,60);return {Code:1};}
            if(action==='Cleanup'){V8.Cache.Remove(key+':started');V8.Cache.Remove(key+':release');return {Code:1};}
            if(action==='ForgedKey') return V8.Method.ManageManagedStorageMaintenance({ApiEngineKey:'platform-chat-maintenance',Scope:'platform-chat-runtime',Operation:'Status',MaintenanceConfirmed:true});
            if(action==='MongoPositive'){
              var p={DbName:'diy_chat_'+String(V8.OsClient).toLowerCase(),TableName:'admission_fixture_'+nonce,
                Id:V8.MongoDb.NewId(),OsClient:V8.OsClient};
              p._FormData={_id:p.Id,Value:nonce};
              var added=V8.MongoDb.AddFormData(p);if(added.Code!==1)return added;
              var read=V8.MongoDb.GetFormData(p);
              var removed=V8.MongoDb.DelFormData(p);if(removed.Code!==1)return removed;
              var missing=V8.MongoDb.GetFormData(p);
              // Mongo Find 的空记录成功结果为 Code=1、Data=null，不套用表单引擎的 Code=2。
              var afterDeleteMissing=missing.Code===1 && missing.Data==null;
              return {Code:read.Code===1 && read.Data && read.Data.Value===nonce && afterDeleteMissing?1:0,
                Data:{ReadValue:read.Data?read.Data.Value:null,AfterDeleteCode:missing.Code,AfterDeleteMissing:afterDeleteMissing}};
            }
            return {Code:0,Msg:'unsupported fixture action'};
            """;
        Task<JObject> Probe(string action, CancellationToken? cancellation = null) => Post(Route(probe), new JObject { ["Action"] = action }, cancellation: cancellation);
        Task<JObject> Control(string operation, string epoch = "", long revision = 0, CancellationToken? cancellation = null) => Post(Route(maintenance), new JObject
        { ["Operation"] = operation, ["OperationId"] = Guid.NewGuid().ToString("N"), ["Epoch"] = epoch, ["ExpectedRevision"] = revision }, cancellation: cancellation);

        // 正式开通会安装两个 Managed Key。仅独占新租户允许完整备份后做 BINARY CAS，
        // 原主/子租户、其它引擎、不同 owner 均在控制侧拒绝；HTTP 业务路径仍执行真实实现。
        var snapshot = await Native("snapshot"); snapshotReady = true;
        originalRowsHash = snapshot.Value<string>("originalHash")!;
        foreach (var key in new[] { runtime, maintenance })
        {
            ids[key] = snapshot["engines"]![key]!.Value<string>("Id")!;
            originalBodies[key] = snapshot["engines"]![key]!.Value<string>("bodySha256")!;
        }
        var exists = await Post("api/FormEngine/GetFormData", new JObject { ["FormEngineKey"] = "sys_apiengine",
            ["OsClient"] = tenant, ["_Where"] = new JArray { new JArray("ApiEngineKey", "=", probe) } }, false);
        Assert.Equal(2, exists.Value<int>("Code"));
        try
        {
            JObject Fixture(string body) => new()
            {
                ["ApiName"] = "admission-fixture-" + nonce, ["ApiV8Code"] = body,
                ["IsEnable"] = 1, ["AllowAnonymous"] = 0, ["StopHttp"] = 0, ["Lock"] = 0, ["ApiRole"] = "[]"
            };
            await Native("install", new JObject { ["engines"] = new JObject
            {
                [runtime] = Fixture(source), [maintenance] = Fixture(control)
            }});
            probeAttempted = true;
            await Post("api/FormEngine/AddFormData", new JObject
                {
                    ["FormEngineKey"] = "sys_apiengine", ["OsClient"] = tenant, ["Id"] = ids[probe],
                    ["ApiEngineKey"] = probe, ["ApiName"] = "admission-fixture-" + nonce,
                    ["ApiV8Code"] = probeCode,
                    ["IsEnable"] = 1, ["AllowAnonymous"] = 0, ["StopHttp"] = 0, ["Lock"] = 0, ["ApiRole"] = "[]"
                });
            var ping = await Post(Route(runtime), new JObject { ["Action"] = "Ping" });
            Assert.Equal(nonce, ping["Data"]?.Value<string>("Nonce"));
            Assert.False(string.IsNullOrWhiteSpace(ping["Data"]?.Value<string>("UserId")));
            // 同一已证实有效的新租户 Token 不能借主租户的 Header/路由跨租户调用维护入口。
            // Status 是只读动作，不在借用主租户创建或修改任何资源。
            using (var wrongTenant = new HttpClient { BaseAddress = endpoint, Timeout = TimeSpan.FromSeconds(20) })
            {
                var borrowedMain = Required("MICROI_TEST_OSCLIENT");
                Assert.NotEqual(tenant.ToLowerInvariant(), borrowedMain.ToLowerInvariant());
                wrongTenant.DefaultRequestHeaders.TryAddWithoutValidation("authorization", token);
                wrongTenant.DefaultRequestHeaders.TryAddWithoutValidation("osclient", borrowedMain);
                wrongTenant.DefaultRequestHeaders.TryAddWithoutValidation("did", did);
                using var content = new StringContent(new JObject { ["Operation"] = "Status", ["Scope"] = runtime,
                    ["OsClient"] = borrowedMain }.ToString(Formatting.None), Encoding.UTF8, "application/json");
                using var response = await wrongTenant.PostAsync("apiengine/" + maintenance + "--OsClient--" + borrowedMain + "--", content, ct);
                response.EnsureSuccessStatusCode();
                var refused = JObject.Parse(await response.Content.ReadAsStringAsync(ct));
                Assert.NotEqual(1, refused.Value<int>("Code"));
            }
            var forged = await Post(Route(probe), new JObject { ["Action"] = "ForgedKey" }, false);
            Assert.Equal(0, forged.Value<int>("Code")); Assert.Contains("无权调用", forged.Value<string>("Msg") ?? "");
            foreach (var identity in new[] { "ORDINARY", "ACCESS_KEY" })
            {
                using var unprivileged = new HttpClient { BaseAddress = endpoint, Timeout = TimeSpan.FromSeconds(20) };
                unprivileged.DefaultRequestHeaders.TryAddWithoutValidation("authorization", Required("MICROI_ADMISSION_TEST_" + identity + "_TOKEN"));
                unprivileged.DefaultRequestHeaders.TryAddWithoutValidation("osclient", tenant);
                unprivileged.DefaultRequestHeaders.TryAddWithoutValidation("did", did);
                async Task<JObject> AsIdentity(string key, JObject body)
                {
                    using var content = new StringContent(body.ToString(Formatting.None), Encoding.UTF8, "application/json");
                    using var response = await unprivileged.PostAsync(Route(key), content, ct);
                    response.EnsureSuccessStatusCode(); return JObject.Parse(await response.Content.ReadAsStringAsync(ct));
                }
                // 先证实是真实、有效、同租户身份；过期 Token 不能冒充权限拒绝证据。
                var valid = await AsIdentity(runtime, new JObject { ["Action"] = "Ping" });
                Assert.Equal(1, valid.Value<int>("Code"));
                Assert.Equal(Required("MICROI_ADMISSION_TEST_" + identity + "_USER_ID"), valid["Data"]?.Value<string>("UserId"));
                var refused = await AsIdentity(maintenance, new JObject { ["Operation"] = "Status", ["Scope"] = runtime,
                    ["_CurrentUser"] = new JObject { ["Id"] = "forged-admin", ["Level"] = 9999 } });
                Assert.NotEqual(1, refused.Value<int>("Code"));
                Assert.Contains(identity == "ORDINARY" ? "超级管理员" : "访问密钥", refused.Value<string>("Msg") ?? "");
            }
            var mongo = await Probe("MongoPositive");
            Assert.Equal(nonce, mongo["Data"]?.Value<string>("ReadValue"));
            Assert.Equal(1, mongo["Data"]?.Value<int>("AfterDeleteCode"));
            Assert.True(mongo["Data"]?.Value<bool>("AfterDeleteMissing"));

            foreach (var branch in new[] { "plain", "locked", "hub-compatibility" })
            {
                await Native("lock", new JObject { ["value"] = branch == "locked" ? 1 : 0 });
                var actualModel = await Post("api/FormEngine/GetFormData", new JObject { ["FormEngineKey"] = "sys_apiengine", ["OsClient"] = tenant, ["Id"] = ids[runtime] });
                Assert.Equal(branch == "locked" ? 1 : 0, actualModel["Data"]?.Value<int>("Lock"));
                await Probe("Reset");
                await using var wire = branch == "hub-compatibility" ? await HubWire.Connect(endpoint, tenant, token, did, ct) : null;
                restorePermitted = false;
                Task<JObject> running = wire == null
                    ? Post(Route(runtime), new JObject { ["Action"] = "Wait" })
                    : wire.InvokeHistory(ct);
                try
                {
                    var started = "";
                    for (var attempt = 0; attempt < 100; attempt++)
                    {
                        started = (await Probe("Started")).Value<string>("Data") ?? "";
                        if (started.StartsWith(nonce + "|", StringComparison.Ordinal)) break;
                        await Task.Delay(50, ct);
                    }
                    Assert.StartsWith(nonce + "|", started);
                    var opened = await Control("Status"); Assert.Equal(1, opened["Data"]?.Value<int>("ActiveCount"));
                    var closing = await Control("Begin"); var epoch = closing["Data"]!.Value<string>("Epoch")!;
                    Assert.Equal(1, closing["Data"]!.Value<int>("ActiveCount"));
                    Assert.True(closing["Data"]!.Value<bool>("WriteAdmissionClosed"));
                    Assert.False((await Control("Drain", epoch))["Data"]!.Value<bool>("WritersDrained"));
                    var denied = await Post(Route(runtime), new JObject { ["Action"] = "Ping", ["MaintenanceConfirmed"] = true }, false);
                    Assert.NotEqual(1, denied.Value<int>("Code"));
                    await Probe("Release");
                    var completed = await running.WaitAsync(TimeSpan.FromSeconds(10), ct);
                    if (wire == null) Assert.Equal(1, completed.Value<int>("Code"));
                    else Assert.IsType<JArray>(completed["Messages"]);
                    var drained = await Control("Drain", epoch);
                    Assert.True(drained["Data"]!.Value<bool>("WritersDrained"));
                    Assert.Equal(0, drained["Data"]!.Value<int>("ActiveCount"));
                    var reopened = await Control("End", epoch, drained["Data"]!.Value<long>("Revision"));
                    Assert.Equal("Open", reopened["Data"]!.Value<string>("Phase"));
                }
                finally
                {
                    // 清理不继承已取消的 TestContext：释放请求必须仍能发出。
                    // 本地 HTTP task 结束可能仅是客户端取消，须再由真实 Status 确认服务端排空。
                    using var cleanup = new CancellationTokenSource(TimeSpan.FromSeconds(25));
                    await Probe("Release", cleanup.Token);
                    try { await running.WaitAsync(TimeSpan.FromSeconds(17), cleanup.Token); }
                    catch (OperationCanceledException) { }
                    catch (TimeoutException) { }
                    while (true)
                    {
                        var actual = await Control("Status", cancellation: cleanup.Token);
                        Assert.Equal(JTokenType.Integer, actual["Data"]?["ActiveCount"]?.Type);
                        var active = actual["Data"]!.Value<int>("ActiveCount"); Assert.True(active >= 0);
                        if (active == 0) { restorePermitted = true; break; }
                        await Task.Delay(100, cleanup.Token);
                    }
                    // 未确认排空则不恢复源码、不删 probe、不强制 End，保留 gate 与私有原文供恢复。
                }
            }
        }
        finally
        {
            Assert.True(restorePermitted, "Actual admission drain is unknown; retain the owned probe, maintenance gate and original source receipts for recovery");
            using var finalCleanup = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            try
            {
                // 只删除本测试刚创建的 probe。官方两个固定 Key 始终保留，恢复原文不走删除重建。
                // Add 响应未知也先按发送前固定 Id 回读；不盲目再 Add，未确认身份不得删除。
                if (probeAttempted)
                {
                    var model = await Post("api/FormEngine/GetFormData", new JObject { ["FormEngineKey"] = "sys_apiengine", ["OsClient"] = tenant, ["Id"] = ids[probe] }, false, finalCleanup.Token);
                    if (model.Value<int>("Code") != 2)
                    {
                        Assert.Equal(1, model.Value<int>("Code"));
                        Assert.Equal(probe, model["Data"]?.Value<string>("ApiEngineKey"));
                        Assert.Equal("admission-fixture-" + nonce, model["Data"]?.Value<string>("ApiName"));
                        await Probe("Cleanup", finalCleanup.Token);
                        await Post("api/FormEngine/DelFormData", new JObject { ["FormEngineKey"] = "sys_apiengine", ["OsClient"] = tenant, ["Id"] = ids[probe] }, cancellation: finalCleanup.Token);
                    }
                }
            }
            finally
            {
                if (snapshotReady)
                {
                    // 即便 probe 清理失败也恢复原始 Managed 正文；未知状态/CAS 冲突保留原文并失败。
                    var restored = await Native("restore");
                    Assert.Equal(originalRowsHash, restored.Value<string>("rowsHash"));
                    foreach (var key in new[] { runtime, maintenance })
                    {
                        var model = await Post("api/FormEngine/GetFormData", new JObject { ["FormEngineKey"] = "sys_apiengine", ["OsClient"] = tenant, ["Id"] = ids[key] }, cancellation: finalCleanup.Token);
                        Assert.Equal(key, model["Data"]?.Value<string>("ApiEngineKey"));
                        Assert.Equal(originalBodies[key], Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(model["Data"]!.Value<string>("ApiV8Code")!))).ToLowerInvariant());
                    }
                    // 真正命中本次 API 节点，确保 L1 也没有残留 fixture；Redis DEL 本身不算验收。
                    var originalRuntime = await Post(Route(runtime), new JObject { ["Action"] = "Ping" }, false, finalCleanup.Token);
                    Assert.Equal(0, originalRuntime.Value<int>("Code"));
                    Assert.Equal("不支持的聊天动作。", originalRuntime.Value<string>("Msg"));
                    Assert.NotEqual(nonce, originalRuntime["Data"]?.Value<string>("Nonce"));
                }
            }
        }
    }

    private sealed class HubWire : IAsyncDisposable
    {
        private readonly ClientWebSocket socket = new();
        private readonly Queue<JObject> frames = new();
        private readonly List<byte> partial = new();
        internal static async Task<HubWire> Connect(Uri endpoint, string tenant, string token, string did, CancellationToken ct)
        {
            var wire = new HubWire();
            wire.socket.Options.SetRequestHeader("Authorization", token); wire.socket.Options.SetRequestHeader("did", did);
            var url = new UriBuilder(endpoint) { Scheme = endpoint.Scheme == "https" ? "wss" : "ws", Path = "/diy-websocket", Query = "OsClient=" + Uri.EscapeDataString(tenant) };
            try
            {
                await wire.socket.ConnectAsync(url.Uri, ct);
                await wire.Send(new JObject { ["protocol"] = "json", ["version"] = 1 }, ct);
                Assert.Null((await wire.Next(_ => true, ct))["error"]); return wire;
            }
            catch { await wire.DisposeAsync(); throw; }
        }
        private Task Send(JObject frame, CancellationToken ct) => socket.SendAsync(
            Encoding.UTF8.GetBytes(frame.ToString(Formatting.None) + "\u001e").AsMemory(), WebSocketMessageType.Text, true, ct).AsTask();
        internal async Task<JObject> InvokeHistory(CancellationToken ct)
        {
            await Send(new JObject { ["type"] = 1, ["invocationId"] = "1", ["target"] = "GetChatHistoryPage",
                ["arguments"] = new JArray(new JObject { ["ToUserId"] = "fixture-peer", ["_PageSize"] = 1 }) }, ct);
            var completed = await Next(frame => frame.Value<int?>("type") == 3 && frame.Value<string>("invocationId") == "1", ct);
            Assert.Null(completed["error"]); return Assert.IsType<JObject>(completed["result"]);
        }
        private async Task<JObject> Next(Func<JObject, bool> matches, CancellationToken ct)
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(25));
            var buffer = new byte[8192];
            while (true)
            {
                while (frames.TryDequeue(out var frame)) { Assert.NotEqual(7, frame.Value<int?>("type")); if (matches(frame)) return frame; }
                var read = await socket.ReceiveAsync(buffer.AsMemory(), timeout.Token);
                Assert.NotEqual(WebSocketMessageType.Close, read.MessageType);
                for (var i = 0; i < read.Count; i++)
                    if (buffer[i] == 0x1e) { frames.Enqueue(JObject.Parse(Encoding.UTF8.GetString(partial.ToArray()))); partial.Clear(); }
                    else partial.Add(buffer[i]);
                Assert.True(partial.Count < 65536);
            }
        }
        public async ValueTask DisposeAsync()
        {
            try { if (socket.State == WebSocketState.Open) { using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2)); await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "done", timeout.Token); } }
            finally { socket.Dispose(); }
        }
    }
}
