using System.Formats.Tar;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Microi.Panel;

public sealed record DockerCommandResult(int ExitCode, string Output);
public sealed record DockerArchiveFile(string Name, byte[] Content, bool Private = true);
public sealed record DockerPathStat(string Name, long Size, long Mode, DateTimeOffset Mtime, string LinkTarget)
{
    public bool IsDirectory => (Mode & (1L << 31)) != 0;
    public bool IsLink => (Mode & (1L << 27)) != 0 || !string.IsNullOrEmpty(LinkTarget);
}

public sealed partial class DockerEngine
{
    public async Task<DockerPathStat?> StatPath(string container, string path, CancellationToken ct)
    {
        await Negotiate(ct);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(15));
        using var response = await http.SendAsync(new HttpRequestMessage(HttpMethod.Head, prefix + "/containers/" + Uri.EscapeDataString(container) + "/archive?path=" + Uri.EscapeDataString(path)), deadline.Token);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return null;
        if (!response.IsSuccessStatusCode || !response.Headers.TryGetValues("X-Docker-Container-Path-Stat", out var values)) throw new OpsException("无法读取受管路径元数据。", 502);
        return JsonSerializer.Deserialize<DockerPathStat>(Convert.FromBase64String(values.Single()), JsonDefaults.Options) ?? throw new OpsException("Docker 路径元数据无效。", 502);
    }
    /// <summary>仅由可信面板代码构造参数数组；不会经过宿主 Shell，也不开放通用执行 HTTP 接口。</summary>
    public async Task<DockerCommandResult> Execute(string container, string[] command, CancellationToken ct, int timeoutSeconds = 30)
    {
        var created = await Json(HttpMethod.Post, "/containers/" + Uri.EscapeDataString(container) + "/exec", new JsonObject
        {
            ["AttachStdout"] = true, ["AttachStderr"] = true, ["Tty"] = false,
            ["Cmd"] = JsonSerializer.SerializeToNode(command)
        }, ct);
        var id = created?["Id"]?.ToString() ?? throw new OpsException("Docker 未返回执行编号。", 502);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
        using var request = Request(HttpMethod.Post, prefix + "/exec/" + id + "/start", new JsonObject { ["Detach"] = false, ["Tty"] = false });
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        if (!response.IsSuccessStatusCode) throw new OpsException("Docker 命令未能启动。", 502);
        var bytes = await ReadBounded(response.Content, 1024 * 1024, deadline.Token);
        var state = await Json(HttpMethod.Get, "/exec/" + id + "/json", ct: deadline.Token);
        if (state?["Running"]?.GetValue<bool>() != false) throw new OpsException("Docker 命令尚未结束，需回读后再继续。", 409);
        return new(state["ExitCode"]?.GetValue<int>() ?? -1, MultiplexedText(bytes));
    }
    /// <summary>写入受管容器的固定数据目录。Tar 不允许绝对路径、链接或向上遍历。</summary>
    public async Task PutFiles(string container, string directory, IReadOnlyList<DockerArchiveFile> files, CancellationToken ct)
    {
        using var archive = new MemoryStream();
        using (var writer = new TarWriter(archive, TarEntryFormat.Pax, leaveOpen: true))
        {
            var directories = new HashSet<string>(StringComparer.Ordinal);
            foreach (var file in files)
            {
                SafeArchivePath(file.Name);
                var pieces = file.Name.Split('/');
                for (var n = 1; n < pieces.Length; n++)
                {
                    var path = string.Join('/', pieces.Take(n));
                    if (directories.Add(path)) writer.WriteEntry(new PaxTarEntry(TarEntryType.Directory, path) { Mode = UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute | UnixFileMode.GroupRead | UnixFileMode.GroupExecute | UnixFileMode.OtherRead | UnixFileMode.OtherExecute });
                }
                using var data = new MemoryStream(file.Content, writable: false);
                writer.WriteEntry(new PaxTarEntry(TarEntryType.RegularFile, file.Name) { DataStream = data,
                    Mode = UnixFileMode.UserRead | UnixFileMode.UserWrite | (file.Private ? 0 : UnixFileMode.GroupRead | UnixFileMode.OtherRead) });
            }
        }
        if (archive.Length > 40L * 1024 * 1024) throw new OpsException("一次文件写入超过 40 MB，请拆分上传。", 413);
        archive.Position = 0; await Negotiate(ct);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(90));
        using var request = new HttpRequestMessage(HttpMethod.Put, prefix + "/containers/" + Uri.EscapeDataString(container) + "/archive?noOverwriteDirNonDir=true&path=" + Uri.EscapeDataString(directory));
        request.Content = new StreamContent(archive); request.Content.Headers.ContentType = new("application/x-tar");
        using var response = await http.SendAsync(request, deadline.Token);
        if (!response.IsSuccessStatusCode) throw new OpsException("受管文件写入失败，HTTP " + (int)response.StatusCode, 502);
    }
    public async Task<byte[]> ReadArchive(string container, string path, CancellationToken ct, int maxBytes = 32 * 1024 * 1024)
    {
        await Negotiate(ct);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(90));
        using var response = await http.GetAsync(prefix + "/containers/" + Uri.EscapeDataString(container) + "/archive?path=" + Uri.EscapeDataString(path), HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        if (!response.IsSuccessStatusCode) throw new OpsException("受管文件不存在或不可读取。", response.StatusCode == System.Net.HttpStatusCode.NotFound ? 404 : 502);
        return await ReadBounded(response.Content, maxBytes, deadline.Token);
    }
    public static void SafeArchivePath(string path)
    {
        if (path.Length is < 1 or > 512 || path.StartsWith('/') || path.Contains('\\') || path.Contains(':') || path.Any(char.IsControl)
            || path.Split('/').Any(x => x is "" or "." or "..")) throw new OpsException("文件路径必须位于受管目录中。");
    }
    /// <summary>Docker archive接口返回TAR容器而非文件正文；只接受一份指定普通文件。</summary>
    public static byte[] SingleArchiveFile(byte[] archive,string expectedName,int maximumBytes)
    {
        using var input=new MemoryStream(archive);using var reader=new TarReader(input);
        var entry=reader.GetNextEntry();
        if(entry==null||entry.Name!=expectedName||entry.EntryType is not (TarEntryType.RegularFile or TarEntryType.V7RegularFile)||entry.Length>maximumBytes||entry.DataStream==null)
            throw new OpsException("返回内容不是预期的普通文件，或已超过读取限额。");
        using var content=new MemoryStream();entry.DataStream.CopyTo(content);
        if(reader.GetNextEntry()!=null)throw new OpsException("文件归档包含额外条目，停止读取。");
        return content.ToArray();
    }
    private static async Task<byte[]> ReadBounded(HttpContent content, int maxBytes, CancellationToken ct)
    {
        if (content.Headers.ContentLength > maxBytes) throw new OpsException("Docker 返回数据超过读取限制。", 413);
        using var input = await content.ReadAsStreamAsync(ct); using var output = new MemoryStream(); var buffer = new byte[32768];
        while (await input.ReadAsync(buffer, ct) is var count && count > 0)
        {
            if (output.Length + count > maxBytes) throw new OpsException("Docker 返回数据超过读取限制。", 413);
            await output.WriteAsync(buffer.AsMemory(0, count), ct);
        }
        return output.ToArray();
    }
    private static string MultiplexedText(byte[] bytes)
    {
        using var output = new MemoryStream(); var index = 0;
        while (index + 8 <= bytes.Length && bytes[index] <= 2 && bytes[index + 1] == 0 && bytes[index + 2] == 0 && bytes[index + 3] == 0)
        {
            var length = System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(index + 4, 4));
            if (length < 0 || index + 8 + length > bytes.Length) throw new OpsException("Docker 输出帧不完整。", 502);
            output.Write(bytes, index + 8, length); index += length + 8;
        }
        return Encoding.UTF8.GetString(index == bytes.Length ? output.ToArray() : bytes);
    }
}
