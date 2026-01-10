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
    public class DiyChatController : Controller
    {
        private static DiyWebSocket diyWebSocket = new DiyWebSocket();
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
            if (msgParam.Content.DosIsNullOrWhiteSpace() || msgParam.ToUserId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(msgParam.OsClient, "ParamError", msgParam._Lang));
            }

            var sysUser = await DiyToken.GetCurrentToken();
            msgParam.OsClient = sysUser?.OsClient;

            // var adminSysUserModelResult = await new SysUserLogic().GetSysUserModel(new SysUserParam()
            // {
            //     Account = "admin",
            //     OsClient = msgParam.OsClient
            // });
            var adminSysUserModelResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
            {
                _Where = new List<List<object>>()
                {
                    new List<object> { "Account", "=", "admin" },
                },
                OsClient = msgParam.OsClient
            });

            if (adminSysUserModelResult.Code != 1)
            {
                return new DosResult(0, null, adminSysUserModelResult.Msg);
            }
            var adminSysUserModel = adminSysUserModelResult.Data;

            // var toSysUserModelResult = await new SysUserLogic().GetSysUserModel(new SysUserParam()
            // {
            //     Id = msgParam.ToUserId,
            //     OsClient = msgParam.OsClient
            // });
            var toSysUserModelResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
            {
                _Where = new List<List<object>>()
                {
                    new List<object> { "Id", "=", msgParam.ToUserId },
                },
                OsClient = msgParam.OsClient
            });

            if (toSysUserModelResult.Code != 1)
            {
                return new DosResult(0, null, toSysUserModelResult.Msg);
            }

            var toSysUserModel = toSysUserModelResult.Data;

            msgParam.ToUserName = toSysUserModel.Name;
            msgParam.ToUserAvatar = toSysUserModel.Avatar;
            msgParam.FromUserId = adminSysUserModel.Id;
            msgParam.FromUserName = adminSysUserModel.Name;
            msgParam.FromUserAvatar = adminSysUserModel.Avatar;


            //Microi.net.ClientInfo clientInfo = await DiyCacheBase.NoSql.GetAsync<Microi.net.ClientInfo>("Microi:ChatOnline:" + msg.OsClient + ":" + msg.ToUserId);

            //var clients = _context.Clients.Clients(clientInfo.ConnectionIds);

            msgParam._iHubContext = _context;

            //await _context.Clients.Clients<IClient>("").SendToUser(msg);

            //await _context.Clients.   //.Clients<IClient>("").SendToUser(msg);

            //await clients.SendAsync("ReceiveSendToUser", msg);

            await diyWebSocket.SendToUser(msgParam);

            return new DosResult(1);
        }
    }
}
