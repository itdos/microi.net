using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    internal enum BackgroundTaskExecutionStage
    {
        ExecutionPreparation,
        NativeWorkerExecution,
        ApiEngineExecution,
        ResultProjection,
        ContinuationProgress,
        ContinuationPreparation,
        ContinuationLeaseRelease,
        ContinuationPersist,
        BusinessFailurePersist,
        TerminalPersist
    }

    /// <summary>记录持久工作器外层失败的位置；诊断旁路不参与重试、事务或租约。</summary>
    internal static class BackgroundTaskFailureDiagnostics
    {
        internal const int MaximumExceptions = 4;
        internal const int MaximumFrames = 4;
        internal const int MaximumMessageHashChars = 65536;

        /// <summary>只提交脱敏标量到既有日志队列；拒绝或异常均不得覆盖原业务异常。</summary>
        internal static bool TryReport(BackgroundTaskRecord item, string executionOsClient,
            BackgroundTaskExecutionStage stage, Exception error, Func<string, bool> enqueue = null)
        {
            try
            {
                var payload = CreateSnapshot(item, executionOsClient, stage, error)
                    .ToString(Formatting.None);
                if (enqueue != null) return enqueue(payload);
                var owner = Identifier(item?.OsClient);
                if (owner.Length == 0 || owner == "[omitted]") return false;
                return MicroiEngine.QueueSystemLog(owner, "BackgroundTask", "ExecutionFailed",
                    "后台任务执行失败（脱敏阶段诊断）", payload, 3, false, Identifier(item?.Id));
            }
            catch { return false; }
        }

        internal static JObject CreateSnapshot(BackgroundTaskRecord item, string executionOsClient,
            BackgroundTaskExecutionStage stage, Exception error)
        {
            var entries = new JArray();
            var pending = new Queue<(Exception Error, int Parent)>();
            if (error != null) pending.Enqueue((error, -1));
            var truncated = false;
            while (pending.Count > 0 && entries.Count < MaximumExceptions)
            {
                var next = pending.Dequeue();
                var index = entries.Count;
                var entry = Describe(next.Error);
                entry["Parent"] = next.Parent;
                entries.Add(entry);
                // 聚合异常也可能包装传输失败；总节点数有界，不展开 Data 或任意属性。
                if (next.Error is AggregateException aggregate)
                {
                    foreach (var inner in aggregate.InnerExceptions)
                    {
                        if (entries.Count + pending.Count >= MaximumExceptions) { truncated = true; break; }
                        pending.Enqueue((inner, index));
                    }
                }
                else if (next.Error.InnerException != null)
                {
                    if (entries.Count + pending.Count >= MaximumExceptions) truncated = true;
                    else pending.Enqueue((next.Error.InnerException, index));
                }
            }
            return new JObject
            {
                ["Version"] = 1,
                ["Stage"] = Enum.IsDefined(typeof(BackgroundTaskExecutionStage), stage) ? stage.ToString() : "Unknown",
                ["OwnerOsClient"] = Identifier(item?.OsClient),
                ["ExecutionOsClient"] = Identifier(executionOsClient),
                ["RuntimeOsClientType"] = Identifier(item?.RuntimeOsClientType),
                ["RuntimeOsClientNetwork"] = Identifier(item?.RuntimeOsClientNetwork),
                ["TaskId"] = Identifier(item?.Id),
                ["Fence"] = item?.FencingToken ?? 0,
                ["Exceptions"] = entries,
                ["ExceptionsTruncated"] = truncated || pending.Count > 0
            };
        }

        private static JObject Describe(Exception error)
        {
            var entry = new JObject
            {
                ["Type"] = Identifier(error.GetType().FullName, 256),
                ["HResult"] = error.HResult
            };
            // 错误正文可能包含 SQL、参数或凭据。只保留长度及有界前缀摘要，绝不记录正文。
            try
            {
                var message = error.Message ?? "";
                var count = Math.Min(message.Length, MaximumMessageHashChars);
                using (var sha = SHA256.Create())
                    entry["MessageSha256"] = BitConverter.ToString(sha.ComputeHash(
                        Encoding.UTF8.GetBytes(message.Substring(0, count)))).Replace("-", "").ToLowerInvariant();
                entry["MessageLength"] = message.Length;
                entry["MessageHashChars"] = count;
                entry["MessageHashTruncated"] = count != message.Length;
            }
            catch { entry["MessageUnavailable"] = true; }
            AddNumeric(entry, error, "Number");
            AddNumeric(entry, error, "SocketErrorCode");
            AddSqlState(entry, error);
            var frames = new JArray();
            try
            {
                // 从 CLR 方法元数据生成栈，不读取异常 StackTrace 文本、源码路径、行号或实参。
                var stack = new StackTrace(error, false);
                for (var index = 0; index < Math.Min(stack.FrameCount, MaximumFrames); index++)
                {
                    var method = stack.GetFrame(index)?.GetMethod();
                    if (method != null) frames.Add(Identifier(method.DeclaringType?.FullName, 256)
                        + "." + Identifier(method.Name, 128));
                }
                entry["FramesTruncated"] = stack.FrameCount > MaximumFrames;
            }
            catch { entry["FramesUnavailable"] = true; }
            entry["Methods"] = frames;
            return entry;
        }

        private static object ReadProperty(Exception error, string name)
        {
            var property = error.GetType().GetProperty(name, BindingFlags.Instance | BindingFlags.Public);
            return property != null && property.GetIndexParameters().Length == 0
                ? property.GetValue(error) : null;
        }

        private static void AddNumeric(JObject entry, Exception error, string name)
        {
            try
            {
                var value = ReadProperty(error, name);
                // 不调用提供商任意对象的 ToString；只接受整数/枚举，拒绝含正文的伪数字对象。
                if (value is byte || value is sbyte || value is short || value is ushort
                    || value is int || value is uint || value is long || value is Enum)
                    entry[name] = Convert.ToInt64(value, CultureInfo.InvariantCulture);
            }
            catch { entry[name + "Unavailable"] = true; }
        }

        private static void AddSqlState(JObject entry, Exception error)
        {
            try
            {
                var value = ReadProperty(error, "SqlState") ?? ReadProperty(error, "SQLState");
                if (!(value is string state) || state.Length != 5) return;
                foreach (var ch in state) if (!((ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z'))) return;
                entry["SqlState"] = state;
            }
            catch { entry["SqlStateUnavailable"] = true; }
        }

        private static string Identifier(string value, int maxLength = 128)
        {
            if (string.IsNullOrEmpty(value)) return "";
            if (value.Length > maxLength) return "[omitted]";
            foreach (var ch in value)
                if (!((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
                    || (ch >= '0' && ch <= '9') || "_-.+:`<>".IndexOf(ch) >= 0)) return "[omitted]";
            return value;
        }
    }
}
