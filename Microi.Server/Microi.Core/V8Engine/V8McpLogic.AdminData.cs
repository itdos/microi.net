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
    /// MCP 平台管理员通用数据控制面。
    ///
    /// 这是可信鉴权边界，不能下沉到可编辑的接口引擎：调用者身份必须来自
    /// DiyToken，并由当前租户主库和有效管理员角色实时复核。通用入口只处理
    /// 当前租户的单表 FormEngine 操作；秘密字段继续由专用安全端点维护。
    /// </summary>
    public static partial class V8McpLogic
    {
        internal const int AdministrativeDataMaxPageSize = 200;
        internal const int AdministrativeDataMaxPayloadCharacters = 1024 * 1024;

        private static readonly HashSet<string> AdministrativeQueryFields =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Id", "Ids", "IsDeleted",
                "_Where", "_SelectFields", "_SelectNotFields",
                "_OrderBy", "_OrderByType", "_OrderBys",
                "_PageIndex", "_PageSize", "_Top", "_Keyword",
                "_Search", "_SearchEqual", "_SearchEqualOr", "_SearchEqualOrGroup",
                "_SearchOr", "_SearchOrGroup", "_SearchCheckbox", "_SearchDateTime",
                "_RawMetadata", "_TranslateFields", "_Lang"
            };

        private static readonly HashSet<string> AdministrativeSensitiveFields =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Pwd", "Password", "Passwd", "PwdEncode", "PasswordHash", "PasswordSalt",
                "NewPwd", "_EncodePwd", "_EncodeNewPwd", "PwdV8",
                "Token", "_Token", "TokenName", "AccessToken", "RefreshToken", "TokenValue",
                "ApiToken", "BearerToken", "Authorization", "Cookie", "SetCookie",
                "AuthSecret", "AuthSecretRotateVersion", "ClientSecret", "ClientSecrets",
                "AppSecret", "ApiKey", "AiApiKey", "AccessKey", "SecretKey", "Secret", "SecretCipher",
                "PrivateKey", "PrivateKeyPem", "LicensePrivateKey", "CertPwd",
                "DbConn", "DbReadConn", "DbMongoConnection", "ConnectionString",
                "RedisPwd", "MqPassword", "SmtpPassword", "FileCabinetSecret",
                "AesKey", "ChanjetAesKey", "ChanjetAppKey", "ChanjetOAuthState",
                "WeChatTemplateAppSecret", "WeChatMiniProgramAppSecret",
                "WeChatMiniProgramMessageToken", "WeChatMiniProgramAESKey",
                "WeChatMiniProgramEncodingAESKey", "FaceApiKey",
                "ServerPrivateSettings", "OsClientModel", "GlobalServerV8Code",
                "_IdentityVerificationTicket", "_IdentityVerificationActionHash",
                "ContentSecurityLoginCode"
            };

        private static readonly HashSet<string> AdministrativeReservedRowFields =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "OsClient", "_OsClient", "FormEngineKey", "_FormEngineKey",
                "authorization", "DiyToken", "CurrentUser", "_CurrentUser",
                "_TrustedServerInvocation", "_InvokeType"
            };

        internal static bool IsAdministrativeTableName(string tableName)
        {
            return !string.IsNullOrWhiteSpace(tableName)
                   && tableName.Length <= 128
                   && Regex.IsMatch(tableName, @"^[A-Za-z_][A-Za-z0-9_]*$");
        }

        internal static bool IsAdministrativeSensitiveField(string fieldName)
        {
            if (string.IsNullOrWhiteSpace(fieldName)) return false;
            if (AdministrativeSensitiveFields.Contains(fieldName)) return true;

            var normalized = Regex.Replace(fieldName, "[^A-Za-z0-9]", string.Empty)
                .ToLowerInvariant();
            return normalized.EndsWith("password", StringComparison.Ordinal)
                   || normalized.EndsWith("passwd", StringComparison.Ordinal)
                   || normalized.EndsWith("pwd", StringComparison.Ordinal)
                   || normalized.EndsWith("secret", StringComparison.Ordinal)
                   || normalized.EndsWith("secretcipher", StringComparison.Ordinal)
                   || normalized.EndsWith("accesstoken", StringComparison.Ordinal)
                   || normalized.EndsWith("refreshtoken", StringComparison.Ordinal)
                   || normalized.EndsWith("apikey", StringComparison.Ordinal)
                   || normalized.EndsWith("privatekey", StringComparison.Ordinal)
                   || normalized.Contains("connectionstring", StringComparison.Ordinal);
        }

        internal static JToken RedactAdministrativeData(JToken token)
        {
            if (token == null) return JValue.CreateNull();
            var clone = token.DeepClone();
            RedactAdministrativeDataInPlace(clone);
            return clone;
        }

        private static void RedactAdministrativeDataInPlace(JToken token)
        {
            if (token is JObject obj)
            {
                foreach (var property in obj.Properties().ToList())
                {
                    if (IsAdministrativeSensitiveField(property.Name))
                    {
                        property.Value = "***REDACTED***";
                        continue;
                    }
                    if (property.Value.Type == JTokenType.String
                        && TryParseEmbeddedJson(property.Value.Val<string>(), out var embedded))
                    {
                        RedactAdministrativeDataInPlace(embedded);
                        property.Value = embedded.ToString(Formatting.None);
                        continue;
                    }
                    RedactAdministrativeDataInPlace(property.Value);
                }
                return;
            }

            if (token is JArray array)
            {
                foreach (var item in array) RedactAdministrativeDataInPlace(item);
            }
        }

        internal static string BuildAdministrativeDataConfirmation(
            string operation,
            string tableName,
            string id = null)
        {
            var normalizedOperation = (operation ?? string.Empty).Trim().ToUpperInvariant();
            var normalizedTable = (tableName ?? string.Empty).Trim();
            return normalizedOperation == "ADD"
                ? $"ADD:{normalizedTable}"
                : $"{normalizedOperation}:{normalizedTable}:{(id ?? string.Empty).Trim()}";
        }

        internal static (JObject Row, string[] ReservedFields, string[] SensitiveFields)
            SanitizeAdministrativeMutationRow(JObject row)
        {
            var safe = row == null ? new JObject() : (JObject)row.DeepClone();
            var reserved = new List<string>();
            var sensitive = new List<string>();
            foreach (var property in safe.Properties().ToList())
            {
                if (property.Name.StartsWith("_", StringComparison.Ordinal)
                    || AdministrativeReservedRowFields.Contains(property.Name))
                {
                    reserved.Add(property.Name);
                    property.Remove();
                    continue;
                }
            }
            RemoveAdministrativeSensitiveFields(safe, sensitive, string.Empty);
            return (
                safe,
                reserved.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToArray(),
                sensitive.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToArray());
        }

        private static void RemoveAdministrativeSensitiveFields(
            JToken token,
            ICollection<string> sensitivePaths,
            string path)
        {
            if (token is JObject obj)
            {
                foreach (var property in obj.Properties().ToList())
                {
                    var propertyPath = string.IsNullOrWhiteSpace(path)
                        ? property.Name
                        : path + "." + property.Name;
                    if (IsAdministrativeSensitiveField(property.Name))
                    {
                        sensitivePaths.Add(propertyPath);
                        property.Remove();
                        continue;
                    }
                    if (property.Value.Type == JTokenType.String
                        && TryParseEmbeddedJson(property.Value.Val<string>(), out var embedded))
                    {
                        RemoveAdministrativeSensitiveFields(embedded, sensitivePaths, propertyPath);
                        continue;
                    }
                    RemoveAdministrativeSensitiveFields(property.Value, sensitivePaths, propertyPath);
                }
                return;
            }

            if (token is JArray array)
            {
                for (var index = 0; index < array.Count; index++)
                    RemoveAdministrativeSensitiveFields(array[index], sensitivePaths, $"{path}[{index}]");
            }
        }

        private static bool TryParseEmbeddedJson(string value, out JToken token)
        {
            token = null;
            var text = (value ?? string.Empty).Trim();
            if (text.Length < 2 || text.Length > AdministrativeDataMaxPayloadCharacters
                || !((text[0] == '{' && text[text.Length - 1] == '}')
                     || (text[0] == '[' && text[text.Length - 1] == ']')))
                return false;
            try
            {
                token = JToken.Parse(text);
                return token is JObject || token is JArray;
            }
            catch
            {
                token = null;
                return false;
            }
        }

        private static (bool Ok, string Msg, CurrentToken Token) ValidateAdministrativeDataToken(
            object currentToken)
        {
            if (!(currentToken is CurrentToken token) || token.CurrentUser == null)
                return (false, "未登录或登录已过期", null);
            if (UserAccessKeySecurity.IsSession(token.CurrentUser))
                return (false, "平台管理员通用数据控制面不接受访问密钥会话，请使用真实登录 DiyToken。", null);

            var level = token.CurrentUser["Level"].Val<int>();
            if (level < DiyCommon.MaxRoleLevel
                || !PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                    token.OsClient,
                    token.CurrentUser))
            {
                return (false, $"权限不足，需要当前有效且 Level >= {DiyCommon.MaxRoleLevel} 的平台管理员身份。", null);
            }
            return (true, string.Empty, token);
        }

        public static DosResult<object> GetAdministrativeCapabilities(object currentToken)
        {
            var authorization = ValidateAdministrativeDataToken(currentToken);
            if (!authorization.Ok) return new DosResult<object>(0, null, authorization.Msg);

            var token = authorization.Token;
            return new DosResult<object>(1, new
            {
                PlatformAdministrator = true,
                Level = token.CurrentUser["Level"].Val<int>(),
                RequiredLevel = DiyCommon.MaxRoleLevel,
                LevelComparison = ">=",
                IdentitySource = "DiyToken + current-tenant sys_user + active administrator role",
                SessionType = "InteractiveDiyToken",
                AccessKeySessionAllowed = false,
                Tenant = token.OsClient,
                CurrentTenantOnly = true,
                GenericDataOperations = new[] { "query", "get", "add", "update", "delete" },
                QueryMaxPageSize = AdministrativeDataMaxPageSize,
                MutationScope = "single-row",
                SecretPolicy = "Secret/password/token/key/connection fields are redacted and cannot be mutated through the generic tool; use dedicated secure platform endpoints.",
                Discovery = new
                {
                    ToolCatalog = "microi_codex(action=list_tools)",
                    ToolDetails = "microi_codex(action=describe_tool)",
                    DatabaseSchema = "microi_get_db_schema(tableName?)",
                    GenericData = "microi_admin_table_data"
                },
                PlatformCatalog = new object[]
                {
                    new { Area = "表单与数据模型", Tables = new[] { "diy_table", "diy_field" }, ToolKeywords = new[] { "table", "field", "layout", "schema" } },
                    new { Area = "菜单、角色与权限", Tables = new[] { "sys_menu", "sys_role", "sys_rolelimit" }, ToolKeywords = new[] { "module", "role", "permission" } },
                    new { Area = "接口、数据源与任务引擎", Tables = new[] { "sys_apiengine", "diy_datasource", "diy_schedule_job" }, ToolKeywords = new[] { "engine", "data source", "job" } },
                    new { Area = "工作流、状态机与自动化", Tables = new[] { "wf_flowdesign", "wf_node", "wf_line" }, ToolKeywords = new[] { "workflow", "state machine", "automation" } },
                    new { Area = "界面与打印引擎", Tables = new[] { "mic_page", "mic_print" }, ToolKeywords = new[] { "page", "print" } },
                    new { Area = "应用、微服务与商城", Tables = new[] { "sys_microiservice", "sys_microistore", "mci_ai_app_file" }, ToolKeywords = new[] { "application", "microservice", "store" } },
                    new { Area = "系统与租户配置", Tables = new[] { "sys_config", "sys_osclients", "mci_system_setting" }, ToolKeywords = new[] { "status", "settings", "observability" } }
                }
            });
        }

        public static async Task<DosResult<object>> AdministerTableData(
            string osClient,
            JObject request,
            object currentToken)
        {
            var authorization = ValidateAdministrativeDataToken(currentToken);
            if (!authorization.Ok) return new DosResult<object>(0, null, authorization.Msg);
            if (request == null) return new DosResult<object>(0, null, "请求参数不能为空");

            var token = authorization.Token;
            if (!string.Equals(osClient, token.OsClient, StringComparison.OrdinalIgnoreCase))
                return new DosResult<object>(0, null, "只能维护当前 Token 所属租户的数据。");

            var operation = (request["Operation"].Val<string>()
                             ?? request["operation"].Val<string>()
                             ?? string.Empty).Trim().ToLowerInvariant();
            var tableName = (request["TableName"].Val<string>()
                             ?? request["tableName"].Val<string>()
                             ?? string.Empty).Trim();
            if (!new[] { "query", "get", "add", "update", "delete" }.Contains(operation))
                return new DosResult<object>(0, null, "Operation 只支持 query/get/add/update/delete。");
            if (!IsAdministrativeTableName(tableName))
                return new DosResult<object>(0, null, "TableName 只能包含英文字母、数字和下划线，长度不超过 128。");

            try
            {
                if (operation == "query")
                {
                    var queryResult = BuildAdministrativeQueryParam(
                        request["Query"] as JObject ?? request["query"] as JObject,
                        osClient,
                        token.CurrentUser);
                    if (!queryResult.Ok) return new DosResult<object>(0, null, queryResult.Msg);

                    var result = await MicroiEngine.FormEngine
                        .GetTableDataAsync<dynamic>(tableName, queryResult.Param)
                        .ConfigureAwait(false);
                    QueueAdministrativeDataAudit(token, operation, tableName, null,
                        result.Code == 1, queryResult.Param._SelectFields, queryResult.Param._PageSize);
                    if (result.Code != 1)
                        return new DosResult<object>(result.Code, null, result.Msg);

                    return new DosResult<object>(1, new
                    {
                        Operation = operation,
                        TableName = tableName,
                        PageIndex = queryResult.Param._PageIndex,
                        PageSize = queryResult.Param._PageSize,
                        Total = result.DataCount,
                        Data = RedactAdministrativeObject(result.Data),
                        SensitiveFieldsRedacted = true
                    });
                }

                var id = (request["Id"].Val<string>()
                          ?? request["id"].Val<string>()
                          ?? string.Empty).Trim();
                if (operation == "get")
                {
                    if (string.IsNullOrWhiteSpace(id))
                        return new DosResult<object>(0, null, "get 操作必须提供 Id。");
                    var result = await GetAdministrativeRow(tableName, osClient, id, token.CurrentUser)
                        .ConfigureAwait(false);
                    QueueAdministrativeDataAudit(token, operation, tableName, id, result.Code == 1);
                    if (result.Code != 1) return new DosResult<object>(result.Code, null, result.Msg);
                    return new DosResult<object>(1, new
                    {
                        Operation = operation,
                        TableName = tableName,
                        Id = id,
                        Data = RedactAdministrativeObject(result.Data),
                        SensitiveFieldsRedacted = true
                    });
                }

                var sourceRow = request["Row"] as JObject ?? request["row"] as JObject;
                if ((operation == "add" || operation == "update") && sourceRow == null)
                    return new DosResult<object>(0, null, $"{operation} 操作必须提供 Row。");
                if (sourceRow != null
                    && sourceRow.ToString(Formatting.None).Length > AdministrativeDataMaxPayloadCharacters)
                    return new DosResult<object>(0, null, "Row 超过 1 MiB 控制面请求上限。");

                var sanitization = SanitizeAdministrativeMutationRow(sourceRow);
                if (sanitization.ReservedFields.Length > 0)
                    return new DosResult<object>(0, new { sanitization.ReservedFields },
                        "Row 包含禁止由调用方提供的身份或传输字段。");
                if (sanitization.SensitiveFields.Length > 0)
                    return new DosResult<object>(0, new { sanitization.SensitiveFields },
                        "秘密字段不能通过通用数据工具写入，请使用对应的专用安全端点。");

                var row = sanitization.Row;
                id = (id ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(id)) id = row?["Id"].Val<string>()?.Trim() ?? string.Empty;
                if (operation == "add" && string.IsNullOrWhiteSpace(id))
                {
                    id = Ulid.NewUlid().ToString();
                    row["Id"] = id;
                }
                if ((operation == "update" || operation == "delete") && string.IsNullOrWhiteSpace(id))
                    return new DosResult<object>(0, null, $"{operation} 操作必须提供 Id。");
                if (operation == "update") row["Id"] = id;

                var expectedConfirmation = BuildAdministrativeDataConfirmation(operation, tableName, id);
                var suppliedConfirmation = request["ConfirmExecution"].Val<string>()
                                           ?? request["confirmExecution"].Val<string>();
                if (!string.Equals(expectedConfirmation, suppliedConfirmation, StringComparison.Ordinal))
                {
                    return new DosResult<object>(0, new
                    {
                        DryRun = true,
                        Operation = operation,
                        TableName = tableName,
                        Id = string.IsNullOrWhiteSpace(id) ? null : id,
                        Fields = row?.Properties().Select(x => x.Name).OrderBy(x => x).ToArray(),
                        RequiredConfirmation = expectedConfirmation
                    }, $"写入已拦截，请传 ConfirmExecution={expectedConfirmation}");
                }

                DosResult<dynamic> before = null;
                if (operation == "update" || operation == "delete")
                {
                    before = await GetAdministrativeRow(tableName, osClient, id, token.CurrentUser)
                        .ConfigureAwait(false);
                    if (before.Code != 1)
                        return new DosResult<object>(before.Code, null, $"目标数据不存在或不可读取：{before.Msg}");
                }

                var writeParam = BuildTrustedMcpFormWriteParam(osClient,
                    operation == "delete" ? new JObject { ["Id"] = id } : row);
                writeParam._CurrentUser = (JObject)token.CurrentUser.DeepClone();

                DosResult writeResult;
                if (operation == "add")
                    writeResult = await MicroiEngine.FormEngine.AddFormDataAsync(tableName, writeParam).ConfigureAwait(false);
                else if (operation == "update")
                    writeResult = await MicroiEngine.FormEngine.UptFormDataAsync(tableName, writeParam).ConfigureAwait(false);
                else
                    writeResult = await MicroiEngine.FormEngine.DelFormDataAsync(tableName, writeParam).ConfigureAwait(false);

                QueueAdministrativeDataAudit(token, operation, tableName, id, writeResult.Code == 1,
                    row?.Properties().Select(x => x.Name));
                if (writeResult.Code != 1)
                    return new DosResult<object>(writeResult.Code, null, writeResult.Msg);

                if (operation == "delete")
                {
                    return new DosResult<object>(1, new
                    {
                        Operation = operation,
                        TableName = tableName,
                        Id = id,
                        Deleted = true,
                        Before = RedactAdministrativeObject(before?.Data),
                        SensitiveFieldsRedacted = true
                    });
                }

                var readback = await GetAdministrativeRow(tableName, osClient, id, token.CurrentUser)
                    .ConfigureAwait(false);
                if (readback.Code != 1)
                    return new DosResult<object>(0, new { Written = true, Id = id },
                        "数据已写入，但回读验证失败：" + readback.Msg);
                return new DosResult<object>(1, new
                {
                    Operation = operation,
                    TableName = tableName,
                    Id = id,
                    Written = true,
                    Data = RedactAdministrativeObject(readback.Data),
                    SensitiveFieldsRedacted = true
                });
            }
            catch (Exception ex)
            {
                QueueAdministrativeDataAudit(token, operation, tableName, null, false);
                return new DosResult<object>(0, null, "平台管理员数据操作失败：" + ex.Message);
            }
        }

        private static (bool Ok, string Msg, DiyTableRowParam Param) BuildAdministrativeQueryParam(
            JObject source,
            string osClient,
            JObject currentUser)
        {
            var query = source == null ? new JObject() : (JObject)source.DeepClone();
            if (query.ToString(Formatting.None).Length > AdministrativeDataMaxPayloadCharacters)
                return (false, "Query 超过 1 MiB 控制面请求上限。", null);

            var unsupported = query.Properties()
                .Where(x => !AdministrativeQueryFields.Contains(x.Name))
                .Select(x => x.Name)
                .OrderBy(x => x)
                .ToArray();
            if (unsupported.Length > 0)
                return (false, "Query 包含不支持的字段：" + string.Join(", ", unsupported), null);

            DiyTableRowParam param;
            try
            {
                param = query.ToObject<DiyTableRowParam>() ?? new DiyTableRowParam();
            }
            catch (Exception ex)
            {
                return (false, "Query 格式无效：" + ex.Message, null);
            }

            param.OsClient = osClient;
            param._InvokeType = InvokeType.Server.ToString();
            param._TrustedServerInvocation = true;
            param._CurrentUser = (JObject)currentUser.DeepClone();
            param._PageIndex = Math.Max(1, param._PageIndex ?? 1);
            param._PageSize = Math.Min(AdministrativeDataMaxPageSize,
                Math.Max(1, param._PageSize ?? 50));
            if (param._Top.HasValue)
                param._Top = Math.Min(AdministrativeDataMaxPageSize, Math.Max(1, param._Top.Value));
            return (true, string.Empty, param);
        }

        private static Task<DosResult<dynamic>> GetAdministrativeRow(
            string tableName,
            string osClient,
            string id,
            JObject currentUser)
        {
            return MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(tableName, new DiyTableRowParam
            {
                OsClient = osClient,
                Id = id,
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true,
                _CurrentUser = (JObject)currentUser.DeepClone()
            });
        }

        private static JToken RedactAdministrativeObject(object value)
        {
            if (value == null) return JValue.CreateNull();
            var token = value as JToken ?? JToken.FromObject(value);
            return RedactAdministrativeData(token);
        }

        private static void QueueAdministrativeDataAudit(
            CurrentToken token,
            string operation,
            string tableName,
            string id,
            bool success,
            IEnumerable<string> fields = null,
            int? pageSize = null)
        {
            var fieldNames = (fields ?? Array.Empty<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .Take(100)
                .ToArray();
            var actorId = token?.CurrentUser?["Id"].Val<string>() ?? string.Empty;
            var content = $"Operation={operation};Table={tableName};Id={id ?? string.Empty};" +
                          $"ActorId={actorId};PageSize={pageSize?.ToString() ?? string.Empty};" +
                          $"Fields={string.Join(",", fieldNames)}";
            MicroiEngine.QueueSystemLog(
                token?.OsClient,
                "MCP",
                "AdministrativeTableData",
                "MCP 平台管理员数据操作",
                content,
                success ? 1 : 3,
                success,
                id);
        }
    }
}
