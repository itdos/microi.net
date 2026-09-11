using System.Net.Http.Headers;
using System.Reflection;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Dos.ORM;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MySql.Data.MySqlClient;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public sealed class DatabasePoolRecoveryHttpTests
{
    [Fact]
    public async Task ActualController_WhenPoolExhausted_RequiresLiveAdminAndCompletesOnlineRecovery()
    {
        var settings = new MySqlConnectionStringBuilder(DatabasePoolRecoveryIntegrationTests.Connection());
        var fixtureName = "pool_http_" + Guid.NewGuid().ToString("N");
        var administration = new MySqlConnectionStringBuilder(settings.ConnectionString) { Pooling = false };
        using var admin = new MySqlConnection(administration.ConnectionString);
        await admin.OpenAsync(TestContext.Current.CancellationToken);
        using (var create = admin.CreateCommand()) { create.CommandText = $"CREATE DATABASE `{fixtureName}`"; await create.ExecuteNonQueryAsync(); }
        settings.Database = fixtureName;
        var session = new DbSession(DatabaseType.MySql, settings.ConnectionString);
        var tenant = fixtureName;
        var accessorField = typeof(DiyHttpContext).GetField("_httpContextAccessor", BindingFlags.NonPublic | BindingFlags.Static)!;
        var providerField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        var coordinatorField = typeof(DatabasePoolRecoveryService).GetField("coordinator", BindingFlags.NonPublic | BindingFlags.Static)!;
        var oldAccessor = accessorField.GetValue(null); var oldProvider = providerField.GetValue(null); var oldCoordinator = coordinatorField.GetValue(null);
        WebApplication? host = null;
        using var redis = await ConnectionMultiplexer.ConnectAsync(DatabasePoolRecoveryIntegrationTests.RedisAddress());
        var cache = redis.GetDatabase();
        try
        {
            session.FromSql("CREATE TABLE sys_user(Id varchar(64), Account varchar(64), State int, IsDeleted int, Level int, RoleIds text)").ExecuteNonQuery();
            session.FromSql("INSERT INTO sys_user VALUES ('admin-id','admin',1,0,9999,'')").ExecuteNonQuery();
            OsClientExtend.ClientList[tenant] = new OsClientSecret { OsClient = tenant, Db = session, DbRead = session };
            var cacheProxy = DispatchProxy.Create<IMicroiCache, RedisCacheProxy>();
            ((RedisCacheProxy)cacheProxy).Database = cache;
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
            builder.Logging.ClearProviders(); builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddSingleton<IMicroiCacheTenant>(new CacheTenant(cacheProxy));
            builder.Services.AddCors(o => o.AddPolicy("any", p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
            builder.Services.AddControllers().AddApplicationPart(typeof(DiagnosticsController).Assembly)
                .AddNewtonsoftJson(o => o.SerializerSettings.ContractResolver = new Newtonsoft.Json.Serialization.DefaultContractResolver());
            host = builder.Build(); host.UseCors(); host.MapControllers();
            host.MapGet("/fixture/auth", async () =>
            {
                using (Database.BeginIsolatedConnections())
                {
                    var current = await DiyToken.GetCurrentToken(false);
                    var permission = await V8McpLogic.CheckPermission();
                    return new { UserPresent = current?.CurrentUser != null, Tenant = current?.OsClient, permission.ok, permission.msg };
                }
            });
            DiyHttpContext.Configure(host.Services.GetRequiredService<IHttpContextAccessor>());
            providerField.SetValue(null, host.Services);
            var coordinator = new DatabasePoolCoordinator(cache, tenant, (t, _) => t == tenant ? new[] { session.Db } : Array.Empty<Database>(), (_, _) => false);
            coordinatorField.SetValue(null, coordinator);
            await host.StartAsync(TestContext.Current.CancellationToken);
            var url = host.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            using var client = new HttpClient { BaseAddress = new Uri(url) };
            var jwt = new JwtSecurityToken(claims: new[] { new Claim("UserId", "admin-id"), new Claim("OsClient", tenant),
                new Claim(DiyToken.AuthVersionClaimType, DiyToken.CurrentAuthVersion) }, expires: DateTime.UtcNow.AddMinutes(5));
            var token = new JwtSecurityTokenHandler().WriteToken(jwt);
            var cacheKey = $"Microi:{tenant}:LoginTokenSysUser:admin-id";
            var tokenModel = new CurrentToken { OsClient = tenant, Token = token, AuthVersion = DiyToken.CurrentAuthVersion,
                CurrentUser = JObject.FromObject(new { Id = "admin-id", Account = "admin", Level = 9999, _IsAdmin = true }) };
            await cache.StringSetAsync(cacheKey, JsonConvert.SerializeObject(tokenModel));
            client.DefaultRequestHeaders.Add("OsClient", tenant);
            client.DefaultRequestHeaders.Add("did", "PoolRecoveryRegression");
            using var held = session.Db.CreateConnection(true);
            Assert.ThrowsAny<Exception>(() => session.Db.CreateConnection(true));
            Assert.Equal("DatabasePoolExhausted", session.Db.GetConnectionPoolSnapshot().FailureCode);
            async Task<JObject> Send(object body)
            {
                using var response = await client.PostAsync("/api/Diagnostics/database-pools", new StringContent(JsonConvert.SerializeObject(body), System.Text.Encoding.UTF8, "application/json"));
                Assert.True(response.Headers.CacheControl?.NoStore);
                return JObject.Parse(await response.Content.ReadAsStringAsync());
            }
            Assert.Equal(0, (await Send(new { Action = "DatabasePools" })).Value<int>("Code"));
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var preview = await Send(new { Action = "DatabasePools" });
            Assert.True(preview.Value<int>("Code") == 1, preview.ToString() + " " + await client.GetStringAsync("/fixture/auth"));
            Assert.True(preview["Data"]!.Value<bool>("CanReset"));
            Assert.DoesNotContain(settings.Password, preview.ToString());
            using (var oversized = await client.PostAsync("/api/Diagnostics/database-pools", new StringContent(
                JsonConvert.SerializeObject(new { Action = "DatabasePools", Padding = new string('x', 5000) }), System.Text.Encoding.UTF8, "application/json")))
                Assert.Equal(System.Net.HttpStatusCode.RequestEntityTooLarge, oversized.StatusCode);
            Assert.Equal(0, (await Send(new { Action = "DatabasePools", OsClient = "another-tenant", _IsAdmin = true })).Value<int>("Code"));
            // 已被撤权的管理员不能只凭 Redis 的旧 Level 清池；无池读取必须看到主库的新权限。
            using (Database.BeginIsolatedConnections()) session.FromSql("UPDATE sys_user SET Level=1").ExecuteNonQuery();
            Assert.Equal(0, (await Send(new { Action = "DatabasePools", Level = 9999 })).Value<int>("Code"));
            using (Database.BeginIsolatedConnections()) session.FromSql("UPDATE sys_user SET Level=9999").ExecuteNonQuery();
            await cache.KeyDeleteAsync(cacheKey);
            Assert.Equal(0, (await Send(new { Action = "DatabasePools" })).Value<int>("Code"));
            await cache.StringSetAsync(cacheKey, JsonConvert.SerializeObject(tokenModel));
            var id = preview["Data"]!.Value<string>("OperationId")!;
            var ids = preview["Data"]!["PoolIds"]!.ToObject<string[]>();
            Assert.Equal(0, (await Send(new { Action = "ResetDatabasePools", OperationId = id, PoolIds = ids, Confirm = "wrong" })).Value<int>("Code"));
            Assert.Equal(0, session.Db.GetConnectionPoolSnapshot().Generation);
            var accepted = await Send(new { Action = "ResetDatabasePools", OperationId = id, PoolIds = ids, Confirm = "ResetDatabasePools:" + id });
            Assert.Equal(1, accepted.Value<int>("Code"));
            await coordinator.TickAsync();
            var receipt = await Send(new { Action = "DatabasePoolRecovery", OperationId = id });
            Assert.Equal("CompletedForRegisteredNodes", receipt["Data"]!.Value<string>("State"));
            Assert.Equal(1, session.FromSql("SELECT 1").ToScalar<int>());
            Assert.Equal(System.Data.ConnectionState.Open, held.State);
        }
        finally
        {
            if (host != null) { await host.StopAsync(); await host.DisposeAsync(); }
            OsClientExtend.ClientList.TryRemove(tenant, out _);
            providerField.SetValue(null, oldProvider); accessorField.SetValue(null, oldAccessor); coordinatorField.SetValue(null, oldCoordinator);
            session.Db.ResetConnectionPool();
            using var drop = admin.CreateCommand(); drop.CommandText = $"DROP DATABASE `{fixtureName}`"; await drop.ExecuteNonQueryAsync();
        }
    }

    private sealed class CacheTenant(IMicroiCache cache) : IMicroiCacheTenant
    {
        public IMicroiCache Cache(string osClient) => cache;
        public IMicroiCache Default() => cache;
    }
    public class RedisCacheProxy : DispatchProxy
    {
        public IDatabase Database = null!;
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name == nameof(IMicroiCache.GetIDatabase)) return Database;
            var key = args![0]!.ToString()!;
            if (method.Name == "GetAsync" && method.IsGenericMethod)
                return GetType().GetMethod(nameof(Read))!.MakeGenericMethod(method.GetGenericArguments()).Invoke(this, new object[] { key });
            if (method.Name == "Get")
            {
                var raw = Database.StringGet(key);
                return raw.HasValue ? JsonConvert.DeserializeObject(raw.ToString(), method.ReturnType) : null;
            }
            if (method.Name == "SetAsync") return Database.StringSetAsync(key, JsonConvert.SerializeObject(args[1]));
            if (method.Name == "Set") return Database.StringSet(key, JsonConvert.SerializeObject(args[1]));
            throw new NotSupportedException(method.Name);
        }
        public async Task<T?> Read<T>(string key)
        {
            var raw = await Database.StringGetAsync(key);
            return raw.HasValue ? JsonConvert.DeserializeObject<T>(raw.ToString()) : default;
        }
    }
}
