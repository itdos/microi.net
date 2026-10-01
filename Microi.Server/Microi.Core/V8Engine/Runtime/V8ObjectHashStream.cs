using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    // Hashes OSS/MinIO/S3 streams without retaining object bytes in V8 memory.
    // Older mci_ai_app_file rows hashed the Base64 wire text; new rows hash raw
    // bytes. Compute both in one pass so historical source can be verified.
    internal sealed class V8ObjectHashStream : Stream
    {
        private readonly IncrementalHash _raw = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        private readonly IncrementalHash _wire = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        private readonly byte[] _remainder = new byte[3];
        private int _remainderLength;
        private bool _completed;
        private long _length;

        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => !_completed;
        public override long Length => _length;
        public override long Position { get => _length; set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count)
        {
            if (_completed) throw new InvalidOperationException("对象摘要已经完成。");
            if (buffer == null) throw new ArgumentNullException(nameof(buffer));
            if (offset < 0 || count < 0 || offset > buffer.Length - count)
                throw new ArgumentOutOfRangeException(nameof(offset));
            if (count == 0) return;
            _raw.AppendData(buffer, offset, count);
            _length = checked(_length + count);

            if (_remainderLength > 0)
            {
                var take = Math.Min(3 - _remainderLength, count);
                Buffer.BlockCopy(buffer, offset, _remainder, _remainderLength, take);
                _remainderLength += take;
                offset += take;
                count -= take;
                if (_remainderLength == 3)
                {
                    AppendBase64(_remainder, 0, 3);
                    _remainderLength = 0;
                }
            }

            var completeBytes = count - count % 3;
            if (completeBytes > 0)
            {
                AppendBase64(buffer, offset, completeBytes);
                offset += completeBytes;
                count -= completeBytes;
            }
            if (count > 0)
            {
                Buffer.BlockCopy(buffer, offset, _remainder, 0, count);
                _remainderLength = count;
            }
        }

        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Write(buffer, offset, count);
            return Task.CompletedTask;
        }

        private void AppendBase64(byte[] buffer, int offset, int count)
        {
            var encoded = Encoding.ASCII.GetBytes(Convert.ToBase64String(buffer, offset, count));
            _wire.AppendData(encoded);
        }

        public (string Sha256, string WireSha256, long Size) Complete()
        {
            if (_completed) throw new InvalidOperationException("对象摘要已经完成。");
            if (_remainderLength > 0) AppendBase64(_remainder, 0, _remainderLength);
            _completed = true;
            return (BitConverter.ToString(_raw.GetHashAndReset()).Replace("-", "").ToLowerInvariant(),
                BitConverter.ToString(_wire.GetHashAndReset()).Replace("-", "").ToLowerInvariant(), _length);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _raw.Dispose();
                _wire.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
