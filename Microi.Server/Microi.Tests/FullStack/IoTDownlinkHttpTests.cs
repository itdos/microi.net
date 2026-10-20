using System.Text;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.FullStack;

/// <summary>
/// 针对实际运行的本地 API 验证 V8 注册及拒绝路径，不改租户配置、不接触实体设备。
/// 成功传输、共享 Redis 与多协议 Socket 由相应集成用例单独验证，不能据此宣称真机成功。
/// </summary>
[Trait("Category", "FullStack")]
[Trait("Suite", "IoTDownlinkHttp")]
public sealed class IoTDownlinkHttpTests
{
    [Fact]
    public async Task Running_local_api_exposes_atomic_and_rejects_unauthorized_downlink()
    {
        var api = Required("MICROI_TEST_API_BASE");
        var uri = new Uri(api);
        Assert.True(uri.IsLoopback, "本用例仅允许本机 API，不向线上接口发送探测。");
        var tenant = Required("MICROI_TEST_OSCLIENT");
        using var client = new HttpClient(new HttpClientHandler {
            // 仅在上面已校验的回环地址接受本机开发证书。
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        }) { BaseAddress = new Uri(api.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(30) };
        Assert.True((await client.GetAsync("api/Diagnostics/liveness", TestContext.Current.CancellationToken)).IsSuccessStatusCode);
        client.DefaultRequestHeaders.Add("osclient", tenant);
        client.DefaultRequestHeaders.Add("did", Required("MICROI_TEST_DID"));
        client.DefaultRequestHeaders.Add("authorization", Required("MICROI_TEST_TOKEN"));

        async Task<JObject> Post(string path, JObject body)
        {
            using var content = new StringContent(body.ToString(), Encoding.UTF8, "application/json");
            using var response = await client.PostAsync(path, content, TestContext.Current.CancellationToken);
            Assert.True(response.IsSuccessStatusCode || (int)response.StatusCode == 403, "本地 API HTTP " + (int)response.StatusCode);
            return JObject.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        var status = await Post("api/V8Engine/GetStatus", new JObject { ["OsClient"] = tenant });
        Assert.Equal(1, status.Value<int>("Code"));
        var envelope = await Post("api/V8Engine/ExecuteApiEngine", new JObject {
            ["OsClient"] = tenant, ["ApiEngineKey"] = Required("MICROI_TEST_IOT_PROBE_ENGINE"),
            ["V8Code"] = """
                return {Code:1,Data:{IoT:typeof V8.IoT.Send,Tcp:typeof V8.Tcp.Send,
                  Rejected:V8.IoT.Send({DeviceId:'00',CommandId:'local-readonly-probe',FrameHex:'00',ExpireSeconds:1}).Code}};
                """, ["Param"] = new JObject() });
        Assert.Equal(1, envelope.Value<int>("Code"));
        var result = (JObject)envelope["Data"]!["Result"]!;
        Assert.Equal(1, result.Value<int>("Code"));
        Assert.Equal("function", result["Data"]!.Value<string>("IoT"));
        Assert.Equal("function", result["Data"]!.Value<string>("Tcp"));
        Assert.Equal(0, result["Data"]!.Value<int>("Rejected"));

        client.DefaultRequestHeaders.Remove("authorization");
        var denied = await Post("api/V8Engine/ExecuteApiEngine", new JObject {
            ["OsClient"] = tenant, ["ApiEngineKey"] = Required("MICROI_TEST_IOT_PROBE_ENGINE"), ["V8Code"] = "return {Code:1};" });
        Assert.NotEqual(1, denied.Value<int>("Code"));
    }

    private static string Required(string name) => Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
        ? value : throw new Xunit.Sdk.XunitException("本地 HTTP 集成测试缺少 " + name);
}
