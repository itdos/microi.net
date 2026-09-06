using System.Net.Sockets;
using Microi.net;

namespace Microi.Tests.Common;

public class MqttStartupDiagnosticsTests
{
    [Fact]
    public void NestedPortConflictExplainsCauseAndSafeRemedy()
    {
        var text = MqttStartupDiagnostics.Describe(new InvalidOperationException("wrapper",
            new SocketException((int)SocketError.AddressAlreadyInUse)), 1883);
        Assert.Contains("1883", text);
        Assert.Contains("AddressAlreadyInUse", text);
        Assert.Contains("Get-NetTCPConnection", text);
        Assert.Contains("解决方案", text);
        Assert.DoesNotContain("请查看系统日志", text);
    }

    [Fact]
    public void CertificateFailuresAreActionableWithoutLeakingConfiguredSecret()
    {
        var text = MqttStartupDiagnostics.Describe(new System.Security.Cryptography.CryptographicException(
            "invalid password=private-value other-secret"), 1883, 21883, new[] { "other-secret" });
        Assert.Contains("MqttCertPath/MqttCertPassword", text);
        Assert.Contains("21883", text);
        Assert.DoesNotContain("private-value", text);
        Assert.DoesNotContain("other-secret", text);
    }
}
