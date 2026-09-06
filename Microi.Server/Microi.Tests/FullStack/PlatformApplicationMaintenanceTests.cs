using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Microi.Tests.FullStack;

[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
[Trait("Suite", "PlatformApplicationMaintenance")]
public sealed class PlatformApplicationMaintenanceTests
{
    [Fact]
    public async Task MainTenant_CanMaintainSelectedChildPlatformApplications()
    {
        using var client = Client("MICROI_TEST_TOKEN", "MICROI_TEST_CONTROL_API_BASE");
        var tenant = Required("MICROI_TEST_OSCLIENT");
        if (!string.Equals(tenant, "iTdos", StringComparison.OrdinalIgnoreCase))
        {
            await RunTwice(client, tenant, "bulk-import-microi-store-packages",
                new JsonObject { ["ApplicationType"] = "Platform", ["StoreApiBase"] = "https://api.itdos.com", ["StoreOsClient"] = "iTdos" });
        }
        await RunTwice(client, Required("MICROI_TEST_OSCLIENT"), "bulk-update-child-tenant-platform-apps",
            new JsonObject { ["TargetOsClients"] = new JsonArray(Required("MICROI_TEST_CHILD_OSCLIENT")) });
    }

    [Fact]
    public async Task ChildTenant_CanInstallUpdateAllPlatformApplicationsAndRepeatWithoutWork()
    {
        using var client = Client("MICROI_TEST_CHILD_TOKEN", "MICROI_TEST_CHILD_API_BASE");
        await RunTwice(client, Required("MICROI_TEST_CHILD_OSCLIENT"), "bulk-import-microi-store-packages",
            new JsonObject { ["ApplicationType"] = "Platform", ["StoreApiBase"] = "https://api.itdos.com", ["StoreOsClient"] = "iTdos" });
    }

    private static async Task RunTwice(HttpClient client, string tenant, string engine, JsonObject parameters)
    {
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        var prefix = $"release-maintenance-{Guid.NewGuid():N}";
        for (var iteration = 0; iteration < 2; iteration++)
        {
            var request = new JsonObject
            {
                ["OsClient"] = tenant, ["Action"] = "RunApiEngine", ["TargetApiEngineKey"] = engine,
                ["Title"] = "平台应用维护发布回归", ["Param"] = parameters.DeepClone(),
                ["Options"] = new JsonObject { ["IdempotencyKey"] = prefix + iteration,
                    ["ConcurrencyKey"] = engine, ["MaxAttempts"] = 3, ["RetryOnFailure"] = true }
            };
            var submitted = await Post(client, request);
            var id = submitted["Data"]?["Id"]?.ToString();
            Assert.False(string.IsNullOrWhiteSpace(id), "Submission must return a persisted task Id.");
            foreach (var property in new[] { "ParamJson", "TrustedUserJson", "CheckpointJson", "ResultJson" })
                Assert.True(submitted["Data"]?[property] == null, $"Submission must not expose {property}.");
            var repeated = await Post(client, request);
            Assert.Equal(id, repeated["Data"]?["Id"]?.ToString());

            var deadline = DateTime.UtcNow.AddMinutes(25);
            JsonObject? status = null;
            while (DateTime.UtcNow < deadline)
            {
                var response = await Post(client, new JsonObject { ["OsClient"] = tenant, ["Action"] = "Status", ["Id"] = id });
                status = response["Data"]!.AsObject();
                var state = status["Status"]?.ToString();
                Assert.True(state != "Failed" && state != "Canceled",
                    $"Maintenance task {id} ended as {state}: {status["Msg"]}");
                if (state == "Succeeded") break;
                await Task.Delay(TimeSpan.FromSeconds(2), TestContext.Current.CancellationToken);
            }
            Assert.Equal("Succeeded", status?["Status"]?.ToString());
            Assert.Equal(100, status!["Progress"]!.GetValue<int>());
            var detail = await Post(client, new JsonObject { ["OsClient"] = tenant, ["Action"] = "Detail", ["Id"] = id });
            Assert.DoesNotContain("租约已丢失", detail.ToJsonString(), StringComparison.Ordinal);
            if (engine == "bulk-update-child-tenant-platform-apps")
            {
                var data = detail["Data"]?["Result"]?["Data"];
                Assert.Equal(1, data?["TargetCount"]?.GetValue<int>());
                Assert.Equal(1, data?["SucceededCount"]?.GetValue<int>());
                Assert.Equal(0, data?["FailedCount"]?.GetValue<int>());
            }
            if (iteration == 1 && engine == "bulk-import-microi-store-packages")
            {
                var result = detail["Data"]?["Result"];
                var data = result?["Data"] ?? result;
                Assert.NotNull(data?["Planned"]);
                Assert.Equal(0, data!["Planned"]!.GetValue<int>());
            }
        }
    }

    private static HttpClient Client(string tokenVariable, string endpointVariable)
    {
        var endpoint = Environment.GetEnvironmentVariable(endpointVariable)?.Trim();
        var client = new HttpClient { BaseAddress = new Uri((string.IsNullOrWhiteSpace(endpoint) ? Required("MICROI_TEST_API_BASE") : endpoint).TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(45) };
        client.DefaultRequestHeaders.TryAddWithoutValidation("authorization", Required(tokenVariable));
        client.DefaultRequestHeaders.TryAddWithoutValidation("did", Environment.GetEnvironmentVariable("MICROI_TEST_DID") ?? "Microi.Tests");
        return client;
    }

    private static string Required(string key) => Environment.GetEnvironmentVariable(key)?.Trim() is { Length: > 0 } value
        ? value : throw new Xunit.Sdk.XunitException($"Full release gate requires {key}.");

    private static async Task<JsonObject> Post(HttpClient client, JsonObject request)
    {
        using var response = await client.PostAsJsonAsync("apiengine/platform-background-task", request, TestContext.Current.CancellationToken);
        if (response.Headers.TryGetValues("authorization", out var tokens))
        {
            client.DefaultRequestHeaders.Remove("authorization");
            client.DefaultRequestHeaders.TryAddWithoutValidation("authorization", tokens.First());
        }
        Assert.True(response.IsSuccessStatusCode, $"Maintenance HTTP {(int)response.StatusCode}");
        var result = (await response.Content.ReadFromJsonAsync<JsonObject>(cancellationToken: TestContext.Current.CancellationToken))!;
        Assert.True(result["Code"]?.GetValue<int>() == 1, $"Maintenance request failed: {result["Msg"]}");
        return result;
    }
}
