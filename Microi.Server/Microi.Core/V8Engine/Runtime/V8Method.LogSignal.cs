using System;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        public DosResult QuerySystemLogSignal(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(out var osClient, out _);
            if (denied != null) return new DosResult(denied.Code, denied.Data, denied.Msg);
            try
            {
                JObject request = ToJObject(dynamicParam);
                var windowSeconds = request["WindowSeconds"].Val<int>();
                if (windowSeconds <= 0) windowSeconds = 300;
                windowSeconds = Math.Max(60, Math.Min(86400, windowSeconds));
                var end = DateTime.Now;
                var result = MicroiEngine.MongoDB.QuerySystemLogSignal(new SysLogSignalQueryParam
                {
                    OsClient = osClient,
                    WindowStart = end.AddSeconds(-windowSeconds),
                    WindowEnd = end,
                    Keyword = GetJsonString(request, "Keyword"),
                    Type = GetJsonString(request, "Type"),
                    Category = GetJsonString(request, "Category"),
                    Source = GetJsonString(request, "Source"),
                    ServiceName = GetJsonString(request, "ServiceName"),
                    LevelMin = request["LevelMin"]?.Type == JTokenType.Integer
                        ? request["LevelMin"].Val<int>()
                        : (int?)null,
                    MaxDurationSamples = 10000,
                    MaxEventSamples = 5
                }).ConfigureAwait(false).GetAwaiter().GetResult();
                return result == null
                    ? new DosResult(0, null, "系统日志信号查询失败。")
                    : new DosResult(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "查询系统日志信号失败：" + ex.Message);
            }
        }
    }
}
