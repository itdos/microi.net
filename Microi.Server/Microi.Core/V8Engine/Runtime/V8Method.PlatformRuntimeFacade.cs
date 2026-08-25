using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private const string PlatformOsClientByDomainEngineKey = "platform-os-client-by-domain";
        private const string PlatformSysConfigEngineKey = "platform-sys-config";
        private const string PlatformLangBundleEngineKey = "platform-lang-bundle";
        private const string PlatformLoginWallpapersEngineKey = "platform-login-wallpapers";
        private const string PlatformMicroiInitEngineKey = "microi-init";
        private const string PlatformPrivateFileUrlEngineKey = "platform-private-file-url";

        /// <summary>
        /// 仅供官方匿名启动接口按域名解析租户。该原子只返回 OsClient，不返回
        /// sys_osclients 行、连接串或其它 SaaS 私有配置。
        /// </summary>
        public DosResult ResolveOsClientByDomain(string domain)
        {
            var denied = RequireTrustedApiEngine(PlatformOsClientByDomainEngineKey);
            if (denied != null) return denied;

            var normalizedDomain = NormalizePublicDomain(domain);
            if (normalizedDomain.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "Domain不能为空或格式无效。");

            var candidates = ResolveOsClientCandidates(
                normalizedDomain,
                OsClientExtend.ClientList.Values,
                ResolveEnabledOsClientsFromMainDatabase);
            if (candidates.Count > 1)
                return new DosResult(0, null, "该域名配置了多个启用租户，请先修复SaaS域名冲突。");
            var osClient = candidates.Count == 1 ? candidates[0] : null;
            if (osClient.DosIsNullOrWhiteSpace()) osClient = OsClientExtend.GetConfigOsClient();
            if (osClient.DosIsNullOrWhiteSpace()) osClient = OsClientDefault.OsClient;
            return osClient.DosIsNullOrWhiteSpace()
                ? new DosResult(0, null, "服务器尚未配置默认租户。")
                : new DosResult(1, new { OsClient = osClient });
        }

        internal static IReadOnlyList<string> ResolveOsClientCandidates(
            string normalizedDomain,
            IEnumerable<OsClientSecret> loadedClients,
            Func<string, IEnumerable<string>> databaseLookup)
        {
            if (normalizedDomain.DosIsNullOrWhiteSpace()) return Array.Empty<string>();
            var loaded = (loadedClients ?? Enumerable.Empty<OsClientSecret>())
                .Where(client => client != null
                                 && client.OsClientModel != null
                                 && DomainList(client.OsClientModel["DomainName"]?.ToString())
                                     .Contains(normalizedDomain, StringComparer.OrdinalIgnoreCase))
                .Select(client => client.OsClient?.Trim())
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            try
            {
                var database = (databaseLookup?.Invoke(normalizedDomain) ?? Enumerable.Empty<string>())
                    .Select(value => value?.Trim())
                    .Where(value => !value.DosIsNullOrWhiteSpace())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                // ClientList 可能只加载了旧租户 A，而主库已存在尚未加载的租户 B。
                // 主库可用时必须合并两侧候选再判冲突，不能因内存先命中就把域名
                // 错路由到 A。相同 OsClient 只保留一次。
                return loaded
                    .Concat(database)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
            catch
            {
                // 主库查询失败时才降级到本机已加载候选；不得把异常详情暴露给
                // 匿名启动接口，也不能因为数据库短时故障让已加载租户完全不可用。
                return loaded;
            }
        }

        private static IEnumerable<string> ResolveEnabledOsClientsFromMainDatabase(
            string normalizedDomain)
        {
            var mainOsClient = OsClientExtend.GetConfigOsClient();
            if (mainOsClient.DosIsNullOrWhiteSpace()) mainOsClient = OsClientDefault.OsClient;
            if (mainOsClient.DosIsNullOrWhiteSpace()) return Array.Empty<string>();
            var mainClient = OsClientExtend.GetClient(mainOsClient);
            // 租户刚创建但尚未进入本机 ClientList 时必须读配置主库，避免读副本延迟
            // 又把域名错误回退到默认租户。
            var db = mainClient?.Db;
            if (db == null) return Array.Empty<string>();

            var variants = ExactDomainStorageVariants(normalizedDomain);
            var query = db.FromSql(BuildExactDomainLookupSql(variants.Count))
                .AddInParameter("domainEnabled", System.Data.DbType.Int32, 1)
                .AddInParameter("domainDollar", "$")
                .AddInParameter("domainComma", ",")
                .AddInParameter("domainCr", "\r")
                .AddInParameter("domainLf", "\n")
                .AddInParameter("domainSeparator", ";")
                .AddInParameter("domainSpace", " ");
            for (var index = 0; index < variants.Count; index++)
            {
                var value = variants[index];
                query.AddInParameter("domainExact" + index, value)
                    .AddInParameter("domainStart" + index, value + ";%")
                    .AddInParameter("domainMiddle" + index, "%;" + value + ";%")
                    .AddInParameter("domainEnd" + index, "%;" + value);
            }

            var rows = query.ToList<dynamic>();
            return (rows ?? new List<dynamic>())
                .Select(row => row == null
                    ? null
                    : JObject.FromObject((object)row)["OsClient"].Val<string>())
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        internal static IReadOnlyList<string> ExactDomainStorageVariants(string normalizedDomain)
        {
            var domain = NormalizePublicDomain(normalizedDomain);
            if (domain.DosIsNullOrWhiteSpace()) return Array.Empty<string>();
            return new[] { domain, "http://" + domain, "https://" + domain }
                .SelectMany(value => new[] { value, value + "/" })
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        internal static string BuildExactDomainLookupSql(int variantCount)
        {
            if (variantCount <= 0) throw new ArgumentOutOfRangeException(nameof(variantCount));
            const string normalizedColumn =
                "LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(DomainName, ''), "
                + "@domainDollar, @domainSeparator), @domainComma, @domainSeparator), "
                + "@domainCr, @domainSeparator), @domainLf, @domainSeparator), @domainSpace, ''))";
            var clauses = Enumerable.Range(0, variantCount)
                .Select(index => "(" + normalizedColumn + " = @domainExact" + index
                                 + " OR " + normalizedColumn + " LIKE @domainStart" + index
                                 + " OR " + normalizedColumn + " LIKE @domainMiddle" + index
                                 + " OR " + normalizedColumn + " LIKE @domainEnd" + index + ")");
            return "SELECT OsClient FROM sys_osclients "
                   + "WHERE IsEnable = @domainEnabled AND COALESCE(IsDeleted, 0) = 0 AND ("
                   + string.Join(" OR ", clauses) + ")";
        }

        /// <summary>
        /// 仅供官方匿名启动接口读取浏览器安全投影。完整 V8.SysConfig 可能包含
        /// Secret、连接配置和服务端脚本，绝不能直接返回前端。
        /// </summary>
        public DosResult GetPublicSysConfig(string lang = null)
        {
            var denied = RequireTrustedApiEngine(PlatformSysConfigEngineKey);
            if (denied != null) return denied;
            try
            {
                var osClient = V8TenantContext.Current.OsClient;
                var source = MicroiEngine.FormEngine.GetSysConfig(osClient, lang)
                    .GetAwaiter().GetResult();
                if (source == null) return new DosResult(0, null, "系统设置读取失败。");

                var projection = source.Data == null
                    ? null
                    : TenantConfigurationSecurity.CreatePublicSysConfigProjection(source.Data, osClient);
                var loginPublicKey = ConfigHelper.GetRuntimeConfigurationValue("Security:LoginRsaPublicKey");
                if (projection != null && !loginPublicKey.DosIsNullOrWhiteSpace())
                    projection["LoginRsaPublicKey"] = loginPublicKey.Replace("\\n", "\n").Trim();

                return new DosResult(source.Code, projection, source.Msg, null, source.DataAppend);
            }
            catch (Exception)
            {
                return new DosResult(0, null, "系统设置读取失败，请稍后重试。");
            }
        }

        /// <summary>读取当前租户指定语言前缀的词条包。</summary>
        public DosResult GetLangBundle(string lang = null, string prefix = "Msg.")
        {
            var denied = RequireTrustedApiEngine(PlatformLangBundleEngineKey);
            if (denied != null) return denied;
            try
            {
                var osClient = V8TenantContext.Current.OsClient;
                var normalizedPrefix = prefix ?? "Msg.";
                if (normalizedPrefix.Length > 100)
                    return new DosResult(0, null, "Prefix长度不能超过100。");
                return new DosResult(1, DiyMessage.GetLangBundle(osClient, lang, normalizedPrefix));
            }
            catch (Exception)
            {
                return new DosResult(0, null, "语言包读取失败，请稍后重试。");
            }
        }

        /// <summary>
        /// 仅供官方匿名登录壁纸接口读取固定公开投影。这里故意不复用匿名
        /// FormEngine：diy_wallpaper 不需要、也不允许因此开放通用匿名读权限。
        /// </summary>
        public DosResult GetLoginWallpapers()
        {
            var denied = RequireTrustedApiEngine(PlatformLoginWallpapersEngineKey);
            if (denied != null) return denied;
            try
            {
                var osClient = V8TenantContext.Current.OsClient;
                var client = OsClientExtend.GetClient(osClient);
                var db = client?.DbRead ?? client?.Db;
                if (db == null) return new DosResult(0, null, "登录壁纸读取失败。");

                const string tableName = "diy_wallpaper";
                var id = new Field("Id", tableName);
                var name = new Field("Name", tableName);
                var category = new Field("Category", tableName);
                var imgUrl = new Field("ImgUrl", tableName);
                var isEnable = new Field("IsEnable", tableName);
                var isDeleted = new Field("IsDeleted", tableName);
                var createTime = new Field("CreateTime", tableName);
                var where = (isEnable == 1) && ((isDeleted != 1) || (isDeleted == null));

                // FromSection.Top 由 Dos.ORM 按实际数据库方言生成有界 SQL，避免匿名
                // 请求把整张壁纸表拉入进程后再截断。
                var rows = db.From(tableName)
                    .Select(id, name, category, imgUrl)
                    .Where(where)
                    .OrderBy(createTime.Desc)
                    .Top(200)
                    .ToDataTable();
                var output = rows.Rows
                    .Cast<System.Data.DataRow>()
                    .Take(200)
                    .Select(CreateLoginWallpaperProjection)
                    .ToList();
                return new DosResult(1, output, null, output.Count);
            }
            catch (Exception)
            {
                return new DosResult(0, null, "登录壁纸读取失败，请稍后重试。");
            }
        }

        internal static JObject CreateLoginWallpaperProjection(object row)
        {
            if (row is System.Data.DataRow dataRow)
            {
                return new JObject
                {
                    ["Id"] = Convert.ToString(dataRow["Id"]) ?? string.Empty,
                    ["Name"] = Convert.ToString(dataRow["Name"]) ?? string.Empty,
                    ["Category"] = Convert.ToString(dataRow["Category"]) ?? string.Empty,
                    ["ImgUrl"] = Convert.ToString(dataRow["ImgUrl"]) ?? string.Empty
                };
            }
            var source = row as JObject ?? (row == null ? new JObject() : JObject.FromObject(row));
            return new JObject
            {
                ["Id"] = source["Id"].Val<string>() ?? string.Empty,
                ["Name"] = source["Name"].Val<string>() ?? string.Empty,
                ["Category"] = source["Category"].Val<string>() ?? string.Empty,
                ["ImgUrl"] = source["ImgUrl"].Val<string>() ?? string.Empty
            };
        }

        /// <summary>
        /// 历史 microi-init 把 DiyToken 放在请求体而不是认证 Header，因而普通
        /// FormEngine 无法获得可信身份；同时 sys_menu 已被平台安全边界禁止匿名
        /// 直读。该窄原子只允许固定 microi-init 调用，重新验证原始 Token、断言
        /// 当前 V8 租户一致，再复用 SysMenuLogic 的权威角色过滤和树形构建。
        /// </summary>
        public DosResult GetLegacyInitMenuTree(string token, string osClient = null)
        {
            var denied = RequireTrustedApiEngine(PlatformMicroiInitEngineKey);
            if (denied != null) return denied;
            if (token.DosIsNullOrWhiteSpace())
                return new DosResult(1001, null, "登录身份已过期，请重新登录。");

            try
            {
                var trustedOsClient = TenantConfigurationSecurity.NormalizeTenantId(
                    V8TenantContext.Current.OsClient);
                if (!osClient.DosIsNullOrWhiteSpace()
                    && !string.Equals(
                        TenantConfigurationSecurity.NormalizeTenantId(osClient),
                        trustedOsClient,
                        StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult(1002, null, "请求租户与当前 V8 租户不一致。");
                }

                var currentToken = DiyToken.GetCurrentToken(token, trustedOsClient)
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                if (currentToken?.CurrentUser == null
                    || currentToken.CurrentUser["Id"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    return new DosResult(1001, null, "登录身份已过期，请重新登录。");
                }
                if (!string.Equals(
                    currentToken.OsClient,
                    trustedOsClient,
                    StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult(1002, null, "登录身份与当前租户不一致。");
                }
                if (UserAccessKeySecurity.IsSession(currentToken.CurrentUser))
                    return new DosResult(0, null, "访问密钥不能初始化交互式菜单。");

                var result = new SysMenuLogic().GetSysMenuStep(new SysMenuParam
                {
                    OsClient = trustedOsClient,
                    _CurrentUser = (JObject)currentToken.CurrentUser.DeepClone(),
                    Display = 1,
                    _All = true,
                    _SelectFields = new List<string>
                    {
                        "Id", "Name", "Icon", "IconClass", "Display", "AppDisplay",
                        "IsMicroiService", "OpenType", "ComponentName", "ComponentPath",
                        "PageTemplate", "Url", "DiyTableId", "ParentId", "Sort"
                    }
                }).ConfigureAwait(false).GetAwaiter().GetResult();
                return new DosResult(
                    result?.Code ?? 0,
                    result?.Data,
                    result?.Msg ?? "菜单读取失败。",
                    result?.DataCount,
                    result?.DataAppend);
            }
            catch
            {
                return new DosResult(0, null, "菜单读取失败，请稍后重试。");
            }
        }

        /// <summary>
        /// 为普通客户端签发私有文件短链。当前 DiyToken、租户、菜单、表、行、字段
        /// 与字段值引用全部由可信宿主重算，V8.Param 不能伪造身份或降级授权。
        /// </summary>
        public DosResult GetAuthorizedPrivateFileUrl(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(PlatformPrivateFileUrlEngineKey);
            if (denied != null) return denied;
            try
            {
                var osClient = V8TenantContext.Current.OsClient;
                var currentUser = V8TrustedExecutionContext.CurrentUser;
                if (currentUser != null)
                {
                    var trustedOsClient = V8TrustedExecutionContext.CurrentOsClient;
                    if (trustedOsClient.DosIsNullOrWhiteSpace()
                        || !string.Equals(trustedOsClient, osClient, StringComparison.OrdinalIgnoreCase))
                    {
                        return new DosResult(0, null, "请求租户与可信登录租户不一致！");
                    }
                    currentUser = currentUser.DeepClone() as JObject;
                }
                else
                {
                    var currentToken = DiyToken.GetCurrentToken(false).GetAwaiter().GetResult();
                    if (currentToken?.CurrentUser == null)
                        return new DosResult(1001, null, "登录身份已过期，请重新登录！");
                    if (!string.Equals(currentToken.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                        return new DosResult(0, null, "请求租户与当前登录租户不一致！");
                    currentUser = currentToken.CurrentUser.DeepClone() as JObject;
                }
                if (currentUser == null || currentUser["Id"].Val<string>().DosIsNullOrWhiteSpace())
                    return new DosResult(1001, null, "登录身份已过期，请重新登录！");

                var param = (DiyUploadParam)DynamicToDiyUploadParam(dynamicParam) ?? new DiyUploadParam();
                param.OsClient = osClient;
                param._CurrentUser = currentUser;
                param._InvokeType = InvokeType.Client.ToString();
                param.Limit = true;
                if (!param.FilePathName.DosIsNullOrWhiteSpace())
                    param.FilePathName = TenantConfigurationSecurity.NormalizeStoragePath(osClient, param.FilePathName);
                if (param.FilePathNames != null)
                    param.FilePathNames = param.FilePathNames
                        .Select(path => TenantConfigurationSecurity.NormalizeStoragePath(osClient, path))
                        .ToList();

                var authorization = PrivateFileAccessAuthorization.AuthorizeAsync(param)
                    .GetAwaiter().GetResult();
                if (authorization != null) return authorization;
                return MicroiEngine.HDFS.GetPrivateFileUrl(param).GetAwaiter().GetResult();
            }
            catch (Exception)
            {
                return new DosResult(0, null, "获取私有文件地址失败，请稍后重试。");
            }
        }

        private static IEnumerable<string> DomainList(string value)
        {
            return (value ?? string.Empty)
                .Split(new[] { ';', '$', ',', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(NormalizePublicDomain)
                .Where(item => !item.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase);
        }

        private static string NormalizePublicDomain(string value)
        {
            var domain = (value ?? string.Empty).Trim();
            if (domain.Length == 0 || domain.Length > 512) return string.Empty;
            if (!domain.Contains("://")) domain = "https://" + domain;
            Uri uri;
            if (!Uri.TryCreate(domain, UriKind.Absolute, out uri)
                || uri.Host.DosIsNullOrWhiteSpace()) return string.Empty;
            var host = uri.IdnHost.TrimEnd('.').ToLowerInvariant();
            if (host.Length == 0 || host.Length > 253) return string.Empty;
            return uri.IsDefaultPort ? host : host + ":" + uri.Port;
        }
    }
}
