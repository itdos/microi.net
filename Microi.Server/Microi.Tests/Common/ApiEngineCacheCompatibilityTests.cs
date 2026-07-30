using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class ApiEngineCacheCompatibilityTests
{
    private static readonly Type UpgradeCacheCompatibilityType =
        typeof(MicroiUpgrade).Assembly.GetType(
            "Microi.net.ApiEngineCacheCompatibility",
            throwOnError: true)!;

    private static readonly MethodInfo NormalizeMethod =
        typeof(ApiEngine).GetMethod(
            "TryNormalizeApiEngineCache",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("接口引擎缓存兼容方法不存在。");

    private static readonly MethodInfo AuthoritativeReadPolicyMethod =
        typeof(ApiEngine).GetMethod(
            "RequireAuthoritativeApiEngineModel",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("后台接口引擎权威读取策略不存在。");

    private static readonly MethodInfo UpgradeEventMethod =
        UpgradeCacheCompatibilityType.GetMethod(
            "TryUpgradeEvent",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("接口引擎表事件兼容方法不存在。");

    private static readonly FieldInfo CompatibleEventField =
        UpgradeCacheCompatibilityType.GetField(
            "SubmitAfterServerV8",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("接口引擎兼容表事件不存在。");

    [Theory]
    [InlineData("{\"ApiEngineKey\":\"get-microi-store\",\"IsEnable\":1}")]
    [InlineData("\"{\\\"ApiEngineKey\\\":\\\"get-microi-store\\\",\\\"IsEnable\\\":1}\"")]
    public void StandardAndDoubleEncodedJsonBecomeDynamicObjects(string cachedValue)
    {
        var arguments = new object?[] { cachedValue, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        var model = Assert.IsType<JObject>(arguments[1]);
        Assert.Equal("get-microi-store", model.Value<string>("ApiEngineKey"));
        Assert.Equal(1, model.Value<int>("IsEnable"));
    }

    [Fact]
    public void HistoricalSystemTypeNameIsRejectedForDatabaseFallback()
    {
        var arguments = new object?[]
        {
            "System.Dynamic.ExpandoObject",
            null
        };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.False(success);
        Assert.Null(arguments[1]);
    }

    [Fact]
    public void ExistingJObjectKeepsItsObjectShape()
    {
        var cachedValue = JObject.Parse(
            "{\"ApiEngineKey\":\"get-microi-store\",\"IsEnable\":1}");
        var arguments = new object?[] { cachedValue, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        Assert.Same(cachedValue, arguments[1]);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public void DurableBackgroundExecutionRequiresAuthoritativeDatabaseRead(
        bool preserveTrustedCurrentUser,
        bool expected)
    {
        var actual = Assert.IsType<bool>(
            AuthoritativeReadPolicyMethod.Invoke(null, new object?[] { preserveTrustedCurrentUser }));

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void UpgradeEventAlwaysWritesJsonTextForV3AndV6()
    {
        var script = Assert.IsType<string>(CompatibleEventField.GetRawConstantValue());

        Assert.Contains("MICROI_APIENGINE_CACHE_V3_COMPAT_V1", script);
        Assert.Contains("var formModel = V8.Form || {};", script);
        Assert.Contains("JSON.stringify(formModel)", script);
        Assert.DoesNotContain(", formModel);", script);
    }

    [Fact]
    public void HistoricalRawObjectAssignmentIsRepairedWithoutLosingCustomerCode()
    {
        const string customerCode = "console.log('customer-code-kept');";
        var oldScript = "var cacheKey = `Microi:${V8.OsClient}:FormData:sys_apiengine:${V8.Form.ApiEngineKey}`;\n"
            + "var formModel   =   V8.Form ;\n"
            + "V8.Cache.Set(cacheKey, formModel);\n"
            + customerCode;
        var arguments = new object?[] { oldScript, null };

        var changed = Assert.IsType<bool>(UpgradeEventMethod.Invoke(null, arguments));

        Assert.True(changed);
        var upgraded = Assert.IsType<string>(arguments[1]);
        Assert.Contains("MICROI_APIENGINE_CACHE_V3_COMPAT_V1", upgraded);
        Assert.Contains("JSON.stringify(formModel)", upgraded);
        Assert.Contains(customerCode, upgraded);
        Assert.Contains("var formModel   =   V8.Form ;", upgraded);
        Assert.DoesNotContain(", formModel);", upgraded);
    }

    [Fact]
    public void EnhancedPartialSaveEventKeepsObjectLogicAndSerializesOnlyCacheWrites()
    {
        var oldScript = "var formModel = V8.Form || {};\n"
            + "var apiEngineKey = formModel.ApiEngineKey;\n"
            + "formModel.ApiAddress = '/apiengine/test';\n"
            + "V8.Cache.Set(`Microi:${V8.OsClient}:FormData:sys_apiengine:${apiEngineKey}`, formModel);";
        var arguments = new object?[] { oldScript, null };

        var changed = Assert.IsType<bool>(UpgradeEventMethod.Invoke(null, arguments));

        Assert.True(changed);
        var upgraded = Assert.IsType<string>(arguments[1]);
        Assert.Contains("var formModel = V8.Form || {};", upgraded);
        Assert.Contains("formModel.ApiAddress = '/apiengine/test';", upgraded);
        Assert.Contains(", JSON.stringify(formModel));", upgraded);
    }

    [Fact]
    public void HistoricalJsonVariableIsNotDoubleEncoded()
    {
        var oldScript = "var cacheKey = `Microi:${V8.OsClient}:FormData:sys_apiengine:test`;\n"
            + "var formModel = JSON.stringify(V8.Form);\n"
            + "V8.Cache.Set(cacheKey, formModel);";
        var arguments = new object?[] { oldScript, null };

        var changed = Assert.IsType<bool>(UpgradeEventMethod.Invoke(null, arguments));

        Assert.True(changed);
        var upgraded = Assert.IsType<string>(arguments[1]);
        Assert.Contains("V8.Cache.Set(cacheKey, formModel);", upgraded);
        Assert.DoesNotContain("JSON.stringify(formModel)", upgraded);
    }

    [Fact]
    public void UnrelatedCustomerTableEventIsNotModified()
    {
        const string script = "var formModel = V8.Form;\nconsole.log(formModel);";
        var arguments = new object?[] { script, null };

        var changed = Assert.IsType<bool>(UpgradeEventMethod.Invoke(null, arguments));

        Assert.False(changed);
        Assert.Equal(script, Assert.IsType<string>(arguments[1]));
    }
}
