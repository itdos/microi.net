using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 图片任务复用 mci_background_task 的持久队列、唯一键、租约和栅栏。
    /// HTTP 断开只结束等待，不取消已入队任务；列表/状态投影不返回原始提示词或参考图。
    /// </summary>
    public static class AiImageBackgroundTaskService
    {
        public const string WorkerApiEngineKey = "__microi_native_ai_image__";
        public const string ProviderWorkerApiEngineKey = "__microi_native_ai_image_provider__";
        public static bool IsImageWorker(string key) => string.Equals(key, WorkerApiEngineKey, StringComparison.OrdinalIgnoreCase)
            || string.Equals(key, ProviderWorkerApiEngineKey, StringComparison.OrdinalIgnoreCase);

        public static DosResult RuntimeUnavailable() => new DosResult(0,
            new { Status = "UnsupportedRuntime" },
            "当前节点缺少 AI 图片持久任务运行时，请同步更新 Microi.Core、Microi.AI 和平台 API；尚未创建生成任务。");

        public static IReadOnlyCollection<string> ExcludeUnsupportedWorkers(
            IEnumerable<string> excludedKeys, bool imageRuntimeAvailable)
        {
            var excluded = new HashSet<string>(excludedKeys ?? Array.Empty<string>(), StringComparer.OrdinalIgnoreCase);
            if (!imageRuntimeAvailable) { excluded.Add(WorkerApiEngineKey); excluded.Add(ProviderWorkerApiEngineKey); }
            return excluded.ToArray();
        }

        public static string BuildTaskIdempotencyKey(string osClient, string userId, string requestId)
        {
            using (var sha = SHA256.Create())
                return "ai-image:" + BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(
                    MiniMaxImageSupport.BuildIdempotencyKey(osClient, userId, requestId))))
                    .Replace("-", "").ToLowerInvariant();
        }

        public static DosResult Queue(string osClient, JObject currentUser,
            MiniMaxImageGenerateParam request, bool requireDirectProvider = false)
        {
            var userId = currentUser?["Id"]?.ToString();
            if (string.IsNullOrWhiteSpace(osClient) || string.IsNullOrWhiteSpace(userId))
                return new DosResult(1001, null, "请先登录。");
            if (!MiniMaxImageSupport.TryNormalize(request, out var normalized, out var error))
                return new DosResult(0, null, error);
            try
            {
                var key = BuildTaskIdempotencyKey(osClient, userId, normalized.RequestId);
                var existing = BackgroundTaskStore.FindByIdempotency(osClient, key);
                if (existing != null)
                    return ReadMatchingTask(osClient, userId, existing, normalized.Fingerprint);

                // 只序列化白名单 DTO。参考图已经过字节/数量上限校验，保存在服务端私有
                // 执行参数列；后台任务列表与本状态接口始终使用不含 ParamJson 的投影。
                // 中转提交与实际供应商执行是不同任务类型；否则同租户串行租约会形成自等待。
                var workerKey = requireDirectProvider ? ProviderWorkerApiEngineKey : WorkerApiEngineKey;
                var param = new JObject
                {
                    ["ApiEngineKey"] = workerKey,
                    ["Fingerprint"] = normalized.Fingerprint,
                    ["RequireDirectProvider"] = requireDirectProvider,
                    ["Request"] = JObject.FromObject(request)
                };
                var task = BackgroundTaskService.StartApiEngine(osClient, userId, "AI 图片生成",
                    param, currentUser, new JObject
                    {
                        ["IdempotencyKey"] = key,
                        ["ConcurrencyKey"] = workerKey,
                        ["MaxAttempts"] = 3,
                        ["RetryOnFailure"] = false
                    });
                // 跨节点同时入队可能由另一节点赢得唯一键；再次核对其冻结参数。
                var persisted = BackgroundTaskStore.GetForUser(osClient, userId, task.Id);
                return persisted == null
                    ? new DosResult(0, new { Status = "Unavailable", TaskId = task.Id }, "图片任务已提交，但持久状态暂不可读；请查询同一 TaskId。")
                    : ReadMatchingTask(osClient, userId, persisted, normalized.Fingerprint);
            }
            catch
            {
                return new DosResult(0, new { Status = "Unavailable" }, "图片持久任务入队或回读失败；请保留 RequestId，未在 HTTP 请求中直接调用上游。");
            }
        }

        private static DosResult ReadMatchingTask(string osClient, string userId,
            BackgroundTaskRecord task, string fingerprint)
        {
            var param = JObject.Parse(task.ParamJson ?? "{}");
            if (!string.Equals(task.UserKey, userId, StringComparison.Ordinal)
                || !IsImageWorker(task.ApiEngineKey)
                || !string.Equals(param["Fingerprint"]?.ToString(), fingerprint, StringComparison.Ordinal))
                return new DosResult(0, new { Status = "Conflict" },
                    "相同 RequestId 已用于另一组图片参数，未重复生成。");
            return GetStatus(osClient, userId, task.Id);
        }

        public static DosResult GetStatus(string osClient, string userId, string taskId)
        {
            if (string.IsNullOrWhiteSpace(osClient) || string.IsNullOrWhiteSpace(userId))
                return new DosResult(1001, null, "请先登录。");
            if (!Guid.TryParseExact(taskId, "N", out _))
                return new DosResult(0, null, "图片 TaskId 格式无效。");
            try
            {
                var summary = BackgroundTaskService.GetSummary(osClient, userId, taskId);
                if (summary == null || !IsImageWorker(summary.ApiEngineKey))
                    return new DosResult(0, new { Status = "NotFound" }, "当前用户的图片任务不存在。");
                var terminal = summary.Status == "Succeeded" || summary.Status == "Failed" || summary.Status == "Canceled";
                var detail = terminal ? BackgroundTaskService.GetDetail(osClient, userId, taskId) : null;
                var result = Project(summary, detail?.Result);
                if (summary.Status == "Failed" && result.Data is JObject data)
                    data["CanRecoverResult"] = HasStoredResult(osClient, userId, BackgroundTaskStore.GetForUser(osClient, userId, taskId));
                return result;
            }
            catch
            {
                return new DosResult(0, new { Status = "Unavailable" }, "图片任务状态暂不可读，请稍后查询同一任务。");
            }
        }

        private static bool HasStoredResult(string tenant, string userId, BackgroundTaskRecord task)
        {
            if (task == null || task.UserKey != userId || !IsImageWorker(task.ApiEngineKey)) return false;
            var param = JObject.Parse(task.ParamJson ?? "{}");
            var request = param["Request"]?.ToObject<MiniMaxImageGenerateParam>();
            if (!MiniMaxImageSupport.TryNormalize(request, out var normalized, out _)
                || normalized.Fingerprint != param["Fingerprint"]?.ToString()) return false;
            var cache = MicroiEngine.TryGetService<IMicroiCacheTenant>()?.Cache(tenant)?.GetIDatabase();
            return cache != null && cache.KeyExists(MiniMaxImageSupport.BuildIdempotencyKey(tenant, userId, normalized.RequestId) + ":connector:nodes");
        }

        /// <summary>显式恢复已经取得文件节点的任务；仅复用冻结参数，不能接受新提示词或模型。</summary>
        public static DosResult RecoverResult(string osClient, string userId, string taskId)
        {
            if (string.IsNullOrWhiteSpace(osClient) || string.IsNullOrWhiteSpace(userId)) return new DosResult(1001, null, "请先登录。");
            if (!Guid.TryParseExact(taskId, "N", out _)) return new DosResult(0, null, "图片 TaskId 格式无效。");
            try
            {
                var task = BackgroundTaskStore.GetForUser(osClient, userId, taskId);
                if (!HasStoredResult(osClient, userId, task))
                    return new DosResult(0, null, "没有可恢复的供应商图片节点；未重新生成图片。");
                if (task.Status == "Failed")
                {
                    var param = JObject.Parse(task.ParamJson);
                    param["RequireStoredResult"] = true;
                    BackgroundTaskStore.ResumeImageResult(task, param);
                }
                return GetStatus(osClient, userId, taskId);
            }
            catch { return new DosResult(0, null, "图片恢复状态暂不可确认，请查询同一任务。"); }
        }

        /// <summary>只投影已确认的任务结果；不能用生成中的占位状态伪装成功。</summary>
        public static DosResult Project(BackgroundTaskSummary task, JObject result)
        {
            var data = result?["Data"] as JObject;
            data = data == null ? new JObject() : (JObject)data.DeepClone();
            data["TaskId"] = task.Id;
            data["StatusSource"] = "MicroiBackgroundTask";
            data["Status"] = data["Status"] ?? task.Status;
            data["Replayed"] = true;
            if (task.Status == "Succeeded" && result?["Code"]?.Value<int>() == 1
                && data["Images"] is JArray images && images.Count > 0)
                return new DosResult(1, data, result["Msg"]?.ToString() ?? "图片已生成并保存。");
            if (task.Status == "Pending" || task.Status == "Running" || task.Status == "Retrying")
            {
                data["Status"] = task.Status;
                data["PollAfterMs"] = 1500;
                return new DosResult(2, data, "图片任务正在后台执行，请查询同一 TaskId。");
            }
            var finalStatus = data["Status"]?.ToString();
            data["Status"] = finalStatus == "Generating" ? "Uncertain"
                : finalStatus == "Succeeded" ? "Failed" : finalStatus;
            return new DosResult(0, data, result?["Msg"]?.ToString()
                ?? (string.IsNullOrWhiteSpace(task.Msg) ? "图片任务未完成，未自动重复调用上游。" : task.Msg));
        }
    }
}
