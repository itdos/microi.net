using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public class MicroiHdfsMinioEndpointTests
{
    private static bool ShouldUseInternetEndpoint(bool? networkIsInternet, string returnFileType)
    {
        var method = typeof(MicroiHDFSMinIO).GetMethod(
            "ShouldUseInternetEndpoint",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        return (bool)method!.Invoke(null, new object?[] { networkIsInternet, returnFileType })!;
    }

    [Theory]
    [InlineData(null, "Byte", false)]
    [InlineData(null, "Url", true)]
    [InlineData(false, "Url", false)]
    [InlineData(true, "Byte", true)]
    public void ServerSideByteReadsPreferInternalEndpointUnlessExplicitlyOverridden(
        bool? networkIsInternet,
        string returnFileType,
        bool expected)
    {
        Assert.Equal(expected, ShouldUseInternetEndpoint(networkIsInternet, returnFileType));
    }

    [Theory]
    [InlineData("minio.internal:9000", false, "minio.internal", 9000, false)]
    [InlineData("https://files.example.com:9443/", false, "files.example.com", 9443, true)]
    [InlineData("http://10.0.0.8:9000", true, "10.0.0.8", 9000, false)]
    [InlineData("files.example.com", true, "files.example.com", 443, true)]
    public void EndpointNormalization_AcceptsHostPortAndAbsoluteHttpUrls(
        string endpoint,
        bool configuredSsl,
        string expectedHost,
        int expectedPort,
        bool expectedSsl)
    {
        var actual = MicroiHDFSMinIO.NormalizeEndpoint(endpoint, configuredSsl);

        Assert.Equal(expectedHost, actual.Host);
        Assert.Equal(expectedPort, actual.Port);
        Assert.Equal(expectedSsl, actual.UseSsl);
    }

    [Theory]
    [InlineData("https://user:secret@files.example.com:9443")]
    [InlineData("https://files.example.com/mci-public")]
    [InlineData("https://files.example.com:9443?bucket=mci-public")]
    [InlineData("ftp://files.example.com:21")]
    public void EndpointNormalization_RejectsCredentialsPathsQueriesAndUnsupportedSchemes(string endpoint)
    {
        var exception = Assert.Throws<ArgumentException>(() =>
            MicroiHDFSMinIO.NormalizeEndpoint(endpoint, configuredSsl: false));

        Assert.Contains("MinIO Endpoint", exception.Message, StringComparison.Ordinal);
    }
}
