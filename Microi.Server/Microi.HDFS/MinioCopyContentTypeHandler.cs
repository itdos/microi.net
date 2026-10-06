using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 修复 MinIO SDK 7 的复制传输：带参数的源 MIME 已被签名，但构造请求时
    /// StringContent 的默认 MIME 没有移除。只还原精确的已签名值，不重签或降级鉴权。
    /// 此 Handler 仅用于 CopyObject 的专属客户端，普通上传和对象读取不受影响。
    /// </summary>
    internal sealed class MinioCopyContentTypeHandler : DelegatingHandler
    {
        internal MinioCopyContentTypeHandler(HttpMessageHandler transport) : base(transport) { }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            if (request.Content?.Headers.TryGetValues("Content-Type", out var types) == true)
            {
                var values = types.ToArray();
                if (values.Length > 1)
                {
                    var authorization = request.Headers.TryGetValues("Authorization", out var auth)
                        ? string.Join(",", auth) : string.Empty;
                    var signed = authorization.Split(',')
                        .Select(part => part.Trim())
                        .FirstOrDefault(part => part.StartsWith("SignedHeaders=", StringComparison.Ordinal));
                    // 只接受已复现的两个值形态；未知重复头在发出请求前失败关闭。
                    // 保留第二项原始字符串，避免 Parse/ToString 改写签名使用的参数格式。
                    if (values.Length != 2 || values[0] != "text/plain; charset=utf-8"
                        || !authorization.StartsWith("AWS4-HMAC-SHA256 ", StringComparison.Ordinal)
                        || signed == null || !signed.Substring("SignedHeaders=".Length).Split(';').Contains("content-type")
                        || !MediaTypeHeaderValue.TryParse(values[1], out _))
                        throw new InvalidOperationException("MinIO 复制请求存在无法确认的重复 Content-Type，已停止发送。");

                    request.Content.Headers.Remove("Content-Type");
                    request.Content.Headers.TryAddWithoutValidation("Content-Type", values[1]);
                }
            }
            return base.SendAsync(request, token);
        }
    }
}
