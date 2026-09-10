using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.Sqlite;
using System.Text.Json;

namespace Microi.Panel.Panel;

public sealed class PanelOperation
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string RequestId { get; set; } = "";
    public string ResourceId { get; set; } = "";
    public string Action { get; set; } = "";
    public string Actor { get; set; } = "";
    public string State { get; set; } = "Queued";
    public string Phase { get; set; } = "等待执行";
    public string Error { get; set; } = "";
    public DateTimeOffset Created { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset Updated { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>共享现有独占实例锁和 SQLite，所有副作用先登记；敏感容器配置只以 DataProtection 密文落盘。</summary>
public sealed partial class PanelRepository
{
    private readonly string connection;
    private readonly IDataProtector protector;
    public string OwnerId { get; }
    public PanelRepository(OpsOptions options, OpsStore store, IDataProtectionProvider protection)
    {
        connection = new SqliteConnectionStringBuilder { DataSource = Path.Combine(options.DataDir, "ops.db") }.ToString();
        protector = protection.CreateProtector("microi.panel.resource.v1");
        OwnerId = store.Get<string>("panel-owner-id") ?? "p" + Guid.NewGuid().ToString("N")[..16];
        PanelCatalog.SafeName(OwnerId); store.Set("panel-owner-id", OwnerId);
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS panel_resources (id TEXT PRIMARY KEY, body_cipher TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS panel_operations (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, resource_id TEXT NOT NULL, state TEXT NOT NULL, created TEXT NOT NULL, fingerprint TEXT NOT NULL, body TEXT NOT NULL);
            CREATE UNIQUE INDEX IF NOT EXISTS panel_one_operation_per_resource ON panel_operations(resource_id) WHERE state IN ('Queued','Running');
            CREATE TABLE IF NOT EXISTS panel_payloads (operation_id TEXT PRIMARY KEY, body_cipher TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS panel_certificates (id TEXT PRIMARY KEY, body_cipher TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS panel_backup_state (id TEXT PRIMARY KEY, body_cipher TEXT NOT NULL);
            """;
        cmd.ExecuteNonQuery();
    }
    private SqliteConnection Open()
    {
        var db = new SqliteConnection(connection); db.Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL;"; cmd.ExecuteNonQuery(); return db;
    }
    private static string Encode<T>(T value) => JsonSerializer.Serialize(value, JsonDefaults.Options);
    private static T Decode<T>(string value) => JsonSerializer.Deserialize<T>(value, JsonDefaults.Options) ?? throw new OpsException("面板记录不可读取，已停止操作。", 500);
    public PanelResource Resource(string id)
    {
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT body_cipher FROM panel_resources WHERE id=$id"; cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteScalar() is string data ? Decode<PanelResource>(protector.Unprotect(data)) : throw new OpsException("插件实例不存在。", 404);
    }
    public List<PanelResource> Resources()
    {
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT body_cipher FROM panel_resources ORDER BY id";
        using var rows = cmd.ExecuteReader(); var result = new List<PanelResource>(); while (rows.Read()) result.Add(Decode<PanelResource>(protector.Unprotect(rows.GetString(0)))); return result;
    }
    public void SaveResource(PanelResource value)
    {
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "UPDATE panel_resources SET body_cipher=$body WHERE id=$id";
        cmd.Parameters.AddWithValue("$body", protector.Protect(Encode(value))); cmd.Parameters.AddWithValue("$id", value.Id);
        if (cmd.ExecuteNonQuery() != 1) throw new OpsException("插件记录已变化。", 409);
    }
    public PanelOperation Enqueue(string action, string requestId, PanelResource resource, string actor, string? payload = null, string? expectedRevision = null, string? fingerprintMaterial = null, PanelSchedule? scheduleClaim = null, AcmeQueueClaim? acmeClaim = null)
    {
        if (!Guid.TryParse(requestId, out _)) throw new OpsException("操作需要稳定的 UUID 请求标识。");
        var fingerprint = UpdateCoordinator.Hash(action + "\n" + resource.Id + (action == "Install" ? "\n" + Encode(resource) : "") + (fingerprintMaterial ?? (payload == null ? "" : "\n" + payload)));
        using var db = Open(); using var tx = db.BeginTransaction(); using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "SELECT fingerprint,body FROM panel_operations WHERE request_id=$request"; cmd.Parameters.AddWithValue("$request", requestId);
        using (var rows = cmd.ExecuteReader())
        {
            if (rows.Read())
            {
                if (rows.GetString(0) != fingerprint) throw new OpsException("同一请求标识不能改变操作或安装参数。", 409);
                return Decode<PanelOperation>(rows.GetString(1));
            }
        }
        var operation = new PanelOperation { RequestId = requestId, Action = action, ResourceId = resource.Id, Actor = actor };
        if(acmeClaim!=null)
        {
            var value=acmeClaim.Registration;
            cmd.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id=$acme";cmd.Parameters.AddWithValue("$acme","acme:"+value.Id);
            var current=cmd.ExecuteScalar() is string body?Decode<PanelAcmeRegistration>(protector.Unprotect(body)):null;
            if((current?.Revision??"")!=acmeClaim.ExpectedRevision || (acmeClaim.Automatic && (current==null||!current.AutoRenew||current.NextCheck!=value.NextCheck||current.NextCheck>DateTimeOffset.UtcNow)))throw new OpsException("自动证书设置已变化、尚未到期或已暂停。",409);
            // 克隆避免修改调用方的槽位对象，从而保持重启和重试使用同一确定请求 Id。
            var updated=Decode<PanelAcmeRegistration>(Encode(value));updated.LastOperationId=operation.Id;updated.LastError="";updated.NextCheck=NextAcmeCheck(value.Id);
            cmd.CommandText="INSERT INTO panel_backup_state VALUES($acme,$acmeBody) ON CONFLICT(id) DO UPDATE SET body_cipher=excluded.body_cipher";cmd.Parameters.AddWithValue("$acmeBody",protector.Protect(Encode(updated)));cmd.ExecuteNonQuery();
            cmd.Parameters.RemoveAt("$acme");cmd.Parameters.RemoveAt("$acmeBody");
        }
        if(scheduleClaim!=null)
        {
            cmd.CommandText="SELECT body_cipher FROM panel_backup_state WHERE id=$schedule";cmd.Parameters.AddWithValue("$schedule","schedule:"+scheduleClaim.Id);
            var current=cmd.ExecuteScalar() is string body?Decode<PanelSchedule>(protector.Unprotect(body)):throw new OpsException("计划已移除。",409);
            if(!current.Enabled||current.Revision!=scheduleClaim.Revision||current.NextRun!=scheduleClaim.NextRun||current.NextRun>DateTimeOffset.UtcNow)throw new OpsException("计划已变更、未到期或已暂停。",409);
            current.LastOperationId=operation.Id;current.LastError="";current.NextRun=DateTimeOffset.UtcNow.AddHours(current.IntervalHours);
            cmd.CommandText="UPDATE panel_backup_state SET body_cipher=$scheduleBody WHERE id=$schedule";cmd.Parameters.AddWithValue("$scheduleBody",protector.Protect(Encode(current)));cmd.ExecuteNonQuery();
            cmd.Parameters.RemoveAt("$schedule");cmd.Parameters.RemoveAt("$scheduleBody");
        }
        if (expectedRevision != null)
        {
            // 版本比较和任务去重在同一 SQLite 写事务，禁止并发浏览器覆盖另一份网站配置。
            cmd.CommandText = "SELECT body_cipher FROM panel_resources WHERE id=$resource"; cmd.Parameters.AddWithValue("$resource", resource.Id);
            var current = cmd.ExecuteScalar() is string cipher ? Decode<PanelResource>(protector.Unprotect(cipher)) : throw new OpsException("插件实例不存在。", 404);
            if (current.ConfigRevision != expectedRevision) throw new OpsException("网站配置已经变化，请刷新并重新核对。", 409);
            cmd.Parameters.RemoveAt("$resource");
        }
        if (action == "Install")
        {
            cmd.CommandText = "INSERT INTO panel_resources(id,body_cipher) VALUES($resource,$cipher)";
            cmd.Parameters.AddWithValue("$resource", resource.Id); cmd.Parameters.AddWithValue("$cipher", protector.Protect(Encode(resource)));
            try { cmd.ExecuteNonQuery(); } catch (SqliteException error) when (error.SqliteErrorCode == 19) { throw new OpsException("该实例名称已登记；请选择现有实例或使用其它名称。", 409); }
        }
        else cmd.Parameters.AddWithValue("$resource", resource.Id);
        cmd.CommandText = "INSERT INTO panel_operations VALUES($id,$request,$resource,'Queued',$created,$fingerprint,$body)";
        cmd.Parameters.AddWithValue("$id", operation.Id); cmd.Parameters.AddWithValue("$created", operation.Created.ToString("O"));
        cmd.Parameters.AddWithValue("$fingerprint", fingerprint); cmd.Parameters.AddWithValue("$body", Encode(operation));
        try
        {
            cmd.ExecuteNonQuery();
            if (payload != null)
            {
                cmd.CommandText = "INSERT INTO panel_payloads VALUES($id,$payload)";
                cmd.Parameters.AddWithValue("$payload", protector.Protect(payload)); cmd.ExecuteNonQuery();
            }
            tx.Commit();
        }
        catch (SqliteException error) when (error.SqliteErrorCode == 19) { throw new OpsException("该实例有未完成操作，请先查看操作记录。", 409); }
        return operation;
    }
    public List<PanelOperation> Operations(bool active = false)
    {
        using var db = Open(); using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT body FROM panel_operations " + (active ? "WHERE state IN ('Queued','Running') ORDER BY created" : "ORDER BY created DESC LIMIT 100");
        using var rows = cmd.ExecuteReader(); var result = new List<PanelOperation>(); while (rows.Read()) result.Add(Decode<PanelOperation>(rows.GetString(0))); return result;
    }
    public PanelOperation Operation(string id)
    {
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT body FROM panel_operations WHERE id=$id"; cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteScalar() is string body ? Decode<PanelOperation>(body) : throw new OpsException("操作记录不存在。", 404);
    }
    public void SaveOperation(PanelOperation operation)
    {
        operation.Updated = DateTimeOffset.UtcNow;
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "UPDATE panel_operations SET state=$state,body=$body WHERE id=$id";
        cmd.Parameters.AddWithValue("$state", operation.State); cmd.Parameters.AddWithValue("$body", Encode(operation)); cmd.Parameters.AddWithValue("$id", operation.Id); cmd.ExecuteNonQuery();
    }
    public PanelOperation Retry(string id)
    {
        using var db = Open(); using var tx = db.BeginTransaction(); using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "SELECT body FROM panel_operations WHERE id=$id AND state='Failed'"; cmd.Parameters.AddWithValue("$id", id);
        if (cmd.ExecuteScalar() is not string body) throw new OpsException("仅失败任务可继续执行。", 409);
        var operation = Decode<PanelOperation>(body); operation.State = "Queued"; operation.Error = ""; operation.Phase = "等待继续执行"; operation.Updated = DateTimeOffset.UtcNow;
        cmd.CommandText = "UPDATE panel_operations SET state='Queued',body=$body WHERE id=$id"; cmd.Parameters.AddWithValue("$body", Encode(operation));
        try { cmd.ExecuteNonQuery(); tx.Commit(); } catch (SqliteException error) when (error.SqliteErrorCode == 19) { throw new OpsException("该实例已有活动任务。", 409); }
        return operation;
    }
}
