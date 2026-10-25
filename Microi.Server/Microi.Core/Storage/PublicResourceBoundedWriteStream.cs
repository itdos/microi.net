using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>源响应不得超过权威大小；保留底层流由调用者关闭，避免异常正文填满临时磁盘。</summary>
    internal sealed class PublicResourceBoundedWriteStream : Stream
    {
        private readonly Stream target;
        private readonly long limit;
        private long written;
        internal PublicResourceBoundedWriteStream(Stream target, long limit)
        { this.target = target; this.limit = limit > 0 ? limit : throw new ArgumentOutOfRangeException(nameof(limit)); }
        private void Check(int count) { if (count < 0 || written > limit - count) throw new InvalidOperationException("SourceSizeLimitExceeded"); }
        public override void Write(byte[] buffer, int offset, int count)
        { Check(count); target.Write(buffer, offset, count); written += count; }
        public override async Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken token)
        { Check(count); await target.WriteAsync(buffer, offset, count, token).ConfigureAwait(false); written += count; }
        public override bool CanRead => false; public override bool CanSeek => false; public override bool CanWrite => true;
        public override long Length => written;
        public override long Position { get => written; set => throw new NotSupportedException(); }
        public override void Flush() => target.Flush();
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
    }
}
