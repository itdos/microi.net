#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8Engine_Optimized.cs
* Copyright(c) Microi.net
* CLR 版本:
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：V8引擎
*******************************************************/
#endregion
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Acornima.Ast;
using Dos.Common;
using Jint;
using Jint.Native;
using Jint.Runtime.Interop;
using Microsoft.Extensions.ObjectPool;

namespace Microi.net
{
    /// <summary>
    /// V8引擎实现（性能优化版本）
    /// 设计原则：为每个接口创建独立的Engine实例，避免全局变量污染
    /// 通过缓存编译后的脚本来优化性能（官方推荐方案）
    /// </summary>
    public class V8Engine : IV8Engine
    {
        #region 静态字段

        /// <summary>
        /// Dos.Common加密类对象（静态复用）
        /// </summary>
        private static readonly EncryptHelper _encryptHelper = new EncryptHelper();

        /// <summary>
        /// IP辅助类对象（静态复用，避免高并发下重复创建）
        /// </summary>
        private static readonly IPHelper _ipHelper = new IPHelper();
        private static int MaxConcurrentV8Executions => ConfigHelper.GetRuntimeConfigurationInt("V8Limits:MaxConcurrentExecutions", 128);
        private static int TenantMaxConcurrentV8Executions => ConfigHelper.GetRuntimeConfigurationInt("V8Limits:TenantMaxConcurrentExecutions", 32);
        private static int KeyMaxConcurrentV8Executions => ConfigHelper.GetRuntimeConfigurationInt("V8Limits:KeyMaxConcurrentExecutions", 16);
        private static int V8ExecutionWaitMilliseconds => ConfigHelper.GetRuntimeConfigurationInt("V8Limits:ExecutionWaitMilliseconds", 1800000);
        private static int PreparedScriptCacheSize => Math.Clamp(
            ConfigHelper.GetRuntimeConfigurationInt("V8Limits:PreparedScriptCacheSize", 1024),
            0,
            4096);
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> V8ExecutionGates = new ConcurrentDictionary<string, SemaphoreSlim>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, Prepared<Script>> PreparedScriptCache = new ConcurrentDictionary<string, Prepared<Script>>(StringComparer.Ordinal);
        private static readonly ConcurrentQueue<string> PreparedScriptCacheOrder = new ConcurrentQueue<string>();
        private static readonly Regex AwaitKeywordRegex = new Regex(@"\bawait\b", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        /// <summary>
        /// 2026-05-01 安全加固：V8 沙箱 CLR 类型黑名单（按命名空间前缀匹配）
        /// 这些 .NET 类型/命名空间禁止在用户脚本中通过 System.XXX 直接访问，
        /// 防止用户编写恶意脚本进行 RCE / 越权 / 反射 / SSRF。
        /// 业务需要这些能力时，应通过受控的 V8.* 扩展对象暴露（如 V8.Http, V8.HDFS 等）。
        /// </summary>
        private static readonly string[] _blockedNamespacePrefixes = new[]
        {
            // 文件系统访问
            "System.IO.",
            // 进程/Win32 服务/性能计数器/事件日志
            "System.Diagnostics.Process",
            "System.Diagnostics.EventLog",
            "System.Diagnostics.PerformanceCounter",
            // 反射和动态加载（绕过沙箱的最快途径）
            "System.Reflection.",
            // 套接字/原生网络（V8.Http 已经是受控通道）
            "System.Net.Sockets.",
            "System.Net.NetworkInformation.",
            // P/Invoke 和非托管互操作
            "System.Runtime.InteropServices.",
            "System.Runtime.Loader.",
            // 注册表和 Win32
            "Microsoft.Win32.",
            // 数据库直连（应使用 V8.Db，由 ORM 控制）
            "System.Data.",
            "Microsoft.Data.",
        };

        /// <summary>
        /// 2026-05-01：完全等于即拦截的危险类型（精确匹配，避免误伤 System.TypeCode 等）
        /// </summary>
        private static readonly HashSet<string> _blockedExactTypes = new HashSet<string>(StringComparer.Ordinal)
        {
            "System.AppDomain",
            "System.Activator",
            "System.Type",                              // 防止 Type.GetType("System.IO.File") 绕过
            "System.RuntimeType",
            "System.RuntimeTypeHandle",
            "System.Environment",                       // 含 Exit/FailFast/SetEnvironmentVariable
            "System.GC",                                // 防止 GC.Collect 等扰乱 GC
        };

        /// <summary>
        /// 2026-05-01：判断指定 MemberInfo 是否属于被禁止的危险 CLR 类型。
        /// 注意：此方法在 Jint 解析每个成员访问时都会被调用，要尽量轻量。
        /// </summary>
        private static bool IsBlockedMember(MemberInfo member)
        {
            if (member == null) return false;
            // 优先用 DeclaringType（如 Process.Start 的 DeclaringType 是 Process）
            // 再退化到 ReflectedType
            var t = member.DeclaringType ?? member.ReflectedType;
            if (t == null) return false;
            // 嵌套类型用根类型判定
            while (t.IsNested && t.DeclaringType != null) t = t.DeclaringType;
            var fullName = t.FullName;
            if (string.IsNullOrEmpty(fullName)) return false;
            if (_blockedExactTypes.Contains(fullName)) return true;
            for (int i = 0; i < _blockedNamespacePrefixes.Length; i++)
            {
                if (fullName.StartsWith(_blockedNamespacePrefixes[i], StringComparison.Ordinal))
                {
                    return true;
                }
            }
            return false;
        }

        private static int ReadTenantLimit(string osClient, int globalLimit, params string[] fieldNames)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(osClient)
                    || !OsClientExtend.ClientList.TryGetValue(osClient.Trim(), out var client)
                    || client?.OsClientModel == null
                    || fieldNames == null)
                {
                    return globalLimit;
                }

                foreach (var fieldName in fieldNames)
                {
                    if (int.TryParse(client.OsClientModel[fieldName]?.ToString(), out var tenantLimit)
                        && tenantLimit > 0
                        && tenantLimit < globalLimit)
                    {
                        return tenantLimit;
                    }
                }
            }
            catch
            {
            }

            return globalLimit;
        }

        private static async Task<V8ExecutionLease> TryAcquireV8ExecutionLease(V8EngineParam param, bool isNestedExecution)
        {
            var lease = new V8ExecutionLease();
            var cancellationToken = param?.ExternalCancellationToken ?? CancellationToken.None;
            if (!isNestedExecution
                && !await lease.TryAcquire("v8:global", MaxConcurrentV8Executions, V8ExecutionWaitMilliseconds, cancellationToken))
            {
                return null;
            }

            var osClient = string.IsNullOrWhiteSpace(param?.OsClient) ? "__unknown__" : param.OsClient.Trim();
            var tenantMaxConcurrent = ReadTenantLimit(osClient, TenantMaxConcurrentV8Executions, "PressV8ExecMax", "PressureV8TenantMaxConcurrentExecutions");
            var keyMaxConcurrent = ReadTenantLimit(osClient, KeyMaxConcurrentV8Executions, "PressV8KeyExecMax", "PressureV8KeyMaxConcurrentExecutions");

            if (!isNestedExecution
                && !await lease.TryAcquire($"v8:tenant:{osClient}", tenantMaxConcurrent, V8ExecutionWaitMilliseconds, cancellationToken))
            {
                lease.Dispose();
                return null;
            }

            var key = !string.IsNullOrWhiteSpace(param?.ApiEngineKey)
                ? param.ApiEngineKey.Trim()
                : (!string.IsNullOrWhiteSpace(param?.EventName) ? param.EventName.Trim() : "");
            var isReentrantKey = isNestedExecution && MicroiV8ExecutionScope.ContainsEngineKey(osClient, key);
            if (!string.IsNullOrWhiteSpace(key)
                && !isReentrantKey
                && !await lease.TryAcquire($"v8:key:{osClient}:{key}", keyMaxConcurrent, V8ExecutionWaitMilliseconds, cancellationToken))
            {
                lease.Dispose();
                return null;
            }

            return lease;
        }

        private sealed class V8ExecutionLease : IDisposable
        {
            private readonly List<SemaphoreSlim> _acquired = new List<SemaphoreSlim>();

            public async Task<bool> TryAcquire(string key, int limit, int waitMilliseconds, CancellationToken cancellationToken)
            {
                if (limit <= 0)
                {
                    return true;
                }

                var gate = V8ExecutionGates.GetOrAdd($"{key}:limit:{limit}", _ => new SemaphoreSlim(limit, limit));
                if (!await gate.WaitAsync(TimeSpan.FromMilliseconds(waitMilliseconds), cancellationToken).ConfigureAwait(false))
                {
                    return false;
                }

                _acquired.Add(gate);
                return true;
            }

            public void Dispose()
            {
                for (var i = _acquired.Count - 1; i >= 0; i--)
                {
                    _acquired[i].Release();
                }
                _acquired.Clear();
            }
        }

        /// <summary>
        /// 2026-05-01：共享的安全 TypeResolver，避免每个 Engine 重复构造和缓存失效。
        /// MemberFilter 是 Jint 在解析每个 CLR 成员时都会调用的过滤器。
        /// 该 Resolver 持有内部缓存，按官方建议跨 Engine 复用以提升性能。
        /// </summary>
        private static readonly TypeResolver _safeTypeResolver = new TypeResolver
        {
            MemberFilter = m => !IsBlockedMember(m)
        };

        #endregion

        #region Engine创建
        /// <summary>
        /// 创建新的Engine实例
        /// 注意：每个Engine实例都是独立的，不会有全局变量污染
        /// </summary>
        public Engine CreateEngine(CreateV8EngineParam createV8EngineParam = null)
        {
            if(createV8EngineParam == null)
            {
                createV8EngineParam = new CreateV8EngineParam();
            }
            createV8EngineParam.Normalize();
            var isNestedExecution = MicroiV8ExecutionScope.IsActive;
            var engine = new Engine(options =>
            {
                options.AllowClr();
                if (!createV8EngineParam.UnlimitedRuntime)
                {
                    options.TimeoutInterval(TimeSpan.FromSeconds(createV8EngineParam.Timeout))
                           .MaxStatements(createV8EngineParam.MaxStatements)
                           .LimitRecursion(createV8EngineParam.LimitRecursion);
                }

                // Jint 原生内存约束按“当前线程自 Reset 后的累计分配量”计数。
                // 嵌套接口引擎如果直接复用这一口径，子引擎的所有分配会被每个
                // 父引擎重复计费。启用隔离后，每个 Engine 使用独立约束；根层
                // 额外保留较高的调用树总预算，防止通过嵌套绕过整体保护。
                if (createV8EngineParam.UnlimitedRuntime)
                {
                    // This per-engine opt-in is loaded only from trusted persisted
                    // metadata. The process/container resident-memory guard remains
                    // active, as do host cancellation, concurrency and call-depth
                    // protections outside Jint.
                }
                else if (createV8EngineParam.ResidentMemoryGuardOnly)
                {
                    // Only the server-side trusted marketplace-import policy can set
                    // this flag. ProcessMemoryGuardService remains authoritative and
                    // uses container-aware resident memory: 95% stops new requests,
                    // 98% triggers bounded shutdown. Jint's cumulative allocation
                    // counter is intentionally omitted because reclaimed per-file
                    // buffers would otherwise be charged forever within the slice.
                }
                else if (createV8EngineParam.IsolateNestedApiMemory)
                {
                    options.Constraint(new MicroiV8MemoryConstraint(
                        checked((long)createV8EngineParam.LimitMemory * 1024L * 1024L)));
                    if (!isNestedExecution)
                    {
                        options.Constraint(new MicroiV8CallTreeMemoryConstraint(
                            checked((long)createV8EngineParam.CallTreeLimitMemory * 1024L * 1024L)));
                    }
                }
                else
                {
                    // 必须先提升为 long；2048MB * 1024 * 1024 若按 int 计算会溢出。
                    options.LimitMemory(checked((long)createV8EngineParam.LimitMemory * 1024L * 1024L));
                }

                // 2026-05-01 安全加固：注入类型黑名单 TypeResolver，
                // 阻止 V8 脚本通过 System.IO / System.Diagnostics.Process / System.Reflection
                // 等危险命名空间访问宿主机能力（防 RCE / 沙箱逃逸）。
                options.SetTypeResolver(_safeTypeResolver);

                // 2026-05-01 安全加固：禁止 GetType()、Activator、反射相关 API，
                // 防止用户脚本通过 obj.GetType().Assembly.GetTypes() 绕过黑名单。
                options.Interop.AllowGetType = false;
                options.Interop.AllowSystemReflection = false;

                // Jint 4.14 将 CLR 数组默认改为可写的 LiveView，并默认缓存最近的 CLR 包装器。
                // Microi 历史脚本依赖“数组进入 JS 后是独立快照”的行为，因此显式固定为旧版兼容模式，
                // 避免脚本意外修改宿主数组，或 Copy 模式下因包装器缓存重复读到旧快照。
                options.Interop.ArrayConversion = ArrayConversionMode.Copy;
                options.Interop.CacheRecentObjectWrappers = false;

                // 启用 Task 互操作：允许 C# 的 Task<T>/ValueTask<T> 自动转换为 JS 的 Promise
                // 这样 await V8.FormEngine.GetFormDataAsync(...) 才能正确等待 C# 异步方法
                options.ExperimentalFeatures = Jint.ExperimentalFeature.TaskInterop;

                // 设置 Promise 超时时间，与脚本执行超时保持一致
                // 这样 UnwrapIfPromise() 会使用此配置的超时时间
                options.Constraints.PromiseTimeout = createV8EngineParam.UnlimitedRuntime
                    ? System.Threading.Timeout.InfiniteTimeSpan
                    : TimeSpan.FromSeconds(createV8EngineParam.Timeout);

                // 捕获 CLR 异常并转换为 JS 错误，使 JS 的 try-catch 能捕获 C# 方法抛出的异常
                // 例如：V8.ApiEngine.Run() 抛出的异常可以在 JS 中被 catch 捕获
                options.CatchClrExceptions(ex =>
                {
                    // 返回 true 表示将此异常转换为 JS 错误（可被 JS catch）
                    // 返回 false 表示让异常继续冒泡到 C# 层
                    return true;
                });
            });
            // 日期函数必须早于系统设置应用和自定义全局 V8，保证旧库安装器也能启动。
            GlobalFunctionRegistry.InstallBootstrap(engine);
            return engine;
        }
        /// <summary>
        /// 归还Engine（实现接口方法）
        /// 由于使用的是独立Engine而非对象池，此方法负责释放资源
        /// </summary>
        public void ReturnEngine(Engine engine)
        {
            if (engine != null)
            {
                try
                {
                    engine.Dispose();
                }
                catch
                {
                    // 忽略清理失败
                }
            }
        }

        #endregion

        #region V8引擎参数初始化

        /// <summary>
        /// 初始化V8引擎可访问内置对象
        /// </summary>
        private void V8EngineParamInit(V8EngineParam v8EngineParam)
        {
            if (v8EngineParam.ApiEngine == null)
            {
                v8EngineParam.ApiEngine = MicroiEngine.ApiEngine;
            }
            v8EngineParam.FormEngine = MicroiEngine.FormEngine;
            v8EngineParam.DataSourceEngine = MicroiEngine.DataSource;
            v8EngineParam.ModuleEngine = MicroiEngine.ModuleEngine;
            v8EngineParam.EncryptHelper = _encryptHelper;
            v8EngineParam.IPHelper = _ipHelper;
            v8EngineParam.Http = MicroiEngine.Http;
            v8EngineParam.Method = MicroiEngine.V8Method;
            v8EngineParam.Stream = ApiEngineStreamContext.Current;
            v8EngineParam.Notification = new V8Notification(v8EngineParam.OsClient);
            v8EngineParam.Cache = new V8TenantCache(
                v8EngineParam.OsClient,
                MicroiEngine.CacheTenant.Cache(v8EngineParam.OsClient));
            v8EngineParam.Spider = MicroiEngine.Spider;
            v8EngineParam.OCR = new V8TenantOcr(v8EngineParam.OsClient);
            v8EngineParam.Vision = new V8TenantVision(v8EngineParam.OsClient);
            v8EngineParam.AI = MicroiEngine
                .GetService<IV8TenantAiFactory>()
                .Create(v8EngineParam.OsClient, v8EngineParam.CurrentUser);
            v8EngineParam.Office = MicroiEngine.Office;
            v8EngineParam.MongoDb = MicroiEngine.MongoDB;
            v8EngineParam.MQ = MicroiEngine.MQ;
            v8EngineParam.HDFS = new V8TenantHDFS(v8EngineParam.OsClient);
            v8EngineParam.WFEngine = MicroiEngine.WFEngine;
            v8EngineParam.TranslateEngine = MicroiEngine.Translate;
            var runtimeClientModel = OsClientExtend.GetClient(v8EngineParam.OsClient)?.OsClientModel;
            var safeClientModel = TenantConfigurationSecurity.CreateV8Projection(runtimeClientModel);
            v8EngineParam.OsClientModel = safeClientModel;
            v8EngineParam.ClientModel = safeClientModel.DeepClone();
            v8EngineParam.SysConfig = TenantConfigurationSecurity.CreateV8SysConfigProjection(
                v8EngineParam.SysConfig,
                v8EngineParam.OsClient);
            v8EngineParam.HttpContext = DiyHttpContext.Current;
        }

        #endregion

        #region Run方法（性能优化版本）

        private static Prepared<Script> GetPreparedScript(string code)
        {
            code ??= string.Empty;
            var cacheSize = PreparedScriptCacheSize;
            if (cacheSize <= 0)
            {
                return Engine.PrepareScript(code, "<microi-v8>");
            }

            string hash;
            using (var sha256 = SHA256.Create())
            {
                hash = BitConverter.ToString(sha256.ComputeHash(Encoding.UTF8.GetBytes(code))).Replace("-", string.Empty);
            }
            if (PreparedScriptCache.TryGetValue(hash, out var cached))
            {
                return cached;
            }

            // Prepared<Script> 由 Jint 官方保证可跨 Engine、跨线程复用。
            var prepared = Engine.PrepareScript(code, "<microi-v8>");
            if (!PreparedScriptCache.TryAdd(hash, prepared))
            {
                return PreparedScriptCache[hash];
            }

            PreparedScriptCacheOrder.Enqueue(hash);
            while (PreparedScriptCache.Count > cacheSize
                   && PreparedScriptCacheOrder.TryDequeue(out var oldestHash))
            {
                PreparedScriptCache.TryRemove(oldestHash, out _);
            }
            return prepared;
        }

        internal static Prepared<Script> PrepareExecutableScript(string code)
        {
            try
            {
                return GetPreparedScript(code);
            }
            catch (ScriptPreparationException) when (AwaitKeywordRegex.IsMatch(code ?? string.Empty))
            {
                // 顶层 await 不是普通 Script 语法；仅在原脚本无法解析且确实含 await 时包装，
                // 避免旧版仅靠 Contains("async ") 导致注释/字符串误判。
                return GetPreparedScript(string.Concat("(async function() {\n", code, "\n})()"));
            }
        }

        private static void ApplySyncEvaluationResult(V8EngineParam param, JsValue engineResult)
        {
            // An IIFE that only assigns V8.Result completes with JavaScript undefined.
            // Jint's Undefined.ToObject() is non-null, so treating it as a real return
            // value overwrites the explicit V8.Result and the HTTP response becomes null.
            // Keep the synchronous path aligned with EvaluateAsync below: only a concrete
            // completion value may replace the result explicitly assigned by the script.
            if (engineResult.IsNull() || engineResult.IsUndefined())
            {
                return;
            }

            var result = engineResult.ToObject();
            if (result?.GetType().Name != "Func`3")
            {
                param.Result = result;
            }
        }

        private static CancellationTokenSource CreateExecutionCancellation(
            V8EngineParam param,
            bool unlimitedRuntime)
        {
            var requestToken = param?.HttpContext?.RequestAborted ?? CancellationToken.None;
            var externalToken = param?.ExternalCancellationToken ?? CancellationToken.None;
            var cancellation = CancellationTokenSource.CreateLinkedTokenSource(requestToken, externalToken);
            if (!unlimitedRuntime)
            {
                var timeoutSeconds = (param?.Timeout ?? 0) > 0
                    ? param.Timeout.Value
                    : new CreateV8EngineParam().Timeout;
                cancellation.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
            }
            return cancellation;
        }

        private static bool ExceptionChainContains(Exception exception, params string[] typeNames)
        {
            while (exception != null)
            {
                var typeName = exception.GetType().Name;
                if (typeNames.Any(item => string.Equals(item, typeName, StringComparison.Ordinal)))
                {
                    return true;
                }
                exception = exception.InnerException;
            }
            return false;
        }

        private static MicroiV8MemoryLimitExceededException FindMicroiMemoryException(Exception exception)
        {
            while (exception != null)
            {
                if (exception is MicroiV8MemoryLimitExceededException memoryException)
                {
                    return memoryException;
                }
                exception = exception.InnerException;
            }
            return null;
        }

        private static V8LimitDiagnostic BuildLimitDiagnostic(
            V8EngineParam param,
            Exception exception,
            string effectiveMessage)
        {
            var limits = param?.Limits ?? new V8ExecutionLimitInfo
            {
                TimeoutSeconds = param?.Timeout ?? CreateV8EngineParam.DefaultTimeout,
                MaxStatements = CreateV8EngineParam.DefaultMaxStatements,
                LimitMemoryMB = CreateV8EngineParam.DefaultLimitMemory,
                CallTreeLimitMemoryMB = CreateV8EngineParam.DefaultCallTreeLimitMemory,
                LimitRecursion = CreateV8EngineParam.DefaultLimitRecursion,
                NestedApiDepthLimit = CreateV8EngineParam.DefaultNestedApiDepth,
                IsolateNestedApiMemory = CreateV8EngineParam.DefaultIsolateNestedApiMemory
            };
            var memoryException = FindMicroiMemoryException(exception);
            var isNativeMemoryLimit = ExceptionChainContains(exception, "MemoryLimitExceededException")
                                      || (effectiveMessage?.IndexOf("limited to", StringComparison.OrdinalIgnoreCase) >= 0
                                          && effectiveMessage.IndexOf("allocated", StringComparison.OrdinalIgnoreCase) >= 0);
            var diagnostic = new V8LimitDiagnostic
            {
                RootExecutionId = MicroiV8ExecutionScope.RootExecutionId,
                CurrentDepth = limits.CurrentDepth,
                CallPath = MicroiV8ExecutionScope.GetCallPath(),
                IsBackgroundTask = limits.IsBackgroundTask,
                MemoryAccounting = limits.MemoryAccounting
            };

            if (memoryException != null)
            {
                var isCallTreeMemoryLimit = memoryException
                                            is MicroiV8CallTreeMemoryLimitExceededException;
                diagnostic.Code = isCallTreeMemoryLimit
                    ? "V8_CALL_TREE_MEMORY_LIMIT"
                    : "V8_MEMORY_LIMIT";
                diagnostic.LimitType = isCallTreeMemoryLimit
                    ? "CallTreeAllocatedMemory"
                    : "PerEngineAllocatedMemory";
                diagnostic.Limit = isCallTreeMemoryLimit
                    ? limits.CallTreeLimitMemoryMB
                    : limits.LimitMemoryMB;
                diagnostic.Unit = "MB cumulative allocated bytes";
                diagnostic.Observed = Math.Round(memoryException.AllocatedBytes / 1024d / 1024d, 2);
                diagnostic.Advice = isCallTreeMemoryLimit
                    ? "整棵嵌套调用树累计分配量已超限。检查循环调用、过深编排或返回大对象；后台任务应缩小片段并通过 Checkpoint 续跑。"
                    : limits.IsBackgroundTask
                        ? "这是当前后台任务片段的累计分配量，不是实时占用内存。请缩小单片批次并返回 HasMore/Checkpoint 续跑。"
                        : "这是本层脚本的累计分配量，不是实时占用内存。请减少整表加载、重复 JSON 转换和大数组复制；长任务改为后台分片，或在接口引擎中开启【V8无运行限制】。";
                return diagnostic;
            }

            if (isNativeMemoryLimit)
            {
                diagnostic.Code = limits.IsolateNestedApiMemory
                    ? "V8_CALL_TREE_MEMORY_LIMIT"
                    : "V8_MEMORY_LIMIT";
                diagnostic.LimitType = limits.IsolateNestedApiMemory
                    ? "CallTreeAllocatedMemory"
                    : "AllocatedMemory";
                diagnostic.Limit = limits.IsolateNestedApiMemory
                    ? limits.CallTreeLimitMemoryMB
                    : limits.LimitMemoryMB;
                diagnostic.Unit = "MB cumulative allocated bytes";
                diagnostic.Advice = limits.IsolateNestedApiMemory
                    ? "整棵嵌套调用树累计分配量已超限。检查循环调用、过深编排或返回大对象；后台任务应缩小片段并通过 Checkpoint 续跑。"
                    : "累计分配量已超限；该值不是实时堆占用。建议启用嵌套预算隔离并将长任务分片。";
                return diagnostic;
            }

            if (ExceptionChainContains(exception, "StatementsCountOverflowException"))
            {
                diagnostic.Code = "V8_STATEMENTS_LIMIT";
                diagnostic.LimitType = "MaxStatements";
                diagnostic.Limit = limits.MaxStatements;
                diagnostic.Unit = "JavaScript statements";
                diagnostic.Advice = limits.IsBackgroundTask
                    ? "当前片段执行语句过多，请减少每片处理数量并保存 Checkpoint。"
                    : "检查无界循环，并将大批量循环改为后台任务分片。";
                return diagnostic;
            }

            if (ExceptionChainContains(exception, "RecursionDepthOverflowException"))
            {
                diagnostic.Code = "V8_RECURSION_LIMIT";
                diagnostic.LimitType = "JavaScriptRecursion";
                diagnostic.Limit = limits.LimitRecursion;
                diagnostic.Unit = "JavaScript call frames";
                diagnostic.Advice = "该限制针对单个脚本函数递归，不等同于接口引擎嵌套层数；请检查递归终止条件或改为迭代。";
                return diagnostic;
            }

            if (ExceptionChainContains(
                    exception,
                    "TimeoutException",
                    "ExecutionCanceledException",
                    "TaskCanceledException",
                    "OperationCanceledException"))
            {
                diagnostic.Code = "V8_TIMEOUT";
                diagnostic.LimitType = "Timeout";
                diagnostic.Limit = limits.TimeoutSeconds;
                diagnostic.Unit = "seconds per execution slice";
                diagnostic.Advice = limits.IsBackgroundTask
                    ? "后台任务总时长可以超过该值，但单个执行片段不能。请在超时前返回 HasMore/Checkpoint，由 Worker 续跑下一片。"
                    : "不要用一个 HTTP 请求承载超长业务；改用持久化后台任务并按片段续跑。";
                return diagnostic;
            }

            return null;
        }

        private sealed class V8LimitDiagnostic
        {
            public string Code { get; set; }
            public string LimitType { get; set; }
            public double Limit { get; set; }
            public string Unit { get; set; }
            public double? Observed { get; set; }
            public string Advice { get; set; }
            public string RootExecutionId { get; set; }
            public int CurrentDepth { get; set; }
            public IReadOnlyList<string> CallPath { get; set; }
            public bool IsBackgroundTask { get; set; }
            public string MemoryAccounting { get; set; }
        }

        /// <summary>
        /// 执行V8引擎代码（已优化：独立Engine+脚本缓存+热路径检测）
        /// </summary>
        public async Task<DosResult<V8EngineParam>> Run(V8EngineParam param)
        {
            Engine engine = null;
            bool isNewEngine = false;
            V8ExecutionLease executionLease = null;
            JintHostEnvironment hostEnvironment = null;
            IDisposable executionScope = null;
            var parentMemoryExclusion = MicroiV8ExecutionScope.PauseCurrentExclusiveMemory();
            // V8 租户隔离：进入 V8 执行上下文，非主库租户的 V8 代码将被禁止跨租户访问
            IDisposable tenantScope = null;
            try
            {
                var isNestedExecution = MicroiV8ExecutionScope.IsActive;
                var requestedDepth = MicroiV8ExecutionScope.Depth + 1;
                var depthLimit = param?.Limits?.NestedApiDepthLimit > 0
                    ? param.Limits.NestedApiDepthLimit
                    : CreateV8EngineParam.DefaultNestedApiDepth;
                depthLimit = Math.Max(1, Math.Min(depthLimit, CreateV8EngineParam.MaxNestedApiDepth));
                if (requestedDepth > depthLimit)
                {
                    var callPath = MicroiV8ExecutionScope.GetCallPath(
                        !string.IsNullOrWhiteSpace(param?.ApiEngineKey) ? param.ApiEngineKey : param?.EventName);
                    return new DosResult<V8EngineParam>(
                        0,
                        null,
                        $"V8嵌套调用深度已达到上限 {depthLimit} 层，请检查循环调用或拆分业务编排。",
                        new
                        {
                            V8Limit = new
                            {
                                Code = "V8_NESTED_DEPTH_LIMIT",
                                LimitType = "NestedApiDepth",
                                Limit = depthLimit,
                                Current = requestedDepth,
                                CallPath = callPath
                            }
                        });
                }

                executionLease = await TryAcquireV8ExecutionLease(param, isNestedExecution);
                if (executionLease == null)
                {
                    return new DosResult<V8EngineParam>(
                        0,
                        null,
                        "系统繁忙，V8 引擎执行队列已满，请稍后重试。",
                        new
                        {
                            V8Limit = new
                            {
                                Code = "V8_EXECUTION_QUEUE_TIMEOUT",
                                LimitType = "ConcurrencyQueue",
                                WaitMilliseconds = V8ExecutionWaitMilliseconds,
                                IsNestedExecution = isNestedExecution
                            }
                        });
                }
                var aiApplicationUserId = param?.Param?["UserId"]?.ToString();
                tenantScope = V8TenantContext.Enter(
                    param.OsClient,
                    param.ApiEngineKey,
                    param.EventName,
                    param.DbTrans,
                    aiApplicationUserId);
                V8EngineParamInit(param);

                // ========== 判断Engine来源 ==========
                // 如果调用者传入了自定义Engine，使用传入的
                // 否则创建新的独立Engine实例
                if (param.Engine == null)
                {
                    engine = CreateEngine();
                    isNewEngine = true;
                }
                else
                {
                    engine = param.Engine;
                    isNewEngine = false;
                }

                var memoryConstraint = engine.Constraints.Find<MicroiV8MemoryConstraint>();
                var callTreeMemoryConstraint = engine.Constraints
                    .Find<MicroiV8CallTreeMemoryConstraint>();
                if (param.Limits == null)
                {
                    var defaults = new CreateV8EngineParam();
                    defaults.Normalize();
                    param.Limits = new V8ExecutionLimitInfo
                    {
                        TimeoutSeconds = param.Timeout ?? defaults.Timeout,
                        MaxStatements = defaults.MaxStatements,
                        LimitMemoryMB = defaults.LimitMemory,
                        CallTreeLimitMemoryMB = defaults.CallTreeLimitMemory,
                        LimitRecursion = defaults.LimitRecursion,
                        NestedApiDepthLimit = defaults.NestedApiDepth,
                        IsolateNestedApiMemory = defaults.IsolateNestedApiMemory
                    };
                }
                param.Limits.CurrentDepth = requestedDepth;
                // Capture the server-computed capability before exposing V8.Limits
                // to JavaScript. Script code cannot elevate itself by mutating the
                // diagnostic object while timers/promises are being drained.
                var unlimitedRuntime = param.Limits.UnlimitedRuntime;
                executionScope = MicroiV8ExecutionScope.Enter(
                    param.OsClient,
                    !string.IsNullOrWhiteSpace(param.ApiEngineKey) ? param.ApiEngineKey : param.EventName,
                    memoryConstraint,
                    callTreeMemoryConstraint,
                    param.ExternalCancellationToken);

                engine.SetValue("V8", param);

                // 注入所有已注册的扩展对象（Alipay、WeChat 等）
                // 扩展注册由 Microi.V8Engine 在 V8BuiltInExtensions 中管理
                MicroiEngine.GetService<IV8ExtensionInjector>().InjectAll(engine);

                // 注入宿主环境API
                hostEnvironment = new JintHostEnvironment();
                hostEnvironment.InjectTo(engine, param);

                // Jint 的 MemoryLimitConstraint 统计的是当前线程自上次 Reset 起的
                // 累计分配量，而不是实时存活堆。Engine 在 ApiEngine 中会先创建，
                // 随后还要构造 V8 参数、注入扩展及宿主对象；这些平台准备工作不应
                // 消耗用户脚本的内存预算。全局 V8 与接口 V8 会分别进入 Run，因此
                // 每个执行阶段各自获得完整预算，同时脚本及其 CLR 调用仍受限制。
                engine.Constraints.Reset();

                // 同步执行路径
                if (param.SyncRun == true)
                {
                    var engineResult = engine.Evaluate(GetPreparedScript(param.V8Code));
                    if (param.V8Code.Contains("return "))
                    {
                        ApplySyncEvaluationResult(param, engineResult);
                    }
                    using (var executionCancellation = CreateExecutionCancellation(param, unlimitedRuntime))
                    {
                        await hostEnvironment
                            .DrainTimersAsync(engine, executionCancellation.Token)
                            .ConfigureAwait(false);
                    }
                    param.SyncRun = null;
                    return new DosResult<V8EngineParam>(1, param);
                }
                else
                {
                    // 4.6+ 的 EvaluateAsync 会非阻塞地等待 Promise；Prepared<Script> 避免每次重复解析。
                    // 同步脚本也可走此路径，若结果不是 Promise 会立即完成。
                    using var executionCancellation = CreateExecutionCancellation(param, unlimitedRuntime);
                    var preparedScript = PrepareExecutableScript(param.V8Code);
                    var evaluateResult = await engine
                        .EvaluateAsync(preparedScript, executionCancellation.Token)
                        .ConfigureAwait(false);

                    if (!evaluateResult.IsNull() && !evaluateResult.IsUndefined())
                    {
                        param.Result = evaluateResult.ToObject();
                    }

                    // setTimeout 是请求作用域调度：所有回调都在当前 Engine 上串行执行，
                    // 完成后才释放 Engine，杜绝跨线程访问及引擎释放后的回调。
                    await hostEnvironment
                        .DrainTimersAsync(engine, executionCancellation.Token)
                        .ConfigureAwait(false);

                    return new DosResult<V8EngineParam>(1, param);
                }
            }
            catch (Exception ex)
            {
                var javascriptException = ex as Jint.Runtime.JavaScriptException;
                var lineNumber = javascriptException?.Location.Start.Line ?? 0;
                var columnNumber = javascriptException?.Location.Start.Column ?? 0;
                var locationText = lineNumber > 0
                    ? $"，脚本位置=[行:{lineNumber},列:{columnNumber}]"
                    : "";
                var contextText =
                    $"OsClient=[{param?.OsClient ?? "-"}]，ApiEngineKey=[{param?.ApiEngineKey ?? "-"}]，EventName=[{param?.EventName ?? "-"}]";
                var innerMostException = ex;
                while (innerMostException.InnerException != null)
                {
                    innerMostException = innerMostException.InnerException;
                }
                var effectiveMessage = string.IsNullOrWhiteSpace(innerMostException.Message)
                    ? ex.Message
                    : innerMostException.Message;
                var isCancellationException = ExceptionChainContains(
                    ex,
                    "ExecutionCanceledException",
                    "TaskCanceledException",
                    "OperationCanceledException");
                if (isCancellationException
                    && ((param?.ExternalCancellationToken.IsCancellationRequested ?? false)
                        || (param?.HttpContext?.RequestAborted.IsCancellationRequested ?? false)))
                {
                    var cancellationToken = param?.ExternalCancellationToken.IsCancellationRequested == true
                        ? param.ExternalCancellationToken
                        : param?.HttpContext?.RequestAborted ?? CancellationToken.None;
                    throw new OperationCanceledException("V8执行已由请求方、后台任务或节点停止信号取消。", ex, cancellationToken);
                }

                var limitDiagnostic = BuildLimitDiagnostic(param, ex, effectiveMessage);

                MicroiEngine.QueueSystemLog(
                    param?.OsClient,
                    "V8",
                    limitDiagnostic == null ? "ExecutionFailed" : limitDiagnostic.Code,
                    limitDiagnostic == null ? "V8Engine.Run 执行异常" : "V8执行触发资源预算",
                    $"{contextText}{locationText}，异常=[{effectiveMessage}]"
                    + (limitDiagnostic == null
                        ? ""
                        : $"，限制类型=[{limitDiagnostic.LimitType}]，限制值=[{limitDiagnostic.Limit} {limitDiagnostic.Unit}]，调用深度=[{limitDiagnostic.CurrentDepth}]"),
                    3,
                    false,
                    !string.IsNullOrWhiteSpace(param?.ApiEngineKey) ? param.ApiEngineKey : param?.EventName,
                    ex.StackTrace?.Length > 2000 ? ex.StackTrace.Substring(0, 2000) : ex.StackTrace);

                var errorDetails = new
                {
                    Message = ex.Message,
                    ExceptionType = ex.GetType().Name,
                    InnerException = ex.InnerException?.Message,
                    Location = javascriptException?.Location.ToString(),
                    LineNumber = lineNumber,
                    Column = columnNumber,
                    ReflectionError = (ex.InnerException as System.Reflection.TargetInvocationException)?.InnerException?.Message
                };

                var detailedMessage = ex.Message;
                if (errorDetails.LineNumber > 0)
                {
                    detailedMessage += $" [行:{errorDetails.LineNumber}, 列:{errorDetails.Column}]";
                }
                if (!string.IsNullOrEmpty(errorDetails.InnerException))
                {
                    detailedMessage += $"\n内部异常: {errorDetails.InnerException}";
                }
                if (!string.IsNullOrEmpty(errorDetails.ReflectionError))
                {
                    detailedMessage += $"\n反射错误: {errorDetails.ReflectionError}";
                }

                if (limitDiagnostic != null)
                {
                    detailedMessage = $"{limitDiagnostic.Code}：{detailedMessage}\n{limitDiagnostic.Advice}";
                }

                return new DosResult<V8EngineParam>(
                    0,
                    null,
                    detailedMessage,
                    limitDiagnostic == null ? null : new { V8Limit = limitDiagnostic });
            }
            finally
            {
                // 退出 V8 租户隔离上下文（恢复上一层上下文）
                executionScope?.Dispose();
                tenantScope?.Dispose();
                executionLease?.Dispose();
                hostEnvironment?.Dispose();
                parentMemoryExclusion?.Dispose();

                // 如果是我们创建的新Engine，需要在使用后立即释放
                if (isNewEngine && engine != null)
                {
                    ReturnEngine(engine);
                }
            }
        }

        #endregion
    }
}
