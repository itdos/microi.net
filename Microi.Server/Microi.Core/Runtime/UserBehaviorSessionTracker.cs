using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
/// <summary>跨请求跟踪详情停留时间；Redis为主，本机内存为故障兜底。</summary>
public sealed class UserBehaviorSessionTracker
{
    private readonly ConcurrentDictionary<string, DetailVisitState> _local =
        new ConcurrentDictionary<string, DetailVisitState>();
    private readonly ConcurrentDictionary<string, long> _dedup =
        new ConcurrentDictionary<string, long>();

    public bool ShouldLogOnce(string key, TimeSpan window)
    {
        var now = DateTime.UtcNow.Ticks;
        var threshold = now - window.Ticks;
        if (_dedup.TryGetValue(key, out var last) && last >= threshold) return false;
        _dedup[key] = now;
        if (_dedup.Count > 100000)
        {
            foreach (var old in _dedup.Where(d => d.Value < now - TimeSpan.FromMinutes(10).Ticks).Take(10000))
                _dedup.TryRemove(old.Key, out _);
        }
        return true;
    }

    public async Task OpenDetailAsync(string osClient, JObject user, string table, string rowId, object row,
        string clientType, string did)
    {
        if (string.IsNullOrWhiteSpace(osClient) || string.IsNullOrWhiteSpace(table) || string.IsNullOrWhiteSpace(rowId)) return;
        var state = new DetailVisitState
        {
            OpenedAt = DateTime.Now,
            Preview = UserBehaviorAudit.BuildRowPreview(row),
            Table = table,
            RowId = rowId
        };
        var key = BuildKey(osClient, user?["Id"]?.ToString(), did, table, rowId);
        _local[key] = state;
        try
        {
            await MicroiEngine.CacheTenant.Cache(osClient)
                .SetAsync(key, JsonConvert.SerializeObject(state), TimeSpan.FromDays(2)).ConfigureAwait(false);
        }
        catch { /* Redis异常时保留本机兜底，不影响详情响应。 */ }
    }

    public async Task<long?> CloseDetailAsync(string osClient, JObject user, string table, string rowId,
        string clientType, string did, string source)
    {
        if (string.IsNullOrWhiteSpace(osClient) || string.IsNullOrWhiteSpace(table) || string.IsNullOrWhiteSpace(rowId)) return null;
        var key = BuildKey(osClient, user?["Id"]?.ToString(), did, table, rowId);
        DetailVisitState state = null;
        try
        {
            var json = await MicroiEngine.CacheTenant.Cache(osClient).GetAsync<string>(key).ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(json)) state = JsonConvert.DeserializeObject<DetailVisitState>(json);
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync(key).ConfigureAwait(false);
        }
        catch { }
        if (state == null) _local.TryGetValue(key, out state);
        _local.TryRemove(key, out _);

        long? seconds = state == null
            ? (long?)null
            : Math.Max(0, (long)(DateTime.Now - state.OpenedAt).TotalSeconds);
        var context = new DiyTableRowParam
        {
            OsClient = osClient,
            _CurrentUser = user,
            _ClientType = clientType,
            _InvokeType = InvokeType.Client.ToString()
        };
        var duration = seconds.HasValue ? UserBehaviorAudit.FormatDuration(seconds.Value) : "未知（未找到打开记录）";
        UserBehaviorAudit.Track(context, "Data", "DetailClose", "查看数据", "DataRow", rowId,
            $"关闭了表[{table}]的数据[{rowId}]，停留{duration}",
            new { Table = table, RowId = rowId, Duration = duration, Preview = state?.Preview }, true, seconds, source,
            eventId: UserBehaviorAudit.DeterministicEventId($"detail-close|{key}|{state?.OpenedAt.Ticks}"));
        return seconds;
    }

    public static string SessionIdFromToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        return Sha256Hex(token).Substring(0, 24);
    }

    private static string BuildKey(string osClient, string userId, string did, string table, string rowId)
    {
        var raw = $"{osClient}|{userId}|{did}|{table}|{rowId}";
        var hash = Sha256Hex(raw);
        return $"Microi:{osClient}:Audit:Detail:{hash}";
    }

    private static string Sha256Hex(string value)
    {
        using var sha = SHA256.Create();
        return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(value ?? string.Empty)))
            .Replace("-", string.Empty)
            .ToLowerInvariant();
    }

    private sealed class DetailVisitState
    {
        public DateTime OpenedAt { get; set; }
        public string Table { get; set; }
        public string RowId { get; set; }
        public JObject Preview { get; set; }
    }
}
}
