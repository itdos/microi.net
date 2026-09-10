using System.Net;

namespace Microi.Panel;

public sealed partial class DockerEngine
{
    /// <summary>数据库备份直接流入受限文件流，不把整个数据卷装入内存。</summary>
    public async Task WithArchive(string container, string path, Func<Stream,CancellationToken,Task> read, long maximumBytes, CancellationToken ct)
    {
        await Negotiate(ct);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromMinutes(60));
        using var response = await http.GetAsync(prefix + "/containers/" + Uri.EscapeDataString(container) + "/archive?path=" + Uri.EscapeDataString(path), HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        if (!response.IsSuccessStatusCode) throw new OpsException("数据卷归档不可读取。", response.StatusCode == HttpStatusCode.NotFound ? 404 : 502);
        if (response.Content.Headers.ContentLength > maximumBytes) throw new OpsException("归档超过本次容量上限。", 413);
        await using var source = await response.Content.ReadAsStreamAsync(deadline.Token);
        using var bounded = new BoundedArchiveStream(source, maximumBytes);
        await read(bounded, deadline.Token);
    }
    public async Task PutArchive(string container, string path, Stream source, CancellationToken ct)
    {
        await Negotiate(ct);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromMinutes(60));
        using var request = new HttpRequestMessage(HttpMethod.Put, prefix + "/containers/" + Uri.EscapeDataString(container) + "/archive?noOverwriteDirNonDir=true&path=" + Uri.EscapeDataString(path));
        request.Content = new StreamContent(source); request.Content.Headers.ContentType = new("application/x-tar");
        using var response = await http.SendAsync(request, deadline.Token);
        if (!response.IsSuccessStatusCode) throw new OpsException("归档未能完整写入新的恢复数据卷。", 502);
    }
}

/// <summary>同时约束同步 TarReader 与异步复制，限制包含 TAR 头在内的全部读取字节。</summary>
internal sealed class BoundedArchiveStream(Stream source, long maximumBytes) : Stream
{
    private long count;
    private int Track(int read) { count += read; if (count > maximumBytes) throw new OpsException("归档超过本次容量上限。", 413); return read; }
    public override int Read(byte[] buffer, int offset, int length) => Track(source.Read(buffer, offset, length));
    public override int Read(Span<byte> buffer) => Track(source.Read(buffer));
    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) => Track(await source.ReadAsync(buffer, cancellationToken));
    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => count; set => throw new NotSupportedException(); }
    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int length) => throw new NotSupportedException();
}
