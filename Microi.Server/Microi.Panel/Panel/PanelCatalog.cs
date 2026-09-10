using System.Net;
using System.Text.RegularExpressions;

namespace Microi.Panel.Panel;

public sealed record PluginVersion(string Id, string Image, string[] Architectures, string Note = "");
public sealed record PluginPort(string Name, int ContainerPort, int DefaultHostPort);
public sealed record PanelPlugin(string Id, string Name, string Category, string Description, string DataPath,
    int MemoryMb, PluginVersion[] Versions, PluginPort[] Ports, bool RequiresPassword = false, string LicenseUrl = "");

public sealed class PluginInstallRequest
{
    public string RequestId { get; set; } = "";
    public string PluginId { get; set; } = "";
    public string Version { get; set; } = "";
    public string Name { get; set; } = "";
    public string BindAddress { get; set; } = "127.0.0.1";
    public Dictionary<string, int> Ports { get; set; } = new();
    public string Password { get; set; } = "";
    public string Username { get; set; } = "microi";
    public string Database { get; set; } = "microi";
    public string Edition { get; set; } = "Express";
    public bool AcceptLicense { get; set; }
    public int MemoryMb { get; set; }
    public bool LocalOnly { get; set; }
    public string Confirm { get; set; } = "";
}

/// <summary>发布方维护的有类型目录。浏览器只能选择已声明的版本和参数，不能提交容器特权或宿主机路径。</summary>
public static class PanelCatalog
{
    private const string Registry = "registry.cn-hangzhou.aliyuncs.com/microios/";
    private static PluginVersion V(string id, string image, params string[] arch) => new(id, Registry + image, arch.Length > 0 ? arch : ["amd64", "arm64"]);
    public static IReadOnlyList<PanelPlugin> All { get; } = [
        new("nginx", "Nginx", "网站", "网站、反向代理与 HTTPS 入口", NginxConfig.Root, 256,
            [V("1.30.4", "nginx:1.30.4-alpine"), V("1.31.5", "nginx:1.31.5-alpine")], [new("http",80,18080),new("https",443,18443)]),
        new("mysql", "MySQL", "数据库", "关系型数据库，数据卷独立保留", "/var/lib/mysql", 1024,
            [V("8.4.11", "mysql:8.4.11"), V("8.0.46", "mysql:8.0.46") with { Note = "8.0 社区版本已结束维护，仅用于已有应用的兼容迁移。新安装建议选择 8.4。" }], [new("database",3306,13306)], true),
        new("postgresql", "PostgreSQL", "数据库", "关系型数据库", "/var/lib/postgresql/data", 512,
            [V("17.11", "postgres:17.11"), V("16.15", "postgres:16.15")], [new("database",5432,15432)], true),
        new("sqlserver", "SQL Server", "数据库", "Microsoft SQL Server；按实际授权选择版本和版本类型", "/var/opt/mssql", 3072,
            [V("2022-CU26-GDR1", "mssql-server:2022-CU26-GDR1-ubuntu-22.04", "amd64"), V("2019-CU32-GDR11", "mssql-server:2019-CU32-GDR11-ubuntu-20.04", "amd64")],
            [new("database",1433,11433)], true, "https://www.microsoft.com/licensing/terms/productoffering/SQLServer/all"),
        // Oracle 原厂镜像不通过公共镜像仓库再分发；许可由安装者明确确认。
        new("oracle", "Oracle Database Free", "数据库", "Oracle 免费版本；使用原厂镜像并遵循原厂使用条件", "/opt/oracle/oradata", 3072,
            [new("23.26.3.0-lite", "container-registry.oracle.com/database/free:23.26.3.0-lite", ["amd64", "arm64"])],
            [new("database",1521,11521)], true, "https://www.oracle.com/database/free/"),
        new("minio", "MinIO Community", "存储", "兼容 S3 的对象存储；社区上游已停止维护", "/data", 512,
            [V("2025-10-15-microi1", "minio:2025-10-15-microi1") with { Note = "基于最后社区安全版本源码构建；上游仓库已归档。使用遵循 AGPLv3；需要持续厂商支持时请选择原厂 AIStor 服务。" }], [new("api",9000,19000),new("console",9001,19001)], true, "https://github.com/minio/minio/blob/RELEASE.2025-10-15T17-29-55Z/LICENSE"),
        new("redis", "Redis", "数据库", "缓存与持久化数据服务", "/data", 256,
            [V("7.4.11", "redis:7.4.11"), V("8.10.1", "redis:8.10.1")], [new("database",6379,16379)], true),
        new("mongodb", "MongoDB", "数据库", "文档数据库", "/data/db", 768,
            [V("8.0.30", "mongo:8.0.30"),V("7.0.41", "mongo:7.0.41")], [new("database",27017,17017)], true),
        new("translate", "LibreTranslate", "AI 服务", "本地翻译服务，首次启动需准备语言模型", "/home/libretranslate/.local", 2048,
            [V("1.9.6-microi1", "libretranslate:1.9.6-microi1", "amd64")], [new("http",5000,15000)]),
        new("ocr", "PaddleX OCR", "AI 服务", "本地 OCR 服务，镜像内置识别模型", "/home/microi/.paddlex", 8192,
            [V("3.6.1-paddle3.2.2-cpu", "paddlex-ocr:3.6.1-paddle3.2.2-cpu", "amd64")], [new("http",8080,18081)])
    ];
    public static PanelPlugin Get(string id) => All.SingleOrDefault(x => x.Id == id) ?? throw new OpsException("插件不存在。", 404);
    public static string SafeName(string value)
    {
        if (value == null || !Regex.IsMatch(value, "^[a-z][a-z0-9-]{0,39}$")) throw new OpsException("名称须为小写字母开头，后接小写字母、数字或短横线，最多 40 位。");
        return value;
    }
    public static PanelResource Prepare(PluginInstallRequest request, string owner)
    {
        SafeName(owner); SafeName(request.Name);
        var plugin = Get(request.PluginId);
        var version = plugin.Versions.SingleOrDefault(x => x.Id == request.Version) ?? throw new OpsException("请选择目录中实际支持的插件版本。");
        if (plugin.RequiresPassword && (request.Password == null || request.Password.Length is < 12 or > 256 || request.Password.Any(char.IsControl)))
            throw new OpsException("服务密码需要 12–256 位且不含控制字符。");
        if (plugin.LicenseUrl.Length > 0 && !request.AcceptLicense) throw new OpsException("安装前须阅读并确认插件的使用许可。");
        if (plugin.Id == "sqlserver" && !new[] { "Express", "Developer", "Standard", "Enterprise" }.Contains(request.Edition)) throw new OpsException("SQL Server 版本类型无效。");
        if (plugin.Id == "sqlserver" && new[] { request.Password!.Any(char.IsUpper), request.Password.Any(char.IsLower), request.Password.Any(char.IsDigit), request.Password.Any(x => !char.IsLetterOrDigit(x)) }.Count(x => x) < 3)
            throw new OpsException("SQL Server 密码需要包含大写、小写、数字、符号中的至少三类。");
        if (!IPAddress.TryParse(request.BindAddress, out var address) || address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
            throw new OpsException("监听地址须为主机 IPv4 地址；默认只允许本机连接。");
        if (!Regex.IsMatch(request.Username ?? "", "^[a-zA-Z][a-zA-Z0-9_]{0,31}$") || !Regex.IsMatch(request.Database ?? "", "^[a-zA-Z][a-zA-Z0-9_]{0,31}$"))
            throw new OpsException("数据库和账号名称只能包含字母、数字和下划线。");
        if (request.Ports == null || request.Ports.Keys.Any(key => plugin.Ports.All(x => x.Name != key))) throw new OpsException("端口名称不在插件声明中。");
        var ports = plugin.Ports.ToDictionary(x => x.Name, x => request.Ports.GetValueOrDefault(x.Name, x.DefaultHostPort));
        if (ports.Values.Any(x => x is < 1 or > 65535) || ports.Values.Distinct().Count() != ports.Count) throw new OpsException("主机端口必须在 1–65535 之间且不能重复。");
        var memory = request.MemoryMb == 0 ? plugin.MemoryMb : request.MemoryMb;
        if (memory < plugin.MemoryMb || memory > 16384) throw new OpsException($"该插件内存上限须在 {plugin.MemoryMb}–16384 MiB 之间。");
        var id = "mci-panel-" + owner + "-" + request.Name;
        var env = new Dictionary<string,string> { ["TZ"] = "Asia/Shanghai" };
        string[] command = [];
        switch (plugin.Id)
        {
            case "nginx": command = ["nginx", "-c", NginxConfig.Root + "/current.conf", "-g", "daemon off;"]; break;
            case "mysql": env["MYSQL_ROOT_PASSWORD"] = request.Password!; env["MYSQL_DATABASE"] = request.Database!; break;
            case "postgresql": env["POSTGRES_PASSWORD"] = request.Password!; env["POSTGRES_USER"] = request.Username!; env["POSTGRES_DB"] = request.Database!; break;
            case "sqlserver": env["ACCEPT_EULA"] = "Y"; env["MSSQL_SA_PASSWORD"] = request.Password!; env["MSSQL_PID"] = request.Edition; break;
            case "oracle": env["ORACLE_PWD"] = request.Password!; break;
            case "mongodb": env["MONGO_INITDB_ROOT_USERNAME"] = request.Username!; env["MONGO_INITDB_ROOT_PASSWORD"] = request.Password!; break;
            case "minio": env["MINIO_ROOT_USER"] = request.Username!; env["MINIO_ROOT_PASSWORD"] = request.Password!; command = ["server", "/data", "--console-address", ":9001"]; break;
            case "redis": command = ["redis-server", "--appendonly", "yes", "--requirepass", request.Password!]; env["REDISCLI_AUTH"] = request.Password!; break;
            case "translate": env["LT_LOAD_ONLY"] = "zh,en"; env["LT_UPDATE_MODELS"] = "true"; env["LT_THREADS"] = "1"; break;
        }
        return new() { Id = request.Name, OwnerId = owner, PluginId = plugin.Id, Version = version.Id, Image = version.Image,
            ContainerName = id, VolumeName = id + "-data", BindAddress = request.BindAddress, Ports = ports, MemoryMb = memory,
            Environment = env, Command = command, LocalOnly = request.LocalOnly, State = "Pending" };
    }
}

public sealed class PanelResource
{
    public string Id { get; set; } = "";
    public string OwnerId { get; set; } = "";
    public string PluginId { get; set; } = "";
    public string Version { get; set; } = "";
    public string Image { get; set; } = "";
    public string ImageId { get; set; } = "";
    public string Digest { get; set; } = "";
    public string ContainerName { get; set; } = "";
    public string ContainerId { get; set; } = "";
    public string VolumeName { get; set; } = "";
    public string BindAddress { get; set; } = "127.0.0.1";
    public Dictionary<string,int> Ports { get; set; } = new();
    public Dictionary<string,string> Environment { get; set; } = new();
    public string[] Command { get; set; } = [];
    public int MemoryMb { get; set; }
    public bool LocalOnly { get; set; }
    public string State { get; set; } = "Pending";
    public DateTimeOffset Created { get; set; } = DateTimeOffset.UtcNow;
    public string ConfigRevision { get; set; } = NginxConfig.InitialRevision;
    public NginxConfiguration Websites { get; set; } = new();
    public object Public() => new { Id, OwnerId, PluginId, Version, Image, ImageId, Digest, ContainerName, ContainerId,
        VolumeName, BindAddress, Ports, MemoryMb, LocalOnly, State, Created, ConfigRevision };
}
