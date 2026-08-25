using System;
using Dos.Common;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using RestSharp;
using System.Collections.Generic;

namespace Microi.net
{
    public class V8EngineSms
    {
        private static SmsAliyun _smsAliyun = new SmsAliyun();
        public SmsParam DynamicToParam(dynamic dynamicParam)
        {
            JObject jobjParam = JsonHelper.ToJObject(dynamicParam);
            SmsParam param = jobjParam.ToObject<SmsParam>(DiyCommon.JsonConfig);//这里时间格式化没有用
            return param;
        }
        public DosResult Send(dynamic dynamicParam)
        {
            SmsParam param = DynamicToParam(dynamicParam);
            return _smsAliyun.Send(param);
        }
    }
}
