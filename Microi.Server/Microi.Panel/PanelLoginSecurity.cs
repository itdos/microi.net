using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace Microi.Panel;

public sealed record PanelLoginPolicy(bool Enabled = true, int MaxFailures = 3, int BanSeconds = 86400,
    int WindowSeconds = 0, string[]? Allowlist = null, string? Revision = null, long Generation = 0);
public sealed record PanelLoginIpStatus(string Ip, int FailedAttempts, bool Banned, DateTimeOffset? BannedUntil, DateTimeOffset? LastFailure);
public sealed record PanelLoginProtectionStatus(PanelLoginPolicy Policy, IReadOnlyList<PanelLoginIpStatus> Entries);
public sealed record PanelLoginFailureEvent(string Id, string Ip, DateTimeOffset OccurredAt);

/// <summary>独立面板的持久防爆破和可撤销会话。宿主防护离线时仍保留本地登录保护，不授予业务DiyToken主机权限。</summary>
public sealed class PanelLoginSecurity
{
    private readonly string connection;
    private readonly OpsAudit audit;
    private readonly TimeProvider clock;
    private readonly object gate = new();
    public PanelLoginSecurity(OpsOptions options, OpsStore store, OpsAudit audit, TimeProvider? clock = null)
    {
        _ = store; this.audit = audit; this.clock = clock ?? TimeProvider.System;
        connection = new SqliteConnectionStringBuilder { DataSource = Path.Combine(options.DataDir, "ops.db") }.ToString();
        using var db = Open(); using var tx = db.BeginTransaction(); using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS panel_login_policy (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS panel_login_ip (ip TEXT PRIMARY KEY, failures INTEGER NOT NULL, banned_until INTEGER, last_failure INTEGER);
            CREATE INDEX IF NOT EXISTS panel_login_ip_expiry ON panel_login_ip(banned_until);
            CREATE TABLE IF NOT EXISTS panel_login_events (id TEXT PRIMARY KEY, ip TEXT NOT NULL, occurred INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS panel_login_events_ip_time ON panel_login_events(ip,occurred);
            CREATE INDEX IF NOT EXISTS panel_login_events_time ON panel_login_events(occurred);
            CREATE TABLE IF NOT EXISTS panel_login_seen (id TEXT PRIMARY KEY, occurred INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS panel_login_seen_time ON panel_login_seen(occurred);
            CREATE TABLE IF NOT EXISTS panel_login_outbox (id TEXT PRIMARY KEY, ip TEXT NOT NULL, occurred_at INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS panel_login_outbox_ip_time ON panel_login_outbox(ip,occurred_at);
            CREATE TABLE IF NOT EXISTS panel_login_mirrors (ip TEXT PRIMARY KEY, observed_at INTEGER NOT NULL, failures INTEGER NOT NULL, last_failure INTEGER);
            CREATE TABLE IF NOT EXISTS panel_login_metadata (id TEXT PRIMARY KEY, value INTEGER NOT NULL);
            UPDATE panel_login_events SET occurred=occurred*1000 WHERE NOT EXISTS(SELECT 1 FROM panel_login_metadata WHERE id='event-time-ms');
            INSERT OR IGNORE INTO panel_login_metadata VALUES('event-time-ms',1);
            INSERT OR IGNORE INTO panel_login_seen SELECT id,occurred/1000 FROM panel_login_events WHERE id NOT LIKE 'host:%';
            CREATE TABLE IF NOT EXISTS panel_login_sessions (id_hash TEXT PRIMARY KEY, account TEXT NOT NULL, credential_version TEXT NOT NULL, expires INTEGER NOT NULL);
            INSERT OR IGNORE INTO panel_login_policy(id,body) VALUES(1,$default);
            """;
        cmd.Parameters.AddWithValue("$default", JsonSerializer.Serialize(new PanelLoginPolicy(Allowlist: []), JsonDefaults.Options));
        cmd.ExecuteNonQuery(); tx.Commit();
    }
    private SqliteConnection Open()
    {
        var db = new SqliteConnection(connection); db.Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL;"; cmd.ExecuteNonQuery(); return db;
    }
    /// <summary>只接受连接中间件确认的地址；不读取调用方自行传入的X-Forwarded-For。</summary>
    public static string NormalizeIp(IPAddress? ip)
    {
        if (ip == null) throw new OpsException("无法确认登录来源地址。", 400);
        return (ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip).ToString();
    }
    private static string Ip(string value) => IPAddress.TryParse(value, out var ip) ? NormalizeIp(ip) : throw new OpsException("IP地址无效。");
    private static string SessionHash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public PanelLoginPolicy Policy()
    {
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT body FROM panel_login_policy WHERE id=1";
        return JsonSerializer.Deserialize<PanelLoginPolicy>((string)cmd.ExecuteScalar()!, JsonDefaults.Options)!;
    }
    /// <summary>主机策略由调用方完成CAS后同步到本地；保留主机Revision，不把本地缓存当作另一份权威策略。</summary>
    public PanelLoginPolicy SetPolicy(PanelLoginPolicy policy, string actor)
    {
        if (policy.MaxFailures is < 1 or > 100 || policy.BanSeconds is < 1 or > 31536000 || policy.WindowSeconds is < 0 or > 31536000
            || (policy.Allowlist?.Length ?? 0) > 256 || (policy.Revision?.Length ?? 0) > 128 || policy.Generation < 0) throw new OpsException("登录防护策略参数无效。");
        var allowlist = (policy.Allowlist ?? []).Select(value =>
        {
            if (IPAddress.TryParse(value, out var address)) return NormalizeIp(address);
            if (IPNetwork.TryParse(value, out var network)) return network.ToString();
            throw new OpsException("白名单只允许IP地址或CIDR网段。");
        }).Distinct(StringComparer.Ordinal).ToArray();
        policy = policy with { Allowlist = allowlist, Revision = policy.Revision ?? Guid.NewGuid().ToString("N") };
        lock (gate)
        {
            using var db = Open(); using var tx = db.BeginTransaction(); using var cmd = db.CreateCommand(); cmd.Transaction = tx;
            cmd.CommandText = "SELECT value FROM panel_login_metadata WHERE id='host-policy-generation'";
            var generation = cmd.ExecuteScalar() is long savedGeneration ? savedGeneration : 0;
            if (policy.Generation > 0 && policy.Generation < generation) { tx.Commit(); return Policy(); }
            if (policy.Generation > 0)
            {
                cmd.CommandText = "INSERT INTO panel_login_metadata VALUES('host-policy-generation',$generation) ON CONFLICT(id) DO UPDATE SET value=excluded.value";
                cmd.Parameters.AddWithValue("$generation", policy.Generation); cmd.ExecuteNonQuery();
            }
            cmd.CommandText = "UPDATE panel_login_policy SET body=$body WHERE id=1";
            cmd.Parameters.AddWithValue("$body", JsonSerializer.Serialize(policy, JsonDefaults.Options)); cmd.ExecuteNonQuery();
            tx.Commit();
        }
        audit.Write("LoginProtectionPolicyChanged", actor, "面板登录防护策略已同步。"); return policy;
    }
    /// <summary>离线本地策略的比较与写入共享同一独占门；并发旧Revision只能有一个成功。</summary>
    public PanelLoginPolicy SetPolicyIfRevision(PanelLoginPolicy policy, string actor, string? expectedRevision)
    {
        lock (gate)
        {
            if (Policy().Revision != expectedRevision) throw new OpsException("面板登录策略已变化，请刷新后重试。", 409);
            return SetPolicy(policy, actor);
        }
    }
    private static bool Exempt(PanelLoginPolicy policy, string ip)
    {
        var address = IPAddress.Parse(ip);
        return !policy.Enabled || (policy.Allowlist ?? []).Any(value => IPAddress.TryParse(value, out var allowed)
            ? allowed.Equals(address) : IPNetwork.TryParse(value, out var network) && network.Contains(address));
    }
    private PanelLoginIpStatus Read(SqliteConnection db, SqliteTransaction? tx, string ip)
    {
        using var cmd = db.CreateCommand(); cmd.Transaction = tx; cmd.CommandText = "SELECT failures,banned_until,last_failure FROM panel_login_ip WHERE ip=$ip"; cmd.Parameters.AddWithValue("$ip", ip);
        using var row = cmd.ExecuteReader();
        if (!row.Read()) return new(ip, 0, false, null, null);
        var until = row.IsDBNull(1) ? (DateTimeOffset?)null : DateTimeOffset.FromUnixTimeSeconds(row.GetInt64(1));
        return new(ip, row.GetInt32(0), until > clock.GetUtcNow(), until, row.IsDBNull(2) ? null : DateTimeOffset.FromUnixTimeSeconds(row.GetInt64(2)));
    }
    private static void Save(SqliteConnection db, SqliteTransaction? tx, PanelLoginIpStatus value)
    {
        using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "INSERT INTO panel_login_ip VALUES($ip,$failures,$until,$last) ON CONFLICT(ip) DO UPDATE SET failures=excluded.failures,banned_until=excluded.banned_until,last_failure=excluded.last_failure";
        cmd.Parameters.AddWithValue("$ip", value.Ip); cmd.Parameters.AddWithValue("$failures", value.FailedAttempts);
        cmd.Parameters.AddWithValue("$until", (object?)value.BannedUntil?.ToUnixTimeSeconds() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$last", (object?)value.LastFailure?.ToUnixTimeSeconds() ?? DBNull.Value); cmd.ExecuteNonQuery();
    }
    private PanelLoginIpStatus Current(SqliteConnection db, SqliteTransaction? tx, string ip, PanelLoginPolicy policy)
    {
        var state = Read(db, tx, ip);
        if (state.BannedUntil <= clock.GetUtcNow())
        {
            ClearWindow(db, tx, ip); ClearMirrorCount(db, tx, ip);
            using var clear = db.CreateCommand(); clear.Transaction = tx; clear.CommandText = "DELETE FROM panel_login_outbox WHERE ip=$ip"; clear.Parameters.AddWithValue("$ip", ip); clear.ExecuteNonQuery();
            state = new(ip, 0, false, null, state.LastFailure); Save(db, tx, state);
        }
        if (!state.Banned && policy.WindowSeconds > 0)
        {
            var count = WindowCount(db, tx, ip, policy.WindowSeconds);
            if (count != state.FailedAttempts) { state = state with { FailedAttempts = count }; Save(db, tx, state); }
        }
        return Exempt(policy, ip) ? state with { Banned = false } : state;
    }
    private int WindowCount(SqliteConnection db, SqliteTransaction? tx, string ip, int seconds)
    {
        using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "SELECT COUNT(*) FROM panel_login_events WHERE ip=$ip AND occurred>$after";
        cmd.Parameters.AddWithValue("$ip", ip); cmd.Parameters.AddWithValue("$after", clock.GetUtcNow().AddSeconds(-seconds).ToUnixTimeMilliseconds());
        return checked((int)(long)cmd.ExecuteScalar()!);
    }
    private static void ClearWindow(SqliteConnection db, SqliteTransaction? tx, string ip)
    {
        // 解封清理计数事件，但保留独立去重凭据，已处理的旧事件不会立即重放计数。
        using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "DELETE FROM panel_login_events WHERE ip=$ip"; cmd.Parameters.AddWithValue("$ip", ip); cmd.ExecuteNonQuery();
    }
    private static void ClearMirrorCount(SqliteConnection db, SqliteTransaction? tx, string ip)
    {
        using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "UPDATE panel_login_mirrors SET failures=0,last_failure=NULL WHERE ip=$ip";
        cmd.Parameters.AddWithValue("$ip", ip); cmd.ExecuteNonQuery();
    }
    private void PruneEvents(SqliteConnection db, SqliteTransaction tx, PanelLoginPolicy policy)
    {
        // 累计值独立保存在IP行，归档事件按最长有效期且至少30天批量回收，避免不断膨胀。
        var retention = Math.Max(30 * 86400, Math.Max(policy.BanSeconds, policy.WindowSeconds));
        using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "DELETE FROM panel_login_events WHERE id IN (SELECT id FROM panel_login_events WHERE occurred<$beforeMs LIMIT 1000); DELETE FROM panel_login_seen WHERE id IN (SELECT id FROM panel_login_seen WHERE occurred<$before LIMIT 1000)";
        cmd.Parameters.AddWithValue("$before", clock.GetUtcNow().AddSeconds(-retention).ToUnixTimeSeconds()); cmd.Parameters.AddWithValue("$beforeMs", clock.GetUtcNow().AddSeconds(-retention).ToUnixTimeMilliseconds()); cmd.ExecuteNonQuery();
    }
    public PanelLoginIpStatus Check(string ip)
    {
        ip = Ip(ip); lock (gate) { using var db = Open(); return Current(db, null, ip, Policy()); }
    }
    public PanelLoginIpStatus Failure(string ip, string eventId)
    {
        ip = Ip(ip); if (!Guid.TryParse(eventId, out _)) throw new OpsException("登录失败事件需要唯一标识。");
        lock (gate)
        {
            var policy = Policy(); using var db = Open(); using var tx = db.BeginTransaction();
            PruneEvents(db, tx, policy);
            var state = Current(db, tx, ip, policy);
            if (Exempt(policy, ip) || state.Banned) { tx.Commit(); return state; }
            using var cmd = db.CreateCommand(); cmd.Transaction = tx;
            cmd.CommandText = "INSERT OR IGNORE INTO panel_login_seen VALUES($id,$time)";
            cmd.Parameters.AddWithValue("$id", eventId); cmd.Parameters.AddWithValue("$ip", ip); cmd.Parameters.AddWithValue("$time", clock.GetUtcNow().ToUnixTimeSeconds());
            if (cmd.ExecuteNonQuery() == 0) { tx.Commit(); return state; }
            cmd.Parameters.AddWithValue("$occurred", clock.GetUtcNow().ToUnixTimeMilliseconds());
            cmd.CommandText = "INSERT INTO panel_login_events VALUES($id,$ip,$occurred); INSERT INTO panel_login_outbox VALUES($id,$ip,$occurred)"; cmd.ExecuteNonQuery();
            var failures = policy.WindowSeconds > 0 ? WindowCount(db, tx, ip, policy.WindowSeconds) : checked(state.FailedAttempts + 1);
            var banned = failures >= policy.MaxFailures;
            state = new(ip, failures, banned, banned ? clock.GetUtcNow().AddSeconds(policy.BanSeconds) : null, clock.GetUtcNow());
            Save(db, tx, state); tx.Commit();
            if (banned) audit.Write("LoginIpBanned", "system", "来源IP " + ip + " 达到失败阈值，临时封禁至 " + state.BannedUntil!.Value.ToString("O"));
            return state;
        }
    }
    /// <summary>默认累计语义：成功登录不清空已有失败次数，也不能绕过尚未到期的封禁。</summary>
    public void Success(string ip) { _ = Ip(ip); }
    public bool Unban(string ip, string actor)
    {
        ip = Ip(ip); lock (gate)
        {
            using var db = Open(); using var tx = db.BeginTransaction(); ClearWindow(db, tx, ip); Save(db, tx, new(ip, 0, false, null, null));
            using var cmd = db.CreateCommand(); cmd.Transaction = tx;
            cmd.CommandText = "DELETE FROM panel_login_outbox WHERE ip=$ip; INSERT INTO panel_login_mirrors VALUES($ip,$observed,0,NULL) ON CONFLICT(ip) DO UPDATE SET observed_at=MAX(observed_at,excluded.observed_at),failures=0,last_failure=NULL";
            cmd.Parameters.AddWithValue("$ip", ip); cmd.Parameters.AddWithValue("$observed", clock.GetUtcNow().ToUnixTimeMilliseconds()); cmd.ExecuteNonQuery(); tx.Commit();
        }
        audit.Write("LoginIpUnbanned", actor, "来源IP " + ip + " 已手动解封并清零失败计数。"); return true;
    }
    public IReadOnlyList<PanelLoginFailureEvent> PendingFailures(int limit = 100, string? ip = null)
    {
        if (limit is < 1 or > 1000) throw new ArgumentOutOfRangeException(nameof(limit));
        lock (gate)
        {
            using var db = Open(); using var cmd = db.CreateCommand();
            cmd.Parameters.AddWithValue("$ip", (object?)(ip == null ? null : Ip(ip)) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$now", clock.GetUtcNow().ToUnixTimeSeconds());
            cmd.CommandText = "SELECT ip FROM panel_login_ip WHERE banned_until<=$now AND ($ip IS NULL OR ip=$ip) LIMIT 1000";
            var expired = new List<string>(); using (var rows = cmd.ExecuteReader()) while (rows.Read()) expired.Add(rows.GetString(0));
            var policy = Policy(); foreach (var source in expired) Current(db, null, source, policy);
            // Flush可能发生在登录Check之前；未处理的过期周期也不能补投并在宿主重新触发24小时封禁。
            cmd.CommandText = "SELECT id,ip,occurred_at FROM panel_login_outbox o WHERE ($ip IS NULL OR ip=$ip) AND NOT EXISTS(SELECT 1 FROM panel_login_ip p WHERE p.ip=o.ip AND p.banned_until<=$now) ORDER BY occurred_at,id LIMIT $limit";
            cmd.Parameters.AddWithValue("$limit", limit);
            using var pending = cmd.ExecuteReader(); var result = new List<PanelLoginFailureEvent>();
            while (pending.Read()) result.Add(new(pending.GetString(0), pending.GetString(1), DateTimeOffset.FromUnixTimeMilliseconds(pending.GetInt64(2))));
            return result;
        }
    }
    public bool HasPendingFailures(string ip) => PendingFailures(1, ip).Count > 0;
    public void AckFailure(string id)
    {
        lock (gate) { using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "DELETE FROM panel_login_outbox WHERE id=$id"; cmd.Parameters.AddWithValue("$id", id); cmd.ExecuteNonQuery(); }
    }
    /// <summary>先补投本机事件，再镜像宿主权威状态。未补投事件和旧回执不能覆盖本地保护。</summary>
    public bool MirrorHost(string ip, int failedAttempts, DateTimeOffset? bannedUntil, DateTimeOffset? lastFailure, DateTimeOffset observedAt, IReadOnlyList<DateTimeOffset>? recentFailureTimes = null, long? policyGeneration = null)
    {
        ip = Ip(ip); if (failedAttempts is < 0 or > 1000000) throw new OpsException("主机失败计数无效。", 502);
        lock (gate)
        {
            var policy = Policy();
            if (policy.WindowSeconds > 0 && recentFailureTimes == null) return false;
            if (recentFailureTimes?.Count > 100 || recentFailureTimes?.Any(time => time > observedAt.AddSeconds(1)) == true) throw new OpsException("主机失败时间快照无效。", 502);
            using var db = Open(); using var tx = db.BeginTransaction(); using var cmd = db.CreateCommand(); cmd.Transaction = tx;
            cmd.CommandText = "SELECT value FROM panel_login_metadata WHERE id='host-policy-generation'";
            if (policyGeneration is { } receivedGeneration && cmd.ExecuteScalar() is long hostGeneration && receivedGeneration < hostGeneration) { tx.Commit(); return false; }
            cmd.CommandText = "SELECT observed_at FROM panel_login_mirrors WHERE ip=$ip"; cmd.Parameters.AddWithValue("$ip", ip);
            if (cmd.ExecuteScalar() is long observed && observed > observedAt.ToUnixTimeMilliseconds()) { tx.Commit(); return false; }
            cmd.CommandText = "SELECT COUNT(*) FROM panel_login_outbox WHERE ip=$ip";
            if ((long)cmd.ExecuteScalar()! > 0) { tx.Commit(); return false; }
            ClearWindow(db, tx, ip);
            if (policy.WindowSeconds > 0)
            {
                for (var index = 0; index < recentFailureTimes!.Count; index++)
                {
                    using var insert = db.CreateCommand(); insert.Transaction = tx;
                    insert.CommandText = "INSERT INTO panel_login_events VALUES($id,$ip,$occurred)";
                    insert.Parameters.AddWithValue("$id", "host:" + ip + ":" + observedAt.ToUnixTimeMilliseconds() + ":" + index);
                    insert.Parameters.AddWithValue("$ip", ip); insert.Parameters.AddWithValue("$occurred", recentFailureTimes[index].ToUnixTimeMilliseconds()); insert.ExecuteNonQuery();
                }
            }
            Save(db, tx, new(ip, failedAttempts, bannedUntil > clock.GetUtcNow(), bannedUntil, lastFailure));
            cmd.CommandText = "INSERT INTO panel_login_mirrors VALUES($ip,$observed,$failures,$last) ON CONFLICT(ip) DO UPDATE SET observed_at=excluded.observed_at,failures=excluded.failures,last_failure=excluded.last_failure";
            cmd.Parameters.AddWithValue("$observed", observedAt.ToUnixTimeMilliseconds()); cmd.Parameters.AddWithValue("$failures", failedAttempts);
            cmd.Parameters.AddWithValue("$last", (object?)lastFailure?.ToUnixTimeSeconds() ?? DBNull.Value); cmd.ExecuteNonQuery(); tx.Commit(); return true;
        }
    }
    public PanelLoginProtectionStatus GetStatus()
    {
        lock (gate)
        {
            using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT ip FROM panel_login_ip ORDER BY last_failure DESC LIMIT 250";
            var ips = new List<string>(); using (var rows = cmd.ExecuteReader()) while (rows.Read()) ips.Add(rows.GetString(0));
            var policy = Policy(); return new(policy, ips.Select(ip => Current(db, null, ip, policy)).ToArray());
        }
    }
    public string IssueSession(string account, string credentialVersion)
    {
        var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "DELETE FROM panel_login_sessions WHERE expires<=$now; INSERT INTO panel_login_sessions VALUES($id,$account,$version,$expires)";
        cmd.Parameters.AddWithValue("$now", clock.GetUtcNow().ToUnixTimeSeconds()); cmd.Parameters.AddWithValue("$id", SessionHash(id));
        cmd.Parameters.AddWithValue("$account", account); cmd.Parameters.AddWithValue("$version", credentialVersion); cmd.Parameters.AddWithValue("$expires", clock.GetUtcNow().AddHours(8).ToUnixTimeSeconds()); cmd.ExecuteNonQuery(); return id;
    }
    public bool ValidateSession(string sessionId, string account, string credentialVersion)
    {
        if (sessionId.Length != 64) return false;
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM panel_login_sessions WHERE id_hash=$id AND account=$account AND credential_version=$version AND expires>$now";
        cmd.Parameters.AddWithValue("$id", SessionHash(sessionId)); cmd.Parameters.AddWithValue("$account", account); cmd.Parameters.AddWithValue("$version", credentialVersion);
        cmd.Parameters.AddWithValue("$now", clock.GetUtcNow().ToUnixTimeSeconds()); return (long)cmd.ExecuteScalar()! == 1;
    }
    public void RevokeSession(string sessionId)
    {
        if (sessionId.Length != 64) return;
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "DELETE FROM panel_login_sessions WHERE id_hash=$id";
        cmd.Parameters.AddWithValue("$id", SessionHash(sessionId)); cmd.ExecuteNonQuery();
    }
}
