using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    public static partial class PublicResourceOffloadRuntime
    {
        private static readonly AsyncLocal<bool> ReplicaRead = new AsyncLocal<bool>();
        private sealed class ReplicaReadScope : IDisposable
        {
            private readonly bool previous = ReplicaRead.Value;
            internal ReplicaReadScope() { ReplicaRead.Value = true; }
            public void Dispose() { ReplicaRead.Value = previous; }
        }

        /// <summary>
        /// HDFS提供商实际读取公有响应字节后调用的可信入口。仅计入当前主存储的公开受管命名空间；
        /// 迁移及副本校验单独排除，未接入的下载保持未知。每次聚合使用签名值+CAS，普通缓存写入不能伪造阈值。
        /// 计量故障不破坏业务读取，只使正向下界不完整，永不因此报告零请求或完整覆盖。
        /// </summary>
        public static async Task RecordPublicSourceReadAsync(HDFSParam param, long actualBytes)
        {
            if (ReplicaRead.Value || actualBytes <= 0 || param?.Limit != false || param?.ClientModel == null) return;
            try
            {
                var key = (param.FileFullPath ?? "").TrimStart('/');
                if (!PublicResourceOffloadProtocol.AssetPath(key)
                    || !TryReportApplication("https://source.invalid/" + key, "source.invalid", out var tenant, out var app)) return;
                var binding = await BindAsync(OsClientDefault.OsClient).ConfigureAwait(false);
                foreach (var field in new[] { "AliOssPublicEndpoint", "AliOssPublicBucketName" })
                    if (param.ClientModel.OsClientModel.Value<string>(field) != binding.Client.OsClientModel.Value<string>(field)) return;
                var day = new DateTimeOffset(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8)).Date, TimeSpan.FromHours(8)).ToUniversalTime();
                var root = RootKey(binding) + "sdk-day:" + day.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture) + ":";
                var metricKey = root + tenant + "|" + app;
                const string compareAndSet = "local old=redis.call('GET',KEYS[1]); if (old or '') ~= ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'EX',604800); return 1";
                for (var attempt = 0; attempt < 3; attempt++)
                {
                    var prior = await binding.Redis.StringGetAsync(metricKey).ConfigureAwait(false);
                    var state = prior.HasValue ? PublicResourceOffloadProtocol.Open(prior.ToString(), binding.Owner, binding.SigningSecret) : null;
                    if (prior.HasValue && state == null) return;
                    state ??= new JObject { ["SourceTenant"] = tenant, ["AppKey"] = app, ["WindowStartUtc"] = day.ToUnixTimeSeconds(),
                        ["WindowEndUtc"] = day.AddDays(1).ToUnixTimeSeconds(), ["Bytes"] = 0L, ["ReadRequests"] = 0L };
                    state["Bytes"] = checked(state.Value<long>("Bytes") + actualBytes);
                    state["ReadRequests"] = checked(state.Value<long>("ReadRequests") + 1);
                    state["LastObservedAtUtc"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                    var wire = PublicResourceOffloadProtocol.Seal(state, binding.Owner, binding.SigningSecret);
                    var ack = (long)await binding.Redis.ScriptEvaluateAsync(compareAndSet, new RedisKey[] { metricKey }, new RedisValue[] { prior.ToString(), wire }).ConfigureAwait(false);
                    if (ack == 1)
                    {
                        await binding.Redis.SetAddAsync(root + "groups", tenant + "|" + app).ConfigureAwait(false);
                        await binding.Redis.KeyExpireAsync(root + "groups", TimeSpan.FromDays(7)).ConfigureAwait(false);
                        return;
                    }
                }
            }
            catch { /* 只保留已确认正向下界；不把丢失观测解释为零。 */ }
        }

        private static async Task MergeSdkDayAsync(Binding binding, DateTimeOffset start,
            System.Collections.Generic.Dictionary<string, JObject> totals)
        {
            var root = RootKey(binding) + "sdk-day:" + start.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture) + ":";
            var groups = await binding.Redis.SetMembersAsync(root + "groups").ConfigureAwait(false);
            foreach (var group in groups)
            {
                var parts = group.ToString().Split('|');
                if (parts.Length != 2 || !PublicResourceOffloadProtocol.Identifier(parts[0], 64) || !PublicResourceOffloadProtocol.Identifier(parts[1])) continue;
                var proof = await ReadSignedAsync(binding, root + group.ToString()).ConfigureAwait(false);
                if (proof == null || proof.Value<long>("WindowStartUtc") != start.ToUnixTimeSeconds()
                    || proof.Value<long>("WindowEndUtc") != start.AddDays(1).ToUnixTimeSeconds() || proof.Value<long>("Bytes") <= 0) continue;
                if (!totals.TryGetValue(group.ToString(), out var aggregate))
                    totals.Add(group.ToString(), aggregate = new JObject { ["SourceTenant"] = parts[0], ["AppKey"] = parts[1], ["ConfirmedBytesLowerBound"] = 0L, ["MatchedUrls"] = 0 });
                aggregate["ConfirmedBytesLowerBound"] = checked(aggregate.Value<long>("ConfirmedBytesLowerBound") + proof.Value<long>("Bytes"));
                aggregate["ObservedDirectOssSdkBytes"] = proof["Bytes"];
                aggregate["ObservedDirectOssSdkReadRequests"] = proof["ReadRequests"];
            }
        }
    }
}
