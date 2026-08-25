using System;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public class V8EngineMQ
    {
        private readonly IMicroiMQ _microiMQPublish;
        public V8EngineMQ(IMicroiMQ microiMQPublish)
        {
            _microiMQPublish = microiMQPublish;
        }
        public MicroiMQSendInfo DynamicParam(dynamic dynamicParam)
        {
            string json = JsonConvert.SerializeObject(dynamicParam);
            JObject jobjParam = JObject.Parse(json);
            MicroiMQSendInfo param = jobjParam.ToObject<MicroiMQSendInfo>(DiyCommon.JsonConfig);//这里时间格式化没有用
            return param;
        }
        public DosResult SendMsg(dynamic dynamicParam)
        {
            MicroiMQSendInfo param = DynamicParam(dynamicParam);
            return _microiMQPublish.SendMsg(param).GetAwaiter().GetResult();
        }
    }

}
