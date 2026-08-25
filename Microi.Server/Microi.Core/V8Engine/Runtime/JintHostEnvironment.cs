using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Jint;
using Jint.Native;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 自定义 JsonConverter：将整数值的 double 序列化为整数格式
    /// 解决 Jint 将 JavaScript Number 转换为 C# double 后，序列化时 0 变成 0.0 的问题
    /// </summary>
    public class IntegerDoubleConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType)
        {
            return objectType == typeof(double) || objectType == typeof(double?);
        }

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            return reader.Value;
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            if (value == null)
            {
                writer.WriteNull();
                return;
            }

            double d = (double)value;
            // 检查是否为整数值（没有小数部分）
            if (d == Math.Truncate(d) && d >= long.MinValue && d <= long.MaxValue)
            {
                // 写入为整数
                writer.WriteValue((long)d);
            }
            else
            {
                // 保持浮点数格式
                writer.WriteValue(d);
            }
        }
    }

    public sealed class JintHostEnvironment : IDisposable
    {
        private readonly ConcurrentDictionary<int, TimerRegistration> _timers = new ConcurrentDictionary<int, TimerRegistration>();
        private int _nextTimerId;
        private bool _disposed;

        private sealed class TimerRegistration : IDisposable
        {
            public TimerRegistration(JsValue callback, int delay)
            {
                Callback = callback;
                Cancellation = new CancellationTokenSource();
                DelayTask = Task.Delay(delay, Cancellation.Token);
            }

            public JsValue Callback { get; }
            public CancellationTokenSource Cancellation { get; }
            public Task DelayTask { get; }

            public void Dispose()
            {
                Cancellation.Dispose();
            }
        }

        private static dynamic CreateConsoleObject(V8EngineParam param)
        {
            return new
            {
                log = new Action<object>(msg => WriteConsole(param, "Log", msg, 1)),
                error = new Action<object>(msg => WriteConsole(param, "Error", msg, 3)),
                warn = new Action<object>(msg => WriteConsole(param, "Warn", msg, 2)),
                info = new Action<object>(msg => WriteConsole(param, "Info", msg, 1))
            };
        }

        private static void WriteConsole(V8EngineParam param, string consoleLevel, object message, int logLevel)
        {
            var messageText = message?.ToString() ?? "null";
            var formatted = $"Microi：【V8引擎 - {consoleLevel}】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】{messageText}";

            // MCP/调试执行按当前异步请求捕获，避免修改进程级 Console.Out 后串走其它请求日志。
            if (V8ConsoleContext.TryWrite(consoleLevel, formatted)) return;

            var targetId = !string.IsNullOrWhiteSpace(param?.ApiEngineKey)
                ? param.ApiEngineKey
                : param?.EventName;
            MicroiEngine.QueueSystemLog(
                param?.OsClient,
                "V8",
                $"Console{consoleLevel}",
                $"V8引擎 {consoleLevel}",
                messageText,
                logLevel,
                logLevel == 1,
                targetId,
                formatted);
        }

        /// <summary>
        /// 安全的 JSON 序列化方法，能正确处理 JToken/JObject/JValue 等 Newtonsoft.Json 类型
        /// 解决 Jint 内置 JSON.stringify 无法处理 JToken 类型导致的
        /// "Cannot access child value on Newtonsoft.Json.Linq.JValue" 错误
        /// 同时解决整数被转换为浮点格式的问题（0 → 0.0）
        /// </summary>
        private static string SafeJsonStringify(object obj)
        {
            if (obj == null) return "null";

            try
            {
                // 直接使用 Newtonsoft.Json 序列化，它能正确处理所有 JToken 类型
                // 并且通过 IntegerDoubleConverter 保持整数格式（不会转为浮点）
                return JsonConvert.SerializeObject(obj, new JsonSerializerSettings
                {
                    ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    NullValueHandling = NullValueHandling.Include,
                    Formatting = Formatting.None,
                    // 使用自定义转换器，确保整数值的 double 序列化为整数格式
                    Converters = new List<JsonConverter> { new IntegerDoubleConverter() }
                });
            }
            catch (Exception ex)
            {
                // 序列化失败时返回错误信息
                return $"{{\"error\":\"JSON序列化失败: {ex.Message.Replace("\"", "\\\"")}\"}}";
            }
        }
        public void InjectTo(Engine engine, V8EngineParam param = null)
        {
            // 注入console
            engine.SetValue("console", CreateConsoleObject(param));

            // ========== 只覆盖 JSON.stringify，parse 保持原生 ==========
            // 注入 C# 的 stringify 实现（能处理 JToken 类型）
            engine.SetValue("__safeStringify", new Func<object, string>(SafeJsonStringify));

            // 覆盖 JSON.stringify，parse 保持 Jint 原生实现
            engine.Execute("JSON.stringify = function(obj) { return __safeStringify(obj); };");

            // 1. 注入 setTimeout - 回调参数类型为 JsValue
            engine.SetValue("setTimeout", new Func<JsValue, int, int>((callback, delay) =>
            {
                if (_disposed)
                {
                    throw new ObjectDisposedException(nameof(JintHostEnvironment));
                }
                if (!callback.IsCallable())
                {
                    throw new ArgumentException("setTimeout 的第一个参数必须是可调用函数。", nameof(callback));
                }
                if (_timers.Count >= 256)
                {
                    throw new InvalidOperationException("单次 V8 执行最多允许创建 256 个定时器。");
                }

                delay = Math.Max(0, delay);
                var timerId = Interlocked.Increment(ref _nextTimerId);
                _timers[timerId] = new TimerRegistration(callback, delay);

                return timerId;
            }));

            // 2. 注入 clearTimeout
            engine.SetValue("clearTimeout", new Action<int>(timerId =>
            {
                if (_timers.TryRemove(timerId, out var registration))
                {
                    registration.Cancellation.Cancel();
                    registration.Dispose();
                }
            }));

            // 可以继续注入其他API，比如fetch、localStorage等
        }

        /// <summary>
        /// 在当前 Engine 上串行排空 setTimeout。Jint Engine 非线程安全，且调用结束后会释放，
        /// 因此回调不能再通过 Task.Run 跨线程、脱离请求生命周期执行。
        /// </summary>
        public async Task DrainTimersAsync(Engine engine, CancellationToken cancellationToken = default)
        {
            while (!_timers.IsEmpty)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var registrations = _timers.ToArray();
                if (registrations.Length == 0) return;

                var pendingTasks = new Task[registrations.Length];
                for (var i = 0; i < registrations.Length; i++)
                {
                    pendingTasks[i] = registrations[i].Value.DelayTask;
                }
                var nextTimerTask = Task.WhenAny(pendingTasks);
                if (cancellationToken.CanBeCanceled)
                {
                    var cancellationTask = Task.Delay(Timeout.Infinite, cancellationToken);
                    var completedTask = await Task.WhenAny(nextTimerTask, cancellationTask).ConfigureAwait(false);
                    if (completedTask == cancellationTask)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                    }
                }
                else
                {
                    await nextTimerTask.ConfigureAwait(false);
                }

                foreach (var item in registrations)
                {
                    var registration = item.Value;
                    if (!registration.DelayTask.IsCompleted
                        || !_timers.TryRemove(item.Key, out registration))
                    {
                        continue;
                    }

                    try
                    {
                        if (!registration.Cancellation.IsCancellationRequested)
                        {
                            var callbackResult = engine.Invoke(registration.Callback);
                            await callbackResult.UnwrapIfPromiseAsync(cancellationToken).ConfigureAwait(false);
                        }
                    }
                    catch (TaskCanceledException) when (registration.Cancellation.IsCancellationRequested)
                    {
                    }
                    finally
                    {
                        registration.Dispose();
                    }
                }
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            foreach (var item in _timers.ToArray())
            {
                if (_timers.TryRemove(item.Key, out var registration))
                {
                    registration.Cancellation.Cancel();
                    registration.Dispose();
                }
            }
        }
    }
}
