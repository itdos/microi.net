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
}
