using System.Net;
using System.Reflection;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class McpTransportMigrationTests
{
    [Fact]
    public async Task BothLegacyHttpPrefixesRemainFailClosedAfterMovingAuthorization()
    {
        var accessor = typeof(DiyHttpContext).GetField("_httpContextAccessor", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previous = accessor.GetValue(null);
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing", Args = [] });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddCors(options => options.AddPolicy("any", p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
        builder.Services.AddSingleton(typeof(DiyFilter<>));
        builder.Services.AddControllers().AddApplicationPart(typeof(V8EngineController).Assembly)
            .AddNewtonsoftJson(options => options.SerializerSettings.ContractResolver = new Newtonsoft.Json.Serialization.DefaultContractResolver());
        await using var app = builder.Build();
        app.UseCors();
        app.MapControllers();
        try
        {
            DiyHttpContext.Configure(app.Services.GetRequiredService<IHttpContextAccessor>());
            // 测试宿主不启动平台、数据库或恢复 Worker；只验证真实 HTTP 路由与授权拒绝闭环。
            await app.StartAsync(TestContext.Current.CancellationToken);
            var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            using var client = new HttpClient { BaseAddress = new Uri(address) };
            foreach (var prefix in new[] { "V8Engine", "V8Debug" })
            {
                using var response = await client.GetAsync($"/api/{prefix}/GetStatus", TestContext.Current.CancellationToken);
                var body = JObject.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
                // 既有 DiyFilter 先拒绝无会话请求，沿用 HTTP 200 + DosResult 登录失效协议。
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                Assert.Equal(0, body.Value<int>("Code"));
                Assert.Equal("MissingToken", body["DataAppend"]?.Value<string>("ReasonCode"));
                using var write = await client.PostAsync($"/api/{prefix}/CreateApiEngine",
                    new StringContent("{}", System.Text.Encoding.UTF8, "application/json"), TestContext.Current.CancellationToken);
                Assert.Equal(HttpStatusCode.OK, write.StatusCode);
                var writeBody = JObject.Parse(await write.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
                Assert.Equal(0, writeBody.Value<int>("Code"));
                Assert.Equal("MissingToken", writeBody["DataAppend"]?.Value<string>("ReasonCode"));
            }
        }
        finally
        {
            await app.StopAsync(CancellationToken.None);
            accessor.SetValue(null, previous);
        }
    }
}
