using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microi.Panel;
using Microi.Panel.Panel;

namespace Microi.Tests.Panel;

public sealed class NginxContractTests
{
    private static NginxSite Site() => new() { Id = "website", Domains = ["www.example.test"], Routes = [new() { Prefix = "/", Upstream = "http://host.docker.internal:8080" }] };

    [Fact]
    public void GeneratedProxySupportsWebSocketsAndPreservesPaths()
    {
        var config = new NginxConfiguration { Sites = [Site()] };
        var text = NginxConfig.Render(config, "revision-a", new Dictionary<string, PanelCertificate>());
        Assert.Contains("proxy_pass http://host.docker.internal:8080;", text);
        Assert.Contains("proxy_set_header Upgrade $http_upgrade;", text);
        Assert.Contains("proxy_set_header X-Forwarded-Proto $scheme;", text);
        Assert.Contains("/srv/panel", text);
        Assert.Contains("listen 8088;", text);
    }

    [Theory]
    [InlineData("x; include /etc/passwd;")][InlineData("x\nserver{}")] [InlineData("$http_host")]
    [InlineData("https://example.test")][InlineData("a/b")]
    public void DomainsCannotInjectNginxDirectives(string domain)
    {
        var site = Site(); site.Domains = [domain];
        Assert.Throws<OpsException>(() => NginxConfig.Validate(new() { Sites = [site] }, new Dictionary<string, PanelCertificate>()));
    }

    [Theory]
    [InlineData("http://localhost;root/x")][InlineData("http://user:pwd@localhost")]
    [InlineData("http://$host")][InlineData("file:///etc/passwd")][InlineData("http://localhost/a?x=1")]
    public void UpstreamsAreTypedUrlsRatherThanExecutableConfig(string upstream)
    {
        var site = Site(); site.Routes[0].Upstream = upstream;
        Assert.Throws<OpsException>(() => NginxConfig.Validate(new() { Sites = [site] }, new Dictionary<string, PanelCertificate>()));
    }

    [Fact]
    public void DomainAndLocationCollisionsAreRejected()
    {
        var first = Site(); var second = Site(); second.Id = "second";
        Assert.Throws<OpsException>(() => NginxConfig.Validate(new() { Sites = [first, second] }, new Dictionary<string, PanelCertificate>()));
        first.Routes.Add(first.Routes[0]);
        Assert.Throws<OpsException>(() => NginxConfig.Validate(new() { Sites = [first] }, new Dictionary<string, PanelCertificate>()));
    }

    [Fact]
    public void CertificateRequiresMatchingKeyValidityAndDomain()
    {
        using var rsa = RSA.Create(2048); using var otherKey = RSA.Create(2048);
        var request = new CertificateRequest("CN=ignored.example.test", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var san = new SubjectAlternativeNameBuilder(); san.AddDnsName("www.example.test"); request.CertificateExtensions.Add(san.Build());
        using var leaf = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddDays(30));
        var pem = leaf.ExportCertificatePem();
        Assert.Throws<OpsException>(() => PanelCertificate.Import("main", "网站证书", pem, otherKey.ExportPkcs8PrivateKeyPem()));
        var certificate = PanelCertificate.Import("main", "网站证书", pem, rsa.ExportPkcs8PrivateKeyPem());
        var site = Site(); site.CertificateId = "main"; site.RedirectHttps = true;
        var certificates = new Dictionary<string, PanelCertificate> { ["main"] = certificate };
        var text = NginxConfig.Render(new() { Sites = [site] }, "revision-a", certificates);
        Assert.Contains("ssl_protocols TLSv1.2 TLSv1.3;", text);
        Assert.Contains("return 308 https://$host$request_uri;", text);
        Assert.DoesNotContain("PRIVATE KEY", System.Text.Json.JsonSerializer.Serialize(certificate.Public()));
        site.Domains = ["other.example.test"];
        Assert.Throws<OpsException>(() => NginxConfig.Validate(new() { Sites = [site] }, certificates));
        using var expired = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-2), DateTimeOffset.UtcNow.AddDays(-1));
        Assert.Throws<OpsException>(() => PanelCertificate.Import("expired", "已过期", expired.ExportCertificatePem(), rsa.ExportPkcs8PrivateKeyPem()));
    }

    [Fact]
    public void StaticSitesNeverAcceptHostFilePaths()
    {
        var site = new NginxSite { Id = "files", Domains = ["static.example.test"], Kind = "Static" };
        var text = NginxConfig.Render(new() { Sites = [site] }, "revision-a", new Dictionary<string, PanelCertificate>());
        Assert.Contains("root /srv/panel/sites/files;", text);
        site.Id = "../../etc";
        Assert.Throws<OpsException>(() => NginxConfig.Validate(new() { Sites = [site] }, new Dictionary<string, PanelCertificate>()));
    }

    [Fact]
    public void WebsitePublicationIsAtomicIdempotentAndRejectsStaleEditors()
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../../.tmp/panel-20260910/tests", Guid.NewGuid().ToString("N")));
        var options = new OpsOptions { DataDir = root, LogDir = root };
        using var store = new OpsStore(options);
        var repo = new PanelRepository(options, store, new Microsoft.AspNetCore.DataProtection.EphemeralDataProtectionProvider());
        var resource = PanelCatalog.Prepare(new() { PluginId = "nginx", Version = "1.30.4", Name = "gateway" }, repo.OwnerId);
        var install = repo.Enqueue("Install", Guid.NewGuid().ToString(), resource, "tester"); install.State = "Succeeded"; repo.SaveOperation(install);
        var requestId = Guid.NewGuid().ToString();
        var operation = repo.Enqueue("NginxPublish", requestId, resource, "tester", "{\"revision\":\"next\"}", "initial", "original-request");
        Assert.Equal("next", repo.Payload<System.Text.Json.Nodes.JsonObject>(operation.Id)["revision"]!.ToString());
        Assert.Throws<OpsException>(() => repo.Enqueue("NginxPublish", Guid.NewGuid().ToString(), resource, "tester", "{}", "initial"));
        resource.ConfigRevision = "next"; repo.SaveResource(resource); operation.State = "Succeeded"; repo.SaveOperation(operation);
        // 重复响应返回原任务，不能被已推进的版本挡住；新请求仍必须有匹配的版本。
        Assert.Equal(operation.Id, repo.Enqueue("NginxPublish", requestId, resource, "tester", "{}", "initial", "original-request").Id);
        Assert.Throws<OpsException>(() => repo.Enqueue("NginxPublish", Guid.NewGuid().ToString(), resource, "tester", "{}", "initial"));
    }

    [Theory]
    [InlineData("../secret")][InlineData("/etc/passwd")][InlineData("C:/windows")][InlineData("a\\b")][InlineData("a/./b")]
    public void ArchivesCannotEscapeManagedVolume(string path) => Assert.Throws<OpsException>(() => DockerEngine.SafeArchivePath(path));
}
