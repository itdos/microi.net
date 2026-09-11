using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Microi.Tests.FullStack;

[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
[Trait("Suite", "HdfsUploadRouting")]
public sealed class HdfsUploadRoutingTests
{
    [Fact]
    public async Task UploadUsesConfiguredEngineAndOnlyFallsBackWhenAuthoritativelyMissing()
    {
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        var tenant = Required("MICROI_TEST_OSCLIENT");
        Assert.False(tenant.Equals("iTdos", StringComparison.OrdinalIgnoreCase), "故障注入只能使用隔离测试租户。");
        using var client = new HttpClient(new HttpClientHandler
        { ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator })
        { BaseAddress = new Uri(Required("MICROI_TEST_API_BASE")), Timeout = TimeSpan.FromSeconds(90) };
        client.DefaultRequestHeaders.Add("osclient", tenant);
        client.DefaultRequestHeaders.Add("did", Required("MICROI_TEST_DID"));
        client.DefaultRequestHeaders.Add("authorization", Required("MICROI_TEST_TOKEN"));
        var marker = "hdfs-routing-" + Guid.NewGuid().ToString("N");
        const string key = "platform-hdfs-upload";
        JsonObject? original = null;
        string? id = null;
        bool created = false;

        async Task<JsonObject> Form(string action, JsonObject body)
        {
            body["FormEngineKey"] = "sys_apiengine";
            body["OsClient"] = tenant;
            using var response = await client.PostAsJsonAsync("api/FormEngine/" + action, body, TestContext.Current.CancellationToken);
            var result = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
            Assert.Equal(1, result["Code"]!.GetValue<int>());
            return result;
        }
        async Task<(JsonObject Body, string Handler)> Upload(string route = "api/HDFS/upload")
        {
            using var content = new MultipartFormDataContent();
            content.Add(new StringContent(tenant), "OsClient");
            content.Add(new StringContent("file/" + marker), "Path");
            // 不发送文件：本测试只验证路由，不依赖外部存储或制造业务对象。
            using var response = await client.PostAsync(route, content, TestContext.Current.CancellationToken);
            Assert.True(response.IsSuccessStatusCode);
            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
            return (body, response.Headers.TryGetValues("X-Microi-Upload-Handler", out var values) ? values.First() : "");
        }
        async Task Patch(JsonObject row)
        {
            row["Id"] = id;
            await Form("UptFormData", row);
        }

        try
        {
            var read = await Form("GetTableData", new JsonObject
            { ["_Where"] = new JsonArray(new JsonArray("ApiEngineKey", "=", key)), ["_PageSize"] = 2 });
            var rows = read["Data"]!.AsArray();
            Assert.True(rows.Count <= 1);
            original = rows.Count == 1 ? rows[0]!.DeepClone().AsObject() : null;
            var probe = new JsonObject
            {
                ["ApiEngineKey"] = key, ["ApiName"] = marker, ["ApiAddress"] = "/apiengine/" + key,
                ["ApiRoutes"] = "/api/HDFS/upload;/api/Upload", ["IsEnable"] = 1, ["StopHttp"] = 0,
                ["AllowAnonymous"] = 0, ["ApiRole"] = "[]", ["V8Limit"] = 0, ["EnableLog"] = 0,
                ["ApiV8Code"] = "return { Code: 1, Data: { Marker: '" + marker + "' } };"
            };
            if (original == null)
            {
                id = Guid.NewGuid().ToString();
                probe["Id"] = id;
                await Form("AddFormData", probe);
                created = true;
            }
            else { id = original["Id"]!.ToString(); await Patch(probe); }
            foreach (var route in new[] { "api/HDFS/upload", "api/Upload", "apiengine/platform-hdfs-upload" })
            {
                var result = await Upload(route);
                Assert.Equal("ApiEngine", result.Handler);
                Assert.Equal(marker, result.Body["Data"]?["Marker"]?.ToString());
            }
            await Patch(new JsonObject { ["ApiV8Code"] = "return { Code: 0, Msg: '" + marker + "' };" });
            var failed = await Upload();
            Assert.Equal("ApiEngine", failed.Handler);
            Assert.Equal(marker, failed.Body["Msg"]?.ToString());
            foreach (var patch in new[] { new JsonObject { ["IsEnable"] = 0 }, new JsonObject { ["IsEnable"] = 1, ["StopHttp"] = 1 } })
            {
                await Patch(patch);
                var blocked = await Upload();
                Assert.NotEqual("CompiledFallback", blocked.Handler);
                Assert.NotEqual(1, blocked.Body["Code"]!.GetValue<int>());
            }
            await Patch(new JsonObject { ["ApiEngineKey"] = marker, ["ApiAddress"] = "/apiengine/" + marker, ["ApiRoutes"] = "" });
            var missing = await Upload();
            Assert.Equal("CompiledFallback", missing.Handler);
            Assert.NotEqual(1, missing.Body["Code"]!.GetValue<int>());
        }
        finally
        {
            if (created && id != null) await Form("DelFormData", new JsonObject { ["Id"] = id });
            else if (original != null) await Form("UptFormData", original);
        }
    }

    private static string Required(string key) => Environment.GetEnvironmentVariable(key) is { Length: > 0 } value
        ? value : throw new InvalidOperationException("缺少隔离 Full 配置：" + key);
}
