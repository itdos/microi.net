using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.Panel.Panel;

public sealed class NginxConfiguration
{
    public List<NginxSite> Sites { get; set; } = [];
}
public sealed class NginxSite
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string[] Domains { get; set; } = [];
    public string Kind { get; set; } = "Proxy";
    public bool Enabled { get; set; } = true;
    public string CertificateId { get; set; } = "";
    public bool RedirectHttps { get; set; }
    public int HttpsPublicPort { get; set; } = 443;
    public int MaxBodyMb { get; set; } = 100;
    public bool Gzip { get; set; } = true;
    public bool SpaFallback { get; set; }
    public List<NginxRoute> Routes { get; set; } = [];
}
public sealed class NginxRoute
{
    public string Prefix { get; set; } = "/";
    public string Upstream { get; set; } = "";
    public bool StripPrefix { get; set; }
    public bool WebSocket { get; set; } = true;
    public int TimeoutSeconds { get; set; } = 300;
    public bool VerifyUpstreamCertificate { get; set; } = true;
}

/// <summary>证书私钥只保存在加密账本和 Nginx 数据卷，浏览器列表只收到元数据。</summary>
public sealed class PanelCertificate
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string CertificatePem { get; set; } = "";
    public string PrivateKeyPem { get; set; } = "";
    public string Thumbprint { get; set; } = "";
    public string Subject { get; set; } = "";
    public DateTimeOffset NotBefore { get; set; }
    public DateTimeOffset NotAfter { get; set; }
    public string Source { get; set; } = "Import";
    public object Public() => new { Id, Name, Thumbprint, Subject, NotBefore, NotAfter, Source };
    public static PanelCertificate Import(string id, string name, string certificatePem, string privateKeyPem)
    {
        PanelCatalog.SafeName(id);
        if (name.Length > 100 || certificatePem.Length is < 100 or > 65536 || privateKeyPem.Length is < 100 or > 32768)
            throw new OpsException("证书名称、PEM 证书链或私钥长度无效。");
        try
        {
            using var leaf = X509Certificate2.CreateFromPem(certificatePem, privateKeyPem);
            if (!leaf.HasPrivateKey) throw new OpsException("证书必须包含匹配的私钥。");
            if (leaf.NotBefore.ToUniversalTime() > DateTime.UtcNow.AddMinutes(5) || leaf.NotAfter.ToUniversalTime() <= DateTime.UtcNow)
                throw new OpsException("证书尚未生效或已经过期。");
            var chain = new X509Certificate2Collection(); chain.ImportFromPem(certificatePem);
            try { if (chain.Count == 0) throw new OpsException("PEM 中没有证书。"); }
            finally { foreach (var certificate in chain) certificate.Dispose(); }
            return new() { Id = id, Name = name, CertificatePem = certificatePem, PrivateKeyPem = privateKeyPem,
                Thumbprint = leaf.Thumbprint, Subject = leaf.Subject, NotBefore = leaf.NotBefore.ToUniversalTime(), NotAfter = leaf.NotAfter.ToUniversalTime() };
        }
        catch (CryptographicException) { throw new OpsException("无法读取证书，或证书与私钥不匹配；请提供 PEM 格式完整证书链与未加密私钥。"); }
    }
    public void AssertDomains(IEnumerable<string> domains)
    {
        using var leaf = X509Certificate2.CreateFromPem(CertificatePem);
        if (leaf.NotAfter.ToUniversalTime() <= DateTime.UtcNow) throw new OpsException("证书已过期，请更新证书后发布。");
        foreach (var domain in domains)
        {
            // 通配站点必须同时覆盖一个任意子域和另一个子域，防止将单域证书误用于通配服务。
            var names = domain.StartsWith("*.", StringComparison.Ordinal) ? new[] { "microi-certificate-check-a" + domain[1..], "microi-certificate-check-b" + domain[1..] } : [domain];
            if (names.Any(name => !leaf.MatchesHostname(name, allowWildcards: true, allowCommonName: false)))
                throw new OpsException("证书的 SAN 未覆盖网站域名：" + domain);
        }
    }
}

/// <summary>只由经过类型校验的网站模型生成指令；不接受任意 Nginx 文本、宿主路径或变量表达式。</summary>
public static class NginxConfig
{
    public const string Root = "/srv/panel";
    public const string InitialRevision = "initial";
    public static string Domain(string input)
    {
        if (input.Length is < 1 or > 253 || input.Any(char.IsWhiteSpace) || input.IndexOfAny([';', '$', '{', '}', '/', '\\', '"', '\'']) >= 0)
            throw new OpsException("网站域名格式无效。");
        var wildcard = input.StartsWith("*.", StringComparison.Ordinal); var host = wildcard ? input[2..] : input;
        try { host = new IdnMapping().GetAscii(host).ToLowerInvariant(); } catch (ArgumentException) { throw new OpsException("域名国际化编码无效。"); }
        if (host.Length > 253 || !Regex.IsMatch(host, @"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", RegexOptions.CultureInvariant)
            || (wildcard && (host.Count(x => x == '.') < 1 || IPAddress.TryParse(host, out _)))) throw new OpsException("网站域名格式无效。");
        return (wildcard ? "*." : "") + host;
    }
    public static string Upstream(string input)
    {
        // 上游可以指向主机或内网，这是独立运维账号的明确能力；严禁把 URL 变成配置代码。
        if (input.Length > 1024 || input.Any(char.IsWhiteSpace) || input.IndexOfAny([';', '$', '{', '}', '"', '\'', '\\']) >= 0
            || !Uri.TryCreate(input, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https") || uri.UserInfo.Length > 0
            || uri.Query.Length > 0 || uri.Fragment.Length > 0 || uri.AbsolutePath != "/") throw new OpsException("上游必须为不含账号、路径或查询参数的 HTTP/HTTPS 地址。");
        if (!IPAddress.TryParse(uri.Host.Trim('[', ']'), out _)) _ = Domain(uri.IdnHost);
        return uri.GetLeftPart(UriPartial.Authority);
    }
    public static void Validate(NginxConfiguration config, IReadOnlyDictionary<string, PanelCertificate> certificates)
    {
        if (config.Sites == null || config.Sites.Count > 100) throw new OpsException("单个 Nginx 实例最多配置 100 个网站。");
        var ids = new HashSet<string>(); var domains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var site in config.Sites)
        {
            PanelCatalog.SafeName(site.Id);
            if (!ids.Add(site.Id)) throw new OpsException("网站标识不能重复。");
            if (site.Name.Length > 100 || site.Kind is not ("Proxy" or "Static") || site.Domains == null || site.Domains.Length is < 1 or > 30
                || site.MaxBodyMb is < 1 or > 1024 || site.HttpsPublicPort is < 1 or > 65535) throw new OpsException("网站类型、域名、上传限制或 HTTPS 端口无效。");
            foreach (var domain in site.Domains.Select(Domain)) if (!domains.Add(domain)) throw new OpsException("网站域名重复：" + domain);
            if (site.CertificateId.Length > 0)
            {
                PanelCatalog.SafeName(site.CertificateId);
                if (!certificates.TryGetValue(site.CertificateId, out var certificate)) throw new OpsException("网站引用的证书不存在。");
                certificate.AssertDomains(site.Domains.Select(Domain));
            }
            else if (site.RedirectHttps) throw new OpsException("启用 HTTPS 跳转前请配置证书。");
            if (site.Routes == null || site.Routes.Count > 32 || (site.Kind == "Proxy" && site.Routes.Count == 0)) throw new OpsException("反向代理需要 1 至 32 个代理规则。");
            var prefixes = new HashSet<string>();
            foreach (var route in site.Routes)
            {
                if (route.Prefix.Length > 256 || !Regex.IsMatch(route.Prefix, @"^/[a-zA-Z0-9/_.~-]*$", RegexOptions.CultureInvariant)
                    || route.Prefix.Contains("..", StringComparison.Ordinal) || route.Prefix.Contains("//", StringComparison.Ordinal)
                    || !prefixes.Add(route.Prefix) || (route.StripPrefix && !route.Prefix.EndsWith('/')) || route.TimeoutSeconds is < 1 or > 3600)
                    throw new OpsException("代理路径不能重复或包含变量；移除前缀时路径必须以 / 结尾。");
                _ = Upstream(route.Upstream);
            }
        }
    }
    public static string Render(NginxConfiguration config, string revision, IReadOnlyDictionary<string, PanelCertificate> certificates)
    {
        Validate(config, certificates); PanelCatalog.SafeName(revision);
        var text = new StringBuilder("""
            worker_processes auto;
            error_log /dev/stderr warn;
            pid /var/run/nginx.pid;
            events { worker_connections 4096; }
            http {
              include /etc/nginx/mime.types;
              default_type application/octet-stream;
              access_log /dev/stdout;
              server_tokens off;
              sendfile on;
              keepalive_timeout 65;
              map $http_upgrade $connection_upgrade { default upgrade; '' close; }
              server { listen 80 default_server; server_name _; location /.well-known/acme-challenge/ { root /srv/panel/acme; } location / { return 404; } }
            """);
        text.Append("\n  server { listen 8088; server_name localhost; access_log off; location = /ready { default_type text/plain; return 200 '" + revision + "'; } location / { return 404; } }\n");
        foreach (var site in config.Sites.Where(x => x.Enabled))
        {
            var names = string.Join(' ', site.Domains.Select(Domain)); var tls = site.CertificateId.Length > 0;
            if (site.RedirectHttps)
            {
                var port = site.HttpsPublicPort == 443 ? "" : ":" + site.HttpsPublicPort;
                text.Append("  server { listen 80; server_name " + names + "; location /.well-known/acme-challenge/ { root /srv/panel/acme; } location / { return 308 https://$host" + port + "$request_uri; } }\n");
            }
            text.Append("  server {\n");
            if (!site.RedirectHttps) text.Append("    listen 80;\n");
            text.Append("    server_name " + names + ";\n    client_max_body_size " + site.MaxBodyMb + "m;\n");
            if (tls) text.Append("    listen 443 ssl;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_session_cache shared:TLS:10m;\n    ssl_certificate " + Root + "/releases/" + revision + "/certs/" + site.CertificateId + ".crt;\n    ssl_certificate_key " + Root + "/releases/" + revision + "/certs/" + site.CertificateId + ".key;\n");
            if (site.Gzip) text.Append("    gzip on; gzip_vary on; gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;\n");
            text.Append("    location ^~ /.well-known/acme-challenge/ { root /srv/panel/acme; }\n    location ~ /\\.(?!well-known/) { deny all; }\n");
            if (site.Kind == "Static") text.Append("    root " + Root + "/sites/" + site.Id + ";\n    index index.html;\n    location / { try_files $uri $uri/ " + (site.SpaFallback ? "/index.html" : "=404") + "; }\n");
            else foreach (var route in site.Routes)
            {
                text.Append("    location " + route.Prefix + " {\n      proxy_pass " + Upstream(route.Upstream) + (route.StripPrefix ? "/" : "") + ";\n      proxy_http_version 1.1;\n      proxy_set_header Host $host;\n      proxy_set_header X-Real-IP $remote_addr;\n      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n      proxy_set_header X-Forwarded-Proto $scheme;\n      proxy_read_timeout " + route.TimeoutSeconds + "s;\n      proxy_send_timeout " + route.TimeoutSeconds + "s;\n");
                if (route.WebSocket) text.Append("      proxy_set_header Upgrade $http_upgrade;\n      proxy_set_header Connection $connection_upgrade;\n");
                if (route.Upstream.StartsWith("https:", StringComparison.OrdinalIgnoreCase)) text.Append("      proxy_ssl_server_name on;\n      proxy_ssl_verify " + (route.VerifyUpstreamCertificate ? "on" : "off") + ";\n      proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;\n      proxy_ssl_verify_depth 4;\n");
                text.Append("    }\n");
            }
            text.Append("  }\n");
        }
        return text.Append("}\n").ToString();
    }
}
