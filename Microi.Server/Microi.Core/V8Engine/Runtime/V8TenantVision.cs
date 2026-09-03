using System;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// V8.Vision 租户代理。调用方不能覆盖当前租户，也不能提交模型路径、执行提供程序
    /// 或网络地址；ModelKey 只会解析到宿主已安装并校验的模型包。
    /// </summary>
    public sealed class V8TenantVision : IV8Vision
    {
        private readonly string _osClient;

        public V8TenantVision(string osClient)
        {
            _osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
        }

        public Task<DosResult<MicroiVisionExtractResult>> Extract(MicroiVisionExtractParam param)
        {
            param = Prepare(param ?? new MicroiVisionExtractParam());
            var denied = ValidateTenant<MicroiVisionExtractResult>();
            return denied ?? MicroiEngine.Vision.ExtractAsync(param);
        }

        public Task<DosResult<MicroiVisionFrameBatchResult>> ExtractBatch(MicroiVisionFrameBatchParam param)
        {
            param = Prepare(param ?? new MicroiVisionFrameBatchParam());
            var denied = ValidateTenant<MicroiVisionFrameBatchResult>();
            if (denied != null) return denied;
            foreach (var frame in param.Frames ?? new System.Collections.Generic.List<MicroiVisionExtractParam>())
            {
                frame.OsClient = _osClient;
                if (string.IsNullOrWhiteSpace(frame.ModelKey)) frame.ModelKey = param.ModelKey;
                if (string.IsNullOrWhiteSpace(frame.Mode)) frame.Mode = param.Mode;
            }
            return MicroiEngine.Vision.ExtractBatchAsync(param);
        }

        public Task<DosResult<MicroiVisionCompareResult>> Compare(MicroiVisionCompareParam param)
        {
            param = Prepare(param ?? new MicroiVisionCompareParam());
            var denied = ValidateTenant<MicroiVisionCompareResult>();
            return denied ?? MicroiEngine.Vision.CompareAsync(param);
        }

        public Task<DosResult<MicroiVisionCompareBatchResult>> CompareBatch(MicroiVisionCompareBatchParam param)
        {
            param = Prepare(param ?? new MicroiVisionCompareBatchParam());
            var denied = ValidateTenant<MicroiVisionCompareBatchResult>();
            return denied ?? MicroiEngine.Vision.CompareBatchAsync(param);
        }

        public Task<DosResult<MicroiVisionAnalyzeResult>> Analyze(MicroiVisionAnalyzeParam param)
        {
            param = Prepare(param ?? new MicroiVisionAnalyzeParam());
            var denied = ValidateTenant<MicroiVisionAnalyzeResult>();
            return denied ?? MicroiEngine.Vision.AnalyzeAsync(param);
        }

        public Task<DosResult<MicroiVisionSearchResult>> Search(MicroiVisionSearchParam param)
        {
            param = Prepare(param ?? new MicroiVisionSearchParam());
            var denied = ValidateTenant<MicroiVisionSearchResult>();
            return denied ?? MicroiEngine.Vision.SearchAsync(param);
        }

        public Task<DosResult<MicroiVisionTemporalVoteResult>> Stabilize(MicroiVisionTemporalVoteParam param)
        {
            param = Prepare(param ?? new MicroiVisionTemporalVoteParam());
            var denied = ValidateTenant<MicroiVisionTemporalVoteResult>();
            return denied ?? MicroiEngine.Vision.StabilizeAsync(param);
        }

        public DosResult<MicroiVisionCapabilitiesResult> GetCapabilities()
        {
            var contextOsClient = V8TenantContext.Current?.OsClient;
            if (!string.IsNullOrWhiteSpace(contextOsClient)
                && !string.Equals(contextOsClient, _osClient, StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult<MicroiVisionCapabilitiesResult>(
                    0, null, "视觉识别租户与当前 V8 执行租户不一致。");
            }
            return MicroiEngine.Vision.GetCapabilities();
        }

        private T Prepare<T>(T param) where T : BaseParam
        {
            param.OsClient = _osClient;
            return param;
        }

        private Task<DosResult<T>> ValidateTenant<T>()
        {
            var contextOsClient = V8TenantContext.Current?.OsClient;
            if (string.IsNullOrWhiteSpace(contextOsClient)
                || string.Equals(contextOsClient, _osClient, StringComparison.OrdinalIgnoreCase)) return null;
            return Task.FromResult(new DosResult<T>(
                0, default(T), "视觉识别租户与当前 V8 执行租户不一致。"));
        }
    }
}
