using Dos.Common;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class HdfsUploadCompatibilityTests
{
    [Theory]
    [InlineData("/api/HDFS/upload")]
    [InlineData("/api/Upload")]
    [InlineData("/apiengine/platform-hdfs-upload")]
    [InlineData("/API/HDFS/UPLOAD")]
    public async Task UploadProtocolRoutesLeaveDynamicSelectionForTheExistingExactHostBridge(string path)
    {
        // 不提供缓存/数据库服务：动态候选必须退出，精确 attribute 端点才会唯一选中原协议桥。
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = path;
        context.Request.ContentType = "multipart/form-data; boundary=fixture";
        var values = new RouteValueDictionary { ["preserved"] = "fixture" };
        var result = await new DynamicRoute().TransformAsync(context, values);
        Assert.Null(result);
        Assert.Single(values);
        Assert.Equal("fixture", values["preserved"]);
        Assert.False(context.Items.ContainsKey(DynamicRoute.ResolvedApiEngineKeyItem));
        Assert.False(context.Items.ContainsKey("__MicroiConfirmedAbsentRoute"));
        Assert.False(HdfsUploadRequestContext.HasCurrentRequest);
    }

    [Fact]
    public async Task ActualMvcRoutingSelectsOneUploadAliasWhenBothDynamicRoutesAreRegistered()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddControllers().AddApplicationPart(typeof(HDFSController).Assembly)
            .ConfigureApplicationPartManager(manager => manager.FeatureProviders.Add(new HdfsOnlyControllerFeatureProvider()));
        builder.Services.AddTransient<DynamicRoute>();
        await using var host = builder.Build();
        var actions = host.Services.GetRequiredService<IActionDescriptorCollectionProvider>().ActionDescriptors.Items
            .OfType<ControllerActionDescriptor>()
            .Where(action => action.ControllerTypeInfo.AsType() == typeof(HDFSController) && action.ActionName == "Upload")
            .ToArray();
        // 同一 MethodInfo 的三个 attribute selector 具有相同 controller/action；动态按名称
        // 选择会展开三个同优先级端点。这里用真实 MVC 路由选择证明每个 URL 只剩一个精确端点。
        Assert.Equal(3, actions.Length);
        Assert.Single(actions.Select(action => action.MethodInfo).Distinct());
        Assert.Equal(new[] { "api/hdfs/upload", "api/upload", "apiengine/platform-hdfs-upload" },
            actions.Select(action => action.AttributeRouteInfo!.Template!.TrimStart('/').ToLowerInvariant()).OrderBy(value => value, StringComparer.Ordinal));
        host.UseRouting();
        host.MapDynamicControllerRoute<DynamicRoute>("apiengine/{*path}", state: null, order: -100);
        host.MapDynamicControllerRoute<DynamicRoute>("{*path}", state: null, order: -99);
        host.MapControllers();
        // 只截取已完成匹配的 endpoint，不执行控制器/过滤器，不需要数据库、登录或存储服务。
        host.Run(async context =>
        {
            var action = context.GetEndpoint()?.Metadata.GetMetadata<ControllerActionDescriptor>();
            await context.Response.WriteAsJsonAsync(new
            {
                controller = action?.ControllerName, action = action?.ActionName,
                template = action?.AttributeRouteInfo?.Template, method = action?.MethodInfo.Name,
                confirmedAbsent = context.Items.ContainsKey("__MicroiConfirmedAbsentRoute"),
                resolvedEngine = context.Items.ContainsKey(DynamicRoute.ResolvedApiEngineKeyItem),
                scopeCreated = HdfsUploadRequestContext.HasCurrentRequest
            });
        });
        await host.StartAsync(TestContext.Current.CancellationToken);
        var address = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        using var client = new HttpClient { BaseAddress = new Uri(address) };
        foreach (var route in new[] { "/api/HDFS/upload", "/api/Upload", "/apiengine/platform-hdfs-upload", "/API/HDFS/UPLOAD" })
        {
            using var content = new MultipartFormDataContent();
            using var response = await client.PostAsync(route, content, TestContext.Current.CancellationToken);
            Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
            var selected = JObject.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            Assert.Equal("HDFS", selected.Value<string>("controller"));
            Assert.Equal("Upload", selected.Value<string>("action"));
            Assert.Equal("Upload", selected.Value<string>("method"));
            Assert.Equal(route.TrimStart('/').ToLowerInvariant(), selected.Value<string>("template")!.TrimStart('/').ToLowerInvariant());
            Assert.False(selected.Value<bool>("confirmedAbsent"));
            Assert.False(selected.Value<bool>("resolvedEngine"));
            Assert.False(selected.Value<bool>("scopeCreated"));
        }
        await host.StopAsync(TestContext.Current.CancellationToken);
    }

    private sealed class HdfsOnlyControllerFeatureProvider : IApplicationFeatureProvider<ControllerFeature>
    {
        public void PopulateFeature(IEnumerable<ApplicationPart> parts, ControllerFeature feature)
        {
            // 复用真实上传控制器的三份路由元数据；排除无关控制器及其宿主约定，避免夹具扩大依赖。
            foreach (var controller in feature.Controllers.Where(type => type.AsType() != typeof(HDFSController)).ToArray())
                feature.Controllers.Remove(controller);
        }
    }

    [Theory]
    [InlineData("GET", "/api/HDFS/upload")]
    [InlineData("PUT", "/api/Upload")]
    [InlineData("OPTIONS", "/apiengine/platform-hdfs-upload")]
    [InlineData("POST", "/api/HDFS/upload/child")]
    [InlineData("POST", "/api/HDFS/upload-other")]
    [InlineData("POST", "/api/HDFS/DeleteObject")]
    [InlineData("POST", "/api/UploadOther")]
    [InlineData("POST", "/apiengine/platform-hdfs-upload-hook")]
    [InlineData("POST", "/api/HDFS/upload--OsClient--other--")]
    public void UploadBridgeDoesNotCaptureOtherMethodsPrefixesOrTenantSuffixes(string method, string path)
        => Assert.False(DynamicRoute.IsHdfsUploadProtocolRoute(method, path));

    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("0", false)]
    [InlineData("false", false)]
    [InlineData("invalid", false)]
    [InlineData("2", false)]
    [InlineData("1", true)]
    [InlineData("TRUE", true)]
    public void LegacySwitchRequiresExplicitEnable(string? value, bool expected)
        => Assert.Equal(expected, LegacyUploadResponse.IsEnabled(value));

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void FallbackPreservesModernFieldsAndRestoresLegacyArray(bool multiple)
    {
        var row = new JObject { ["Name"] = "前.jpg", ["Path"] = "/tenant/img/前.jpg",
            ["Url"] = "https://example.test/private-ticket", ["Size"] = 575599, ["Id"] = "id", ["Limit"] = true };
        var result = new DosResult(1, multiple ? new JArray(row) : row);
        var original = JToken.FromObject(result.Data);
        Assert.Same(result, LegacyUploadResponse.Apply(result, false));
        Assert.True(JToken.DeepEquals(original, JToken.FromObject(result.Data)));
        LegacyUploadResponse.Apply(result, true);
        var token = JToken.FromObject(result.Data);
        Assert.IsType<JArray>(token);
        Assert.Single((JArray)token);
        var actual = (JObject)token[0]!;
        Assert.All(row.Properties(), property => Assert.True(JToken.DeepEquals(property.Value, actual[property.Name])));
        Assert.Equal("image", actual["type"]);
        Assert.Equal("前", actual["name"]);
        Assert.Equal(actual["Url"], actual["url"]);
        Assert.Equal(false, actual["uploading"]);
        Assert.Equal(100, actual["progress"]);
        Assert.Equal(0, actual["duration"]);
    }

    [Fact]
    public void CompatibilityNeverDoubleWrapsMultipleFiles()
    {
        var input = new JArray(new JObject { ["Name"] = "a.jpg", ["Id"] = "a" },
            new JObject { ["Name"] = "b.jpg", ["Id"] = "b" });
        var result = new DosResult(1, input);
        LegacyUploadResponse.Apply(result, true);
        var once = JToken.FromObject(result.Data);
        LegacyUploadResponse.Apply(result, true);
        Assert.True(JToken.DeepEquals(once, JToken.FromObject(result.Data)));
        var rows = Assert.IsType<JArray>((object)result.Data);
        Assert.Equal(2, rows.Count);
        Assert.All(rows, row => Assert.IsType<JObject>(row));
    }

    [Fact]
    public void FailedUploadIsNeverMarkedComplete()
    {
        var failed = new DosResult(0, new JObject { ["Path"] = "/partial" }, "denied");
        Assert.Same(failed, LegacyUploadResponse.Apply(failed, true));
        Assert.Null(((JObject)failed.Data)["progress"]);
    }

    [Fact]
    public async Task RequestAtomBindsExactTenantAndEngineAndExecutesOnlyOnce()
    {
        var calls = 0;
        var uploaded = new DosResult(1, new JObject { ["Path"] = "/tenant/img/a.jpg" });
        using (HdfsUploadRequestContext.Enter("tenant", "custom-upload", true, () =>
        {
            Interlocked.Increment(ref calls);
            return Task.FromResult(uploaded);
        }))
        {
            Assert.Equal(0, (await HdfsUploadRequestContext.UploadAsync()).Code);
            using (V8TenantContext.Enter("other", "custom-upload"))
                Assert.Equal(0, (await HdfsUploadRequestContext.UploadAsync()).Code);
            using (V8TenantContext.Enter("tenant", "other-engine"))
                Assert.Equal(0, (await HdfsUploadRequestContext.UploadAsync()).Code);
            using (V8TenantContext.Enter("tenant", "custom-upload"))
            {
                Assert.True(HdfsUploadRequestContext.IsLegacyEnabled());
                var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => HdfsUploadRequestContext.UploadAsync()));
                Assert.All(results, result => Assert.Same(uploaded, result));
            }
            Assert.Equal(1, calls);
        }
        Assert.False(HdfsUploadRequestContext.HasCurrentRequest);
        Assert.Equal(0, (await HdfsUploadRequestContext.UploadAsync()).Code);
    }

    [Fact]
    public async Task FailedStorageIsNotRetriedWithinTheSameRequest()
    {
        var calls = 0;
        using var scope = HdfsUploadRequestContext.Enter("tenant", "upload", false, () =>
        {
            calls++;
            return Task.FromException<DosResult>(new IOException("uncertain storage result"));
        });
        using var tenant = V8TenantContext.Enter("tenant", "upload");
        await Assert.ThrowsAsync<IOException>(() => HdfsUploadRequestContext.UploadAsync());
        await Assert.ThrowsAsync<IOException>(() => HdfsUploadRequestContext.UploadAsync());
        Assert.Equal(1, calls);
    }
}
