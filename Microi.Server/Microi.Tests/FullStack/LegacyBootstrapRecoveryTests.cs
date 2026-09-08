using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Microi.Tests.FullStack;

[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
[Trait("Suite", "LegacyBootstrapRecovery")]
public sealed class LegacyBootstrapRecoveryTests
{
    [Fact]
    public async Task RemovedEnginesWithWarmRoutes_FallBackAndResumeManagedExecutionAfterRestore()
    {
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        var tenant = Required("MICROI_TEST_OSCLIENT");
        Assert.False(string.Equals(tenant, "iTdos", StringComparison.OrdinalIgnoreCase),
            "Missing-engine fault injection must never run against the official publishing tenant.");
        var device = "LegacyBootstrapRecovery-" + Guid.NewGuid().ToString("N");
        using var admin = Client(Required("MICROI_TEST_DID"), Required("MICROI_TEST_TOKEN"));
        using var anonymous = Client(device);
        var keys = new[] { "platform-sys-user-session", "platform-os-legacy-compatibility", "platform-client-log", "platform-sys-menu" };
        var fields = new[] { "Id", "ApiEngineKey", "ApiAddress", "ApiRoutes" };
        var restoredRows = new List<JsonObject>();
        string? loginToken = null;

        async Task<JsonNode?> Form(string action, JsonObject data)
        {
            data["FormEngineKey"] = "sys_apiengine";
            var result = await Send(admin, "api/FormEngine/" + action, data);
            Success(result.Body);
            return result.Body["Data"];
        }

        JsonObject KeyQuery() => new()
        {
            ["_Where"] = new JsonArray(new JsonArray("ApiEngineKey", "In", new JsonArray(keys.Select(x => JsonValue.Create(x)).ToArray()))),
            ["_SelectFields"] = new JsonArray(fields.Select(x => JsonValue.Create(x)).ToArray()),
            ["_PageSize"] = 20
        };

        async Task<(JsonObject Body, string Route, string? Token)> Login(bool invalid = false)
        {
            var body = new JsonObject
            {
                ["Account"] = Required("MICROI_TEST_ACCOUNT"),
                ["Pwd"] = invalid ? "invalid-bootstrap-password-" + device : Required("MICROI_TEST_PASSWORD"),
                ["_AutomationTestLogin"] = true,
                ["_ClientType"] = "PC"
            };
            if (invalid) body["_DevBypassPwd"] = true;
            // No Action: legacy clients rely on the requested URL to select Login.
            return await Send(anonymous, "api/SysUser/Login", body);
        }

        try
        {
            var initial = await Login();
            Success(initial.Body);
            loginToken = initial.Token;
            Assert.NotEqual("CompiledFallback", initial.Route);
            var rows = Assert.IsType<JsonArray>(await Form("GetTableData", KeyQuery()));
            Assert.Equal(keys.Length, rows.Count);
            foreach (var row in rows.OfType<JsonObject>())
            {
                var original = (JsonObject)row.DeepClone();
                restoredRows.Add(original); // Recover even if the update response is ambiguous.
                var marker = "bootstrap-" + Guid.NewGuid().ToString("N");
                var replacement = new JsonObject
                {
                    ["Id"] = row["Id"]!.ToString(), ["ApiEngineKey"] = marker,
                    ["ApiAddress"] = "/" + marker, ["ApiRoutes"] = "/" + marker + "-alias"
                };
                await Form("UptFormData", replacement);
            }
            Assert.Empty(Assert.IsType<JsonArray>(await Form("GetTableData", KeyQuery())));

            var denied = await Login(invalid: true);
            Assert.NotEqual(1, denied.Body["Code"]!.GetValue<int>());
            Assert.Equal("CompiledFallback", denied.Route);
            var recovered = await Login();
            Success(recovered.Body);
            Assert.Equal("CompiledFallback", recovered.Route);
            Assert.False(string.IsNullOrWhiteSpace(recovered.Token));
            loginToken = recovered.Token;
            using var recoveredUser = Client(device, loginToken);
            foreach (var route in new[] { "api/os/getDateTimeNow", "api/SysMenu/getSysMenuStep" })
            {
                foreach (var get in new[] { false, true })
                {
                    var result = await Send(recoveredUser, route, new JsonObject(), get);
                    Success(result.Body);
                    Assert.Equal("CompiledFallback", result.Route);
                    if (route.Contains("SysMenu")) Assert.NotEmpty(Assert.IsType<JsonArray>(result.Body["Data"]));
                }
            }
            var log = await Send(recoveredUser, "api/SysLog/addSysLog", new JsonObject
            {
                ["Type"] = "Client", ["Title"] = device, ["Content"] = "Isolated missing-engine recovery regression"
            });
            Success(log.Body);
            Assert.Equal("CompiledFallback", log.Route);
            Success((await Send(recoveredUser, "api/SysUser/GetCurrentUser", new JsonObject())).Body);
        }
        finally
        {
            foreach (var original in restoredRows)
            {
                await Form("UptFormData", (JsonObject)original.DeepClone());
                var restored = Assert.IsType<JsonArray>(await Form("GetTableData", new JsonObject
                {
                    ["_Where"] = new JsonArray(new JsonArray("Id", "=", original["Id"]!.ToString())),
                    ["_SelectFields"] = new JsonArray(fields.Select(x => JsonValue.Create(x)).ToArray()),
                    ["_PageSize"] = 2
                }));
                var row = Assert.Single(restored);
                foreach (var field in fields) Assert.Equal(original[field]?.ToJsonString(), row?[field]?.ToJsonString());
            }
            if (restoredRows.Count > 0)
            {
                var managed = await Login();
                Success(managed.Body);
                Assert.NotEqual("CompiledFallback", managed.Route);
                loginToken = managed.Token;
            }
            if (!string.IsNullOrWhiteSpace(loginToken))
            {
                using var user = Client(device, loginToken);
                Success((await Send(user, "api/SysUser/Logout", new JsonObject())).Body);
            }
        }
    }

    private static HttpClient Client(string device, string? token = null)
    {
        var client = new HttpClient(new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
            UseCookies = false
        }) { BaseAddress = new Uri(Required("MICROI_TEST_API_BASE")), Timeout = TimeSpan.FromSeconds(90) };
        client.DefaultRequestHeaders.Add("osclient", Required("MICROI_TEST_OSCLIENT"));
        client.DefaultRequestHeaders.Add("did", device);
        if (!string.IsNullOrWhiteSpace(token)) client.DefaultRequestHeaders.Add("authorization", token);
        return client;
    }

    private static async Task<(JsonObject Body, string Route, string? Token)> Send(HttpClient client, string route, JsonObject data, bool get = false)
    {
        data["OsClient"] = Required("MICROI_TEST_OSCLIENT");
        using var response = get ? await client.GetAsync(route) : await client.PostAsJsonAsync(route, data);
        Assert.True(response.IsSuccessStatusCode, $"{route}: HTTP {(int)response.StatusCode}");
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsObject();
        var selected = response.Headers.TryGetValues("X-Microi-Bootstrap-Route", out var routes) ? routes.First() : "";
        var token = response.Headers.TryGetValues("authorization", out var tokens) ? tokens.First() : body["Data"] is JsonObject obj ? obj["Token"]?.ToString() : null;
        return (body, selected, token ?? body["Token"]?.ToString());
    }

    private static void Success(JsonObject body) => Assert.True(body["Code"]?.GetValue<int>() == 1, body["Msg"]?.ToString());
    private static string Required(string name) => Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
        ? value : throw new InvalidOperationException($"Required isolated-test setting missing: {name}");
}
