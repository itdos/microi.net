using System;
using Senparc.Weixin.MP.AdvancedAPIs;
using Senparc.Weixin.MP.AdvancedAPIs.TemplateMessage;
using Senparc.Weixin.MP.Containers;
using System.Collections.Generic;
using Senparc.Weixin.MP.CommonAPIs;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microi.net;
using Dos.Common;

namespace Microi.net
{
    public class MicroiWeChat : IMicroiWeChat
    {
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> SendTplMsg(WxTplMsgParam param)
        {
            try
            {
                //TemplateMessageParam param = new TemplateMessageParam()
                //{
                //    AppId = "wxb5758292bc0b6d25",
                //    AppSecret = "e20abae6ed7f017b95ee01a0e1a09094",
                //    TemplateId = "Uejm7SspQKZCmlo3_6Ew16kjoINVJIURFAYi1dYULnU",
                //    OpenId = "oPQb26AtFcOQrU-9OLmoel2zBf4A",
                //    Data = new Dictionary<string, string>() {
                //        { "first", "这是first" },
                //        { "keyword1", "这是keyword1" },
                //        { "keyword2", "这是keyword2" },
                //        { "keyword3", "这是keyword3" },
                //        { "keyword4", "这是keyword3" },
                //        { "keyword5", "这是keyword3" },
                //        { "remark", "这是remark" },
                //    }
                //};
                if (
                    param.AppId.DosIsNullOrWhiteSpace()
                    || param.AppSecret.DosIsNullOrWhiteSpace()
                    || param.OpenId.DosIsNullOrWhiteSpace()
                    || param.TemplateId.DosIsNullOrWhiteSpace()
                    || param.Data == null || param.Data.Count == 0
                    )
                {
                    return new DosResult(0, null, "发送模板消息缺少参数！");
                }
                if (!AccessTokenContainer.CheckRegistered(param.AppId))
                {
                    await AccessTokenContainer.RegisterAsync(param.AppId, param.AppSecret);
                }
                var accessToken = AccessTokenContainer.GetAccessToken(param.AppId);
                var templateData = new WxTplDataModel();
                var type = templateData.GetType();
                foreach (var item in param.Data)
                {
                    var pi = type.GetProperty(item.Key);
                    pi?.SetValue(templateData, new TemplateDataItem(item.Value));
                }

                SendTemplateMessageResult sendResult = null;

                TemplateModel_MiniProgram miniProgram = null;
                if (param.MiniProgram != null && !param.MiniProgram.AppId.DosIsNullOrWhiteSpace())
                {
                    miniProgram = new TemplateModel_MiniProgram();
                    miniProgram.appid = param.MiniProgram.AppId;
                    miniProgram.pagepath = param.MiniProgram.PagePath;
                }

                sendResult = TemplateApi.SendTemplateMessage(accessToken, param.OpenId, param.TemplateId, param.LinkUrl, templateData, miniProgram);

                //发送成功  
                if (sendResult.errcode.ToString() == "请求成功")
                {
                    return new DosResult(1);
                }
                else
                {
                    return new DosResult(0, sendResult, sendResult.errcode + sendResult.errmsg);
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        //public void jscode2session()
        //{
        //    Senparc.Weixin.CommonAPIs.CommonJsonSend.
        //}

        /// <summary>  
        /// 定义模版中的字段属性（需与微信模版中的一致）  
        /// </summary>  
        public class WxTplDataModel
        {
            public TemplateDataItem first { get; set; }
            public TemplateDataItem keyword1 { get; set; }
            public TemplateDataItem keyword2 { get; set; }
            public TemplateDataItem keyword3 { get; set; }
            public TemplateDataItem keyword4 { get; set; }
            public TemplateDataItem keyword5 { get; set; }
            public TemplateDataItem keyword6 { get; set; }
            public TemplateDataItem keyword7 { get; set; }
            public TemplateDataItem remark { get; set; }
        }
    }
}

