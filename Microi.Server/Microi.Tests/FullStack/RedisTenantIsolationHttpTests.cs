using System.Net.Http.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.FullStack;

[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
[Trait("Suite", "RedisTenantIsolation")]
public sealed class RedisTenantIsolationHttpTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SharedRedisManagementIsTenantBoundOnBothApiNodes(bool peer)
    {
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        var main = Required("MICROI_TEST_OSCLIENT");
        var child = Required("MICROI_TEST_CHILD_OSCLIENT");
        Assert.False(main.Equals("iTdos", StringComparison.OrdinalIgnoreCase));
        Assert.False(child.Equals("iTdos", StringComparison.OrdinalIgnoreCase));
        Assert.NotEqual(main, child);
        var api = Required(peer ? "MICROI_TEST_PEER_API_BASE" : "MICROI_TEST_API_BASE");
        using var mainClient = Client(api, Required("MICROI_TEST_TOKEN"));
        using var childClient = Client(api, Required("MICROI_TEST_CHILD_TOKEN"));

        async Task<JObject> Call(HttpClient client, string tenant, string action, JObject? body = null)
        {
            body ??= new JObject();
            body["Action"] = action;
            body["OsClient"] = tenant;
            using var content = new StringContent(body.ToString(Newtonsoft.Json.Formatting.None), System.Text.Encoding.UTF8, "application/json");
            using var response = await client.PostAsync("apiengine/platform-cache-manager--OsClient--" + Uri.EscapeDataString(tenant) + "--", content, TestContext.Current.CancellationToken);
            Assert.True(response.IsSuccessStatusCode, "Redis managed HTTP route must return its authenticated contract.");
            return JObject.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        static JToken Success(JObject result)
        {
            Assert.Equal(1, result["Code"]?.Value<int>());
            return result["Data"]!;
        }
        var mainConnections = (JArray)Success(await Call(mainClient, main, "Connections"));
        var childConnections = (JArray)Success(await Call(childClient, child, "Connections"));
        var mc = Assert.Single(mainConnections.Children<JObject>(), item => item["Mode"]?.Value<string>() == "tenant");
        var cc = Assert.Single(childConnections.Children<JObject>(), item => item["Mode"]?.Value<string>() == "tenant");
        // 隔离 Full 夹具故意共享一个 Redis 实例；不能用物理分库掩盖缺失的 Key 鉴权。
        Assert.Equal(mc["Host"]?.ToString(), cc["Host"]?.ToString());
        Assert.Equal(mc["Port"]?.Value<int>(), cc["Port"]?.Value<int>());
        Assert.True(mc["CanSelectDatabase"]?.Value<bool>());
        Assert.False(cc["CanSelectDatabase"]?.Value<bool>());
        Assert.Equal($"Microi:{child}:", cc["AllowedKeyPrefix"]?.Value<string>());
        var db = cc["Database"]!.Value<int>();
        var marker = "ReleaseRedisIsolation:" + Guid.NewGuid().ToString("N");
        var protectedKey = $"Microi:{main}:{marker}:protected";
        var neighborKey = $"Microi:{child}-other:{marker}:protected";
        var ownKey = $"Microi:{child}:{marker}:own";
        var renamed = ownKey + ":renamed";
        var ownedKeys = new List<string> { protectedKey, neighborKey, ownKey, renamed };
        JObject Context() => new() { ["Mode"] = "tenant", ["Database"] = db };
        JObject Key(string key) { var value = Context(); value["Key"] = key; return value; }
        async Task Put(HttpClient client, string tenant, string key, string value, string type = "string")
        {
            var body = Key(key); body["DataType"] = type; body["Value"] = value; body["TtlSeconds"] = 300;
            Success(await Call(client, tenant, "ReplaceValue", body));
        }
        try
        {
            await Put(mainClient, main, protectedKey, "protected-original");
            await Put(mainClient, main, neighborKey, "neighbor-original");
            await Put(childClient, child, ownKey, "own-original");
            Assert.Equal("own-original", Success(await Call(mainClient, main, "Key", Key(ownKey)))["Value"]?.ToString());

            foreach (var action in new[] { "Key", "ReplaceValue", "DeleteKeys", "RenameKey", "SetTtl", "Invalidate", "InvalidatePattern", "Keys" })
            {
                var body = Key(protectedKey);
                body["Keys"] = new JArray(ownKey, protectedKey);
                body["NewKey"] = renamed;
                body["Value"] = "must-not-write";
                body["DataType"] = "string";
                body["TtlSeconds"] = 0;
                body["Pattern"] = $"Microi:{main}:{marker}:*";
                body["IsMainTenant"] = true;
                body["TenantOsClient"] = main;
                body["_CurrentUser"] = new JObject { ["Level"] = 9999, ["OsClient"] = main };
                Assert.NotEqual(1, (await Call(childClient, child, action, body))["Code"]?.Value<int>());
            }
            var outboundRename = Key(ownKey); outboundRename["NewKey"] = neighborKey;
            Assert.NotEqual(1, (await Call(childClient, child, "RenameKey", outboundRename))["Code"]?.Value<int>());
            Assert.NotEqual(1, (await Call(childClient, child, "Key", Key(neighborKey)))["Code"]?.Value<int>());
            var otherDb = Context(); otherDb["Database"] = db == 0 ? 1 : 0; otherDb["Pattern"] = "*";
            Assert.NotEqual(1, (await Call(childClient, child, "Keys", otherDb))["Code"]?.Value<int>());

            var scan = Context(); scan["Pattern"] = "*"; scan["PageSize"] = 200;
            var page = Success(await Call(childClient, child, "Keys", scan));
            foreach (var item in page["List"]!) Assert.StartsWith($"Microi:{child}:", item["Key"]!.ToString(), StringComparison.OrdinalIgnoreCase);
            var stats = Success(await Call(childClient, child, "RedisStatistics", Context()));
            Assert.True(stats["IsTenantScoped"]?.Value<bool>());
            Assert.Empty((JObject)stats["Info"]!);

            Assert.Equal("protected-original", Success(await Call(mainClient, main, "Key", Key(protectedKey)))["Value"]?.ToString());
            Assert.Equal("neighbor-original", Success(await Call(mainClient, main, "Key", Key(neighborKey)))["Value"]?.ToString());
            Assert.Equal("own-original", Success(await Call(childClient, child, "Key", Key(ownKey)))["Value"]?.ToString());
            foreach (var (type, value) in new[] { ("hash", "{\"field\":\"value\"}"), ("list", "[\"item\"]"), ("set", "[\"member\"]"), ("sortedset", "[{\"member\":\"member\",\"score\":1}]") })
            {
                var key = ownKey + ":" + type; ownedKeys.Add(key);
                await Put(childClient, child, key, value, type);
                Assert.Equal(type, Success(await Call(childClient, child, "Key", Key(key)))["Type"]?.ToString());
            }
            var ttl = Key(ownKey); ttl["TtlSeconds"] = 120;
            Success(await Call(childClient, child, "SetTtl", ttl));
            var rename = Key(ownKey); rename["NewKey"] = renamed;
            Success(await Call(childClient, child, "RenameKey", rename));
            Assert.Equal("own-original", Success(await Call(childClient, child, "Key", Key(renamed)))["Value"]?.ToString());
            var deletion = Context(); deletion["Keys"] = new JArray(renamed);
            Assert.Equal(1, Success(await Call(childClient, child, "DeleteKeys", deletion))["Deleted"]?.Value<int>());
            var deletedRead = await Call(childClient, child, "Key", Key(renamed));
            Assert.True(deletedRead["Code"]?.Value<int>() != 1, "Deleted canary readback: " + deletedRead.ToString(Newtonsoft.Json.Formatting.None));
        }
        finally
        {
            // 仅清理本用例登记的短 TTL canary，不清空数据库、租户缓存或其它任务的数据。
            var cleanup = Context(); cleanup["Keys"] = new JArray(ownedKeys);
            Success(await Call(mainClient, main, "DeleteKeys", cleanup));
        }
    }

    private static string Required(string name) => Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
        ? value : throw new Xunit.Sdk.XunitException("Full requires " + name);
    private static HttpClient Client(string api, string token)
    {
        var client = new HttpClient { BaseAddress = new Uri(api.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(45) };
        client.DefaultRequestHeaders.Add("authorization", token);
        client.DefaultRequestHeaders.Add("did", Required("MICROI_TEST_DID"));
        return client;
    }
}
