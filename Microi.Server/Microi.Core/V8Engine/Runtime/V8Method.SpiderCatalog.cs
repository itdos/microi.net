using System;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>固定采集目录读取原子；正文不能指定身份、表、查询或敏感投影。</summary>
        public dynamic ReadSpiderCatalog(dynamic dynamicParam)
        {
            var denied = ResolveTrustedManagedCurrentUser(
                SpiderCatalogReadPolicy.EngineKey, false, 0, out var osClient, out var user);
            if (denied != null) return denied;
            try
            {
                var request = ToJObject((object)dynamicParam);
                string action = request["Action"]?.ToString();
                var pageIndex = SpiderCatalogPageNumber(request["PageIndex"], 1);
                var pageSize = SpiderCatalogPageNumber(request["PageSize"], 50);
                // 接触运行时或数据库前先校验；运行时重复执行固定策略，
                // 防止直接 CLR 调用传入范围更大的查询。
                SpiderCatalogReadPolicy.Create(action, pageIndex, pageSize, osClient, user);
                if (!(MicroiEngine.FormEngine is ISpiderCatalogReadRuntime runtime))
                    return new DosResult(0, null, "采集目录读取需要升级服务端采集权限组件。");
                return runtime.ReadSpiderCatalogAsync(action, pageIndex, pageSize, osClient, user)
                    .ConfigureAwait(false).GetAwaiter().GetResult();
            }
            catch (ArgumentException)
            {
                return new DosResult(0, null, "采集目录参数无效：动作仅支持 Rules/Tasks，页码 1–1000，每页 1–50。");
            }
            catch (Exception)
            {
                return new DosResult(0, null, "采集目录读取失败，请检查当前账号权限或服务端日志。");
            }
        }

        private static int SpiderCatalogPageNumber(JToken value, int fallback)
        {
            if (value == null || value.Type == JTokenType.Null) return fallback;
            if ((value.Type == JTokenType.Integer || value.Type == JTokenType.String)
                && int.TryParse(value.ToString(), out var parsed)) return parsed;
            // Jint 将 JS 数字映射为 Double；只接受精确整数，
            // 禁止截断小数，也不接受无穷大或溢出值。
            if (value.Type == JTokenType.Float)
            {
                var number = value.Value<double>();
                if (double.IsFinite(number) && number == Math.Truncate(number)
                    && number >= int.MinValue && number <= int.MaxValue) return (int)number;
            }
            throw new ArgumentException("分页参数必须为整数。");
        }
    }
}
