using Dos.Common;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

public partial class HDFSController
{
    /// <summary>
    /// 上传的最小 HTTP/文件流桥。必须先从主库确认配置；停用、禁止 HTTP、数据库故障
    /// 或 V8 执行错误都直接返回，只有地址、别名与固定 Key 均缺失才执行编译兜底。
    /// </summary>
    private async Task<IActionResult> DispatchUploadAsync(DiyUploadParam param)
    {
        DosResult<dynamic> configured;
        bool legacyEnabled;
        var path = DynamicRoute.NormalizeApiEngineRouteAddress(Request.Path.Value);
        try
        {
            var client = OsClientExtend.GetClient(param.OsClient);
            configured = LegacyMobileCompatibilityController.ResolveConfiguredEngine(path, HdfsUploadRequestContext.EngineKey,
                address => ApiEngineAuthoritativeStore.GetConfiguredModel(client, new ApiEngineParam { ApiAddress = address }),
                address => ApiEngineAuthoritativeStore.GetConfiguredByMultiRoute(client, address),
                key => ApiEngineAuthoritativeStore.GetConfiguredModel(client, new ApiEngineParam { ApiEngineKey = key }));
            if (configured.Code != 1) return Json(configured);
            var settings = await MicroiEngine.FormEngine.GetSysConfig(param.OsClient);
            if (settings?.Code != 1) return Json(new DosResult(0, null, "无法读取上传兼容设置，请稍后重试。"));
            object settingsData = settings.Data;
            legacyEnabled = LegacyUploadResponse.IsEnabled(
                DynamicHelper.GetDynamicStringValue(settingsData, HdfsUploadRequestContext.CompatibilityField, "0"));
        }
        catch
        {
            return Json(new DosResult(0, null, "上传接口或系统设置权威读取失败，请稍后重试。"));
        }

        // 保留现有安全链路，包括 HDFS 字段/目录授权、裁剪原图和微信内容安全。
        async Task<DosResult> ExecuteUpload() => await ApplyWeChatContentSecurityAsync(
            await MicroiEngine.HDFS.Upload(param), param);

        Response.Headers["Cache-Control"] = "no-store";
        if (configured.Data == null)
        {
            Response.Headers["X-Microi-Upload-Handler"] = "CompiledFallback";
            return Json(LegacyUploadResponse.Apply(await ExecuteUpload(), legacyEnabled));
        }

        object model = configured.Data;
        if (!DynamicHelper.GetDynamicBoolValue(model, "IsEnable", true))
            return Json(new DosResult(0, null, "上传接口已停用。"));
        if (DynamicHelper.GetDynamicBoolValue(model, "StopHttp"))
            return Json(new DosResult(0, null, "上传接口禁止 HTTP 调用。"));
        var key = DynamicHelper.GetDynamicStringValue(model, "ApiEngineKey", "");
        var execution = await MicroiEngine.ApiEngine.GetAuthoritativeApiEngineModel(
            new ApiEngineParam { OsClient = param.OsClient, ApiEngineKey = key });
        if (execution.Code != 1 || execution.Data == null) return Json(execution);

        using (HdfsUploadRequestContext.Enter(param.OsClient, key, legacyEnabled, ExecuteUpload))
        {
            HttpContext.Items[DynamicRoute.ResolvedApiEngineKeyItem] = key;
            Response.Headers["X-Microi-Upload-Handler"] = "ApiEngine";
            // 继续走标准 HTTP 执行器的 DiyToken、ApiRole 和访问密钥校验；不以内部调用旁路。
            // 桥接作用域让标准执行器跳过文件 Base64/原始 multipart 正文复制。
            return await new ApiEngineController { ControllerContext = ControllerContext }
                .Run(new JObject { ["OsClient"] = param.OsClient });
        }
    }
}
