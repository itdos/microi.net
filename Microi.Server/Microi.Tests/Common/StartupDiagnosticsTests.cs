using System.IO;
using System.Net.Sockets;
using Microi.net.Api;
using Xunit;

namespace Microi.Tests.Common;

public class StartupDiagnosticsTests
{
    [Fact]
    public void FindOccupiedAddresses_ReturnsOnlyConfiguredAddressesWhosePortIsListening()
    {
        var addresses = new[]
        {
            "https://0.0.0.0:61501",
            "http://*:61502",
            "http://localhost:61503"
        };

        var result = StartupDiagnostics.FindOccupiedAddresses(
            addresses,
            new HashSet<int> { 61501, 61503 });

        Assert.Equal(
            new[] { "https://0.0.0.0:61501", "http://localhost:61503" },
            result);
    }

    [Fact]
    public void IsAddressAlreadyInUse_DetectsNestedSocketException()
    {
        var exception = new IOException(
            "Failed to bind",
            new InvalidOperationException(
                "Kestrel bind failed",
                new SocketException((int)SocketError.AddressAlreadyInUse)));

        Assert.True(StartupDiagnostics.IsAddressAlreadyInUse(exception));
        Assert.False(StartupDiagnostics.IsAddressAlreadyInUse(new IOException("other")));
    }
}
