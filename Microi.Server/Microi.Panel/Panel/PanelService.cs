using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

/// <summary>单主机持久任务执行器；与宿主故障域独立的业务平台无依赖，重启后回读同一资源继续。</summary>
public sealed class PanelService(PanelRepository repository, DockerEngine docker, OpsStore store, OpsAudit audit, NginxService nginx, PanelFiles files, PanelHostMonitor monitor, PanelBackups backups, PanelAcme acme) : BackgroundService
{
    private readonly SemaphoreSlim actions = new(1, 1);
    public async Task<PanelOperation> Install(PluginInstallRequest request, string actor, CancellationToken ct)
    {
        if (request.Confirm != request.Name) throw new OpsException("请核对实例名称后确认安装。");
        var resource = PanelCatalog.Prepare(request, repository.OwnerId);
        // Created 不参与安装请求指纹，避免相同请求的重试因服务器时间变化被误认为不同参数。
        resource.Created = DateTimeOffset.UnixEpoch;
        await CheckEngine(ct);
        return repository.Enqueue("Install", request.RequestId, resource, actor);
    }
    public PanelOperation Operate(string id, PanelAction request, string actor)
    {
        var resource = repository.Resource(id);
        if (request.Confirm != id) throw new OpsException("请核对实例名称后确认操作。");
        if (request.Action is not ("Start" or "Stop" or "Restart" or "Uninstall" or "Reinstall")) throw new OpsException("操作不在面板允许范围内。");
        if (request.Action == "Reinstall" && resource.State != "Removed") throw new OpsException("只有已卸载的实例可以从保留数据重新安装。",409);
        if (resource.State == "Removed" && request.Action != "Reinstall") throw new OpsException("实例已卸载，可从保留的数据卷重新安装。", 409);
        return repository.Enqueue(request.Action, request.RequestId, resource, actor);
    }
    public async Task<object> Snapshot(CancellationToken ct)
    {
        var items = repository.Resources(); var host = await monitor.Read(ct);
        return new { ownerId = repository.OwnerId, resources = items.Select(x => x.Public()), operations = repository.Operations(),
            containers = host.Containers, host = host.Host, dockerAvailable = host.Available, observedAt = host.ObservedAt, dockerError = host.Error };
    }
    public async Task<string> Logs(string id, CancellationToken ct)
    {
        var resource = repository.Resource(id); _ = await OwnedContainer(resource, ct);
        var result = await docker.Logs(resource.ContainerName, ct);
        foreach (var value in resource.Environment.Where(x => x.Key.Contains("PASSWORD") || x.Key.Contains("PWD") || x.Key.Contains("AUTH")).Select(x => x.Value).Where(x => x.Length > 0)) result = result.Replace(value, "***", StringComparison.Ordinal);
        return result;
    }
    private async Task<JsonNode> CheckEngine(CancellationToken ct)
    {
        var info = await docker.Info(ct) ?? throw new OpsException("Docker 不可用。", 503);
        var id = info["ID"]?.ToString() ?? throw new OpsException("无法确认 Docker 身份。", 503);
        var enrolled = store.Get<string>("docker-engine-id");
        if (enrolled != null && enrolled != id) throw new OpsException("Docker 引擎与已登记目标不同，停止操作。", 409);
        if (enrolled == null) store.Set("docker-engine-id", id);
        var controllers = (await docker.Json(HttpMethod.Get,"/containers/json?all=0",ct:ct))!.AsArray();
        if (controllers.Count(x => x?["Labels"]?["io.microi.ops.controller"]?.ToString() == "true" || x?["Labels"]?["io.microi.panel.controller"]?.ToString() == "true") > 1)
            throw new OpsException("当前 Docker 主机存在多个吾码面板控制器，已停止竞争写入；请只保留一个活动控制器。",409);
        foreach(var helper in controllers.Where(x=>x?["Labels"]?[PanelDockerConfig.OwnerLabel]?.ToString()==repository.OwnerId && x?["Labels"]?[PanelAcme.OperationLabel]!=null))
        {
            var operation=repository.Operation(helper!["Labels"]![PanelAcme.OperationLabel]!.ToString());
            if(operation.State is not ("Running" or "Queued"))throw new OpsException("证书操作的后台容器尚在运行；请先继续其原任务完成恢复，避免与其它维护操作并发写入。",409);
        }
        return info;
    }
    private async Task<JsonNode> OwnedContainer(PanelResource resource, CancellationToken ct)
    {
        var container = await docker.Inspect(resource.ContainerName, ct) ?? throw new OpsException("登记的容器不存在，请查看操作记录。", 404);
        PanelDockerConfig.AssertOwned(container, resource);
        if (resource.ContainerId.Length > 0 && container["Id"]?.ToString() != resource.ContainerId) throw new OpsException("容器已被外部操作替换，请先重新核对。", 409);
        return container;
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var operation = repository.Operations(true).FirstOrDefault();
                if (operation != null) await Execute(operation, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { audit.Write("PanelWorkerError", "system", "面板任务读取失败：" + error.GetType().Name, false); }
            await Task.Delay(1000, stoppingToken);
        }
    }
    public async Task Execute(PanelOperation operation, CancellationToken ct)
    {
        await actions.WaitAsync(ct);
        try
        {
            using var hostOperation = await docker.HostOperations.Enter(ct);
            operation.State = "Running"; Progress(operation, "检查目标主机与资源归属");
            await CheckEngine(ct);
            var resource = repository.Resource(operation.ResourceId);
            if (operation.Action is "Install" or "Reinstall")
            {
                if(operation.Action=="Reinstall")
                {
                    // Recreate only from the exact recorded volume and image. A missing volume
                    // must never silently become an empty replacement for preserved business data.
                    var volume=await docker.Json(HttpMethod.Get,"/volumes/"+resource.VolumeName,ct:ct,allowMissing:true)
                        ??throw new OpsException("保留的数据卷已丢失；请先从备份恢复，不能创建空卷冒充重新安装。",409);
                    PanelDockerConfig.AssertOwned(volume,resource);
                }
                await InstallResource(resource, operation, ct);
            }
            else if (operation.Action == "NginxPublish") await nginx.Deploy(resource, operation, ct);
            else if (operation.Action is "AcmeIssue" or "AcmeRenew") await acme.Execute(resource,operation,ct);
            else if (operation.Action is "FileWrite" or "FileMkdir" or "FileTrash" or "FileRestore") await files.Execute(resource, operation, ct);
            else if (operation.Action == "Backup") await backups.ExecuteBackup(resource, operation, ct);
            else if (operation.Action == "RestoreBackup") await backups.ExecuteRestore(resource, operation, ct);
            else if (operation.Action == "DeleteBackup") await backups.ExecuteDelete(operation);
            else await ChangeState(resource, operation, ct);
            operation.State = "Succeeded"; operation.Error = ""; Progress(operation, "操作完成并已回读");
            audit.Write("Panel" + operation.Action + "Succeeded", operation.Actor, "实例：" + resource.Id, taskId: operation.Id);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; } // 保留 Running 检查点，重启后继续同一操作。
        catch (Exception error)
        {
            operation.State = "Failed"; operation.Error = error is OpsException ? Redaction.Clean(error.Message) : "操作失败（" + error.GetType().Name + "），请检查 Docker、磁盘与操作记录。";
            Progress(operation, "未完成，已保留数据与现场"); audit.Write("PanelOperationFailed", operation.Actor, operation.Error, false, operation.Id);
        }
        finally { actions.Release(); }
    }
    private void Progress(PanelOperation operation, string phase) { operation.Phase = phase; repository.SaveOperation(operation); }
    private async Task InstallResource(PanelResource resource, PanelOperation operation, CancellationToken ct)
    {
        var plugin = PanelCatalog.Get(resource.PluginId);
        var info = await CheckEngine(ct); var architecture = info["Architecture"]?.ToString() switch { "x86_64" => "amd64", "aarch64" => "arm64", var a => a };
        if (!plugin.Versions.Single(x => x.Id == resource.Version).Architectures.Contains(architecture)) throw new OpsException("所选版本不支持当前 CPU 架构。");
        await AssertCapacity(resource, info, ct);
        Progress(operation, "校验并准备镜像");
        if (resource.ImageId.Length == 0)
        {
            if (resource.LocalOnly)
            {
                var local = await docker.Image(resource.Image, ct) ?? throw new OpsException("未找到所选版本的本地镜像。");
                resource.ImageId = local["Id"]!.ToString(); resource.Digest = resource.ImageId;
            }
            else
            {
                // 先持久化不可变摘要；断线重试不能静默跟随发生变化的版本标签。
                if (resource.Digest.Length == 0) { resource.Digest = await docker.RemoteDigest(resource.Image, ct); repository.SaveResource(resource); }
                var repo = resource.Image[..resource.Image.LastIndexOf(':')];
                var pinned = repo + "@" + resource.Digest;
                var lastProgress=DateTimeOffset.MinValue;
                await docker.Pull(pinned, item =>
                {
                    if(DateTimeOffset.UtcNow-lastProgress<TimeSpan.FromSeconds(2))return;
                    lastProgress=DateTimeOffset.UtcNow;
                    Progress(operation,"拉取镜像："+Redaction.Clean((item["status"]?.ToString()??"")+" "+(item["progress"]?.ToString()??""),240));
                }, ct);
                var image = await docker.Image(pinned, ct) ?? throw new OpsException("镜像准备后无法回读。", 502); resource.ImageId = image["Id"]!.ToString();
            }
            repository.SaveResource(resource);
        }
        if (await docker.Image(resource.ImageId, ct) == null) throw new OpsException("计划锁定的镜像已被删除，请恢复该镜像后继续。", 409);
        Progress(operation, "创建独立网络与持久数据卷");
        var networkName = PanelDockerConfig.Network(resource.OwnerId);
        var network = await docker.Json(HttpMethod.Get, "/networks/" + networkName, ct: ct, allowMissing: true);
        if (network == null)
        {
            await docker.Json(HttpMethod.Post, "/networks/create", new JsonObject { ["Name"] = networkName, ["Driver"] = "bridge", ["CheckDuplicate"] = true,
                ["Labels"] = new JsonObject { [PanelDockerConfig.OwnerLabel] = resource.OwnerId } }, ct);
            network = await docker.Json(HttpMethod.Get, "/networks/" + networkName, ct: ct);
        }
        if (network?["Labels"]?[PanelDockerConfig.OwnerLabel]?.ToString() != resource.OwnerId) throw new OpsException("同名网络不属于当前面板。", 409);
        var volume = await docker.Json(HttpMethod.Get, "/volumes/" + resource.VolumeName, ct: ct, allowMissing: true);
        if (volume == null) volume = await docker.Json(HttpMethod.Post, "/volumes/create", new JsonObject { ["Name"] = resource.VolumeName, ["Labels"] = PanelDockerConfig.Labels(resource) }, ct);
        PanelDockerConfig.AssertOwned(volume!, resource);
        var container = await docker.Inspect(resource.ContainerName, ct);
        if (container == null)
        {
            Progress(operation, "检查端口并创建容器");
            await AssertPortsAvailable(resource, ct);
            var config = PanelDockerConfig.Create(resource, resource.ImageId);
            var created = await docker.Json(HttpMethod.Post, "/containers/create?name=" + resource.ContainerName, config, ct);
            resource.ContainerId = created!["Id"]!.ToString(); repository.SaveResource(resource);
        }
        container = await OwnedContainer(resource, ct);
        resource.ContainerId = container["Id"]!.ToString(); repository.SaveResource(resource);
        if (container["Image"]?.ToString() != resource.ImageId) throw new OpsException("容器镜像与计划不一致。", 409);
        if (resource.PluginId == "nginx") await nginx.Initialize(resource, ct);
        if (container["State"]?["Running"]?.GetValue<bool>() != true) await docker.Json(HttpMethod.Post, "/containers/" + resource.ContainerId + "/start", ct: ct);
        Progress(operation, "等待服务就绪（包含首次初始化）"); await Ready(resource, ct);
        resource.State = "Installed"; if (resource.Created == DateTimeOffset.UnixEpoch) resource.Created = operation.Created; repository.SaveResource(resource);
    }
    private async Task AssertPortsAvailable(PanelResource resource, CancellationToken ct)
    {
        var containers = (await docker.Json(HttpMethod.Get, "/containers/json?all=1", ct: ct))!.AsArray();
        foreach (var container in containers.Where(x => x != null))
            foreach (var port in container!["Ports"]?.AsArray() ?? [])
                if (port?["Type"]?.ToString() == "tcp" && port["PublicPort"] is { } hostPort && resource.Ports.Values.Contains(hostPort.GetValue<int>())
                    && (resource.BindAddress == "0.0.0.0" || port["IP"]?.ToString() is "0.0.0.0" or "::" || port["IP"]?.ToString() == resource.BindAddress))
                    throw new OpsException("所选端口已由其它容器占用；请选择独立端口。", 409);
        // 原生进程的端口冲突由 Docker bind 再次原子校验；绝不停止占用者或自动改防火墙。
    }
    private async Task AssertCapacity(PanelResource resource, JsonNode? info, CancellationToken ct)
    {
        var current = (await docker.Json(HttpMethod.Get, "/containers/json?all=0", ct: ct))!.AsArray();
        var running = current.Select(x => x?["Id"]?.ToString() ?? "").ToHashSet(StringComparer.Ordinal);
        // 重启后继续安装任务时，已经在运行的同一容器无需再次预留一份内存。
        if (resource.ContainerId.Length > 0 && running.Contains(resource.ContainerId)) return;
        info ??= await docker.Info(ct);
        PanelCapacity.Assert(info?["MemTotal"]?.GetValue<long>() ?? 0, PanelCapacity.AvailableMemory(), resource.MemoryMb,
            repository.Resources().Where(x => x.Id != resource.Id && running.Contains(x.ContainerId)).Select(x => x.MemoryMb));
    }
    private async Task Ready(PanelResource resource, CancellationToken ct)
    {
        var deadline = DateTimeOffset.UtcNow.AddMinutes(resource.PluginId is "oracle" or "ocr" or "translate" ? 15 : 5);
        while (true)
        {
            var container = await OwnedContainer(resource, ct);
            if (container["Config"]?["Healthcheck"]?["Test"] is not JsonArray checks || checks.Count == 0 || checks[0]?.ToString() == "NONE")
                throw new OpsException("该镜像缺少服务就绪检查，不能仅凭容器运行宣告成功。");
            if (container["State"]?["Running"]?.GetValue<bool>() == true && container["State"]?["Health"]?["Status"]?.ToString() == "healthy") return;
            if (DateTimeOffset.UtcNow > deadline) throw new OpsException("服务未在限时内就绪，保留数据卷与容器；可查看日志后继续原任务。", 502);
            await Task.Delay(2000, ct);
        }
    }
    private async Task ChangeState(PanelResource resource, PanelOperation operation, CancellationToken ct)
    {
        var existing = await docker.Inspect(resource.ContainerName, ct);
        if (operation.Action == "Uninstall" && existing == null) { resource.State = "Removed"; repository.SaveResource(resource); return; }
        var container = await OwnedContainer(resource, ct);
        var running = container["State"]?["Running"]?.GetValue<bool>() == true;
        Progress(operation, "执行 " + operation.Action);
        if (operation.Action is "Stop" or "Uninstall")
        {
            if (running) await PanelDockerRuntime.Stop(docker,resource,ct);
            if (operation.Action == "Uninstall")
            {
                await docker.Json(HttpMethod.Delete, "/containers/" + resource.ContainerId + "?v=false&force=false", ct: ct);
                if (await docker.Inspect(resource.ContainerName, ct) != null) throw new OpsException("卸载后容器仍存在。", 502);
                resource.State = "Removed";
            }
            else { container = await OwnedContainer(resource, ct); if (container["State"]?["Running"]?.GetValue<bool>() == true) throw new OpsException("容器尚未停止。", 502); resource.State = "Stopped"; }
        }
        else
        {
            if (!running) await AssertCapacity(resource, null, ct);
            var started = DateTimeOffset.TryParse(container["State"]?["StartedAt"]?.ToString(), out var time) ? time : DateTimeOffset.MinValue;
            if (operation.Action == "Restart" && started <= operation.Created)
            {
                await PanelDockerRuntime.Stop(docker,resource,ct);
                await docker.Json(HttpMethod.Post,"/containers/"+resource.ContainerId+"/start",ct:ct);
            }
            else if (!running) await docker.Json(HttpMethod.Post, "/containers/" + resource.ContainerId + "/start", ct: ct);
            await Ready(resource, ct); resource.State = "Installed";
        }
        repository.SaveResource(resource);
    }
}
public sealed record PanelAction(string Action, string RequestId, string Confirm);
