using System;
using System.Collections.Generic;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 平台客户端 Managed 接口所需的最小可信原子。
    ///
    /// 这里不承载可变业务编排，只负责接口引擎无法自行证明的租户、DiyToken、
    /// 访问密钥、表读取权限与会话运行态边界。新增业务必须继续写在官方应用包
    /// 的 Managed ApiEngine，并通过 CreateIfMissing Hook 扩展。
    /// </summary>
    public partial class V8Method
    {
        private const string DataSourceRuntimeEngineKey = "platform-data-source-run";
        private const string ModuleRuntimeEngineKey = "platform-module-data";
        private const string OfficeTemplateRuntimeEngineKey = "platform-office-export-word-by-template";
        private const string UserBehaviorRuntimeEngineKey = "platform-user-behavior-signal";

        private static readonly HashSet<string> AllowedModuleRuntimeActions =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "GetTableData",
                "GetTableDataCount",
                "GetTableDataTree",
                "GetTableTree"
            };

        private static readonly HashSet<string> AllowedUserBehaviorSignals =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "V8ButtonClick",
                "DetailClose",
                "PageHidden",
                "PageVisible",
                "PageClosed",
                "AttachmentClick"
            };

        /// <inheritdoc />
        public DosResult RunDataSourceEngine(dynamic dynamicParam)
        {
            try
            {
                var denied = ResolveTrustedManagedCurrentUser(
                    DataSourceRuntimeEngineKey,
                    false,
                    0,
                    out var osClient,
                    out var currentUser);
                if (denied != null) return denied;

                var request = ToJObject((object)dynamicParam);
                var dataSourceKey = request["DataSourceKey"].Val<string>();
                if (dataSourceKey.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "DataSourceKey 不能为空。");
                if (!UserAccessKeySecurity.IsDataSourceAllowed(currentUser, dataSourceKey))
                    return new DosResult(0, null, "当前访问密钥未授权运行此数据源引擎。");

                request["OsClient"] = osClient;
                request["_CurrentUser"] = currentUser;
                request["_InvokeType"] = InvokeType.Client.ToString();
                request["_IsAnonymous"] = false;
                return MicroiEngine.DataSource
                    .RunAsync(request)
                    .ConfigureAwait(false)
                    .GetAwaiter()
                    .GetResult();
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "运行数据源引擎失败：" + ex.Message);
            }
        }

        /// <inheritdoc />
        public dynamic RunModuleEngine(dynamic dynamicParam)
        {
            try
            {
                var denied = ResolveTrustedManagedCurrentUser(
                    ModuleRuntimeEngineKey,
                    false,
                    0,
                    out var osClient,
                    out var currentUser);
                if (denied != null) return denied;

                var request = ToJObject((object)dynamicParam);
                var action = request["Action"].Val<string>();
                if (action.DosIsNullOrWhiteSpace()) action = "GetTableData";
                if (!AllowedModuleRuntimeActions.Contains(action))
                    return new DosResult(0, null, "不支持的模块引擎动作。");

                request.Remove("Action");
                request["OsClient"] = osClient;
                request["_CurrentUser"] = currentUser;
                request["_InvokeType"] = InvokeType.Client.ToString();
                request["_IsAnonymous"] = false;
                switch (action.ToLowerInvariant())
                {
                    case "gettabledata":
                        return MicroiEngine.ModuleEngine.GetTableData(request);
                    case "gettabledatacount":
                        return MicroiEngine.ModuleEngine.GetTableDataCount(request);
                    case "gettabledatatree":
                    case "gettabletree":
                        return MicroiEngine.ModuleEngine.GetTableDataTree(request);
                    default:
                        return new DosResult(0, null, "不支持的模块引擎动作。");
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "运行模块引擎失败：" + ex.Message);
            }
        }

        /// <inheritdoc />
        public DosResult ExportWordByTemplate(dynamic dynamicParam)
        {
            try
            {
                var denied = ResolveTrustedManagedCurrentUser(
                    OfficeTemplateRuntimeEngineKey,
                    true,
                    0,
                    out var osClient,
                    out var currentUser);
                if (denied != null) return denied;

                var request = ToJObject((object)dynamicParam);
                var param = request.ToObject<OfficeExportParam>() ?? new OfficeExportParam();
                // 兼容历史文档中的 TemplateId 命名；Office 内核的标准字段为 TplId。
                if (param.TplId.DosIsNullOrWhiteSpace())
                    param.TplId = request["TemplateId"].Val<string>();
                param.OsClient = osClient;
                param._CurrentUser = currentUser;
                param._InvokeType = InvokeType.Client.ToString();
                if (param.TplId.DosIsNullOrWhiteSpace()
                    || param.FormDataId.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "TplId（兼容 TemplateId）和 FormDataId 不能为空。");
                if (param._SysMenuId.DosIsNullOrWhiteSpace()
                    && param.ModuleEngineKey.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, DiyMessage.GetLang(osClient, "NoAuth", param._Lang));

                var authorization = MicroiEngine.FormEngine
                    .AuthorizeClientTableOperationAsync(
                        new DiyTableRowParam
                        {
                            FormEngineKey = param.FormEngineKey,
                            Id = param.FormDataId,
                            _SysMenuId = param._SysMenuId,
                            ModuleEngineKey = param.ModuleEngineKey,
                            _InvokeType = InvokeType.Client.ToString(),
                            _CurrentUser = currentUser,
                            OsClient = osClient,
                            _Lang = param._Lang
                        },
                        "Read")
                    .ConfigureAwait(false)
                    .GetAwaiter()
                    .GetResult();
                if (authorization.Code != 1) return authorization;

                var result = MicroiEngine.Office
                    .ExportWordByTpl(param)
                    .ConfigureAwait(false)
                    .GetAwaiter()
                    .GetResult();
                if (result.Code != 1)
                    return new DosResult(result.Code, null, result.Msg, null, result.DataAppend);
                return new DosResult(1, new
                {
                    FileName = "word模板导出 - " + DateTime.Now.ToString("yyyyMMddHHmmss") + ".doc",
                    ContentType = "application/msword",
                    FileByteBase64 = Convert.ToBase64String(result.Data)
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "按模板导出 Word 失败：" + ex.Message);
            }
        }

        /// <inheritdoc />
        public DosResult TrackUserBehavior(dynamic dynamicParam)
        {
            try
            {
                var denied = ResolveTrustedManagedCurrentUser(
                    UserBehaviorRuntimeEngineKey,
                    true,
                    0,
                    out var osClient,
                    out var currentUser);
                if (denied != null) return denied;

                var request = ToJObject((object)dynamicParam);
                var action = request["Action"].Val<string>();
                if (!AllowedUserBehaviorSignals.Contains(action))
                    return new DosResult(0, null, "不支持的行为信号。");

                var currentToken = DiyToken.GetCurrentToken(false)
                    .ConfigureAwait(false)
                    .GetAwaiter()
                    .GetResult();
                if (currentToken?.CurrentUser == null
                    || !string.Equals(currentToken.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                    return new DosResult(1001, null, "登录身份已过期！");

                var httpContext = DiyHttpContext.Current;
                var requestToken = httpContext?.Request?.Headers?["Authorization"].ToString();
                var tokenEntry = DiyToken.GetActiveCachedTokenEntry(currentToken, requestToken);
                var clientType = tokenEntry?.ClientType;
                var did = tokenEntry?.Did;
                var table = LimitBehaviorText(request["Table"].Val<string>(), 128);
                var rowId = LimitBehaviorText(request["RowId"].Val<string>(), 256);
                var tracker = MicroiEngine.TryGetService<UserBehaviorSessionTracker>();

                if (string.Equals(action, "DetailClose", StringComparison.OrdinalIgnoreCase))
                {
                    if (tracker == null) return new DosResult(0, null, "用户行为会话追踪服务不可用。");
                    tracker.CloseDetailAsync(
                            osClient,
                            currentUser,
                            table,
                            rowId,
                            clientType,
                            did,
                            "ClientSignal")
                        .ConfigureAwait(false)
                        .GetAwaiter()
                        .GetResult();
                    return new DosResult(1);
                }

                var context = new DiyTableRowParam
                {
                    OsClient = osClient,
                    _CurrentUser = currentUser,
                    _ClientType = clientType,
                    _InvokeType = InvokeType.Client.ToString()
                };
                var name = LimitBehaviorText(request["Name"].Val<string>(), 256);
                var targetId = LimitBehaviorText(request["TargetId"].Val<string>(), 256);
                var descriptions = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["V8ButtonClick"] = "点击了V8按钮[" + name + "]",
                    ["PageHidden"] = "将浏览器标签页切换到后台或休眠",
                    ["PageVisible"] = "将浏览器标签页恢复到前台",
                    ["PageClosed"] = "关闭或离开了浏览器标签页",
                    ["AttachmentClick"] = "点击了附件[" + name + "]"
                };
                long? durationSeconds = null;
                if (action.StartsWith("Page", StringComparison.OrdinalIgnoreCase) && tokenEntry != null)
                {
                    durationSeconds = Math.Max(0, (long)(DateTime.Now - tokenEntry.CreateTime).TotalSeconds);
                    descriptions[action] += "，本次登录已持续"
                        + UserBehaviorAudit.FormatDuration(durationSeconds.Value);
                }
                var category = action.StartsWith("Page", StringComparison.OrdinalIgnoreCase)
                    ? "Session"
                    : action == "AttachmentClick" ? "File" : "Interaction";
                UserBehaviorAudit.Track(
                    context,
                    category,
                    action,
                    "用户行为",
                    action == "AttachmentClick" ? "PrivateFile" : "UI",
                    targetId,
                    descriptions[action],
                    new
                    {
                        Name = name,
                        TargetId = targetId,
                        Table = table,
                        RowId = rowId,
                        LoginDuration = durationSeconds.HasValue
                            ? UserBehaviorAudit.FormatDuration(durationSeconds.Value)
                            : null
                    },
                    true,
                    durationSeconds,
                    "ClientSignal",
                    UserBehaviorAudit.HashIdentifier(tokenEntry?.Token),
                    did);
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "记录用户行为失败：" + ex.Message);
            }
        }

        private static string LimitBehaviorText(string value, int max)
        {
            if (value == null) return null;
            return value.Length > max ? value.Substring(0, max) : value;
        }
    }
}
