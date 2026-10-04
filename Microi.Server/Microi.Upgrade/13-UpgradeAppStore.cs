using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 仅恢复启动、普通登录、导航及商城安装更新。可选应用由用户在商城手动安装。
    /// 恢复包由官方发行源的显式清单生成，不能整包导入 SaaS、SSO、AI 或通知应用。
    /// </summary>
    public class UpgradeAppStore
    {
        public const string Version = "7.6.15.0";
        internal const string BootstrapPackageResourceName = "app.microi.bootstrap.json";
        private const string ImportPackageResourceName = "import-package.js";
        private const string AppStoreMenuId = "61b7faee-35b2-4571-add2-5231a355f368";
        private const string PlatformMicroServiceKey = "microi-platform-service";
        private const string MarketplaceRoutePath = "/marketplace";
        private const string MicroAppHostComponentPath = "/micro-app/host";
        private const string PlatformSysMenuEngineKey = "platform-sys-menu";
        private const string PlatformBackgroundTaskEngineKey = "platform-background-task";
        private const string PlatformRuntimeCustomHookEngineKey = "platform-runtime-custom-hook";
        private const string ManagedPlatformRuntimeNoticeMarker = "/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1";
        private const string TenantPlatformRuntimeNoticeMarker = "/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1";
        private const string DefaultPlatformRuntimeHookBody = "return { Code : 1 };";
        private const int ImporterLimitMemoryMb = 8192;
        private static int PrivilegedEngineLimitRecursion => Math.Min(5000, CreateV8EngineParam.MaxLimitRecursion);
        private static readonly string[] RequiredResourceNames = { ImportPackageResourceName, BootstrapPackageResourceName };
        private static readonly string[] RuntimeDependencyPackageResourceNames = { BootstrapPackageResourceName };
        private static readonly IReadOnlyDictionary<string, string[]> StartupDependencyPackageKeys = BuildRuntimeDependencyPackageKeys();
        internal static readonly string[] RequiredStartupDependencyEngineKeys = StartupDependencyPackageKeys.Values.SelectMany(keys => keys).ToArray();
        private static readonly Lazy<IReadOnlyList<JObject>> BundledStartupDependencyEngines = new Lazy<IReadOnlyList<JObject>>(BuildBundledStartupDependencyEngines);
        private static readonly HashSet<string> ApiEngineBitColumns =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "IsDeleted", "IsEnable", "Lock", "AllowAnonymous"
            };
        // 启动闭包会在 FormEngine 可用前直接写 sys_apiengine，因此只能消费该表的
        // 物理字段。官方包历史上曾把展示名称导出为 Name；若把包对象的全部属性直接
        // 拼成列名，旧租户会因 Unknown column 'Name' 退出，Docker 随即反复重启。
        // 这里保留当前实体的完整物理字段白名单，包级说明等非物理元数据一律不入库。
        private static readonly HashSet<string> StartupDependencyPhysicalFields =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Id", "CreateTime", "UpdateTime", "UserId", "UserName", "IsDeleted",
                "ApiName", "ApiEngineKey", "ApiAddress", "ApiRoutes", "ApiV8Code", "ApiRemark",
                "ApiRole", "Category", "ChangeHistory", "Version", "Files", "TestParam",
                "TestResult", "AiCheckResult", "IsEnable", "StopHttp", "AllowAnonymous",
                "EnableLog", "ResponseFile", "ResponseType", "Lock", "LockKey", "Timeout",
                "MaxStatements", "LimitMemory", "LimitRecursion", "V8Limit", "V8Unlimited"
            };
        // 启动门禁没有登录用户上下文。旧版 sys_apiengine.UserId/UserName 曾是
        // NOT NULL 且没有默认值，因此官方包偶尔漏出审计字段时必须使用稳定的
        // 平台系统身份补齐；该身份只用于审计兼容，不参与任何授权判断。
        private const string StartupDependencySystemUserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03";
        private const string StartupDependencySystemUserName = "管理员";
        private static string StripLeadingBlockComments(string source)
        {
            var body = (source ?? string.Empty).TrimStart();
            while (body.StartsWith("/*", StringComparison.Ordinal))
            {
                var end = body.IndexOf("*/", StringComparison.Ordinal);
                if (end < 0) break;
                body = body.Substring(end + 2).TrimStart();
            }
            return body.Trim();
        }

        internal static bool IsOfficialSourceTenant(string osClient)
        {
            return Microi.License.LicenseService.IsOfficialPlatform(osClient);
        }

        internal static bool IsOfficialSourceResult(DosResult result)
        {
            if (result?.Data == null) return false;
            try
            {
                var model = result.Data as JObject ?? JObject.FromObject(result.Data);
                return model["OfficialSource"]?.Value<bool>() == true;
            }
            catch
            {
                return false;
            }
        }

        private static Dictionary<string, string> LoadBundledResources()
        {
            var resources = new Dictionary<string, string>(StringComparer.Ordinal);
            var assembly = typeof(UpgradeAppStore).GetTypeInfo().Assembly;
            foreach (var resourceName in RequiredResourceNames)
            {
                var manifestName = "Microi.Upgrade.Resource." + resourceName;
                using (var stream = assembly.GetManifestResourceStream(manifestName))
                {
                    if (stream == null)
                    {
                        throw new InvalidOperationException($"程序集缺少基础升级资源[{resourceName}]。请刷新资源后重新构建。");
                    }
                    using (var reader = new StreamReader(stream))
                    {
                        var content = reader.ReadToEnd();
                        ValidateResourceContent(resourceName, content);
                        resources[resourceName] = content;
                    }
                }
            }
            return resources;
        }

        private static IReadOnlyDictionary<string, string[]> BuildRuntimeDependencyPackageKeys()
        {
            var assembly = typeof(UpgradeAppStore).GetTypeInfo().Assembly;
            var result = new Dictionary<string, string[]>(StringComparer.Ordinal);
            var ownerByKey = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var resourceName in RuntimeDependencyPackageResourceNames)
            {
                var manifestName = "Microi.Upgrade.Resource." + resourceName;
                using var stream = assembly.GetManifestResourceStream(manifestName);
                if (stream == null)
                    throw new InvalidOperationException($"程序集缺少平台运行时资源[{resourceName}]。");
                using var reader = new StreamReader(stream);
                var package = JObject.Parse(reader.ReadToEnd());
                var packageKeys = package["SysApiEngines"]?.Children<JObject>()
                                      .Select(engine => engine["ApiEngineKey"]?.ToString()?.Trim())
                                      .Where(key => !key.DosIsNullOrWhiteSpace())
                                      .ToArray()
                                  ?? Array.Empty<string>();
                if (packageKeys.Distinct(StringComparer.Ordinal).Count() != packageKeys.Length)
                {
                    throw new InvalidOperationException($"内置官方应用包[{resourceName}]的接口引擎 Key 重复。");
                }
                foreach (var key in packageKeys)
                {
                    if (ownerByKey.TryGetValue(key, out var existingOwner))
                    {
                        throw new InvalidOperationException(
                            $"内置官方应用包接口[{key}]同时归属[{existingOwner}]和[{resourceName}]，无法确定升级所有权。");
                    }
                    ownerByKey[key] = resourceName;
                }
                if (packageKeys.Length > 0) result[resourceName] = packageKeys;
            }

            // 显式基础清单只保护启动与商城入口，不从完整官方应用自动扩展依赖。
            var minimumSeed = new[]
            {
                PlatformSysMenuEngineKey,
                "platform-os-client-by-domain",
                "platform-sys-config",
                "platform-lang-bundle",
                "platform-current-user",
                "platform-private-file-url",
                "platform-sys-user-public-info",
                PlatformRuntimeCustomHookEngineKey,
                "platform-service-health",
                PlatformBackgroundTaskEngineKey,
                "bulk-import-microi-store-packages",
                "get-microi-store"
            };
            var missingSeed = minimumSeed
                .Where(key => !ownerByKey.ContainsKey(key))
                .ToArray();
            if (missingSeed.Length > 0)
            {
                throw new InvalidOperationException(
                    "内置官方应用包缺少平台运行时基础接口：" + string.Join(",", missingSeed));
            }
            return result;
        }

        /// <summary>
        /// Reads every API engine from the embedded official baseline packages.
        /// Executable source remains owned by those application packages; this
        /// gate never carries a second copy of V8 business code in C#.
        /// </summary>
        internal static IReadOnlyList<JObject> LoadBundledStartupDependencyEngines()
        {
            return BundledStartupDependencyEngines.Value
                .Select(item => (JObject)item.DeepClone())
                .ToList();
        }

        private static IReadOnlyList<JObject> BuildBundledStartupDependencyEngines()
        {
            var resources = LoadBundledResources();
            var result = new List<JObject>();
            foreach (var packageEntry in StartupDependencyPackageKeys)
            {
                var package = JObject.Parse(resources[packageEntry.Key]);
                var policyMap = package["ResourcePolicies"]?["ApiEngines"] as JObject;
                var engines = package["SysApiEngines"]?.Children<JObject>().ToList()
                              ?? new List<JObject>();
                foreach (var key in packageEntry.Value)
                {
                    var matches = engines.Where(engine => string.Equals(
                        engine["ApiEngineKey"]?.ToString(),
                        key,
                        StringComparison.Ordinal)).ToList();
                    if (matches.Count != 1)
                    {
                        throw new InvalidOperationException(
                            $"内置官方应用包[{packageEntry.Key}]的启动接口[{key}]定义数量不是1。" );
                    }

                    var policy = policyMap?[key] as JObject;
                    var ownership = policy?["Ownership"]?.ToString();
                    var upgradePolicy = policy?["UpgradePolicy"]?.ToString();
                    var isManaged = string.Equals(ownership, "Platform", StringComparison.Ordinal)
                                    && string.Equals(upgradePolicy, "Managed", StringComparison.Ordinal);
                    var isTenantHook = string.Equals(ownership, "Tenant", StringComparison.Ordinal)
                                       && string.Equals(upgradePolicy, "CreateIfMissing", StringComparison.Ordinal);
                    if (!isManaged && !isTenantHook)
                    {
                        throw new InvalidOperationException(
                            $"内置官方应用包[{packageEntry.Key}]的运行时接口[{key}]未声明 Platform/Managed 或 Tenant/CreateIfMissing 所有权。" );
                    }

                    var engine = (JObject)matches[0].DeepClone();
                    var source = engine["ApiV8Code"]?.ToString() ?? string.Empty;
                    if (!source.TrimStart().StartsWith(
                            isTenantHook ? TenantPlatformRuntimeNoticeMarker : ManagedPlatformRuntimeNoticeMarker,
                            StringComparison.Ordinal)
                        || engine["ApiAddress"].Val<string>().DosIsNullOrWhiteSpace()
                        || (isTenantHook && !string.Equals(
                            StripLeadingBlockComments(source),
                            DefaultPlatformRuntimeHookBody,
                            StringComparison.Ordinal))
                        || engine["Id"].Val<string>().DosIsNullOrWhiteSpace())
                    {
                        throw new InvalidOperationException(
                            $"内置官方应用包[{packageEntry.Key}]的启动接口[{key}]运行契约不完整。" );
                    }
                    engine["_OfficialPackageResource"] = packageEntry.Key;
                    engine["_OfficialOwnership"] = ownership;
                    engine["_OfficialUpgradePolicy"] = upgradePolicy;
                    result.Add(engine);
                }
            }

            var actualKeys = result.Select(item => item["ApiEngineKey"]?.ToString()).ToArray();
            if (actualKeys.Length != RequiredStartupDependencyEngineKeys.Length
                || RequiredStartupDependencyEngineKeys.Any(key => !actualKeys.Contains(key, StringComparer.Ordinal)))
            {
                throw new InvalidOperationException("内置官方应用包未形成完整的平台运行时接口闭包。");
            }
            return result;
        }

        internal static bool StartupDependenciesReady(OsClientSecret client, out string reason)
        {
            reason = string.Empty;
            if (client?.Db == null)
            {
                reason = "租户数据库连接不可用。";
                return false;
            }
            try
            {
                var problems = new List<string>();
                foreach (var source in LoadBundledStartupDependencyEngines())
                {
                    var key = source["ApiEngineKey"]?.ToString();
                    var row = ReadStartupDependencyEngine(
                        client.Db,
                        key,
                        ignoreKeyCase: true);
                    var contractError = GetStartupDependencyContractError(row, source);
                    if (!contractError.DosIsNullOrWhiteSpace())
                    {
                        problems.Add(key + "：" + contractError);
                    }
                }
                if (problems.Count > 0)
                {
                    var visible = problems.Take(12).ToArray();
                    reason = $"共{problems.Count}项：" + string.Join("；", visible)
                             + (problems.Count > visible.Length
                                 ? $"；另有{problems.Count - visible.Length}项（修复结果会完整回读）"
                                 : string.Empty);
                    return false;
                }
                return true;
            }
            catch (Exception ex)
            {
                reason = ex.Message;
                return false;
            }
        }

        /// <summary>
        /// Must run under UpgradeDistributedLease. Package-declared Managed
        /// startup interfaces are authoritative and are overwritten in place from
        /// the embedded package. Existing CreateIfMissing hooks remain tenant-owned
        /// and are reused. Physical Id/address collisions are reconciled without
        /// turning local drift into an upgrade-blocking conflict.
        /// </summary>
        internal static async Task<DosResult> EnsureStartupDependenciesUnderLeaseAsync(
            OsClientSecret client)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (client?.Db == null)
                return new DosResult(0, null, "租户数据库连接不可用，无法检查平台运行时接口闭包。");
            if (IsOfficialSourceTenant(client.OsClient))
            {
                return StartupDependenciesReady(client, out var officialSourceReason)
                    ? new DosResult(1, new { Skipped = true, OfficialSource = true },
                        "官方应用源平台运行时接口闭包已就绪；未使用程序集内置包反向写入。")
                    : new DosResult(0, new
                    {
                        Skipped = true,
                        OfficialSource = true,
                        Reason = officialSourceReason
                    }, "官方应用源平台运行时接口闭包不完整，必须通过官方应用源同步修复：" + officialSourceReason);
            }

            var added = new List<string>();
            var reconciled = new List<string>();
            var reused = new List<string>();
            var overwritten = new List<string>();
            var identityRemapped = new List<string>();
            try
            {
                // 同一租户的一轮启动闭包使用同一份物理字段快照。旧库可能一次缺少
                // 数十个接口，逐条重复查询 information_schema 会显著拖慢容器启动。
                RuntimeColumnNullability.EnsureUnderLease(client);
                var physicalFields = ReadStartupDependencyPhysicalFields(client.Db, client.OsClient);
                var dependencies = LoadBundledStartupDependencyEngines();
                EnsureStartupDependencyVersionStorage(client.Db, physicalFields, dependencies);
                var dependencyIndex = 0;
                foreach (var packaged in dependencies)
                {
                    if (dependencyIndex++ % 10 == 0)
                        UpgradeExecutionLeaseContext.ConfirmOwnership();
                    else
                        UpgradeExecutionLeaseContext.ThrowIfLost();
                    var source = (JObject)packaged.DeepClone();
                    var key = source["ApiEngineKey"]?.ToString();
                    string writtenId;
                    var isTenantHook = IsCreateIfMissingRuntimeDependency(source);
                    var existing = ReadStartupDependencyEngine(client.Db, key, ignoreKeyCase: true);
                    if (existing != null)
                    {
                        // CreateIfMissing is a one-way ownership transfer. Any
                        // existing record, including a case variant, disabled
                        // row or tombstone, belongs to the tenant and must not be
                        // repaired by an official startup path.
                        if (isTenantHook)
                        {
                            reused.Add(key);
                            continue;
                        }

                        var reclaimedRoutes = await ReclaimStartupDependencyRoutesAsync(
                                client,
                                source,
                                existing["Id"]?.ToString(),
                                physicalFields)
                            .ConfigureAwait(false);
                        identityRemapped.AddRange(reclaimedRoutes);

                        // An exact package readback needs no write. Any Managed
                        // drift, including local source edits and soft deletion,
                        // is repaired from the selected embedded package.
                        if (string.IsNullOrWhiteSpace(
                                GetStartupDependencyContractError(existing, source)))
                        {
                            reused.Add(key);
                            continue;
                        }

                        var sameOfficialSource = string.Equals(
                            NormalizeStartupDependencySource(existing["ApiV8Code"]?.ToString()),
                            NormalizeStartupDependencySource(source["ApiV8Code"]?.ToString()),
                            StringComparison.Ordinal);
                        var patch = CreatePersistableRuntimeDependencySource(source);
                        patch["Id"] = existing["Id"]?.ToString();
                        patch["OsClient"] = client.OsClient;
                        patch["IsDeleted"] = 0;
                        patch["UpdateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                        writtenId = patch["Id"]?.ToString();
                        var updateCount = PersistStartupDependencyDirect(
                            client.Db,
                            patch,
                            existing["Id"]?.ToString(),
                            physicalFields);
                        if (updateCount != 1)
                        {
                            return new DosResult(0, new { ApiEngineKey = key },
                                $"平台运行时接口[{key}]补正失败：数据库影响行数={updateCount}");
                        }
                        reconciled.Add(key);
                        if (!sameOfficialSource
                            || ReadStartupSwitch(existing["IsDeleted"]) == 1)
                        {
                            overwritten.Add(key);
                        }
                    }
                    else
                    {
                        var reclaimedRoutes = await ReclaimStartupDependencyRoutesAsync(
                                client,
                                source,
                                ownerId: null,
                                physicalFields: physicalFields)
                            .ConfigureAwait(false);
                        identityRemapped.AddRange(reclaimedRoutes);
                        var idCollision = client.Db.FromSql($@"SELECT
    {QuoteIdentifier(client.Db, "Id")},
    {QuoteIdentifier(client.Db, "ApiEngineKey")},
    {QuoteIdentifier(client.Db, "ApiAddress")}
FROM {QuoteIdentifier(client.Db, "sys_apiengine")}
WHERE {QuoteIdentifier(client.Db, "Id")}=@p0")
                            .AddInParameter("p0", source["Id"]?.ToString())
                            .First<dynamic>();

                        var persistedSource = CreatePersistableRuntimeDependencySource(source);
                        if (idCollision != null)
                        {
                            persistedSource["Id"] = Guid.NewGuid().ToString();
                            identityRemapped.Add(key + "：包内Id已占用，使用新Id");
                        }
                        persistedSource["OsClient"] = client.OsClient;
                        persistedSource["IsDeleted"] = 0;
                        persistedSource["CreateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                        persistedSource["UpdateTime"] = persistedSource["CreateTime"];
                        writtenId = persistedSource["Id"]?.ToString();
                        var addCount = PersistStartupDependencyDirect(
                            client.Db,
                            persistedSource,
                            existingId: null,
                            physicalFields: physicalFields);
                        if (addCount != 1)
                        {
                            return new DosResult(0, new { ApiEngineKey = key },
                                $"平台运行时接口[{key}]创建失败：数据库影响行数={addCount}");
                        }
                        added.Add(key);
                    }

                    // Some old databases have physical BIT columns without
                    // matching diy_field metadata.  FormEngine can then report
                    // success while silently ignoring these flags, so reconcile
                    // internal 0/1 constants physically and read them back.
                    var isEnable = ReadStartupSwitch(source["IsEnable"]);
                    var stopHttp = ReadStartupSwitch(source["StopHttp"]);
                    var allowAnonymous = ReadStartupSwitch(source["AllowAnonymous"]);
                    client.Db.FromSql($@"UPDATE {QuoteIdentifier(client.Db, "sys_apiengine")}
SET {QuoteIdentifier(client.Db, "IsEnable")}={isEnable},
    {QuoteIdentifier(client.Db, "StopHttp")}={stopHttp},
    {QuoteIdentifier(client.Db, "AllowAnonymous")}={allowAnonymous},
    {QuoteIdentifier(client.Db, "ApiAddress")}=@p0
WHERE {QuoteIdentifier(client.Db, "ApiEngineKey")}=@p1
  AND ({QuoteIdentifier(client.Db, "IsDeleted")}=0 OR {QuoteIdentifier(client.Db, "IsDeleted")} IS NULL)")
                        .AddInParameter("p0", source["ApiAddress"]?.ToString())
                        .AddInParameter("p1", key)
                        .ExecuteNonQuery();

                    var readback = ReadStartupDependencyEngine(client.Db, key, ignoreKeyCase: true);
                    var contractError = GetStartupDependencyContractError(readback, source);
                    if (!contractError.DosIsNullOrWhiteSpace())
                    {
                        return new DosResult(0, new
                        {
                            ApiEngineKey = key,
                            ContractError = contractError,
                            WrittenId = writtenId,
                            ReadbackId = readback?["Id"]?.ToString(),
                            VersionColumnPresent = physicalFields.Contains("Version")
                        }, $"平台运行时接口[{key}]写入后强回读不一致：{contractError}");
                    }
                    await InvalidateStartupDependencyCacheAsync(client.OsClient, readback)
                        .ConfigureAwait(false);
                }

                foreach (var key in RequiredStartupDependencyEngineKeys)
                {
                    if (!added.Contains(key, StringComparer.Ordinal)
                        && !reconciled.Contains(key, StringComparer.Ordinal)
                        && !reused.Contains(key, StringComparer.Ordinal))
                        reused.Add(key);
                }
                UpgradeExecutionLeaseContext.ConfirmOwnership();
                if (!StartupDependenciesReady(client, out var finalReason))
                    return new DosResult(0, null, "平台运行时接口闭包最终回读失败：" + finalReason);

                return new DosResult(1, new
                {
                    Verified = RequiredStartupDependencyEngineKeys.Length,
                    Added = added,
                    Reconciled = reconciled,
                    Reused = reused,
                    Overwritten = overwritten,
                    IdentityRemapped = identityRemapped,
                    Source = "EmbeddedOfficialApplicationPackages"
                }, added.Count > 0 || reconciled.Count > 0
                    ? $"已从内置官方应用包补齐平台运行时接口闭包（共{RequiredStartupDependencyEngineKeys.Length}项）。"
                    : $"平台运行时接口闭包已就绪（共{RequiredStartupDependencyEngineKeys.Length}项）。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, new
                {
                    Added = added,
                    Reconciled = reconciled,
                    Overwritten = overwritten,
                    IdentityRemapped = identityRemapped
                }, "平台运行时接口闭包检查异常：" + ex.Message);
            }
        }

        private static JObject ReadStartupDependencyEngine(
            DbSession database,
            string key,
            bool ignoreKeyCase = false)
        {
            var apiEngineKey = QuoteIdentifier(database, "ApiEngineKey");
            var predicate = ignoreKeyCase
                ? $"LOWER({apiEngineKey})=LOWER(@p0)"
                : $"{apiEngineKey}=@p0";
            var row = database.FromSql(
                    $"SELECT * FROM {QuoteIdentifier(database, "sys_apiengine")} WHERE {predicate}")
                .AddInParameter("p0", key)
                .First<dynamic>();
            return row == null ? null : JObject.FromObject(row);
        }

        /// <summary>
        /// Package-declared Managed routes are authoritative for the selected
        /// application version. Remove only colliding ApiAddress/ApiRoutes aliases
        /// from other engines; preserve their identity, source and unrelated routes.
        /// </summary>
        private static async Task<IReadOnlyList<string>> ReclaimStartupDependencyRoutesAsync(
            OsClientSecret client,
            JObject source,
            string ownerId,
            HashSet<string> physicalFields)
        {
            var claimedRoutes = new HashSet<string>(
                ApiEngineRouteAliases.GetConfiguredRoutes(source),
                StringComparer.OrdinalIgnoreCase);
            if (claimedRoutes.Count == 0) return Array.Empty<string>();

            var idColumn = QuoteIdentifier(client.Db, "Id");
            var keyColumn = QuoteIdentifier(client.Db, "ApiEngineKey");
            var addressColumn = QuoteIdentifier(client.Db, "ApiAddress");
            var hasApiRoutes = physicalFields.Contains("ApiRoutes");
            var routesColumn = hasApiRoutes ? QuoteIdentifier(client.Db, "ApiRoutes") : null;
            var rows = client.Db.FromSql($@"SELECT
    {idColumn},
    {keyColumn},
    {addressColumn}{(hasApiRoutes ? "," + Environment.NewLine + "    " + routesColumn : string.Empty)}
FROM {QuoteIdentifier(client.Db, "sys_apiengine")}").ToArray() ?? Array.Empty<dynamic>();
            var released = new List<string>();
            foreach (var raw in rows)
            {
                var row = JObject.FromObject((object)raw);
                var rowId = row["Id"]?.ToString();
                if (!ownerId.DosIsNullOrWhiteSpace()
                    && string.Equals(ownerId, rowId, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var oldAddress = row["ApiAddress"]?.ToString()?.Trim() ?? string.Empty;
                IReadOnlyList<string> oldRoutes = hasApiRoutes
                    ? ApiEngineRouteAliases.Parse(row["ApiRoutes"]?.ToString())
                    : Array.Empty<string>();
                var removedRoutes = new List<string>();
                if (!oldAddress.DosIsNullOrWhiteSpace() && claimedRoutes.Contains(oldAddress))
                    removedRoutes.Add(oldAddress);
                removedRoutes.AddRange(oldRoutes.Where(claimedRoutes.Contains));
                if (removedRoutes.Count == 0) continue;

                await InvalidateStartupDependencyCacheAsync(client.OsClient, row)
                    .ConfigureAwait(false);
                var keptRoutes = oldRoutes.Where(route => !claimedRoutes.Contains(route)).ToArray();
                var command = hasApiRoutes
                    ? client.Db.FromSql($@"UPDATE {QuoteIdentifier(client.Db, "sys_apiengine")}
SET {addressColumn}=@p1,
    {routesColumn}=@p2
WHERE {idColumn}=@p0")
                    : client.Db.FromSql($@"UPDATE {QuoteIdentifier(client.Db, "sys_apiengine")}
SET {addressColumn}=@p1
WHERE {idColumn}=@p0");
                command.AddInParameter("p0", rowId)
                    .AddInParameter(
                        "p1",
                        claimedRoutes.Contains(oldAddress) ? (object)DBNull.Value : oldAddress);
                if (hasApiRoutes)
                {
                    command.AddInParameter(
                        "p2",
                        keptRoutes.Length > 0
                            ? (object)string.Join(";", keptRoutes)
                            : DBNull.Value);
                }
                var affected = command.ExecuteNonQuery();
                if (affected != 1)
                {
                    throw new InvalidOperationException(
                        $"平台运行时接口[{source?["ApiEngineKey"]}]收回包声明路由未命中唯一记录：{rowId}");
                }
                released.Add(
                    $"{source?["ApiEngineKey"]}：收回路由[{string.Join("；", removedRoutes)}]，原接口="
                    + (row["ApiEngineKey"]?.ToString() ?? rowId));
            }
            return released;
        }

        private static bool IsCreateIfMissingRuntimeDependency(JObject source)
        {
            return string.Equals(
                       source?["_OfficialOwnership"]?.ToString(),
                       "Tenant",
                       StringComparison.Ordinal)
                   && string.Equals(
                       source?["_OfficialUpgradePolicy"]?.ToString(),
                       "CreateIfMissing",
                       StringComparison.Ordinal);
        }

        private static JObject CreatePersistableRuntimeDependencySource(JObject source)
        {
            var result = source == null ? new JObject() : (JObject)source.DeepClone();

            // 兼容 v7.7.2 及更早应用商城包的接口展示名称别名。ApiName 才是
            // sys_apiengine 的真实物理列；已有 ApiName 时绝不让旧 Name 覆盖它。
            if (result["ApiName"].Val<string>().DosIsNullOrWhiteSpace()
                && !result["Name"].Val<string>().DosIsNullOrWhiteSpace())
            {
                result["ApiName"] = result["Name"];
            }

            result.Remove("_OfficialPackageResource");
            result.Remove("_OfficialOwnership");
            result.Remove("_OfficialUpgradePolicy");
            foreach (var property in result.Properties()
                         .Where(property => !StartupDependencyPhysicalFields.Contains(property.Name))
                         .ToArray())
            {
                property.Remove();
            }

            var key = result["ApiEngineKey"].Val<string>();
            if (result["ApiName"].Val<string>().DosIsNullOrWhiteSpace())
                result["ApiName"] = key;
            if (result["UserId"].Val<string>().DosIsNullOrWhiteSpace())
                result["UserId"] = StartupDependencySystemUserId;
            if (result["UserName"].Val<string>().DosIsNullOrWhiteSpace())
                result["UserName"] = StartupDependencySystemUserName;

            // 早期 sys_apiengine 的多个基础列曾使用 NOT NULL 且没有数据库默认值。
            // 包资源允许省略可推导的零值，但启动门禁必须先形成一条完整、可安全插入
            // 的物理记录；随后还会与目标租户真实列取交集，不会向旧库写入不存在的列。
            if (result["IsDeleted"] == null || result["IsDeleted"].Type == JTokenType.Null)
                result["IsDeleted"] = 0;
            if (result["IsEnable"] == null || result["IsEnable"].Type == JTokenType.Null)
                result["IsEnable"] = 1;
            if (result["StopHttp"] == null || result["StopHttp"].Type == JTokenType.Null)
                result["StopHttp"] = 0;
            if (result["AllowAnonymous"] == null || result["AllowAnonymous"].Type == JTokenType.Null)
                result["AllowAnonymous"] = 0;
            if (result["EnableLog"] == null || result["EnableLog"].Type == JTokenType.Null)
                result["EnableLog"] = 0;
            if (result["ResponseFile"] == null || result["ResponseFile"].Type == JTokenType.Null)
                result["ResponseFile"] = 0;
            if (result["Lock"] == null || result["Lock"].Type == JTokenType.Null)
                result["Lock"] = 0;
            if (result["ApiRole"].Val<string>().DosIsNullOrWhiteSpace())
                result["ApiRole"] = "[]";
            if (result["Files"].Val<string>().DosIsNullOrWhiteSpace())
                result["Files"] = "[]";
            // 包允许未声明版本的扩展接口，旧库的 Version 可能是 NOT NULL。
            // 空版本仅补可存储的空串，不能伪造 Managed 包要求的版本号。
            if (result["Version"] == null || result["Version"].Type == JTokenType.Null)
                result["Version"] = string.Empty;
            if (key.DosIsNullOrWhiteSpace()
                || result["Id"].Val<string>().DosIsNullOrWhiteSpace()
                || result["ApiAddress"].Val<string>().DosIsNullOrWhiteSpace()
                || result["ApiV8Code"].Val<string>().DosIsNullOrWhiteSpace())
            {
                throw new InvalidOperationException("平台运行时接口缺少 Id、ApiEngineKey、ApiAddress 或 ApiV8Code，拒绝持久化。");
            }
            return result;
        }

        private static JObject IntersectStartupDependencyWithPhysicalFields(
            JObject source,
            HashSet<string> physicalFields)
        {
            if (physicalFields == null || physicalFields.Count == 0)
                throw new InvalidOperationException("未读取到 sys_apiengine 物理字段，拒绝盲目写入启动接口闭包。");

            var result = source == null ? new JObject() : (JObject)source.DeepClone();
            foreach (var property in result.Properties()
                         .Where(property => !StartupDependencyPhysicalFields.Contains(property.Name)
                                            || !physicalFields.Contains(property.Name))
                         .ToArray())
            {
                property.Remove();
            }
            return result;
        }

        private static HashSet<string> ReadStartupDependencyPhysicalFields(
            DbSession database,
            string osClient,
            string tableName = "sys_apiengine")
        {
            var columnResult = MicroiEngine.ORM(database.Db.DbProvider.DatabaseType).GetColumns(
                new DbServiceParam
                {
                    OsClient = osClient,
                    TableName = tableName,
                    DbSession = database
                });
            if (columnResult?.Code != 1 || columnResult.Data == null)
                throw new InvalidOperationException(
                    $"读取 {tableName} 物理字段失败：" + (columnResult?.Msg ?? "接口无返回"));

            var fields = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var token in JArray.FromObject(columnResult.Data))
            {
                var row = token as JObject ?? JObject.FromObject(token);
                var name = row.GetValue("column_name", StringComparison.OrdinalIgnoreCase)?.ToString()
                           ?? row.GetValue("ColumnName", StringComparison.OrdinalIgnoreCase)?.ToString();
                if (!name.DosIsNullOrWhiteSpace()) fields.Add(name);
            }
            if (fields.Count == 0)
                throw new InvalidOperationException("sys_apiengine 物理字段回读为空，拒绝盲目写入启动接口闭包。");
            return fields;
        }

        /// <summary>
        /// Version 是启动 Managed 协议的一部分。SQL Server 历史库可能缺列或长度
        /// 小于包版本；在既有共享租约内只补列/扩容，不收缩、不转换其它字段类型。
        /// </summary>
        private static void EnsureStartupDependencyVersionStorage(
            DbSession database,
            HashSet<string> physicalFields,
            IReadOnlyList<JObject> dependencies)
        {
            var requiredLength = dependencies
                .Where(source => !IsCreateIfMissingRuntimeDependency(source))
                .Select(source => source["Version"]?.ToString().Length ?? 0)
                .DefaultIfEmpty(0).Max();
            if (requiredLength == 0) return;
            if (database.Db.DbProvider.DatabaseType != DatabaseType.SqlServer
                && database.Db.DbProvider.DatabaseType != DatabaseType.SqlServer9)
            {
                if (!physicalFields.Contains("Version"))
                    throw new InvalidOperationException("sys_apiengine 缺少启动闭包必需物理字段 Version，请先完成物理字段升级。");
                return;
            }

            // 使用当前连接实际解析的表，避免其它 schema 的同名表干扰字段判断。
            var rawColumn = database.FromSql(@"SELECT TYPE_NAME(user_type_id) AS TypeName,
    max_length AS MaxLength, is_nullable AS IsNullable, is_computed AS IsComputed,
    collation_name AS CollationName
FROM sys.columns WHERE object_id=OBJECT_ID(N'sys_apiengine') AND name=N'Version'")
                .First<dynamic>();
            JObject column = rawColumn == null ? null : JObject.FromObject(rawColumn);
            var targetLength = Math.Max(50, requiredLength);
            if (targetLength > 4000)
                throw new InvalidOperationException("启动包 Version 超出 SQL Server 版本列支持的长度，拒绝写入。");
            string sql = null;
            if (column == null)
            {
                sql = $"ALTER TABLE [sys_apiengine] ADD [Version] nvarchar({targetLength}) NULL";
            }
            else
            {
                var type = column["TypeName"]?.ToString().ToLowerInvariant();
                if (ReadStartupSwitch(column["IsComputed"]) == 1
                    || (type != "nvarchar" && type != "varchar" && type != "nchar" && type != "char"
                        && type != "ntext" && type != "text"))
                {
                    throw new InvalidOperationException(
                        $"sys_apiengine.Version 必须是可写文本列，当前类型={type}，计算列={column["IsComputed"]}。");
                }
                var bytes = column["MaxLength"].Value<int>();
                var capacity = type == "nvarchar" || type == "nchar" ? bytes / 2 : bytes;
                if (bytes != -1 && type != "text" && type != "ntext" && capacity < requiredLength)
                {
                    var nullable = ReadStartupSwitch(column["IsNullable"]) == 1 ? "NULL" : "NOT NULL";
                    var collation = column["CollationName"]?.ToString();
                    if (string.IsNullOrEmpty(collation)
                        || !System.Text.RegularExpressions.Regex.IsMatch(collation, "^[A-Za-z0-9_]+$"))
                        throw new InvalidOperationException("sys_apiengine.Version 排序规则无法确认，拒绝修改物理列。");
                    sql = $"ALTER TABLE [sys_apiengine] ALTER COLUMN [Version] {type}({targetLength}) COLLATE {collation} {nullable}";
                }
            }
            if (sql != null)
            {
                UpgradeExecutionLeaseContext.ConfirmOwnership();
                database.FromSql(sql).ExecuteNonQuery();
                UpgradeExecutionLeaseContext.ConfirmOwnership();
            }
            // Version 不再被旧字段快照静默过滤；其值必须与包一起写入并强回读。
            physicalFields.Add("Version");
        }

        /// <summary>
        /// 商城恢复入口的最小自举：从受信所属应用包补缺核心自描述和登录依赖元数据，
        /// 不安装业务资源、不覆盖已有字段或写成功版本。菜单物理列存在但元数据缺失时，
        /// FormEngine 会静默忽略新绑定字段，商城先于模块包安装便无法自行恢复。
        /// 调用者必须位于已有版本门及租户升级租约内；物理表/固定列仍由前置门禁负责。
        /// </summary>
        internal static async Task EnsureMarketplaceMetadataBootstrapUnderLeaseAsync(OsClientSecret client, bool menuOnly = false)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            EnsureLegacyMetadataIdentifierStorage(client);
            var resources = await LoadUpgradeResourcesAsync().ConfigureAwait(false);
            var database = client.Db;
            var physicalTables = ReadStartupDependencyPhysicalFields(database, client.OsClient, "diy_table");
            var physicalFields = ReadStartupDependencyPhysicalFields(database, client.OsClient, "diy_field");
            var repaired = 0;
            var cacheKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using var trans = database.BeginTransaction();
            try
            {
                // MARKETPLACE_MENU_METADATA_BOOTSTRAP_V1: use the owning package
                // as the schema source; only missing fields backed by physical
                // menu columns are restored, never tenant field customizations.
                var owners = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["diy_table"] = BootstrapPackageResourceName,
                    ["diy_field"] = BootstrapPackageResourceName,
                    ["sys_apiengine"] = BootstrapPackageResourceName,
                    ["sys_menu"] = BootstrapPackageResourceName,
                    ["sys_config"] = BootstrapPackageResourceName,
                    ["sys_user"] = BootstrapPackageResourceName,
                    ["sys_osclients"] = BootstrapPackageResourceName
                };
                foreach (var name in menuOnly ? new[] { "sys_menu" } : owners.Keys.ToArray())
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    if (!database.TableExists(name))
                    {
                        if (menuOnly || name == "diy_table" || name == "diy_field")
                            throw new InvalidOperationException($"商城自举缺少核心物理表 {name}。");
                        continue;
                    }
                    var package = JObject.Parse(resources[owners[name]]);
                    // 只恢复已有物理列的缺失描述；物理扩展和完整应用安装各自负责其边界。
                    var targetColumns = ReadStartupDependencyPhysicalFields(database, client.OsClient, name);
                    var source = (package["DiyTables"] as JArray)?.OfType<JObject>()
                        .SingleOrDefault(row => string.Equals(row["Name"]?.ToString(), name, StringComparison.OrdinalIgnoreCase))
                        ?? throw new InvalidOperationException($"官方所属应用包缺少商城自举元数据 {name}。");
                    var sourceId = source["Id"].ToString();
                    var existing = trans.FromSql($"SELECT * FROM {QuoteIdentifier(database, "diy_table")} WHERE LOWER({QuoteIdentifier(database, "Name")})=LOWER(@p0)")
                        .AddInParameter("p0", name).ToList<dynamic>()
                        .Select(row => JObject.FromObject((object)row)).ToList();
                    var current = existing.FirstOrDefault(row => string.Equals(row["Id"]?.ToString(), sourceId, StringComparison.OrdinalIgnoreCase))
                        ?? existing.FirstOrDefault(row => ReadStartupSwitch(row["IsDeleted"]) != 1)
                        ?? existing.FirstOrDefault();
                    var tableId = current?["Id"]?.ToString();
                    if (current == null)
                    {
                        var model = (JObject)source.DeepClone();
                        tableId = ResolveBootstrapInsertId(database, trans, "diy_table", sourceId);
                        model["Id"] = tableId;
                        model["DataBaseId"] = "";
                        model["DataBaseName"] = "";
                        InsertBootstrapMetadata(database, trans, "diy_table", model, physicalTables, client.OsClient);
                        repaired++;
                    }
                    else if (ReadStartupSwitch(current["IsDeleted"]) == 1)
                    {
                        trans.FromSql($"UPDATE {QuoteIdentifier(database, "diy_table")} SET {QuoteIdentifier(database, "IsDeleted")}=0 WHERE {QuoteIdentifier(database, "Id")}=@p0")
                            .AddInParameter("p0", tableId).ExecuteNonQuery();
                        repaired++;
                    }
                    if (string.IsNullOrWhiteSpace(tableId))
                        throw new InvalidOperationException($"商城自举元数据缺少稳定 Id：{name}。");
                    var existingFields = new HashSet<string>(trans.FromSql($"SELECT {QuoteIdentifier(database, "Name")} FROM {QuoteIdentifier(database, "diy_field")} WHERE {QuoteIdentifier(database, "TableId")}=@p0 AND ({QuoteIdentifier(database, "IsDeleted")}=0 OR {QuoteIdentifier(database, "IsDeleted")} IS NULL)")
                        .AddInParameter("p0", tableId).ToList<dynamic>()
                        .Select(row => JObject.FromObject((object)row)["Name"]?.ToString() ?? ""), StringComparer.OrdinalIgnoreCase);
                    foreach (var sourceField in (package["DiyFields"] as JArray)?.OfType<JObject>()
                                 .Where(field => string.Equals(field["TableId"]?.ToString(), sourceId, StringComparison.OrdinalIgnoreCase))
                                 ?? Enumerable.Empty<JObject>())
                    {
                        var fieldName = sourceField["Name"]?.ToString();
                        if (existingFields.Contains(fieldName) || !targetColumns.Contains(fieldName)) continue;
                        var model = (JObject)sourceField.DeepClone();
                        model["Id"] = ResolveBootstrapInsertId(database, trans, "diy_field", sourceField["Id"]?.ToString());
                        model["TableId"] = tableId;
                        model["TableName"] = name;
                        InsertBootstrapMetadata(database, trans, "diy_field", model, physicalFields, client.OsClient);
                        existingFields.Add(fieldName);
                        repaired++;
                    }
                    cacheKeys.Add(name);
                    cacheKeys.Add(tableId);
                }
                UpgradeExecutionLeaseContext.ThrowIfLost();
                trans.Commit();
            }
            catch
            {
                trans.Rollback();
                throw;
            }
            if (repaired == 0) return;
            foreach (var key in cacheKeys)
            {
                await MicroiEngine.CacheTenant.Cache(client.OsClient).RemoveAsync($"Microi:{client.OsClient}:FormData:diy_table:{key.ToLowerInvariant()}");
                await MicroiEngine.CacheTenant.Cache(client.OsClient).RemoveAsync($"Microi:{client.OsClient}:FormData:diy_table_field_list:{key.ToLowerInvariant()}");
            }
            UpgradeProgress.WriteLine($"Microi：【兼容修复】【{client.OsClient}】已从受信所属应用包补齐商城自举元数据 {repaired} 条，既有字段与业务数据保持原样。");
        }

        // MySQL parses CHAR(36) before materialization. Mixed UUID/ULID metadata
        // cannot be repaired by a row projection alone. Only core bootstrap identity
        // columns are expanded; business schemas remain owned by their application.
        // SHOW CREATE preserves defaults, keys, nullability, charset and comments.
        internal static int EnsureLegacyMetadataIdentifierStorage(OsClientSecret client)
        {
            var database = client?.Db;
            if (database?.Db?.DbProvider?.DatabaseType != DatabaseType.MySql) return 0;
            var repaired = 0;
            foreach (var table in new[] { "diy_table", "diy_field" })
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var columns = database.FromSql(@"SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@p0 AND DATA_TYPE='char'
AND CHARACTER_MAXIMUM_LENGTH=36
AND COLUMN_NAME IN ('Id','TableId','UserId','DataBaseId','ParentId')")
                    .AddInParameter("p0", table).ToList<dynamic>()
                    .Select(row => Convert.ToString((object)row.COLUMN_NAME)).ToArray();
                if (columns.Length == 0) continue;
                // Core metadata can also retain customer foreign keys. Share the
                // same isolated, constraint-preserving atom as package installation.
                UpgradeExecutionLeaseContext.ConfirmOwnership();
                repaired += database.WidenMySqlIdentifierColumns(table,
                    string.Join(",", columns.Select(column => column + ":36")));
                UpgradeExecutionLeaseContext.ThrowIfLost();
            }
            if (repaired > 0)
                UpgradeProgress.WriteLine($"Microi：【兼容修复】【{client.OsClient}】已将 {repaired} 个核心元数据标识列从 char(36) 无损扩展为 varchar(36)，兼容 UUID 与 ULID。");
            return repaired;
        }

        private static string ResolveBootstrapInsertId(DbSession database, DbTrans trans, string table, string sourceId)
        {
            if (!string.IsNullOrWhiteSpace(sourceId)
                && Convert.ToInt32(trans.FromSql($"SELECT COUNT(1) FROM {QuoteIdentifier(database, table)} WHERE {QuoteIdentifier(database, "Id")}=@p0")
                    .AddInParameter("p0", sourceId).ToScalar()) == 0) return sourceId;
            return Guid.NewGuid().ToString();
        }

        private static void InsertBootstrapMetadata(DbSession database, DbTrans trans, string table, JObject source,
            HashSet<string> physicalFields, string osClient)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            var model = (JObject)source.DeepClone();
            model["OsClient"] = osClient;
            model["IsDeleted"] = 0;
            model["CreateTime"] = DateTime.Now;
            model["UpdateTime"] = DateTime.Now;
            model.Remove("UserId");
            model.Remove("UserName");
            var fields = model.Properties().Where(field => physicalFields.Contains(field.Name)).ToArray();
            var statement = trans.FromSql($"INSERT INTO {QuoteIdentifier(database, table)} ({string.Join(",", fields.Select(field => QuoteIdentifier(database, field.Name)))}) VALUES ({string.Join(",", fields.Select((_, i) => "@p" + i))})");
            for (var index = 0; index < fields.Length; index++)
                statement.AddInParameter("p" + index, ReadDatabaseValue(database, fields[index].Name, fields[index].Value));
            if (statement.ExecuteNonQuery() != 1)
                throw new InvalidOperationException($"商城自举元数据写入失败：{table}.{model["Name"]}。");
            if (Convert.ToInt32(trans.FromSql($"SELECT COUNT(1) FROM {QuoteIdentifier(database, table)} WHERE {QuoteIdentifier(database, "Id")}=@p0 AND {QuoteIdentifier(database, "IsDeleted")}=0")
                    .AddInParameter("p0", model["Id"].ToString()).ToScalar()) != 1)
                throw new InvalidOperationException($"商城自举元数据强回读失败：{table}.{model["Name"]}。");
        }

        /// <summary>
        /// 启动闭包属于 API 接收流量前的物理协议门禁，不能依赖 diy_table/diy_field
        /// 元数据。部分早期子租户只有 sys_apiengine 物理表而没有对应低代码元数据，
        /// 继续走 FormEngine 会在修复第一个接口时反而报 diy_table NoExistData。
        /// 这里仅对程序集内受信官方包的固定字段执行参数化 INSERT/UPDATE；业务应用
        /// 的完整安装、资源策略与版本记录仍由应用商城导入器负责。
        /// </summary>
        private static int PersistStartupDependencyDirect(
            DbSession database,
            JObject source,
            string existingId,
            HashSet<string> physicalFields)
        {
            if (database == null) throw new ArgumentNullException(nameof(database));
            if (source == null) throw new ArgumentNullException(nameof(source));

            var persisted = (JObject)source.DeepClone();
            persisted.Remove("OsClient");
            persisted.Remove("_OfficialPackageResource");
            persisted.Remove("_OfficialOwnership");
            persisted.Remove("_OfficialUpgradePolicy");
            var now = DateTime.Now;
            persisted["UpdateTime"] = JToken.FromObject(now);
            if (existingId.DosIsNullOrWhiteSpace())
                persisted["CreateTime"] = JToken.FromObject(now);
            persisted = IntersectStartupDependencyWithPhysicalFields(persisted, physicalFields);

            foreach (var requiredField in new[] { "Id", "ApiEngineKey", "ApiAddress", "ApiV8Code" })
            {
                if (!physicalFields.Contains(requiredField))
                    throw new InvalidOperationException(
                        $"sys_apiengine 缺少启动闭包必需物理字段 {requiredField}，请先完成物理字段升级。");
            }
            if (!string.IsNullOrWhiteSpace(source["Version"]?.ToString())
                && !physicalFields.Contains("Version"))
                throw new InvalidOperationException("sys_apiengine 缺少启动闭包必需物理字段 Version，拒绝省略版本后写入。");

            var fields = persisted.Properties()
                .Where(property => existingId.DosIsNullOrWhiteSpace()
                    || (!string.Equals(property.Name, "Id", StringComparison.OrdinalIgnoreCase)
                        && !string.Equals(property.Name, "CreateTime", StringComparison.OrdinalIgnoreCase)))
                .ToArray();
            if (fields.Length == 0)
                throw new InvalidOperationException("平台运行时接口没有可持久化字段。");

            var section = existingId.DosIsNullOrWhiteSpace()
                ? database.FromSql(
                    $"INSERT INTO {QuoteIdentifier(database, "sys_apiengine")} ({string.Join(",", fields.Select(field => QuoteIdentifier(database, field.Name)))}) "
                    + $"VALUES ({string.Join(",", fields.Select((_, index) => "@p" + index))})")
                : database.FromSql(
                    $"UPDATE {QuoteIdentifier(database, "sys_apiengine")} SET {string.Join(",", fields.Select((field, index) => QuoteIdentifier(database, field.Name) + "=@p" + index))} "
                    + $"WHERE {QuoteIdentifier(database, "Id") }=@p{fields.Length}");

            for (var index = 0; index < fields.Length; index++)
                section.AddInParameter(
                    "p" + index,
                    ReadDatabaseValue(database, fields[index].Name, fields[index].Value));
            if (!existingId.DosIsNullOrWhiteSpace())
                section.AddInParameter("p" + fields.Length, existingId);
            return section.ExecuteNonQuery();
        }

        private static string QuoteIdentifier(DbSession database, string identifier)
        {
            return database.Db.DbProvider.DatabaseType switch
            {
                DatabaseType.SqlServer or DatabaseType.SqlServer9 => "[" + identifier + "]",
                DatabaseType.PostgreSql or DatabaseType.KingBase
                    or DatabaseType.Oracle or DatabaseType.DaMeng => "\"" + identifier + "\"",
                _ => "`" + identifier + "`"
            };
        }

        private static object ReadDatabaseValue(
            DbSession database,
            string fieldName,
            JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return DBNull.Value;
            if (ApiEngineBitColumns.Contains(fieldName))
                return (short)ReadStartupSwitch(token);
            return token.Type switch
            {
                JTokenType.Integer => ReadDatabaseInteger(token.Value<long>()),
                JTokenType.Float => token.Value<decimal>(),
                JTokenType.Boolean => token.Value<bool>() ? 1 : 0,
                JTokenType.Date => ReadDatabaseDateTime(database, token.Value<DateTime>()),
                JTokenType.Bytes => token.Value<byte[]>(),
                JTokenType.Array or JTokenType.Object => token.ToString(Formatting.None),
                _ => token.ToString()
            };
        }

        private static object ReadDatabaseInteger(long value)
        {
            return value >= int.MinValue && value <= int.MaxValue
                ? (object)(int)value
                : value;
        }

        private static DateTime ReadDatabaseDateTime(DbSession database, DateTime value)
        {
            if (database?.Db?.DbProvider?.DatabaseType != DatabaseType.PostgreSql)
                return value;
            if (value.Kind == DateTimeKind.Utc)
                return value;
            return value.Kind == DateTimeKind.Local
                ? value.ToUniversalTime()
                : DateTime.SpecifyKind(value, DateTimeKind.Local).ToUniversalTime();
        }

        private static string GetStartupDependencyContractError(JObject row, JObject source)
        {
            if (row == null) return "不存在";
            if (IsCreateIfMissingRuntimeDependency(source)) return string.Empty;
            if (ReadStartupSwitch(row["IsDeleted"]) == 1) return "处于软删除状态";
            if (string.IsNullOrWhiteSpace(row["ApiV8Code"]?.ToString()))
                return "ApiV8Code为空";
            if (ReadStartupSwitch(row["IsEnable"]) != ReadStartupSwitch(source?["IsEnable"]))
                return "IsEnable不一致";
            if (ReadStartupSwitch(row["StopHttp"]) != ReadStartupSwitch(source?["StopHttp"]))
                return "StopHttp不一致";
            if (ReadStartupSwitch(row["AllowAnonymous"])
                != ReadStartupSwitch(source["AllowAnonymous"])) return "AllowAnonymous不一致";
            if (!string.Equals(row["ApiAddress"]?.ToString(), source["ApiAddress"]?.ToString(), StringComparison.Ordinal))
                return "ApiAddress不一致";
            // 手动商城更新可能已高于当前后端基线。仅要求它仍保有恢复入口，禁止启动时降级。
            if (HasNewerManagedVersion(row, source))
            {
                var requiredRoutes = (source?["ApiRoutes"]?.ToString() ?? "").Split(';').Where(route => !string.IsNullOrWhiteSpace(route));
                var actualRoutes = (row["ApiRoutes"]?.ToString() ?? "").Split(';');
                return requiredRoutes.All(route => actualRoutes.Contains(route, StringComparer.OrdinalIgnoreCase))
                    ? string.Empty : "新版接口缺少必要兼容路由";
            }
            if (!string.Equals(
                NormalizeStartupDependencySource(row["ApiV8Code"]?.ToString()),
                NormalizeStartupDependencySource(source?["ApiV8Code"]?.ToString()),
                StringComparison.Ordinal))
            {
                return "ApiV8Code与包内Managed源码不一致";
            }
            if (!string.IsNullOrWhiteSpace(source?["Version"]?.ToString())
                && !string.Equals(
                    // SQL Server 的 CHAR/NCHAR 版本列会补尾部 U+0020 空格。
                    // 写回同一版本仍会补齐，逐字比较会让启动门禁永久失败、每次重启重复覆盖。
                    // 仅消除物理存储填充；空值、缺段或真正不同的版本仍必须按 Managed 包修复。
                    row.GetValue("Version", StringComparison.OrdinalIgnoreCase)?.ToString().TrimEnd(' '),
                    source["Version"]?.ToString(),
                    StringComparison.OrdinalIgnoreCase))
            {
                return "Version与包内Managed版本不一致：包版本="
                       + DescribeStartupDependencyVersion(source["Version"])
                       + "，数据库版本=" + DescribeStartupDependencyVersion(
                           row.GetValue("Version", StringComparison.OrdinalIgnoreCase));
            }
            if (source?["ApiRoutes"] != null
                && !string.Equals(
                    row["ApiRoutes"]?.ToString() ?? string.Empty,
                    source["ApiRoutes"]?.ToString() ?? string.Empty,
                    StringComparison.Ordinal))
            {
                return "ApiRoutes与包内Managed路由不一致";
            }
            return string.Empty;
        }

        private static bool HasNewerManagedVersion(JObject row, JObject source)
        {
            return System.Version.TryParse((row?["Version"]?.ToString() ?? "").Trim().TrimStart('v', 'V'), out var installed)
                && System.Version.TryParse((source?["Version"]?.ToString() ?? "").Trim().TrimStart('v', 'V'), out var bundled)
                && installed > bundled;
        }

        private static string DescribeStartupDependencyVersion(JToken value)
        {
            var text = value?.Type == JTokenType.Null ? null : value?.ToString();
            // 显示空值和不可见字符，限制异常字段长度，避免错误日志无限膨胀。
            var preview = text != null && text.Length > 80 ? text.Substring(0, 80) + "..." : text;
            return JsonConvert.SerializeObject(preview) + "（字符数=" + (text?.Length ?? 0) + "）";
        }

        private static string NormalizeStartupDependencySource(string source)
        {
            return (source ?? string.Empty).Replace("\r\n", "\n").Trim();
        }

        private static int ReadStartupSwitch(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return 0;
            if (token.Type == JTokenType.Boolean) return token.Value<bool>() ? 1 : 0;
            if (token.Type == JTokenType.Integer || token.Type == JTokenType.Float)
                return token.Value<double>() == 0 ? 0 : 1;
            if (token.Type == JTokenType.Bytes)
                return token.Value<byte[]>()?.Any(value => value != 0) == true ? 1 : 0;
            var text = token.ToString().Trim();
            if (bool.TryParse(text, out var boolean)) return boolean ? 1 : 0;
            if (long.TryParse(text, out var number)) return number == 0 ? 0 : 1;
            try
            {
                var bytes = Convert.FromBase64String(text);
                return bytes.Any(value => value != 0) ? 1 : 0;
            }
            catch
            {
                return 0;
            }
        }

        private static async Task InvalidateStartupDependencyCacheAsync(
            string osClient,
            JObject row)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            foreach (var value in ApiEngineRouteAliases.GetCacheAliases(row))
            {
                await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{value}")
                    .ConfigureAwait(false);
                var lower = value.ToLowerInvariant();
                if (!string.Equals(value, lower, StringComparison.Ordinal))
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{lower}")
                        .ConfigureAwait(false);
            }
        }

        private static Task<Dictionary<string, string>> LoadUpgradeResourcesAsync() => Task.FromResult(LoadBundledResources());

        private static void ValidateResourceContent(string name, string content)
        {
            if (string.IsNullOrWhiteSpace(content)) throw new InvalidOperationException("启动资源为空：" + name);
            if (name == ImportPackageResourceName)
            {
                if (!content.Contains("PACKAGE_MANAGED_OVERWRITE_V2") || !content.Contains("app.microi.bootstrap.json"))
                    throw new InvalidOperationException("启动导入器缺少覆盖安装及恢复包可信边界。");
                return;
            }
            var package = JObject.Parse(content);
            if (name != BootstrapPackageResourceName || package["PackageInfo"]?["AppId"]?.ToString() != "app.microi.bootstrap"
                || !HasPackagedMarketplaceRuntime(package))
                throw new InvalidOperationException("启动恢复包身份或商城运行资产无效。");
        }

        public static Task<bool> NeedRefreshAsync(string osClient)
        {
            if (IsOfficialSourceTenant(osClient)) return Task.FromResult(false);
            var client = OsClient.GetClient(osClient);
            return Task.FromResult(!StartupDependenciesReady(client, out _) || GetInstalledMarketplaceRuntimeRepairReason(client) != null);
        }

        private static JObject ReadMarketplaceService(DbSession database)
        {
            var row = database.FromSql($"SELECT * FROM {QuoteIdentifier(database, "sys_microiservice")} WHERE {QuoteIdentifier(database, "MsKey")}=@p0 AND ({QuoteIdentifier(database, "IsDeleted")}=0 OR {QuoteIdentifier(database, "IsDeleted")} IS NULL)")
                .AddInParameter("p0", PlatformMicroServiceKey).First<dynamic>();
            return row == null ? null : JObject.FromObject((object)row);
        }

        internal static string GetInstalledMarketplaceRuntimeRepairReason(OsClientSecret client)
        {
            foreach (var table in new[] { "sys_menu", "sys_microiservice", "sys_microiservice_page" })
                if (!client.Db.TableExists(table)) return "商城运行表缺失：" + table;
            try
            {
                var menuRow = client.Db.FromSql($"SELECT * FROM {QuoteIdentifier(client.Db, "sys_menu")} WHERE {QuoteIdentifier(client.Db, "ModuleEngineKey")}=@p0 AND ({QuoteIdentifier(client.Db, "IsDeleted")}=0 OR {QuoteIdentifier(client.Db, "IsDeleted")} IS NULL)")
                    .AddInParameter("p0", "sys_microistore").First<dynamic>();
                var menu = menuRow == null ? null : JObject.FromObject((object)menuRow);
                var service = ReadMarketplaceService(client.Db);
                var pageRow = client.Db.FromSql($"SELECT * FROM {QuoteIdentifier(client.Db, "sys_microiservice_page")} WHERE {QuoteIdentifier(client.Db, "MicroServiceId")}=@p0 AND {QuoteIdentifier(client.Db, "RoutePath")}=@p1 AND ({QuoteIdentifier(client.Db, "IsDeleted")}=0 OR {QuoteIdentifier(client.Db, "IsDeleted")} IS NULL)")
                    .AddInParameter("p0", service?["Id"]?.ToString()).AddInParameter("p1", MarketplaceRoutePath).First<dynamic>();
                return GetMarketplaceRuntimeRepairReason(menu, service, pageRow == null ? null : JObject.FromObject((object)pageRow));
            }
            catch (Exception ex) { return "商城运行资源尚未可读：" + ex.GetType().Name; }
        }

        private static string GetMarketplaceRuntimeRepairReason(
            JObject menu,
            JObject service,
            JObject page)
        {
            if (menu == null) return "缺少应用商城菜单";
            if (!string.Equals(menu["OpenType"]?.ToString(), "MicroService", StringComparison.OrdinalIgnoreCase)
                || menu.Value<int?>("IsMicroiService") != 1
                || !string.Equals(menu["ComponentPath"]?.ToString(), MicroAppHostComponentPath, StringComparison.OrdinalIgnoreCase))
            {
                return "应用商城菜单尚未切换到微服务宿主";
            }

            var menuServiceId = menu["MicroServiceId"]?.ToString();
            var menuPageId = menu["MicroServicePageId"]?.ToString();
            if (menuServiceId.DosIsNullOrWhiteSpace() || menuPageId.DosIsNullOrWhiteSpace()
                || !string.Equals(menu["MicroServiceRoutePath"]?.ToString(), MarketplaceRoutePath, StringComparison.OrdinalIgnoreCase))
            {
                return "应用商城菜单缺少 microi-platform-service 页面绑定";
            }

            if (service == null) return "缺少应用商城平台微服务运行记录";
            var serviceId = service["Id"]?.ToString();
            if (!string.Equals(serviceId, menuServiceId, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service["MsKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase))
            {
                return "应用商城菜单绑定的平台微服务不匹配";
            }
            if (service.Value<int?>("IsEnable") != 1)
            {
                return "应用商城平台微服务已停用";
            }
            if (!string.Equals(service["Runtime"]?.ToString(), "micro-app", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service["StorageMode"]?.ToString(), "db", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service["MsUrl"]?.ToString(), "db", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(NormalizeRuntimeAssetPath(service["EntryPath"]?.ToString()), "index.html", StringComparison.OrdinalIgnoreCase)
                || string.IsNullOrWhiteSpace(service["BuildVersion"]?.ToString()))
            {
                return "应用商城平台微服务运行配置不完整";
            }
            if (!HasDatabaseRuntimeEntryAsset(service))
            {
                return "应用商城平台微服务缺少数据库内联入口资产";
            }

            if (page == null) return "缺少应用商城 /marketplace 页面";
            if (!string.Equals(page["Id"]?.ToString(), menuPageId, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(page["MicroServiceId"]?.ToString(), serviceId, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(page["MicroServiceKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(page["RoutePath"]?.ToString(), MarketplaceRoutePath, StringComparison.OrdinalIgnoreCase)
                || page.Value<int?>("IsEnable") != 1)
            {
                return "应用商城 /marketplace 页面绑定不完整或已停用";
            }

            return null;
        }

        private static bool HasDatabaseRuntimeEntryAsset(JObject service)
        {
            if (service == null) return false;
            try
            {
                var assetsToken = service.GetValue("AssetsJson", StringComparison.OrdinalIgnoreCase);
                var assets = assetsToken as JArray ?? JArray.Parse(assetsToken?.ToString() ?? string.Empty);
                if (assets.Count == 0 || assets.Count > 256) return false;
                var hasEntry = false;
                long totalSize = 0;
                var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var asset in assets.Children<JObject>())
                {
                    var path = NormalizeRuntimeAssetPath(asset["Path"]?.ToString() ?? asset["FileName"]?.ToString());
                    if (string.IsNullOrWhiteSpace(path) || path.Contains("..") || !paths.Add(path)) return false;
                    var bytes = Convert.FromBase64String(asset["ContentBase64"]?.ToString()
                        ?? asset["FileByteBase64"]?.ToString() ?? asset["Base64"]?.ToString() ?? "");
                    totalSize += bytes.Length;
                    if (totalSize > 5 * 1024 * 1024 || bytes.Length != asset["Size"]?.Value<long>()) return false;
                    using var digest = System.Security.Cryptography.SHA256.Create();
                    var hash = BitConverter.ToString(digest.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
                    // The installer persists verified runtime digests as Hash;
                    // package manifests may retain the Sha256 spelling.
                    var declaredHash = asset["Sha256"]?.ToString() ?? asset["Hash"]?.ToString();
                    if (!string.Equals(hash, declaredHash, StringComparison.OrdinalIgnoreCase)) return false;
                    if (string.Equals(path, "index.html", StringComparison.OrdinalIgnoreCase)) hasEntry = bytes.Length > 0;
                }
                return hasEntry;
            }
            catch
            {
                return false;
            }
        }

        private static string NormalizeRuntimeAssetPath(string value)
        {
            var normalized = (value ?? string.Empty)
                .Replace('\\', '/')
                .Trim()
                .TrimStart('/');
            while (normalized.StartsWith("./", StringComparison.Ordinal))
            {
                normalized = normalized.Substring(2);
            }
            return normalized;
        }

        private static bool HasPackagedMarketplaceRuntime(JObject package)
        {
            if (package == null) return false;

            var menu = package["SysMenus"]?.Children<JObject>().FirstOrDefault(item =>
                string.Equals(item["Id"]?.ToString(), AppStoreMenuId, StringComparison.OrdinalIgnoreCase)
                || string.Equals(item["ModuleEngineKey"]?.ToString(), "sys_microistore", StringComparison.Ordinal));
            if (menu == null
                || !string.Equals(menu["OpenType"]?.ToString(), "MicroService", StringComparison.OrdinalIgnoreCase)
                || menu.Value<int?>("IsMicroiService") != 1
                || !string.Equals(menu["ComponentPath"]?.ToString(), MicroAppHostComponentPath, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(menu["MicroServiceKey"]?.ToString() ?? menu["MsKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(menu["MicroServiceRoutePath"]?.ToString(), MarketplaceRoutePath, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var bundle = package["ApplicationBundles"]?.Children<JObject>().FirstOrDefault(item =>
                string.Equals(
                    item["Application"]?["AppKey"]?.ToString()
                    ?? item["Application"]?["AppId"]?.ToString()
                    ?? item["MicroService"]?["MsKey"]?.ToString(),
                    PlatformMicroServiceKey,
                    StringComparison.OrdinalIgnoreCase));
            var application = bundle?["Application"] as JObject;
            var service = bundle?["MicroService"] as JObject;
            var buildAssets = bundle?["BuildAssets"] as JArray;
            var routes = bundle?["Routes"] as JArray;
            if (bundle == null
                || !string.Equals(bundle["ApplicationType"]?.ToString(), "MicroService", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(application?["AppKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service?["MsKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase)
                || (service?.Value<int?>("IsEnable") ?? 0) != 1
                || !string.Equals(service?["Runtime"]?.ToString(), "micro-app", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service?["StorageMode"]?.ToString(), "db", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(NormalizeRuntimeAssetPath(service?["EntryPath"]?.ToString()), "index.html", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(bundle["AssetStoragePolicy"]?["Source"]?.ToString(), "NotIncluded", StringComparison.Ordinal)
                || !string.Equals(bundle["AssetStoragePolicy"]?["Build"]?.ToString(), "DatabaseOnly", StringComparison.Ordinal)
                || (buildAssets?.Count ?? 0) < 1)
            {
                return false;
            }

            var entryAsset = buildAssets.Children<JObject>().FirstOrDefault(asset =>
                string.Equals(
                    NormalizeRuntimeAssetPath(asset["Path"]?.ToString() ?? asset["FileName"]?.ToString()),
                    "index.html",
                    StringComparison.OrdinalIgnoreCase));
            if (entryAsset == null
                || string.IsNullOrWhiteSpace(
                    entryAsset["FileByteBase64"]?.ToString()
                    ?? entryAsset["ContentBase64"]?.ToString()
                    ?? entryAsset["Base64"]?.ToString())
                || string.IsNullOrWhiteSpace(entryAsset["Sha256"]?.ToString()))
            {
                return false;
            }

            return routes?.Children<JObject>().Any(route =>
                string.Equals(route["RoutePath"]?.ToString(), MarketplaceRoutePath, StringComparison.OrdinalIgnoreCase)
                && route.Value<int?>("IsEnable") == 1
                && !string.IsNullOrWhiteSpace(route["Id"]?.ToString())
                && string.Equals(NormalizeRuntimeAssetPath(route["EntryPath"]?.ToString()), "index.html", StringComparison.OrdinalIgnoreCase)) == true;
        }

        private static async Task InstallUpgradePackage(string osClient, List<string> msgs, string resourceName, string packageName, IReadOnlyDictionary<string, string> resources)
        {
            var packageContent = NormalizePackageExecutionLimits(resources[resourceName]);
            var selected = JObject.Parse(packageContent);
            foreach (var engine in selected["SysApiEngines"]?.Children<JObject>().ToList() ?? new List<JObject>())
            {
                var existing = ReadStartupDependencyEngine(OsClient.GetClient(osClient).Db, engine["ApiEngineKey"]?.ToString(), true);
                if (HasNewerManagedVersion(existing, engine) && string.IsNullOrEmpty(GetStartupDependencyContractError(existing, engine)))
                {
                    (selected["ResourcePolicies"]?["ApiEngines"] as JObject)?.Property(engine["ApiEngineKey"]?.ToString())?.Remove();
                    engine.Remove();
                }
            }
            var runtimeClient = OsClient.GetClient(osClient);
            if (runtimeClient.Db.TableExists("sys_microiservice"))
            {
                var installedService = ReadMarketplaceService(runtimeClient.Db);
                var bundledVersion = selected["ApplicationBundles"]?.FirstOrDefault()?["VersionNo"]?.ToString();
                if (System.Version.TryParse((installedService?["BuildVersion"]?.ToString() ?? "").TrimStart('v', 'V'), out var installedBuild)
                    && System.Version.TryParse((bundledVersion ?? "").TrimStart('v', 'V'), out var bundledBuild)
                    && installedBuild > bundledBuild && GetInstalledMarketplaceRuntimeRepairReason(runtimeClient) == null)
                {
                    // 已手动更新的完整商城运行资产与菜单保留；自动恢复不能向后覆盖新版本。
                    selected["ApplicationBundles"] = new JArray();
                    selected["SysMenus"] = new JArray();
                }
            }
            packageContent = selected.ToString(Formatting.None);
            if (IsPackageVersionAlreadyInstalled(osClient, packageContent, out var installedVersion))
            {
                UpgradeProgress.WriteLine($"Microi：【基础应用升级】【{osClient}】{packageName}已安装同版本[{installedVersion}]，执行覆盖式重放以修复资源漂移。");
            }
            UpgradeProgress.WriteLine($"Microi：【基础应用升级】开始导入{packageName}：{resourceName}");
            // Upgrade13 is the only caller allowed to mark a package as the
            // validated embedded official baseline. The authorization lives in
            // an AsyncLocal host scope bound to this fixed importer and tenant;
            // V8.Param alone cannot forge it. The importer consumes it once and
            // may then restore Platform/Managed code while still preserving every
            // Tenant/CreateIfMissing hook.
            object installResult;
            installResult = await EmbeddedUpgradePackageInstaller.RunAsync(
                packageContent,
                async stage =>
                {
                    using (V8TrustedExecutionContext.EnterManagedProtocol("import-microi-store-package", osClient))
                    {
                        return (object)await MicroiEngine.ApiEngine.RunAsync("import-microi-store-package", new
                        {
                            OsClient = osClient,
                            Package = packageContent,
                            TrustedEmbeddedOfficialPackage = true,
                            EmbeddedOfficialPackageResourceName = resourceName,
                            EmbeddedUpgradeStage = stage
                        });
                    }
                },
                job => ScheduleJobService.SaveAsync(osClient, job),
                UpgradeExecutionLeaseContext.ConfirmOwnership);
            var installFailure = GetInstallFailureMessage(installResult);
            if (installFailure != null)
            {
                msgs.Add($"{packageName}导入失败：{installFailure}");
                return;
            }

            UpgradeProgress.WriteLine($"Microi：【基础应用升级】{packageName}导入完成。");
        }

        private static bool IsPackageVersionAlreadyInstalled(
            string osClient,
            string packageContent,
            out string installedVersion)
        {
            installedVersion = string.Empty;
            try
            {
                var packageInfo = JObject.Parse(packageContent)["PackageInfo"] as JObject;
                var packageName = packageInfo?["Name"]?.ToString();
                var incomingVersion = packageInfo?["Version"]?.ToString();
                if (string.IsNullOrWhiteSpace(packageName) || string.IsNullOrWhiteSpace(incomingVersion))
                    return false;

                var client = OsClient.GetClient(osClient);
                var db = client?.Db;
                if (db == null || !db.TableExists("sys_microistoreversion")) return false;

                var identityColumns = new[] { "AppName", "PackageName" }
                    .Where(column => db.ColumnExists("sys_microistoreversion", column))
                    .ToArray();
                var versionColumns = new[] { "AppVersionInstall", "PackageVersion", "AppVersion" }
                    .Where(column => db.ColumnExists("sys_microistoreversion", column))
                    .ToArray();
                if (identityColumns.Length == 0 || versionColumns.Length == 0) return false;

                var selectColumns = versionColumns.ToList();
                var hasStatus = db.ColumnExists("sys_microistoreversion", "InstallStatus");
                if (hasStatus) selectColumns.Add("InstallStatus");
                var where = "(" + string.Join(" OR ", identityColumns.Select(column => column + "=@p0")) + ")";
                if (db.ColumnExists("sys_microistoreversion", "IsDeleted"))
                    where += " AND (IsDeleted<>1 OR IsDeleted IS NULL)";
                var orderBy = db.ColumnExists("sys_microistoreversion", "InstallTime")
                    ? " ORDER BY InstallTime DESC"
                    : string.Empty;
                var row = db.FromSql(
                        $"SELECT {string.Join(",", selectColumns)} FROM sys_microistoreversion WHERE {where}{orderBy}")
                    .AddInParameter("p0", packageName)
                    .First<dynamic>();
                if (row == null) return false;

                installedVersion = ReadInstalledPackageVersionRow(
                    (object)row,
                    versionColumns,
                    hasStatus,
                    out var installedStatus);
                if (!installedStatus)
                    return false;
                return PackageVersionsEquivalent(installedVersion, incomingVersion);
            }
            catch (Exception ex)
            {
                // 老库可能尚无版本表或只有部分历史字段。版本读取失败只能降级为正常
                // 幂等导入，不能阻断升级，也不能把未知状态误判成“已安装”。
                UpgradeProgress.WriteLine($"Microi：【基础应用升级】【{osClient}】读取应用包安装版本失败，将执行幂等导入：{ex.Message}");
                installedVersion = string.Empty;
                return false;
            }
        }

        internal static string ReadInstalledPackageVersionRow(
            object row,
            IReadOnlyCollection<string> versionColumns,
            bool hasStatus,
            out bool installedStatus)
        {
            installedStatus = false;
            if (row == null) return string.Empty;

            // First<dynamic>() makes the local variable dynamic. Passing that value
            // directly to JObject.FromObject would make the returned expression dynamic
            // too, and extension methods in the following LINQ predicate would then fail
            // at runtime. Keep this boundary strongly typed for every database provider.
            JObject model = JObject.FromObject(row);
            installedStatus = !hasStatus
                || string.Equals(
                    model["InstallStatus"]?.ToString(),
                    "Installed",
                    StringComparison.OrdinalIgnoreCase);
            if (!installedStatus) return string.Empty;

            return versionColumns
                .Select(column => model[column]?.ToString())
                .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
        }

        internal static bool PackageVersionsEquivalent(string left, string right)
        {
            static bool TryNormalize(string value, out System.Version version)
            {
                version = null;
                var text = (value ?? string.Empty).Trim().TrimStart('v', 'V');
                if (!System.Version.TryParse(text, out var parsed)) return false;
                version = new System.Version(
                    Math.Max(0, parsed.Major),
                    Math.Max(0, parsed.Minor),
                    Math.Max(0, parsed.Build),
                    Math.Max(0, parsed.Revision));
                return true;
            }

            return TryNormalize(left, out var leftVersion)
                && TryNormalize(right, out var rightVersion)
                && leftVersion.Equals(rightVersion);
        }

        internal static string GetInstallFailureMessage(object result)
        {
            // V8 may return only { Code, Msg }. Optional Data must never mask the
            // original failure with a second dynamic member-access exception.
            if (result == null) return "导入器未返回结果。";
            try
            {
                var model = result as JObject ?? JObject.FromObject(result);
                if (int.TryParse(model["Code"]?.ToString(), out var code) && code == 1)
                    return null;
                return (model["Msg"]?.ToString() ?? "导入器未返回有效的成功状态。")
                    + FormatInstallFailureDetails(model["Data"]);
            }
            catch (Exception ex)
            {
                return $"导入器返回值无法解析（{ex.GetType().Name}）。";
            }
        }

        private static string FormatInstallFailureDetails(object data)
        {
            try
            {
                if (data == null) return string.Empty;
                var token = data as JToken ?? JToken.FromObject(data);
                var detail = (token as JObject)?.Properties().FirstOrDefault(property =>
                    property.Name.StartsWith("失败详情", StringComparison.Ordinal));
                if (detail?.Value == null)
                {
                    // 只附加导入器的资源定位和调用栈，不记录 Param、用户信息或包正文。
                    var resource = token["失败资源"]?.ToString();
                    var stack = token["错误堆栈"]?.ToString();
                    if (string.IsNullOrWhiteSpace(resource) && string.IsNullOrWhiteSpace(stack)) return string.Empty;
                    var diagnostic = $"；失败资源={resource}；调用栈={stack}";
                    return diagnostic.Length > 2000 ? diagnostic.Substring(0, 2000) : diagnostic;
                }

                // 只记录导入器明确返回的失败列表，不把整份应用包或其它统计信息写入日志。
                var detailJson = detail.Value.ToString(Formatting.None);
                const int maxLogLength = 4000;
                if (detailJson.Length > maxLogLength)
                {
                    detailJson = detailJson.Substring(0, maxLogLength) + "...(已截断)";
                }
                return $"；{detail.Name}：{detailJson}";
            }
            catch
            {
                // 诊断信息不得覆盖原始失败，也不能让自动升级因序列化再次异常。
                return string.Empty;
            }
        }

        private static string NormalizePackageExecutionLimits(string packageContent)
        {
            if (string.IsNullOrWhiteSpace(packageContent)) return packageContent;

            var package = JObject.Parse(packageContent);
            var changed = false;
            foreach (var engine in package["SysApiEngines"]?.Children<JObject>() ?? Enumerable.Empty<JObject>())
            {
                var persistedLimit = engine["LimitRecursion"]?.Value<int>() ?? 0;
                if (persistedLimit <= PrivilegedEngineLimitRecursion) continue;
                engine["LimitRecursion"] = PrivilegedEngineLimitRecursion;
                changed = true;
            }
            return changed ? package.ToString(Formatting.None) : packageContent;
        }

        public async Task<List<string>> Run(string osClient)
        {
            var errors = new List<string>();
            if (IsOfficialSourceTenant(osClient)) return errors;
            UpgradeExecutionLeaseContext.ConfirmOwnership();
            var client = OsClient.GetClient(osClient);
            // 先恢复直接物理投影和导入器，再补元数据；旧库不依赖完整业务包才能进入商城。
            var dependencies = await EnsureStartupDependenciesUnderLeaseAsync(client).ConfigureAwait(false);
            if (dependencies.Code != 1) { errors.Add(dependencies.Msg); return errors; }
            await EnsureMarketplaceMetadataBootstrapUnderLeaseAsync(client).ConfigureAwait(false);
            await InstallUpgradePackage(osClient, errors, BootstrapPackageResourceName, "启动与商城恢复基础包", LoadBundledResources()).ConfigureAwait(false);
            if (errors.Count > 0) return errors;
            dependencies = await EnsureStartupDependenciesUnderLeaseAsync(client).ConfigureAwait(false);
            if (dependencies.Code != 1) errors.Add(dependencies.Msg);
            var marketplaceError = GetInstalledMarketplaceRuntimeRepairReason(client);
            if (marketplaceError != null) errors.Add("商城恢复后强回读失败：" + marketplaceError);
            return errors;
        }
    }
}
