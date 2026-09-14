using System;
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
    /// 表单关联数据的可信权限边界。先复核父菜单、父表与父记录，再固定辅助表和归属条件。
    /// 不能交给普通 CRUD 或可编辑事件决定身份/归属；Controller 只转交已认证的请求。
    /// 所有读取均无写入副作用，不调用调度器、版本生成器或历史回填。
    /// </summary>
    public static class FormRelatedDataService
    {
        public static Task<object> GetAsync(JObject param) => ExecuteAsync(param, false);
        public static Task<object> AddCommentAsync(JObject param) => ExecuteAsync(param, true);

        private static async Task<object> ExecuteAsync(JObject param, bool writeComment)
        {
            var osClient = param["OsClient"].Val<string>();
            var lang = param["_Lang"].Val<string>();
            var relatedType = writeComment ? "DataComment" : param["RelatedType"].Val<string>()?.Trim();
            var parentFormEngineKey = param["ParentFormEngineKey"].Val<string>()?.Trim();
            var parentTableRowId = param["ParentTableRowId"].Val<string>()?.Trim();
            var sysMenuId = param["_SysMenuId"].Val<string>()?.Trim();
            if (parentFormEngineKey.DosIsNullOrWhiteSpace()
                || parentTableRowId.DosIsNullOrWhiteSpace()
                || sysMenuId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(osClient, "ParamError", lang));
            }

            var parentParam = new DiyTableRowParam
            {
                FormEngineKey = parentFormEngineKey,
                Id = parentTableRowId,
                _SysMenuId = sysMenuId,
                _InvokeType = InvokeType.Client.ToString(),
                _IsAnonymous = false,
                _CurrentUser = param["_CurrentUser"] as JObject,
                OsClient = osClient,
                _Lang = lang
            };
            var authResult = await MicroiEngine.FormEngine
                .AuthorizeClientTableOperationAsync(parentParam, "Read");
            if (authResult == null || authResult.Code != 1)
            {
                return authResult
                    ?? new DosResult(0, null, DiyMessage.GetLang(osClient, "NoAuth", lang));
            }

            // 菜单/表授权不代表当前父记录可读。必须走真实 Client Get，执行父表
            // ServerDataV8 的行授权；不能用只选 Id 或 Count 探针跳过它。
            var parentResult = await MicroiEngine.FormEngine.GetFormDataAsync(parentParam);
            if (parentResult == null || parentResult.Code != 1 || parentResult.Data == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(osClient, "NoAuth", lang));
            }

            var normalizedType = relatedType?.ToLowerInvariant();
            if (normalizedType != "counts" && normalizedType != "datalog"
                && normalizedType != "datacomment" && normalizedType != "dataversion")
            {
                return new DosResult(0, null, DiyMessage.GetLang(osClient, "ParamError", lang));
            }

            // JObject 即使写 _InvokeType=Server 也不是可信来源。只在父记录完整授权后，
            // 从白名单构造新的 CLR 参数；请求不能覆盖表、条件、字段、分页或可信标记。
            var commentParentField = "ParentTableId";
            DiyTableRowParam BuildRelatedParam(string key, string rowField, List<string> fields)
            {
                return new DiyTableRowParam
                {
                    FormEngineKey = key,
                    OsClient = osClient,
                    _Lang = lang,
                    // 同一请求内只读复用身份；不为每张辅助表再次复制整棵权限树。
                    _CurrentUser = parentParam._CurrentUser,
                    _InvokeType = InvokeType.Server.ToString(),
                    _TrustedServerInvocation = true,
                    _IsAnonymous = false,
                    IsDeleted = 0,
                    _PageIndex = 1,
                    _PageSize = 200,
                    _OrderBy = "CreateTime",
                    _OrderByType = "DESC",
                    _SelectFields = fields,
                    _Where = new JArray
                    {
                        new JArray(rowField, "=", parentTableRowId),
                        new JArray(key == "diy_comment" ? commentParentField : "TableId", "=", parentParam.TableId)
                    }
                };
            }

            var commentAvailable = true;
            const string commentUnavailableReason = "CommentParentTableBindingUnavailable";
            const string commentUnavailableMessage = "评论组件需要升级表单引擎应用以补齐父表归属字段。";
            if (normalizedType == "counts" || normalizedType == "datacomment")
            {
                var commentFields = await MicroiEngine.FormEngine.GetDiyField(new DiyFieldParam
                {
                    TableName = "diy_comment", OsClient = osClient, _Lang = lang,
                    _OnlyRealField = true, _InvokeType = InvokeType.Server.ToString(),
                    _TrustedServerInvocation = true
                });
                if (commentFields == null || commentFields.Code != 1)
                {
                    return new DosResult(0, null, "无法核验评论父表绑定，请稍后重试。");
                }
                var fieldNames = commentFields.Data?.Select(field => (string)field["Name"]).ToList() ?? new List<string>();
                // 新版使用可通过标准建模工具升级的 ParentTableId；已正确绑定 TableId 的旧租户继续兼容。
                if (!fieldNames.Contains("ParentTableId", StringComparer.OrdinalIgnoreCase)) commentParentField = "TableId";
                commentAvailable = fieldNames.Contains(commentParentField, StringComparer.OrdinalIgnoreCase);
            }
            var append = new JObject
            {
                ["HistoryContentMode"] = "MetadataOnly",
                ["DataCommentUnavailableReason"] = commentAvailable ? null : commentUnavailableReason,
                ["DataCommentUnavailableMessage"] = commentAvailable ? null : commentUnavailableMessage
            };
            if (normalizedType == "datacomment" && !commentAvailable)
            {
                return new DosResult(0, null, commentUnavailableMessage, 0, append);
            }

            if (writeComment)
                return await WriteCommentAsync(param, parentParam, BuildRelatedParam("diy_comment", "TableRowId",
                    new List<string> { "Id", commentParentField, "TableRowId", "Content", "ParentCommentId", "UserId", "UserName" }), commentParentField);

            // 列表仍不读取 Data。只有代码管理表的当前有效管理员能按版本 Id 查看白名单代码字段。
            // 普通用户的当前行脱敏投影不能升级为历史原文权限，基础设施/密码表也不开放历史秘密。
            var versionId = param["VersionId"].Val<string>()?.Trim();
            string codeTableName = null;
            if (normalizedType == "dataversion")
            {
                var tableResult = await MicroiEngine.FormEngine.GetDiyTable(parentParam.TableId, osClient, lang);
                if (tableResult?.Code == 1 && tableResult.Data != null)
                    codeTableName = JObject.FromObject((object)tableResult.Data)["Name"].Val<string>();
                var canReadCode = V8CodeVersionService.IsSupportedTable(codeTableName)
                    && parentParam._CurrentUser?["_AccessKeySession"].Val<bool>() != true
                    && PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, parentParam._CurrentUser);
                append["HistoryContentMode"] = canReadCode ? "OnDemand" : "MetadataOnly";
                if (!string.IsNullOrEmpty(versionId) && !canReadCode)
                    return new DosResult(0, null, DiyMessage.GetLang(osClient, "NoAuth", lang));
            }

            // 父记录 DataFilter 只证明当前行的投影可读，不授予历史原始 Content/Data。
            // 查询阶段即排除历史正文、自由文本标题/备注和人员信息，避免在返回前才脱敏。
            var logParam = BuildRelatedParam("microi_datalog", "DataId", new List<string> { "Id", "Type", "CreateTime" });
            var versionParam = BuildRelatedParam("mic_data_version", "TableRowId", new List<string> { "Id", "Action", "Version", "CreateTime" });
            if (normalizedType == "dataversion" && !string.IsNullOrEmpty(versionId))
            {
                ((JArray)versionParam._Where).Add(new JArray("Id", "=", versionId));
                versionParam._PageSize = 1;
                versionParam._SelectFields.Add("Data");
            }
            var commentParam = BuildRelatedParam("diy_comment", "TableRowId", new List<string>
            {
                "Id", commentParentField, "TableRowId", "Content", "ParentCommentId", "CreateTime", "UserId", "UserName",
                "ReplyToUserId", "ReplyToUserName", "ReplyToContent"
            });
            if (normalizedType == "counts")
            {
                // 顺序读取有界三表，某项真实失败不可伪装为成功空列表；旧评论缺绑定单独标明不可用。
                var logCount = await MicroiEngine.FormEngine.GetTableDataCountAsync(logParam);
                if (logCount == null) return new DosResult(0, null, "关联日志查询未返回结果。");
                if (logCount.Code != 1) return logCount;
                DosResultList<dynamic> commentCount = null;
                if (commentAvailable)
                {
                    commentCount = await MicroiEngine.FormEngine.GetTableDataCountAsync(commentParam);
                    if (commentCount == null) return new DosResult(0, null, "关联评论查询未返回结果。");
                    if (commentCount.Code != 1) return commentCount;
                }
                var versionCount = await MicroiEngine.FormEngine.GetTableDataCountAsync(versionParam);
                if (versionCount == null) return new DosResult(0, null, "关联版本查询未返回结果。");
                if (versionCount.Code != 1) return versionCount;
                return new DosResult(1, new JObject
                {
                    ["DataLog"] = logCount.DataCount,
                    ["DataComment"] = commentAvailable ? JToken.FromObject(commentCount.DataCount) : JValue.CreateNull(),
                    ["DataVersion"] = versionCount.DataCount
                }, "", 0, append);
            }

            var relatedParam = normalizedType == "datalog" ? logParam
                : normalizedType == "dataversion" ? versionParam : commentParam;
            var result = await MicroiEngine.FormEngine.GetTableDataAsync(relatedParam);
            if (result == null) return new DosResult(0, null, "关联数据查询未返回结果。");
            if (result.Code == 1 && normalizedType == "dataversion" && !string.IsNullOrEmpty(versionId))
            {
                if (result.Data == null || result.Data.Count != 1)
                    return new DosResult(2, null, "此版本不存在或不属于当前记录。");
                var row = JObject.FromObject((object)result.Data[0]);
                var data = V8CodeVersionService.ProjectReadableCodeSnapshot(codeTableName, row["Data"], parentTableRowId);
                if (data == null) return new DosResult(0, null, "此版本没有可读取的代码快照。");
                row["Data"] = data.ToString(Formatting.None);
                result.Data = new List<dynamic> { row };
                append["HistoryContentMode"] = "Authorized";
            }
            if (result?.Code == 1) result.DataAppend = append;
            return result;
        }

        private static async Task<object> WriteCommentAsync(JObject request, DiyTableRowParam parent, DiyTableRowParam query, string parentField)
        {
            var content = request["Content"].Val<string>()?.Trim();
            var requestId = request["RequestId"].Val<string>();
            // 前端 NewGuid 当前返回 ULID，兼容旧客户端 GUID；两者都作为稳定数据库主键。
            var id = Guid.TryParse(requestId, out var guid) ? guid.ToString()
                : requestId != null && Regex.IsMatch(requestId, "^[0-7][0-9A-HJKMNP-TV-Z]{25}$", RegexOptions.CultureInvariant)
                    ? requestId : null;
            if (string.IsNullOrWhiteSpace(content) || content.Length > 20000 || id == null)
                return new DosResult(0, null, "评论内容不能为空且不超过 20000 字，提交标识必须有效。");

            var replyId = request["ParentCommentId"].Val<string>()?.Trim() ?? "";
            var row = new JObject
            {
                ["Id"] = id.ToString(), [parentField] = parent.TableId, ["TableRowId"] = parent.Id,
                ["Content"] = content, ["ParentCommentId"] = replyId,
                ["UserId"] = parent._CurrentUser["Id"], ["UserName"] = parent._CurrentUser["Name"]
            };
            async Task<JObject> ReadComment(string commentId)
            {
                query._Where = new JArray(new JArray(parentField, "=", parent.TableId),
                    new JArray("TableRowId", "=", parent.Id), new JArray("Id", "=", commentId));
                query._PageSize = 1;
                var found = await MicroiEngine.FormEngine.GetTableDataAsync(query);
                if (found?.Code != 1) throw new InvalidOperationException(found?.Msg ?? "评论查询失败。");
                return found.Data?.Count == 1 ? JObject.FromObject((object)found.Data[0]) : null;
            }
            try
            {
                // 回复的作者与引用正文由同父表、同父记录的原评论生成，不接受客户端伪造。
                if (!string.IsNullOrEmpty(replyId))
                {
                    var reply = await ReadComment(replyId);
                    if (reply == null) return new DosResult(0, null, "回复的评论不存在或不属于当前记录。");
                    row["ReplyToUserId"] = reply["UserId"];
                    row["ReplyToUserName"] = reply["UserName"];
                    row["ReplyToContent"] = reply["Content"];
                }
                bool Matches(JObject existing) => existing != null
                    && existing["UserId"].Val<string>() == row["UserId"].Val<string>()
                    && existing["Content"].Val<string>() == content
                    && (existing["ParentCommentId"].Val<string>() ?? "") == replyId;
                var existing = await ReadComment(id.ToString());
                if (existing != null) return Matches(existing)
                    ? new DosResult(1, new { Id = id.ToString(), Reused = true })
                    : new DosResult(0, null, "提交标识已被另一条评论使用，请刷新后重试。");
                var saved = await MicroiEngine.FormEngine.AddFormDataAsync(new DiyTableRowParam
                {
                    Id = id.ToString(), FormEngineKey = "diy_comment", OsClient = parent.OsClient,
                    _CurrentUser = parent._CurrentUser, _InvokeType = InvokeType.Server.ToString(),
                    _TrustedServerInvocation = true, _IsAnonymous = false, _RowModel = row
                });
                // 数据库主键保证跨节点去重；响应失败只回读同一 Id，不重复创建评论。
                if (saved?.Code == 1) return new DosResult(1, new { Id = id.ToString() });
                existing = await ReadComment(id.ToString());
                return Matches(existing) ? new DosResult(1, new { Id = id.ToString(), Reused = true })
                    : new DosResult(0, null, saved?.Msg ?? "评论提交失败。");
            }
            catch (Exception)
            {
                return new DosResult(0, null, "评论提交结果未确认，请保留当前内容后重试。");
            }
        }
    }
}
