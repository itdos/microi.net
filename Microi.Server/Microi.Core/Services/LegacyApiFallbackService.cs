using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 仅供统一旧接口 Controller 在主库确认地址与固定 Key 都不存在后调用。
    /// 不安装资源，不复刻旧业务；复用当前可信原子，保留其租户、权限、参数及存储边界。
    /// </summary>
    internal static class LegacyApiFallbackService
    {
        internal static async Task<object> ExecuteAsync(LegacyApiRoute route, JObject request, JObject currentUser)
        {
            if (!LegacyApiRouteCatalog.Routes.Contains(route))
                return new DosResult(0, null, "未登记的历史兼容地址。");
            var osClient = TenantConfigurationSecurity.NormalizeTenantId(request["OsClient"]?.ToString());
            if (route.Authenticated && string.IsNullOrWhiteSpace(currentUser?["Id"]?.ToString()))
                return new DosResult(1001, null, "登录身份已过期，请重新登录。");
            if (currentUser != null && UserAccessKeySecurity.IsSession(currentUser))
                return new DosResult(1002, null, "访问密钥会话不允许使用旧接口兜底。");
            if (route.Fallback == "Bootstrap")
                return await PlatformBootstrapCompatibilityService.ExecuteAsync(route.Action, request, currentUser);

            // 上下文只能来自 Controller 验证过的 DiyToken 和静态清单，不能从请求中取得 Key/权限。
            using var tenantScope = V8TenantContext.Enter(osClient, route.EngineKey);
            using var identityScope = V8TrustedExecutionContext.EnterForTenant(currentUser, osClient);
            var method = new V8Method();
            T Bind<T>() where T : BaseParam, new()
            {
                var param = request.ToObject<T>() ?? new T();
                param.OsClient = osClient;
                param._CurrentUser = currentUser;
                param._InvokeType = InvokeType.Client.ToString();
                return param;
            }
            if (route.Fallback.StartsWith("Directory:", StringComparison.Ordinal))
                return method.ManageSystemDirectory(new JObject {
                    ["Domain"] = route.Fallback.Substring("Directory:".Length),
                    ["Action"] = route.Action, ["Param"] = request
                });
            switch (route.Fallback)
            {
                case "LegacyOs":
                    return PlatformApiRuntimeRegistry.TryCreate("LegacyOs", out var legacyOs)
                        ? await legacyOs.ExecuteAsync(route.Action, request)
                        : new DosResult(0, null, "旧 OS 运行时尚未注册。");
                case "UserAdmin": return method.ManageSysUserAdmin(new JObject { ["Action"] = route.Action, ["Param"] = request });
                case "Module": return method.RunModuleEngine(request);
                case "Search": return method.ManageSearchEngine(request);
                case "AiWorkflow": return method.ManageAiWorkflow(request);
                case "Mq": return method.ManageMq(request);
                case "ObservabilityAction": return method.ManageSystemObservability(request);
                case "Observability":
                    var field = route.Action == "LegacyQueueHealth" ? "Queue" : route.Action == "ListBlocked" ? "ActiveBlocks" : route.Action == "ListRecentAccess" ? "RecentSecurityAccess" : null;
                    if (field == null) return method.GetSystemObservability(request);
                    var snapshot = method.GetSystemObservability(new JObject { ["Action"] = "Snapshot", ["IncludeHost"] = false });
                    return snapshot.Code == 1 ? new DosResult(1, JObject.FromObject(snapshot.Data)[field]) : snapshot;
                case "Embedded":
                    // Only assembly-owned, allowlisted compatibility code. No database resource
                    // is created and no caller-supplied script is evaluated.
                    using (var stream = typeof(LegacyApiFallbackService).Assembly.GetManifestResourceStream("Microi.Legacy." + route.EngineKey + ".js"))
                    {
                        if (stream == null) return new DosResult(0, null, "兼容实现未包含在当前后端。");
                        using var reader = new StreamReader(stream);
                        var execution = await MicroiEngine.V8Engine.Run(new V8EngineParam {
                            OsClient = osClient, ApiEngineKey = route.EngineKey, CurrentUser = currentUser,
                            Param = request, V8Code = reader.ReadToEnd(), SyncRun = true, Timeout = 60,
                            InvokeType = InvokeType.Client.ToString()
                        });
                        return execution.Code == 1 ? execution.Data?.Result : new DosResult(0, null, execution.Msg);
                    }
                case "OnlineTerminal": return method.ManageOnlineTerminal(request);
                case "Cache": return method.ManageCache(request);
                case "Office": return method.ExportWordByTemplate(request);
                case "UserBehavior": return method.TrackUserBehavior(request);
                case "Ocr": return await MicroiEngine.OCR.RecognizeAsync(Bind<MicroiOcrRecognizeParam>());
                case "Translate":
                    switch (route.Action)
                    {
                        case "TranslateText": return MicroiEngine.Translate.TranslateText(Bind<MicroiTranslateTextParam>());
                        case "Detect": return MicroiEngine.Translate.Detect(Bind<MicroiTranslateDetectParam>());
                        case "Languages": return MicroiEngine.Translate.GetLanguages(osClient);
                        case "TranslateFile": return MicroiEngine.Translate.TranslateFile(Bind<MicroiTranslateFileParam>());
                        case "Suggest": return MicroiEngine.Translate.Suggest(Bind<MicroiTranslateSuggestParam>());
                        case "Health": return MicroiEngine.Translate.Health(osClient);
                    }
                    break;
            }
            return new DosResult(0, null, "历史接口运行时未就绪，请更新归属应用。");
        }
    }
}
