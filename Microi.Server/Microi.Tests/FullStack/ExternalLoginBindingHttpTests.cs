using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Microi.Tests.FullStack;

[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
[Trait("Suite", "ExternalLoginBindings")]
public sealed class ExternalLoginBindingHttpTests
{
    [Fact]
    public async Task AuthenticatedListsAndOwnedRevoke_UseInternalHostScopesAcrossBothNodes()
    {
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        var tenant = Required("MICROI_TEST_OSCLIENT");
        Assert.False(string.Equals(tenant, "iTdos", StringComparison.OrdinalIgnoreCase));
        var bases = new[] { Required("MICROI_TEST_API_BASE"), Required("MICROI_TEST_PEER_API_BASE") };
        var device = "ExternalBindingHttp-" + Guid.NewGuid().ToString("N");
        string? token = null;
        JsonNode? bindingBaseline = null;

        async Task<JsonObject> Send(string apiBase, string route, JsonObject data, bool authenticated)
        {
            using var client = new HttpClient(new HttpClientHandler { UseCookies = false,
                ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator })
                { BaseAddress = new Uri(apiBase), Timeout = TimeSpan.FromSeconds(60) };
            client.DefaultRequestHeaders.Add("osclient", tenant);
            client.DefaultRequestHeaders.Add("did", device);
            if (authenticated) client.DefaultRequestHeaders.Add("authorization", token);
            using var response = await client.PostAsJsonAsync(route, data);
            Assert.True(response.IsSuccessStatusCode, $"{route}: HTTP {(int)response.StatusCode}");
            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsObject();
            if (response.Headers.TryGetValues("authorization", out var rotations)) token = rotations.First();
            return body;
        }

        try
        {
            // 独立 DID 的正常隔离夹具登录，不替换其它 Full 测试正在使用的会话。
            var login = await Send(bases[0], "api/SysUser/Login", new JsonObject {
                ["Account"] = Required("MICROI_TEST_ACCOUNT"), ["Pwd"] = Required("MICROI_TEST_PASSWORD"),
                ["OsClient"] = tenant, ["_ClientType"] = "PC", ["_AutomationTestLogin"] = true }, false);
            Assert.Equal(1, login["Code"]!.GetValue<int>());
            token ??= login["Data"]?["Token"]?.ToString() ?? login["Token"]?.ToString();
            Assert.False(string.IsNullOrWhiteSpace(token));

            foreach (var apiBase in bases)
            {
                for (var round = 0; round < 2; round++)
                foreach (var route in new[] { "api/ExternalLogin/ListBindings", "apiengine/platform-external-login" })
                {
                    var list = await Send(apiBase, route, new JsonObject { ["Action"] = "ListBindings" }, true);
                    Assert.Equal(1, list["Code"]!.GetValue<int>());
                    var bindings = Assert.IsType<JsonArray>(list["Data"]?["Bindings"]);
                    Assert.IsType<JsonArray>(list["Data"]?["Providers"]);
                    bindingBaseline ??= bindings.DeepClone();
                    Assert.True(JsonNode.DeepEquals(bindingBaseline, bindings));
                }
                var anonymous = await Send(apiBase, "api/ExternalLogin/ListBindings", new JsonObject(), false);
                Assert.Equal(1001, anonymous["Code"]!.GetValue<int>());
                // 不创建或删除真实绑定：不存在的 Id 必须到达本人归属校验，而非被 StopHttp 提前阻断。
                var revoke = await Send(apiBase, "api/ExternalLogin/RevokeBinding", new JsonObject { ["Id"] = Guid.NewGuid().ToString() }, true);
                Assert.Equal(0, revoke["Code"]!.GetValue<int>());
                Assert.Contains("不存在", revoke["Msg"]?.ToString() ?? "");
                var forged = await Send(apiBase, "apiengine/platform-external-login-binding", new JsonObject {
                    ["Action"] = "List", ["_InvokeType"] = "Server", ["_TrustedServerInvocation"] = true,
                    ["_TrustedExternalLoginProtocol"] = true }, true);
                Assert.NotEqual(1, forged["Code"]!.GetValue<int>());
                Assert.False(forged["Data"] is JsonObject forgedData && forgedData.ContainsKey("Bindings"));
            }
        }
        finally
        {
            if (!string.IsNullOrWhiteSpace(token))
                await Send(bases[0], "api/SysUser/Logout", new JsonObject(), true);
            token = null;
        }
    }

    private static string Required(string name) => Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
        ? value : throw new InvalidOperationException($"Required isolated-test setting missing: {name}");
}
