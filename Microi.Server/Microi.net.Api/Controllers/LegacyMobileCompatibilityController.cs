using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net.Api;

/*
 * 【仅兼容、禁止新增业务、未来可能整体删除】
 * 下列旧接口已由官方 Managed 接口引擎实现。租户尚未完成应用升级时，本 Controller
 * 保证密码登录、DiyToken 会话、基础导航、部门树、服务器时间及客户端语义日志仍可用。
 * 已有接口引擎始终优先；只有主库确认地址和固定 Key 均缺失才调用现有可信 Core 原子。
 * 禁用、StopHttp、权限拒绝、数据库异常及接口执行失败绝不触发兜底，也不在请求中写入资源。
 */
[EnableCors("any")]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
public sealed class LegacyMobileCompatibilityController : Controller
{
    private static readonly Regex TenantSuffix = new(
        @"--OsClient--(.*?)--$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    internal sealed record BootstrapRoute(string EngineKey, string Action, bool Authenticated = false,
        bool PostOnly = false);

    private static readonly IReadOnlyDictionary<string, BootstrapRoute> Routes =
        new Dictionary<string, BootstrapRoute>(StringComparer.OrdinalIgnoreCase)
        {
            ["/api/SysUser/Login"] = new("platform-sys-user-session", "Login", PostOnly: true),
            ["/api/SysUser/RefreshToken"] = new("platform-sys-user-session", "RefreshToken", true, true),
            ["/api/SysUser/TokenLogin"] = new("platform-sys-user-session", "TokenLogin", true),
            ["/api/SysUser/Logout"] = new("platform-sys-user-session", "Logout", true, true),
            ["/api/SysUser/GetCurrentUser"] = new("platform-current-user", "GetCurrentUser", true),
            ["/api/FormEngine/GetSysConfig"] = new("platform-sys-config", "GetSysConfig"),
            ["/api/DiyTable/GetSysConfig"] = new("platform-sys-config", "GetSysConfig"),
            ["/api/FormEngine/GetLangBundle"] = new("platform-lang-bundle", "GetLangBundle"),
            ["/api/FormEngine/GetLoginWallpapers"] = new("platform-login-wallpapers", "GetLoginWallpapers"),
            ["/api/Os/GetOsClientByDomain"] = new("platform-os-client-by-domain", "GetOsClientByDomain"),
            ["/api/Os/GetDateTimeNow"] = new("platform-os-legacy-compatibility", "GetDateTimeNow"),
            ["/api/SysLog/AddSysLog"] = new("platform-client-log", "AddSysLog", true),
            ["/api/SysMenu/GetSysMenuStep"] = new("platform-sys-menu", "GetSysMenuStep", true),
            ["/api/SysMenu/GetSysMenuModel"] = new("platform-sys-menu", "GetSysMenuModel", true),
            ["/api/SysMenu/GetSysMenu"] = new("platform-sys-menu", "GetSysMenu", true),
            // 仅补历史读树地址；不截获现代部门引擎的新增、修改、删除动作。
            ["/api/SysDept/GetSysDeptStep"] = new("platform-sys-dept", "GetSysDeptStep", true),
            ["/apiengine/platform-current-user"] = new("platform-current-user", "GetCurrentUser", true),
            ["/apiengine/platform-sys-config"] = new("platform-sys-config", "GetSysConfig"),
            ["/apiengine/platform-lang-bundle"] = new("platform-lang-bundle", "GetLangBundle"),
            ["/apiengine/platform-login-wallpapers"] = new("platform-login-wallpapers", "GetLoginWallpapers"),
            ["/apiengine/platform-os-client-by-domain"] = new("platform-os-client-by-domain", "GetOsClientByDomain"),
            ["/apiengine/platform-sys-user-session"] = new("platform-sys-user-session", ""),
            ["/apiengine/platform-os-legacy-compatibility"] = new("platform-os-legacy-compatibility", ""),
            ["/apiengine/platform-client-log"] = new("platform-client-log", "AddSysLog", true),
            ["/apiengine/platform-sys-menu"] = new("platform-sys-menu", "", true)
        };

    internal static bool IsBootstrapRoute(string path) => Routes.ContainsKey(path ?? "");

    internal static BootstrapRoute ResolveRoute(string path, string requestedAction)
    {
        if (!Routes.TryGetValue(path ?? "", out var route)) return null;
        if (route.Action.Length != 0) return route;
        // Only canonical engine URLs accept Action. Legacy URLs always pin it to the path.
        return Routes.Values.FirstOrDefault(candidate => candidate.EngineKey == route.EngineKey
            && candidate.Action.Length != 0
            && string.Equals(candidate.Action, requestedAction?.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    internal static DosResult<dynamic> ResolveConfiguredEngine(string path, string key,
        Func<string, DosResult<dynamic>> byAddress, Func<string, DosResult<dynamic>> byAlias,
        Func<string, DosResult<dynamic>> byKey, Func<string, DosResult<dynamic>> byTemplate = null)
    {
        var result = byAddress(path);
        if (result.Code != 1 || result.Data != null) return result;
        result = byAlias(path);
        if (result.Code != 1 || result.Data != null) return result;
        if (byTemplate != null)
        {
            result = byTemplate(path);
            if (result.Code != 1 || result.Data != null) return result;
        }
        return byKey(key);
    }

    internal static DosResult<dynamic> ResolveConfiguredTemplate(string path, string osClient,
        IEnumerable<object> models)
    {
        var matches = models.Where(model =>
        {
            if (!DynamicRoute.TryMatchConfiguredTemplate(model, path, out var values)) return false;
            var tenant = values.GetValue("OsClient", StringComparison.OrdinalIgnoreCase)?.ToString();
            return string.IsNullOrWhiteSpace(tenant) || string.Equals(tenant, osClient, StringComparison.OrdinalIgnoreCase);
        }).Take(2).ToList();
        return matches.Count > 1 ? new DosResult<dynamic>(0, null, "接口引擎模板路由存在冲突，请修复后重试。")
            : new DosResult<dynamic>(1, matches.FirstOrDefault());
    }

    // Deliberately uses conventional routing only. The DynamicRoute transformer selects
    // this action; /LegacyMobileCompatibility/Run is not an alternative bootstrap URL.
    public async Task<IActionResult> Run()
    {
        var path = DynamicRoute.NormalizeApiEngineRouteAddress(Request.Path.Value);
        if (!IsBootstrapRoute(path)) return NotFound();
        JObject request;
        try { request = await ReadRequestAsync(); }
        catch (Exception ex) when (ex is Newtonsoft.Json.JsonException || ex is InvalidDataException)
        { return Json(new DosResult(0, null, "请求参数格式无效。")); }
        var route = ResolveRoute(path, request.GetValue("Action", StringComparison.OrdinalIgnoreCase)?.ToString());
        if (route == null) return Json(new DosResult(0, null, "不支持的兼容启动动作，请更新对应官方应用。"));

        string osClient;
        try { osClient = ResolveTenant(Request.Path.Value, Request.Query["OsClient"], request,
            Request.Headers["osclient"], DiyToken.GetCurrentOsClient()); }
        catch (ArgumentException) { return Json(new DosResult(1002, null, "请求租户参数无效或路径与查询租户不一致。")); }
        request = PrepareRequest(request, osClient, route.Action);
        Request.Headers["osclient"] = osClient;

        DosResult<dynamic> configured;
        try
        {
            var client = OsClientExtend.GetClient(osClient);
            configured = ResolveConfiguredEngine(path, route.EngineKey,
                address => ApiEngineAuthoritativeStore.GetConfiguredModel(client, new ApiEngineParam { ApiAddress = address }),
                address => ApiEngineAuthoritativeStore.GetConfiguredByMultiRoute(client, address),
                key => ApiEngineAuthoritativeStore.GetConfiguredModel(client, new ApiEngineParam { ApiEngineKey = key }),
                address => ResolveConfiguredTemplate(address, osClient,
                    ApiEngineAuthoritativeStore.GetConfiguredTemplates(client).Cast<object>()));
        }
        catch (Exception ex)
        {
            MicroiEngine.QueueSystemLog(osClient, "ApiEngine", "BootstrapRouteReadFailed",
                "兼容启动路由读取失败", ex.GetType().Name, 3, false, path);
            return Json(new DosResult(0, null, "无法确认接口配置，请检查当前租户数据库与后端日志。"));
        }
        if (configured.Code != 1) return Json(configured);
        if (configured.Data != null)
        {
            // Missing ApiRoutes with an existing Key also recovers through the actual
            // engine. Use the normal HTTP controller so ApiRole/access-key checks remain.
            object model = configured.Data;
            if (!DynamicHelper.GetDynamicBoolValue(model, "IsEnable", true))
                return Json(new DosResult(0, null, "接口已停用。"));
            if (DynamicHelper.GetDynamicBoolValue(model, "StopHttp"))
                return Json(new DosResult(0, null, "接口禁止 HTTP 调用。"));
            var engineKey = DynamicHelper.GetDynamicStringValue(model, "ApiEngineKey", "");
            // 升级补齐配置后，执行器的旧/半量模型也必须失效；否则真实匿名登录引擎
            // 仍可能被缓存判为需要 Token。复用核心权威读取，刷新该引擎全部模型别名。
            var executionModel = await MicroiEngine.ApiEngine.GetAuthoritativeApiEngineModel(
                new ApiEngineParam { OsClient = osClient, ApiEngineKey = engineKey });
            if (executionModel.Code != 1 || executionModel.Data == null)
                return Json(executionModel);
            HttpContext.Items[DynamicRoute.ResolvedApiEngineKeyItem] = engineKey;
            if (DynamicRoute.TryMatchConfiguredTemplate(model, path, out var routeValues))
                HttpContext.Items[DynamicRoute.ResolvedApiRouteValuesItem] = routeValues;
            Response.Headers["X-Microi-Bootstrap-Route"] = "ApiEngine";
            var engineController = new ApiEngineController { ControllerContext = ControllerContext };
            // OS 旧协议使用宿主签发的 HTTP 响应，必须继续由标准出口解包，
            // 不能把响应信封当作业务 JSON 返回给旧客户端。
            var responseType = DynamicHelper.GetDynamicStringValue(model, "ResponseType", "");
            if (string.Equals(responseType, "HTTP", StringComparison.OrdinalIgnoreCase)
                || string.Equals(responseType, "RawHttp", StringComparison.OrdinalIgnoreCase))
                return await engineController.Run_Response_Http();
            return await engineController.Run(request);
        }

        if (route.PostOnly && !HttpMethods.IsPost(Request.Method))
            return Json(new DosResult(0, null, "该用户会话动作仅支持 POST 请求。"));
        if (!HttpMethods.IsPost(Request.Method) && !HttpMethods.IsGet(Request.Method))
            return StatusCode(StatusCodes.Status405MethodNotAllowed);
        // RefreshToken historically accepts authorization in the request body as well
        // as the header. Validate that same token before calling the existing runtime.
        var refreshAuthorization = route.Action == "RefreshToken"
            ? request.GetValue("authorization", StringComparison.OrdinalIgnoreCase)?.ToString() : null;
        var token = !string.IsNullOrWhiteSpace(refreshAuthorization)
            ? await DiyToken.GetCurrentToken(refreshAuthorization, osClient).ConfigureAwait(false)
            : await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
        var user = token?.CurrentUser as JObject;
        if (user != null && !string.Equals(token.OsClient, osClient, StringComparison.OrdinalIgnoreCase)) user = null;
        if (route.Authenticated && user == null)
            return Json(new DosResult(1001, null, "登录身份已过期，请重新登录。"));
        if (user != null && UserAccessKeySecurity.IsSession(user))
            return Json(new DosResult(1002, null, "访问密钥会话不允许使用启动兼容入口。"));
        Response.Headers["Cache-Control"] = "no-store";
        Response.Headers["X-Microi-Bootstrap-Route"] = "CompiledFallback";
        return Json(await PlatformBootstrapCompatibilityService.ExecuteAsync(route.Action, request, user));
    }

    internal static string ResolveTenant(string path, string queryTenant, JObject request,
        string headerTenant, string defaultTenant)
    {
        var suffix = TenantSuffix.Match(path ?? "");
        var pathTenant = suffix.Success ? suffix.Groups[1].Value : "";
        if (!string.IsNullOrWhiteSpace(pathTenant) && !string.IsNullOrWhiteSpace(queryTenant)
            && !string.Equals(pathTenant, queryTenant, StringComparison.OrdinalIgnoreCase)) throw new ArgumentException();
        var tenant = new[] { pathTenant, queryTenant,
            request?.GetValue("OsClient", StringComparison.OrdinalIgnoreCase)?.ToString(), headerTenant, defaultTenant }
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
        if (string.IsNullOrWhiteSpace(tenant)) throw new ArgumentException();
        return TenantConfigurationSecurity.NormalizeTenantId(tenant);
    }

    internal static JObject PrepareRequest(JObject source, string osClient, string action)
    {
        var request = ManagedApiEngineCompatibility.PrepareRequest(source);
        foreach (var property in request.Properties().Where(property =>
                     property.Name.StartsWith("_Trusted", StringComparison.OrdinalIgnoreCase)
                     || new[] { "OsClient", "Action", "_DevBypassPwd", "_CurrentUser", "_HttpMethod", "_RequestPath", "_RouteValues" }
                         .Contains(property.Name, StringComparer.OrdinalIgnoreCase)).ToList()) property.Remove();
        request["OsClient"] = osClient;
        // 客户端日志的 Action 属于禁止伪造的审计字段，不是路由参数。
        // 不自动注入 AddSysLog；显式传入的值保留给同一日志校验规则拒绝。
        if (action != "AddSysLog") request["Action"] = action;
        else if (source?.GetValue("Action", StringComparison.OrdinalIgnoreCase) is JToken suppliedAction)
            request["Action"] = suppliedAction.DeepClone();
        request["_DevBypassPwd"] = false;
        return request;
    }

    private async Task<JObject> ReadRequestAsync()
    {
        var result = new JObject();
        if (Request.HasFormContentType)
        {
            foreach (var field in await Request.ReadFormAsync()) result[field.Key] = field.Value.ToString();
        }
        else if (Request.ContentType?.Contains("json", StringComparison.OrdinalIgnoreCase) == true)
        {
            Request.EnableBuffering();
            using var reader = new StreamReader(Request.Body, Encoding.UTF8, true, 1024, leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            if (!string.IsNullOrWhiteSpace(body)) result = JObject.Parse(body);
            Request.Body.Position = 0;
        }
        foreach (var query in Request.Query)
        {
            result.Properties().FirstOrDefault(p => string.Equals(p.Name, query.Key,
                StringComparison.OrdinalIgnoreCase))?.Remove();
            result[query.Key] = query.Value.ToString();
        }
        return result;
    }
}
