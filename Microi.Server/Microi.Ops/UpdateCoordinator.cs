using Microsoft.AspNetCore.DataProtection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Microi.Ops;

public sealed class UpdateCoordinator(OpsOptions options, OpsStore store, DockerEngine docker, OpsAudit audit, IDataProtectionProvider protection) : BackgroundService
{
    private readonly IDataProtector protector = protection.CreateProtector("microi.ops.container-snapshot.v1");
    private readonly SemaphoreSlim planning = new(1, 1);
    private readonly SemaphoreSlim mutations = new(1, 1);
    public static string Hash(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    private string DeploymentHash => Hash(JsonSerializer.Serialize(options.Deployment, JsonDefaults.Options));
    private ServiceSpec Spec(string name) => options.Deployment.Services.SingleOrDefault(x => x.Name == name) ?? throw new OpsException("该容器未登记为受管服务。", 403);
    private static string Text(JsonNode? node, string key) => node?[key]?.ToString() ?? "";
    private static bool Running(JsonNode? node) => node?["State"]?["Running"]?.GetValue<bool>() == true;
    private static string ConfigHash(JsonNode value) => Hash((value["Config"]?.ToJsonString() ?? "") + (value["HostConfig"]?.ToJsonString() ?? ""));
    private async Task<string> CheckEngine(CancellationToken ct)
    {
        var info = await docker.Info(ct); var id = info?["ID"]?.ToString() ?? throw new OpsException("无法识别 Docker 引擎。", 503);
        var enrolled = store.Get<string>("docker-engine-id");
        if ((options.Deployment.DockerEngineId.Length > 0 && options.Deployment.DockerEngineId != id) || (enrolled != null && enrolled != id))
            throw new OpsException("Docker 引擎与登记目标不一致，已停止写操作。", 409);
        if (enrolled == null) store.Set("docker-engine-id", id);
        var containers = (await docker.Json(HttpMethod.Get, "/containers/json?all=0", ct: ct))!.AsArray();
        if (containers.Count(x => x?["Labels"]?["io.microi.ops.controller"]?.ToString() == "true") > 1)
            throw new OpsException("检测到多个 Ops 控制器，已阻止竞争更新。", 409);
        return id;
    }
    private static void CheckOwnership(ServiceSpec spec, JsonNode container)
    {
        if (Text(container, "Name").TrimStart('/') != spec.Name) throw new OpsException("容器名称与登记信息不一致。", 409);
        var labels = container["Config"]?["Labels"];
        if ((spec.ComposeProject.Length > 0 && labels?["com.docker.compose.project"]?.ToString() != spec.ComposeProject)
            || (spec.ComposeService.Length > 0 && labels?["com.docker.compose.service"]?.ToString() != spec.ComposeService))
            throw new OpsException("Compose 归属不一致，请核对实际项目和服务名。", 409);
        if (labels?["com.docker.swarm.service.id"] != null || Text(container["HostConfig"], "NetworkMode").StartsWith("container:", StringComparison.Ordinal))
            throw new OpsException("该容器拓扑需要专用编排适配器，不能直接替换。", 409);
        if (spec.ComposeProject.Length > 0 && (spec.ComposeDirectory.Length == 0 || !Directory.Exists(spec.ComposeDirectory)))
            throw new OpsException("必须挂载真实 Compose 目录，才能同步受控镜像覆盖文件。", 409);
    }
    public async Task<UpdatePlan> CreatePlan(PlanRequest request, CancellationToken ct)
    {
        await planning.WaitAsync(ct);
        try
        {
            var plan = new UpdatePlan { EngineId = await CheckEngine(ct), DeploymentFingerprint = DeploymentHash };
            var names = request.Services.Distinct().ToArray();
            if (names.Length is < 1 or > 32) throw new OpsException("请选择受管 API/Web 服务。");
            foreach (var name in names.OrderBy(x => Spec(x).Role == "api" ? 0 : 1))
            {
                var spec = Spec(name); var current = await docker.Inspect(name, ct) ?? throw new OpsException("受管容器不存在：" + name, 404);
                CheckOwnership(spec, current);
                var target = request.Targets.GetValueOrDefault(name, spec.Repository + ":" + spec.Tag);
                if (!target.StartsWith(spec.Repository + ":", StringComparison.Ordinal) && !target.StartsWith(spec.Repository + "@sha256:", StringComparison.Ordinal))
                    throw new OpsException("目标镜像必须属于该服务登记的镜像仓库。", 403);
                if (!Regex.IsMatch(target, "^[a-zA-Z0-9./_:@-]{1,500}$")) throw new OpsException("目标镜像引用无效。");
                var oldImage = await docker.Image(Text(current, "Image"), ct) ?? throw new OpsException("原镜像不存在，无法生成恢复计划。", 409);
                var local = request.LocalOnly ? await docker.Image(target, ct) ?? throw new OpsException("本地镜像尚未导入。", 404) : null;
                var digest = request.LocalOnly ? Text(local, "Id") : await docker.RemoteDigest(target, ct);
                var changed = request.LocalOnly ? Text(current, "Image") != digest
                    : !((oldImage["RepoDigests"]?.AsArray() ?? []).Any(x => x?.ToString().EndsWith("@" + digest, StringComparison.Ordinal) == true));
                if (!Running(current) && !request.IncludeStopped) changed = false;
                plan.Services.Add(new()
                {
                    Name = name, Role = spec.Role, OldId = Text(current, "Id"), OldImage = Text(current, "Image"),
                    TargetImage = request.LocalOnly ? target : spec.Repository + "@" + digest, TargetDigest = digest,
                    SnapshotCipher = protector.Protect(current.ToJsonString()), ConfigHash = ConfigHash(current),
                    WasRunning = Running(current), Changed = changed, RollbackAllowed = spec.ImageRollbackCompatible, LocalOnly = request.LocalOnly
                });
            }
            plan.Fingerprint = Hash(JsonSerializer.Serialize(plan.Public(), JsonDefaults.Options) + plan.DeploymentFingerprint);
            store.AddPlan(plan); return plan;
        }
        finally { planning.Release(); }
    }
    public OpsTask Enqueue(SubmitPlan request, string actor)
    {
        mutations.Wait();
        try { return EnqueueCore(request, actor); }
        finally { mutations.Release(); }
    }
    private OpsTask EnqueueCore(SubmitPlan request, string actor)
    {
        var existing = store.FindTask(request.RequestId, true);
        if (existing != null)
        {
            if (existing.PlanId != request.PlanId || existing.DownloadOnly != request.DownloadOnly)
                throw new OpsException("同一请求 Id 不能用于不同计划。", 409);
            return existing;
        }
        var plan = store.Plan(request.PlanId);
        if (request.Fingerprint != plan.Fingerprint || plan.DeploymentFingerprint != DeploymentHash) throw new OpsException("计划已经变化，请重新检查。", 409);
        if (plan.Created < DateTimeOffset.UtcNow.AddMinutes(-30)) throw new OpsException("计划已过期，请重新检查。", 409);
        if (!request.DownloadOnly && !request.ConfirmInterruption) throw new OpsException("请确认本次计划中的服务中断范围。");
        var task = store.Enqueue(plan.Id, request.RequestId, actor, request.DownloadOnly);
        audit.Write("UpdateAccepted", actor, "更新计划已持久化，目标：" + string.Join(", ", plan.Services.Select(x => x.Name)), taskId: task.Id);
        return task;
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var task = store.Tasks(true).FirstOrDefault(x => x.State != "NeedsAttention");
                if (task != null)
                {
                    if (task.State == "Recovering") await Restore(task, stoppingToken);
                    else await RunUpdate(task, stoppingToken);
                }
                else if (store.Tasks(true).Count == 0) await ScheduledCheck(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { audit.Write("ControllerError", "system", error is OpsException ? error.Message : "控制器暂时无法执行，请检查 Docker 与持久存储。", false); }
            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
    }
    private async Task ScheduledCheck(CancellationToken ct)
    {
        var policy = store.Get<UpdatePolicy>("policy") ?? new();
        if (policy.Mode == "Manual" || policy.NextCheck > DateTimeOffset.UtcNow || options.Deployment.Services.Count == 0) return;
        var expected = JsonSerializer.Deserialize<UpdatePolicy>(JsonSerializer.Serialize(policy, JsonDefaults.Options), JsonDefaults.Options)!;
        policy.LastCheck = DateTimeOffset.UtcNow; policy.NextCheck = policy.LastCheck.Value.AddSeconds(policy.IntervalSeconds);
        if (store.Get<UpdatePolicy>("policy") == null) store.Set("policy", expected);
        if (!store.CompareExchange("policy", expected, policy)) return;
        expected = JsonSerializer.Deserialize<UpdatePolicy>(JsonSerializer.Serialize(policy, JsonDefaults.Options), JsonDefaults.Options)!;
        try
        {
            var services = options.Deployment.Services.Where(x => policy.Mode != "Automatic" || x.AllowAutomatic && x.ImageRollbackCompatible).ToArray();
            if (services.Length == 0) { policy.LastError = "没有满足自动更新兼容要求的服务，请检查部署清单。"; store.CompareExchange("policy", expected, policy); return; }
            var plan = await CreatePlan(new(services.Select(x => x.Name).ToArray(), new(), false, false), ct);
            store.Set("last-check-plan", plan.Id);
            policy.LastError = ""; store.CompareExchange("policy", expected, policy);
            if (plan.Services.All(x => !x.Changed)) return;
            var signature = Hash(string.Join("|", plan.Services.Select(x => x.Name + ":" + x.TargetDigest)));
            if (store.Get<string>("last-notified-digests") != signature)
            { audit.Write("UpdateAvailable", "system", "发现受管服务的新镜像。"); store.Set("last-notified-digests", signature); }
            // 在执行前重新读取开关，避免检查期间关闭策略后仍发起更新。
            var latest = store.Get<UpdatePolicy>("policy") ?? new();
            if (latest.Mode == "Download" || latest.Mode == "Automatic" && latest.InWindow(DateTimeOffset.UtcNow)
                && plan.Services.All(x => Spec(x.Name).AllowAutomatic && x.RollbackAllowed))
                Enqueue(new(plan.Id, plan.Fingerprint, Guid.NewGuid().ToString(), true, latest.Mode == "Download"), "scheduler");
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            policy.LastError = error is OpsException ? Redaction.Clean(error.Message) : "自动检查失败，等待下一检查周期。";
            store.CompareExchange("policy", expected, policy); audit.Write("CheckFailed", "system", policy.LastError, false);
        }
    }
    private void Progress(OpsTask task, string phase, int percentage)
    {
        task.Phase = phase; task.Progress = Math.Max(task.Progress, percentage); store.SaveTask(task);
    }
    private async Task RunUpdate(OpsTask task, CancellationToken ct)
    {
        var plan = store.Plan(task.PlanId);
        try
        {
            if (plan.EngineId != await CheckEngine(ct) || plan.DeploymentFingerprint != DeploymentHash) throw new OpsException("引擎或部署清单变化，已停止执行。", 409);
            task.State = "Running"; Progress(task, "核对计划与运行状态", 1);
            var changed = plan.Services.Where(x => x.Changed).ToArray();
            foreach (var service in changed)
            {
                if (task.Steps.ContainsKey(service.Name)) continue;
                var original = await docker.Inspect(service.Name, ct) ?? throw new OpsException("容器已被其它程序改变。", 409);
                if (Text(original, "Id") != service.OldId || ConfigHash(original) != service.ConfigHash || Running(original) != service.WasRunning)
                    throw new OpsException("确认后容器配置或状态已变化，请生成新计划。", 409);
            }
            var lastSave = DateTimeOffset.MinValue; var downloadStarted = DateTimeOffset.UtcNow;
            foreach (var service in changed)
            {
                if (task.Steps.ContainsKey(service.Name)) continue;
                Progress(task, "准备镜像：" + service.Name, 5);
                if (!service.LocalOnly)
                    await docker.Pull(service.TargetImage, item =>
                    {
                        var key = service.Name + ":" + Text(item, "id");
                        var detail = item["progressDetail"];
                        if (detail?["current"] != null) task.Downloaded[key] = detail["current"]!.GetValue<long>();
                        if (detail?["total"] != null) task.DownloadTotals[key] = detail["total"]!.GetValue<long>();
                        var total = task.DownloadTotals.Values.Sum(); var current = task.Downloaded.Values.Sum();
                        var elapsed = (DateTimeOffset.UtcNow - downloadStarted).TotalSeconds;
                        task.EstimatedSeconds = total > current && current > 0 ? Math.Max(0, (total - current) * elapsed / current) : null;
                        if (DateTimeOffset.UtcNow - lastSave > TimeSpan.FromSeconds(1))
                        { lastSave = DateTimeOffset.UtcNow; Progress(task, "拉取镜像：" + service.Name + " · " + Text(item, "status"), total > 0 ? 5 + (int)Math.Min(55, current * 55 / total) : 5); }
                    }, ct);
                var image = await docker.Image(service.TargetImage, ct) ?? throw new OpsException("目标镜像校验失败。", 502);
                var saved = JsonNode.Parse(protector.Unprotect(service.SnapshotCipher))!;
                var oldImage = await docker.Image(service.OldImage, ct) ?? throw new OpsException("原镜像丢失，不能核对实际配置。", 409);
                var effective = CreateBody(saved, service.TargetImage, task.Id, oldImage["Config"]);
                var health = effective["Healthcheck"] ?? image["Config"]?["Healthcheck"];
                if (Spec(service.Name).RequireDockerHealth && (health?["Test"] is not JsonArray tests || tests.Count == 0 || tests[0]?.ToString() == "NONE"))
                    throw new OpsException("目标服务未提供要求的 Docker 健康检查，保持原容器运行。", 409);
                if (service.LocalOnly && Text(image, "Id") != service.TargetDigest) throw new OpsException("本地镜像标签已变化。", 409);
                if (!service.LocalOnly && !(image["RepoDigests"]?.AsArray() ?? []).Any(x => x?.ToString().EndsWith("@" + service.TargetDigest, StringComparison.Ordinal) == true))
                    throw new OpsException("已拉取镜像与批准的摘要不一致。", 409);
            }
            if (!task.DownloadOnly)
            {
                if (task.Actor == "scheduler" && task.Steps.Count == 0)
                {
                    var policy = store.Get<UpdatePolicy>("policy") ?? new();
                    if (policy.Mode != "Automatic" || !policy.InWindow(DateTimeOffset.UtcNow))
                        throw new OpsException("自动更新已关闭或已离开维护窗口，已保留下载镜像并停止切换。", 409);
                }
                await EnsureNoWatchtowerCompetition(ct);
                for (var index = 0; index < changed.Length; index++)
                {
                    var service = changed[index];
                    if (task.Steps.GetValueOrDefault(service.Name) == "Healthy") continue;
                    Progress(task, "切换容器：" + service.Name, 65 + index * 25 / Math.Max(1, changed.Length));
                    await Replace(task, service, ct);
                }
            }
            task.EstimatedSeconds = null; task.State = "Succeeded"; Progress(task, task.DownloadOnly ? "镜像已准备，尚未切换服务" : changed.Length == 0 ? "版本一致，无需重复更新" : "更新完成，必要检查已通过", 100);
            audit.Write("UpdateSucceeded", task.Actor, task.Phase, taskId: task.Id);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception error)
        {
            task.Error = error is OpsException ? Redaction.Clean(error.Message) : "更新中断，请查看 Docker 状态与运维记录。";
            var switched = plan.Services.Where(x => task.Steps.ContainsKey(x.Name)).ToArray();
            task.State = switched.Length == 0 ? "Failed" : switched.All(x => x.RollbackAllowed) ? "Recovering" : "NeedsAttention";
            task.Phase = task.State == "Recovering" ? "更新失败，准备恢复原容器" : "更新失败，需要处理";
            task.EstimatedSeconds = null; store.SaveTask(task); audit.Write("UpdateFailed", task.Actor, task.Error, false, task.Id);
        }
    }
    private async Task Replace(OpsTask task, PlanService service, CancellationToken ct)
    {
        await CheckEngine(ct);
        var spec = Spec(service.Name);
        var current = await docker.Inspect(service.Name, ct);
        if (current?["Config"]?["Labels"]?["io.microi.ops.task"]?.ToString() != task.Id)
        {
            var old = await docker.Inspect(service.OldId, ct) ?? throw new OpsException("原容器丢失，请人工核对恢复材料。", 409);
            if (current != null && Text(current, "Id") != service.OldId) throw new OpsException("同名容器由其它任务创建，已停止替换。", 409);
            task.Steps[service.Name] = "Switching"; store.SaveTask(task);
            await docker.Json(HttpMethod.Post, "/containers/" + service.OldId + "/update", new JsonObject { ["RestartPolicy"] = new JsonObject { ["Name"] = "no" } }, ct);
            if (Running(old)) await docker.Json(HttpMethod.Post, "/containers/" + service.OldId + "/stop?t=" + Math.Clamp(spec.StopTimeoutSeconds, 1, 60), ct: ct);
            if (Text(old, "Name").TrimStart('/') == service.Name)
                await docker.Json(HttpMethod.Post, "/containers/" + service.OldId + "/rename?name=" + Uri.EscapeDataString(service.Name + "-ops-old-" + task.Id[..8]), ct: ct);
            var snapshot = JsonNode.Parse(protector.Unprotect(service.SnapshotCipher))!;
            await DetachNetworks(service.OldId, snapshot, ct);
            var imageBefore = await docker.Image(service.OldImage, ct) ?? throw new OpsException("原镜像丢失，不能核对用户配置与镜像默认值。", 409);
            var body = CreateBody(snapshot, service.TargetImage, task.Id, imageBefore["Config"]);
            var created = await docker.Json(HttpMethod.Post, "/containers/create?name=" + Uri.EscapeDataString(service.Name), body, ct);
            current = await docker.Inspect(Text(created, "Id"), ct) ?? throw new OpsException("新容器创建后未能回读。", 502);
        }
        if (service.WasRunning && !Running(current)) await docker.Json(HttpMethod.Post, "/containers/" + Text(current, "Id") + "/start", ct: ct);
        await Ready(service, ct);
        WriteComposeOverride(spec, service.TargetImage);
        task.Steps[service.Name] = "Healthy"; store.SaveTask(task);
        audit.Write("ContainerReady", task.Actor, service.Name + " 已验证目标镜像和就绪状态。", taskId: task.Id);
    }
    private static JsonObject CreateBody(JsonNode snapshot, string image, string taskId, JsonNode? imageDefaults)
    {
        var config = snapshot["Config"]!.DeepClone().AsObject();
        foreach (var key in config.Select(x => x.Key).Except(new[] { "Hostname", "Domainname", "User", "AttachStdin", "AttachStdout", "AttachStderr", "ExposedPorts", "Tty", "OpenStdin", "StdinOnce", "Env", "Cmd", "Healthcheck", "ArgsEscaped", "Volumes", "WorkingDir", "Entrypoint", "NetworkDisabled", "MacAddress", "OnBuild", "Labels", "StopSignal", "StopTimeout", "Shell" }).ToArray()) config.Remove(key);
        config["Image"] = image;
        // 没有用户覆盖的旧镜像默认值交由新镜像提供；保留与旧默认值不同的实际覆盖。
        foreach (var key in new[] { "Cmd", "Entrypoint", "WorkingDir", "User", "Healthcheck", "StopSignal", "Shell", "OnBuild" })
            if (JsonNode.DeepEquals(config[key], imageDefaults?[key])) config.Remove(key);
        var defaults = (imageDefaults?["Env"]?.AsArray() ?? []).Select(x => x?.ToString() ?? "").ToHashSet(StringComparer.Ordinal);
        config["Env"] = new JsonArray((config["Env"]?.AsArray() ?? []).Where(x => !defaults.Contains(x?.ToString() ?? "")).Select(x => x?.DeepClone()).ToArray());
        // Docker 自动生成的主机名不应复制成新容器的身份。
        if (Text(config, "Hostname") == Text(snapshot, "Id")[..12]) config.Remove("Hostname");
        var labels = config["Labels"] as JsonObject ?? new(); labels["io.microi.ops.task"] = taskId; config["Labels"] = labels;
        var hostConfig = snapshot["HostConfig"]!.DeepClone().AsObject();
        // Config.Volumes 创建的匿名卷必须复用原卷；否则替换会静默得到一个新空卷。
        var mounts = hostConfig["Mounts"] as JsonArray ?? new JsonArray();
        if (hostConfig["Mounts"] == null) hostConfig["Mounts"] = mounts;
        var binds = hostConfig["Binds"]?.AsArray().Select(x => x?.ToString() ?? "").ToArray() ?? [];
        foreach (var mount in snapshot["Mounts"]?.AsArray() ?? [])
        {
            if (mount?["Type"]?.ToString() != "volume") continue;
            var destination = mount["Destination"]!.ToString();
            if (mounts.Any(x => x?["Target"]?.ToString() == destination) || binds.Any(x => x.Contains(":" + destination + ":", StringComparison.Ordinal) || x.EndsWith(":" + destination, StringComparison.Ordinal))) continue;
            mounts.Add(new JsonObject { ["Type"] = "volume", ["Source"] = mount["Name"]!.ToString(), ["Target"] = destination,
                ["ReadOnly"] = mount["RW"]?.GetValue<bool>() == false, ["VolumeOptions"] = new JsonObject { ["NoCopy"] = true } });
        }
        config["HostConfig"] = hostConfig;
        var endpoints = new JsonObject();
        foreach (var network in snapshot["NetworkSettings"]?["Networks"]?.AsObject() ?? new()) endpoints[network.Key] = EndpointConfig(network.Value!);
        config["NetworkingConfig"] = new JsonObject { ["EndpointsConfig"] = endpoints }; return config;
    }
    private static JsonObject EndpointConfig(JsonNode source)
    {
        var result = new JsonObject();
        foreach (var key in new[] { "IPAMConfig", "Links", "Aliases", "DriverOpts", "GwPriority" })
            if (source[key] != null) result[key] = source[key]!.DeepClone();
        return result;
    }
    private async Task DetachNetworks(string id, JsonNode snapshot, CancellationToken ct)
    {
        var current = await docker.Inspect(id, ct);
        foreach (var network in snapshot["NetworkSettings"]?["Networks"]?.AsObject() ?? new())
            if (current?["NetworkSettings"]?["Networks"]?[network.Key] != null)
                await docker.Json(HttpMethod.Post, "/networks/" + Uri.EscapeDataString(network.Key) + "/disconnect", new JsonObject { ["Container"] = id, ["Force"] = true }, ct);
    }
    private async Task Ready(PlanService service, CancellationToken ct)
    {
        var spec = Spec(service.Name); var deadline = DateTimeOffset.UtcNow.AddSeconds(Math.Clamp(spec.ReadyTimeoutSeconds, 5, 1800));
        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(5) };
        while (true)
        {
            var container = await docker.Inspect(service.Name, ct) ?? throw new OpsException("目标容器丢失。", 502);
            var image = await docker.Image(service.TargetImage, ct);
            if (Text(container, "Image") != Text(image, "Id")) throw new OpsException("运行镜像与计划不一致。", 409);
            if (!service.WasRunning) { if (Running(container)) throw new OpsException("原本停止的服务被意外启动。", 409); return; }
            var healthy = Running(container) && (!spec.RequireDockerHealth || container["State"]?["Health"]?["Status"]?.ToString() == "healthy");
            if (healthy && spec.ReadyUrl.Length > 0)
            {
                try { var body = await client.GetStringAsync(spec.ReadyUrl, ct); healthy = spec.ReadyContains.Length > 0 && body.Contains(spec.ReadyContains, StringComparison.Ordinal); }
                catch (HttpRequestException) { healthy = false; }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested) { healthy = false; }
            }
            if (healthy) return;
            if (DateTimeOffset.UtcNow >= deadline) throw new OpsException("服务未在规定时间内就绪：" + service.Name, 502);
            await Task.Delay(1000, ct);
        }
    }
    private static void WriteComposeOverride(ServiceSpec spec, string image)
    {
        if (spec.ComposeDirectory.Length == 0) return;
        // JSON 是 YAML 的子集；由安装器以第二份 Compose 文件显式合并，原用户编排保持原样。
        var path = Path.Combine(spec.ComposeDirectory, "docker-compose.ops.yml");
        var content = File.Exists(path) ? JsonNode.Parse(File.ReadAllText(path))!.AsObject() : new JsonObject();
        var services = content["services"] as JsonObject ?? new JsonObject();
        if (content["services"] == null) content["services"] = services;
        services[spec.ComposeService] = new JsonObject { ["image"] = image };
        var temp = path + ".tmp";
        using (var file = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
        { var bytes = Encoding.UTF8.GetBytes(content.ToJsonString()); file.Write(bytes); file.Flush(true); }
        File.Move(temp, path, true);
    }
    public async Task RequestRestore(string id, string actor, bool confirmCompatibility, CancellationToken ct)
    {
        var task = store.FindTask(id) ?? throw new OpsException("任务不存在。", 404);
        if (task.State is not ("Succeeded" or "NeedsAttention" or "Failed")) throw new OpsException("该任务当前不能恢复。", 409);
        if (store.Tasks(true).Any(x => x.Id != id)) throw new OpsException("另一个更新任务正在执行。", 409);
        var plan = store.Plan(task.PlanId);
        if (!confirmCompatibility && plan.Services.Any(x => x.Changed && !x.RollbackAllowed)) throw new OpsException("该版本未声明数据库向后兼容，请核对兼容性后再确认恢复。");
        await CheckEngine(ct); task.State = "Recovering"; task.Phase = "等待恢复原容器"; store.SaveTask(task);
        audit.Write("RestoreRequested", actor, "管理员请求恢复原容器；不执行数据库恢复。", taskId: task.Id);
    }
    private async Task Restore(OpsTask task, CancellationToken ct)
    {
        try
        {
            await CheckEngine(ct);
            foreach (var service in store.Plan(task.PlanId).Services.Where(x => task.Steps.ContainsKey(x.Name)).Reverse())
            {
                var snapshot = JsonNode.Parse(protector.Unprotect(service.SnapshotCipher))!;
                var old = await docker.Inspect(service.OldId, ct) ?? throw new OpsException("原容器不存在，保留现场等待人工恢复。", 409);
                var current = await docker.Inspect(service.Name, ct);
                if (current != null && Text(current, "Id") != service.OldId)
                {
                    if (current["Config"]?["Labels"]?["io.microi.ops.task"]?.ToString() != task.Id) throw new OpsException("目标已被其它程序替换，拒绝删除。", 409);
                    await docker.Json(HttpMethod.Delete, "/containers/" + Text(current, "Id") + "?force=1&v=0", ct: ct);
                }
                if (Text(old, "Name").TrimStart('/') != service.Name)
                    await docker.Json(HttpMethod.Post, "/containers/" + service.OldId + "/rename?name=" + Uri.EscapeDataString(service.Name), ct: ct);
                foreach (var network in snapshot["NetworkSettings"]?["Networks"]?.AsObject() ?? new())
                    if (old["NetworkSettings"]?["Networks"]?[network.Key] == null)
                        await docker.Json(HttpMethod.Post, "/networks/" + Uri.EscapeDataString(network.Key) + "/connect", new JsonObject { ["Container"] = service.OldId, ["EndpointConfig"] = EndpointConfig(network.Value!) }, ct);
                await docker.Json(HttpMethod.Post, "/containers/" + service.OldId + "/update", new JsonObject { ["RestartPolicy"] = snapshot["HostConfig"]?["RestartPolicy"]?.DeepClone() }, ct);
                if (service.WasRunning && !Running(old)) await docker.Json(HttpMethod.Post, "/containers/" + service.OldId + "/start", ct: ct);
                var verify = new PlanService { Name = service.Name, WasRunning = service.WasRunning, TargetImage = service.OldImage };
                await Ready(verify, ct); WriteComposeOverride(Spec(service.Name), service.OldImage);
            }
            task.State = "RolledBack"; task.Phase = "原容器已恢复；数据库未回退"; store.SaveTask(task);
            audit.Write("RestoreSucceeded", task.Actor, task.Phase, taskId: task.Id);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception error)
        {
            task.State = "NeedsAttention"; task.Phase = "恢复需要人工处理";
            task.Error = Redaction.Clean(task.Error + "；" + (error is OpsException ? error.Message : "恢复时发生错误。")); store.SaveTask(task);
            audit.Write("RestoreFailed", task.Actor, task.Error, false, task.Id);
        }
    }
    private async Task EnsureNoWatchtowerCompetition(CancellationToken ct)
    {
        var containers = (await docker.Json(HttpMethod.Get, "/containers/json?all=0", ct: ct))!.AsArray();
        foreach (var candidate in containers.Where(x => Text(x, "Image").Contains("watchtower", StringComparison.OrdinalIgnoreCase)))
        {
            var container = await docker.Inspect(Text(candidate, "Id"), ct);
            var targets = ExplicitWatchtowerTargets(container);
            if (targets == null || targets.Overlaps(options.Deployment.Services.Select(x => x.Name)))
                throw new OpsException("检测到可能更新受管容器的 Watchtower，请先核对范围并暂停竞争更新器。", 409);
        }
    }
    internal static HashSet<string>? ExplicitWatchtowerTargets(JsonNode? container)
    {
        var cmd = container?["Config"]?["Cmd"]?.AsArray().Select(x => x?.ToString() ?? "").ToArray() ?? [];
        var env = container?["Config"]?["Env"]?.AsArray().Select(x => x?.ToString() ?? "").ToArray() ?? [];
        if (cmd.Contains("--monitor-only") || env.Contains("WATCHTOWER_MONITOR_ONLY=true")) return [];
        var names = new HashSet<string>();
        for (var i = 0; i < cmd.Length; i++)
        {
            var value = cmd[i];
            if (value is "--interval" or "--schedule" or "--stop-timeout") { if (++i >= cmd.Length) return null; continue; }
            if (value is "--rolling-restart" or "--cleanup" or "--include-stopped" or "--revive-stopped" or "--no-pull" or "--no-startup-message") continue;
            if (value.StartsWith('-')) return null;
            if (!Regex.IsMatch(value, "^[a-zA-Z0-9][a-zA-Z0-9_.-]*$")) return null;
            names.Add(value);
        }
        return names.Count == 0 ? null : names;
    }
    public async Task Watchtower(bool enabled, string actor, CancellationToken ct)
    {
        await mutations.WaitAsync(ct);
        try { await WatchtowerCore(enabled, actor, ct); }
        finally { mutations.Release(); }
    }
    private async Task WatchtowerCore(bool enabled, string actor, CancellationToken ct)
    {
        if (store.Tasks(true).Count > 0) throw new OpsException("更新任务执行期间不能切换 Watchtower。", 409);
        var name = options.Deployment.WatchtowerName;
        if (name.Length == 0) throw new OpsException("尚未登记迁移期 Watchtower。");
        var container = await docker.Inspect(name, ct) ?? throw new OpsException("Watchtower 容器不存在。", 404);
        if (!Text(container["Config"], "Image").Contains("watchtower", StringComparison.OrdinalIgnoreCase)) throw new OpsException("登记目标不是 Watchtower。", 409);
        var cmd = container["Config"]?["Cmd"]?.AsArray().Select(x => x?.ToString() ?? "").ToArray() ?? [];
        var managed = options.Deployment.Services.Select(x => x.Name).ToHashSet();
        if (cmd.Any(x => x.StartsWith("--scope", StringComparison.Ordinal) || x.StartsWith("--label", StringComparison.Ordinal))
            || !managed.All(x => cmd.Contains(x))) throw new OpsException("Watchtower 监控范围未能确认，请通过原编排完成迁移。", 409);
        var allowed = new HashSet<string>(managed.Concat(new[] { "--interval", "--rolling-restart", "--cleanup", "--include-stopped" }));
        if (cmd.Any(x => !allowed.Contains(x) && !int.TryParse(x, out _))) throw new OpsException("Watchtower 还可能管理其它服务，拒绝整体启停。", 409);
        if (enabled && (store.Get<UpdatePolicy>("policy") ?? new()).Mode != "Manual") throw new OpsException("恢复旧 Watchtower 前必须将 Ops 策略设为手动。", 409);
        await CheckEngine(ct);
        await docker.Json(HttpMethod.Post, "/containers/" + Text(container, "Id") + "/update", new JsonObject { ["RestartPolicy"] = new JsonObject { ["Name"] = "unless-stopped" } }, ct);
        if (enabled && !Running(container)) await docker.Json(HttpMethod.Post, "/containers/" + Text(container, "Id") + "/start", ct: ct);
        if (!enabled && Running(container)) await docker.Json(HttpMethod.Post, "/containers/" + Text(container, "Id") + "/stop?t=30", ct: ct);
        audit.Write("WatchtowerPolicy", actor, enabled ? "已恢复登记的旧更新器；Ops 保持手动。" : "已暂停登记的旧更新器，重启策略为 unless-stopped。请同步原 Compose 以防人工重建恢复配置。");
    }
}
public sealed record PlanRequest(string[] Services, Dictionary<string, string> Targets, bool LocalOnly = false, bool IncludeStopped = false);
public sealed record SubmitPlan(string PlanId, string Fingerprint, string RequestId, bool ConfirmInterruption, bool DownloadOnly = false);
