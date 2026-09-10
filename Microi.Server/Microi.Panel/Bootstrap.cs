using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Microi.Panel;

// 安装容器中的一次性入口：只盘点 Docker 并生成独立编排，不启停现有业务容器。
internal static class Bootstrap
{
    public static async Task Run(CancellationToken ct)
    {
        static string Env(string key, string fallback = "") => Environment.GetEnvironmentVariable(key)?.Trim() ?? fallback;
        var root = Env("OPS_BOOTSTRAP_ROOT", "/microi/ops");
        if (!Path.IsPathFullyQualified(root) || !root.Contains("microi", StringComparison.OrdinalIgnoreCase)) throw new OpsException("安装目录须为包含 microi 的绝对目录。");
        if (!int.TryParse(Env("OPS_HTTP_PORT", "61880"), out var port) || port is < 1024 or > 65535) throw new OpsException("Ops 端口必须在 1024–65535 之间。");
        var publicUrl = OpsOptions.SafeUrl(Env("OPS_PUBLIC_URL", "http://localhost:" + port));
        var frames = string.Join(';', Env("OPS_ALLOWED_FRAME_ORIGINS").Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(x => OpsOptions.SafeUrl(x).GetLeftPart(UriPartial.Authority)));
        var image = Env("OPS_BOOTSTRAP_IMAGE", PanelBootstrap.DefaultImage);
        var initialMode = Env("OPS_BOOTSTRAP_INITIAL_MODE", "Notify");
        if (initialMode is not ("Manual" or "Notify")) throw new OpsException("首次安装仅允许手动或通知模式。");
        var apiName = Env("OPS_BOOTSTRAP_API_NAME", "microi-install-api");
        var webName = Env("OPS_BOOTSTRAP_WEB_NAME", "microi-install-client");
        var options = new OpsOptions(); using var docker = new DockerEngine(options);
        var api = await docker.Inspect(apiName, ct) ?? throw new OpsException("未找到 API 容器，不能推断部署清单。");
        var web = await docker.Inspect(webName, ct) ?? throw new OpsException("未找到 Web 容器，不能推断部署清单。");
        var tenant = (api["Config"]?["Env"]?.AsArray() ?? []).Select(x => x?.ToString() ?? "").FirstOrDefault(x => x.StartsWith("OsClient=", StringComparison.Ordinal))?[9..] ?? "";
        var spec = new DeploymentSpec { Id = Env("OPS_BOOTSTRAP_DEPLOYMENT_ID", "microi"), PlatformOsClient = tenant, PlatformApiBase = Env("OPS_PLATFORM_API_URL") };
        foreach (var (role, name, container) in new[] { ("api", apiName, api), ("web", webName, web) })
        {
            var reference = container["Config"]!["Image"]!.ToString();
            var at = reference.IndexOf('@'); var colon = reference.LastIndexOf(':'); var slash = reference.LastIndexOf('/');
            var repository = at >= 0 ? reference[..at] : colon > slash ? reference[..colon] : reference;
            var tag = at >= 0 ? "latest" : colon > slash ? reference[(colon + 1)..] : "latest";
            var labels = container["Config"]?["Labels"];
            spec.Services.Add(new ServiceSpec
            {
                Name = name, Role = role, Repository = repository, Tag = tag,
                ComposeProject = labels?["com.docker.compose.project"]?.ToString() ?? "",
                ComposeService = labels?["com.docker.compose.service"]?.ToString() ?? "",
                ComposeDirectory = labels?["com.docker.compose.project.working_dir"]?.ToString() ?? "",
                RequireDockerHealth = false,
                ReadyUrl = role == "api" ? "http://" + name + "/apiengine/platform-ops-readiness?OsClient=" + Uri.EscapeDataString(tenant) : "http://" + name + "/",
                ReadyContains = role == "api" ? "\"Ready\"" : "<html", ReadyTimeoutSeconds = role == "api" ? 300 : 60,
                AllowAutomatic = role == "web", ImageRollbackCompatible = role == "web"
            });
        }
        spec.AllowedImageRepositories = spec.Services.Select(x => x.Repository).Distinct().ToArray();
        var networks = api["NetworkSettings"]?["Networks"]?.AsObject().Select(x => x.Key).Intersect(web["NetworkSettings"]?["Networks"]?.AsObject().Select(x => x.Key) ?? []) ?? [];
        var network = networks.FirstOrDefault(x => x is not ("bridge" or "host" or "none"));
        if (network == null) throw new OpsException("API/Web 必须共享用户自建 Docker 网络，才能用服务名执行就绪探测。");
        var networkInfo = await docker.Json(HttpMethod.Get, "/networks/" + Uri.EscapeDataString(network), ct: ct);
        var gateway = networkInfo?["IPAM"]?["Config"]?.AsArray().FirstOrDefault()?["Gateway"]?.ToString() ?? "";
        var proxies = string.Join(';', Env("OPS_TRUSTED_PROXY_IPS", gateway).Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).Select(System.Net.IPAddress.Parse));
        var watchtower = await docker.Inspect("microi-install-watchtower", ct);
        if (watchtower != null && UpdateCoordinator.ExplicitWatchtowerTargets(watchtower)?.SetEquals(spec.Services.Select(x => x.Name)) == true) spec.WatchtowerName = "microi-install-watchtower";
        spec.Validate();
        var configDir = Path.Combine(root, "config"); Directory.CreateDirectory(configDir);
        var dataDir = Path.Combine(root, "data"); Directory.CreateDirectory(dataDir);
        var logs = Env("OPS_BOOTSTRAP_LOG_DIR", "/microi/logs/ops"); Directory.CreateDirectory(logs);
        var deploymentPath = Path.Combine(configDir, "deployment.json");
        var envPath = Path.Combine(configDir, "ops.env");
        if (File.Exists(deploymentPath) || File.Exists(envPath)) throw new OpsException("已有运维配置，保留原账号和策略；请使用原编排更新 Ops。");
        using (var state = new OpsStore(new OpsOptions { DataDir = dataDir }))
            if (state.Get<UpdatePolicy>("policy") == null) state.Set("policy", new UpdatePolicy { Mode = initialMode });
        var env = "OPS_ADMIN_USERNAME=opsadmin\nOPS_ADMIN_PASSWORD=" + Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            + "\nOPS_PUBLIC_URL=" + publicUrl + "\nOPS_ALLOWED_FRAME_ORIGINS=" + frames
            + "\nOPS_TRUSTED_PROXY_IPS=" + proxies
            + "\nOPS_DEPLOYMENT_FILE=/etc/microi-ops/deployment.json\nOPS_LOG_DIR=/microi/logs/ops\nOPS_LOG_RETENTION_DAYS=30\n";
        if (env.Contains('\r')) throw new OpsException("配置不允许换行注入。");
        File.WriteAllText(envPath, env);
        File.WriteAllText(deploymentPath, JsonSerializer.Serialize(spec, new JsonSerializerOptions(JsonDefaults.Options) { WriteIndented = true }));
        var volumes = new JsonArray("/var/run/docker.sock:/var/run/docker.sock", configDir + ":/etc/microi-ops:ro", dataDir + ":/microi/ops/data", logs + ":/microi/logs/ops");
        foreach (var dir in spec.Services.Select(x => x.ComposeDirectory).Where(x => x.Length > 0).Distinct()) volumes.Add(dir + ":" + dir);
        var service = new JsonObject
        {
            ["image"] = image, ["container_name"] = "microi-ops", ["restart"] = "unless-stopped", ["env_file"] = new JsonArray(envPath),
            ["ports"] = new JsonArray("127.0.0.1:" + port + ":8080"), ["volumes"] = volumes, ["networks"] = new JsonArray("platform"),
            ["mem_limit"] = "512m", ["cpus"] = "1.0", ["security_opt"] = new JsonArray("no-new-privileges:true"),
            ["logging"] = new JsonObject { ["driver"] = "json-file", ["options"] = new JsonObject { ["max-size"] = "10m", ["max-file"] = "3" } }
        };
        var compose = new JsonObject { ["name"] = "microi-ops", ["services"] = new JsonObject { ["microi-ops"] = service }, ["networks"] = new JsonObject { ["platform"] = new JsonObject { ["external"] = true, ["name"] = network } } };
        File.WriteAllText(Path.Combine(root, "docker-compose.yml"), compose.ToJsonString(new() { WriteIndented = true }));
        if (!OperatingSystem.IsWindows())
        {
            foreach (var path in new[] { root, configDir, dataDir }) File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            foreach (var path in new[] { envPath, deploymentPath }) File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
        Console.WriteLine("吾码服务器运维面板兼容编排已生成。账号和随机密码保存在 " + envPath + "，不会输出到安装日志。");
        Console.WriteLine("初始模式：" + initialMode + "；旧 Watchtower 保持现状，请在 Ops 中完成受管范围迁移。");
    }
}
