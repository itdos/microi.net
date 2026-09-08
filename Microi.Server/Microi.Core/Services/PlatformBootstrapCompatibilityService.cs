using System;
using System.Globalization;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Platform bootstrap atoms that must remain available even when a tenant has
    /// not yet received the matching Managed ApiEngine resource.  This is not a
    /// business facade: it only exposes the same fixed, browser-safe projection
    /// used by the official platform-sys-config engine so a legacy bootstrap route
    /// can recover independently from an incomplete application-package upgrade.
    /// </summary>
    public static class PlatformBootstrapCompatibilityService
    {
        /// <summary>
        /// Fixed recovery operations for the host bootstrap controller. The caller supplies
        /// a validated DiyToken identity; no V8 entry point exposes this dispatcher.
        /// </summary>
        internal static async Task<object> ExecuteAsync(string action, JObject request, JObject currentUser)
        {
            var osClient = request["OsClient"]?.ToString();
            var lang = request["_Lang"]?.ToString();
            switch (action)
            {
                case "Login":
                case "RefreshToken":
                case "TokenLogin":
                case "Logout":
                    if (!PlatformApiRuntimeRegistry.TryCreate("SysUserSession", out var runtime))
                        return new DosResult(0, null, "用户会话运行时尚未注册，请检查后端安装。");
                    return await runtime.ExecuteAsync(action, request).ConfigureAwait(false);
                case "GetSysConfig":
                    return await GetPublicSysConfigAsync(osClient, lang).ConfigureAwait(false);
                case "GetOsClientByDomain":
                    return V8Method.ResolveOsClientByDomainCore(request["Domain"]?.ToString());
                case "GetLangBundle":
                    return V8Method.GetLangBundleCore(osClient, lang, request["Prefix"]?.ToString());
                case "GetLoginWallpapers":
                    return V8Method.GetLoginWallpapersCore(osClient);
                case "GetDateTimeNow":
                    // 保留旧 OS 接口的 DosResult 和斜杠日期格式；不返回宿主配置。
                    return new DosResult(1, DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss", CultureInfo.InvariantCulture));
            }
            if (currentUser == null || string.IsNullOrWhiteSpace(currentUser["Id"]?.ToString()))
                return new DosResult(1001, null, "登录身份已过期，请重新登录。");
            if (action == "GetCurrentUser")
                return new DosResult(1, currentUser.DeepClone());
            if (action == "AddSysLog")
            {
                var log = BuildLegacyClientLog(request, osClient, currentUser, out var error);
                if (log == null) return new DosResult(0, null, error);
                if (MicroiEngine.MongoDB == null) return new DosResult(0, null, "系统日志服务未配置。");
                // 复用既有日志队列及按租户持久化机制，不增加另一套日志存储。
                return await MicroiEngine.MongoDB.AddSysLog(log).ConfigureAwait(false);
            }
            if (action == "GetSysMenuStep" || action == "GetSysMenu" || action == "GetSysMenuModel")
            {
                // GetSysMenuStep performs the existing role/menu filtering. The single
                // model/list compatibility reads reuse that authorized row set.
                var param = request.ToObject<SysMenuParam>() ?? new SysMenuParam();
                param.OsClient = osClient;
                param._CurrentUser = currentUser;
                // Preserve the existing _All contract: SysMenuLogic itself permits
                // it only for the authenticated administrator/high-level identity.
                if (action != "GetSysMenuStep")
                {
                    if (action == "GetSysMenuModel" && string.IsNullOrWhiteSpace(param.Id))
                        return new DosResult(0, null, "Id不能为空。");
                    if (action == "GetSysMenu" && string.IsNullOrWhiteSpace(param.ParentId))
                        return new DosResult(0, null, "ParentId不能为空。");
                    // Build the authorized tree before selecting a child. Filtering the
                    // database to a child Id first discards its parents and produces an
                    // empty root tree even when the caller has access to that child.
                    param.Ids = null;
                    param._ChildSystemId = null;
                    param._PageIndex = null;
                    param._PageSize = null;
                    param._Top = null;
                    param._SelectFields = null;
                }
                var result = await new SysMenuLogic().GetSysMenuStep(param).ConfigureAwait(false);
                if (action == "GetSysMenuStep" || result.Code != 1) return result;
                var rows = result.Data == null ? new JArray() : JArray.FromObject(result.Data);
                return SelectAuthorizedMenus(action, param.Id, param.ParentId, param.Class, rows);
            }
            return new DosResult(0, null, "不支持的兼容启动动作。");
        }

        internal static SysLogParam BuildLegacyClientLog(JObject request, string osClient,
            JObject currentUser, out string error)
        {
            string Read(string key) => request.GetValue(key, StringComparison.OrdinalIgnoreCase)?.ToString() ?? "";
            error = null;
            if (currentUser == null || string.IsNullOrWhiteSpace(currentUser["Id"]?.ToString()))
            { error = "登录身份已过期，请重新登录。"; return null; }
            var type = Read("Type").Trim();
            // 与 platform-client-log 保持同一输入边界：普通客户端不能伪造
            // 安全审计/用户行为事件，租户与用户标识只能来自已校验 DiyToken。
            var reserved = new[] { "访问菜单", "点击V8按钮", "查看数据", "数据操作", "导入数据",
                "导出数据", "用户登录", "用户退出", "登录失效", "私有附件", "登录失败" };
            if (reserved.Contains(type) || !string.IsNullOrEmpty(Read("Category")) || !string.IsNullOrEmpty(Read("Action")))
            { error = "平台用户行为日志只能由后端可信执行点生成。"; return null; }
            var title = Read("Title").Trim();
            if (title.Length == 0 || title.Length > 500)
            { error = "日志标题不能为空且最多 500 个字符。"; return null; }
            var content = Read("Content");
            if (content.Length > 20000) content = content.Substring(0, 20000) + "…";
            var userName = currentUser["Name"]?.ToString();
            return new SysLogParam
            {
                OsClient = osClient, UserId = currentUser["Id"]?.ToString(),
                UserName = string.IsNullOrWhiteSpace(userName) ? currentUser["Account"]?.ToString() : userName,
                Type = string.IsNullOrEmpty(type) ? "Client" : type, Title = title, Content = content,
                Level = int.TryParse(Read("Level"), out var level) && level != 0 ? level : 1,
                Category = "Legacy", Action = "ClientLog", Source = "LegacyClientEndpoint"
            };
        }

        internal static DosResult SelectAuthorizedMenus(string action, string id, string parentId,
            string menuClass, JArray tree)
        {
            IEnumerable<JObject> Flatten(JArray rows)
            {
                foreach (var row in rows.OfType<JObject>())
                {
                    var copy = (JObject)row.DeepClone();
                    copy.Remove("_Child");
                    yield return copy;
                    if (row["_Child"] is JArray children)
                        foreach (var child in Flatten(children)) yield return child;
                }
            }
            var authorized = Flatten(tree);
            if (action == "GetSysMenuModel")
            {
                var row = authorized.FirstOrDefault(item => string.Equals(item["Id"]?.ToString(), id,
                    StringComparison.OrdinalIgnoreCase));
                return row == null ? new DosResult(2, null, "菜单不存在或无权访问。") : new DosResult(1, row);
            }
            var list = authorized.Where(item => string.Equals(item["ParentId"]?.ToString(), parentId,
                StringComparison.OrdinalIgnoreCase) && (string.IsNullOrWhiteSpace(menuClass)
                || string.IsNullOrWhiteSpace(item["Class"]?.ToString()) || item["Class"]?.ToString() == menuClass)).ToList();
            return new DosResult(1, list, "", list.Count);
        }

        public static async Task<DosResult> GetPublicSysConfigAsync(
            string osClient,
            string lang = null)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "OsClient不能为空。");
            }

            try
            {
                var source = await MicroiEngine.FormEngine
                    .GetSysConfig(osClient, lang)
                    .ConfigureAwait(false);
                if (source == null)
                {
                    return new DosResult(0, null, "系统设置读取失败。");
                }
                if (source.Code != 1)
                {
                    return CreatePublicSysConfigFailure(source);
                }

                var projection = source.Data == null
                    ? null
                    : TenantConfigurationSecurity.CreatePublicSysConfigProjection(
                        source.Data,
                        osClient);
                var loginPublicKey = ConfigHelper.GetRuntimeConfigurationValue(
                    "Security:LoginRsaPublicKey");
                if (projection != null && !loginPublicKey.DosIsNullOrWhiteSpace())
                {
                    // The public key is deliberately part of the anonymous
                    // bootstrap projection.  Private key material never enters
                    // this result or the V8 runtime.
                    projection["LoginRsaPublicKey"] = loginPublicKey
                        .Replace("\\n", "\n")
                        .Trim();
                }

                var result = new DosResult(
                    source.Code,
                    projection,
                    source.Msg,
                    null,
                    source.DataAppend);
                foreach (var property in source.DynamicProperties)
                {
                    result.DynamicProperties[property.Key] = property.Value;
                }
                return result;
            }
            catch (Exception exception)
            {
                return CreatePublicSysConfigFailure(new DosResult(
                    0,
                    null,
                    exception.Message,
                    null,
                    new { InnerException = exception.InnerException?.Message }));
            }
        }

        internal static DosResult CreatePublicSysConfigFailure(DosResult source)
        {
            source ??= new DosResult(0, null, "系统设置读取失败。");
            var diagnosticText = BuildDiagnosticText(source);
            if (!LooksLikeDatabaseFailure(diagnosticText))
            {
                return new DosResult(
                    0,
                    null,
                    "系统设置读取失败，请确认当前租户已正确初始化后刷新重试。",
                    null,
                    new
                    {
                        ErrorType = "PlatformBootstrap",
                        ErrorCode = "SystemConfigurationUnavailable",
                        RecoverySuggestion = "请检查租户初始化状态和后端日志，修复后刷新页面。"
                    });
            }

            var errorCode = ResolveDatabaseFailureCode(diagnosticText);
            var retryAfterSeconds = ResolveRetryAfterSeconds(diagnosticText);
            var reason = "后端无法使用当前租户的数据库连接。";
            var recovery = "请登录主租户，在SaaS引擎的租户管理中打开当前子租户，同时检查“数据库连接”和“只读数据库连接”的Data Source/Server、端口、数据库名、账号密码及账号授权；保存后刷新租户运行配置或重启后端。";

            switch (errorCode)
            {
                case "DatabaseHostInvalid":
                    reason = "数据库服务器地址无效，或当前后端运行环境无法解析该主机名。";
                    recovery = "请登录主租户，在SaaS引擎的租户管理中打开当前子租户，同时检查“数据库连接”和“只读数据库连接”的Data Source/Server。该地址必须能被当前后端容器解析和访问，不能使用只存在于另一Docker网络中的服务名；保存后刷新租户运行配置或重启后端。";
                    break;
                case "DatabaseCredentialsRejected":
                    reason = "数据库拒绝了当前账号，账号密码错误或账号没有目标库权限。";
                    recovery = "请在主租户的SaaS租户配置中核对数据库账号和密码，并确认该账号已被授权访问当前子租户数据库；同步检查只读数据库连接，保存后刷新租户运行配置。";
                    break;
                case "DatabaseNotFound":
                    reason = "连接配置中的目标数据库不存在或数据库名填写错误。";
                    recovery = "请确认子租户数据库已创建并完成初始化，再核对数据库连接和只读数据库连接中的Database/Initial Catalog；保存后刷新租户运行配置。";
                    break;
                case "DatabaseCapacityExceeded":
                    reason = "数据库连接数已耗尽，或数据库主机因连续连接失败暂时阻止了连接。";
                    recovery = "请检查数据库最大连接数、当前连接占用和主机阻断状态，先恢复数据库容量，再刷新页面；不要仅反复刷新制造更多连接。";
                    break;
                case "DatabaseEndpointUnreachable":
                    reason = "后端无法连接数据库服务器，可能是地址、端口、容器网络、防火墙或数据库服务状态异常。";
                    recovery = "请从当前后端容器验证数据库地址和端口可达，并同时核对数据库连接与只读数据库连接；修复网络或服务后刷新租户运行配置。";
                    break;
            }

            var retryText = retryAfterSeconds > 0
                ? " 后端保护性重试约剩余" + retryAfterSeconds.ToString(CultureInfo.InvariantCulture) + "秒；配置未修复前无需反复刷新。"
                : string.Empty;
            return new DosResult(
                0,
                null,
                "数据库连接失败：" + reason + retryText + " 解决方案：" + recovery + " 为保护凭据，请勿在页面或工单中粘贴含密码的完整连接串。",
                null,
                new
                {
                    ErrorType = "TenantDatabaseConnection",
                    ErrorCode = errorCode,
                    RetryAfterSeconds = retryAfterSeconds,
                    RecoverySuggestion = recovery
                });
        }

        internal static DosResult CreatePublicSysConfigFailure<T>(DosResult<T> source)
        {
            return CreatePublicSysConfigFailure(source == null
                ? null
                : new DosResult(
                    source.Code,
                    source.Data,
                    source.Msg,
                    null,
                    source.DataAppend));
        }

        private static string BuildDiagnosticText(DosResult source)
        {
            var appendText = string.Empty;
            if (source.DataAppend != null)
            {
                try
                {
                    appendText = JsonConvert.SerializeObject(source.DataAppend);
                    if (appendText.Length > 16384) appendText = appendText.Substring(0, 16384);
                }
                catch
                {
                    appendText = string.Empty;
                }
            }
            return (source.Msg ?? string.Empty) + " " + appendText;
        }

        private static bool LooksLikeDatabaseFailure(string diagnosticText)
        {
            var text = diagnosticText ?? string.Empty;
            return text.IndexOf("database connection", StringComparison.OrdinalIgnoreCase) >= 0
                   || text.IndexOf("mysql", StringComparison.OrdinalIgnoreCase) >= 0
                   || text.IndexOf("host name or IP address is invalid", StringComparison.OrdinalIgnoreCase) >= 0
                   || text.IndexOf("access denied for user", StringComparison.OrdinalIgnoreCase) >= 0
                   || text.IndexOf("unknown database", StringComparison.OrdinalIgnoreCase) >= 0
                   || text.IndexOf("connection refused", StringComparison.OrdinalIgnoreCase) >= 0
                   || text.IndexOf("DatabaseHostInvalid", StringComparison.OrdinalIgnoreCase) >= 0
                   || text.IndexOf("DatabaseEndpointUnreachable", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string ResolveDatabaseFailureCode(string diagnosticText)
        {
            var text = diagnosticText ?? string.Empty;
            foreach (var code in new[]
                     {
                         "DatabaseHostInvalid",
                         "DatabaseCredentialsRejected",
                         "DatabaseNotFound",
                         "DatabaseCapacityExceeded",
                         "DatabaseEndpointUnreachable"
                     })
            {
                if (text.IndexOf(code, StringComparison.OrdinalIgnoreCase) >= 0) return code;
            }

            if (text.IndexOf("host name or IP address is invalid", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("name or service not known", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("no such host is known", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("nodename nor servname", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("getaddrinfo", StringComparison.OrdinalIgnoreCase) >= 0)
                return "DatabaseHostInvalid";
            if (text.IndexOf("access denied for user", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("authentication failed", StringComparison.OrdinalIgnoreCase) >= 0)
                return "DatabaseCredentialsRejected";
            if (text.IndexOf("unknown database", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("database does not exist", StringComparison.OrdinalIgnoreCase) >= 0)
                return "DatabaseNotFound";
            if (text.IndexOf("too many connections", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("max_user_connections", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("blocked because of many connection errors", StringComparison.OrdinalIgnoreCase) >= 0)
                return "DatabaseCapacityExceeded";
            if (text.IndexOf("unable to connect", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("connection refused", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("connection timed out", StringComparison.OrdinalIgnoreCase) >= 0
                || text.IndexOf("timeout expired", StringComparison.OrdinalIgnoreCase) >= 0)
                return "DatabaseEndpointUnreachable";
            return "DatabaseConnectionUnavailable";
        }

        private static int ResolveRetryAfterSeconds(string diagnosticText)
        {
            var match = Regex.Match(
                diagnosticText ?? string.Empty,
                @"Retry\s+after\s+(\d{1,6})\s+seconds",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
                TimeSpan.FromMilliseconds(100));
            return match.Success
                   && int.TryParse(match.Groups[1].Value, NumberStyles.None,
                       CultureInfo.InvariantCulture, out var seconds)
                ? Math.Min(86400, Math.Max(0, seconds))
                : 0;
        }
    }
}
