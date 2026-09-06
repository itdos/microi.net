using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Net;

namespace Microi.Ops;

public sealed class OpsOptions
{
    public string AdminUsername { get; init; } = "";
    public string AdminPassword { private get; init; } = "";
    public string DataDir { get; init; } = "";
    public string LogDir { get; init; } = "";
    public int LogRetentionDays { get; init; } = 30;
    public Uri PublicUrl { get; init; } = null!;
    public string[] FrameOrigins { get; init; } = [];
    public IPAddress[] TrustedProxyIps { get; init; } = [];
    public string DockerSocket { get; init; } = "/var/run/docker.sock";
    public string RegistryConfigFile { get; init; } = "";
    public string PlatformCertificateFile { get; init; } = "";
    public DeploymentSpec Deployment { get; init; } = new();
    public string CredentialVersion => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(AdminUsername + "\0" + AdminPassword)));
    private readonly byte[] salt = RandomNumberGenerator.GetBytes(32);
    private byte[]? passwordHash;

    public bool ValidatePassword(string account, string password)
    {
        passwordHash ??= Rfc2898DeriveBytes.Pbkdf2(AdminPassword, salt, 210000, HashAlgorithmName.SHA512, 64);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 210000, HashAlgorithmName.SHA512, 64);
        return CryptographicOperations.FixedTimeEquals(actual, passwordHash) & string.Equals(account, AdminUsername, StringComparison.Ordinal);
    }

    public static OpsOptions Load()
    {
        static string Env(string key, string fallback = "") => Environment.GetEnvironmentVariable(key)?.Trim() ?? fallback;
        var password = Environment.GetEnvironmentVariable("OPS_ADMIN_PASSWORD") ?? "";
        var passwordFile = Env("OPS_ADMIN_PASSWORD_FILE");
        if (password.Length > 0 && passwordFile.Length > 0) throw new InvalidOperationException("OPS_ADMIN_PASSWORD 与 OPS_ADMIN_PASSWORD_FILE 只能配置一个。");
        if (passwordFile.Length > 0) password = File.ReadAllText(passwordFile).TrimEnd('\r', '\n');
        var account = Env("OPS_ADMIN_USERNAME");
        if (account.Length is < 1 or > 80 || password.Length is < 12 or > 512)
            throw new InvalidOperationException("请配置独立运维账号和至少 12 位密码；不提供默认密码。");
        var publicUrl = SafeUrl(Env("OPS_PUBLIC_URL", "http://localhost:61880"));
        var deploymentFile = Env("OPS_DEPLOYMENT_FILE", "/etc/microi-ops/deployment.json");
        var spec = File.Exists(deploymentFile)
            ? JsonSerializer.Deserialize<DeploymentSpec>(File.ReadAllText(deploymentFile), JsonDefaults.Options) ?? new()
            : new DeploymentSpec();
        spec.Validate();
        var frames = Env("OPS_ALLOWED_FRAME_ORIGINS").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => SafeUrl(x).GetLeftPart(UriPartial.Authority)).Distinct().ToArray();
        return new()
        {
            AdminUsername = account, AdminPassword = password, PublicUrl = publicUrl,
            DataDir = Absolute(Env("OPS_DATA_DIR", "/microi/ops/data")),
            LogDir = Absolute(Env("OPS_LOG_DIR", "/microi/logs/ops")),
            LogRetentionDays = Math.Clamp(int.TryParse(Env("OPS_LOG_RETENTION_DAYS"), out var days) ? days : 30, 1, 365),
            DockerSocket = Env("OPS_DOCKER_SOCKET", "/var/run/docker.sock"), FrameOrigins = frames,
            TrustedProxyIps = Env("OPS_TRUSTED_PROXY_IPS").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(IPAddress.Parse).ToArray(),
            Deployment = spec, PlatformCertificateFile = Env("OPS_PLATFORM_CERTIFICATE_FILE"), RegistryConfigFile = Env("OPS_REGISTRY_CONFIG_FILE")
        };
    }

    private static string Absolute(string path) => Path.IsPathFullyQualified(path)
        ? Path.GetFullPath(path) : throw new InvalidOperationException("Ops 数据和日志目录必须为绝对路径。");

    public static Uri SafeUrl(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.UserInfo.Length > 0 || uri.Fragment.Length > 0 || uri.Query.Length > 0
            || (uri.Scheme != "https" && !(uri.Scheme == "http" && uri.IsLoopback)))
            throw new OpsException("地址必须为 HTTPS；HTTP 仅允许本机回环测试地址。", 400);
        return uri;
    }
}

public sealed class DeploymentSpec
{
    public string Id { get; set; } = "microi";
    public string Name { get; set; } = "吾码平台";
    public string PlatformApiBase { get; set; } = "";
    public string PlatformOsClient { get; set; } = "";
    public string DockerEngineId { get; set; } = "";
    public string WatchtowerName { get; set; } = "";
    public List<ServiceSpec> Services { get; set; } = [];
    public string[] AllowedImageRepositories { get; set; } = [];
    public void Validate()
    {
        if (!Regex.IsMatch(Id, "^[a-zA-Z0-9_-]{1,64}$")) throw new OpsException("部署 Id 无效。");
        if (PlatformApiBase.Length > 0) OpsOptions.SafeUrl(PlatformApiBase);
        if (Services.Count > 32 || Services.Select(x => x.Name).Distinct().Count() != Services.Count) throw new OpsException("受管服务重复或超过 32 项。");
        foreach (var service in Services)
        {
            if (!Regex.IsMatch(service.Name, "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$") || !new[] { "api", "web" }.Contains(service.Role))
                throw new OpsException("只允许登记明确名称的 API/Web 服务。");
            if (string.IsNullOrEmpty(service.Repository) || !AllowedImageRepositories.Contains(service.Repository))
                throw new OpsException("受管镜像仓库必须在部署清单白名单中。");
            if (service.ReadyUrl.Length > 0 && (!Uri.TryCreate(service.ReadyUrl, UriKind.Absolute, out var ready)
                || ready.Scheme is not ("http" or "https") || ready.UserInfo.Length > 0 || ready.Fragment.Length > 0))
                throw new OpsException("就绪探测地址必须为不含凭据的 HTTP/HTTPS 地址。");
            if (!service.RequireDockerHealth && (service.ReadyUrl.Length == 0 || service.ReadyContains.Length == 0))
                throw new OpsException("每个受管服务必须配置 Docker 健康检查或有效的就绪探测。");
        }
    }
}

public sealed class ServiceSpec
{
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string Repository { get; set; } = "";
    public string Tag { get; set; } = "latest";
    public string ComposeProject { get; set; } = "";
    public string ComposeService { get; set; } = "";
    public string ComposeDirectory { get; set; } = "";
    public string ReadyUrl { get; set; } = "";
    public string ReadyContains { get; set; } = "";
    public bool RequireDockerHealth { get; set; } = true;
    public bool AllowAutomatic { get; set; }
    public bool ImageRollbackCompatible { get; set; }
    public int StopTimeoutSeconds { get; set; } = 30;
    public int ReadyTimeoutSeconds { get; set; } = 180;
}

public sealed class UpdatePolicy
{
    public string Mode { get; set; } = "Notify";
    public int IntervalSeconds { get; set; } = 3600;
    public string TimeZone { get; set; } = "Asia/Shanghai";
    public int WindowStartHour { get; set; } = 2;
    public int WindowEndHour { get; set; } = 5;
    public DateTimeOffset? LastCheck { get; set; }
    public DateTimeOffset? NextCheck { get; set; }
    public string LastError { get; set; } = "";
    public void Validate()
    {
        if (!new[] { "Manual", "Notify", "Download", "Automatic" }.Contains(Mode) || IntervalSeconds is < 60 or > 604800
            || WindowStartHour is < 0 or > 23 || WindowEndHour is < 0 or > 23)
            throw new OpsException("更新策略参数无效。");
        _ = TimeZoneInfo.FindSystemTimeZoneById(TimeZone);
    }
    public bool InWindow(DateTimeOffset now)
    {
        var hour = TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(TimeZone)).Hour;
        return WindowStartHour == WindowEndHour || (WindowStartHour < WindowEndHour
            ? hour >= WindowStartHour && hour < WindowEndHour : hour >= WindowStartHour || hour < WindowEndHour);
    }
}

public sealed class OpsException(string message, int status = 400) : Exception(message)
{
    public int Status { get; } = status;
}
public static class JsonDefaults
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { WriteIndented = false };
}
