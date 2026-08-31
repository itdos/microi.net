using Microsoft.AspNetCore.Http;
using Microi.net;
using Dos.Common;
using System;
using System.Net;
using System.Threading.Tasks;
using Newtonsoft.Json;
using MySql.Data.MySqlClient;
using Jint.Runtime;
using System.IO;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;

// ASP.NET Core 全局异常协议适配层。
namespace Microi.net.Api
{
    internal sealed class ApiExceptionDiagnostic
    {
        public string ErrorType { get; set; }
        public string ExceptionType { get; set; }
        public string RootCauseType { get; set; }
        public string RootCauseSummary { get; set; }
        public string RecoverySuggestion { get; set; }
        public string DevelopmentDetail { get; set; }
    }

    /// <summary>
    /// API 异常的安全投影。客户端只收到可操作的根因摘要和 TraceId，永不返回原始
    /// StackTrace、连接串、密码或 Token；完整堆栈仅保留在服务端诊断日志中。
    /// </summary>
    internal static class ApiExceptionDiagnostics
    {
        private const string DefaultRecoverySuggestion =
            "请使用 TraceId 查询系统日志，修复对应依赖、数据或配置后重试。";
        internal const string SanitizationFailureSummary = "异常摘要已隐藏（脱敏处理超时）";
        private const int MaxSanitizerInputLength = 4096;
        private const int MaxSummaryLength = 320;
        private const int MaxExceptionGraphNodes = 32;
        private const int MaxExceptionGraphDepth = 12;

        private static readonly Regex StackFrameRegex = new Regex(
            @"(?m)(?:\r?\n|\s{2,})\s*at\s+[A-Za-z_][A-Za-z0-9_.+`<>]*\s*\(",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex ServiceConnectionUriRegex = new Regex(
            @"\b(mongodb(?:\+srv)?|redis(?:s)?|mysql|postgres(?:ql)?|sqlserver)://[^\s,;]+",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex UriUserInfoRegex = new Regex(
            @"\b([a-z][a-z0-9+.-]*://)(?:[^/@\s]+)@",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex BearerRegex = new Regex(
            @"\bBearer\s+[A-Za-z0-9._~+/=-]+",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex JwtRegex = new Regex(
            @"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex SensitiveAssignmentRegex = new Regex(
            @"(?<prefix>(?<![A-Za-z0-9_.-])(?:""|')?(?:(?:connection(?:[_\s-]?string)?|db(?:mongo)?conn(?:ection)?|authorization|cookie)|(?:[A-Za-z0-9_.-]{0,48}(?:password|pwd|passkey|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)[A-Za-z0-9_.-]{0,24}))(?:""|')?\s*[:=]\s*)(?:""(?:\\.|[^""\\])*""|'(?:\\.|[^'\\])*'|[^,;}\]\r\n\s]+)",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex ConnectionSegmentRegex = new Regex(
            @"(?<prefix>(?<![A-Za-z0-9_.-])(?:""|')?(?:server|host|data\s+source|database|initial\s+catalog|user\s+id|uid|username|user)(?:""|')?\s*[:=]\s*)(?:""(?:\\.|[^""\\])*""|'(?:\\.|[^'\\])*'|[^,;}\]\r\n\s]+)",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex SecretQueryRegex = new Regex(
            @"([?&](?:[A-Za-z0-9_.-]{0,48}(?:token|password|pwd|secret|api[_-]?key|access[_-]?key)[A-Za-z0-9_.-]{0,24})=)[^&#\s]+",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex WindowsPathRegex = new Regex(
            @"(?<![A-Za-z0-9])(?:[A-Za-z]:\\|\\\\)[^""'<>\r\n,;]*",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex UnixPathRegex = new Regex(
            @"(?<![A-Za-z0-9])/(?:home|var|etc|usr|opt|tmp|root|Users)/[^""'<>\r\n,;]*",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex WhitespaceRegex = new Regex(
            @"\s+",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private sealed class ExceptionGraphNode
        {
            internal Exception Exception { get; set; }
            internal int Depth { get; set; }
        }

        internal static ApiExceptionDiagnostic Create(Exception exception, string recoverySuggestion = null)
        {
            exception ??= new InvalidOperationException("未知服务端异常");
            var errorType = GetErrorType(exception);
            var rootCause = FindRootCause(exception, errorType);
            return new ApiExceptionDiagnostic
            {
                ErrorType = errorType,
                ExceptionType = exception.GetType().Name,
                RootCauseType = rootCause.GetType().Name,
                RootCauseSummary = SanitizeMessage(rootCause.Message),
                RecoverySuggestion = string.IsNullOrWhiteSpace(recoverySuggestion)
                    ? GetRecoverySuggestion(exception)
                    : recoverySuggestion,
                DevelopmentDetail = BuildDevelopmentDetail(exception)
            };
        }

        internal static string BuildUserMessage(
            string leadingMessage,
            ApiExceptionDiagnostic diagnostic,
            string traceId)
        {
            var message = new StringBuilder((leadingMessage ?? "服务器处理失败。").Trim());
            if (message.Length > 0 && message[message.Length - 1] != '。') message.Append('。');
            message.Append("异常类型：").Append(diagnostic.RootCauseType)
                .Append("；根因：").Append(diagnostic.RootCauseSummary)
                .Append("；TraceId：").Append(SanitizeIdentifier(traceId));
            if (!string.IsNullOrWhiteSpace(diagnostic.RecoverySuggestion)
                && (leadingMessage == null
                    || leadingMessage.IndexOf(diagnostic.RecoverySuggestion, StringComparison.Ordinal) < 0))
            {
                message.Append("；恢复建议：").Append(diagnostic.RecoverySuggestion);
            }
            return message.Append('。').ToString();
        }

        internal static string SanitizeMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return "未提供可安全显示的异常摘要";

            // 异常消息可能包含用户输入且没有长度上限。先限制扫描窗口，再执行所有带超时的
            // 脱敏规则；任一步超时都返回固定摘要，绝不能回退原始消息。
            var safe = message.Length <= MaxSanitizerInputLength
                ? message
                : message.Substring(0, MaxSanitizerInputLength);
            try
            {
                var stackLabelIndex = safe.IndexOf("StackTrace", StringComparison.OrdinalIgnoreCase);
                if (stackLabelIndex >= 0) safe = safe.Substring(0, stackLabelIndex);
                var stackFrame = StackFrameRegex.Match(safe);
                if (stackFrame.Success) safe = safe.Substring(0, stackFrame.Index);

                safe = NormalizeControlCharacters(safe);
                safe = ReplaceSensitivePatternOrFallback(safe, BearerRegex, "Bearer ***");
                safe = ReplaceSensitivePatternOrFallback(safe, JwtRegex, "***");
                safe = ReplaceSensitivePatternOrFallback(safe, ServiceConnectionUriRegex, "$1://***");
                safe = ReplaceSensitivePatternOrFallback(safe, UriUserInfoRegex, "$1***@");
                safe = ReplaceSensitivePatternOrFallback(safe, SecretQueryRegex, "$1***");
                safe = ReplaceSensitivePatternOrFallback(safe, SensitiveAssignmentRegex, "${prefix}***");
                safe = ReplaceSensitivePatternOrFallback(safe, ConnectionSegmentRegex, "${prefix}***");
                safe = ReplaceSensitivePatternOrFallback(safe, WindowsPathRegex, "[path]");
                safe = ReplaceSensitivePatternOrFallback(safe, UnixPathRegex, "[path]");
                safe = ReplaceSensitivePatternOrFallback(safe, WhitespaceRegex, " ").Trim();
            }
            catch (RegexMatchTimeoutException)
            {
                return SanitizationFailureSummary;
            }

            if (string.Equals(safe, SanitizationFailureSummary, StringComparison.Ordinal)) return safe;
            if (safe.Length > MaxSummaryLength) safe = safe.Substring(0, MaxSummaryLength) + "...";
            return safe.Length == 0 ? "未提供可安全显示的异常摘要" : safe;
        }

        internal static string ReplaceSensitivePatternOrFallback(string input, Regex pattern, string replacement)
        {
            try
            {
                return pattern.Replace(input ?? string.Empty, replacement ?? string.Empty);
            }
            catch (RegexMatchTimeoutException)
            {
                return SanitizationFailureSummary;
            }
        }

        internal static bool IsPressureException(Exception exception)
        {
            foreach (var current in EnumerateExceptionGraph(exception))
            {
                if (IsPressureMessage(current.Message)) return true;
            }
            return false;
        }

        private static Exception FindRootCause(Exception exception, string errorType)
        {
            var nodes = BuildExceptionGraph(exception);
            ExceptionGraphNode matched = null;
            foreach (var node in nodes)
            {
                var isMatch = string.Equals(errorType, RequestBodyLimitError.ErrorType, StringComparison.Ordinal)
                    ? RequestBodyLimitError.IsDirectRequestBodyTooLarge(node.Exception)
                    : string.Equals(errorType, "ServerPressure", StringComparison.Ordinal)
                        ? IsPressureMessage(node.Exception.Message)
                        : string.Equals(errorType, "RequestTimeout", StringComparison.Ordinal)
                            && node.Exception is TimeoutException;
                if (isMatch && (matched == null || node.Depth > matched.Depth)) matched = node;
            }

            if (matched != null) return matched.Exception;
            var deepest = nodes[0];
            foreach (var node in nodes)
                if (node.Depth > deepest.Depth) deepest = node;
            return deepest.Exception;
        }

        private static string BuildDevelopmentDetail(Exception exception)
        {
            var parts = new List<string>();
            foreach (var current in EnumerateExceptionGraph(exception))
            {
                parts.Add(current.GetType().Name + ": " + SanitizeMessage(current.Message));
                if (parts.Count >= 8) break;
            }
            return string.Join(" -> ", parts);
        }

        private static string GetErrorType(Exception exception)
        {
            if (RequestBodyLimitError.IsRequestBodyTooLarge(exception)) return RequestBodyLimitError.ErrorType;
            if (IsPressureException(exception)) return "ServerPressure";
            if (ContainsException<TimeoutException>(exception)) return "RequestTimeout";
            return "UnhandledServerError";
        }

        private static string GetRecoverySuggestion(Exception exception)
        {
            if (RequestBodyLimitError.IsRequestBodyTooLarge(exception)) return RequestBodyLimitError.Solution;
            if (IsPressureException(exception))
                return "等待系统压力下降后重试；若持续出现，请使用 TraceId 检查连接池、数据库连接数和 V8 执行队列。";
            if (ContainsException<TimeoutException>(exception))
                return "稍后重试；若持续出现，请使用 TraceId 检查依赖服务、数据库慢查询和接口超时配置。";
            return DefaultRecoverySuggestion;
        }

        internal static bool ContainsException<TException>(Exception exception) where TException : Exception
        {
            foreach (var current in EnumerateExceptionGraph(exception))
                if (current is TException) return true;
            return false;
        }

        internal static IReadOnlyList<Exception> EnumerateExceptionGraph(Exception exception)
        {
            var result = new List<Exception>();
            foreach (var node in BuildExceptionGraph(exception)) result.Add(node.Exception);
            return result;
        }

        private static List<ExceptionGraphNode> BuildExceptionGraph(Exception exception)
        {
            var root = exception ?? new InvalidOperationException("未知服务端异常");
            var result = new List<ExceptionGraphNode>();
            var seen = new HashSet<Exception>();
            var pending = new Stack<ExceptionGraphNode>();
            pending.Push(new ExceptionGraphNode { Exception = root, Depth = 0 });
            while (pending.Count > 0 && result.Count < MaxExceptionGraphNodes)
            {
                var node = pending.Pop();
                if (node.Exception == null || !seen.Add(node.Exception)) continue;
                result.Add(node);
                if (node.Depth >= MaxExceptionGraphDepth) continue;

                var children = GetDirectInnerExceptions(node.Exception);
                for (var index = children.Count - 1; index >= 0; index--)
                {
                    pending.Push(new ExceptionGraphNode
                    {
                        Exception = children[index],
                        Depth = node.Depth + 1
                    });
                }
            }
            return result;
        }

        private static List<Exception> GetDirectInnerExceptions(Exception exception)
        {
            var result = new List<Exception>();
            if (exception is AggregateException aggregate)
            {
                foreach (var inner in aggregate.InnerExceptions)
                    if (inner != null) result.Add(inner);
                return result;
            }

            if (exception is ReflectionTypeLoadException reflectionTypeLoad)
            {
                if (reflectionTypeLoad.InnerException != null) result.Add(reflectionTypeLoad.InnerException);
                foreach (var loaderException in reflectionTypeLoad.LoaderExceptions)
                    if (loaderException != null) result.Add(loaderException);
                return result;
            }

            if (exception.InnerException != null) result.Add(exception.InnerException);
            return result;
        }

        private static bool IsPressureMessage(string message)
        {
            message ??= string.Empty;
            return message.IndexOf("Database connection pressure protection is active", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("Database connection open is throttled", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("V8 引擎执行队列已满", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("blocked because of many connection errors", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("mysqladmin flush-hosts", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("too many connections", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("max_user_connections", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("connection pool", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string NormalizeControlCharacters(string value)
        {
            var builder = new StringBuilder(value.Length);
            foreach (var character in value)
            {
                var category = char.GetUnicodeCategory(character);
                builder.Append(char.IsControl(character) || category == UnicodeCategory.Format ? ' ' : character);
            }
            return builder.ToString();
        }

        private static string SanitizeIdentifier(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "unknown";
            var safe = value.Replace("\r", string.Empty).Replace("\n", string.Empty).Trim();
            return safe.Length <= 128 ? safe : safe.Substring(0, 128);
        }
    }

    /// <summary>
    /// 识别请求体在进入 Controller/HDFS 业务校验前被 ASP.NET Core 拒绝的场景。
    /// 反向代理在进程外返回的 413 不会进入此分类器，必须由代理自身提高上限或改写响应。
    /// </summary>
    public static class RequestBodyLimitError
    {
        public const string ErrorType = "UploadRequestTooLarge";
        public const string Layer = "Microi.Api";
        public const string Solution =
            "请提高反向代理 nginx 的 client_max_body_size，使其大于实际 multipart 请求总大小；" +
            "吾码 API 已提供统一的 2048MB 接收硬顶，租户业务额度请在 SaaS 引擎中配置。";

        public static bool IsRequestBodyTooLarge(Exception ex)
        {
            foreach (var current in ApiExceptionDiagnostics.EnumerateExceptionGraph(ex))
            {
                if (IsDirectRequestBodyTooLarge(current)) return true;
            }

            return false;
        }

        internal static bool IsDirectRequestBodyTooLarge(Exception current)
        {
            if (current is BadHttpRequestException badRequest
                && badRequest.StatusCode == StatusCodes.Status413PayloadTooLarge)
            {
                return true;
            }

            var message = current?.Message ?? string.Empty;
            return (current is InvalidDataException || current is BadHttpRequestException)
                   && ContainsLimitMarker(message);
        }

        public static bool IsHdfsUploadPath(PathString path)
        {
            return path.StartsWithSegments("/api/HDFS/Upload", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWithSegments("/api/HDFS/UploadAnonymous", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWithSegments("/api/HDFS/FileManageUpload", StringComparison.OrdinalIgnoreCase);
        }

        public static string GetUserMessage(PathString path)
        {
            var prefix = IsHdfsUploadPath(path)
                ? "上传请求在进入 HDFS 业务校验前超过了吾码 API 的 HTTP/Multipart 解析上限。"
                : "请求正文在进入业务接口前超过了吾码 API 的 HTTP/Multipart 解析上限。";
            return prefix
                   + "SaaS 引擎中的单文件上限和单次总量只负责租户业务额度，不能放大启动级 HTTP 上限。"
                   + Solution;
        }

        private static bool ContainsLimitMarker(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return false;
            return message.IndexOf("request body too large", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("request body size", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("multipart body length limit", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("multipart body length", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("content too large", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("request entity too large", StringComparison.OrdinalIgnoreCase) >= 0
                   || message.IndexOf("413 payload too large", StringComparison.OrdinalIgnoreCase) >= 0;
        }
    }

    /// <summary>
    /// 全局异常处理中间件
    /// 自动追踪和诊断所有未处理的异常
    /// </summary>
    public class GlobalExceptionHandler
    {
        private readonly RequestDelegate _next;

        public GlobalExceptionHandler(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                if (context.Response.HasStarted)
                {
                    throw;
                }
                await HandleExceptionAsync(context, ex);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception ex)
        {
            var (statusCode, leadingMessage, errorType, layer, solution) =
                GetErrorResponse(ex, context.Request.Path);
            var diagnostic = ApiExceptionDiagnostics.Create(ex, solution);
            var traceId = context.TraceIdentifier;

            // 请求级异常进入异步MongoDB日志，不再污染平台启动/致命故障Console。
            var exceptionContext = $"{context.Request.Method} {context.Request.Path}";
            try
            {
                MicroiEngine.QueueSysLog(new SysLogParam()
                {
                    Type = "全局异常",
                    Title = $"全局异常捕获: {exceptionContext}",
                    Content = $"TraceId={traceId}; ExceptionType={diagnostic.ExceptionType}; " +
                              $"RootCauseType={diagnostic.RootCauseType}; " +
                              $"RootCauseSummary={diagnostic.RootCauseSummary}",
                    OtherInfo = ex.StackTrace?.Length > 2000 ? ex.StackTrace.Substring(0, 2000) : ex.StackTrace,
                    Level = 3,
                    Api = context.Request.Path.ToString(),
                    IP = context.Connection?.RemoteIpAddress?.ToString()
                });
            }
            catch
            {
                // 异常日志基础设施不可用时，仍必须把标准 DosResult 返回给调用方。
            }

            context.Response.Clear();
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)statusCode;

            var errorResponse = new
            {
                Code = 0,
                Data = (object)null,
                Msg = ApiExceptionDiagnostics.BuildUserMessage(leadingMessage, diagnostic, traceId),
                DataAppend = new
                {
                    TraceId = traceId,
                    ErrorType = errorType ?? diagnostic.ErrorType,
                    Layer = layer,
                    Solution = solution ?? diagnostic.RecoverySuggestion,
                    RecoverySuggestion = diagnostic.RecoverySuggestion,
                    ExceptionType = diagnostic.ExceptionType,
                    RootCauseType = diagnostic.RootCauseType,
                    RootCauseSummary = diagnostic.RootCauseSummary,
                    Path = context.Request.Path.ToString(),
                    Method = context.Request.Method,
                    Timestamp = DateTime.UtcNow,
                    // 开发环境可看到经过同一脱敏器处理的异常链；任何环境均不返回 StackTrace。
                    DevelopmentDetail = IsDevelopment() ? diagnostic.DevelopmentDetail : null
                }
            };

            await context.Response.WriteAsync(JsonConvert.SerializeObject(errorResponse));
        }

        /// <summary>
        /// 根据异常类型返回合适的错误信息
        /// </summary>
        private (HttpStatusCode statusCode, string message, string? errorType, string? layer, string? solution)
            GetErrorResponse(Exception ex, PathString requestPath)
        {
            if (RequestBodyLimitError.IsRequestBodyTooLarge(ex))
            {
                return (
                    HttpStatusCode.OK,
                    RequestBodyLimitError.GetUserMessage(requestPath),
                    RequestBodyLimitError.ErrorType,
                    RequestBodyLimitError.Layer,
                    RequestBodyLimitError.Solution);
            }

            if (ApiExceptionDiagnostics.IsPressureException(ex))
            {
                return (HttpStatusCode.OK, "系统繁忙，当前请求较多或数据库连接压力较高，请稍后重试。", "ServerPressure", "Microi.Api", null);
            }

            if (ApiExceptionDiagnostics.ContainsException<TimeoutException>(ex))
            {
                return (HttpStatusCode.OK, "系统处理超时，请稍后重试。", "RequestTimeout", "Microi.Api", null);
            }

            return ex switch
            {
                // // MySQL 异常
                // MySqlException mysqlEx => (
                //     HttpStatusCode.OK,//InternalServerError,
                //     GetMySqlErrorMessage(mysqlEx)
                // ),

                // // JavaScript 引擎异常
                // JavaScriptException jsEx => (
                //     HttpStatusCode.OK,//InternalServerError,
                //     $"JavaScript 执行错误: {jsEx.Message}"
                // ),

                // // 类型转换异常
                // InvalidCastException castEx => (
                //     HttpStatusCode.OK,//BadRequest,
                //     $"数据类型转换错误: {castEx.Message}"
                // ),

                // // 超时异常
                // TimeoutException timeoutEx => (
                //     HttpStatusCode.OK,//RequestTimeout,
                //     $"请求超时: {timeoutEx.Message}"
                // ),

                // // 参数异常
                // ArgumentNullException or ArgumentException => (
                //     HttpStatusCode.OK,//BadRequest,
                //     $"参数错误: {ex.Message}"
                // ),

                // // 未授权异常
                // UnauthorizedAccessException => (
                //     HttpStatusCode.OK,//Unauthorized,
                //     "未授权访问"
                // ),

                // 默认异常
                _ => (
                    HttpStatusCode.OK,//InternalServerError,
                    "服务器处理失败。",
                    "UnhandledServerError",
                    "Microi.Api",
                    null
                )
            };
        }

        /// <summary>
        /// 获取友好的 MySQL 错误信息
        /// </summary>
        private string GetMySqlErrorMessage(MySqlException ex)
        {
            return ex.Number switch
            {
                1042 => "无法连接到 MySQL 数据库服务器，请检查网络连接",
                1045 => "MySQL 认证失败，用户名或密码错误",
                1049 => "MySQL 数据库不存在",
                1146 => "数据表不存在",
                1062 => "数据重复，违反唯一约束",
                1064 => "SQL 语法错误",
                2002 => "MySQL 服务器连接超时",
                2003 => "无法连接到 MySQL 服务器（端口不可达）",
                2006 => "MySQL 服务器连接已断开",
                _ => IsDevelopment() 
                    ? $"MySQL 错误 ({ex.Number}): {ex.Message}" 
                    : "数据库操作失败，请稍后重试"
            };
        }

        /// <summary>
        /// 判断是否开发环境
        /// </summary>
        private bool IsDevelopment()
        {
            return string.Equals(
                Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                "Development",
                StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>
    /// 全局异常处理中间件扩展方法
    /// </summary>
    public static class GlobalExceptionHandlerExtensions
    {
        public static IApplicationBuilder UseGlobalExceptionHandler(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<GlobalExceptionHandler>();
        }
    }
}
