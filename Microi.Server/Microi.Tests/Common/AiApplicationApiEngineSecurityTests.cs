using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public class AiApplicationApiEngineSecurityTests
{
    private static object? Invoke(string methodName, params object?[] args)
    {
        var method = typeof(ApiEngine).GetMethod(
            methodName,
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return method!.Invoke(null, args);
    }

    private static object? InvokeFormEngine(string methodName, params object?[] args)
    {
        var method = typeof(FormEngine).GetMethod(
            methodName,
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return method!.Invoke(null, args);
    }

    [Theory]
    [InlineData("app_bby_bootstrap_query", true)]
    [InlineData("APP_BBY_SAVE", true)]
    [InlineData("official_ai_apps", false)]
    [InlineData("app.microi.ai-engine", false)]
    public void AiApplicationEngineKey_IsLimitedToAppUnderscorePrefix(string key, bool expected)
    {
        Assert.Equal(expected, (bool)Invoke("IsAiApplicationEngineKey", key)!);
    }

    [Theory]
    [InlineData("return V8.FormEngine.GetTableData('app_x', {});", false)]
    [InlineData("return V8.FormEngine.AddFormData('app_x', V8.Param);", true)]
    [InlineData("V8.Db.FromSql('update app_x set Status=1').ExecuteNonQuery();", true)]
    [InlineData("return V8.ApiEngine.Run('app_order_confirm', V8.Param);", true)]
    [InlineData("return V8.ApiEngine.Run('app_order_detail', V8.Param);", false)]
    public void AiApplicationWriteCode_DetectsPersistenceButKeepsReadsAnonymous(string code, bool expected)
    {
        Assert.Equal(expected, (bool)Invoke("IsAiApplicationWriteCode", code)!);
    }

    [Theory]
    [InlineData(
        true,
        "return V8.FormEngine.AddFormData('app_cg1_session', {});",
        true)]
    [InlineData(
        true,
        "V8.FormEngine.AddFormData('app_cg1_session', {}); return V8.FormEngine.UptFormData('app_cg1_request', { Id: 'x' });",
        true)]
    [InlineData(
        false,
        "return V8.FormEngine.AddFormData('app_cg1_session', {});",
        false)]
    [InlineData(
        true,
        "return V8.FormEngine.AddFormData('customer_order', {});",
        false)]
    [InlineData(
        true,
        "return V8.FormEngine.AddFormData(tableName, {});",
        false)]
    [InlineData(
        true,
        "V8.FormEngine.AddFormData('app_cg1_session', {}); V8.Db.FromSql('update app_cg1_session set Score=1').ExecuteNonQuery();",
        false)]
    [InlineData(
        true,
        "return V8.ApiEngine.Run('app_cg1_finish', V8.Param);",
        false)]
    [InlineData(
        true,
        "return V8.FormEngine.AddTableData([{ FormEngineKey: 'app_cg1_session' }]);",
        false)]
    public void AnonymousAiApplicationWrite_OnlyAllowsScopedLiteralAppTables(
        bool allowAnonymous,
        string code,
        bool expected)
    {
        Assert.Equal(
            expected,
            (bool)Invoke(
                "IsAnonymousAiApplicationWriteAllowed",
                allowAnonymous,
                code)!);
    }

    [Theory]
    [InlineData("app_bby_bootstrap_query", true)]
    [InlineData("app_cgb_order_detail", true)]
    [InlineData("app_bby_detail_save", false)]
    [InlineData("app_order_confirm", false)]
    public void AiApplicationReadEngineKey_OnlyAllowsExplicitReadSuffixes(string key, bool expected)
    {
        Assert.Equal(expected, (bool)Invoke("IsAiApplicationReadEngineKey", key)!);
    }

    [Theory]
    [InlineData("app_baby_care_api", "Bootstrap", true)]
    [InlineData("app_baby_care_api", "List", true)]
    [InlineData("app_baby_care_api", "Save", false)]
    [InlineData("app_baby_care_api", "Delete", false)]
    [InlineData("app_wr_weekly_trend", null, true)]
    [InlineData("app_wrd_daily_status", null, true)]
    [InlineData("app_cln_doctor_status", null, false)]
    public void AiApplicationReadRequest_SeparatesGenericReadAndWriteActions(
        string key,
        string? action,
        bool expected)
    {
        var param = new JObject();
        if (action != null) param["Action"] = action;
        const string source = "var action = text(V8.Param.Action, 'Bootstrap'); return V8.FormEngine.AddFormData('app_x', {});";

        Assert.Equal(expected, (bool)Invoke("IsAiApplicationReadRequest", key, param, source)!);
    }

    [Theory]
    [InlineData("action", "list", true)]
    [InlineData("command", "save", false)]
    [InlineData("Operation", "Delete", false)]
    public void AiApplicationReadRequest_AcceptsCaseInsensitiveActionAliases(
        string field,
        string action,
        bool expected)
    {
        var param = new JObject { [field] = action };
        const string source = "var action = text(V8.Param.Action, 'Bootstrap'); return V8.FormEngine.AddFormData('app_x', {});";

        Assert.Equal(expected, (bool)Invoke("IsAiApplicationReadRequest", "app_baby_care_api", param, source)!);
    }

    [Fact]
    public void AiApplicationGenericApi_OnlyDefaultsToReadWhenSourceDeclaresBootstrap()
    {
        var param = new JObject();
        Assert.True((bool)Invoke(
            "IsAiApplicationReadRequest",
            "app_baby_care_api",
            param,
            "var action = text(V8.Param.Action, 'Bootstrap');")!);
        Assert.False((bool)Invoke(
            "IsAiApplicationReadRequest",
            "app_unknown_api",
            param,
            "return V8.FormEngine.AddFormData('app_x', V8.Param);")!);
    }

    [Fact]
    public void AuthenticatedIdentity_OverridesSpoofedIsolationFields()
    {
        var param = new JObject
        {
            ["ClientKey"] = "spoofed-client",
            ["ActorKey"] = "spoofed-actor",
            ["UserId"] = "spoofed-user"
        };
        var user = new JObject
        {
            ["Id"] = "user-123",
            ["Name"] = "测试用户"
        };

        Invoke("ApplyAiApplicationIdentity", param, user, "iTdos");

        Assert.Equal("user-123", param.Value<string>("ClientKey"));
        Assert.Equal("user-123", param.Value<string>("ActorKey"));
        Assert.Equal("user-123", param.Value<string>("UserId"));
        Assert.Equal("测试用户", param.Value<string>("UserName"));
    }

    [Fact]
    public void AnonymousIdentity_UsesStableHashedReadScopeForEveryOwnerField()
    {
        var first = new JObject
        {
            ["_DeviceId"] = "PC:browser-a",
            ["ClientKey"] = "known-user-id",
            ["UserId"] = "known-user-id"
        };
        var second = (JObject)first.DeepClone();

        Invoke("ApplyAiApplicationIdentity", first, null, "iTdos");
        Invoke("ApplyAiApplicationIdentity", second, null, "iTdos");

        Assert.StartsWith("anon_", first.Value<string>("ClientKey"));
        Assert.Equal(first.Value<string>("ClientKey"), first.Value<string>("ActorKey"));
        Assert.Equal(first.Value<string>("ClientKey"), first.Value<string>("UserId"));
        Assert.Equal(first.Value<string>("ClientKey"), second.Value<string>("ClientKey"));
        Assert.NotEqual("known-user-id", first.Value<string>("ClientKey"));
    }

    [Fact]
    public void FormEngineScope_OverridesOwnerFieldsAndWhereInsideAiApplicationV8()
    {
        var param = new DiyTableRowParam
        {
            FormEngineKey = "app_demo_order",
            _RowModel = new JObject { ["UserId"] = "spoofed-user" },
            _Where = new List<object>
            {
                new List<object> { "Status", "=", "active" },
                new List<object> { "AND", "UserId", "=", "spoofed-user" }
            }
        };
        var method = typeof(FormEngine).GetMethod(
            "ApplyAiApplicationUserScope",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        using (V8TenantContext.Enter(
                   "iTdos",
                   "app_demo_order_save",
                   "ApiEngine",
                   null,
                   "user-123"))
        {
            method!.Invoke(null, new object[] { param });
        }

        Assert.Equal("user-123", param._RowModel.Value<string>("UserId"));
        var ownerConditions = WhereParser.ParseWhere(param._Where)
            .Where(item => string.Equals(item.Name, "UserId", StringComparison.OrdinalIgnoreCase))
            .ToList();
        Assert.Single(ownerConditions);
        Assert.Equal("user-123", ownerConditions[0].Value?.ToString());
    }

    [Fact]
    public async Task AnonymousAiApplicationV8_FormEngineCallIsTrustedAndOwnerScoped()
    {
        var engine = new FormEngine();

        using (V8TenantContext.Enter(
                   "iTdos",
                   "app_cg1_start",
                   "ApiEngine",
                   null,
                   "anon_device_scope"))
        {
            var param = await engine.DynamicToDiyTableRowParam(new JObject
            {
                ["FormEngineKey"] = "app_cg1_session",
                ["_InvokeType"] = InvokeType.Client.ToString(),
                ["_RowModel"] = new JObject
                {
                    ["UserId"] = "spoofed-user",
                    ["SessionNo"] = "session-1"
                }
            });

            Assert.True(param._TrustedServerInvocation);
            Assert.Equal("anon_device_scope", param._RowModel?["UserId"]?.ToString());
            var ownerConditions = WhereParser.ParseWhere(param._Where)
                .Where(item => string.Equals(
                    item.Name,
                    "UserId",
                    StringComparison.OrdinalIgnoreCase))
                .ToList();
            Assert.Single(ownerConditions);
            Assert.Equal("anon_device_scope", ownerConditions[0].Value?.ToString());
        }
    }

    [Fact]
    public void AnonymousAiApplicationInsert_UsesSameServerOwnerAsScopedUpdates()
    {
        using (V8TenantContext.Enter(
                   "iTdos",
                   "app_cg1_start",
                   "ApiEngine",
                   null,
                   "anon_device_scope"))
        {
            var anonymous = InvokeFormEngine(
                "ResolveAiApplicationInsertUserId",
                new DiyTableRowParam { FormEngineKey = "app_cg1_session" },
                null);
            Assert.Equal("anon_device_scope", anonymous);
        }

        var authenticated = InvokeFormEngine(
            "ResolveAiApplicationInsertUserId",
            new DiyTableRowParam { FormEngineKey = "app_cg1_session" },
            "user-123");
        Assert.Equal("user-123", authenticated);
    }
}
