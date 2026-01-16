using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microi.net;
using Dos.Common;
using System;
using System.Net;
using System.Threading.Tasks;
using Newtonsoft.Json;
using MySql.Data.MySqlClient;
using Jint.Runtime;

namespace Microi.net.Api
{
    /// <summary>
    /// 全局异常处理中间件
    /// 自动追踪和诊断所有未处理的异常
    /// </summary>
    public class GlobalExceptionHandler
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<GlobalExceptionHandler> _logger;

        public GlobalExceptionHandler(RequestDelegate next, ILogger<GlobalExceptionHandler> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                await HandleExceptionAsync(context, ex);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception ex)
        {
            // 自动追踪异常到诊断系统
            var exceptionContext = $"{context.Request.Method} {context.Request.Path}";
            ExceptionDiagnostics.TrackException(ex, exceptionContext);

            // 记录日志
            _logger.LogError(ex, $"全局异常捕获: {exceptionContext}");

            // 根据异常类型返回不同的错误信息
            var (statusCode, userMessage) = GetErrorResponse(ex);

            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)statusCode;

            var errorResponse = new
            {
                Code = 0,
                Data = (object)null,
                Msg = userMessage,
                DataAppend = new
                {
                    ExceptionType = ex.GetType().Name,
                    Path = context.Request.Path.ToString(),
                    Method = context.Request.Method,
                    Timestamp = DateTime.Now,
                    // 开发环境返回详细信息，生产环境隐藏
                    DetailedMessage = IsDevelopment() ? ex.Message : null,
                    StackTrace = IsDevelopment() ? ex.StackTrace : null
                }
            };

            await context.Response.WriteAsync(JsonConvert.SerializeObject(errorResponse));
        }

        /// <summary>
        /// 根据异常类型返回合适的错误信息
        /// </summary>
        private (HttpStatusCode statusCode, string message) GetErrorResponse(Exception ex)
        {
            return ex switch
            {
                // MySQL 异常
                MySqlException mysqlEx => (
                    HttpStatusCode.InternalServerError,
                    GetMySqlErrorMessage(mysqlEx)
                ),

                // JavaScript 引擎异常
                JavaScriptException jsEx => (
                    HttpStatusCode.InternalServerError,
                    $"JavaScript 执行错误: {jsEx.Message}"
                ),

                // 类型转换异常
                InvalidCastException castEx => (
                    HttpStatusCode.BadRequest,
                    $"数据类型转换错误: {castEx.Message}"
                ),

                // 超时异常
                TimeoutException timeoutEx => (
                    HttpStatusCode.RequestTimeout,
                    $"请求超时: {timeoutEx.Message}"
                ),

                // 参数异常
                ArgumentNullException or ArgumentException => (
                    HttpStatusCode.BadRequest,
                    $"参数错误: {ex.Message}"
                ),

                // 未授权异常
                UnauthorizedAccessException => (
                    HttpStatusCode.Unauthorized,
                    "未授权访问"
                ),

                // 默认异常
                _ => (
                    HttpStatusCode.InternalServerError,
                    IsDevelopment() ? ex.Message : "服务器内部错误，请稍后重试"
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
            return Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";
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
