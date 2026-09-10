using System.Security.Cryptography.X509Certificates;
using System.Text.Json.Nodes;
using Microi.Panel;

namespace Microi.Tests.Panel;
public sealed class PanelBootstrapTests
{
    [Fact]
    public void FreshHostDoesNotRequirePlatformContainersAndHasIndependentTls()
    {
        var result=PanelBootstrap.Build(new("/microi/panel","https://panel.example.test:61890",61890,PanelBootstrap.DefaultImage,"0.0.0.0"));
        var compose=JsonNode.Parse(result.Compose)!;var service=compose["services"]!["microi-panel"]!;
        Assert.Equal("0.0.0.0:61890:8443",service["ports"]![0]!.ToString());
        Assert.DoesNotContain("microi-install-api",result.Compose);Assert.DoesNotContain(":8080",result.Compose);
        Assert.DoesNotContain("OPS_ADMIN_PASSWORD=",result.Environment);Assert.Contains("OPS_ADMIN_PASSWORD_FILE=",result.Environment);
        using var cert=X509CertificateLoader.LoadPkcs12(result.Certificate,result.CertificatePassword,X509KeyStorageFlags.EphemeralKeySet);
        Assert.True(cert.HasPrivateKey);Assert.True(cert.MatchesHostname("panel.example.test"));
        Assert.False(cert.MatchesHostname("unrelated.example.test"));Assert.Equal(64,result.Fingerprint.Length);
    }
    [Theory]
    [InlineData("/","https://panel.example.test:61890",61890)]
    [InlineData("/microi/../other","https://panel.example.test:61890",61890)]
    [InlineData("/microi/panel","http://localhost:61890",61890)]
    [InlineData("/microi/panel","https://panel.example.test/path",443)]
    [InlineData("/microi/panel","https://panel.example.test:61890",61891)]
    public void InvalidRootsAndInconsistentPublicEntrypointsAreRejected(string root,string url,int port)
        =>Assert.Throws<OpsException>(()=>PanelBootstrap.Build(new(root,url,port,PanelBootstrap.DefaultImage,"0.0.0.0")));
    [Fact]
    public void EveryInstallationGeneratesIndependentSecretsAndCertificate()
    {
        var input=new PanelBootstrapPlan("/microi/panel","https://127.0.0.1:61890",61890,PanelBootstrap.DefaultImage,"127.0.0.1");
        var first=PanelBootstrap.Build(input);var second=PanelBootstrap.Build(input);
        Assert.NotEqual(first.Fingerprint,second.Fingerprint);Assert.NotEqual(first.CertificatePassword,second.CertificatePassword);
        using var cert=X509CertificateLoader.LoadPkcs12(first.Certificate,first.CertificatePassword);Assert.True(cert.MatchesHostname("127.0.0.1"));
    }
}
