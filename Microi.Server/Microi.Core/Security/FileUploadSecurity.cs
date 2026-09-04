using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 文件上传的租户动态限制与平台绝对安全上限。
    /// 业务配置只从当前租户 sys_osclients 读取；未填写时使用代码默认值，
    /// 最终结果仍不能突破不可配置的 Absolute* 灾难保护上限。
    /// </summary>
    public sealed class FileUploadSecurityOptions
    {
        public const int DefaultMaxFileMegabytes = 500;
        public const int DefaultMaxTotalMegabytes = 500;
        public const int DefaultMaxFileCount = 10;
        public const int DefaultDailyUserQuotaMegabytes = 2048;
        public const int DefaultDailyTenantQuotaMegabytes = 20480;
        public const int DefaultAbsoluteMaxFileMegabytes = 2048;
        public const int DefaultAbsoluteMaxTotalMegabytes = 2048;
        public const int DefaultAbsoluteMaxFileCount = 100;
        public const int DefaultAbsoluteDailyQuotaMegabytes =
            10 * 1024 * 1024;

        public long MaxFileBytes { get; set; }
        public long MaxTotalBytes { get; set; }
        public int MaxFileCount { get; set; }
        public long DailyUserQuotaBytes { get; set; }
        public long DailyTenantQuotaBytes { get; set; }
        /// <summary>
        /// 是否允许当前租户的交互式文件上传。空配置保持启用；
        /// 关闭后仍保留平台内部受控上传的硬大小限制。
        /// </summary>
        public bool UploadEnabled { get; set; } = true;

        /// <summary>
        /// 按“当前租户 SaaS 配置 > 代码默认值”加载业务限额，
        /// 再应用独立、不可由安装参数放大的 Absolute* 平台灾难保护上限。
        /// </summary>
        public static FileUploadSecurityOptions Load(JObject tenantConfig = null)
        {
            var fallbackDefaults = new FileUploadSecurityOptions
            {
                MaxFileBytes = DefaultMaxFileMegabytes * 1024L * 1024L,
                MaxTotalBytes = DefaultMaxTotalMegabytes * 1024L * 1024L,
                MaxFileCount = DefaultMaxFileCount,
                DailyUserQuotaBytes =
                    DefaultDailyUserQuotaMegabytes * 1024L * 1024L,
                DailyTenantQuotaBytes =
                    DefaultDailyTenantQuotaMegabytes * 1024L * 1024L,
                UploadEnabled = true
            };

            return ApplyTenantOverrides(
                fallbackDefaults,
                tenantConfig,
                CreateCodeAbsoluteCaps());
        }

        /// <summary>
        /// 将 sys_osclients 的租户级配置应用到代码默认值，最后再应用独立绝对上限。
        /// 此方法为纯函数，便于升级兼容和单元测试。
        /// </summary>
        public static FileUploadSecurityOptions ApplyTenantOverrides(
            FileUploadSecurityOptions fallbackDefaults,
            JObject tenantConfig,
            FileUploadSecurityOptions absoluteCaps = null)
        {
            if (fallbackDefaults == null)
                throw new ArgumentNullException(nameof(fallbackDefaults));
            absoluteCaps ??= CreateCodeAbsoluteCaps();

            var result = new FileUploadSecurityOptions
            {
                MaxFileBytes = fallbackDefaults.MaxFileBytes,
                MaxTotalBytes = fallbackDefaults.MaxTotalBytes,
                MaxFileCount = fallbackDefaults.MaxFileCount,
                DailyUserQuotaBytes = fallbackDefaults.DailyUserQuotaBytes,
                DailyTenantQuotaBytes =
                    fallbackDefaults.DailyTenantQuotaBytes,
                UploadEnabled = fallbackDefaults.UploadEnabled
            };
            if (tenantConfig != null)
            {
                // 新版使用负向开关：字段存在时，空值/0 都表示“不关闭”，因此
                // 新租户和升级后的历史租户默认允许上传。只有滚动升级期间旧物理
                // 字段仍未创建时，才回退读取 FileUploadEnabled，兼容旧节点。
                var disableUploadProperty = tenantConfig.Property(
                    "DisableFileUpload",
                    StringComparison.OrdinalIgnoreCase);
                if (disableUploadProperty != null)
                {
                    result.UploadEnabled = !TryReadBoolean(
                        disableUploadProperty.Value,
                        out var uploadDisabled)
                        || !uploadDisabled;
                }
                else if (TryReadBoolean(
                             tenantConfig["FileUploadEnabled"],
                             out var legacyUploadEnabled))
                {
                    result.UploadEnabled = legacyUploadEnabled;
                }

                result.MaxFileBytes = ReadTenantMegabytes(
                    tenantConfig,
                    "FileUploadMaxFileMB",
                    result.MaxFileBytes);
                result.MaxTotalBytes = ReadTenantMegabytes(
                    tenantConfig,
                    "FileUploadMaxRequestMB",
                    result.MaxTotalBytes);
                result.MaxFileCount = ReadTenantPositiveInt(
                    tenantConfig,
                    "FileUploadMaxCount",
                    result.MaxFileCount);
                result.DailyUserQuotaBytes = ReadTenantMegabytes(
                    tenantConfig,
                    "FileUploadDailyUserQuotaMB",
                    result.DailyUserQuotaBytes);
                result.DailyTenantQuotaBytes = ReadTenantMegabytes(
                    tenantConfig,
                    "FileUploadDailyTenantQuotaMB",
                    result.DailyTenantQuotaBytes);
            }

            result.MaxFileBytes = Math.Min(
                result.MaxFileBytes,
                absoluteCaps.MaxFileBytes);
            result.MaxTotalBytes = Math.Min(
                result.MaxTotalBytes,
                absoluteCaps.MaxTotalBytes);
            result.MaxFileCount = Math.Min(
                result.MaxFileCount,
                absoluteCaps.MaxFileCount);
            result.DailyUserQuotaBytes = Math.Min(
                result.DailyUserQuotaBytes,
                absoluteCaps.DailyUserQuotaBytes);
            result.DailyTenantQuotaBytes = Math.Min(
                result.DailyTenantQuotaBytes,
                absoluteCaps.DailyTenantQuotaBytes);
            result.UploadEnabled =
                absoluteCaps.UploadEnabled && result.UploadEnabled;

            // 任一更小的日额度都必须能真正限制单次上传。
            result.MaxTotalBytes = Math.Min(
                result.MaxTotalBytes,
                Math.Min(
                    result.DailyUserQuotaBytes,
                    result.DailyTenantQuotaBytes));
            result.MaxFileBytes = Math.Min(result.MaxFileBytes, result.MaxTotalBytes);
            return result;
        }

        private static long ReadTenantMegabytes(
            JObject tenantConfig,
            string fieldName,
            long fallbackBytes)
        {
            if (!TryReadPositiveLong(tenantConfig?[fieldName], out var megabytes))
            {
                return fallbackBytes;
            }

            try
            {
                return checked(megabytes * 1024L * 1024L);
            }
            catch (OverflowException)
            {
                // 后续绝对上限会把该值安全收敛；不能因溢出静默绕回较小默认值。
                return long.MaxValue;
            }
        }

        private static int ReadTenantPositiveInt(
            JObject tenantConfig,
            string fieldName,
            int fallback)
        {
            if (!TryReadPositiveLong(tenantConfig?[fieldName], out var value))
            {
                return fallback;
            }
            return (int)Math.Min(int.MaxValue, value);
        }

        private static bool TryReadPositiveLong(JToken token, out long value)
        {
            value = 0;
            if (token == null || token.Type == JTokenType.Null) return false;
            var text = token.ToString().Trim();
            return text.Length > 0 && long.TryParse(text, out value) && value > 0;
        }

        private static bool TryReadBoolean(JToken token, out bool value)
        {
            value = true;
            if (token == null || token.Type == JTokenType.Null) return false;
            var text = token.ToString().Trim();
            if (text.Length == 0) return false;
            if (string.Equals(text, "1", StringComparison.OrdinalIgnoreCase)
                || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase))
            {
                value = true;
                return true;
            }
            if (string.Equals(text, "0", StringComparison.OrdinalIgnoreCase)
                || string.Equals(text, "false", StringComparison.OrdinalIgnoreCase))
            {
                value = false;
                return true;
            }
            return false;
        }

        private static FileUploadSecurityOptions CreateCodeAbsoluteCaps()
        {
            return new FileUploadSecurityOptions
            {
                MaxFileBytes =
                    DefaultAbsoluteMaxFileMegabytes * 1024L * 1024L,
                MaxTotalBytes =
                    DefaultAbsoluteMaxTotalMegabytes * 1024L * 1024L,
                MaxFileCount = DefaultAbsoluteMaxFileCount,
                DailyUserQuotaBytes =
                    DefaultAbsoluteDailyQuotaMegabytes * 1024L * 1024L,
                DailyTenantQuotaBytes =
                    DefaultAbsoluteDailyQuotaMegabytes * 1024L * 1024L,
                UploadEnabled = true
            };
        }

    }

    /// <summary>
    /// 所有 HDFS 上传入口共用的安全策略，避免旧 Controller、V8 或移动端入口绕过。
    /// </summary>
    public static class FileUploadSecurity
    {
        public const string DefaultQuotaScope = "UploadQuota";
        public const string ApplicationPublishQuotaScope = "ApplicationPublishQuota";
        private const string DailyQuotaReservationScript = @"
local increment = tonumber(ARGV[1])
local userLimit = tonumber(ARGV[2])
local tenantLimit = tonumber(ARGV[3])
local ttlSeconds = tonumber(ARGV[4])
local userCurrent = tonumber(redis.call('GET', KEYS[1]) or '0')
local tenantCurrent = tonumber(redis.call('GET', KEYS[2]) or '0')
if increment == nil or increment <= 0 then return {-3, userCurrent, tenantCurrent} end
if userCurrent > userLimit - increment then return {-1, userCurrent, tenantCurrent} end
if tenantCurrent > tenantLimit - increment then return {-2, userCurrent, tenantCurrent} end
local userNext = redis.call('INCRBY', KEYS[1], increment)
local tenantNext = redis.call('INCRBY', KEYS[2], increment)
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ttlSeconds) end
if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], ttlSeconds) end
return {1, userNext, tenantNext}";

        private static readonly HashSet<string> OrdinaryUploadRoots =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "file",
                "img",
                "avatar",
                "editor"
            };

        /// <summary>
        /// 返回可直接定位 SaaS 配置的停用提示。DisableFileUpload 未配置、为空或
        /// 为 0/false 时默认允许上传；只有显式配置为 1/true 或平台全局强制关闭
        /// 才会进入这里。FileUploadEnabled 仅用于旧物理字段尚未升级时的兼容回退。
        /// </summary>
        public static DosResult CreateTenantUploadDisabledResult(string osClient)
        {
            return new DosResult(
                0,
                null,
                "当前租户已关闭文件上传！请在 SaaS 引擎中关闭“关闭文件上传”开关（DisableFileUpload=0），保存并等待租户配置重载后重试。",
                0,
                new
                {
                    ErrorType = "TenantFileUploadDisabled",
                    OsClient = osClient ?? "",
                    ConfigField = "DisableFileUpload",
                    ExpectedValue = 0,
                    LegacyConfigField = "FileUploadEnabled",
                    DefaultEnabled = true,
                    DocumentationUrl = "https://microi.net/doc/more/hdfs"
                });
        }

        /// <summary>
        /// 没有可验证表单字段上下文的交互式上传采用兼容安全策略：
        /// 普通用户只能上传私有文件，并只能使用平台预定义的一级目录；
        /// 超级管理员仍可显式选择公有桶和自定义安全子目录。
        /// 表单字段上传必须改走 ApplyInteractivePolicyAsync，由服务端字段配置决定公私桶。
        /// </summary>
        public static DosResult ApplyInteractivePolicy(DiyUploadParam param, bool isPlatformAdmin)
        {
            if (param == null) return new DosResult(0, null, "上传参数不能为空！");

            param.Limit ??= true;
            if (isPlatformAdmin) return null;

            // Limit、Path 都是客户端可篡改参数，普通用户不能以它们作为授权事实。
            param.Limit = true;
            var requestedPath = (param.Path ?? string.Empty).Trim().Trim('/');
            if (requestedPath.Length == 0)
            {
                param.Path = param.Preview == true ? "img" : "file";
                return null;
            }

            if (requestedPath.Contains("/")
                || !OrdinaryUploadRoots.Contains(requestedPath))
            {
                return new DosResult(0, null, "普通用户只能上传到平台预定义的文件目录！");
            }

            param.Path = requestedPath.ToLowerInvariant();
            return null;
        }

        /// <summary>
        /// 交互式上传的统一入口。标准表单上传携带 FormEngineKey + FieldId 后，
        /// 服务端先校验当前用户对表/菜单的新增或编辑权限，再重新读取
        /// diy_field.Config；客户端 Limit 和 Path 仅是请求提示，不能作为授权事实。
        /// 没有字段上下文的旧上传继续执行私有桶兼容策略。
        /// </summary>
        public static async Task<DosResult> ApplyInteractivePolicyAsync(
            DiyUploadParam param,
            bool isPlatformAdmin)
        {
            if (param == null) return new DosResult(0, null, "上传参数不能为空！");

            param.Limit ??= true;
            var hasAnyFieldContext = !param.FormEngineKey.DosIsNullOrWhiteSpace()
                                     || !param.FieldId.DosIsNullOrWhiteSpace()
                                     || param._TableChildAuth != null;
            if (!hasAnyFieldContext)
            {
                return ApplyInteractivePolicy(param, isPlatformAdmin);
            }

            if (param.FormEngineKey.DosIsNullOrWhiteSpace()
                || param.FieldId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(
                    0,
                    null,
                    "表单字段上传必须同时提交FormEngineKey和FieldId！");
            }
            if (param._CurrentUser == null)
            {
                return new DosResult(1001, null, "登录身份已过期，请重新登录！");
            }

            try
            {
                var sysMenuId = param.SysMenuId.DosIsNullOrWhiteSpace()
                    ? param.MenuId
                    : param.SysMenuId;
                var operation = param.FormDataId.DosIsNullOrWhiteSpace()
                    ? "Add"
                    : "Edit";
                var authorizationParam = new DiyTableRowParam
                {
                    FormEngineKey = param.FormEngineKey,
                    Id = param.FormDataId,
                    _SysMenuId = sysMenuId,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser.DeepClone() as JObject,
                    _InvokeType = InvokeType.Client.ToString(),
                    _TableChildAuth = param._TableChildAuth
                };
                var authorization = await MicroiEngine.FormEngine
                    .AuthorizeClientTableOperationAsync(authorizationParam, operation)
                    .ConfigureAwait(false);
                if (authorization == null || authorization.Code != 1)
                {
                    return new DosResult(0, null, "当前用户无权通过该菜单上传到此表单字段！");
                }

                var tableResult = await MicroiEngine.FormEngine
                    .GetDiyTable(param.FormEngineKey, param.OsClient)
                    .ConfigureAwait(false);
                var tableModel = tableResult != null && tableResult.Code == 1
                    ? ToJObject((object)tableResult.Data)
                    : null;
                var tableId = TokenString(tableModel?["Id"]);
                var tableName = TokenString(tableModel?["Name"]);
                if (tableId.DosIsNullOrWhiteSpace() || tableName.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "未找到上传字段所属表单！");
                }

                var fieldModel = await ResolveDiyFieldModelAsync(
                    param.OsClient,
                    param.FieldId,
                    tableName,
                    tableId).ConfigureAwait(false);
                var policyError = ApplyAuthoritativeFormFieldPolicy(
                    param,
                    tableModel,
                    fieldModel);
                if (policyError != null) return policyError;

                // 保留授权器规范化后的真实菜单 Id，供后续审计与私有文件读取上下文复用。
                param.SysMenuId = authorizationParam._SysMenuId;
                return null;
            }
            catch
            {
                // 元数据、授权缓存或租户数据库异常时失败关闭，绝不回退信任客户端 Limit。
                return new DosResult(0, null, "表单字段上传策略校验暂时不可用，请稍后重试！");
            }
        }

        /// <summary>
        /// 根据已经从当前租户读取的权威表/字段元数据应用公私桶与一级目录。
        /// 该纯策略方法供单元测试锁定字段配置语义。
        /// </summary>
        internal static DosResult ApplyAuthoritativeFormFieldPolicy(
            DiyUploadParam param,
            JObject tableModel,
            JObject fieldModel)
        {
            if (param == null || tableModel == null || fieldModel == null)
            {
                return new DosResult(0, null, "上传字段配置不存在！");
            }

            var tableId = TokenString(tableModel["Id"]);
            var fieldTableId = TokenString(fieldModel["TableId"]);
            var component = TokenString(fieldModel["Component"]);
            if (tableId.DosIsNullOrWhiteSpace()
                || fieldTableId.DosIsNullOrWhiteSpace()
                || !string.Equals(tableId, fieldTableId, StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(0, null, "上传字段与当前表单不匹配！");
            }

            string uploadRoot;
            bool defaultLimit;
            if (string.Equals(component, "ImgUpload", StringComparison.OrdinalIgnoreCase))
            {
                uploadRoot = "img";
                defaultLimit = false;
            }
            else if (string.Equals(component, "FileUpload", StringComparison.OrdinalIgnoreCase))
            {
                uploadRoot = "file";
                defaultLimit = false;
            }
            else if (string.Equals(component, "RichText", StringComparison.OrdinalIgnoreCase))
            {
                uploadRoot = "editor";
                // 老富文本字段没有上传配置，继续保持私有，避免升级后意外公开历史附件。
                defaultLimit = true;
            }
            else
            {
                return new DosResult(0, null, "当前字段不是可上传文件的表单控件！");
            }

            if (!TryReadFieldUploadLimit(
                    fieldModel["Config"],
                    component,
                    defaultLimit,
                    out var authoritativeLimit))
            {
                return new DosResult(0, null, "上传字段的禁止匿名访问配置无效！");
            }

            param.Path = uploadRoot;
            param.Limit = authoritativeLimit;

            // 微信内容安全审核中的图片必须先进入私有隔离区；字段公有配置不能放宽此边界。
            if (param.ContentSecurityRequired == true
                || string.Equals(
                    param._ClientType,
                    "WxMiniProgram",
                    StringComparison.OrdinalIgnoreCase))
            {
                param.Limit = true;
            }
            return null;
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

        private static bool TryReadFieldUploadLimit(
            JToken configToken,
            string component,
            bool defaultValue,
            out bool limit)
        {
            limit = defaultValue;
            if (configToken == null
                || configToken.Type == JTokenType.Null
                || configToken.Type == JTokenType.Undefined
                || configToken.ToString().DosIsNullOrWhiteSpace())
            {
                return true;
            }

            JObject config;
            try
            {
                config = configToken as JObject ?? JObject.Parse(configToken.ToString());
            }
            catch
            {
                return false;
            }

            var componentConfig = config.GetValue(component, StringComparison.OrdinalIgnoreCase);
            if (componentConfig == null || componentConfig.Type == JTokenType.Null)
            {
                return true;
            }
            if (!(componentConfig is JObject componentObject))
            {
                try
                {
                    componentObject = JObject.Parse(componentConfig.ToString());
                }
                catch
                {
                    return false;
                }
            }

            var limitToken = componentObject.GetValue("Limit", StringComparison.OrdinalIgnoreCase);
            if (limitToken == null
                || limitToken.Type == JTokenType.Null
                || limitToken.Type == JTokenType.Undefined
                || limitToken.ToString().DosIsNullOrWhiteSpace())
            {
                return true;
            }

            var text = limitToken.ToString().Trim();
            if (string.Equals(text, "true", StringComparison.OrdinalIgnoreCase) || text == "1")
            {
                limit = true;
                return true;
            }
            if (string.Equals(text, "false", StringComparison.OrdinalIgnoreCase) || text == "0")
            {
                limit = false;
                return true;
            }
            return false;
        }

        private static JObject ToJObject(object value)
        {
            if (value == null) return null;
            if (value is JObject obj) return obj;
            try
            {
                return JObject.FromObject(value);
            }
            catch
            {
                return null;
            }
        }

        private static string TokenString(JToken token)
        {
            return token?.Type == JTokenType.Null ? null : token?.ToString();
        }

        /// <summary>
        /// 在任何 byte[] / Base64 解码、图片解析和对象存储调用之前验证文件数与字节数。
        /// 当前 provider 需要可确定的 Length，因此拒绝无法安全预估大小的非 Seek 流。
        /// </summary>
        public static DosResult ValidatePayload(
            DiyUploadParam param,
            FileUploadSecurityOptions options = null)
        {
            return ValidatePayload(param, out _, options);
        }

        /// <summary>
        ///zhy：判断上传参数中是否已经包含指定文件名。HDFS 从当前 HTTP multipart 补充文件流前
        ///zhy：使用此方法，避免接口引擎已经把同一文件注入 FilesByteBase64 后，又把原始请求流
        ///zhy：作为第二份上传载荷加入。这里只用于传输表示去重；ValidatePayload 仍会拒绝调用方
        ///zhy：在 Files / FilesByte / FilesByteBase64 之间显式提交的重复文件名。
        /// </summary>
        public static bool ContainsPayloadFileName(DiyUploadParam param, string fileName)
        {
            if (param == null || string.IsNullOrWhiteSpace(fileName)) return false;

            bool Contains<T>(IDictionary<string, T> files)
            {
                return files?.Keys.Any(name => string.Equals(
                    name,
                    fileName,
                    StringComparison.OrdinalIgnoreCase)) == true;
            }

            return Contains(param.Files)
                || Contains(param.FilesByte)
                || Contains(param.FilesByteBase64);
        }

        public static DosResult ValidatePayload(
            DiyUploadParam param,
            out long totalBytes,
            FileUploadSecurityOptions options = null)
        {
            totalBytes = 0;
            if (param == null) return new DosResult(0, null, "上传参数不能为空！");
            options ??= FileUploadSecurityOptions.Load();

            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            long validatedTotalBytes = 0;
            var count = 0;

            DosResult AddFile(string name, long size)
            {
                if (string.IsNullOrWhiteSpace(name))
                    return new DosResult(0, null, "文件名不能为空！");
                if (Path.GetFileName(name).Length > 255)
                    return new DosResult(0, null, "文件名不能超过255个字符！");
                if (!names.Add(name))
                    return new DosResult(0, null, "同一次上传中存在重复文件名：" + name);
                if (size < 0)
                    return new DosResult(0, null, "无法确定文件大小：" + name);
                if (size == 0)
                    return new DosResult(0, null, "文件体积为0：" + name);
                if (size > options.MaxFileBytes)
                    return new DosResult(0, null,
                        $"单个文件不能超过{FormatMegabytes(options.MaxFileBytes)}MB：" + name);

                count++;
                if (count > options.MaxFileCount)
                    return new DosResult(0, null, $"单次最多上传{options.MaxFileCount}个文件！");
                if (validatedTotalBytes > options.MaxTotalBytes - size)
                    return new DosResult(0, null,
                        $"单次上传总大小不能超过{FormatMegabytes(options.MaxTotalBytes)}MB！");
                validatedTotalBytes += size;
                return null;
            }

            DosResult AddOriginalFile(string name, long size, HashSet<string> originalNames)
            {
                if (param.CropEnabled != true)
                    return new DosResult(0, null, "未开启裁剪协议时不允许提交裁剪原图！");
                if (string.IsNullOrWhiteSpace(name))
                    return new DosResult(0, null, "裁剪原图文件名不能为空！");
                if (Path.GetFileName(name).Length > 255)
                    return new DosResult(0, null, "裁剪原图文件名不能超过255个字符！");
                if (!names.Contains(name))
                    return new DosResult(0, null, "裁剪原图找不到同名的展示图：" + name);
                if (!originalNames.Add(name))
                    return new DosResult(0, null, "同一次上传中存在重复裁剪原图：" + name);
                if (size < 0)
                    return new DosResult(0, null, "无法确定裁剪原图大小：" + name);
                if (size == 0)
                    return new DosResult(0, null, "裁剪原图体积为0：" + name);
                if (size > options.MaxFileBytes)
                    return new DosResult(0, null,
                        $"单个裁剪原图不能超过{FormatMegabytes(options.MaxFileBytes)}MB：" + name);
                // 原图不是第二个业务文件，不增加文件数；但必须计入请求大小和每日配额。
                if (validatedTotalBytes > options.MaxTotalBytes - size)
                    return new DosResult(0, null,
                        $"单次上传总大小不能超过{FormatMegabytes(options.MaxTotalBytes)}MB！");
                validatedTotalBytes += size;
                return null;
            }

            foreach (var file in param.Files ?? new Dictionary<string, Stream>())
            {
                if (file.Value == null)
                    return new DosResult(0, null, "文件流不能为空：" + file.Key);
                if (!file.Value.CanSeek)
                    return new DosResult(0, null, "当前上传流无法安全确定大小：" + file.Key);

                long remaining;
                try
                {
                    remaining = file.Value.Length - file.Value.Position;
                }
                catch
                {
                    return new DosResult(0, null, "无法读取文件大小：" + file.Key);
                }

                var error = AddFile(file.Key, remaining);
                if (error != null) return error;
            }

            foreach (var file in param.FilesByte ?? new Dictionary<string, byte[]>())
            {
                var error = AddFile(file.Key, file.Value?.LongLength ?? -1);
                if (error != null) return error;
            }

            foreach (var file in param.FilesByteBase64 ?? new Dictionary<string, string>())
            {
                if (!TryGetBase64DecodedLength(file.Value, out var decodedLength))
                    return new DosResult(0, null, "文件Base64格式不合法：" + file.Key);
                var error = AddFile(file.Key, decodedLength);
                if (error != null) return error;
            }

            var originalFiles = param.OriginalFiles ?? new Dictionary<string, Stream>();
            if (param.CropEnabled == true && originalFiles.Count == 0)
                return new DosResult(0, null, "开启裁剪后必须同时提交裁剪前的原图！");
            if (param.CropEnabled != true && originalFiles.Count > 0)
                return new DosResult(0, null, "未开启裁剪协议时不允许提交裁剪原图！");

            var originalNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var file in originalFiles)
            {
                if (file.Value == null)
                    return new DosResult(0, null, "裁剪原图文件流不能为空：" + file.Key);
                if (!file.Value.CanSeek)
                    return new DosResult(0, null, "当前裁剪原图流无法安全确定大小：" + file.Key);

                long remaining;
                try
                {
                    remaining = file.Value.Length - file.Value.Position;
                }
                catch
                {
                    return new DosResult(0, null, "无法读取裁剪原图大小：" + file.Key);
                }

                var error = AddOriginalFile(file.Key, remaining, originalNames);
                if (error != null) return error;
            }

            if (param.CropEnabled == true && originalNames.Count != count)
                return new DosResult(0, null, "每张裁剪图都必须对应一张同名原图！");

            if (count == 0)
                return new DosResult(0, null, "未检测到上传文件！");
            totalBytes = validatedTotalBytes;
            return null;
        }

        /// <summary>
        /// 为交互式上传在共享 Redis 中原子预留当天额度。
        /// 用户额度与租户额度在同一个 Lua 脚本内检查和递增，两个 Key 使用相同 hash tag，
        /// 因此可在 Redis Cluster 中保持同槽原子执行。失败上传不退款，防止并发重试绕过配额。
        /// </summary>
        public static async Task<DosResult> ReserveDailyQuotaAsync(
            string osClient,
            string userId,
            long bytes,
            FileUploadSecurityOptions options = null,
            string quotaScope = null)
        {
            if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace() || bytes <= 0)
            {
                return new DosResult(0, null, "无法确定上传配额身份或文件大小！");
            }

            options ??= FileUploadSecurityOptions.Load();
            if (!options.UploadEnabled)
            {
                return CreateTenantUploadDisabledResult(osClient);
            }
            var utcNow = DateTime.UtcNow;
            var keys = BuildDailyQuotaKeys(osClient, userId, utcNow, quotaScope);
            var ttlSeconds = Math.Max(
                3600L,
                (long)Math.Ceiling((utcNow.Date.AddDays(2) - utcNow).TotalSeconds));

            try
            {
                var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
                var result = await database.ScriptEvaluateAsync(
                    DailyQuotaReservationScript,
                    new RedisKey[] { keys.UserKey, keys.TenantKey },
                    new RedisValue[]
                    {
                        bytes,
                        options.DailyUserQuotaBytes,
                        options.DailyTenantQuotaBytes,
                        ttlSeconds
                    }).ConfigureAwait(false);

                var values = (RedisResult[])result;
                var status = values == null || values.Length == 0 ? -3 : (long)values[0];
                if (status == 1) return null;
                if (status == -1)
                {
                    return new DosResult(0, null,
                        $"当前账号今日上传额度已用尽（上限{FormatMegabytes(options.DailyUserQuotaBytes)}MB）！");
                }
                if (status == -2)
                {
                    return new DosResult(0, null,
                        $"当前租户今日上传额度已用尽（上限{FormatMegabytes(options.DailyTenantQuotaBytes)}MB）！");
                }
                return new DosResult(0, null, "上传配额预留失败！");
            }
            catch
            {
                // 配额依赖不可用时失败关闭，禁止退回无限制上传。
                return new DosResult(0, null, "上传配额服务暂时不可用，请稍后重试！");
            }
        }

        public static FileUploadQuotaKeys BuildDailyQuotaKeys(
            string osClient,
            string userId,
            DateTime utcNow,
            string quotaScope = null)
        {
            if (osClient.DosIsNullOrWhiteSpace()) throw new ArgumentException("OsClient不能为空！", nameof(osClient));
            if (userId.DosIsNullOrWhiteSpace()) throw new ArgumentException("UserId不能为空！", nameof(userId));

            var scope = NormalizeQuotaScope(quotaScope);
            var date = utcNow.ToUniversalTime().ToString("yyyyMMdd");
            var tenantPart = EncodeKeyPart(osClient.Trim().ToLowerInvariant());
            var userPart = EncodeKeyPart(userId.Trim());
            var hashTag = $"{{{scope}:{tenantPart}:{date}}}";
            var prefix = $"Microi:{osClient.Trim()}:{scope}:{date}:{hashTag}";
            return new FileUploadQuotaKeys
            {
                UserKey = $"{prefix}:User:{userPart}",
                TenantKey = $"{prefix}:Tenant",
                HashTag = hashTag
            };
        }

        /// <summary>
        /// 只计算 Base64 解码后的长度，不分配解码后的大字节数组。
        /// </summary>
        public static bool TryGetBase64DecodedLength(string value, out long decodedLength)
        {
            decodedLength = 0;
            if (string.IsNullOrWhiteSpace(value)) return true;

            long characterCount = 0;
            var padding = 0;
            var seenPadding = false;
            foreach (var character in value)
            {
                if (char.IsWhiteSpace(character)) continue;

                if (character == '=')
                {
                    seenPadding = true;
                    padding++;
                    if (padding > 2) return false;
                }
                else
                {
                    if (seenPadding
                        || (!(character >= 'A' && character <= 'Z')
                            && !(character >= 'a' && character <= 'z')
                            && !(character >= '0' && character <= '9')
                            && character != '+'
                            && character != '/'))
                    {
                        return false;
                    }
                }
                characterCount++;
            }

            if (characterCount == 0) return true;
            if (characterCount % 4 != 0) return false;

            try
            {
                decodedLength = checked(characterCount / 4 * 3 - padding);
                return decodedLength >= 0;
            }
            catch (OverflowException)
            {
                return false;
            }
        }

        private static long FormatMegabytes(long bytes) =>
            Math.Max(1, bytes / (1024L * 1024L));

        private static string NormalizeQuotaScope(string quotaScope)
        {
            var scope = string.IsNullOrWhiteSpace(quotaScope)
                ? DefaultQuotaScope
                : quotaScope.Trim();
            if (scope.Length > 64
                || scope.Any(character =>
                    !(character >= 'A' && character <= 'Z')
                    && !(character >= 'a' && character <= 'z')
                    && !(character >= '0' && character <= '9')
                    && character != '-'
                    && character != '_'))
            {
                throw new ArgumentException("Quota scope must contain only ASCII letters, digits, '-' or '_'.", nameof(quotaScope));
            }
            return scope;
        }

        private static string EncodeKeyPart(string value)
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(value ?? string.Empty))
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }
    }

    public sealed class FileUploadQuotaKeys
    {
        public string UserKey { get; set; }
        public string TenantKey { get; set; }
        public string HashTag { get; set; }
    }
}
