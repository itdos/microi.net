using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Microi.Tests.FullStack;

[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
public class PlatformReminderRestartTests
{
    [Fact]
    [Trait("Suite", "PlatformReminders")]
    public async Task TwoApiNodes_ShareBootEpochAndAtomicallyClaimOnePresentation()
    {
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        using var a = Client(Required("MICROI_TEST_API_BASE"));
        using var b = Client(Required("MICROI_TEST_PEER_API_BASE"));
        Assert.NotEqual(a.BaseAddress, b.BaseAddress);
        var contexts = await Task.WhenAll(Post(a, new JsonObject { ["Action"] = "Capabilities" }), Post(b, new JsonObject { ["Action"] = "Capabilities" }));
        foreach (var context in contexts) { Assert.Equal(1, context["Code"]!.GetValue<int>()); Assert.Equal(2, context["Data"]!["ProtocolVersion"]!.GetValue<int>()); }
        var firstContext = contexts[0]["Data"]!;
        Assert.Matches(@"^\d{21}-[a-f0-9]{32}$", firstContext["RestartEpoch"]!.GetValue<string>());
        Assert.Equal(firstContext["RestartEpoch"]!.GetValue<string>(), contexts[1]["Data"]!["RestartEpoch"]!.GetValue<string>());
        var rule = new JsonObject {
            ["Title"] = "双节点重启公告验收 " + Guid.NewGuid().ToString("N")[..8],
            ["Content"] = "仅发送给隔离测试帐号本人。", ["ScopeType"] = "Users",
            ["TargetKeys"] = new JsonArray(firstContext["UserId"]!.GetValue<string>()), ["AccountScope"] = "SuperAdmins",
            ["ReminderType"] = "Announcement", ["DisplayMode"] = "AfterServerRestart", ["RepeatMode"] = "None",
            ["StartsAt"] = DateTime.UtcNow.AddSeconds(-1).ToString("O"), ["EndsAt"] = DateTime.UtcNow.AddMinutes(5).ToString("O")
        };
        var saved = await Post(a, new JsonObject { ["Action"] = "Save", ["Rule"] = rule, ["RequestId"] = Guid.NewGuid().ToString() });
        Assert.Equal(1, saved["Code"]!.GetValue<int>());
        var id = saved["Data"]!["Id"]!.GetValue<string>();
        var revision = saved["Data"]!["Revision"]!.GetValue<int>();
        try {
            var publish = await Post(a, new JsonObject { ["Action"] = "Publish", ["Id"] = id, ["ExpectedRevision"] = revision, ["RequestId"] = Guid.NewGuid().ToString() });
            Assert.Equal(1, publish["Code"]!.GetValue<int>());
            var batchId = publish["Data"]!["Id"]!.GetValue<string>();
            var inbox = await Post(b, new JsonObject { ["Action"] = "Inbox", ["EntryId"] = Guid.NewGuid().ToString() });
            Assert.Equal(1, inbox["Code"]!.GetValue<int>());
            var item = inbox["Data"]!.AsArray().Single(row => row!["BatchId"]!.GetValue<string>() == batchId)!;
            var itemId = item["Id"]!.GetValue<string>();
            var entryA = Guid.NewGuid().ToString(); var entryB = Guid.NewGuid().ToString();
            var claims = await Task.WhenAll(
                Post(a, new JsonObject { ["Action"] = "Presented", ["Id"] = itemId, ["EntryId"] = entryA }),
                Post(b, new JsonObject { ["Action"] = "Presented", ["Id"] = itemId, ["EntryId"] = entryB }));
            // MySQL 重复插入后的可重复读快照可能还看不到赢家。失败的一方须以原会话重试，
            // 在新事务中确认没有领取；数据库仍必须只有一个成功展示资格。
            for (var index = 0; index < claims.Length; index++) {
                if (claims[index]["Code"]!.GetValue<int>() == 1) continue;
                Assert.Equal(0, claims[index]["Code"]!.GetValue<int>());
                claims[index] = await Post(index == 0 ? a : b, new JsonObject {
                    ["Action"] = "Presented", ["Id"] = itemId, ["EntryId"] = index == 0 ? entryA : entryB
                });
                Assert.False(claims[index]["Data"]?["Claimed"]?.GetValue<bool>() ?? true);
            }
            Assert.All(claims, result => Assert.Equal(1, result["Code"]!.GetValue<int>()));
            Assert.Single(claims.Where(result => result["Data"]!["Claimed"]!.GetValue<bool>()));
            var winningEntry = claims[0]["Data"]!["Claimed"]!.GetValue<bool>() ? entryA : entryB;
            var recovered = await Post(b, new JsonObject { ["Action"] = "Presented", ["Id"] = itemId, ["EntryId"] = winningEntry });
            Assert.True(recovered["Data"]!["Claimed"]!.GetValue<bool>());
            foreach (var client in new[] { a, b }) {
                var next = await Post(client, new JsonObject { ["Action"] = "Inbox", ["EntryId"] = Guid.NewGuid().ToString() });
                Assert.DoesNotContain(next["Data"]!.AsArray(), row => row!["BatchId"]!.GetValue<string>() == batchId);
                Assert.Contains(next["DataAppend"]!["ActiveIds"]!.AsArray(), row => row!.GetValue<string>() == itemId);
            }
            var ack = await Post(a, new JsonObject { ["Action"] = "Acknowledge", ["Id"] = itemId, ["EntryId"] = winningEntry });
            Assert.True(ack["Data"]!["Closed"]!.GetValue<bool>());
        } finally {
            var withdraw = await Post(a, new JsonObject { ["Action"] = "Withdraw", ["Id"] = id, ["ExpectedRevision"] = revision });
            Assert.Equal(1, withdraw["Code"]!.GetValue<int>());
        }
    }

    private static HttpClient Client(string endpoint)
    {
        var client = new HttpClient { BaseAddress = new Uri(endpoint.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(45) };
        client.DefaultRequestHeaders.TryAddWithoutValidation("authorization", Required("MICROI_TEST_TOKEN"));
        client.DefaultRequestHeaders.TryAddWithoutValidation("did", Environment.GetEnvironmentVariable("MICROI_TEST_DID") ?? "Microi.Tests");
        return client;
    }

    private static async Task<JsonObject> Post(HttpClient client, JsonObject input)
    {
        // 同一隔离租户、两台独立 API，所有通知只指向验收帐号，失败也撤回自己的发布。
        input["OsClient"] = Required("MICROI_TEST_OSCLIENT");
        using var response = await client.PostAsJsonAsync("apiengine/platform-reminder-runtime", input, TestContext.Current.CancellationToken);
        response.EnsureSuccessStatusCode();
        if (response.Headers.TryGetValues("authorization", out var tokens)) {
            client.DefaultRequestHeaders.Remove("authorization"); client.DefaultRequestHeaders.TryAddWithoutValidation("authorization", tokens.First());
        }
        return (JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)) ?? throw new InvalidOperationException("缺少 JSON 回执")).AsObject();
    }

    private static string Required(string name) => Environment.GetEnvironmentVariable(name)?.Trim() is { Length: > 0 } value
        ? value : throw new Xunit.Sdk.XunitException("Full release gate requires " + name);
}
