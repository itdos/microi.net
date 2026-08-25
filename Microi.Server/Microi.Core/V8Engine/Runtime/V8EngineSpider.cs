using System;
using Dos.Common;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using RestSharp;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Microi.net
{
    public class V8EngineSpider
    {
        private readonly IMicroiSpider _microiSpider;

        public V8EngineSpider(IMicroiSpider microiSpiderInterface)
        {
            _microiSpider = microiSpiderInterface;
        }

        private T DynamicToParam<T>(dynamic dynamicParam)
        {
            string json = JsonConvert.SerializeObject(dynamicParam);
            JObject jobjParam = JObject.Parse(json);
            var param = jobjParam.ToObject<T>(DiyCommon.JsonConfig);//这里时间格式化没有用
            return param;
        }
        public DosResult GetRenderHtml(dynamic dynamicParam)
        {
            MicroiSpiderParam param = DynamicToParam<MicroiSpiderParam>(dynamicParam);
            return _microiSpider.GetRenderHtml(param).GetAwaiter().GetResult();
        }

        public DosResult OpenSession(dynamic dynamicParam)
        {
            MicroiSpiderSessionParam param = DynamicToParam<MicroiSpiderSessionParam>(dynamicParam);
            return _microiSpider.OpenSession(param).GetAwaiter().GetResult();
        }

        public DosResult GetSession(dynamic dynamicParam)
        {
            MicroiSpiderSessionParam param = DynamicToParam<MicroiSpiderSessionParam>(dynamicParam);
            return _microiSpider.GetSession(param).GetAwaiter().GetResult();
        }

        public DosResult CloseSession(dynamic dynamicParam)
        {
            MicroiSpiderSessionParam param = DynamicToParam<MicroiSpiderSessionParam>(dynamicParam);
            return _microiSpider.CloseSession(param).GetAwaiter().GetResult();
        }

        public DosResult RunRecipe(dynamic dynamicParam)
        {
            MicroiSpiderRecipeParam param = DynamicToParam<MicroiSpiderRecipeParam>(dynamicParam);
            return _microiSpider.RunRecipe(param).GetAwaiter().GetResult();
        }
    }
}
