using Microsoft.AspNetCore.DataProtection;

namespace Microi.Panel.Panel;

public sealed class PanelBackup
{
    public string Id { get; set; } = "";
    public PanelResource Resource { get; set; } = new();
    public bool WasRunning { get; set; }
    public string State { get; set; } = "Preparing";
    public long Size { get; set; }
    public string Sha256 { get; set; } = "";
    public string ContentHash { get; set; } = "";
    public string[] ExcludedRuntimeEntries { get; set; } = [];
    public DateTimeOffset Created { get; set; } = DateTimeOffset.UtcNow;
    public object Public() => new { Id, ResourceId = Resource.Id, PluginId = Resource.PluginId, Resource.Version, WasRunning, State, Size, Sha256, ContentHash, Created, ExcludedRuntimeEntries };
}
public sealed class PanelRestoreState
{
    public string Id { get; set; } = "";
    public string BackupId { get; set; } = "";
    public PanelResource Original { get; set; } = new();
    public PanelResource Target { get; set; } = new();
    public bool WasRunning { get; set; }
    public int Attempt { get; set; }
    public string Stage { get; set; } = "Preparing";
    public string Helper { get; set; } = "";
    public string PreservedName { get; set; } = "";
}
public sealed partial class PanelRepository
{
    // 单独的加密检查点保留恢复进度，不能改写用于请求去重的原始 payload。
    public T? BackupState<T>(string key)
    {
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT body_cipher FROM panel_backup_state WHERE id=$id"; cmd.Parameters.AddWithValue("$id",key);
        return cmd.ExecuteScalar() is string body ? Decode<T>(protector.Unprotect(body)) : default;
    }
    public void SaveBackupState<T>(string key, T value)
    {
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "INSERT INTO panel_backup_state VALUES($id,$body) ON CONFLICT(id) DO UPDATE SET body_cipher=excluded.body_cipher";
        cmd.Parameters.AddWithValue("$id",key); cmd.Parameters.AddWithValue("$body",protector.Protect(Encode(value))); cmd.ExecuteNonQuery();
    }
    public List<PanelBackup> Backups()
    {
        using var db = Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT body_cipher FROM panel_backup_state WHERE id LIKE 'backup:%' ORDER BY id";
        using var rows = cmd.ExecuteReader(); var result = new List<PanelBackup>(); while (rows.Read()) result.Add(Decode<PanelBackup>(protector.Unprotect(rows.GetString(0))));
        return result.Where(x=>x.State!="Deleted").OrderByDescending(x => x.Created).ToList();
    }
}
