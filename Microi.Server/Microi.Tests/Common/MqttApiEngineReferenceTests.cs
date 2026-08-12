namespace Microi.Tests.Common;

public sealed class MqttApiEngineReferenceTests
{
    [Fact]
    public void MqttRuntimeResolvesLegacyEngineIdsBeforeCallingRunAsync()
    {
        var serverRoot = FindServerRoot();
        var source = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.MQTT",
            "MicroiMQTT.cs"));

        Assert.Contains(
            "ResolveMqttApiEngineKeyAsync(osClient, mqttApiEngineReference)",
            source,
            StringComparison.Ordinal);
        Assert.Contains("Id = apiEngineReference", source, StringComparison.Ordinal);
        Assert.Contains(
            "MicroiEngine.ApiEngine.RunAsync(mqttApiEngine",
            source,
            StringComparison.Ordinal);
        Assert.Contains("Guid.TryParse(value, out _)", source, StringComparison.Ordinal);
        Assert.Contains("value.Length != 26", source, StringComparison.Ordinal);
    }

    private static string FindServerRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            var candidate = Path.Combine(current.FullName, "Microi.Server");
            if (Directory.Exists(candidate)) return candidate;
            if (File.Exists(Path.Combine(current.FullName, "Microi.MQTT", "MicroiMQTT.cs")))
                return current.FullName;
            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the Microi.Server source directory.");
    }
}
