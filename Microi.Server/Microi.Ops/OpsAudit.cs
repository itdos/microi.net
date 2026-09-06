using System.Text.Json;
using System.Text.RegularExpressions;

namespace Microi.Ops;

public static partial class Redaction
{
    [GeneratedRegex("(?i)(password|pwd|secret|token|authorization|cookie|connectionstring|accountkey|accesskey)([\\\"'\\s:=]+)([^\\s,;\\\"}]+)")]
    private static partial Regex Secrets();
    [GeneratedRegex("(?i)(\"(?:password|pwd|secret|token|authorization|cookie|connectionstring|accountkey|accesskey)\"\\s*:\\s*)\"(?:\\\\.|[^\"\\\\])*\"")]
    private static partial Regex JsonSecrets();
    [GeneratedRegex("(?i)(authorization\\s*[:=]\\s*)(?:bearer\\s+)?[^\\r\\n,;]+")]
    private static partial Regex Authorization();
    [GeneratedRegex("(?i)(https?://)[^/@\\s]+:[^/@\\s]+@")]
    private static partial Regex UserInfo();
    public static string Clean(string? text, int max = 4000)
    {
        var quoted = JsonSecrets().Replace(text ?? "", "$1\"<redacted>\"");
        var result = UserInfo().Replace(Secrets().Replace(Authorization().Replace(quoted, "$1<redacted>"), "$1$2<redacted>"), "$1<redacted>@");
        return result[..Math.Min(result.Length, max)];
    }
}

public sealed class OpsAudit(OpsStore store, OpsOptions options)
{
    private readonly object fileGate = new();
    public string LastFileError { get; private set; } = "";
    public void Write(string action, string actor, string message, bool success = true, string taskId = "")
    {
        var entry = new OpsEvent { DeploymentId = options.Deployment.Id, Action = action, Actor = actor, Message = Redaction.Clean(message), Success = success, TaskId = taskId };
        // 先提交独立数据库；TXT 为可轮转镜像，平台投递使用持久 outbox。
        store.AddEvent(entry, PlatformConnection.Binding(options.Deployment.PlatformApiBase, options.Deployment.PlatformOsClient));
        lock (fileGate)
        {
            try
            {
            Directory.CreateDirectory(options.LogDir);
            var day = DateTime.UtcNow.ToString("yyyyMMdd"); var number = 0;
            string path;
            do { path = Path.Combine(options.LogDir, $"microi-ops-{day}-{number++:D3}.txt"); } while (File.Exists(path) && new FileInfo(path).Length >= 10 * 1024 * 1024);
            File.AppendAllText(path, JsonSerializer.Serialize(entry, JsonDefaults.Options) + Environment.NewLine);
            foreach (var old in Directory.EnumerateFiles(options.LogDir, "microi-ops-*.txt"))
                if (File.GetLastWriteTimeUtc(old) < DateTime.UtcNow.AddDays(-options.LogRetentionDays)) File.Delete(old);
                LastFileError = "";
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                // SQLite 已持久化，TXT 镜像失败不能把完成的容器切换误报为失败并触发回退。
                LastFileError = "TXT 日志暂不可写，请检查日志目录权限和空间；事件已保存在 Ops 持久库。";
            }
        }
    }
}
