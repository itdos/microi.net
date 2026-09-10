using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

public static class PanelDockerRuntime
{
    // SQL Server CU18+ launch_sqlservr.sh starts the watchdog in the background
    // without forwarding SIGTERM (microsoft/mssql-docker#968). This fixed command
    // only targets its direct sqlservr child inside an already verified container.
    private const string SqlServerSignal = "for panel_pid in $(ps -eo pid=,ppid=,comm= | awk '$2 == 1 && $3 == \"sqlservr\" {print $1}'); do case \"$panel_pid\" in *[!0-9]*|'') exit 1;; esac; kill -TERM \"$panel_pid\"; done";
    public static async Task Stop(DockerEngine docker,PanelResource resource,CancellationToken ct)
    {
        var current=await Owned(docker,resource,ct);
        if(current["State"]?["Running"]?.GetValue<bool>()!=true)return;
        var legacySql=resource.PluginId=="sqlserver"&&current["Config"]?["Entrypoint"]?[0]?.ToString()=="/opt/mssql/bin/launch_sqlservr.sh";
        // Start Docker's stop operation first so the daemon suppresses restart-policy
        // restarts. While it waits, compensate the legacy wrapper's missing signal.
        var stopping=docker.Json(HttpMethod.Post,"/containers/"+current["Id"]+"/stop?t=60",ct:ct);
        try
        {
            if(legacySql && await Task.WhenAny(stopping,Task.Delay(350,ct))!=stopping)
            {
                var latest=await docker.Inspect(current["Id"]!.ToString(),ct);
                if(latest?["State"]?["Running"]?.GetValue<bool>()==true)
                {
                    PanelDockerConfig.AssertOwned(latest,resource);
                    var signaled=await docker.Execute(current["Id"]!.ToString(),["/bin/bash","-c",SqlServerSignal],ct);
                    if(signaled.ExitCode!=0)throw new OpsException("SQL Server 停机信号转发失败，请查看服务日志。",502);
                }
            }
        }
        finally { await stopping; }
    }
    public static async Task<JsonNode> Owned(DockerEngine docker, PanelResource resource, CancellationToken ct)
    {
        var container = await docker.Inspect(resource.ContainerName, ct) ?? throw new OpsException("登记的容器不存在，请查看操作记录。", 404);
        PanelDockerConfig.AssertOwned(container, resource);
        if (resource.ContainerId.Length > 0 && container["Id"]?.ToString() != resource.ContainerId) throw new OpsException("容器已被外部操作替换，请先重新核对。", 409);
        return container;
    }
    public static async Task Ready(DockerEngine docker, PanelResource resource, CancellationToken ct)
    {
        var deadline = DateTimeOffset.UtcNow.AddMinutes(resource.PluginId is "oracle" or "ocr" or "translate" ? 15 : 5);
        while (true)
        {
            var container = await Owned(docker, resource, ct);
            if (container["Config"]?["Healthcheck"]?["Test"] is not JsonArray checks || checks.Count == 0 || checks[0]?.ToString() == "NONE") throw new OpsException("该镜像缺少服务就绪检查，不能仅凭容器运行宣告成功。");
            if (container["State"]?["Running"]?.GetValue<bool>() == true && container["State"]?["Health"]?["Status"]?.ToString() == "healthy") return;
            if (DateTimeOffset.UtcNow > deadline) throw new OpsException("服务未在限时内就绪，保留数据卷与容器；可查看日志后继续原任务。", 502);
            await Task.Delay(2000, ct);
        }
    }
}
