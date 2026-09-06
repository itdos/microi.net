using System;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>共享图片记录的真实状态投影；明确失败不能被合并为“仍在生成”。</summary>
    public static class MiniMaxImageStateSupport
    {
        public static DosResult Read(JObject record, string fingerprint)
        {
            if (record == null) return new DosResult(0, null, "图片幂等状态不可读，未重复调用 MiniMax。");
            if (!string.Equals(record["Fingerprint"]?.ToString(), fingerprint, StringComparison.Ordinal))
                return new DosResult(0, new { Status = "Conflict" }, "相同 RequestId 已用于另一组图片参数，未重复生成。");
            var state = record["State"]?.ToString() ?? "Unknown";
            var data = record["Result"] is JObject saved ? (JObject)saved.DeepClone() : new JObject();
            data["Status"] = state;
            data["StatusSource"] = "MicroiIdempotencyRecord";
            data["Replayed"] = true;
            if (state == "Succeeded" && data["Images"] is JArray images && images.Count > 0)
                return new DosResult(1, data, "已返回同一 RequestId 的既有 HDFS 图片，未重复调用 MiniMax。");
            if (state == "Generating")
                return new DosResult(2, data, "同一 RequestId 已提交；此结果来自吾码共享状态，未再次调用供应商。");
            var error = record["Error"]?.ToString();
            return new DosResult(0, data, string.IsNullOrWhiteSpace(error)
                ? "上次图片结果不确定，未自动重复调用 MiniMax。" : error);
        }

        public static bool IsAmbiguousHttpFailure(int statusCode)
        {
            return statusCode == 408 || statusCode >= 500 || statusCode <= 0;
        }
    }
}
