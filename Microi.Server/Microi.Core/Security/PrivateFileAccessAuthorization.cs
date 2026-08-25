using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 私有文件浏览器访问的统一授权内核。Controller 兼容入口和官方接口引擎
    /// 必须共同调用这里，禁止任何一侧退回“只凭对象路径签名”。
    /// </summary>
    public static class PrivateFileAccessAuthorization
    {
        private static readonly HashSet<string> AuthoritativeUploadPathProperties =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Path",
                "FilePath",
                "FilePathName"
            };
        private static readonly HashSet<string> AuthoritativePathContainerProperties =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Versions"
            };

        internal const string FormFieldResourceKind = "FormField";
        internal const string UserAvatarResourceKind = "UserAvatar";
        internal const string MenuImportTemplateResourceKind = "MenuImportTemplate";
        internal const string DeptImportTemplateResourceKind = "DeptImportTemplate";
        internal const string FileManagerObjectResourceKind = "FileManagerObject";
        internal const string FormFieldDerivedPreviewResourceKind = "FormFieldDerivedPreview";

        public static async Task<DosResult> AuthorizeAsync(DiyUploadParam param)
        {
            if (param == null) return new DosResult(0, null, "请求参数不能为空！");
            if (param._CurrentUser == null)
                return new DosResult(1001, null, "登录身份已过期，请重新登录！");

            var isPlatformAdministrator =
                param._CurrentUser["Level"].Val<int>() >= DiyCommon.MaxRoleLevel;

            if (!isPlatformAdministrator
                && (string.Equals(param.ReturnFileType, "Byte", StringComparison.OrdinalIgnoreCase)
                || string.Equals(param.ReturnFileType, "Stream", StringComparison.OrdinalIgnoreCase))
               )
            {
                return new DosResult(0, null, "普通用户禁止直接读取私有文件字节或流！");
            }

            var contextError = ValidateResourceContext(param, out var resourceKind);
            if (contextError != null) return contextError;

            // 任意身份都不能通过 Limit=false 把入口降级成无需授权的公有地址查询。
            param.Limit = true;

            try
            {
                switch (resourceKind)
                {
                    case UserAvatarResourceKind:
                        return await AuthorizeUserAvatarAsync(param).ConfigureAwait(false);
                    case MenuImportTemplateResourceKind:
                        return await AuthorizeMenuImportTemplateAsync(param).ConfigureAwait(false);
                    case DeptImportTemplateResourceKind:
                        return await AuthorizeDeptImportTemplateAsync(param).ConfigureAwait(false);
                    case FileManagerObjectResourceKind:
                        return await AuthorizeFileManagerObjectAsync(param).ConfigureAwait(false);
                    case FormFieldDerivedPreviewResourceKind:
                        return await AuthorizeFormFieldAsync(param, true).ConfigureAwait(false);
                    default:
                        return await AuthorizeFormFieldAsync(param, false).ConfigureAwait(false);
                }
            }
            catch
            {
                // 授权依赖异常时失败关闭，绝不退回裸路径临时签名地址。
                return new DosResult(0, null, "私有文件授权校验暂时不可用，请稍后重试！");
            }
        }

        internal static DosResult ValidateResourceContext(
            DiyUploadParam param,
            out string resourceKind)
        {
            resourceKind = NormalizeResourceKind(param?.ResourceKind);
            if (param == null) return new DosResult(0, null, "请求参数不能为空！");

            var requestedPaths = RequestedPaths(param);
            if (requestedPaths.Count == 0)
                return new DosResult(0, null, "FilePathName或FilePathNames不能为空！");
            if (requestedPaths.Count > 100
                || requestedPaths.Any(path => path.DosIsNullOrWhiteSpace() || path.Length > 2048))
                return new DosResult(0, null, "私有文件路径数量或长度超出限制！");

            if (resourceKind == FormFieldResourceKind
                || resourceKind == FormFieldDerivedPreviewResourceKind)
            {
                var sysMenuId = param.SysMenuId.DosIsNullOrWhiteSpace()
                    ? param.MenuId
                    : param.SysMenuId;
                if (param.FormEngineKey.DosIsNullOrWhiteSpace()
                    || param.FormDataId.DosIsNullOrWhiteSpace()
                    || param.FieldId.DosIsNullOrWhiteSpace()
                    || sysMenuId.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null,
                        "读取表单私有文件必须提交FormEngineKey、FormDataId、FieldId和SysMenuId！");
                }
                if (resourceKind == FormFieldDerivedPreviewResourceKind
                    && (requestedPaths.Count != 1
                        || param.OriginalFilePathName.DosIsNullOrWhiteSpace()
                        || param.OriginalFilePathName.Length > 2048
                        || param.OriginalFilePathName.Any(char.IsControl)))
                {
                    return new DosResult(0, null,
                        "CAD派生预览必须提交单个FilePathName和权威OriginalFilePathName！");
                }
                return null;
            }

            if (resourceKind == FileManagerObjectResourceKind)
            {
                if (requestedPaths.Count != 1
                    || param.ResourceId.DosIsNullOrWhiteSpace()
                    || param.ResourceId.Length > 2048
                    || param.ResourceId.Any(char.IsControl)
                    || param.SysMenuId.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null,
                        "文件柜私有对象必须提交单个FilePathName、同值ResourceId和权威SysMenuId！");
                }
                return null;
            }

            if (resourceKind != UserAvatarResourceKind
                && resourceKind != MenuImportTemplateResourceKind
                && resourceKind != DeptImportTemplateResourceKind)
                return new DosResult(0, null, "不支持的私有文件ResourceKind！");

            if (param.ResourceId.DosIsNullOrWhiteSpace()
                || param.ResourceId.Length > 100
                || param.ResourceId.Any(char.IsControl))
                return new DosResult(0, null, "特殊私有文件资源必须提交有效的ResourceId！");
            return null;
        }

        private static string NormalizeResourceKind(string value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (normalized.DosIsNullOrWhiteSpace()
                || string.Equals(normalized, FormFieldResourceKind, StringComparison.OrdinalIgnoreCase))
                return FormFieldResourceKind;
            if (string.Equals(normalized, UserAvatarResourceKind, StringComparison.OrdinalIgnoreCase))
                return UserAvatarResourceKind;
            if (string.Equals(normalized, MenuImportTemplateResourceKind, StringComparison.OrdinalIgnoreCase))
                return MenuImportTemplateResourceKind;
            if (string.Equals(normalized, DeptImportTemplateResourceKind, StringComparison.OrdinalIgnoreCase))
                return DeptImportTemplateResourceKind;
            if (string.Equals(normalized, FileManagerObjectResourceKind, StringComparison.OrdinalIgnoreCase))
                return FileManagerObjectResourceKind;
            if (string.Equals(normalized, FormFieldDerivedPreviewResourceKind, StringComparison.OrdinalIgnoreCase))
                return FormFieldDerivedPreviewResourceKind;
            return normalized;
        }

        private static async Task<DosResult> AuthorizeFormFieldAsync(
            DiyUploadParam param,
            bool derivedCadPreview)
        {
            var sysMenuId = param.SysMenuId.DosIsNullOrWhiteSpace() ? param.MenuId : param.SysMenuId;
            try
            {
                var menuAuthorizationParam = new DiyTableRowParam
                {
                    FormEngineKey = param.FormEngineKey,
                    Id = param.FormDataId,
                    _SysMenuId = sysMenuId,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser.DeepClone() as JObject,
                    _InvokeType = InvokeType.Client.ToString(),
                    _TableChildAuth = param._TableChildAuth
                };
                var menuAuthorization = await MicroiEngine.FormEngine
                    .AuthorizeClientTableOperationAsync(menuAuthorizationParam, "Read")
                    .ConfigureAwait(false);
                if (menuAuthorization == null || menuAuthorization.Code != 1)
                    return new DosResult(0, null, "当前用户无权通过该菜单访问私有文件！");
                sysMenuId = menuAuthorizationParam._SysMenuId;

                var tableResult = await MicroiEngine.FormEngine
                    .GetDiyTable(param.FormEngineKey, param.OsClient)
                    .ConfigureAwait(false);
                var tableModel = tableResult != null && tableResult.Code == 1
                    ? ToJObject(tableResult.Data)
                    : null;
                var tableId = TokenString(tableModel?["Id"]);
                var tableName = TokenString(tableModel?["Name"]);
                if (tableId.DosIsNullOrWhiteSpace() || tableName.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "未找到私有文件所属表单！");

                var fieldModel = await ResolveDiyFieldModelAsync(
                    param.OsClient,
                    param.FieldId,
                    tableName,
                    tableId).ConfigureAwait(false);
                var fieldName = TokenString(fieldModel?["Name"]);
                var fieldTableId = TokenString(fieldModel?["TableId"]);
                var component = TokenString(fieldModel?["Component"]);
                if (fieldName.DosIsNullOrWhiteSpace()
                    || !string.Equals(fieldTableId, tableId, StringComparison.OrdinalIgnoreCase)
                    || (!string.Equals(component, "FileUpload", StringComparison.OrdinalIgnoreCase)
                        && !string.Equals(component, "ImgUpload", StringComparison.OrdinalIgnoreCase)
                        && !string.Equals(component, "RichText", StringComparison.OrdinalIgnoreCase)))
                {
                    return new DosResult(0, null, "文件字段与当前表单不匹配！");
                }
                if (derivedCadPreview
                    && !string.Equals(component, "FileUpload", StringComparison.OrdinalIgnoreCase))
                    return new DosResult(0, null, "CAD派生预览只允许用于FileUpload字段！");

                var rowQuery = new JObject
                {
                    ["FormEngineKey"] = tableName,
                    ["OsClient"] = param.OsClient,
                    ["Id"] = param.FormDataId,
                    ["_SysMenuId"] = sysMenuId,
                    ["SysMenuId"] = sysMenuId,
                    ["_CurrentUser"] = param._CurrentUser.DeepClone(),
                    ["_InvokeType"] = InvokeType.Client.ToString(),
                    ["_SelectFields"] = new JArray("Id", fieldName)
                };
                if (param._TableChildAuth != null)
                    rowQuery["_TableChildAuth"] = JToken.FromObject(param._TableChildAuth);

                var rowResult = await MicroiEngine.FormEngine
                    .GetFormDataAsync<dynamic>(tableName, rowQuery)
                    .ConfigureAwait(false);
                if (rowResult == null || rowResult.Code != 1)
                    return new DosResult(0, null, "当前菜单上下文无权读取该业务记录！");

                var row = ToJObject((object)rowResult.Data);
                var fieldValue = row?[fieldName];
                if (derivedCadPreview)
                {
                    string derivedPath;
                    if (!IsAuthorizedCadDerivedPreview(fieldValue, param, out derivedPath))
                        return new DosResult(0, null,
                            "业务记录未引用原CAD文件，或请求路径不是其唯一派生预览文件！");
                    return await AuthorizeExistingObjectAsync(
                        param,
                        derivedPath,
                        "CAD派生预览文件尚未转换完成或不存在！").ConfigureAwait(false);
                }
                var requestedPaths = new List<string>();
                if (!param.FilePathName.DosIsNullOrWhiteSpace()) requestedPaths.Add(param.FilePathName);
                if (param.FilePathNames != null) requestedPaths.AddRange(param.FilePathNames);
                var isRichText = string.Equals(component, "RichText", StringComparison.OrdinalIgnoreCase);
                if (requestedPaths.Count == 0
                    || requestedPaths.Any(path => isRichText
                        ? !RichTextPrivateAssetReference.ReferencesPath(TokenString(fieldValue), path)
                        : !FieldValueReferencesPath(fieldValue, path)))
                {
                    return new DosResult(0, null, "业务记录的文件字段未引用所请求的私有文件！");
                }

                return null;
            }
            catch
            {
                return new DosResult(0, null, "私有文件授权校验暂时不可用，请稍后重试！");
            }
        }

        internal static bool IsAuthorizedCadDerivedPreview(
            JToken authoritativeFieldValue,
            DiyUploadParam param,
            out string normalizedDerivedPath)
        {
            normalizedDerivedPath = null;
            return param != null
                   && FieldValueReferencesPath(authoritativeFieldValue, param.OriginalFilePathName)
                   && TryResolveCadDerivedPreviewPath(param, out normalizedDerivedPath);
        }

        internal static bool TryResolveCadDerivedPreviewPath(
            DiyUploadParam param,
            out string normalizedDerivedPath)
        {
            normalizedDerivedPath = null;
            if (param == null
                || param.OsClient.DosIsNullOrWhiteSpace()
                || param.OriginalFilePathName.DosIsNullOrWhiteSpace()) return false;
            var requestedPaths = RequestedPaths(param);
            if (requestedPaths.Count != 1) return false;
            try
            {
                var original = TenantConfigurationSecurity.NormalizeStoragePath(
                    param.OsClient,
                    param.OriginalFilePathName);
                var requested = TenantConfigurationSecurity.NormalizeStoragePath(
                    param.OsClient,
                    requestedPaths[0]);
                if (!CadDerivedPreviewPath.TryGetConvertedPath(original, out var expected)
                    || !string.Equals(requested, expected, StringComparison.Ordinal))
                    return false;
                normalizedDerivedPath = expected;
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static async Task<DosResult> AuthorizeUserAvatarAsync(DiyUploadParam param)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                "sys_user",
                new JObject
                {
                    ["FormEngineKey"] = "sys_user",
                    ["OsClient"] = param.OsClient,
                    ["Id"] = param.ResourceId,
                    ["_Where"] = new JArray(new JArray("IsDeleted", "<>", 1)),
                    ["_SelectFields"] = new JArray("Id", "Avatar"),
                    ["_InvokeType"] = InvokeType.Server.ToString()
                }).ConfigureAwait(false);
            var row = result != null && result.Code == 1 ? ToJObject((object)result.Data) : null;
            if (row == null
                || !string.Equals(TokenString(row["Id"]), param.ResourceId, StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "未找到指定用户头像资源！");
            return AuthorizeAuthoritativeFieldValue(row["Avatar"], param,
                "指定用户的头像字段未引用所请求的私有文件！");
        }

        private static async Task<DosResult> AuthorizeMenuImportTemplateAsync(DiyUploadParam param)
        {
            var menuAuthorization = await MicroiEngine.FormEngine
                .AuthorizeClientMenuMetadataOperationAsync(new DiyTableRowParam
                {
                    _SysMenuId = param.ResourceId,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser.DeepClone() as JObject,
                    _InvokeType = InvokeType.Client.ToString()
                }).ConfigureAwait(false);
            if (menuAuthorization == null || menuAuthorization.Code != 1)
                return new DosResult(0, null, "当前用户无权访问指定菜单导入模板！");

            var menuResult = await MicroiEngine.FormEngine
                .GetSysMenuModel(param.ResourceId, param.OsClient)
                .ConfigureAwait(false);
            var menu = menuResult != null && menuResult.Code == 1
                ? ToJObject((object)menuResult.Data)
                : null;
            if (menu == null
                || !string.Equals(TokenString(menu["Id"]), param.ResourceId, StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "未找到指定菜单导入模板资源！");
            return AuthorizeAuthoritativeFieldValue(menu["ImportTemplate"], param,
                "指定菜单的ImportTemplate未引用所请求的私有文件！");
        }

        private static async Task<DosResult> AuthorizeDeptImportTemplateAsync(DiyUploadParam param)
        {
            // GetSysDeptStep 使用服务端注入的当前用户、角色、租户和组织层级生成
            // 权威可见树；普通用户不能只凭一个部门 Id 越权读取模板。
            if (!HasAuthoritativeDepartmentScope(param._CurrentUser))
                return new DosResult(0, null, "当前用户没有可验证的组织权限！");
            var deptResult = await new SysDeptLogic().GetSysDeptStep(new SysDeptParam
            {
                OsClient = param.OsClient,
                IsDeleted = 0,
                _CurrentUser = param._CurrentUser.DeepClone() as JObject,
                _InvokeType = InvokeType.Client.ToString()
            }).ConfigureAwait(false);
            var visibleDept = deptResult != null && deptResult.Code == 1
                ? FindObjectById(deptResult.Data == null ? null : JToken.FromObject(deptResult.Data), param.ResourceId)
                : null;
            if (visibleDept == null || visibleDept["IsDeleted"].Val<int>() == 1)
                return new DosResult(0, null, "当前用户无权访问指定部门导入模板！");
            return AuthorizeAuthoritativeFieldValue(visibleDept["ImportTemplate"], param,
                "指定部门的ImportTemplate未引用所请求的私有文件！");
        }

        private static async Task<DosResult> AuthorizeFileManagerObjectAsync(DiyUploadParam param)
        {
            if (!TryNormalizeFileManagerObjectPath(param, out var storagePath))
                return new DosResult(0, null, "文件柜对象标识与所请求的私有文件不一致！");

            // 与现有文件柜 ListObjects/DeleteObject 等入口保持同一权限边界：
            // 访问密钥一律拒绝，且只有 Level 达到平台超级管理员阈值的 DiyToken
            // 会话能够继续。普通用户即使能读取某个菜单元数据也不能浏览对象桶。
            var adminError = RequireFileManagerPlatformAdmin(param._CurrentUser);
            if (adminError != null) return adminError;

            // 超级管理员仍必须提交并命中目标租户真实的文件柜菜单；这可阻止
            // ResourceKind 被当成任意对象路径签名开关。
            var menuResult = await MicroiEngine.FormEngine
                .GetSysMenuModel(param.SysMenuId, param.OsClient)
                .ConfigureAwait(false);
            var menu = menuResult != null && menuResult.Code == 1
                ? ToJObject((object)menuResult.Data)
                : null;
            if (menu == null
                || !string.Equals(TokenString(menu["Id"]), param.SysMenuId, StringComparison.OrdinalIgnoreCase)
                || menu["IsDeleted"].Val<int>() == 1
                || !IsFileManagerMenu(menu))
            {
                return new DosResult(0, null, "指定菜单不是权威文件柜菜单！");
            }

            return await AuthorizeExistingObjectAsync(
                param,
                storagePath,
                "文件柜未找到所请求的权威私有对象！").ConfigureAwait(false);
        }

        private static async Task<DosResult> AuthorizeExistingObjectAsync(
            DiyUploadParam param,
            string storagePath,
            string failureMessage)
        {
            var client = OsClientExtend.GetClient(param.OsClient);
            if (client?.OsClientModel == null)
                return new DosResult(0, null, "当前租户对象存储配置不可用！");
            var hdfsType = TokenString(client.OsClientModel["HDFS"]);
            var hdfs = string.Equals(hdfsType, "MinIO", StringComparison.OrdinalIgnoreCase)
                ? MicroiEngine.HDFSFactory(HDFSType.MinIO)
                : string.Equals(hdfsType, "S3", StringComparison.OrdinalIgnoreCase)
                    ? MicroiEngine.HDFSFactory(HDFSType.AmazonS3)
                    : MicroiEngine.HDFSFactory(HDFSType.Aliyun);
            var exists = await hdfs.ObjectExist(new HDFSParam
            {
                ClientModel = client,
                Limit = true,
                FileFullPath = storagePath,
                NetworkIsInternet = false
            }).ConfigureAwait(false);
            return exists != null && exists.Code == 1 && exists.Data
                ? null
                : new DosResult(0, null, failureMessage);
        }

        internal static DosResult RequireFileManagerPlatformAdmin(JObject currentUser)
        {
            if (UserAccessKeySecurity.IsSession(currentUser))
                return new DosResult(0, null, "访问密钥会话不能使用文件管理接口！");
            return currentUser?["Level"].Val<int>() >= DiyCommon.MaxRoleLevel
                ? null
                : new DosResult(0, null, "仅平台超级管理员可以使用文件管理接口！");
        }

        internal static bool TryNormalizeFileManagerObjectPath(
            DiyUploadParam param,
            out string normalizedPath)
        {
            normalizedPath = null;
            if (param == null
                || param.OsClient.DosIsNullOrWhiteSpace()
                || param.ResourceId.DosIsNullOrWhiteSpace()) return false;
            var requestedPaths = RequestedPaths(param);
            if (requestedPaths.Count != 1) return false;
            try
            {
                var requested = TenantConfigurationSecurity.NormalizeStoragePath(
                    param.OsClient,
                    requestedPaths[0]);
                var resource = TenantConfigurationSecurity.NormalizeStoragePath(
                    param.OsClient,
                    param.ResourceId);
                var tenant = TenantConfigurationSecurity.NormalizeTenantId(param.OsClient)
                    .ToLowerInvariant();
                var tenantRoot = "/" + tenant + "/";
                if (!string.Equals(requested, resource, StringComparison.Ordinal)
                    || !resource.StartsWith(tenantRoot, StringComparison.Ordinal)
                    || resource.Length <= tenantRoot.Length)
                    return false;
                normalizedPath = resource;
                return true;
            }
            catch
            {
                return false;
            }
        }

        internal static bool IsFileManagerMenu(JObject menu)
        {
            if (menu == null) return false;
            var componentPath = TokenString(menu["ComponentPath"]);
            if (componentPath.DosIsNullOrWhiteSpace()) return false;
            var normalized = componentPath.Trim().Replace("\\", "/");
            var queryIndex = normalized.IndexOf('?');
            if (queryIndex >= 0) normalized = normalized.Substring(0, queryIndex);
            if (normalized.StartsWith("@/", StringComparison.Ordinal))
                normalized = normalized.Substring(2);
            normalized = normalized.Trim('/');
            if (normalized.EndsWith(".vue", StringComparison.OrdinalIgnoreCase))
                normalized = normalized.Substring(0, normalized.Length - 4);
            return string.Equals(normalized, "file-manage", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(normalized, "file-manage/index", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(normalized, "views/file-manage", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(normalized, "views/file-manage/index", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(normalized, "src/views/file-manage", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(normalized, "src/views/file-manage/index", StringComparison.OrdinalIgnoreCase);
        }

        private static DosResult AuthorizeAuthoritativeFieldValue(
            JToken authoritativeValue,
            DiyUploadParam param,
            string failureMessage)
        {
            return AuthoritativeValueReferencesPaths(authoritativeValue, RequestedPaths(param))
                ? null
                : new DosResult(0, null, failureMessage);
        }

        internal static bool AuthoritativeValueReferencesPaths(
            JToken authoritativeValue,
            IEnumerable<string> requestedPaths)
        {
            var paths = (requestedPaths ?? Array.Empty<string>())
                .Where(path => !path.DosIsNullOrWhiteSpace())
                .ToList();
            return paths.Count > 0
                   && paths.All(path => FieldValueReferencesPath(authoritativeValue, path));
        }

        private static List<string> RequestedPaths(DiyUploadParam param)
        {
            var result = new List<string>();
            if (!param.FilePathName.DosIsNullOrWhiteSpace()) result.Add(param.FilePathName);
            if (param.FilePathNames != null) result.AddRange(param.FilePathNames);
            return result;
        }

        private static JObject FindObjectById(JToken token, string id)
        {
            if (token == null || id.DosIsNullOrWhiteSpace()) return null;
            if (token is JObject obj
                && string.Equals(TokenString(obj["Id"]), id, StringComparison.OrdinalIgnoreCase))
                return obj;
            foreach (var child in token.Children())
            {
                var match = FindObjectById(child, id);
                if (match != null) return match;
            }
            return null;
        }

        private static bool HasAuthoritativeDepartmentScope(JObject currentUser)
        {
            if (currentUser == null) return false;
            if (currentUser["Level"].Val<int>() >= DiyCommon.MaxRoleLevel
                || currentUser["_IsAdmin"].Val<bool>())
                return true;
            if (!currentUser["DeptId"].Val<string>().DosIsNullOrWhiteSpace()) return true;

            var deptIds = currentUser["DeptIds"];
            if (deptIds == null) return false;
            try
            {
                if (deptIds.Type == JTokenType.String)
                {
                    var text = deptIds.Val<string>();
                    if (text.DosIsNullOrWhiteSpace()) return false;
                    deptIds = JToken.Parse(text);
                }
                return HasNonEmptyScalarValue(deptIds);
            }
            catch
            {
                return false;
            }
        }

        private static bool HasNonEmptyScalarValue(JToken token)
        {
            if (token == null) return false;
            if (token is JValue value)
                return !Convert.ToString(value.Value).DosIsNullOrWhiteSpace();
            return token.Children().Any(HasNonEmptyScalarValue);
        }

        private static async Task<JObject> ResolveDiyFieldModelAsync(
            string osClient,
            string fieldId,
            string tableName,
            string tableId)
        {
            var byId = await MicroiEngine.FormEngine.GetDiyFieldModel(new DiyFieldParam
            {
                OsClient = osClient,
                Id = fieldId,
                IsDeleted = 0
            }).ConfigureAwait(false);
            if (byId != null && byId.Code == 1 && byId.Data != null) return byId.Data;

            var byName = await MicroiEngine.FormEngine.GetDiyFieldModel(new DiyFieldParam
            {
                OsClient = osClient,
                TableId = tableId,
                TableName = tableName,
                Name = fieldId,
                IsDeleted = 0
            }).ConfigureAwait(false);
            return byName != null && byName.Code == 1 ? byName.Data : null;
        }

        /// <summary>
        /// 判断字段权威值是否通过 Path/FilePath/FilePathName 精确引用对象。
        /// 租户段大小写兼容，对象 Key 其余部分保持大小写敏感；只递归已知的
        /// Versions 容器，绝不把 Name/Size/Metadata 等任意标量当作路径。
        /// </summary>
        public static bool AuthoritativeValueReferencesPath(JToken fieldValue, string requestedPath)
        {
            var target = NormalizeComparePath(requestedPath);
            if (fieldValue == null || target.DosIsNullOrWhiteSpace()) return false;
            return FieldValueReferencesPath(fieldValue, target, true);
        }

        internal static bool FieldValueReferencesPath(JToken fieldValue, string requestedPath)
        {
            return AuthoritativeValueReferencesPath(fieldValue, requestedPath);
        }

        private static bool FieldValueReferencesPath(
            JToken fieldValue,
            string normalizedTarget,
            bool allowRootString)
        {
            if (fieldValue == null) return false;
            if (fieldValue.Type == JTokenType.String)
            {
                var text = TokenString(fieldValue);
                if (text.DosIsNullOrWhiteSpace()) return false;
                var trimmed = text.TrimStart();
                if (trimmed.StartsWith("{") || trimmed.StartsWith("["))
                {
                    try
                    {
                        return FieldValueReferencesPath(
                            JToken.Parse(text),
                            normalizedTarget,
                            false);
                    }
                    catch { return false; }
                }
                return allowRootString && AuthoritativePathMatches(text, normalizedTarget);
            }

            if (fieldValue is JValue) return false;
            if (fieldValue is JArray array)
                return array.Children().Any(child =>
                    FieldValueReferencesPath(child, normalizedTarget, false));

            if (fieldValue is JObject obj)
            {
                foreach (var property in obj.Properties())
                {
                    if (AuthoritativeUploadPathProperties.Contains(property.Name)
                        && property.Value.Type == JTokenType.String
                        && AuthoritativePathMatches(TokenString(property.Value), normalizedTarget))
                        return true;
                    if (AuthoritativePathContainerProperties.Contains(property.Name)
                        && (property.Value.Type == JTokenType.Array
                            || property.Value.Type == JTokenType.Object)
                        && FieldValueReferencesPath(property.Value, normalizedTarget, false))
                        return true;
                }
            }

            return false;
        }

        private static bool AuthoritativePathMatches(string authoritativePath, string normalizedTarget)
        {
            if (authoritativePath.DosIsNullOrWhiteSpace()) return false;
            if (Uri.TryCreate(authoritativePath.Trim(), UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                return false;
            return string.Equals(
                NormalizeComparePath(authoritativePath),
                normalizedTarget,
                StringComparison.Ordinal);
        }

        /// <summary>
        /// 规范化对象 Key 用于精确授权比较。仅租户首段忽略大小写；后续对象
        /// 路径保持大小写，避免大小写敏感存储中 A.pdf 与 a.pdf 相互冒用。
        /// 绝对 HTTP(S) URL 不具备本地对象引用资格。
        /// </summary>
        public static string NormalizeAuthoritativeObjectPath(string path)
        {
            if (path.DosIsNullOrWhiteSpace()) return string.Empty;
            var normalized = path.Trim().Replace("\\", "/");
            Uri uri;
            if (Uri.TryCreate(normalized, UriKind.Absolute, out uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                return string.Empty;
            var hashIndex = normalized.IndexOf('#');
            if (hashIndex >= 0) normalized = normalized.Substring(0, hashIndex);
            var queryIndex = normalized.IndexOf('?');
            if (queryIndex >= 0) normalized = normalized.Substring(0, queryIndex);
            try { normalized = Uri.UnescapeDataString(normalized); }
            catch { return string.Empty; }
            normalized = normalized.Trim('/');
            if (normalized.Length == 0) return string.Empty;
            var tenantSeparator = normalized.IndexOf('/');
            if (tenantSeparator < 0) return normalized.ToLowerInvariant();
            return normalized.Substring(0, tenantSeparator).ToLowerInvariant()
                   + normalized.Substring(tenantSeparator);
        }

        internal static string NormalizeComparePath(string path)
        {
            return NormalizeAuthoritativeObjectPath(path);
        }

        private static string TokenString(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) return null;
            if (token.Type == JTokenType.String) return token.Value<string>();
            var value = token as JValue;
            return value != null ? Convert.ToString(value.Value) : token.ToString(Formatting.None);
        }

        private static JObject ToJObject(object data)
        {
            if (data == null) return null;
            var obj = data as JObject;
            if (obj != null) return obj;
            var token = data as JToken;
            if (token != null)
            {
                if (token.Type == JTokenType.Object) return (JObject)token;
                if (token.Type != JTokenType.String) return null;
                var text = TokenString(token);
                if (text.DosIsNullOrWhiteSpace() || !text.TrimStart().StartsWith("{")) return null;
                try { return JObject.Parse(text); }
                catch { return null; }
            }
            try { return JObject.Parse(JsonConvert.SerializeObject(data)); }
            catch { return null; }
        }
    }
}
