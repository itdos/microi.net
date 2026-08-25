#if NETSTANDARD || NETCOREAPP
using Microsoft.AspNetCore.Http;
#else
using System.Web;
#endif
using System;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace Microi.net.Api
{
    /// <summary>
    /// 百度 UEditor 旧协议适配。只保留请求分派、上传协议与安全 JSONP 响应；
    /// 配置按请求租户读取，文件列表/远程抓图等越权能力已关闭。
    /// </summary>
    public class UEditorService
    {
        public async Task<UEditorResponse> UploadAndGetResponseAsync(
            HttpContext context,
            string osClient)
        {
#if NETSTANDARD || NETCOREAPP
            var action = context.Request.Query["action"].ToString();
#else
            var action = context.Request.QueryString["action"];
#endif
            var config = await UeditorConfig.LoadForTenantAsync(osClient)
                .ConfigureAwait(false);
            object result;
            if (AppConsts.Action.Config.Equals(action, StringComparison.OrdinalIgnoreCase))
            {
                result = config;
            }
            else
            {
                var handler = new HandelFactory().GetHandler(action, context, config);
                result = await handler.Process().ConfigureAwait(false);
            }

            var resultJson = JsonConvert.SerializeObject(result, new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore
            });
            var contentType = "text/plain";
#if NETSTANDARD || NETCOREAPP
            var jsonpCallback = context.Request.Query["callback"].ToString();
#else
            var jsonpCallback = context.Request.QueryString["callback"];
#endif
            if (!string.IsNullOrWhiteSpace(jsonpCallback)
                && Regex.IsMatch(
                    jsonpCallback,
                    @"^[A-Za-z_$][A-Za-z0-9_$.]{0,127}$",
                    RegexOptions.CultureInvariant))
            {
                contentType = "application/javascript";
                resultJson = $"{jsonpCallback}({resultJson});";
            }
            return new UEditorResponse(contentType, resultJson);
        }
    }
}
