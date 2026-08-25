using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    [PlatformAdminOnly]
    public class DiyChatController : Controller
    {
        private const string SystemMessageApiEngineKey = "platform-chat-system-message";
        private IHubContext<DiyWebSocket> _context;
        
        /// <summary>
        /// 
        /// </summary>
        public DiyChatController(IHubContext<DiyWebSocket> context)
        {
            _context = context;
        }
        /// <summary>
        /// 传入Content、ToUserId、
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<DosResult> SendSystemMessage(MessageBodyParam msgParam)
        {
            if (msgParam == null || msgParam.Content.DosIsNullOrWhiteSpace() || msgParam.ToUserId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(msgParam?.OsClient, "ParamError", msgParam?._Lang));
            }

            var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            if (currentToken?.CurrentUser == null)
                return new DosResult(1001, null, "登录身份已过期，请重新登录。");
            if (UserAccessKeySecurity.IsSession(currentToken.CurrentUser))
                return new DosResult(1002, null, "访问密钥会话不允许发送实时聊天消息。");
            msgParam.OsClient = currentToken.OsClient;

            var rawPrepareResult = await ManagedApiEngineCompatibility.RunAsync(
                SystemMessageApiEngineKey,
                new JObject
                {
                    ["Action"] = "PersistSystemMessage",
                    ["RequestId"] = msgParam.RequestId.DosIsNullOrWhiteSpace()
                        ? Ulid.NewUlid().ToString()
                        : msgParam.RequestId.Trim(),
                    ["OsClient"] = currentToken.OsClient,
                    ["ToUserId"] = msgParam.ToUserId,
                    ["Content"] = msgParam.Content,
                    ["OtherInfo"] = msgParam.OtherInfo,
                    ["IsRead"] = msgParam.IsRead
                },
                JObject.FromObject(currentToken.CurrentUser)).ConfigureAwait(false);
            var prepareResult = ToResultObject(rawPrepareResult);
            if (prepareResult?["Code"].Val<int>() != 1
                || prepareResult["Data"] is not JObject data
                || data["Message"] is not JObject)
            {
                return new DosResult(
                    prepareResult?["Code"].Val<int>() ?? 0,
                    null,
                    prepareResult?["Msg"]?.ToString() ?? "官方系统消息接口不可用。");
            }

            // 固定 Managed runtime 已完成持久化和读模型更新；旧 Controller
            // 只保留尽力 SignalR 投递，不再重复执行聊天业务。
            var diyWebSocket = new DiyWebSocket(null);
            await diyWebSocket.DeliverPreparedMessageAsync(
                prepareResult,
                currentToken.OsClient,
                _context).ConfigureAwait(false);

            return new DosResult(1, data["Message"]);
        }

        private static JObject ToResultObject(object result)
        {
            if (result == null) return null;
            if (result is JObject jobject) return jobject;
            if (result is string json)
            {
                try { return JObject.Parse(json); }
                catch { return null; }
            }
            try { return JObject.FromObject(result); }
            catch { return null; }
        }
    }
}
