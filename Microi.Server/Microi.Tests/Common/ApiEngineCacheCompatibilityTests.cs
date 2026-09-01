using System.Reflection;
using Microi.net;
using Microi.net.Api;
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

    private static readonly MethodInfo RouteCacheAliasMethod =
        typeof(DynamicRoute).GetMethod(
            "GetRouteCacheAliases",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("接口引擎动态路由缓存别名方法不存在。");

    private static readonly MethodInfo CanonicalRouteKeyMethod =
        typeof(DynamicRoute).GetMethod(
            "ResolveCanonicalApiEngineKey",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("接口引擎规范 Key 路由解析方法不存在。");

    private static readonly MethodInfo NormalizeRouteAddressMethod =
        typeof(DynamicRoute).GetMethod(
            "NormalizeApiEngineRouteAddress",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("接口引擎完整地址规范化方法不存在。");

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

    private static readonly MethodInfo UpgradeValidationEventMethod =
        UpgradeCacheCompatibilityType.GetMethod(
            "TryUpgradeValidationEvent",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("接口引擎多路由校验事件兼容方法不存在。");

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

    // zhy 2026-08-21：回归数据库冷缓存回源时的强类型别名提取，防止再次出现空响应 404。
    [Fact]
    public void DatabaseFallbackRouteAliasesAreStrongTypedAndNormalized()
    {
        var fallbackModel = JObject.Parse(
            "{\"ApiEngineKey\":\"Wx-Login\",\"ApiAddress\":\"/ApiEngine/Wx-Login\"}");

        var aliases = Assert.IsType<(string ApiEngineKey, string ApiAddress)>(
            RouteCacheAliasMethod.Invoke(null, new object?[] { fallbackModel }));

        Assert.Equal("wx-login", aliases.ApiEngineKey);
        Assert.Equal("/apiengine/wx-login", aliases.ApiAddress);
    }

    [Theory]
    [InlineData("/apiengine/home_platform_stats", "home_platform_stats")]
    [InlineData("/apiengine/home_platform_stats--OsClient--iTdos--", "home_platform_stats")]
    [InlineData("/ApiEngine/Platform.Health-V2", "platform.health-v2")]
    [InlineData("/custom/home_platform_stats", "")]
    [InlineData("/apiengine/nested/path", "")]
    public void CanonicalApiEngineRouteExtractsCompatibilityFallbackKey(
        string apiPath,
        string expectedKey)
    {
        var actual = Assert.IsType<string>(
            CanonicalRouteKeyMethod.Invoke(null, new object?[] { apiPath }));

        Assert.Equal(expectedKey, actual);
    }

    [Theory]
    [InlineData(
        "/apiengine/get-microi-store-list",
        "/apiengine/get-microi-store-list")]
    [InlineData(
        "/apiengine/get-microi-store-list--OsClient--iTdos--",
        "/apiengine/get-microi-store-list")]
    [InlineData(
        "/ApiEngine/Get-Microi-Store-List--osclient--JUNCHI--",
        "/apiengine/get-microi-store-list")]
    public void CompleteApiAddressRemainsStableAcrossTenantSuffixes(
        string apiPath,
        string expectedAddress)
    {
        var actual = Assert.IsType<string>(
            NormalizeRouteAddressMethod.Invoke(null, new object?[] { apiPath }));

        Assert.Equal(expectedAddress, actual);
    }

    [Theory]
    [InlineData("/apiengine/get-microi-store-list")]
    [InlineData("/apiengine/get-microi-store-list--OsClient--junchi--")]
    public void CustomListAddressWinsBeforeDifferentCanonicalKey(string requestPath)
    {
        var model = JObject.Parse(
            "{\"Id\":\"store-list\",\"ApiEngineKey\":\"get-microi-store\","
            + "\"ApiAddress\":\"/apiengine/get-microi-store-list\"}");
        var normalizedAddress = Assert.IsType<string>(
            NormalizeRouteAddressMethod.Invoke(null, new object?[] { requestPath }));
        var canonicalKey = Assert.IsType<string>(
            CanonicalRouteKeyMethod.Invoke(null, new object?[] { requestPath }));
        var routeAliases = Assert.IsType<(string ApiEngineKey, string ApiAddress)>(
            RouteCacheAliasMethod.Invoke(null, new object?[] { model }));

        var aliases = ApiEngineRouteAliases.GetCacheAliases(model);

        Assert.True(ApiEngineRouteAliases.ContainsExactRoute(model, normalizedAddress));
        Assert.Equal("get-microi-store", routeAliases.ApiEngineKey);
        Assert.Equal("get-microi-store-list", canonicalKey);
        Assert.NotEqual(routeAliases.ApiEngineKey, canonicalKey);
        Assert.Contains("get-microi-store", aliases);
        Assert.Contains("/apiengine/get-microi-store-list", aliases);
        Assert.DoesNotContain("get-microi-store-list", aliases);
    }

    [Theory]
    [InlineData("/apiengine/savesalesckinfoV2")]
    [InlineData("/apiengine/savesalesckinfoV2--OsClient--myzsl--")]
    public void ExplicitSalesAddressDoesNotBecomeItsDifferentEngineKey(string requestPath)
    {
        var model = JObject.Parse(
            "{\"Id\":\"sales-route\","
            + "\"ApiEngineKey\":\"cjt_productReceive_to_ERP_V2\","
            + "\"ApiAddress\":\"/apiengine/savesalesckinfoV2\"}");
        var normalizedAddress = Assert.IsType<string>(
            NormalizeRouteAddressMethod.Invoke(null, new object?[] { requestPath }));
        var canonicalKey = Assert.IsType<string>(
            CanonicalRouteKeyMethod.Invoke(null, new object?[] { requestPath }));
        var routeAliases = Assert.IsType<(string ApiEngineKey, string ApiAddress)>(
            RouteCacheAliasMethod.Invoke(null, new object?[] { model }));

        Assert.True(ApiEngineRouteAliases.ContainsExactRoute(model, normalizedAddress));
        Assert.Equal("cjt_productreceive_to_erp_v2", routeAliases.ApiEngineKey);
        Assert.Equal("savesalesckinfov2", canonicalKey);
        Assert.NotEqual(routeAliases.ApiEngineKey, canonicalKey);
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
    public void RouteColdMissAndStartupCacheUseAuthoritativePrimaryDatabase()
    {
        var serverRoot = Path.Combine(FindRepositoryRoot(), "Microi.Server");
        var apiEngineSource = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.net", "ApiEngine", "ApiEngine.cs"));
        var dynamicRouteSource = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.net.Api", "Handler", "DynamicApiEngine.cs"));
        var apiControllerSource = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.net.Api", "Controllers", "ApiEngineController.cs"));
        var initializerSource = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.Core", "ApiEngine", "ApiEngineRouteCacheInitializer.cs"));
        var storeSource = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.Core", "ApiEngine", "ApiEngineAuthoritativeStore.cs"));

        Assert.Contains("ApiEngineAuthoritativeStore.GetEnabledModel(client, addressParam)", dynamicRouteSource);
        Assert.Contains("ApiEngineAuthoritativeStore.GetEnabledByMultiRoute(client, apiAddress)", dynamicRouteSource);
        Assert.Contains(".GetAuthoritativeApiEngineModel(keyParam)", dynamicRouteSource);
        var addressAuthorityIndex = dynamicRouteSource.IndexOf(
            "var fallbackResult = GetAuthoritativeRouteByAddress",
            StringComparison.Ordinal);
        var keyAuthorityIndex = dynamicRouteSource.IndexOf(
            "ApiEngineKey = canonicalApiEngineKey",
            StringComparison.Ordinal);
        Assert.True(addressAuthorityIndex >= 0, "动态路由必须先按完整 ApiAddress 回源。");
        Assert.True(keyAuthorityIndex > addressAuthorityIndex,
            "只有完整 ApiAddress 明确未配置后才能回退 canonical Key。");
        Assert.Contains("fallbackResult.Code == 1", dynamicRouteSource);
        Assert.Contains("fallbackResult.Data == null", dynamicRouteSource);
        var routeOccupancyIndex = dynamicRouteSource.IndexOf(
            ".HasConfiguredRoute(OsClientExtend.GetClient(osClient), apiPathLower)",
            StringComparison.Ordinal);
        Assert.True(routeOccupancyIndex > addressAuthorityIndex,
            "启用地址未命中后必须检查停用地址占用状态。");
        Assert.True(keyAuthorityIndex > routeOccupancyIndex,
            "只有地址从未配置时才能回退 canonical Key。");
        Assert.Contains(
            "DynamicRoute.NormalizeApiEngineRouteAddress(requestPath)",
            apiControllerSource);
        Assert.Contains("if (!resolvedApiEngineKey.DosIsNullOrWhiteSpace())", apiControllerSource);
        Assert.Contains("param[\"ApiEngineKey\"] = resolvedApiEngineKey", apiControllerSource);
        Assert.Contains("param[\"ApiAddress\"] = normalizedApiAddress", apiControllerSource);
        Assert.DoesNotContain(
            "DynamicRoute.ResolveCanonicalApiEngineKey(requestPath)",
            apiControllerSource);
        Assert.DoesNotContain(
            @"^/apiengine/([A-Za-z0-9_.:-]+)(?:--OsClient--.*--)?$",
            apiControllerSource);
        Assert.DoesNotContain(
            "fallbackResult = await MicroiEngine.ApiEngine.GetApiEngineModel(new ApiEngineParam",
            dynamicRouteSource);
        Assert.Contains("ApiEngineAuthoritativeStore.GetEnabledModel", apiEngineSource);
        Assert.Contains("ApiEngineAuthoritativeStore.GetEnabledByMultiRoute", apiEngineSource);
        Assert.Contains("ApiEngineAuthoritativeStore.GetAllEnabled(client)", initializerSource);
        Assert.DoesNotContain("MicroiEngine.FormEngine.GetTableDataAsync", initializerSource);
        Assert.Contains("RemoveParentAsync", initializerSource);
        Assert.Contains("client.Db.FromSql(sql)", storeSource);
        Assert.Contains("public static DosResult<bool> HasConfiguredRoute", storeSource);
        Assert.Contains("bool enabledOnly = true", storeSource);
        Assert.DoesNotContain("client.DbRead", storeSource);
    }

    private static string FindRepositoryRoot()
    {
        foreach (var startPath in new[]
                 {
                     Environment.GetEnvironmentVariable("MICROI_TEST_REPOSITORY_ROOT"),
                     Directory.GetCurrentDirectory(),
                     AppContext.BaseDirectory
                 }.Where(path => !string.IsNullOrWhiteSpace(path)))
        {
            var directory = new DirectoryInfo(startPath);
            while (directory != null && !Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
                directory = directory.Parent;
            if (directory != null) return directory.FullName;
        }
        throw new DirectoryNotFoundException("Repository root not found.");
    }

    [Fact]
    public void UpgradeEventAlwaysWritesJsonTextForV3AndV6()
    {
        var script = Assert.IsType<string>(CompatibleEventField.GetRawConstantValue());

        Assert.Contains("MICROI_APIENGINE_CACHE_MULTI_ROUTE_V2", script);
        Assert.Contains("var formModel = V8.Form || {};", script);
        Assert.Contains("JSON.stringify(formModel)", script);
        Assert.Contains("ApiRoutes", script);
        Assert.Contains("split(';')", script);
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
        Assert.Contains("MICROI_APIENGINE_CACHE_MULTI_ROUTE_V2", upgraded);
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

    [Fact]
    public void ValidationEventIsPrependedWithoutLosingCustomerValidation()
    {
        const string customerCode = "if(V8.Form.ApiName == 'blocked') return {Code:0,Msg:'blocked'};";
        var arguments = new object?[] { customerCode, null };

        var changed = Assert.IsType<bool>(UpgradeValidationEventMethod.Invoke(null, arguments));

        Assert.True(changed);
        var upgraded = Assert.IsType<string>(arguments[1]);
        Assert.Contains("MICROI_APIENGINE_MULTI_ROUTE_VALIDATE_V1", upgraded);
        Assert.Contains("ApiRoutes", upgraded);
        Assert.EndsWith(customerCode, upgraded.TrimEnd());
    }

    [Fact]
    public void MultiRoutesProvideAllCacheAliasesAndRejectMalformedRoutes()
    {
        var model = JObject.Parse("""
            {
              "Id":"engine-id",
              "ApiEngineKey":"platform-user",
              "ApiAddress":"/apiengine/platform-user",
              "ApiRoutes":"/api/SysUser/GetCurrentUser; /api/SysUser/TokenLogin"
            }
            """);

        var aliases = ApiEngineRouteAliases.GetCacheAliases(model);

        Assert.Equal(5, aliases.Count);
        Assert.Contains("/api/sysuser/getcurrentuser", aliases);
        Assert.Contains("/api/sysuser/tokenlogin", aliases);
        Assert.True(ApiEngineRouteAliases.TryValidate(
            "/apiengine/platform-user",
            "/api/SysUser/GetCurrentUser;/api/SysUser/TokenLogin",
            out _));
        Assert.False(ApiEngineRouteAliases.TryValidate(
            "/apiengine/platform-user",
            "/api/test?unsafe=1",
            out var error));
        Assert.Contains("不能包含", error);
    }

    [Fact]
    public void ExplicitCompatibilityKeyDeterministicallyOverridesAnotherEngineIdAlias()
    {
        var original = JObject.Parse("""
            {
              "Id":"legacy-runtime-id",
              "ApiEngineKey":"current-runtime-key",
              "ApiAddress":"/apiengine/current-runtime-key"
            }
            """);
        var gateway = JObject.Parse("""
            {
              "Id":"gateway-row-id",
              "ApiEngineKey":"legacy-runtime-id",
              "ApiAddress":"/apiengine/legacy-runtime-id"
            }
            """);

        Assert.Equal(100, ApiEngineRouteAliases.GetCacheAliasPriority(original, "legacy-runtime-id"));
        Assert.Equal(300, ApiEngineRouteAliases.GetCacheAliasPriority(gateway, "legacy-runtime-id"));
        Assert.Equal(200, ApiEngineRouteAliases.GetCacheAliasPriority(
            gateway,
            "/apiengine/legacy-runtime-id"));
    }

    [Fact]
    public void DuplicateHighestPriorityAliasIsQuarantinedWithoutDroppingUniqueRoutes()
    {
        var first = JObject.Parse("""
            {
              "Id":"engine-a",
              "ApiEngineKey":"duplicate-key",
              "ApiAddress":"/api/engine-a"
            }
            """);
        var second = JObject.Parse("""
            {
              "Id":"engine-b",
              "ApiEngineKey":"duplicate-key",
              "ApiAddress":"/api/engine-b"
            }
            """);

        var forward = ApiEngineRouteAliases.ResolveCacheAliases(new object[] { first, second });
        var reverse = ApiEngineRouteAliases.ResolveCacheAliases(new object[] { second, first });

        Assert.DoesNotContain("duplicate-key", forward.Aliases.Keys);
        Assert.DoesNotContain("duplicate-key", reverse.Aliases.Keys);
        Assert.Contains("engine-a", forward.Aliases.Keys);
        Assert.Contains("engine-b", forward.Aliases.Keys);
        Assert.Contains("/api/engine-a", forward.Aliases.Keys);
        Assert.Contains("/api/engine-b", forward.Aliases.Keys);
        Assert.Equal(forward.Aliases.Keys.OrderBy(x => x), reverse.Aliases.Keys.OrderBy(x => x));
        Assert.Equal("duplicate-key", Assert.Single(forward.Conflicts).Alias);
    }

    [Fact]
    public void UniqueHigherPriorityKeyWinsOverMultipleLowerPriorityIdClaims()
    {
        var explicitGateway = JObject.Parse("""
            {
              "Id":"gateway-id",
              "ApiEngineKey":"legacy-alias",
              "ApiAddress":"/api/gateway"
            }
            """);
        var legacyA = JObject.Parse("""
            {
              "Id":"legacy-alias",
              "ApiEngineKey":"legacy-a",
              "ApiAddress":"/api/legacy-a"
            }
            """);
        var legacyB = JObject.Parse("""
            {
              "Id":"legacy-alias",
              "ApiEngineKey":"legacy-b",
              "ApiAddress":"/api/legacy-b"
            }
            """);

        var resolution = ApiEngineRouteAliases.ResolveCacheAliases(
            new object[] { legacyA, legacyB, explicitGateway });

        Assert.Equal(
            "gateway-id",
            resolution.Aliases["legacy-alias"].EngineId);
        Assert.DoesNotContain(
            resolution.Conflicts,
            conflict => string.Equals(conflict.Alias, "legacy-alias", StringComparison.OrdinalIgnoreCase));
    }
}
