using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private const string WeChatTemplateMessageEngineKey = "wechat_send_tpl_msg";
        private static readonly HashSet<string> WeChatTemplateDataKeys =
            new HashSet<string>(new[]
            {
                "first", "keyword1", "keyword2", "keyword3", "keyword4",
                "keyword5", "keyword6", "keyword7", "remark"
            }, StringComparer.Ordinal);

        /// <summary>
        /// 微信协议 SDK 和 AppSecret 属于可信宿主边界。V8 只编排模板、接收人和
        /// 个性化 Hook；公众号密钥从当前租户 wx_mp 读取且从不进入脚本上下文。
        /// </summary>
        public DosResult SendWeChatTemplateMessage(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(WeChatTemplateMessageEngineKey);
            if (denied != null) return denied;

            try
            {
                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var wxMpId = BoundedText(request["WxMpId"], 100);
                var openId = BoundedText(request["OpenId"], 200);
                var templateId = BoundedText(request["TemplateId"], 200);
                if (wxMpId.DosIsNullOrWhiteSpace()
                    || openId.DosIsNullOrWhiteSpace()
                    || templateId.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "WxMpId、OpenId、TemplateId不能为空。");
                }

                var templateData = request["TemplateData"] as JObject;
                if (templateData == null || templateData.Count == 0 || templateData.Count > 9)
                    return new DosResult(0, null, "TemplateData不能为空且最多包含9个模板字段。");

                var data = new Dictionary<string, string>(StringComparer.Ordinal);
                var totalLength = 0;
                foreach (var property in templateData.Properties())
                {
                    if (!WeChatTemplateDataKeys.Contains(property.Name))
                        return new DosResult(0, null, "TemplateData包含不支持的字段：" + property.Name);
                    var token = property.Value is JObject item ? item["value"] : property.Value;
                    var value = BoundedText(token, 1024);
                    totalLength += value.Length;
                    if (totalLength > 8192)
                        return new DosResult(0, null, "TemplateData总长度不能超过8192个字符。");
                    data[property.Name] = value;
                }

                string linkUrl = BoundedText(request["Url"] ?? request["LinkUrl"], 2000);
                Uri linkUri;
                if (!linkUrl.DosIsNullOrWhiteSpace()
                    && (!Uri.TryCreate(linkUrl, UriKind.Absolute, out linkUri)
                        || (linkUri.Scheme != Uri.UriSchemeHttp && linkUri.Scheme != Uri.UriSchemeHttps)))
                {
                    return new DosResult(0, null, "模板消息Url仅支持绝对http/https地址。");
                }

                string miniProgramAppId = BoundedText(request["MiniProgramAppId"], 100);
                string pagePath = BoundedText(request["PagePath"], 1024);
                if (!miniProgramAppId.DosIsNullOrWhiteSpace()
                    && !Regex.IsMatch(miniProgramAppId, "^[A-Za-z0-9_-]{1,100}$"))
                {
                    return new DosResult(0, null, "MiniProgramAppId格式无效。");
                }
                if (pagePath.Contains("://", StringComparison.Ordinal)
                    || pagePath.Contains("..", StringComparison.Ordinal)
                    || pagePath.Any(character => char.IsControl(character)))
                {
                    return new DosResult(0, null, "PagePath格式无效。");
                }

                var osClient = V8TenantContext.Current.OsClient;
                var accountResult = MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                    "wx_mp",
                    new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "Id", "=", wxMpId }
                        },
                        _SelectFields = new[] { "Id", "AppId", "AppSecret" }
                    }).ConfigureAwait(false).GetAwaiter().GetResult();
                if (accountResult == null || accountResult.Code != 1 || accountResult.Data == null)
                    return new DosResult(0, null, "当前租户的公众号/服务号配置不存在。");

                var account = JObject.FromObject(accountResult.Data);
                var appId = BoundedText(account["AppId"], 100);
                var appSecret = BoundedText(account["AppSecret"], 512);
                if (appId.DosIsNullOrWhiteSpace() || appSecret.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "当前租户的公众号/服务号缺少AppId或AppSecret。");

                var weChat = MicroiEngine.TryGetService<IMicroiWeChat>();
                if (weChat == null)
                    return new DosResult(0, null, "当前后端未启用微信消息插件。");

                return weChat.SendTplMsg(new WxTplMsgParam
                {
                    AppId = appId,
                    AppSecret = appSecret,
                    OpenId = openId,
                    TemplateId = templateId,
                    LinkUrl = linkUrl,
                    Data = data,
                    MiniProgram = miniProgramAppId.DosIsNullOrWhiteSpace()
                        ? null
                        : new WxMiniProgram { AppId = miniProgramAppId, PagePath = pagePath }
                }).ConfigureAwait(false).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】微信模板消息可信原子执行失败：" + ex.Message);
                return new DosResult(0, null, "微信模板消息发送失败，请查看服务端系统日志。");
            }
        }

        private static string BoundedText(JToken token, int maxLength)
        {
            var value = token == null || token.Type == JTokenType.Null
                ? string.Empty
                : (token.ToString() ?? string.Empty).Trim();
            return value.Length > maxLength ? value.Substring(0, maxLength) : value;
        }
    }
}
