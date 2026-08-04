using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 通用 OCR 请求。网络地址、认证头和超时不属于调用参数，统一由当前租户的
    /// SaaS 引擎配置在服务端解析，避免 API/V8 调用方把 OCR 网关变成任意 HTTP 代理。
    /// </summary>
    public sealed class MicroiOcrRecognizeParam : BaseParam
    {
        public string FileByteBase64 { get; set; }
        public string FileName { get; set; }
        public bool? UseDocOrientationClassify { get; set; }
        public bool? UseDocUnwarping { get; set; }
        public bool? UseTextlineOrientation { get; set; }
        public decimal? TextRecScoreThresh { get; set; }
        public bool? ReturnWordBox { get; set; }
    }

    public sealed class MicroiOcrRegion
    {
        public string Text { get; set; }
        public decimal Confidence { get; set; }
        public List<List<decimal>> Polygon { get; set; } = new List<List<decimal>>();
    }

    public sealed class MicroiOcrPage
    {
        public int PageIndex { get; set; }
        public string Text { get; set; }
        public decimal AverageConfidence { get; set; }
        public List<MicroiOcrRegion> Regions { get; set; } = new List<MicroiOcrRegion>();
    }

    public sealed class MicroiOcrRecognizeResult
    {
        public string Provider { get; set; }
        public string TraceId { get; set; }
        public string FileName { get; set; }
        public string FileType { get; set; }
        public string Text { get; set; }
        public decimal AverageConfidence { get; set; }
        public int PageCount { get; set; }
        public long ElapsedMilliseconds { get; set; }
        public List<MicroiOcrPage> Pages { get; set; } = new List<MicroiOcrPage>();
    }

    /// <summary>
    /// .NET 宿主的通用 OCR 能力。实现必须把租户配置与请求参数分离，并对输入、
    /// 响应和执行时长设置服务端硬上限。
    /// </summary>
    public interface IMicroiOcr
    {
        Task<DosResult<MicroiOcrRecognizeResult>> RecognizeAsync(
            MicroiOcrRecognizeParam param,
            CancellationToken cancellationToken = default(CancellationToken));
    }

    /// <summary>
    /// V8.OCR 的租户绑定能力面。实现不得允许脚本覆盖 OsClient、Endpoint 或认证信息。
    /// </summary>
    public interface IV8Ocr
    {
        Task<DosResult<MicroiOcrRecognizeResult>> Recognize(MicroiOcrRecognizeParam param);
    }
}
