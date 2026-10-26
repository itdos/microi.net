using Microi.net;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.Tests.Common;

/// <summary>复用本机 API 已选 Redis，仅操作随机测试前缀，不创建服务、不使用真实手机号或业务验证码。</summary>
[Trait("Category", "FullStack")]
public sealed class PasswordResetRedisTests
{
    [Fact]
    public async Task SmsProof_IsSingleUseAcrossTwoConnections_AndWrongCodesAreBounded()
    {
        var options = SelectedRedisOptions();
        using var first = await ConnectionMultiplexer.ConnectAsync(options);
        using var second = await ConnectionMultiplexer.ConnectAsync(options);
        var a = first.GetDatabase();
        var b = second.GetDatabase();
        var prefix = "Microi:Tests:PasswordReset:" + Guid.NewGuid().ToString("N") + ":";
        var keys = new RedisKey[] { prefix + "proof", prefix + "attempts", prefix + "cooldown" };
        try
        {
            Assert.Equal(0, await Consume(a, keys, "123456"));
            await a.StringSetAsync(keys[0], "123456", TimeSpan.FromSeconds(60));
            var parallel = await Task.WhenAll(Enumerable.Range(0, 16).Select(index =>
                Consume(index % 2 == 0 ? a : b, keys, "123456")));
            Assert.Single(parallel.Where(value => value == 1));
            Assert.Equal(15, parallel.Count(value => value == 0));
            Assert.False(await a.KeyExistsAsync(keys[0]));

            await a.StringSetAsync(keys[0], "123456", TimeSpan.FromSeconds(60));
            for (var index = 0; index < 6; index++)
                Assert.Equal(-1, await Consume(index % 2 == 0 ? a : b, keys, "654321"));
            Assert.Equal(-2, await Consume(b, keys, "123456"));
            var ttl = await a.KeyTimeToLiveAsync(keys[1]);
            Assert.True(ttl > TimeSpan.Zero && ttl <= TimeSpan.FromMinutes(10));
            Assert.True(await a.KeyExistsAsync(keys[0]));

            // 同一脚本不能接受历史魔法值作为重置授权。
            await a.KeyDeleteAsync(keys);
            await a.StringSetAsync(keys[0], "Allow", TimeSpan.FromSeconds(60));
            Assert.Equal(-1, await Consume(a, keys, "123456"));

            // 独立租户/请求的 Key 无法使用另一前缀的证明。
            var otherKeys = keys.Select(key => (RedisKey)(key + "-other")).ToArray();
            Assert.Equal(0, await Consume(b, otherKeys, "123456"));
        }
        finally
        {
            await a.KeyDeleteAsync(keys);
            Assert.All(await Task.WhenAll(keys.Select(key => a.KeyExistsAsync(key))), Assert.False);
        }
    }

    private static async Task<long> Consume(IDatabase database, RedisKey[] keys, string code) =>
        (long)await database.ScriptEvaluateAsync(V8Method.PasswordResetSmsConsumeScript, keys, new RedisValue[] { code });

    private static ConfigurationOptions SelectedRedisOptions()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && !Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
            directory = directory.Parent;
        if (directory == null) throw new InvalidOperationException("找不到已配置的 API 工作区。");
        var api = Path.Combine(directory.FullName, "Microi.Server", "Microi.net.Api");
        var selected = File.ReadAllText(Path.Combine(api, ".microi-local")).Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(selected, "^[A-Za-z0-9_-]+$"))
            throw new InvalidOperationException("本机 API 环境选择无效。");
        var settings = JObject.Parse(File.ReadAllText(Path.Combine(api, "appsettings." + selected + ".json")))["AppSettings"]!;
        var options = new ConfigurationOptions
        {
            Password = settings["OsClientRedisPwd"]?.ToString(),
            DefaultDatabase = int.Parse(settings["OsClientRedisDataBase"]!.ToString()),
            ConnectTimeout = 5000, SyncTimeout = 5000, AbortOnConnectFail = true
        };
        options.EndPoints.Add(settings["OsClientRedisHost"]!.ToString(), int.Parse(settings["OsClientRedisPort"]!.ToString()));
        return options;
    }
}
