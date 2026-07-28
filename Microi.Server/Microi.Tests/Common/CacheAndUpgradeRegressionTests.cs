using System.Reflection;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class CacheAndUpgradeRegressionTests
{
    [Fact]
    public void TwoLevelCache_BoundsPublishConcurrencyPerTenant()
    {
        var type = typeof(MicroiTwoLevelCache);
        var publishGate = type.GetField("_publishGate", BindingFlags.Instance | BindingFlags.NonPublic);
        var subscriberInitialized = type.GetField(
            "_subscriberInitialized",
            BindingFlags.Instance | BindingFlags.Static | BindingFlags.NonPublic);
        var publishWithRetry = type.GetMethod(
            "PublishWithRetryAsync",
            BindingFlags.Instance | BindingFlags.NonPublic);

        Assert.NotNull(publishGate);
        Assert.Equal(typeof(SemaphoreSlim), publishGate!.FieldType);
        Assert.NotNull(subscriberInitialized);
        Assert.False(subscriberInitialized!.IsStatic);
        Assert.NotNull(publishWithRetry);
        Assert.Equal(typeof(Task), publishWithRetry!.ReturnType);
    }

    [Fact]
    public void TwoLevelCache_UsesContainerSafeInstanceIdentityForPubSubInvalidation()
    {
        var type = typeof(MicroiTwoLevelCache);
        var instanceId = type.GetField(
            "_cacheInstanceId",
            BindingFlags.Static | BindingFlags.NonPublic);
        var buildInstanceId = type.GetMethod(
            "BuildCacheInstanceId",
            BindingFlags.Static | BindingFlags.NonPublic);

        Assert.NotNull(instanceId);
        Assert.True(instanceId!.IsStatic);
        Assert.NotNull(buildInstanceId);

        var first = Assert.IsType<string>(buildInstanceId!.Invoke(null, null));
        var second = Assert.IsType<string>(buildInstanceId.Invoke(null, null));
        Assert.NotEqual(first, second);
        Assert.Contains($":{Environment.ProcessId}:", first);
    }

    [Fact]
    public void Upgrade_RepairsOnlyOfficialWebsiteAnonymousApiContract()
    {
        var type = typeof(MicroiUpgrade);
        var keysField = type.GetField(
            "OfficialWebsiteAnonymousApiEngineKeys",
            BindingFlags.Static | BindingFlags.NonPublic);
        var tenantCheck = type.GetMethod(
            "IsOfficialWebsiteTenant",
            BindingFlags.Static | BindingFlags.NonPublic);
        var repairMethod = type.GetMethod(
            "EnsureOfficialWebsitePublicApiEngineContractAsync",
            BindingFlags.Instance | BindingFlags.NonPublic);

        Assert.NotNull(keysField);
        var keys = Assert.IsType<string[]>(keysField!.GetValue(null));
        Assert.Equal(new[] { "send_sms_reg" }, keys);
        Assert.NotNull(tenantCheck);
        Assert.True(Assert.IsType<bool>(tenantCheck!.Invoke(null, new object[] { "iTdos" })));
        Assert.False(Assert.IsType<bool>(tenantCheck.Invoke(null, new object[] { "customer" })));
        Assert.NotNull(repairMethod);
        Assert.Equal(typeof(Task), repairMethod!.ReturnType);
    }

    [Fact]
    public void AppStoreBundle_KeepsTrustedImporterAboveJintTwoGigabyteBoundary()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);

        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.store.json"]);
        var importer = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "import-microi-store-package");

        Assert.True(
            importer["LimitMemory"]?.Value<int>() >= 3072,
            "The trusted package importer must retain enough cumulative-allocation budget for Jint 4.14.");
    }

    [Fact]
    public void UpgradeMenuPatch_ConvertsDynamicDataBeforeUsingJTokenExtensions()
    {
        dynamic data = JObject.Parse("""{"Id":"menu-a","Name":null}""");

        JObject currentMenu = JsonHelper.ToJObject((object)data) ?? new JObject();

        Assert.Equal("menu-a", currentMenu["Id"].Val<string>());
        Assert.Null(currentMenu["Name"].Val<string>());
    }

    [Fact]
    public void OnlineAppStoreBundle_WithLegacyImporterLimit_RemainsRuntimeRepairable()
    {
        var loadResources = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.Static | BindingFlags.NonPublic);
        var validateResource = typeof(UpgradeAppStore).GetMethod(
            "ValidateResourceContent",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(loadResources);
        Assert.NotNull(validateResource);

        var resources = Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(
            loadResources!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.store.json"]);
        var importer = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "import-microi-store-package");
        importer["LimitMemory"] = 2048;

        var exception = Record.Exception(() => validateResource!.Invoke(
            null,
            new object[] { "app.microi.store.json", package.ToString() }));

        Assert.Null(exception);
    }
}
