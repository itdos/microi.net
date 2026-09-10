using Microsoft.Data.Sqlite;
using System.Text.Json;

namespace Microi.Panel;

// 本机控制器专用持久库；独占实例锁 + SQLite 事务。跨主机任务不使用本库充当集群锁。
public sealed class OpsStore : IDisposable
{
    private readonly string connectionString;
    private readonly FileStream instanceLock;
    public OpsStore(OpsOptions options)
    {
        Directory.CreateDirectory(options.DataDir);
        instanceLock = new(Path.Combine(options.DataDir, "controller.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        connectionString = new SqliteConnectionStringBuilder { DataSource = Path.Combine(options.DataDir, "ops.db"), Pooling = true }.ToString();
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, created TEXT NOT NULL, body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, plan_id TEXT NOT NULL, state TEXT NOT NULL, created TEXT NOT NULL, body TEXT NOT NULL);
            CREATE UNIQUE INDEX IF NOT EXISTS one_active_task ON tasks((1)) WHERE state IN ('Queued','Running','Recovering','NeedsAttention');
            CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, occurred TEXT NOT NULL, body TEXT NOT NULL, binding TEXT NOT NULL, delivered INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, next_try TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS events_outbox ON events(delivered,next_try);
            """;
        cmd.ExecuteNonQuery();
    }
    private SqliteConnection Open()
    {
        var db = new SqliteConnection(connectionString); db.Open();
        using var cmd = db.CreateCommand(); cmd.CommandText = "PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL;"; cmd.ExecuteNonQuery();
        return db;
    }
    private static string Json<T>(T value) => JsonSerializer.Serialize(value, JsonDefaults.Options);
    private static T? Parse<T>(object? value) => value is string text ? JsonSerializer.Deserialize<T>(text, JsonDefaults.Options) : default;
    public T? Get<T>(string key)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT body FROM settings WHERE key=$key"; cmd.Parameters.AddWithValue("$key", key);
        return Parse<T>(cmd.ExecuteScalar());
    }
    public void Set<T>(string key, T value)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "INSERT INTO settings(key,body) VALUES($key,$body) ON CONFLICT(key) DO UPDATE SET body=excluded.body";
        cmd.Parameters.AddWithValue("$key", key); cmd.Parameters.AddWithValue("$body", Json(value)); cmd.ExecuteNonQuery();
    }
    // 长请求的回执只更新发起时的那一版设置，不能覆盖其间的退出登录或策略修改。
    public bool CompareExchange<T>(string key, T expected, T value)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE settings SET body=$body WHERE key=$key AND body=$expected";
        cmd.Parameters.AddWithValue("$key", key); cmd.Parameters.AddWithValue("$body", Json(value));
        cmd.Parameters.AddWithValue("$expected", Json(expected)); return cmd.ExecuteNonQuery() == 1;
    }
    public OpsTask? FindTask(string value, bool byRequest = false)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT body FROM tasks WHERE " + (byRequest ? "request_id" : "id") + "=$value";
        cmd.Parameters.AddWithValue("$value", value); return Parse<OpsTask>(cmd.ExecuteScalar());
    }
    public long PendingEvents(string binding)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM events WHERE delivered=0 AND binding=$binding";
        cmd.Parameters.AddWithValue("$binding", binding); return (long)cmd.ExecuteScalar()!;
    }
    public void AddPlan(UpdatePlan plan)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "INSERT INTO plans VALUES($id,$created,$body)";
        cmd.Parameters.AddWithValue("$id", plan.Id); cmd.Parameters.AddWithValue("$created", plan.Created.ToString("O")); cmd.Parameters.AddWithValue("$body", Json(plan)); cmd.ExecuteNonQuery();
    }
    public UpdatePlan Plan(string id)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT body FROM plans WHERE id=$id"; cmd.Parameters.AddWithValue("$id", id);
        return Parse<UpdatePlan>(cmd.ExecuteScalar()) ?? throw new OpsException("更新计划不存在。", 404);
    }
    public OpsTask Enqueue(string planId, string requestId, string actor, bool downloadOnly = false)
    {
        if (!Guid.TryParse(requestId, out _)) throw new OpsException("请求 Id 必须为稳定的 UUID。");
        using var db = Open(); using var tx = db.BeginTransaction(); using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "SELECT body FROM tasks WHERE request_id=$request"; cmd.Parameters.AddWithValue("$request", requestId);
        var prior = Parse<OpsTask>(cmd.ExecuteScalar());
        if (prior != null)
        {
            if (prior.PlanId != planId || prior.DownloadOnly != downloadOnly) throw new OpsException("同一请求 Id 不能用于不同计划。", 409);
            return prior;
        }
        var task = new OpsTask { PlanId = planId, RequestId = requestId, Actor = actor, DownloadOnly = downloadOnly };
        cmd.CommandText = "INSERT INTO tasks VALUES($id,$request,$plan,'Queued',$created,$body)";
        cmd.Parameters.AddWithValue("$id", task.Id); cmd.Parameters.AddWithValue("$plan", planId);
        cmd.Parameters.AddWithValue("$created", task.Created.ToString("O")); cmd.Parameters.AddWithValue("$body", Json(task));
        try { cmd.ExecuteNonQuery(); tx.Commit(); }
        catch (SqliteException e) when (e.SqliteErrorCode == 19) { throw new OpsException("已有更新任务正在执行，请打开该任务。", 409); }
        return task;
    }
    public List<OpsTask> Tasks(bool active = false)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT body FROM tasks " + (active ? "WHERE state IN ('Queued','Running','Recovering','NeedsAttention') " : "") + "ORDER BY created DESC LIMIT 100";
        using var reader = cmd.ExecuteReader(); var result = new List<OpsTask>();
        while (reader.Read()) result.Add(Parse<OpsTask>(reader.GetString(0))!); return result;
    }
    public void SaveTask(OpsTask task)
    {
        task.Updated = DateTimeOffset.UtcNow;
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE tasks SET state=$state,body=$body WHERE id=$id";
        cmd.Parameters.AddWithValue("$state", task.State); cmd.Parameters.AddWithValue("$body", Json(task)); cmd.Parameters.AddWithValue("$id", task.Id);
        if (cmd.ExecuteNonQuery() != 1) throw new OpsException("任务状态保存失败。", 500);
    }
    public void AddEvent(OpsEvent entry, string binding)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "INSERT OR IGNORE INTO events(id,occurred,body,binding,next_try) VALUES($id,$time,$body,$binding,$time)";
        cmd.Parameters.AddWithValue("$id", entry.EventId); cmd.Parameters.AddWithValue("$time", entry.OccurredAt.ToString("O"));
        cmd.Parameters.AddWithValue("$body", Json(entry)); cmd.Parameters.AddWithValue("$binding", binding); cmd.ExecuteNonQuery();
    }
    public List<OpsEvent> Events(bool pending = false, string binding = "")
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT body FROM events " + (pending ? "WHERE delivered=0 AND binding=$binding AND next_try<=$now ORDER BY occurred ASC LIMIT 20" : "ORDER BY occurred DESC LIMIT 100");
        if (pending) { cmd.Parameters.AddWithValue("$binding", binding); cmd.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); }
        using var reader = cmd.ExecuteReader(); var list = new List<OpsEvent>(); while (reader.Read()) list.Add(Parse<OpsEvent>(reader.GetString(0))!); return list;
    }
    public void EventResult(string id, bool success)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE events SET delivered=$ok,attempts=attempts+1,next_try=$next WHERE id=$id";
        cmd.Parameters.AddWithValue("$ok", success ? 1 : 0); cmd.Parameters.AddWithValue("$next", DateTimeOffset.UtcNow.AddMinutes(1).ToString("O")); cmd.Parameters.AddWithValue("$id", id); cmd.ExecuteNonQuery();
    }
    // 只清理已收到平台持久回执的旧事件及未提交的旧计划；保留待投递事件和任务幂等账本。
    public void PruneDelivered(int retentionDays)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "DELETE FROM events WHERE id IN (SELECT id FROM events WHERE delivered=1 AND occurred<$before LIMIT 1000); "
            + "DELETE FROM plans WHERE id IN (SELECT id FROM plans WHERE created<$before AND NOT EXISTS (SELECT 1 FROM tasks WHERE plan_id=plans.id) LIMIT 1000);";
        cmd.Parameters.AddWithValue("$before", DateTimeOffset.UtcNow.AddDays(-retentionDays).ToString("O")); cmd.ExecuteNonQuery();
    }
    public void Dispose() { instanceLock.Dispose(); SqliteConnection.ClearAllPools(); }
}

public sealed class UpdatePlan
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public DateTimeOffset Created { get; set; } = DateTimeOffset.UtcNow;
    public string EngineId { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    public string DeploymentFingerprint { get; set; } = "";
    public List<PlanService> Services { get; set; } = [];
    public object Public() => new { Id, Created, EngineId, Fingerprint, Services = Services.Select(x => new { x.Name, x.Role, x.OldImage, x.TargetImage, x.TargetDigest, x.WasRunning, x.Changed, x.RollbackAllowed }) };
}
public sealed class PlanService
{
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string OldId { get; set; } = "";
    public string OldImage { get; set; } = "";
    public string TargetImage { get; set; } = "";
    public string TargetDigest { get; set; } = "";
    public string SnapshotCipher { get; set; } = "";
    public string ConfigHash { get; set; } = "";
    public bool WasRunning { get; set; }
    public bool Changed { get; set; }
    public bool RollbackAllowed { get; set; }
    public bool LocalOnly { get; set; }
}
public sealed class OpsTask
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string PlanId { get; set; } = "";
    public string RequestId { get; set; } = "";
    public string Actor { get; set; } = "";
    public bool DownloadOnly { get; set; }
    public string State { get; set; } = "Queued";
    public string Phase { get; set; } = "等待执行";
    public int Progress { get; set; }
    public DateTimeOffset Created { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset Updated { get; set; } = DateTimeOffset.UtcNow;
    public string Error { get; set; } = "";
    public Dictionary<string, string> Steps { get; set; } = new();
    public Dictionary<string, long> Downloaded { get; set; } = new();
    public Dictionary<string, long> DownloadTotals { get; set; } = new();
    public double? EstimatedSeconds { get; set; }
}
public sealed class OpsEvent
{
    public string EventId { get; set; } = Guid.NewGuid().ToString("N");
    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;
    public string DeploymentId { get; set; } = "";
    public string Action { get; set; } = "";
    public string Actor { get; set; } = "";
    public string TaskId { get; set; } = "";
    public string Message { get; set; } = "";
    public bool Success { get; set; }
}
