using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 单帧视觉特征提取参数。模型文件、模型路径和执行提供程序不属于调用参数；
    /// V8 只能选择宿主已经安装并通过完整性校验的 ModelKey。
    /// </summary>
    public class MicroiVisionExtractParam : BaseParam
    {
        public string FileByteBase64 { get; set; }
        public string FileName { get; set; }
        public string ModelKey { get; set; }
        public string Mode { get; set; }
        public string FrameId { get; set; }
    }

    public sealed class MicroiVisionFrameBatchParam : BaseParam
    {
        public string ModelKey { get; set; }
        public string Mode { get; set; }
        public List<MicroiVisionExtractParam> Frames { get; set; } = new List<MicroiVisionExtractParam>();
    }

    public sealed class MicroiVisionBox
    {
        /// <summary>归一化横坐标，范围 0..1。</summary>
        public decimal X { get; set; }
        /// <summary>归一化纵坐标，范围 0..1。</summary>
        public decimal Y { get; set; }
        /// <summary>归一化宽度，范围 0..1。</summary>
        public decimal Width { get; set; }
        /// <summary>归一化高度，范围 0..1。</summary>
        public decimal Height { get; set; }
    }

    public sealed class MicroiVisionPoint
    {
        /// <summary>归一化横坐标，范围 0..1。</summary>
        public decimal X { get; set; }
        /// <summary>归一化纵坐标，范围 0..1。</summary>
        public decimal Y { get; set; }
    }

    public sealed class MicroiVisionDetection
    {
        public int Index { get; set; }
        public int ClassId { get; set; }
        public string TrackId { get; set; }
        public string Label { get; set; }
        public decimal Confidence { get; set; }
        public MicroiVisionBox Box { get; set; }
        /// <summary>人脸五点或检测模型输出的其它关键点；坐标均按原图归一化。</summary>
        public List<MicroiVisionPoint> Landmarks { get; set; } = new List<MicroiVisionPoint>();
        /// <summary>
        /// 可选二值分割掩码的行程编码。格式为从左上角开始、按行展开的交替零/一游程长度，
        /// 避免向 V8 返回庞大的逐像素数组。
        /// </summary>
        public List<int> MaskRle { get; set; } = new List<int>();
        public int MaskWidth { get; set; }
        public int MaskHeight { get; set; }
        public string EmbeddingBase64 { get; set; }
        public int EmbeddingDimensions { get; set; }
    }

    /// <summary>
    /// 完整视觉流水线参数。PipelineKey 只能选择宿主已安装、带 SHA 与许可证元数据的模型包；
    /// 调用方不能传模型路径或执行提供程序。
    /// </summary>
    public sealed class MicroiVisionAnalyzeParam : MicroiVisionExtractParam
    {
        public string PipelineKey { get; set; }
        /// <summary>
        /// 浏览器逐帧 HTTP 调用时的短期视频会话标识。宿主会与 OsClient 共同隔离，
        /// 仅用于有界 IoU 跟踪，不作为业务身份或持久化键。
        /// </summary>
        public string StreamSessionId { get; set; }
        public long? FrameSequence { get; set; }
        public bool ResetStream { get; set; }
        public decimal? DetectionThreshold { get; set; }
        public decimal? NmsThreshold { get; set; }
        public int? MaximumDetections { get; set; }
    }

    public sealed class MicroiVisionAnalyzeResult
    {
        public string TraceId { get; set; }
        public string FrameId { get; set; }
        public string StreamSessionId { get; set; }
        public long FrameSequence { get; set; }
        public string PipelineKey { get; set; }
        public string PipelineVersion { get; set; }
        public string Provider { get; set; }
        public string Mode { get; set; }
        public string EmbeddingFormat { get; set; }
        public int ImageWidth { get; set; }
        public int ImageHeight { get; set; }
        public decimal QualityScore { get; set; }
        public long DetectionMilliseconds { get; set; }
        public long EmbeddingMilliseconds { get; set; }
        public long ElapsedMilliseconds { get; set; }
        public List<MicroiVisionDetection> Detections { get; set; } = new List<MicroiVisionDetection>();
        public List<string> Warnings { get; set; } = new List<string>();
    }

    public sealed class MicroiVisionExtractResult
    {
        public string TraceId { get; set; }
        public string FrameId { get; set; }
        public string Provider { get; set; }
        public string ModelKey { get; set; }
        public string ModelVersion { get; set; }
        public string TaskType { get; set; }
        public string Mode { get; set; }
        public int ImageWidth { get; set; }
        public int ImageHeight { get; set; }
        public string EmbeddingFormat { get; set; }
        public string EmbeddingBase64 { get; set; }
        public int EmbeddingDimensions { get; set; }
        public decimal QualityScore { get; set; }
        public long ElapsedMilliseconds { get; set; }
        public List<MicroiVisionDetection> Detections { get; set; } = new List<MicroiVisionDetection>();
        public List<string> Warnings { get; set; } = new List<string>();
    }

    public sealed class MicroiVisionFrameBatchResult
    {
        public string ModelKey { get; set; }
        public int AcceptedFrameCount { get; set; }
        public long ElapsedMilliseconds { get; set; }
        public List<MicroiVisionExtractResult> Frames { get; set; } = new List<MicroiVisionExtractResult>();
    }

    public sealed class MicroiVisionCompareParam : BaseParam
    {
        public string LeftEmbeddingBase64 { get; set; }
        public string RightEmbeddingBase64 { get; set; }
        public decimal? Threshold { get; set; }
    }

    public sealed class MicroiVisionCandidate
    {
        public string Key { get; set; }
        public string Name { get; set; }
        public string EmbeddingBase64 { get; set; }
    }

    public sealed class MicroiVisionCompareBatchParam : BaseParam
    {
        public string QueryEmbeddingBase64 { get; set; }
        public List<MicroiVisionCandidate> Candidates { get; set; } = new List<MicroiVisionCandidate>();
        public decimal? Threshold { get; set; }
        public int? TopK { get; set; }
    }

    public sealed class MicroiVisionMatch
    {
        public string Key { get; set; }
        public string Name { get; set; }
        public decimal Similarity { get; set; }
        public bool Matched { get; set; }
    }

    public sealed class MicroiVisionCompareResult
    {
        public decimal Similarity { get; set; }
        public decimal Threshold { get; set; }
        public bool Matched { get; set; }
        public int Dimensions { get; set; }
    }

    public sealed class MicroiVisionCompareBatchResult
    {
        public decimal Threshold { get; set; }
        public int CandidateCount { get; set; }
        public int Dimensions { get; set; }
        public List<MicroiVisionMatch> Matches { get; set; } = new List<MicroiVisionMatch>();
    }

    public sealed class MicroiVisionSearchParam : BaseParam
    {
        public string QueryEmbeddingBase64 { get; set; }
        public List<MicroiVisionCandidate> Candidates { get; set; } = new List<MicroiVisionCandidate>();
        public decimal? Threshold { get; set; }
        public int? TopK { get; set; }
        public int? EfSearch { get; set; }
        public string IndexKey { get; set; }
    }

    public sealed class MicroiVisionSearchResult
    {
        public string Algorithm { get; set; }
        public bool CacheHit { get; set; }
        public decimal Threshold { get; set; }
        public int CandidateCount { get; set; }
        public int Dimensions { get; set; }
        public long ElapsedMilliseconds { get; set; }
        public List<MicroiVisionMatch> Matches { get; set; } = new List<MicroiVisionMatch>();
    }

    public sealed class MicroiVisionFrameObservation
    {
        public string FrameId { get; set; }
        public string TrackId { get; set; }
        public string Key { get; set; }
        public string Name { get; set; }
        public decimal Confidence { get; set; }
        public long TimestampMilliseconds { get; set; }
    }

    public sealed class MicroiVisionTemporalVoteParam : BaseParam
    {
        public List<MicroiVisionFrameObservation> Observations { get; set; } = new List<MicroiVisionFrameObservation>();
        public int? MinimumVotes { get; set; }
        public int? WindowSize { get; set; }
        public decimal? MinimumAverageConfidence { get; set; }
    }

    public sealed class MicroiVisionTemporalVoteResult
    {
        public bool Stable { get; set; }
        public string TrackId { get; set; }
        public string Key { get; set; }
        public string Name { get; set; }
        public int VoteCount { get; set; }
        public int WindowCount { get; set; }
        public decimal AverageConfidence { get; set; }
        public decimal VoteRatio { get; set; }
    }

    public sealed class MicroiVisionModelCapability
    {
        public string ModelKey { get; set; }
        public string ModelVersion { get; set; }
        public string Provider { get; set; }
        public string TaskType { get; set; }
        public string License { get; set; }
        public bool Ready { get; set; }
        public string Message { get; set; }
    }

    public sealed class MicroiVisionCapabilitiesResult
    {
        public int MaximumEncodedImageBytes { get; set; }
        public int MaximumFrameBatchSize { get; set; }
        public int MaximumCandidateCount { get; set; }
        public int MaximumEmbeddingDimensions { get; set; }
        public List<string> SupportedImageTypes { get; set; } = new List<string>();
        public List<string> SupportedPipelines { get; set; } = new List<string>();
        public List<string> SupportedExecutionProviders { get; set; } = new List<string>();
        public string NearestNeighborEngine { get; set; }
        public List<MicroiVisionModelCapability> Models { get; set; } = new List<MicroiVisionModelCapability>();
    }

    /// <summary>
    /// .NET 宿主的通用视觉推理原子能力。数据库检索、业务状态、AI 回退和 Hook
    /// 均由接口引擎编排；实现只负责有界图像解码、可信模型推理和向量比较。
    /// </summary>
    public interface IMicroiVision
    {
        Task<DosResult<MicroiVisionExtractResult>> ExtractAsync(
            MicroiVisionExtractParam param,
            CancellationToken cancellationToken = default(CancellationToken));

        Task<DosResult<MicroiVisionFrameBatchResult>> ExtractBatchAsync(
            MicroiVisionFrameBatchParam param,
            CancellationToken cancellationToken = default(CancellationToken));

        Task<DosResult<MicroiVisionCompareResult>> CompareAsync(
            MicroiVisionCompareParam param,
            CancellationToken cancellationToken = default(CancellationToken));

        Task<DosResult<MicroiVisionCompareBatchResult>> CompareBatchAsync(
            MicroiVisionCompareBatchParam param,
            CancellationToken cancellationToken = default(CancellationToken));

        Task<DosResult<MicroiVisionAnalyzeResult>> AnalyzeAsync(
            MicroiVisionAnalyzeParam param,
            CancellationToken cancellationToken = default(CancellationToken));

        Task<DosResult<MicroiVisionSearchResult>> SearchAsync(
            MicroiVisionSearchParam param,
            CancellationToken cancellationToken = default(CancellationToken));

        Task<DosResult<MicroiVisionTemporalVoteResult>> StabilizeAsync(
            MicroiVisionTemporalVoteParam param,
            CancellationToken cancellationToken = default(CancellationToken));

        DosResult<MicroiVisionCapabilitiesResult> GetCapabilities();

        /// <summary>
        /// 接收已经解码为连续图片帧的异步视频流。RTSP/WebRTC/摄像头协议适配留在宿主
        /// 或前端，避免推理类库持有摄像头凭据或网络地址。
        /// </summary>
        IAsyncEnumerable<DosResult<MicroiVisionExtractResult>> RecognizeFramesAsync(
            IAsyncEnumerable<MicroiVisionExtractParam> frames,
            string modelKey,
            string mode,
            CancellationToken cancellationToken = default(CancellationToken));

        IAsyncEnumerable<DosResult<MicroiVisionAnalyzeResult>> AnalyzeFramesAsync(
            IAsyncEnumerable<MicroiVisionAnalyzeParam> frames,
            string pipelineKey,
            string mode,
            CancellationToken cancellationToken = default(CancellationToken));
    }

    /// <summary>V8.Vision 的租户绑定最小能力面。</summary>
    public interface IV8Vision
    {
        Task<DosResult<MicroiVisionExtractResult>> Extract(MicroiVisionExtractParam param);
        Task<DosResult<MicroiVisionFrameBatchResult>> ExtractBatch(MicroiVisionFrameBatchParam param);
        Task<DosResult<MicroiVisionCompareResult>> Compare(MicroiVisionCompareParam param);
        Task<DosResult<MicroiVisionCompareBatchResult>> CompareBatch(MicroiVisionCompareBatchParam param);
        Task<DosResult<MicroiVisionAnalyzeResult>> Analyze(MicroiVisionAnalyzeParam param);
        Task<DosResult<MicroiVisionSearchResult>> Search(MicroiVisionSearchParam param);
        Task<DosResult<MicroiVisionTemporalVoteResult>> Stabilize(MicroiVisionTemporalVoteParam param);
        DosResult<MicroiVisionCapabilitiesResult> GetCapabilities();
    }
}
