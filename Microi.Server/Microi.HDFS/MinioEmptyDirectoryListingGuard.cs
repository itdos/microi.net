using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Linq;

namespace Microi.net
{
    /// <summary>
    /// MinIO 7 将缺失 Size 反序列化为 0，并可能静默结束缺少续页标记的列表。
    /// 空标记删除必须先核对有界原始 XML，不能用这些默认值推断零字节或完整。
    /// SDK 仍负责原签名、当前租户配置、桶和网络传输；这里不创建第二套凭据。
    /// </summary>
    internal sealed class MinioEmptyDirectoryListingGuard : HttpMessageHandler
    {
        private const int MaxPageBytes = 512 * 1024;
        private readonly HttpClient _inner;
        private readonly string _bucket;
        private readonly HashSet<string> _continuations = new HashSet<string>(StringComparer.Ordinal);
        private string _key;
        private int _pages;
        internal bool Complete { get; private set; }

        internal MinioEmptyDirectoryListingGuard(HttpClient inner, string bucket)
        { _inner = inner ?? throw new ArgumentNullException(nameof(inner)); _bucket = bucket; }

        internal void BeginSnapshot(string key)
        { _key = key; _pages = 0; Complete = false; _continuations.Clear(); }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            // HttpRequestMessage 不能被两个 HttpClient 重发；复制 SDK 已签名的同 URI/头。
            using var forwarded = new HttpRequestMessage(request.Method, request.RequestUri) { Version = request.Version };
            foreach (var header in request.Headers) forwarded.Headers.TryAddWithoutValidation(header.Key, header.Value);
            forwarded.Content = request.Content;
            var response = await _inner.SendAsync(forwarded, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
            if (request.Method != HttpMethod.Get || !IsPrefixList(request.RequestUri)) return response;
            try
            {
                if (response.StatusCode != HttpStatusCode.OK || response.Content == null || ++_pages > 64
                    || response.Content.Headers.ContentLength > MaxPageBytes)
                    throw new InvalidDataException("对象列表页不可完整核验。");
                using var input = await response.Content.ReadAsStreamAsync().ConfigureAwait(false);
                using var output = new MemoryStream();
                var buffer = new byte[8192];
                int length;
                while ((length = await input.ReadAsync(buffer, 0, buffer.Length, token).ConfigureAwait(false)) != 0)
                {
                    if (output.Length + length > MaxPageBytes) throw new InvalidDataException("对象列表页超过核验边界。");
                    output.Write(buffer, 0, length);
                }
                output.Position = 0;
                using var reader = XmlReader.Create(output, new XmlReaderSettings
                { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = MaxPageBytes });
                var root = XElement.Load(reader);
                var ns = (XNamespace)"http://s3.amazonaws.com/doc/2006-03-01/";
                var encoding = One(root, ns + "EncodingType");
                if (encoding != null && encoding != "url") throw new InvalidDataException("对象列表编码不可核验。");
                Func<string, string> decode = value => encoding == "url" && value != null ? Uri.UnescapeDataString(value) : value;
                if (root.Name != ns + "ListBucketResult" || One(root, ns + "Name") != _bucket
                    || decode(One(root, ns + "Prefix")) != _key || root.Elements(ns + "CommonPrefixes").Any())
                    throw new InvalidDataException("对象列表桶或前缀证据不一致。");
                var truncated = One(root, ns + "IsTruncated");
                if (truncated != "true" && truncated != "false") throw new InvalidDataException("分页状态缺失。");
                if (truncated == "true")
                {
                    var continuation = One(root, ns + "NextContinuationToken");
                    if (string.IsNullOrWhiteSpace(continuation) || !_continuations.Add(continuation))
                        throw new InvalidDataException("分页续页标记缺失或重复。");
                }
                foreach (var entry in root.Elements(ns + "Contents"))
                {
                    var key = decode(One(entry, ns + "Key"));
                    if (string.IsNullOrEmpty(key) || !key.StartsWith(_key, StringComparison.Ordinal)
                        || !long.TryParse(One(entry, ns + "Size"), NumberStyles.None, CultureInfo.InvariantCulture, out _))
                        throw new InvalidDataException("对象大小或键证据缺失。");
                }
                Complete = truncated == "false";
                var replacement = new ByteArrayContent(output.ToArray());
                foreach (var header in response.Content.Headers)
                    replacement.Headers.TryAddWithoutValidation(header.Key, header.Value);
                response.Content.Dispose();
                response.Content = replacement;
                return response;
            }
            catch { response.Dispose(); throw; }
        }

        private bool IsPrefixList(Uri uri)
        {
            if (uri == null) return false;
            var values = uri.Query.TrimStart('?').Split('&');
            var prefix = values.Where(x => x.StartsWith("prefix=", StringComparison.Ordinal)).ToArray();
            return prefix.Length == 1 && Uri.UnescapeDataString(prefix[0].Substring(7)) == _key;
        }

        private static string One(XElement parent, XName name)
        {
            var values = parent.Elements(name).ToArray();
            return values.Length == 1 ? values[0].Value : null;
        }
    }
}
