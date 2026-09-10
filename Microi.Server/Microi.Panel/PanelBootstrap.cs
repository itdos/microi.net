using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json.Nodes;

namespace Microi.Panel;

/// <summary>独立面板安装计划。只生成本面板文件，不依赖 API/Web，也不接管现有第三方面板。</summary>
public sealed record PanelBootstrapPlan(string Root,string PublicUrl,int Port,string Image,string BindAddress);
public sealed record PanelBootstrapFiles(string Environment,string Compose,byte[] Certificate,string CertificatePassword,string Fingerprint);
public static class PanelBootstrap
{
    public const string DefaultImage="registry.cn-hangzhou.aliyuncs.com/microios/microi-panel:v2.0.0";
    public static PanelBootstrapFiles Build(PanelBootstrapPlan plan)
    {
        if(!plan.Root.StartsWith('/')||plan.Root=="/"||plan.Root.Split('/').Any(x=>x is "." or "..")||plan.Root.Any(x=>char.IsControl(x)||x is ':' or '\\'))throw new OpsException("面板目录必须为独立的 Linux 绝对目录，不能包含上级路径、冒号或控制字符。");
        if(plan.Port is <1024 or >65535)throw new OpsException("面板 HTTPS 端口必须在1024–65535之间。");
        if(!IPAddress.TryParse(plan.BindAddress,out var bind)||bind.AddressFamily!=System.Net.Sockets.AddressFamily.InterNetwork)throw new OpsException("面板监听地址必须为主机 IPv4 地址。");
        var url=OpsOptions.SafeUrl(plan.PublicUrl);
        if(url.Scheme!="https"||url.AbsolutePath!="/"||url.Port!=plan.Port)throw new OpsException("独立面板地址必须是与监听端口一致的 HTTPS 根地址。");
        if(!System.Text.RegularExpressions.Regex.IsMatch(plan.Image,"^[a-z0-9][a-z0-9./:_@-]{1,220}$"))throw new OpsException("面板镜像引用格式无效。");
        var certificatePassword=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        using var key=ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var certificateRequest=new CertificateRequest("CN=Microi.Panel bootstrap",key,HashAlgorithmName.SHA256);
        var san=new SubjectAlternativeNameBuilder();
        if(IPAddress.TryParse(url.Host.Trim('[',']'),out var hostIp))san.AddIpAddress(hostIp);else san.AddDnsName(url.IdnHost);
        san.AddDnsName("localhost");san.AddIpAddress(IPAddress.Loopback);
        certificateRequest.CertificateExtensions.Add(san.Build());
        certificateRequest.CertificateExtensions.Add(new X509BasicConstraintsExtension(false,false,0,true));
        certificateRequest.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature,true));
        var usages=new OidCollection{new("1.3.6.1.5.5.7.3.1")};certificateRequest.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(usages,true));
        using var certificate=certificateRequest.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5),DateTimeOffset.UtcNow.AddYears(2));
        var environment="OPS_ADMIN_USERNAME=paneladmin\nOPS_ADMIN_PASSWORD_FILE=/etc/microi-panel/admin-password\nOPS_PUBLIC_URL="+url.GetLeftPart(UriPartial.Authority)
            +"\nOPS_DEPLOYMENT_FILE=/etc/microi-panel/deployment.json\nOPS_TLS_CERTIFICATE_FILE=/etc/microi-panel/panel.pfx\nOPS_TLS_PASSWORD_FILE=/etc/microi-panel/tls-password\n";
        // 自带 TLS 监听，不依赖待管理的 Nginx/宝塔/1Panel，避免更新入口的循环依赖。
        var service=new JsonObject{["image"]=plan.Image,["container_name"]="microi-panel",["restart"]="unless-stopped",["env_file"]=new JsonArray(plan.Root+"/config/panel.env"),
            ["ports"]=new JsonArray(plan.BindAddress+":"+plan.Port+":8443"),["volumes"]=new JsonArray("/var/run/docker.sock:/var/run/docker.sock",plan.Root+"/config:/etc/microi-panel:ro",plan.Root+"/data:/microi/ops/data",plan.Root+"/logs:/microi/logs/ops"),
            ["mem_limit"]="512m",["cpus"]="1.0",["security_opt"]=new JsonArray("no-new-privileges:true"),["stop_grace_period"]="30s",
            ["logging"]=new JsonObject{["driver"]="json-file",["options"]=new JsonObject{["max-size"]="10m",["max-file"]="3"}}};
        var compose=new JsonObject{["name"]="microi-panel",["services"]=new JsonObject{["microi-panel"]=service}};
        return new(environment,compose.ToJsonString(new(){WriteIndented=true}),certificate.Export(X509ContentType.Pfx,certificatePassword),certificatePassword,certificate.GetCertHashString(HashAlgorithmName.SHA256));
    }
    public static void Initialize()
    {
        static string Env(string name,string fallback="")=>Environment.GetEnvironmentVariable(name)?.Trim()??fallback;
        var root=Env("PANEL_INSTALL_ROOT","/microi/panel");
        if(!int.TryParse(Env("PANEL_INSTALL_PORT","61890"),out var port))throw new OpsException("面板端口无效。");
        var plan=Build(new(root,Env("PANEL_INSTALL_URL","https://localhost:"+port),port,Env("PANEL_INSTALL_IMAGE",DefaultImage),Env("PANEL_INSTALL_BIND","0.0.0.0")));
        var paths=new[]{"config/panel.env","config/admin-password","config/tls-password","config/panel.pfx","config/deployment.json","docker-compose.yml"};
        if(paths.Any(x=>File.Exists(Path.Combine(root,x)))||Directory.Exists(Path.Combine(root,"data"))&&Directory.EnumerateFileSystemEntries(Path.Combine(root,"data")).Any())
            throw new OpsException("面板已有账号、证书或数据，拒绝覆盖。请使用原编排升级，或从原安装目录继续。",409);
        foreach(var subdir in new[]{"","config","data","logs"})
        {
            var path=Path.Combine(root,subdir);Directory.CreateDirectory(path);
            if(!OperatingSystem.IsWindows())File.SetUnixFileMode(path,UnixFileMode.UserRead|UnixFileMode.UserWrite|UnixFileMode.UserExecute);
        }
        var files=new Dictionary<string,byte[]>{["config/panel.env"]=System.Text.Encoding.UTF8.GetBytes(plan.Environment),["config/admin-password"]=System.Text.Encoding.UTF8.GetBytes(Convert.ToHexString(RandomNumberGenerator.GetBytes(24))),
            ["config/tls-password"]=System.Text.Encoding.UTF8.GetBytes(plan.CertificatePassword),["config/panel.pfx"]=plan.Certificate,["config/deployment.json"]=System.Text.Encoding.UTF8.GetBytes("{}"),["docker-compose.yml"]=System.Text.Encoding.UTF8.GetBytes(plan.Compose)};
        // CreateNew 防止重复引导覆盖凭据；若中断留下部分文件，保留现场而非重置账号。
        foreach(var (relative,bytes) in files)
        {
            var path=Path.Combine(root,relative);using(var stream=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None)){stream.Write(bytes);stream.Flush(true);}
            if(!OperatingSystem.IsWindows())File.SetUnixFileMode(path,UnixFileMode.UserRead|UnixFileMode.UserWrite);
        }
        Console.WriteLine("吾码服务器运维面板配置已生成："+root);
        Console.WriteLine("独立账号：paneladmin；随机密码保存在 "+root+"/config/admin-password，不写入安装日志。");
        Console.WriteLine("初始 HTTPS 证书 SHA-256："+plan.Fingerprint);
        Console.WriteLine("初始证书为本次生成的自签证书；请核对指纹，并在正式对外访问时换成已信任证书。");
    }
}
