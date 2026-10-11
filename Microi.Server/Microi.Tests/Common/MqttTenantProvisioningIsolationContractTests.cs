using System.Runtime.CompilerServices;
using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class MqttTenantProvisioningIsolationContractTests
{
    [Theory]
    [InlineData("", null, true, true)]
    [InlineData("", null, false, false)]
    [InlineData("0", null, true, false)]
    [InlineData(0, null, true, false)]
    [InlineData("secret", "secret", true, true)]
    [InlineData("secret", "other", true, false)]
    public void OracleOnlyTreatsEmptyTextAsNull(object expected, string? actual, bool oracle, bool matches)
    {
        Assert.Equal(matches, TenantProvisioningService.TenantServiceReadbackMatches(expected, actual!, oracle));
        Assert.True(TenantProvisioningService.TenantServiceReadbackMatches(DBNull.Value, null!, oracle));
    }

    [Fact]
    public void ProvisioningTargetsExactRuntimePartitionAndStronglyReadsBack()
    {
        var source = File.ReadAllText(GetProvisioningSource());
        var copy = Between(source, "private void CopyMainOsClientConfig(", "public sealed class CopiedTenantRuntimeRow");
        var mqtt = Between(source, "private void UpdateTenantServiceFields(", "public sealed class TenantServiceTargetRow");

        foreach (var block in new[] { copy, mqtt })
        {
            Assert.Contains("OsClientType", block);
            Assert.Contains("OsClientNetwork", block);
            Assert.Contains("WHERE {idField} = @", block);
            Assert.Contains("ToList", block);
        }

        Assert.Contains("sources.Count != 1", copy);
        Assert.Contains("targetRows.Count != 1", copy);
        Assert.Contains("targets.Count != 1", mqtt);
        Assert.Contains("copiedRows.Count != 1", copy);
        Assert.Contains("copyReadback.Count != 1", copy);
        Assert.Contains("copiedFieldValues", copy);
        Assert.Contains("readbackRows.Count != 1", mqtt);
        Assert.Contains("TenantServiceReadbackMatches", mqtt);
        Assert.DoesNotContain("WHERE OsClient = @OsClient AND IsDeleted = 0", mqtt);
    }

    [Fact]
    public void MqttCompensationCannotReportSuccessWhenCloseReadbackFails()
    {
        var source = File.ReadAllText(GetProvisioningSource());
        var configure = Between(source, "private List<string> ConfigureTenantServiceCredentials(",
            "public sealed class MainMqttSwitchRow");
        Assert.Contains("UpdateTenantServiceFields(mainClient, osClient, osClientType, osClientNetwork, mqttReset)", configure);
        Assert.Contains("if (closedCount != 1) throw", configure);
        Assert.Contains("本次开通不得标记成功", configure);
    }

    [Fact]
    public void StopEventUsesPreviousEnabledSnapshotAfterHotClose()
    {
        var mqtt = File.ReadAllText(GetSiblingSource("Microi.MQTT", "MicroiMQTT.cs"));
        var state = File.ReadAllText(GetSiblingSource("Microi.MQTT", "MqttEnableState.cs"));
        Assert.Contains("_enableState.WasEnabledBeforeRefresh(normalizedTenant)", mqtt);
        Assert.Contains("_enableState.WasEnabledBeforeRefresh(item.Value?.OsClient)", mqtt);
        Assert.Contains("CapturePreviousEnabled();", state);
        Assert.Contains("Volatile.Write(ref _enabled, next)", state);
    }

    [Fact]
    public void HotClosedChildTenantIsDisconnectedWithoutStoppingOtherTenants()
    {
        var broker = File.ReadAllText(GetSiblingSource("Microi.MQTT", "MicroiMQTT.cs"));
        var hosted = File.ReadAllText(GetSiblingSource("Microi.MQTT", "MicroiMqttHostedService.cs"));
        var close = Between(broker, "public async Task DisconnectDisabledTenantsAsync()", "public async Task StopServerAsync()");
        Assert.Contains("_enableState.IsEnabled(item.Value.OsClient)", close);
        Assert.Contains("DisconnectClientAsync(candidate.Key", close);
        Assert.Contains("ReasonCode = MqttDisconnectReasonCode.AdministrativeAction", close);
        Assert.Contains("session.DeleteAsync()", close);
        Assert.Contains("TenantSessionItemKey", close);
        Assert.DoesNotContain("server.StopAsync()", close);
        Assert.Contains("await _mqtt.DisconnectDisabledTenantsAsync()", hosted);
        Assert.Contains("if (_mqtt.IsRunning) await _mqtt.StopServerAsync()", hosted);
    }

    [Theory]
    [InlineData("tenant-a", "tenant-a", true)]
    [InlineData("Tenant-A", "tenant-a", true)]
    [InlineData("tenant-a", "tenant-b", false)]
    [InlineData(null, "tenant-b", false)]
    public void OfflinePersistentSessionCannotBeReusedAcrossTenants(
        string? storedTenant, string requestedTenant, bool allowed)
    {
        var compatibility = typeof(MicroiMQTT).GetMethod("IsSessionTenantCompatible",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(compatibility);
        Assert.Equal(allowed, compatibility!.Invoke(null, new object?[] { storedTenant, requestedTenant }));

        var broker = File.ReadAllText(GetSiblingSource("Microi.MQTT", "MicroiMQTT.cs"));
        var validation = Between(broker, "private async Task OnValidateConnection(",
            "internal static bool IsSessionTenantCompatible(");
        Assert.Contains("await server.GetSessionsAsync()", validation);
        Assert.Contains("session.Items?[TenantSessionItemKey]", validation);
        Assert.Contains("IsSessionTenantCompatible(sessionTenant, osClient)", validation);
        Assert.True(validation.IndexOf("await server.GetSessionsAsync()", StringComparison.Ordinal)
                    < validation.IndexOf("TryRegisterConnectedClient(osClient", StringComparison.Ordinal));
    }

    [Fact]
    public void UpgradeMigrationTreatsOracleWhitespaceNullAndBlocksVersionOnResidualRows()
    {
        var upgrade = File.ReadAllText(GetSiblingSource("Microi.Upgrade", "Upgrade.cs"));
        Assert.Contains("var legacyBlankPredicate = $\"{field} IS NULL OR {trimmedValue} IS NULL OR {trimmedValue} = ''\"", upgrade);
        Assert.Contains("SELECT COUNT(*) FROM {table} WHERE {legacyBlankPredicate}", upgrade);
        Assert.Contains("旧库 MQTT 空开关迁移后仍存在 NULL，ServerVersion 不得推进", upgrade);
    }

    private static string Between(string source, string start, string end)
    {
        var from = source.IndexOf(start, StringComparison.Ordinal);
        Assert.True(from >= 0, $"Missing source marker: {start}");
        var to = source.IndexOf(end, from, StringComparison.Ordinal);
        Assert.True(to > from, $"Missing source marker: {end}");
        return source.Substring(from, to - from);
    }

    private static string GetProvisioningSource([CallerFilePath] string path = "")
        => Path.GetFullPath(Path.Combine(Path.GetDirectoryName(path)!, "..", "..",
            "Microi.Core", "Runtime", "TenantProvisioningService.cs"));

    private static string GetSiblingSource(string project, string file, [CallerFilePath] string path = "")
        => Path.GetFullPath(Path.Combine(Path.GetDirectoryName(path)!, "..", "..", project, file));
}
