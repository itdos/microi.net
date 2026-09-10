using System.Formats.Tar;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Microi.Panel.Panel;

public sealed class PanelFileRequest
{
    public string RequestId { get; set; } = "";
    public string SiteId { get; set; } = "";
    public string Path { get; set; } = "";
    public string Action { get; set; } = "Write";
    public string ContentBase64 { get; set; } = "";
    public string ExpectedHash { get; set; } = "";
    public string Confirm { get; set; } = "";
    public string SourceOperationId { get; set; } = "";
}
public sealed record PanelFileEntry(string Name, string Path, bool Directory, bool Link, long Size, DateTimeOffset Modified);

/// <summary>文件能力固定约束在登记网站根目录，不接受宿主路径；写入与 Nginx 发布共享持久任务互斥。</summary>
public sealed class PanelFiles(PanelRepository repository, DockerEngine docker, NginxService nginx)
{
    public const int MaximumBytes = 20 * 1024 * 1024;
    public static string SafePath(string path, bool allowRoot = false)
    {
        if (path == null || path.Length > 1024) throw new OpsException("文件路径不能为空或超过 1024 字符。");
        if (path == "" && allowRoot) return path;
        DockerEngine.SafeArchivePath(path);
        if (path.Split('/').Any(x => x.StartsWith(".mci-panel-", StringComparison.Ordinal))) throw new OpsException("不能访问面板内部暂存文件。");
        return path;
    }
    public static byte[] DecodeContent(string value)
    {
        if (value == null || value.Length > 28 * 1024 * 1024) throw new OpsException("单个文件不能超过 20 MiB。", 413);
        byte[] bytes; try { bytes = Convert.FromBase64String(value); } catch (FormatException) { throw new OpsException("上传内容不是有效 Base64。"); }
        if (bytes.Length > MaximumBytes) throw new OpsException("单个文件不能超过 20 MiB。", 413);
        return bytes;
    }
    private PanelResource Site(string resourceId, string site)
    {
        PanelCatalog.SafeName(site); var resource = nginx.Resource(resourceId);
        if (!resource.Websites.Sites.Any(x => x.Id == site)) throw new OpsException("网站未登记或尚未发布。", 404);
        return resource;
    }
    private static string Root(string site) => NginxConfig.Root + "/sites/" + PanelCatalog.SafeName(site);
    private async Task Owned(PanelResource resource, CancellationToken ct)
    {
        var actual = await docker.Inspect(resource.ContainerId, ct) ?? throw new OpsException("网站容器不存在。", 404);
        PanelDockerConfig.AssertOwned(actual, resource);
        if (actual["State"]?["Running"]?.GetValue<bool>() != true) throw new OpsException("文件管理需要先启动此 Nginx 实例。", 409);
    }
    private async Task<DockerPathStat?> PathStat(PanelResource resource, string site, string path, CancellationToken ct)
    {
        await Owned(resource, ct); SafePath(path, allowRoot:true);
        var parts = ("sites/" + site + (path.Length == 0 ? "" : "/" + path)).Split('/');
        DockerPathStat? stat = null; var absolute = NginxConfig.Root;
        foreach (var part in parts)
        {
            absolute += "/" + part; stat = await docker.StatPath(resource.ContainerId, absolute, ct);
            if (stat == null) return null;
            if (stat.IsLink) throw new OpsException("为避免越界，文件管理不跟随符号链接。");
            if (absolute != Root(site) + (path.Length == 0 ? "" : "/" + path) && !stat.IsDirectory) throw new OpsException("路径的父级不是目录。");
        }
        return stat;
    }
    public async Task<object> List(string resourceId, string site, string path, CancellationToken ct)
    {
        var resource = Site(resourceId, site); var stat = await PathStat(resource, site, path, ct);
        if (stat == null) return new { entries = Array.Empty<PanelFileEntry>(), total = 0, path };
        if (!stat.IsDirectory) throw new OpsException("请选择目录。");
        var directory = Root(site) + (path.Length == 0 ? "" : "/" + path);
        var result = await docker.Execute(resource.ContainerId, ["find", directory, "-mindepth", "1", "-maxdepth", "1", "-print0"], ct);
        if (result.ExitCode != 0) throw new OpsException("网站目录不可读取。", 502);
        var names = result.Output.Split('\0', StringSplitOptions.RemoveEmptyEntries).Select(x => x.StartsWith(directory + "/", StringComparison.Ordinal) ? x[(directory.Length + 1)..] : throw new OpsException("目录返回了越界路径。", 502))
            .Where(x => !x.StartsWith(".mci-panel-", StringComparison.Ordinal) && !x.Any(char.IsControl)).Order(StringComparer.Ordinal).ToArray();
        // 目录元数据读取设并发上限；大目录提示截断而不是无上限生成页面。
        using var limit = new SemaphoreSlim(4);
        var entries = await Task.WhenAll(names.Take(200).Select(async name =>
        {
            await limit.WaitAsync(ct);
            try
            {
                var item = await docker.StatPath(resource.ContainerId, directory + "/" + name, ct);
                return item == null ? null : new PanelFileEntry(name, path.Length == 0 ? name : path + "/" + name, item.IsDirectory, item.IsLink, item.Size, item.Mtime);
            }
            finally { limit.Release(); }
        }));
        return new { entries = entries.Where(x => x != null).OrderByDescending(x => x!.Directory).ThenBy(x => x!.Name, StringComparer.Ordinal), total = names.Length, path };
    }
    public async Task<byte[]> Read(string resourceId, string site, string path, CancellationToken ct)
    {
        var resource = Site(resourceId, site); var stat = await PathStat(resource, site, SafePath(path), ct) ?? throw new OpsException("文件不存在。", 404);
        if (stat.IsDirectory || stat.Size > MaximumBytes) throw new OpsException("请选择不超过 20 MiB 的普通文件。", 413);
        return await ReadBytes(resource, Root(site) + "/" + path, ct);
    }
    private async Task<byte[]> ReadBytes(PanelResource resource, string absolute, CancellationToken ct)
    {
        var bytes = await docker.ReadArchive(resource.ContainerId, absolute, ct, MaximumBytes + 1024 * 1024);
        using var stream = new MemoryStream(bytes); using var reader = new TarReader(stream);
        var entry = reader.GetNextEntry();
        if (entry == null || entry.EntryType is not (TarEntryType.RegularFile or TarEntryType.V7RegularFile) || entry.Length > MaximumBytes || entry.DataStream == null)
            throw new OpsException("不能读取链接、目录或特殊文件。");
        using var output = new MemoryStream(); await entry.DataStream.CopyToAsync(output, ct); return output.ToArray();
    }
    public PanelOperation Enqueue(string resourceId, PanelFileRequest request, string actor)
    {
        if (request.ExpectedHash == null || request.ContentBase64 == null || request.SourceOperationId == null) throw new OpsException("文件版本、内容及历史版本参数不能为 null。");
        var resource = Site(resourceId, request.SiteId); SafePath(request.Path);
        if (request.Confirm != request.Path || request.Action is not ("Write" or "Mkdir" or "Trash" or "Restore")) throw new OpsException("请确认文件路径与操作。");
        if (request.ExpectedHash.Length > 0 && !Regex.IsMatch(request.ExpectedHash, "^[a-f0-9]{64}$")) throw new OpsException("文件版本标识无效。");
        if (request.Action == "Write") _ = DecodeContent(request.ContentBase64);
        else if (request.ContentBase64.Length != 0) throw new OpsException("此操作不接收文件内容。");
        if (request.Action == "Restore") _ = HistorySource(resourceId, request);
        return repository.Enqueue("File" + request.Action, request.RequestId, resource, actor, JsonSerializer.Serialize(request, JsonDefaults.Options));
    }
    private PanelFileRequest HistorySource(string resourceId, PanelFileRequest request)
    {
        if (!Guid.TryParseExact(request.SourceOperationId, "N", out _)) throw new OpsException("历史版本编号无效。");
        var source = repository.Operation(request.SourceOperationId);
        if (source.ResourceId != resourceId || source.Action is not ("FileWrite" or "FileTrash" or "FileRestore")) throw new OpsException("历史版本不属于该网站实例。", 403);
        var saved = repository.Payload<PanelFileRequest>(source.Id);
        if (saved.SiteId != request.SiteId || saved.Path != request.Path) throw new OpsException("历史版本与待恢复文件不匹配。", 409);
        return saved;
    }
    public async Task<object> History(string resourceId, string site, CancellationToken ct)
    {
        var resource = Site(resourceId, site); await Owned(resource, ct); var result = new List<object>();
        foreach (var operation in repository.Operations().Where(x => x.ResourceId == resourceId && x.Action is "FileWrite" or "FileTrash" or "FileRestore"))
        {
            var source = repository.Payload<PanelFileRequest>(operation.Id); if (source.SiteId != site) continue;
            var stat = await docker.StatPath(resource.ContainerId, NginxConfig.Root + "/history/" + site + "/" + operation.Id + "/original", ct);
            if (stat != null && !stat.IsDirectory && !stat.IsLink) result.Add(new { operationId = operation.Id, source.Path, size = stat.Size, operation.Created, operation.Actor });
        }
        return result;
    }
    public async Task Execute(PanelResource resource, PanelOperation operation, CancellationToken ct)
    {
        var request = repository.Payload<PanelFileRequest>(operation.Id); _ = Site(resource.Id, request.SiteId); SafePath(request.Path);
        var destination = Root(request.SiteId) + "/" + request.Path;
        var existing = await PathStat(resource, request.SiteId, request.Path, ct);
        if (request.Action == "Mkdir")
        {
            if (existing != null && !existing.IsDirectory) throw new OpsException("同名文件已经存在。", 409);
            await Run(resource, ["mkdir", "-p", destination], ct);
            if ((await PathStat(resource, request.SiteId, request.Path, ct))?.IsDirectory != true) throw new OpsException("目录创建后回读失败。", 502);
            return;
        }
        var backup = "history/" + request.SiteId + "/" + operation.Id + "/original";
        if (request.Action == "Trash" && existing == null)
        {
            if (await docker.StatPath(resource.ContainerId, NginxConfig.Root + "/" + backup, ct) != null) return;
            throw new OpsException("文件不存在，不能确认移除是否完成。", 409);
        }
        if (existing?.IsDirectory == true) throw new OpsException("当前操作仅用于文件；目录内容须逐项核对。");
        if (request.Action == "Restore") _ = HistorySource(resource.Id, request);
        var next = request.Action == "Write" ? DecodeContent(request.ContentBase64) : request.Action == "Restore"
            ? await ReadBytes(resource, NginxConfig.Root + "/history/" + request.SiteId + "/" + request.SourceOperationId + "/original", ct) : [];
        var current = existing == null ? null : await ReadBytes(resource, destination, ct);
        if (request.Action is "Write" or "Restore" && current != null && Hash(current) == Hash(next)) return; // 已写入但响应丢失的恢复。
        if (current != null && (request.ExpectedHash.Length == 0 || Hash(current) != request.ExpectedHash)) throw new OpsException("文件已存在或内容已经变化，请重新读取后再操作。", 409);
        if (current == null && request.ExpectedHash.Length > 0) throw new OpsException("原文件已被移除，请重新核对。", 409);
        operation.Phase = "保存原文件与执行受管文件操作"; repository.SaveOperation(operation);
        if (current != null && await docker.StatPath(resource.ContainerId, NginxConfig.Root + "/" + backup, ct) == null)
            await docker.PutFiles(resource.ContainerId, NginxConfig.Root, [new(backup, current)], ct);
        if (request.Action == "Trash")
        {
            await Run(resource, ["rm", "--", destination], ct); // 仅删除已校验哈希且已保存历史副本的单一文件，禁止递归删除。
            if (await PathStat(resource, request.SiteId, request.Path, ct) != null) throw new OpsException("文件移除后仍存在。", 502);
            return;
        }
        var staging = "sites/" + request.SiteId + "/.mci-panel-" + operation.Id;
        await docker.PutFiles(resource.ContainerId, NginxConfig.Root, [new(staging, next, Private:false)], ct);
        await Run(resource, ["mkdir", "-p", destination[..destination.LastIndexOf('/')]], ct);
        await Run(resource, ["mv", "-f", NginxConfig.Root + "/" + staging, destination], ct);
        await Run(resource, ["sync"], ct);
        if (Hash(await ReadBytes(resource, destination, ct)) != Hash(next)) throw new OpsException("文件内容写入后校验失败。", 502);
    }
    private async Task Run(PanelResource resource, string[] args, CancellationToken ct)
    {
        await Owned(resource, ct); var result = await docker.Execute(resource.ContainerId, args, ct);
        if (result.ExitCode != 0) throw new OpsException("受管文件操作失败：" + Redaction.Clean(result.Output, 1000), 502);
    }
    public static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
}
