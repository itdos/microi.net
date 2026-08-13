using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// Presents exactly one multipart window over a non-seekable source without
    /// owning it.  Object-store SDKs may use either synchronous or asynchronous
    /// reads; both paths honor the same cancellation token and byte boundary.
    /// </summary>
    internal sealed class BoundedReadStream : Stream
    {
        private readonly Stream _source;
        private readonly long _length;
        private readonly CancellationToken _cancellationToken;
        private long _position;

        public BoundedReadStream(Stream source, long length, CancellationToken cancellationToken)
        {
            _source = source ?? throw new ArgumentNullException(nameof(source));
            if (!source.CanRead) throw new ArgumentException("源流不可读。", nameof(source));
            if (length < 0) throw new ArgumentOutOfRangeException(nameof(length));
            _length = length;
            _cancellationToken = cancellationToken;
        }

        public long BytesRead => _position;
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => _length;
        public override long Position
        {
            get => _position;
            set => throw new NotSupportedException();
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            _cancellationToken.ThrowIfCancellationRequested();
            if (_position >= _length) return 0;
            count = (int)Math.Min(count, _length - _position);
            var read = _source.Read(buffer, offset, count);
            _position += read;
            return read;
        }

        public override async Task<int> ReadAsync(
            byte[] buffer,
            int offset,
            int count,
            CancellationToken cancellationToken)
        {
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(
                _cancellationToken,
                cancellationToken);
            linked.Token.ThrowIfCancellationRequested();
            if (_position >= _length) return 0;
            count = (int)Math.Min(count, _length - _position);
            var read = await _source.ReadAsync(buffer, offset, count, linked.Token).ConfigureAwait(false);
            _position += read;
            return read;
        }

        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        protected override void Dispose(bool disposing)
        {
            // The caller owns the concatenated source stream.
            base.Dispose(disposing);
        }
    }
}
