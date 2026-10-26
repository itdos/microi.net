using System.Net;
using Microsoft.Data.Sqlite;
using Microi.Panel;

var workspace = args.Length > 0 ? Path.GetFullPath(args[0]) : Directory.GetCurrentDirectory();
if (!File.Exists(Path.Combine(workspace, "Microi.Server", "Microi.Panel", "Microi.Panel.csproj"))) throw new Exception("Provide the source workspace as the first argument.");
var taskRoot = Path.Combine(workspace, ".tmp", "panel-login-security-" + Guid.NewGuid().ToString("N"));
var options = new OpsOptions { DataDir = taskRoot, LogDir = Path.Combine(taskRoot, "logs") };
var clock = new ManualClock();
var checks = 0;
void Check(bool value, string title) { if (!value) throw new Exception(title); checks++; Console.WriteLine("PASS " + title); }
PanelLoginSecurity Create(OpsStore store) => new(options, store, new OpsAudit(store, options), clock);
string Event() => Guid.NewGuid().ToString("N");
try
{
    using (var store = new OpsStore(options))
    {
        var security = Create(store); var policy = security.Policy();
        Check(policy.Enabled && policy.MaxFailures == 3 && policy.BanSeconds == 86400 && policy.WindowSeconds == 0, "defaults are enabled, three cumulative failures and 24 hours");
        Check(PanelLoginSecurity.NormalizeIp(IPAddress.Parse("::ffff:198.51.100.2")) == "198.51.100.2", "mapped IPv6 and IPv4 share one source identity");
        var first = Event();
        Check(security.Failure("198.51.100.2", first).FailedAttempts == 1, "first real password failure is counted");
        Check(security.Failure("198.51.100.2", first).FailedAttempts == 1, "failure event replay is idempotent");
        Check(security.PendingFailures(1, "198.51.100.2") is [{ Id: var queuedId, OccurredAt: var occurred }] && queuedId == first && occurred == clock.GetUtcNow(), "failure counter and deduplicated delivery event commit together");
        security.Success("198.51.100.2"); clock.Advance(TimeSpan.FromDays(2));
        Check(security.Failure("198.51.100.2", Event()).FailedAttempts == 2, "success and elapsed time do not erase default cumulative failures");
        var banned = security.Failure("198.51.100.2", Event());
        Check(banned.Banned && banned.BannedUntil == clock.GetUtcNow().AddHours(24), "third failure starts the configured ban");
        Check(!security.Check("198.51.100.3").Banned, "one source cannot lock another administrator out");
        security.Success("198.51.100.2");
        Check(security.Check("198.51.100.2").Banned, "successful password verification cannot bypass an active ban");
        Check(security.Failure("198.51.100.2", Event()).BannedUntil == banned.BannedUntil, "requests during a ban do not extend expiry");
        var current = security.IssueSession("operator", "version-1");
        Check(security.ValidateSession(current, "operator", "version-1"), "issued independent session is valid");
        Check(!security.ValidateSession(current, "other", "version-1") && !security.ValidateSession(current, "operator", "version-2"), "session is bound to account and credential revision");
        security.RevokeSession(current);
        Check(!security.ValidateSession(current, "operator", "version-1"), "logout revokes copied session cookies server-side");
        var expires = security.IssueSession("operator", "version-1"); clock.Advance(TimeSpan.FromHours(8));
        Check(!security.ValidateSession(expires, "operator", "version-1"), "session absolute eight-hour expiration is enforced");
    }
    using (var store = new OpsStore(options))
    {
        var security = Create(store);
        Check(security.Check("198.51.100.2").Banned, "IP ban survives controller restart");
        Check(security.PendingFailures(100, "198.51.100.2").Count == 3, "unacknowledged failures survive controller restart");
        clock.Advance(TimeSpan.FromHours(16));
        Check(security.PendingFailures(1, "198.51.100.2").Count == 0, "delivery checks expire old ban cycles before a login status read");
        var expired = security.Check("198.51.100.2");
        Check(!expired.Banned && expired.FailedAttempts == 0 && expired.BannedUntil == null, "expiry automatically clears the completed failure cycle");
        Check(!security.HasPendingFailures("198.51.100.2"), "automatic expiry cannot replay a completed ban cycle onto the recovered host");
        var clearedEvent = Event(); security.Failure("198.51.100.2", clearedEvent); security.Unban("198.51.100.2", "operator");
        Check(security.Check("198.51.100.2").FailedAttempts == 0, "manual unban also resets partial cumulative failures");
        Check(security.Failure("198.51.100.2", clearedEvent).FailedAttempts == 0, "unban retains event receipts and cannot replay the cleared failure");
        Check(!security.HasPendingFailures("198.51.100.2"), "manual unban removes the explicitly reset IP's delivery backlog");
        security.SetPolicy(new(MaxFailures:2, BanSeconds:60, WindowSeconds:10, Allowlist:["192.0.2.0/24", "2001:db8::1"], Revision:"host-revision"), "operator");
        Check(security.Policy().Revision == "host-revision", "host policy revision survives local caching");
        Check(security.Failure("192.0.2.7", Event()).FailedAttempts == 0 && !security.Failure("2001:db8::1", Event()).Banned, "CIDR and exact-IP allowlists bypass lockout accounting");
        security.Failure("203.0.113.1", Event()); clock.Advance(TimeSpan.FromSeconds(11));
        Check(security.Failure("203.0.113.1", Event()).FailedAttempts == 1, "explicit failure window expires old failures");
        Check(security.Failure("203.0.113.1", Event()).BannedUntil == clock.GetUtcNow().AddSeconds(60), "custom threshold and duration are applied");
        security.SetPolicy(new(MaxFailures:3, BanSeconds:60, WindowSeconds:10), "operator");
        security.Failure("203.0.113.8", Event()); clock.Advance(TimeSpan.FromSeconds(8));
        security.Failure("203.0.113.8", Event()); clock.Advance(TimeSpan.FromSeconds(8));
        Check(security.Failure("203.0.113.8", Event()) is { FailedAttempts:2, Banned:false }, "rolling window uses actual timestamps instead of inactivity between failures");
        security.SetPolicy(new(Enabled:false), "operator");
        Check(!security.Check("203.0.113.1").Banned && !security.Failure("203.0.113.1", Event()).Banned, "disabled policy is accurately reflected");
        security.SetPolicy(new(MaxFailures:3, BanSeconds:86400), "operator");
        Task.WaitAll(Enumerable.Range(0, 12).Select(_ => Task.Run(() => security.Failure("203.0.113.2", Event()))).ToArray());
        Check(security.Check("203.0.113.2") is { FailedAttempts:3, Banned:true }, "concurrent failures count atomically and stop at threshold");
        var invalid = false; try { security.SetPolicy(new(Allowlist:["bad subnet"]), "operator"); } catch (OpsException) { invalid = true; }
        Check(invalid, "malformed allowlist fails before replacing policy");
        Check(security.GetStatus().Entries.Any(x => x.Ip == "203.0.113.2" && x.Banned), "operator status exposes persisted ban state without credentials");
        var revision = security.Policy().Revision; var casSucceeded = 0; var casConflicted = 0;
        Task.WaitAll(Enumerable.Range(0, 2).Select(_ => Task.Run(() =>
        {
            try { security.SetPolicyIfRevision(new(), "operator", revision); Interlocked.Increment(ref casSucceeded); }
            catch (OpsException error) when (error.Status == 409) { Interlocked.Increment(ref casConflicted); }
        })).ToArray());
        Check(casSucceeded == 1 && casConflicted == 1, "atomic local policy CAS permits only one writer with the same old revision");
        security.SetPolicy(new(Revision:"host-new", Generation:4), "host");
        Check(security.SetPolicy(new(Enabled:false, Revision:"host-old", Generation:3), "host").Revision == "host-new", "late host responses cannot roll policy generation backward");
        security.SetPolicyIfRevision(new(Revision:"local-offline"), "operator", "host-new");
        Check(security.SetPolicy(new(Revision:"host-old", Generation:3), "host").Revision == "local-offline", "host generation high-water mark survives an offline local edit");
        Check(!security.MirrorHost("203.0.113.42", 3, clock.GetUtcNow().AddHours(24), clock.GetUtcNow(), clock.GetUtcNow(), policyGeneration:3)
            && security.Check("203.0.113.42").FailedAttempts == 0, "old-generation host receipts cannot replace counters after an offline policy edit");
        var deliveryId = Event(); security.Failure("203.0.113.40", deliveryId);
        Check(security.PendingFailures(1, "203.0.113.40")[0].Id == deliveryId, "login can prioritize its own IP backlog over unrelated sources");
        Check(!security.MirrorHost("203.0.113.40", 0, null, null, clock.GetUtcNow()) && security.Check("203.0.113.40").FailedAttempts == 1,
            "host snapshots cannot erase a locally committed failure awaiting acknowledgement");
        security.AckFailure(deliveryId); security.AckFailure(deliveryId);
        Check(!security.HasPendingFailures("203.0.113.40") && security.MirrorHost("203.0.113.40", 3, clock.GetUtcNow().AddHours(24), clock.GetUtcNow(), clock.GetUtcNow()),
            "idempotent delivery acknowledgement permits an authoritative cross-service host ban snapshot");
        clock.Advance(TimeSpan.FromMilliseconds(100));
        Check(security.MirrorHost("203.0.113.40", 0, null, null, clock.GetUtcNow()) && !security.Check("203.0.113.40").Banned,
            "a newer host unban snapshot clears stale local fallback bans");
        Check(!security.MirrorHost("203.0.113.40", 3, clock.GetUtcNow().AddHours(24), clock.GetUtcNow(), clock.GetUtcNow().AddMilliseconds(-100))
            && !security.Check("203.0.113.40").Banned, "an older host observation cannot reapply a cleared ban");
        security.SetPolicy(new(MaxFailures:3, BanSeconds:60, WindowSeconds:10), "operator");
        Check(!security.MirrorHost("203.0.113.41", 2, null, clock.GetUtcNow(), clock.GetUtcNow()), "rolling host mirror requires exact failure timestamps");
        var hostTimes = new[] { clock.GetUtcNow().AddSeconds(-8), clock.GetUtcNow() };
        Check(security.MirrorHost("203.0.113.41", 2, null, clock.GetUtcNow(), clock.GetUtcNow(), hostTimes), "rolling host snapshot imports exact cross-service event timestamps");
        clock.Advance(TimeSpan.FromSeconds(8));
        Check(security.Failure("203.0.113.41", Event()) is { FailedAttempts:2, Banned:false }, "offline fallback applies the real rolling window to mirrored and new local events");
    }
    await GuardIntegrationChecks.Run(Check);
    Console.WriteLine($"All {checks} Panel security checks passed.");
}
finally
{
    // 本轮目录具有随机身份，关闭SQLite连接池后普通删除，不触碰共享数据与服务。
    SqliteConnection.ClearAllPools();
    var boundary = Path.Combine(workspace, ".tmp") + Path.DirectorySeparatorChar;
    if (!Path.GetFullPath(taskRoot).StartsWith(boundary, StringComparison.Ordinal) || new DirectoryInfo(taskRoot).LinkTarget != null) throw new Exception("Unsafe test cleanup path");
    if (Directory.Exists(taskRoot)) Directory.Delete(taskRoot, recursive:true);
}
sealed class ManualClock : TimeProvider
{
    private DateTimeOffset now = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
    public override DateTimeOffset GetUtcNow() => now;
    public void Advance(TimeSpan amount) => now += amount;
}
