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

    [Fact]
    public void MqttReconnectKeepsTheNewSessionTenantRegistration()
    {
        var serverRoot = FindServerRoot();
        var source = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.MQTT",
            "MicroiMQTT.cs"));

        Assert.Contains(
            "private const string TenantSessionItemKey = \"Microi.MQTT.OsClient\"",
            source,
            StringComparison.Ordinal);
        Assert.Contains(
            "private const string ConnectionTokenSessionItemKey = \"Microi.MQTT.ConnectionToken\"",
            source,
            StringComparison.Ordinal);
        Assert.Contains(
            "args.SessionItems, args.ApplicationMessage?.UserProperties",
            source,
            StringComparison.Ordinal);
        Assert.Contains(
            "current?.ConnectionToken, disconnectToken",
            source,
            StringComparison.Ordinal);
        Assert.Contains("StaleDisconnectIgnored", source, StringComparison.Ordinal);
    }

    [Fact]
    public void StaleDisconnectCannotRemoveReplacementConnection()
    {
        var mqttType = typeof(Microi.net.MicroiMQTT);
        var flags = System.Reflection.BindingFlags.NonPublic
                    | System.Reflection.BindingFlags.Static;
        var register = mqttType.GetMethod("TryRegisterConnectedClient", flags);
        var remove = mqttType.GetMethod("RemoveConnectedClient", flags);
        var tryGetTenant = mqttType.GetMethod("TryGetConnectedTenant", flags);
        Assert.NotNull(register);
        Assert.NotNull(remove);
        Assert.NotNull(tryGetTenant);

        var tenant = "mqtt_reconnect_test";
        var clientId = $"test-{Guid.NewGuid():N}";
        var oldSession = new System.Collections.Hashtable();
        var replacementSession = new System.Collections.Hashtable();

        try
        {
            var firstRegistration = new object?[] { tenant, clientId, oldSession, null };
            var replacementRegistration = new object?[] { tenant, clientId, replacementSession, null };
            Assert.True((bool)register!.Invoke(null, firstRegistration)!);
            Assert.True((bool)register.Invoke(null, replacementRegistration)!);
            Assert.NotEqual(
                oldSession["Microi.MQTT.ConnectionToken"],
                replacementSession["Microi.MQTT.ConnectionToken"]);

            Assert.False((bool)remove!.Invoke(null, new object?[] { tenant, clientId, oldSession })!);

            var tenantLookup = new object?[] { clientId, null };
            Assert.True((bool)tryGetTenant!.Invoke(null, tenantLookup)!);
            Assert.Equal(tenant, tenantLookup[1]);
        }
        finally
        {
            remove!.Invoke(null, new object?[] { tenant, clientId, replacementSession });
        }
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
