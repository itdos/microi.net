#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Threading.Tasks;
using Dos.Common;
//using Microsoft.AspNet.SignalR;
//using Microsoft.AspNetCore.SignalR;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
	public class DiyChatHelper
	{
#if !NETSTANDARD2_0 && !NETCOREAPP2_1 && !NET461
        
        // / <summary>
        // / 发送系统消息给某个用户。
        // / 传入：Content、OsClient、ToUserId
        // / </summary>
        // / <returns></returns>
        //      public async Task<DosResult> SendSystemMessage(MessageBody msg)
        //{

        //          if (msg.ToUserId.DosIsNullOrWhiteSpace()
        //              || msg.Content.DosIsNullOrWhiteSpace()
        //              || msg.OsClient.DosIsNullOrWhiteSpace())
        //          {
        //              return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "ParamError", param._Lang));
        //          }

        //          #region 赋值发送者和接收者
        //          msg.CreateTime = DateTime.Now;
        //          var adminSysUserModelResult = await new SysUserLogic().GetSysUserModel(new SysUserParam()
        //          {
        //              Account = "admin"
        //          });
        //          if (adminSysUserModelResult.Code != 1)
        //          {
        //              return new DosResult(0, null, adminSysUserModelResult.Msg);
        //          }
        //          var adminSysUserModel = adminSysUserModelResult.Data;
        //          msg.FromUserId = adminSysUserModel.Id;
        //          msg.FromUserName = adminSysUserModel.Name;
        //          msg.FromUserAvatar = adminSysUserModel.Avatar;

        //          var toUserModelResult = await new SysUserLogic().GetSysUserModel(new SysUserParam()
        //          {
        //              Id = msg.ToUserId
        //          });
        //          if (toUserModelResult.Code != 1)
        //          {
        //              return new DosResult(0, null, toUserModelResult.Msg);
        //          }
        //          var toUserModel = toUserModelResult.Data;
        //          msg.ToUserName = toUserModel.Name;
        //          msg.ToUserAvatar = toUserModel.Avatar;
        //          #endregion

        //          ClientInfo clientInfoTo = await DiyCacheBase.NoSql.GetAsync<ClientInfo>("ChatOnline:" + msg.OsClient + ":" + msg.ToUserId);
        //          if (clientInfoTo != null)
        //          {
        //              try
        //              {
        //                  await base.Clients.Clients(clientInfoTo.ConnectionIds).ReceiveSendToUser(msg);
        //              }
        //              catch (Exception)
        //              {
        //              }
        //          }
        //          try
        //          {
        //              MongodbHost val = new MongodbHost();
        //              val.Connection = Microi.net.OsClient.GetClient(msg.OsClient).DbMongoConnection;
        //              val.DataBase = "diy_chat_" + msg.OsClient.ToString().ToLower();
        //              val.Table = "chat_" + DateTime.Now.ToString("yyyyMM");
        //              MongodbHost host = val;
        //              await TMongodbHelper<MessageBody>.AddAsync(host, msg);
        //              await DiyCacheBase.NoSql.GetAsync<ClientInfo>("ChatOnline:" + msg.OsClient + ":" + msg.FromUserId);
        //              //更新发送者最近联系人列表
        //              await SendLastContacts(new MessageChatContactList
        //              {
        //                  UserId = msg.FromUserId,
        //                  UserName = msg.FromUserName,
        //                  UserAvatar = msg.FromUserAvatar,
        //                  ContactUserId = msg.ToUserId,
        //                  ContactUserName = msg.ToUserName,
        //                  ContactUserAvatar = msg.ToUserAvatar,
        //                  LastMessage = msg.Content,
        //                  LastMessageType = msg.Type,
        //                  OsClient = msg.OsClient,
        //                  OtherInfo = msg.OtherInfo,
        //                  _IsUpdateTime = true
        //              });
        //              //更新接收者最近联系人列表
        //              await SendLastContacts(new MessageChatContactList
        //              {
        //                  UserId = msg.ToUserId,
        //                  UserName = msg.ToUserName,
        //                  UserAvatar = msg.ToUserAvatar,
        //                  ContactUserId = msg.FromUserId,
        //                  ContactUserName = msg.FromUserName,
        //                  ContactUserAvatar = msg.FromUserAvatar,
        //                  LastMessage = msg.Content,
        //                  LastMessageType = msg.Type,
        //                  OsClient = msg.OsClient,
        //                  OtherInfo = msg.OtherInfo,
        //                  _IsUpdateTime = true//2021-05-08修改为true，why before is false？
        //              });
        //              await SendUnreadCountToUser(new MessageBody
        //              {
        //                  ToUserId = msg.ToUserId,
        //                  OsClient = msg.OsClient
        //              });
        //          }
        //          catch (Exception ex)
        //          {

        //          }
        //          return new DosResult(1);
        //      }
#endif
    }
}