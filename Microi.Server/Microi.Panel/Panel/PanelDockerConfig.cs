using System.Text.Json;
using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

public static class PanelDockerConfig
{
    public const string OwnerLabel = "io.microi.panel.owner";
    public const string ResourceLabel = "io.microi.panel.resource";
    public static string Network(string owner) => "mci-panel-" + PanelCatalog.SafeName(owner);
    public static JsonObject Labels(PanelResource spec) => new() { [OwnerLabel] = spec.OwnerId, [ResourceLabel] = spec.Id, ["io.microi.panel.plugin"] = spec.PluginId };
    public static JsonObject Create(PanelResource spec, string imageId)
    {
        var plugin = PanelCatalog.Get(spec.PluginId);
        var ports = new JsonObject(); var exposed = new JsonObject();
        foreach (var port in plugin.Ports)
        {
            var key = port.ContainerPort + "/tcp"; exposed[key] = new JsonObject();
            ports[key] = new JsonArray(new JsonObject { ["HostIp"] = spec.BindAddress, ["HostPort"] = spec.Ports[port.Name].ToString(System.Globalization.CultureInfo.InvariantCulture) });
        }
        var mounts = new JsonArray(new JsonObject { ["Type"] = "volume", ["Source"] = spec.VolumeName, ["Target"] = plugin.DataPath });
        var health = Healthcheck(spec.PluginId);
        var environment = new Dictionary<string, string>(spec.Environment);
        if (spec.PluginId == "translate")
        {
            // 镜像入口用 LT_THREADS 控制 Gunicorn 进程数，LT_WORKERS 会被忽略。
            // 保留旧任务原始参数，只在创建/从保留卷重装时归一化受信服务配置。
            environment.Remove("LT_WORKERS");
            environment["LT_THREADS"] = "1";
        }
        var config = new JsonObject
        {
            ["Image"] = imageId, ["Labels"] = Labels(spec), ["ExposedPorts"] = exposed,
            ["Env"] = JsonSerializer.SerializeToNode(environment.Select(x => x.Key + "=" + x.Value).ToArray()),
            ["HostConfig"] = new JsonObject
            {
                ["Privileged"] = false, ["NetworkMode"] = Network(spec.OwnerId), ["PortBindings"] = ports, ["Mounts"] = mounts,
                ["Memory"] = spec.MemoryMb * 1024L * 1024L, ["MemorySwap"] = spec.MemoryMb * 1024L * 1024L,
                ["PidsLimit"] = 1024, ["RestartPolicy"] = new JsonObject { ["Name"] = "unless-stopped" },
                ["LogConfig"] = new JsonObject { ["Type"] = "json-file", ["Config"] = new JsonObject { ["max-size"] = "10m", ["max-file"] = "3" } }
            }
        };
        if (spec.Command.Length > 0) config["Cmd"] = JsonSerializer.SerializeToNode(spec.Command);
        if(spec.PluginId=="sqlserver")
        {
            // The catalog doesn't expose Microsoft's custom setup hooks. Keep its
            // permissions preflight and exec the server so Docker signals reach it.
            config["Entrypoint"]=new JsonArray("/bin/bash","-c","/opt/mssql/bin/permissions_check.sh && exec /opt/mssql/bin/sqlservr");
            config["Cmd"]=new JsonArray();
        }
        if (spec.PluginId == "nginx") config["HostConfig"]!["ExtraHosts"] = new JsonArray("host.docker.internal:host-gateway");
        if (spec.PluginId == "ocr")
        {
            config["HostConfig"]!["ShmSize"] = 4L * 1024 * 1024 * 1024;
            config["HostConfig"]!["NanoCpus"] = 4_000_000_000L;
            config["HostConfig"]!["Init"] = true;
            config["HostConfig"]!["CapDrop"] = new JsonArray("ALL");
            config["HostConfig"]!["SecurityOpt"] = new JsonArray("no-new-privileges:true");
            config["StopTimeout"] = 90;
        }
        if (health != null) config["Healthcheck"] = new JsonObject { ["Test"] = JsonSerializer.SerializeToNode(health), ["Interval"] = 10_000_000_000L, ["Timeout"] = 5_000_000_000L, ["Retries"] = 30, ["StartPeriod"] = 60_000_000_000L };
        return config;
    }
    // 命令来自受信目录常量；密码通过容器环境读取，不拼接用户输入为 Shell。
    public static string[]? Healthcheck(string plugin) => plugin switch
    {
        "nginx" => ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8088/ready"],
        "mysql" => ["CMD-SHELL", "MYSQL_PWD=\"$MYSQL_ROOT_PASSWORD\" mysql --protocol=TCP -h127.0.0.1 -uroot -Nse 'SELECT 1' >/dev/null"],
        "postgresql" => ["CMD-SHELL", "PGPASSWORD=\"$POSTGRES_PASSWORD\" psql -h127.0.0.1 -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -v ON_ERROR_STOP=1 -Atc 'SELECT 1' >/dev/null"],
        // 原厂镜像在首次设置密码之前可能已通过本地 OS 认证的健康检查。
        // 必须使用本次配置的账号密码经 TCP 访问业务 PDB，避免提前宣告安装成功。
        "oracle" => ["CMD", "/bin/bash", "-lc", "printf '%s\\n' 'WHENEVER OSERROR EXIT FAILURE' 'WHENEVER SQLERROR EXIT FAILURE' 'SELECT 1 FROM dual;' 'EXIT' | sqlplus -L -s \"system/\\\"$ORACLE_PWD\\\"@//127.0.0.1:1521/FREEPDB1\" >/dev/null 2>&1"],
        "redis" => ["CMD", "redis-cli", "ping"],
        "mongodb" => ["CMD-SHELL", "mongosh --quiet --username \"$MONGO_INITDB_ROOT_USERNAME\" --password \"$MONGO_INITDB_ROOT_PASSWORD\" --authenticationDatabase admin --eval 'db.adminCommand({ping:1})' >/dev/null"],
        "minio" => ["CMD-SHELL", "curl -fsS http://127.0.0.1:9000/minio/health/ready >/dev/null"],
        "sqlserver" => ["CMD-SHELL", "SQLCMDPASSWORD=\"$MSSQL_SA_PASSWORD\"; export SQLCMDPASSWORD; p=/opt/mssql-tools18/bin/sqlcmd; [ -x \"$p\" ] || p=/opt/mssql-tools/bin/sqlcmd; \"$p\" -S localhost -U sa -C -Q 'SELECT 1' -b -o /dev/null"],
        // Argos 模型包使用 zh，LibreTranslate HTTP API 使用 zh-Hans；必须确认中英双向可用。
        "translate" => ["CMD", "/app/venv/bin/python", "-c", "import json,urllib.request; data=json.load(urllib.request.urlopen('http://127.0.0.1:5000/languages',timeout=4)); routes={x['code']:set(x.get('targets',[])) for x in data}; assert any('en' in routes.get(code,set()) and code in routes.get('en',set()) for code in ('zh-Hans','zh'))"],
        "ocr" => ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=4)\""],
        _ => null // 未配置检查时仍要求镜像提供就绪检查，缺失则拒绝宣告安装成功。
    };
    public static void AssertOwned(JsonNode value, PanelResource spec)
    {
        var labels = value["Config"]?["Labels"] ?? value["Labels"];
        if (labels?[OwnerLabel]?.ToString() != spec.OwnerId || labels?[ResourceLabel]?.ToString() != spec.Id)
            throw new OpsException("该资源不属于当前面板，已保留现场并停止操作。", 409);
    }
}
