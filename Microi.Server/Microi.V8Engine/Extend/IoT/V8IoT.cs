using System;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>仅暴露受限的持久连接下行入口；不创建新 Socket，也不暴露 Redis 或租户配置。</summary>
    public sealed class V8IoT
    {
        public DosResult Send(object param)
        {
            try
            {
                var request = param is JObject json ? (JObject)json.DeepClone()
                    : JObject.Parse(JsonConvert.SerializeObject(param));
                return IoTCommandRuntime.SendAsync(request).GetAwaiter().GetResult();
            }
            catch { return new DosResult(0, null, "IoT.Send 参数必须是对象。"); }
        }
    }
}
