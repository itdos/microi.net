using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class PublicResourceOffloadRuntime
    {
        private static string QualificationKey(Binding binding, string tenant, string app) => RootKey(binding)
            + "qualification:" + tenant.ToLowerInvariant() + ":" + app.ToLowerInvariant();

        private static async Task<JObject> ReadQualificationAsync(Binding binding, string tenant, string app)
        {
            var value = await binding.Redis.StringGetAsync(QualificationKey(binding, tenant, app)).ConfigureAwait(false);
            var proof = value.HasValue ? PublicResourceOffloadProtocol.Open(value.ToString(), binding.Owner, binding.SigningSecret) : null;
            return proof != null && proof.Value<long>("WindowEndUtc") >= DateTimeOffset.UtcNow.AddHours(-48).ToUnixTimeSeconds()
                && PublicResourceOffloadProtocol.ReachedThreshold(proof.Value<long?>("ConfirmedBytesLowerBound"), binding.Config.Value<decimal?>("FileServerBakThresholdGiB")) ? proof : null;
        }

        private static async Task<JArray> ListSafeAsync(Binding binding)
        {
            var output = new JArray();
            var keys = await binding.Redis.SetMembersAsync(RootKey(binding) + "groups").ConfigureAwait(false);
            foreach (var key in keys.Take(500))
            {
                var parts = key.ToString().Split('|');
                if (parts.Length != 2 || !PublicResourceOffloadProtocol.Identifier(parts[0], 64)
                    || !PublicResourceOffloadProtocol.Identifier(parts[1])) continue;
                var state = await ReadAsync(binding, parts[0], parts[1]).ConfigureAwait(false);
                if (state != null) output.Add(SafeState(state));
                else
                {
                    var proof = await ReadQualificationAsync(binding, parts[0], parts[1]).ConfigureAwait(false);
                    if (proof != null) output.Add(new JObject { ["SourceTenant"] = parts[0], ["AppKey"] = parts[1], ["State"] = "Qualified", ["Qualification"] = proof });
                }
            }
            return output;
        }

        /// <summary>
        /// 固定只读阿里云运营报表协议，凭据仅由可信配置读取。不能调用已下线且可能不准确的
        /// DescribeDomainTopUrlVisit，也不创建SLS或新的付费服务。缺报表/未覆盖整日只记Pending。
        /// </summary>
        private static async Task<DosResult> CollectAsync(Binding binding, CancellationToken token)
        {
            var now = DateTimeOffset.UtcNow;
            var end = new DateTimeOffset(now.ToOffset(TimeSpan.FromHours(8)).Date, TimeSpan.FromHours(8)).ToUniversalTime();
            var start = end.AddDays(-1);
            if (!PublicResourceOffloadProtocol.CompleteDay(start, end, now)) throw new InvalidOperationException("CompleteDayRequired");
            var subscriptions = await CloudReadAsync(binding, "DescribeCdnSubList", new Dictionary<string, string>(), token).ConfigureAwait(false);
            var content = Content(subscriptions["Content"]);
            var domains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var sub in (content["data"] as JArray ?? new JArray()).OfType<JObject>())
            {
                if (sub.Value<string>("status") != "enable"
                    || !(sub["reportId"] as JArray ?? new JArray()).Any(id => id.ToString() == "3")
                    || !DateTimeOffset.TryParse(sub.Value<string>("effectiveFrom"), CultureInfo.InvariantCulture,
                        DateTimeStyles.RoundtripKind, out var effective) || effective > start) continue;
                foreach (var domain in (sub["domains"] as JArray ?? new JArray()).Values<string>())
                    if (Uri.CheckHostName(domain ?? "") == UriHostNameType.Dns && domain.Contains('.')) domains.Add(domain);
            }
            var totals = new Dictionary<string, JObject>(StringComparer.Ordinal);
            var reportsRead = 0;
            foreach (var domain in domains.Take(50))
            {
                token.ThrowIfCancellationRequested();
                await Task.Delay(TimeSpan.FromMilliseconds(400), token).ConfigureAwait(false);
                var report = await CloudReadAsync(binding, "DescribeCdnReport", new Dictionary<string, string>
                {
                    ["ReportId"] = "3", ["DomainName"] = domain, ["HttpCode"] = "2xx",
                    ["StartTime"] = start.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture),
                    ["EndTime"] = end.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture)
                }, token).ConfigureAwait(false);
                var blocks = Content(report["Content"])["data"] as JArray;
                if (blocks == null || blocks.Count == 0) continue;
                foreach (var block in blocks.OfType<JObject>())
                {
                    if (block.SelectToken("deliver.report.title")?.ToString() != "TopUrlByTraf") continue;
                    reportsRead++;
                    foreach (var row in (block["data"] as JArray ?? new JArray()).OfType<JObject>())
                    {
                        if (!TryReportApplication(row.Value<string>("url"), domain, out var tenant, out var app)) continue;
                        var bytes = Number(row, "traf");
                        if (bytes < 0) continue;
                        var key = tenant + "|" + app;
                        if (!totals.TryGetValue(key, out var aggregate))
                        {
                            aggregate = new JObject { ["SourceTenant"] = tenant, ["AppKey"] = app,
                                ["ConfirmedBytesLowerBound"] = 0L, ["MatchedUrls"] = 0 };
                            totals.Add(key, aggregate);
                        }
                        aggregate["ConfirmedBytesLowerBound"] = checked(aggregate.Value<long>("ConfirmedBytesLowerBound") + bytes);
                        aggregate["MatchedUrls"] = aggregate.Value<int>("MatchedUrls") + 1;
                    }
                }
            }
            var qualified = new JArray(); var unresolved = new JArray();
            await MergeSdkDayAsync(binding, start, totals).ConfigureAwait(false);
            foreach (var pair in totals)
            {
                var item = pair.Value;
                if (!PublicResourceOffloadProtocol.ReachedThreshold(item.Value<long>("ConfirmedBytesLowerBound"),
                        binding.Config.Value<decimal?>("FileServerBakThresholdGiB"))) continue;
                var tenant = item.Value<string>("SourceTenant"); var app = item.Value<string>("AppKey");
                // 在晋级前解析当前公开清单，拒绝报表中不能归属到当前受管应用的路径。
                try { SourceSnapshot(binding, tenant, app); }
                catch (Exception error)
                {
                    unresolved.Add(new JObject { ["SourceTenant"] = tenant, ["AppKey"] = app,
                        ["ConfirmedBytesLowerBound"] = item["ConfirmedBytesLowerBound"],
                        ["Blocker"] = error is InvalidOperationException && SafeCode(error.Message) ? error.Message : "PublicAuthorityUnavailable" });
                    continue;
                }
                item["Contract"] = PublicResourceOffloadProtocol.Contract;
                item["Metric"] = "CdnAndObservedDirectOssSdkResponseBytesLowerBound";
                item["WindowStartUtc"] = start.ToUnixTimeSeconds(); item["WindowEndUtc"] = end.ToUnixTimeSeconds();
                item["Complete24HourInterval"] = true; item["AllDeliveryCoverageClaimed"] = false;
                item["CollectedAtUtc"] = now.ToUnixTimeSeconds(); item["QualificationState"] = "ThresholdConfirmed";
                var wire = PublicResourceOffloadProtocol.Seal(item, binding.Owner, binding.SigningSecret);
                await binding.Redis.StringSetAsync(QualificationKey(binding, tenant, app), wire).ConfigureAwait(false);
                await binding.Redis.SetAddAsync(RootKey(binding) + "groups", pair.Key).ConfigureAwait(false);
                qualified.Add(item.DeepClone());
            }
            var observation = new JObject { ["WindowStartUtc"] = start.ToUnixTimeSeconds(), ["WindowEndUtc"] = end.ToUnixTimeSeconds(),
                ["SubscribedDomains"] = domains.Count, ["ReportsRead"] = reportsRead, ["QualifiedGroups"] = qualified,
                ["UnresolvedThresholdGroups"] = unresolved, ["ObservedGroups"] = totals.Count,
                ["EmptyReportMeansZero"] = false, ["MissingPathsMeansZero"] = false,
                ["State"] = reportsRead == 0 ? "PendingProviderReports" : "ObservedPositiveLowerBounds" };
            await binding.Redis.StringSetAsync(RootKey(binding) + "last-collection",
                PublicResourceOffloadProtocol.Seal(observation, binding.Owner, binding.SigningSecret)).ConfigureAwait(false);
            return new DosResult(1, observation);
        }

        internal static bool TryReportApplication(string url, string expectedHost, out string tenant, out string app)
        {
            tenant = null; app = null;
            if (string.IsNullOrWhiteSpace(url) || url.Length > 4096 || url.IndexOfAny(new[] { '%', '\\', '?', '#' }) >= 0
                || !Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != "http" && uri.Scheme != "https")
                || !string.Equals(uri.Host, expectedHost, StringComparison.OrdinalIgnoreCase) || uri.UserInfo.Length > 0) return false;
            var parts = uri.AbsolutePath.TrimStart('/').Split('/');
            if (parts.Length >= 4 && parts[1] == "micro-app") { tenant = parts[0]; app = parts[2]; }
            else if (parts.Length >= 10 && parts[0] == "microi" && parts[1] == "application-assets" && parts[2] == "v3"
                && parts[3] == "tenants" && parts[5] == "kinds" && parts[6] == "runtime" && parts[7] == "apps")
            { tenant = parts[4]; app = parts[8]; }
            return PublicResourceOffloadProtocol.Identifier(tenant, 64) && PublicResourceOffloadProtocol.Identifier(app);
        }

        private static JObject Content(JToken token)
        {
            if (token is JObject value) return value;
            return token?.Type == JTokenType.String ? JObject.Parse(token.Value<string>()) : new JObject();
        }

        private static async Task<JObject> CloudReadAsync(Binding binding, string action,
            IDictionary<string, string> parameters, CancellationToken token)
        {
            if (action != "DescribeCdnSubList" && action != "DescribeCdnReport") throw new InvalidOperationException("CloudReadActionDenied");
            var settings = TenantSystemSettingsSecurity.LoadSnapshot(binding.Owner);
            string id = null, secret = null;
            foreach (var category in new[] { "Integration.Cdn.Aliyun.", "Integration.Dns.Aliyun." })
            {
                var candidateId = TenantSystemSettingsSecurity.GetText(settings, category + "AccessKeyId", "", true);
                var candidateSecret = TenantSystemSettingsSecurity.GetText(settings, category + "AccessKeySecret", "", true);
                if (string.IsNullOrWhiteSpace(candidateId) && string.IsNullOrWhiteSpace(candidateSecret)) continue;
                if (string.IsNullOrWhiteSpace(candidateId) || string.IsNullOrWhiteSpace(candidateSecret)) throw new InvalidOperationException("CloudReadCredentialsIncomplete");
                id = candidateId; secret = candidateSecret; break;
            }
            if (id == null) { id = binding.Client.OsClientModel.Value<string>("AlidnsKeyId"); secret = binding.Client.OsClientModel.Value<string>("AlidnsKeySecret"); }
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(secret)) throw new InvalidOperationException("CloudReadCredentialsMissing");
            var query = new SortedDictionary<string, string>(parameters.ToDictionary(x => x.Key, x => x.Value), StringComparer.Ordinal)
            {
                ["Action"] = action, ["Version"] = "2018-05-10", ["Format"] = "JSON", ["AccessKeyId"] = id,
                ["SignatureMethod"] = "HMAC-SHA1", ["SignatureVersion"] = "1.0", ["SignatureNonce"] = Guid.NewGuid().ToString("N"),
                ["Timestamp"] = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture)
            };
            string Escape(string value) => Uri.EscapeDataString(value).Replace("%7E", "~");
            var canonical = string.Join("&", query.Select(pair => Escape(pair.Key) + "=" + Escape(pair.Value)));
            using var hmac = new HMACSHA1(Encoding.UTF8.GetBytes(secret + "&"));
            var signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes("GET&%2F&" + Escape(canonical))));
            // 签名URL只存在于本次请求进程内，绝不进入异常信息、状态、日志或接口返回。
            using var response = await PublicHttp.GetAsync("https://cdn.aliyuncs.com/?" + canonical + "&Signature=" + Escape(signature),
                HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) throw new InvalidOperationException("CloudReportReadFailed");
            using var source = await response.Content.ReadAsStreamAsync().ConfigureAwait(false);
            using var output = new MemoryStream();
            var buffer = new byte[65536]; int length;
            while ((length = await source.ReadAsync(buffer, 0, buffer.Length, token).ConfigureAwait(false)) > 0)
            {
                if (output.Length + length > 4 * 1024 * 1024) throw new InvalidOperationException("CloudReportTooLarge");
                output.Write(buffer, 0, length);
            }
            var json = JObject.Parse(Encoding.UTF8.GetString(output.ToArray()));
            if (json["Code"] != null) throw new InvalidOperationException("CloudReportRejected");
            return json;
        }

        /// <summary>
        /// 宿主每分钟调用；共享检查点限制云查询频率并恢复已晋级公开组。按到期顺序处理，
        /// 不按每次HTTP请求复制，不创建Task.Run或额外线程，不影响现有OSS别名检查点。
        /// </summary>
        public static async Task TickAsync(CancellationToken token)
        {
            var binding = await BindAsync(OsClientDefault.OsClient).ConfigureAwait(false);
            var timeKey = RootKey(binding) + "collector-state";
            var collector = await ReadSignedAsync(binding, timeKey).ConfigureAwait(false);
            if (collector == null || collector.Value<long>("NextAtUtc") <= DateTimeOffset.UtcNow.ToUnixTimeSeconds())
            {
                await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    OsClient = binding.Owner, Key = "PublicResourceOffload:cloud-collection", Expiry = TimeSpan.FromMinutes(2),
                    AcquireTimeout = TimeSpan.FromSeconds(1), AutoRenew = true, MaxLeaseDuration = TimeSpan.FromMinutes(5), CancellationToken = token
                }, async lease =>
                {
                    var freshDue = await ReadSignedAsync(binding, timeKey).ConfigureAwait(false);
                    if (freshDue != null && freshDue.Value<long>("NextAtUtc") > DateTimeOffset.UtcNow.ToUnixTimeSeconds()) return;
                    var status = new JObject { ["AttemptedAtUtc"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds(), ["NextAtUtc"] = DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds() };
                    try { await CollectAsync(binding, token).ConfigureAwait(false); status["State"] = "ReadCompleted"; }
                    catch (Exception error) when (!(error is OperationCanceledException))
                    { status["State"] = "Retrying"; status["ErrorCode"] = error is InvalidOperationException && SafeCode(error.Message) ? error.Message : "CloudCollectionFailed"; }
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    await binding.Redis.StringSetAsync(timeKey, PublicResourceOffloadProtocol.Seal(status, binding.Owner, binding.SigningSecret)).ConfigureAwait(false);
                }).ConfigureAwait(false);
            }
            var groups = await binding.Redis.SetMembersAsync(RootKey(binding) + "groups").ConfigureAwait(false);
            var pending = new List<(string Tenant, string App, JObject State)>();
            foreach (var group in groups.Take(500))
            {
                token.ThrowIfCancellationRequested();
                var parts = group.ToString().Split('|');
                if (parts.Length != 2 || !PublicResourceOffloadProtocol.Identifier(parts[0], 64) || !PublicResourceOffloadProtocol.Identifier(parts[1])) continue;
                var state = await ReadAsync(binding, parts[0], parts[1]).ConfigureAwait(false);
                if (state?.Value<bool?>("Enabled") == false || state?.Value<long?>("RetryAtUtc") > DateTimeOffset.UtcNow.ToUnixTimeSeconds()) continue;
                if (state != null && state.Value<long>("HealthValidUntilUtc") > DateTimeOffset.UtcNow.AddMinutes(1).ToUnixTimeSeconds()) continue;
                pending.Add((parts[0], parts[1], state));
            }
            foreach (var item in pending.OrderBy(x => x.State?.Value<long>("UpdatedAtUtc") ?? 0).Take(20))
            {
                var pin = item.State?.Value<string>("Eligibility") == "ExplicitHistoricalHotspotSelection";
                await PrepareAsync(binding, item.Tenant, item.App, pin, token).ConfigureAwait(false);
            }
        }

        private static async Task<JObject> ReadSignedAsync(Binding binding, string key)
        {
            var wire = await binding.Redis.StringGetAsync(key).ConfigureAwait(false);
            return wire.HasValue ? PublicResourceOffloadProtocol.Open(wire.ToString(), binding.Owner, binding.SigningSecret) : null;
        }
        private static async Task<JObject> RuntimeStatusAsync(Binding binding) => new JObject
        {
            ["Protocol"] = PublicResourceOffloadProtocol.Contract,
            ["Collector"] = await ReadSignedAsync(binding, RootKey(binding) + "collector-state").ConfigureAwait(false),
            ["LastCollection"] = await ReadSignedAsync(binding, RootKey(binding) + "last-collection").ConfigureAwait(false),
            ["Groups"] = await ListSafeAsync(binding).ConfigureAwait(false)
        };
    }
}
