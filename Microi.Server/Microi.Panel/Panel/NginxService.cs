using System.Text;
using System.Text.Json;

namespace Microi.Panel.Panel;

public sealed record NginxPublishRequest(string RequestId, string Confirm, string ExpectedRevision, NginxConfiguration Configuration);
public sealed class NginxChange
{
    public string Revision { get; set; } = "";
    public string PreviousRevision { get; set; } = "";
    public NginxConfiguration Configuration { get; set; } = new();
    public Dictionary<string, PanelCertificate> Certificates { get; set; } = new();
}

/// <summary>版本目录不可变，current.conf 通过同卷 rename 切换；服务返回新版本号后才提交账本。</summary>
public sealed class NginxService(PanelRepository repository, DockerEngine docker)
{
    public PanelResource Resource(string id)
    {
        var resource = repository.Resource(id);
        if (resource.PluginId != "nginx" || resource.State == "Removed") throw new OpsException("请选择已安装的 Nginx 实例。");
        return resource;
    }
    public object Snapshot(string id)
    {
        var resource = Resource(id);
        return new { resource = resource.Public(), configuration = resource.Websites, revision = resource.ConfigRevision };
    }
    public object Preview(string id, NginxConfiguration config)
    {
        _ = Resource(id); return new { content = NginxConfig.Render(config, "preview", repository.Certificates()) };
    }
    public PanelOperation Publish(string id, NginxPublishRequest request, string actor)
    {
        var resource = Resource(id);
        if (request.Confirm != id || !Guid.TryParse(request.RequestId, out var requestId)) throw new OpsException("请确认 Nginx 实例并提供稳定请求标识。");
        var certificates = repository.Certificates(); NginxConfig.Validate(request.Configuration, certificates);
        var used = request.Configuration.Sites.Select(x => x.CertificateId).Where(x => x.Length > 0).ToHashSet();
        var change = new NginxChange { Revision = "r" + requestId.ToString("N"), PreviousRevision = request.ExpectedRevision,
            Configuration = request.Configuration, Certificates = certificates.Where(x => used.Contains(x.Key)).ToDictionary() };
        PanelCatalog.SafeName(change.PreviousRevision);
        return repository.Enqueue("NginxPublish", request.RequestId, resource, actor, JsonSerializer.Serialize(change, JsonDefaults.Options), request.ExpectedRevision,
            JsonSerializer.Serialize(request, JsonDefaults.Options));
    }
    public async Task Initialize(PanelResource resource, CancellationToken ct)
    {
        // 只在全新安装且没有当前配置时写入；恢复安装不能清空原有网站和证书。
        try { _ = await docker.ReadArchive(resource.ContainerId, NginxConfig.Root + "/current.conf", ct, 128 * 1024); return; }
        catch (OpsException error) when (error.Status == 404) { }
        if (resource.ConfigRevision != NginxConfig.InitialRevision) throw new OpsException("已有网站的活动配置缺失，请从备份恢复；已停止初始化覆盖。", 409);
        var content = NginxConfig.Render(new(), NginxConfig.InitialRevision, new Dictionary<string, PanelCertificate>());
        await docker.PutFiles(resource.ContainerId, NginxConfig.Root, [
            Text("releases/initial/nginx.conf", content), Text("current.conf", Include(NginxConfig.InitialRevision)),
            Text("acme/.keep", ""), Text("sites/.keep", "")
        ], ct);
    }
    public async Task Deploy(PanelResource resource, PanelOperation operation, CancellationToken ct)
    {
        var change = repository.Payload<NginxChange>(operation.Id);
        await Deploy(resource,operation,change,ct);
    }
    public async Task Deploy(PanelResource resource, PanelOperation operation, NginxChange change, CancellationToken ct)
    {
        if (resource.ConfigRevision != change.PreviousRevision && resource.ConfigRevision != change.Revision) throw new OpsException("当前网站版本与任务快照不同，停止覆盖。", 409);
        await AssertRunning(resource, ct);
        var changedActive = false;
        try
        {
            Phase(operation, "生成网站与证书候选版本");
            var content = NginxConfig.Render(change.Configuration, change.Revision, change.Certificates);
            var files = new List<DockerArchiveFile> { Text("releases/" + change.Revision + "/nginx.conf", content) };
            foreach (var certificate in change.Certificates.Values)
            {
                files.Add(Text("releases/" + change.Revision + "/certs/" + certificate.Id + ".crt", certificate.CertificatePem));
                files.Add(Text("releases/" + change.Revision + "/certs/" + certificate.Id + ".key", certificate.PrivateKeyPem));
            }
            await docker.PutFiles(resource.ContainerId, NginxConfig.Root, files, ct);
            Phase(operation, "执行 nginx -t 配置校验");
            await MustRun(resource, ["nginx", "-t", "-c", NginxConfig.Root + "/releases/" + change.Revision + "/nginx.conf"], ct);
            // rename 请求可能成功但响应丢失；在发送前置位，异常时必须恢复原版并回读。
            Phase(operation, "切换配置并平滑重载"); changedActive = true;
            await Activate(resource, change.Revision, ct);
            await WaitRevision(resource, change.Revision, ct);
            resource.ConfigRevision = change.Revision; resource.Websites = change.Configuration; repository.SaveResource(resource);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; } // 保留任务，重启后从持久快照幂等发布。
        catch (Exception original)
        {
            if (changedActive)
            {
                try
                {
                    Phase(operation, "新配置未通过回读，恢复上一版");
                    await Activate(resource, change.PreviousRevision, ct); await WaitRevision(resource, change.PreviousRevision, ct);
                }
                catch (Exception rollback) when (rollback is not OperationCanceledException)
                { throw new OpsException("新配置发布失败，上一版也未能恢复就绪。请检查 Nginx 日志后继续原任务；版本目录已保留。", 502); }
            }
            throw new OpsException((original is OpsException ? original.Message : "Nginx 配置发布失败。") + (changedActive ? " 已恢复上一版并验证就绪。" : " 原配置保持生效。"), 502);
        }
    }
    private async Task Activate(PanelResource resource, string revision, CancellationToken ct)
    {
        PanelCatalog.SafeName(revision);
        await docker.PutFiles(resource.ContainerId, NginxConfig.Root, [Text("next.conf", Include(revision))], ct);
        await MustRun(resource, ["nginx", "-t", "-c", NginxConfig.Root + "/next.conf"], ct);
        await MustRun(resource, ["sync"], ct);
        await MustRun(resource, ["mv", "-f", NginxConfig.Root + "/next.conf", NginxConfig.Root + "/current.conf"], ct);
        await MustRun(resource, ["sync"], ct);
        await MustRun(resource, ["nginx", "-s", "reload", "-c", NginxConfig.Root + "/current.conf"], ct);
    }
    private async Task WaitRevision(PanelResource resource, string revision, CancellationToken ct)
    {
        var deadline = DateTimeOffset.UtcNow.AddSeconds(20);
        while (DateTimeOffset.UtcNow < deadline)
        {
            await AssertRunning(resource, ct);
            var response = await docker.Execute(resource.ContainerId, ["wget", "-q", "-T", "3", "-O", "-", "http://127.0.0.1:8088/ready"], ct, 5);
            if (response.ExitCode == 0 && response.Output.Trim() == revision) return;
            await Task.Delay(250, ct);
        }
        throw new OpsException("Nginx 未返回候选配置版本，不能确认重载成功。", 502);
    }
    private async Task AssertRunning(PanelResource resource, CancellationToken ct)
    {
        var actual = await docker.Inspect(resource.ContainerId, ct) ?? throw new OpsException("Nginx 容器不存在。", 404);
        PanelDockerConfig.AssertOwned(actual, resource);
        if (actual["State"]?["Running"]?.GetValue<bool>() != true) throw new OpsException("请先启动 Nginx 再发布配置。", 409);
    }
    private async Task MustRun(PanelResource resource, string[] command, CancellationToken ct)
    {
        await AssertRunning(resource, ct);
        var result = await docker.Execute(resource.ContainerId, command, ct);
        if (result.ExitCode != 0) throw new OpsException("Nginx 操作未通过：" + Redaction.Clean(result.Output, 2000), 502);
    }
    private void Phase(PanelOperation operation, string phase) { operation.Phase = phase; repository.SaveOperation(operation); }
    private static string Include(string revision) => "include " + NginxConfig.Root + "/releases/" + revision + "/nginx.conf;\n";
    private static DockerArchiveFile Text(string name, string content) => new(name, Encoding.UTF8.GetBytes(content));
}
