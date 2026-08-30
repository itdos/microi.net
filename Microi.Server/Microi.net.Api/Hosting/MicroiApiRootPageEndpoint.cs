using System.Diagnostics;
using System.Text;
using System.Text.Encodings.Web;
using Dos.Common;

namespace Microi.net.Api;

/// <summary>
/// API 宿主根页面端点。根地址必须先由 ASP.NET Core 建立，不能依赖只处理
/// <c>/apiengine/*</c> 的接口引擎；租户自定义 HTML 仍沿用既有 <c>IndexCodeApi</c> 语义。
/// </summary>
public static class MicroiApiRootPageEndpoint
{
    private const string OfficialSiteUrl = "https://microi.net";
    private static readonly Lazy<string> DefaultPageHtml = new(
        BuildDefaultPageHtml,
        LazyThreadSafetyMode.ExecutionAndPublication);

    /// <summary>
    /// 注册 API 根地址展示页，替代已经迁移删除的 HomeController。
    /// </summary>
    public static RouteHandlerBuilder MapMicroiApiRootPage(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app.MapGet("/", HandleRootPage)
            .WithName("MicroiApiRootPage")
            .ExcludeFromDescription();
    }

    private static IResult HandleRootPage(HttpContext context)
    {
        // 根页面可能按 Host/租户返回不同自定义内容，禁止中间缓存串用其它租户页面。
        context.Response.Headers.CacheControl = "no-store";

        var osClient = DiyToken.GetCurrentOsClient();
        var clientModel = OsClient.GetClient(osClient);
        string configuredHtml = clientModel.OsClientModel["IndexCodeApi"].Val<string>();
        return Results.Content(
            ResolveRootPageHtml(configuredHtml),
            "text/html",
            Encoding.UTF8);
    }

    internal static string ResolveRootPageHtml(string? configuredHtml)
    {
        return string.IsNullOrWhiteSpace(configuredHtml)
            ? DefaultPageHtml.Value
            : configuredHtml;
    }

    private static string BuildDefaultPageHtml()
    {
        var title = "Microi吾码";
        try
        {
            var assemblyPath = typeof(DiyToken).Assembly.Location;
            var version = FileVersionInfo.GetVersionInfo(assemblyPath).FileVersion;
            var lastWriteTime = File.GetLastWriteTime(assemblyPath).ToString("yyyy-MM-dd HH:mm:ss");
            if (!string.IsNullOrWhiteSpace(version))
                title += $" v{version} - {lastWriteTime}";
        }
        catch
        {
            // 版本元数据只是展示信息；单文件发布或文件时间读取失败不能阻断根页面。
        }

        var encodedTitle = HtmlEncoder.Default.Encode(title);
        return $$"""
                 <!doctype html>
                 <html lang="zh-CN">
                 <head>
                   <meta charset="utf-8">
                   <meta name="viewport" content="width=device-width, initial-scale=1">
                   <title>{{encodedTitle}}</title>
                   <style>
                     html, body, iframe { width: 100%; height: 100%; margin: 0; border: 0; }
                     body { overflow: hidden; }
                     iframe { display: block; background: transparent; }
                   </style>
                 </head>
                 <body>
                   <iframe src="{{OfficialSiteUrl}}" title="Microi吾码官网" scrolling="yes"></iframe>
                 </body>
                 </html>
                 """;
    }
}
