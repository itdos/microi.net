using System;
using System.Collections.Generic;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Reflection;
using System.Dynamic;
using Jint;
using System.Text;
using System.Security.Cryptography;
using System.Linq;
using System.IO;
using System.IO.Compression;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// V8引擎内置方法/函数
    /// </summary>
    public partial class V8Method : V8EngineMethodExtend, IV8Method
    {
        /// <summary>
        /// 返回服务端唯一的表直连授权策略。这里只暴露表名、授权模式和允许操作，
        /// 不承载角色保存逻辑；低代码 sys_role 事务事件据此完成最终校验。
        /// </summary>
        public DosResult GetDirectTableGrantPolicies()
        {
            return new DosResult(1, PlatformResourceSecurity.DirectTableGrantPolicies);
        }

        /// <summary>
        /// 使用只存在于可信宿主的租户密钥加密接口引擎私有数据。派生用途同时绑定
        /// 当前 OsClient 与 ApiEngineKey，接口引擎拿不到密钥，也不能解密其它接口
        /// 引擎或其它租户生成的密文。
        /// </summary>
        public string ProtectApiEngineSecret(string plainText)
        {
            if (plainText == null) return null;
            if (plainText.Length > 256 * 1024)
                throw new ArgumentException("接口引擎私有密文原文不能超过 256KB。", nameof(plainText));
            var context = RequireApiEngineSecretContext();
            return TenantSystemSettingsSecurity.ProtectSecret(
                context.OsClient,
                BuildApiEngineSecretPurpose(context.ApiEngineKey),
                plainText);
        }

        /// <summary>
        /// 解密当前接口引擎自己的租户私有密文。调用方不能传 OsClient、Key 或
        /// Purpose，从协议上避免可编辑 V8 借此读取其它安全域的 Secret。
        /// </summary>
        public string UnprotectApiEngineSecret(string cipherText)
        {
            if (string.IsNullOrWhiteSpace(cipherText)) return string.Empty;
            if (cipherText.Length > 512 * 1024)
                throw new ArgumentException("接口引擎私有密文不能超过 512KB。", nameof(cipherText));
            var context = RequireApiEngineSecretContext();
            try
            {
                return TenantSystemSettingsSecurity.UnprotectSecret(
                    context.OsClient,
                    BuildApiEngineSecretPurpose(context.ApiEngineKey),
                    cipherText);
            }
            catch when (string.Equals(
                context.ApiEngineKey,
                "mci_file_remote_connection",
                StringComparison.OrdinalIgnoreCase))
            {
                // v1.0.2 文件柜引擎曾直接使用租户 AuthSecret 派生 AES 密钥。
                // 仅为这个固定 Managed 引擎保留一次兼容读取；新写入统一使用上面的
                // 引擎作用域密文，且 AuthSecret 本身始终不进入 V8。
                var client = OsClientExtend.GetClient(context.OsClient)
                             ?? throw new InvalidOperationException("当前租户不存在，无法迁移历史文件柜密文。");
                var legacySecret = client.OsClientModel?["AuthSecret"]?.Val<string>();
                if (string.IsNullOrWhiteSpace(legacySecret)) throw;
                return EncryptHelper.AESDecrypt(
                    cipherText,
                    legacySecret + ":mci-file-remote-connection:v1");
            }
        }

        private static V8TenantContext.V8TenantInfo RequireApiEngineSecretContext()
        {
            var context = V8TenantContext.Current;
            if (context == null
                || string.IsNullOrWhiteSpace(context.OsClient)
                || string.IsNullOrWhiteSpace(context.ApiEngineKey))
            {
                throw new InvalidOperationException(
                    "ProtectApiEngineSecret/UnprotectApiEngineSecret 只能在接口引擎上下文中调用。");
            }
            return context;
        }

        private static string BuildApiEngineSecretPurpose(string apiEngineKey)
        {
            using var sha256 = SHA256.Create();
            var normalizedKey = (apiEngineKey ?? string.Empty).Trim().ToLowerInvariant();
            var digest = sha256.ComputeHash(Encoding.UTF8.GetBytes(normalizedKey));
            return "V8.ApiEngineSecret." + string.Concat(
                digest.Select(value => value.ToString("x2", CultureInfo.InvariantCulture)));
        }

        protected override IDisposable BeginTrustedHostAllocationScope()
        {
            return MicroiV8ExecutionScope.PauseTrustedHostMemory();
        }

        private static DosResult RequireMasterTenantProvisioningAccess()
        {
            var context = V8TenantContext.Current;
            if (context != null && context.IsMaster)
            {
                return null;
            }

            Console.WriteLine(
                $"Microi：【安全】已拒绝非主租户调用租户开通原语。OsClient=[{context?.OsClient ?? "-"}]，" +
                $"ApiEngineKey=[{context?.ApiEngineKey ?? "-"}]。");
            return new DosResult(0, null, "该租户开通能力仅允许主租户接口引擎调用。");
        }

        private static DosResult RequireMasterTenantProvisioningAdminAccess()
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                // Durable background tasks do not have an HTTP request/token. Their
                // identity is a server-authenticated snapshot stored outside V8.Param
                // and restored by ApiEngine.RunBackgroundAsync. HTTP execution keeps
                // the original token path, so this does not weaken the public boundary.
                var currentUser = V8TrustedExecutionContext.CurrentUser;
                if (currentUser == null)
                {
                    var currentToken = DiyToken.GetCurrentToken().GetAwaiter().GetResult();
                    currentUser = currentToken?.CurrentUser;
                }
                if (currentUser == null)
                    return new DosResult(1001, null, "登录身份已过期。");
                if (currentUser["Level"].Val<int>() < DiyCommon.MaxRoleLevel)
                    return new DosResult(0, null, "只有主租户超级管理员才能创建 SaaS 租户。");
                return null;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "校验主租户超级管理员身份失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 重新加载指定 OsClient 的 SaaS 引擎配置。
        /// 适用场景：通过 V8 代码向 sys_osclients 表新增/更新租户后，调用此方法使配置立即生效。
        ///
        /// 用法：
        /// V8.Method.ReloadOsClient('new_tenant');
        /// </summary>
        /// <param name="osClient">要重新加载的 OsClient 标识</param>
        /// <param name="_trans">可选的数据库事务对象</param>
        /// <returns>操作结果（Code=1 成功）</returns>
        public DosResult ReloadOsClient(string osClient, DbTrans _trans = null)
        {
            if (V8TenantContext.IsActive && !V8TenantContext.Current.IsMaster)
            {
                osClient = V8TenantContext.EnforceOsClient(osClient);
            }

            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "OsClient不能为空！");
            }

            // SubmitAfterServerV8 still runs inside the database transaction.
            // Publishing runtime/Redis SaaS state here would expose uncommitted
            // values and a later rollback could leave nodes with different config
            // (including different JWT signing keys). Always reread committed data
            // from the durable source after the framework-owned transaction commits.
            var currentTrans = _trans ?? V8TenantContext.CurrentDbTrans;
            if (currentTrans != null && !currentTrans.IsCommitOrRollback)
            {
                var targetOsClient = osClient;
                currentTrans.RegisterAfterCommit(() =>
                {
                    var reloadResult = MicroiEngine.GetService<IOsClientRuntime>()
                        .ReloadSingleOsClient(targetOsClient);
                    if (reloadResult.Code != 1)
                    {
                        Console.WriteLine(
                            $"Microi：【Warning】租户[{targetOsClient}]提交后刷新 SaaS 运行配置失败：{reloadResult.Msg}");
                    }
                });
                return new DosResult(
                    1,
                    new { OsClient = osClient, ScheduledAfterCommit = true },
                    "SaaS运行配置刷新已登记，将在事务提交成功后生效。");
            }

            return MicroiEngine.GetService<IOsClientRuntime>().ReloadSingleOsClient(osClient);
        }

        /// <summary>
        /// 刷新 V8.Dbs 扩展数据库列表。表单提交后事件仍在事务中，因此此方法
        /// 会把 Redis 版本递增注册到真实事务的提交后回调；回滚时不会误刷新。
        /// </summary>
        public DosResult RefreshExtensionDatabases(string osClient = null)
        {
            try
            {
                var contextOsClient = V8TenantContext.IsActive
                    ? V8TenantContext.Current.OsClient
                    : DiyToken.GetCurrentOsClient();
                if (contextOsClient.DosIsNullOrWhiteSpace()) contextOsClient = osClient;
                if (V8TenantContext.IsActive)
                    osClient = V8TenantContext.EnforceOsClient(osClient.DosIsNullOrWhiteSpace() ? contextOsClient : osClient);
                if (osClient.DosIsNullOrWhiteSpace()) osClient = contextOsClient;
                if (osClient.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "OsClient 不能为空");

                var currentTrans = V8TenantContext.CurrentDbTrans;
                if (currentTrans != null && !currentTrans.IsCommitOrRollback)
                {
                    var targetOsClient = osClient;
                    currentTrans.RegisterAfterCommit(() =>
                    {
                        var refreshResult = OsClientExtend.InvalidateExtensionDatabaseCache(targetOsClient);
                        if (refreshResult.Code != 1)
                        {
                            Console.WriteLine(
                                $"Microi：【Warning】租户[{targetOsClient}]扩展数据库提交后刷新失败：{refreshResult.Msg}");
                        }
                    });
                    return new DosResult(1, new { OsClient = osClient, ScheduledAfterCommit = true },
                        "扩展数据库缓存刷新已登记，将在事务提交成功后生效");
                }

                return OsClientExtend.InvalidateExtensionDatabaseCache(osClient);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "刷新扩展数据库缓存失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 通过接口引擎开通 SaaS 租户。
        /// 业务流程仍由接口引擎编排，C# 只提供数据库创建、空库导入和运行缓存刷新等底层能力。
        /// </summary>
        public DosResult ProvisionTenant(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                using var allocationScope = BeginTrustedHostAllocationScope();
                var json = ToJObject(param);
                var tenantKey = GetJsonString(json, "TenantKey", "OsClient", "Key");
                var systemName = GetJsonString(json, "SystemName", "ClientName", "Name");
                var userId = GetJsonString(json, "UserId", "OwnerUserId");
                var phone = GetJsonString(json, "Phone", "OwnerPhone");
                var userName = GetJsonString(json, "UserName", "Name", "Account");
                var encryptedPwd = GetJsonString(json, "EncryptedPwd", "Pwd", "Password");
                var aiApiKey = GetJsonString(json, "AiApiKey", "ApiKey", "RelayApiKey");
                string backgroundTaskId = null;
                if (V8TrustedExecutionContext.CurrentBackgroundTask != null
                    || !GetJsonString(json, "_BackgroundTaskId", "BackgroundTaskId")
                        .DosIsNullOrWhiteSpace())
                {
                    var taskDenied = ResolveCurrentManagedBackgroundTask(
                        json,
                        "official_create_tenant_worker",
                        out var taskContext);
                    if (taskDenied != null) return taskDenied;
                    backgroundTaskId = taskContext.TaskId;
                }
                return new TenantProvisioningService()
                    .ProvisionTenantAsync(
                        tenantKey,
                        systemName,
                        userId,
                        phone,
                        userName,
                        encryptedPwd,
                        aiApiKey,
                        backgroundTaskId)
                    .GetAwaiter()
                    .GetResult();
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"开通租户失败：{ex.Message}");
            }
        }

        /// <summary>
        /// 主租户超级管理员原子创建 SaaS 租户。数据库连接串永不返回 V8；
        /// 可选的数据库 ZIP 必须来自当前主租户 HDFS 私有 file 目录。
        /// </summary>
        public DosResult ProvisionAdminTenant(object param)
        {
            const string createEngineKey = "admin_create_empty_saas_tenant";
            var denied = ResolveTrustedManagedCurrentUser(
                createEngineKey,
                true,
                DiyCommon.MaxRoleLevel,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;
            if (!string.Equals(osClient, OsClientDefault.OsClient,
                    StringComparison.OrdinalIgnoreCase))
                return new DosResult(1002, null, "仅主租户允许创建 SaaS 租户。");
            if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                    osClient, currentUser))
                return new DosResult(0, null, "当前账号已不再是有效的平台超级管理员。");
            try
            {
                using var allocationScope = BeginTrustedHostAllocationScope();
                var json = ToJObject(param);
                var taskDenied = ResolveCurrentManagedBackgroundTask(
                    json,
                    createEngineKey,
                    out var taskContext);
                if (taskDenied != null) return taskDenied;
                return new TenantProvisioningService()
                    .ProvisionAdminTenantAsync(new AdminTenantProvisioningRequest
                    {
                        TenantKey = GetJsonString(json, "TenantKey", "OsClient", "Key"),
                        SystemName = GetJsonString(json, "SystemName", "ClientName", "Name"),
                        OwnerPhone = GetJsonString(json, "OwnerPhone", "Phone"),
                        UserName = GetJsonString(json, "UserName", "AdminName"),
                        EncryptedPwd = GetJsonString(json, "EncryptedPwd", "Pwd"),
                        OsClientType = GetJsonString(json, "OsClientType"),
                        OsClientNetwork = GetJsonString(json, "OsClientNetwork"),
                        DomainName = GetJsonString(json, "DomainName", "Domain"),
                        DatabaseZipPath = GetJsonString(json, "DatabaseZipPath", "SqlZipPath"),
                        DatabaseZipName = GetJsonString(json, "DatabaseZipName", "SqlZipName"),
                        BackgroundTaskId = taskContext.TaskId
                    })
                    .GetAwaiter()
                    .GetResult();
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "创建 SaaS 租户失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 仅供官方 Managed 后台工作器对精确选中的已启用子租户执行幂等数据库升级。
        /// 连接串来自权威 sys_osclients，V8 只传租户身份投影。
        /// </summary>
        public DosResult UpgradeAdminTenantDatabase(object param)
        {
            const string upgradeEngineKey = "admin_upgrade_saas_tenant_database";
            var denied = ResolveTrustedManagedCurrentUser(
                upgradeEngineKey,
                true,
                DiyCommon.MaxRoleLevel,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;
            if (!string.Equals(osClient, OsClientDefault.OsClient,
                    StringComparison.OrdinalIgnoreCase))
                return new DosResult(1002, null, "仅主租户允许升级子租户数据库。");
            if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                    osClient, currentUser))
                return new DosResult(0, null, "当前账号已不再是有效的平台超级管理员。");

            try
            {
                using var allocationScope = BeginTrustedHostAllocationScope();
                var json = ToJObject(param);
                var taskDenied = ResolveCurrentManagedBackgroundTask(
                    json,
                    upgradeEngineKey,
                    out var taskContext);
                if (taskDenied != null) return taskDenied;
                return new TenantProvisioningService()
                    .UpgradeAdminTenantDatabaseAsync(new AdminTenantDatabaseUpgradeRequest
                    {
                        TenantId = GetJsonString(json, "TenantId", "Id"),
                        TenantKey = GetJsonString(json, "TenantKey", "OsClient", "Key"),
                        OsClientType = GetJsonString(json, "OsClientType"),
                        OsClientNetwork = GetJsonString(json, "OsClientNetwork"),
                        BackgroundTaskId = taskContext.TaskId
                    })
                    .GetAwaiter()
                    .GetResult();
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    "Microi: Upgrade tenant database facade failed. ErrorType="
                    + ex.GetType().Name + ".");
                return new DosResult(0, null,
                    "租户数据库升级失败。请查看后台任务日志并核对数据库连接后重试。");
            }
        }

        private static DosResult ResolveCurrentManagedBackgroundTask(
            JObject request,
            string expectedApiEngineKey,
            out TrustedBackgroundTaskExecutionContext context)
        {
            context = null;
            request ??= new JObject();
            var trustedTask = V8TrustedExecutionContext.CurrentBackgroundTask;
            var taskId = GetJsonString(
                request, "_BackgroundTaskId", "BackgroundTaskId", "TaskId");
            if (taskId.DosIsNullOrWhiteSpace())
                taskId = GetJsonString(trustedTask, "Id", "TaskId");
            var fencingToken = request["_BackgroundTaskFencingToken"].Val<long>();
            if (fencingToken <= 0) fencingToken = request["FencingToken"].Val<long>();
            if (fencingToken <= 0) fencingToken = trustedTask?["FencingToken"].Val<long>() ?? 0;
            if (!BackgroundTaskService.TryGetCurrentExecutionContext(
                    taskId,
                    fencingToken,
                    expectedApiEngineKey,
                    out context))
            {
                return new DosResult(0, null,
                    "后台任务身份、接口引擎或栅栏令牌无效，拒绝执行租户数据库操作。");
            }
            if (!string.Equals(context.OwnerOsClient, OsClientDefault.OsClient,
                    StringComparison.OrdinalIgnoreCase))
            {
                context = null;
                return new DosResult(0, null, "只有主租户创建的后台任务可以执行此操作。");
            }
            return null;
        }

        /// <summary>
        /// 主租户超级管理员保留现有数据库数据，旋转子租户DatabaseOnly账号并更新连接。
        /// 连接串和凭据只在可信C#边界内处理，结果仅返回安全回读投影。
        /// </summary>
        public DosResult RepairAdminTenantDatabaseAccess(object param)
        {
            const string repairEngineKey = "admin_repair_saas_tenant_database_access";
            var denied = ResolveTrustedManagedCurrentUser(
                repairEngineKey,
                true,
                DiyCommon.MaxRoleLevel,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;
            if (!string.Equals(osClient, OsClientDefault.OsClient,
                    StringComparison.OrdinalIgnoreCase))
                return new DosResult(1002, null, "仅主租户允许修复子租户数据库连接。");
            if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                    osClient, currentUser))
                return new DosResult(0, null, "当前账号已不再是有效的平台超级管理员。");
            try
            {
                using var allocationScope = BeginTrustedHostAllocationScope();
                var json = ToJObject(param);
                return new TenantProvisioningService().RepairAdminTenantDatabaseAccess(
                    new AdminTenantDatabaseRepairRequest
                    {
                        TenantId = GetJsonString(json, "TenantId", "Id"),
                        TenantKey = GetJsonString(json, "TenantKey", "OsClient", "Key"),
                        ExpectedDatabaseName = GetJsonString(
                            json, "ExpectedDatabaseName", "DatabaseName", "DbName"),
                        ExpectedStaleReadDatabaseName = GetJsonString(
                            json, "ExpectedStaleReadDatabaseName"),
                        OsClientType = GetJsonString(json, "OsClientType"),
                        OsClientNetwork = GetJsonString(json, "OsClientNetwork")
                    });
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    "Microi: Repair tenant database access facade failed. ErrorType="
                    + ex.GetType().Name + ".");
                return new DosResult(0, null, "租户数据库连接修复失败。");
            }
        }

        /// <summary>
        /// 供接口引擎做滚动发布能力探测。只有完整开通流程已由 Redis 分布式租约保护的
        /// 后端版本才返回 true；旧节点会因缺少此方法而继续使用原子分步兼容流程。
        /// </summary>
        public bool SupportsDistributedTenantProvisioningLease()
        {
            return true;
        }

        public DosResult GetUserTenant(string userId)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            return new TenantProvisioningService().GetUserTenant(userId);
        }

        public DosResult GetUserTenants(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                var json = ToJObject(param);
                var userId = GetJsonString(json, "UserId", "OwnerUserId", "Id");
                return new TenantProvisioningService().GetUserTenants(userId);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"获取用户租户列表失败：{ex.Message}");
            }
        }

        public DosResult RollbackTenantProvisioning(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                var json = ToJObject(param);
                return new TenantProvisioningService().RollbackTenantProvisioning(
                    GetJsonString(json, "OsClient", "TenantKey", "Key"),
                    GetJsonString(json, "DbName", "DatabaseName"));
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"回滚租户开通失败：{ex.Message}");
            }
        }

        public DosResult EnsureTenantProvisioningColumns()
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            return new TenantProvisioningService().EnsureProvisioningColumns();
        }

        public DosResult BuildTenantDatabaseInfo(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                var json = ToJObject(param);
                var tenantKey = GetJsonString(json, "TenantKey", "OsClient", "Key");
                return new TenantProvisioningService().BuildTenantDatabaseInfo(tenantKey);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"构建租户数据库信息失败：{ex.Message}");
            }
        }

        public DosResult CreateTenantDatabase(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                var json = ToJObject(param);
                var dbName = GetJsonString(json, "DbName", "DatabaseName");
                return new TenantProvisioningService().CreateTenantDatabase(dbName);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"创建租户数据库失败：{ex.Message}");
            }
        }

        public DosResult ImportTenantEmptySql(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                var json = ToJObject(param);
                var dbConn = GetJsonString(json, "DbConn", "ConnectionString");
                return new TenantProvisioningService().ImportTenantEmptySql(dbConn);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"导入租户空库失败：{ex.Message}");
            }
        }

        public DosResult CreateTenantOsClient(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                var json = ToJObject(param);
                return new TenantProvisioningService().CreateTenantOsClient(
                    GetJsonString(json, "OsClient", "TenantKey", "Key"),
                    GetJsonString(json, "DbName", "DatabaseName"),
                    GetJsonString(json, "DbConn", "ConnectionString"),
                    GetJsonString(json, "Phone", "OwnerPhone"),
                    GetJsonString(json, "SystemName", "ClientName", "Name"));
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"创建SaaS租户配置失败：{ex.Message}");
            }
        }

        public DosResult UpdateTenantOwner(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                var json = ToJObject(param);
                return new TenantProvisioningService().UpdateTenantOwner(
                    GetJsonString(json, "OsClient", "TenantKey", "Key"),
                    GetJsonString(json, "UserId", "OwnerUserId"),
                    GetJsonString(json, "Phone", "OwnerPhone"),
                    GetJsonString(json, "SystemName", "ClientName", "Name"));
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"更新租户归属关系失败：{ex.Message}");
            }
        }

        public DosResult InitTenantAdmin(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                var json = ToJObject(param);
                return new TenantProvisioningService().InitTenantAdmin(
                    GetJsonString(json, "DbConn", "ConnectionString"),
                    GetJsonString(json, "Phone", "OwnerPhone"),
                    GetJsonString(json, "UserName", "Name", "Account"),
                    GetJsonString(json, "EncryptedPwd", "Pwd", "Password"),
                    GetJsonString(json, "OsClient", "TenantKey", "Key"));
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"初始化租户管理员失败：{ex.Message}");
            }
        }

        public DosResult InitTenantSysConfig(object param)
        {
            var denied = RequireMasterTenantProvisioningAccess();
            if (denied != null) return denied;
            try
            {
                var json = ToJObject(param);
                return new TenantProvisioningService().InitTenantSysConfig(
                    GetJsonString(json, "DbConn", "ConnectionString"),
                    GetJsonString(json, "OsClient", "TenantKey", "Key"),
                    GetJsonString(json, "SystemName", "ClientName", "Name"),
                    GetJsonString(json, "AiApiKey", "ApiKey", "RelayApiKey"));
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"初始化租户系统设置失败：{ex.Message}");
            }
        }

        private static JObject ToJObject(object param)
        {
            if (param == null)
            {
                return new JObject();
            }
            if (param is JObject jObject)
            {
                return jObject;
            }
            if (param is string text)
            {
                return text.DosIsNullOrWhiteSpace() ? new JObject() : JObject.Parse(text);
            }
            return JObject.FromObject(param);
        }

        private static string GetJsonString(JObject json, params string[] names)
        {
            foreach (var name in names)
            {
                var token = json[name];
                if (token == null || token.Type == JTokenType.Null)
                {
                    continue;
                }
                var value = token.ToString().Trim();
                if (!value.DosIsNullOrWhiteSpace())
                {
                    return value;
                }
            }
            return "";
        }

        public DosResult ClearTenantCache(string osClient)
        {
            try
            {
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "OsClient is required.");
                }

                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                if (V8TenantContext.IsActive
                    && !string.Equals(osClient, V8TenantContext.Current.OsClient, StringComparison.OrdinalIgnoreCase))
                {
                    var denied = RequireMasterTenantProvisioningAccess();
                    if (denied != null) return denied;
                }
                long deletedCount = 0;
                long skippedCount = 0;
                var preservedSamples = new List<string>();
                var errors = new List<string>();

                try
                {
                    var tenantCache = MicroiEngine.CacheTenant.Cache(osClient);
                    var database = tenantCache.GetIDatabase();
                    var connection = database.Multiplexer;
                    var pattern = $"Microi:{osClient}:*";

                    foreach (var endpoint in connection.GetEndPoints())
                    {
                        var server = connection.GetServer(endpoint);
                        foreach (var redisKey in server.Keys(database.Database, pattern, pageSize: 1000))
                        {
                            var key = redisKey.ToString();
                            if (ShouldPreserveTenantCacheKey(key))
                            {
                                skippedCount++;
                                if (preservedSamples.Count < 20)
                                {
                                    preservedSamples.Add(key);
                                }
                                continue;
                            }
                            try
                            {
                                if (tenantCache.Remove(key))
                                {
                                    deletedCount++;
                                }
                            }
                            catch (Exception keyEx)
                            {
                                if (errors.Count < 20)
                                {
                                    errors.Add($"{key}: {keyEx.Message}");
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi: Clear tenant cache failed. OsClient={osClient}, Error={ex.Message}");
                    errors.Add(ex.Message);
                }

                try
                {
                    var defaultCache = MicroiEngine.CacheTenant.Default();
                    OsClientExtend.InvalidateSaasConfigurationCache(osClient, defaultCache);
                    defaultCache.Remove($"Microi:{osClient}:SysConfig");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi: Clear SaaS config cache failed. OsClient={osClient}, Error={ex.Message}");
                    errors.Add(ex.Message);
                }

                try
                {
                    DiyMessage.ClearSourceTextCache(osClient);
                }
                catch (Exception ex)
                {
                    errors.Add(ex.Message);
                }

                return new DosResult(1, new
                {
                    OsClient = osClient,
                    DeletedCount = deletedCount,
                    PreservedLoginCount = skippedCount,
                    PreservedSamples = preservedSamples,
                    Errors = errors
                }, $"Tenant cache cleared. OsClient={osClient}, Deleted={deletedCount}, PreservedLogin={skippedCount}.");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"Clear tenant cache failed. OsClient={osClient}, Error={ex.Message}");
            }
        }

        private static bool ShouldPreserveTenantCacheKey(string key)
        {
            if (key.DosIsNullOrWhiteSpace())
            {
                return false;
            }
            var text = key.ToLowerInvariant();
            return text.Contains(":logintokensysuser:")
                || text.Contains(":login-token:")
                || text.Contains(":loginuser:")
                || text.Contains(":currenttoken:")
                || text.Contains(":refresh-token:");
        }

        public List<DiyWhere> ParseWhere(object whereParam)
        {
            return WhereParser.ParseWhere(whereParam);
        }
        /// <summary>
        ///
        /// </summary>
        /// <returns></returns>
        public DosResult<string> GetClientIP()
        {
            return Dos.Common.IPHelper.GetClientIP(DiyHttpContext.Current);
        }
        public JObject SetSysUserRoleInfo(dynamic userModel, string osClient)
        {
            return new DiyToken().SetSysUserRoleInfo(userModel, osClient);
        }
        //private SysUserLogic _sysUserLogic = new SysUserLogic();
        /// <summary>
        /// 刷新当前租户的登录身份投影。普通用户仅限本人；跨用户刷新必须由
        /// 同租户平台管理员通过主库复核。显式 OsClient 不能选择目标租户；第三参
        /// 只兼容携带原始 Token 的历史 microi-init，并在本方法内重新权威验证。
        /// </summary>
        /// <param name="userId"></param>
        /// <param name="osClient"></param>
        /// <returns></returns>
        public DosResult<dynamic> RefreshLoginUser(
            string userId,
            string osClient = null,
            string token = null)
        {
            try
            {
                var explicitTokenCredential = !token.DosIsNullOrWhiteSpace();
                var credential = ResolveLoginProjectionCredential(
                    token,
                    rawToken => DiyToken.GetCurrentToken(rawToken)
                        .GetAwaiter()
                        .GetResult(),
                    () => DiyToken.GetCurrentToken(false)
                        .GetAwaiter()
                        .GetResult());
                if (credential.Code != 1)
                {
                    return new DosResult<dynamic>(
                        credential.Code,
                        null,
                        credential.Msg);
                }

                var authorization = AuthorizeLoginProjectionRefresh(
                    userId,
                    osClient,
                    V8TenantContext.Current?.OsClient,
                    V8TrustedExecutionContext.CurrentOsClient,
                    V8TrustedExecutionContext.CurrentUser,
                    credential.Data,
                    ResolveCanonicalLoginProjectionTenant,
                    PlatformAdministratorSecurity.IsCurrentPlatformAdministrator,
                    explicitTokenCredential);
                if (authorization.Code != 1)
                {
                    return new DosResult<dynamic>(
                        authorization.Code,
                        null,
                        authorization.Msg);
                }

                // SysUserLogic owns role/permission enrichment and preserves the
                // existing cache record. It now receives and uses only the canonical,
                // authorized tenant for both the query and the cache key.
                return new SysUserLogic()
                    .RefreshLoginUser(userId.Trim(), authorization.Data)
                    .GetAwaiter()
                    .GetResult();
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：[RefreshLoginUser] 登录投影刷新失败：{ex.GetType().Name}");
                return new DosResult<dynamic>(0, null, "刷新登录身份失败，请稍后重试。");
            }
        }

        /// <summary>
        /// 解析登录投影刷新凭据。显式 Token 永远在这里重新走 DiyToken 权威验证，
        /// 验证失败时不回退 ambient 身份；无第三参时才读取当前 HTTP Token。
        /// 返回对象只在宿主内流转，V8.GetCurrentToken 的返回值不能充当证明。
        /// </summary>
        internal static DosResult<CurrentToken> ResolveLoginProjectionCredential(
            string explicitToken,
            Func<string, CurrentToken> validateExplicitToken,
            Func<CurrentToken> resolveAmbientToken)
        {
            if (!explicitToken.DosIsNullOrWhiteSpace())
            {
                explicitToken = explicitToken.Trim();
                if (explicitToken.Length > 32 * 1024)
                    return new DosResult<CurrentToken>(1001, null, "显式 Token 无效或已过期。");
                if (validateExplicitToken == null)
                    return new DosResult<CurrentToken>(0, null, "显式 Token 验证器不可用。");

                CurrentToken validatedToken = null;
                try
                {
                    validatedToken = validateExplicitToken(explicitToken);
                }
                catch
                {
                    // Do not fall back to the ambient principal. The caller explicitly
                    // selected this bearer credential and it must stand on its own.
                }
                if (validatedToken?.CurrentUser == null
                    || validatedToken.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<CurrentToken>(1001, null, "显式 Token 无效或已过期。");
                }
                return new DosResult<CurrentToken>(1, validatedToken);
            }

            CurrentToken ambientToken = null;
            try
            {
                ambientToken = resolveAmbientToken?.Invoke();
            }
            catch
            {
                // Background/managed execution has no HTTP token and must use the
                // server-only V8TrustedExecutionContext path in the authorization step.
            }
            return new DosResult<CurrentToken>(1, ambientToken);
        }

        /// <summary>
        /// 为 V8 登录投影刷新解析唯一可信租户和调用者。显式 OsClient 只是兼容参数，
        /// 不能选择租户；普通用户只能刷新本人，跨用户必须通过同租户主库管理员复核。
        /// 可信后台/升级调用必须同时提供宿主保存的用户与租户作用域，空身份不放行。
        /// </summary>
        internal static DosResult<string> AuthorizeLoginProjectionRefresh(
            string targetUserId,
            string requestedOsClient,
            string v8OsClient,
            string trustedOsClient,
            JObject trustedCurrentUser,
            CurrentToken authenticatedToken,
            Func<string, string> resolveCanonicalTenant,
            Func<string, JObject, bool> isPlatformAdministrator,
            bool explicitTokenCredential = false)
        {
            targetUserId = (targetUserId ?? string.Empty).Trim();
            if (!Regex.IsMatch(targetUserId, "^[A-Za-z0-9_-]{1,100}$"))
                return new DosResult<string>(0, null, "刷新用户标识无效。");
            if (resolveCanonicalTenant == null || isPlatformAdministrator == null)
                return new DosResult<string>(0, null, "登录投影安全校验不可用。");

            string normalizedV8Tenant;
            string normalizedTrustedTenant;
            string normalizedTokenTenant;
            string normalizedRequestedTenant;
            try
            {
                normalizedV8Tenant = NormalizeOptionalLoginProjectionTenant(v8OsClient);
                normalizedTrustedTenant = NormalizeOptionalLoginProjectionTenant(trustedOsClient);
                normalizedTokenTenant = authenticatedToken?.CurrentUser == null
                    ? string.Empty
                    : NormalizeOptionalLoginProjectionTenant(authenticatedToken.OsClient);
                normalizedRequestedTenant = NormalizeOptionalLoginProjectionTenant(requestedOsClient);
            }
            catch
            {
                return new DosResult<string>(0, null, "刷新登录身份的 OsClient 无效。");
            }

            if (trustedCurrentUser != null && normalizedTrustedTenant.DosIsNullOrWhiteSpace())
                return new DosResult<string>(0, null, "可信登录身份缺少租户作用域。");
            if (!normalizedV8Tenant.DosIsNullOrWhiteSpace()
                && !normalizedTrustedTenant.DosIsNullOrWhiteSpace()
                && !string.Equals(
                    normalizedV8Tenant,
                    normalizedTrustedTenant,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult<string>(0, null, "V8 与可信登录身份的租户不一致。");
            }

            var effectiveTenant = !normalizedV8Tenant.DosIsNullOrWhiteSpace()
                ? normalizedV8Tenant
                : trustedCurrentUser != null
                    ? normalizedTrustedTenant
                    : normalizedTokenTenant;
            if (effectiveTenant.DosIsNullOrWhiteSpace())
                return new DosResult<string>(1001, null, "登录身份已过期，无法刷新登录投影。");
            if (!normalizedRequestedTenant.DosIsNullOrWhiteSpace()
                && !string.Equals(
                    normalizedRequestedTenant,
                    effectiveTenant,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult<string>(0, null, "禁止跨租户刷新登录投影。");
            }

            string canonicalTenant;
            try
            {
                canonicalTenant = resolveCanonicalTenant(effectiveTenant);
            }
            catch
            {
                canonicalTenant = null;
            }
            if (canonicalTenant.DosIsNullOrWhiteSpace())
                return new DosResult<string>(0, null, "当前租户不存在或数据库不可用。");
            try
            {
                canonicalTenant = TenantConfigurationSecurity.NormalizeTenantId(canonicalTenant);
            }
            catch
            {
                return new DosResult<string>(0, null, "当前租户无效。");
            }
            if (!string.Equals(
                    canonicalTenant,
                    effectiveTenant,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult<string>(0, null, "租户解析结果与当前身份不一致。");
            }

            if (authenticatedToken?.CurrentUser != null
                && !string.Equals(
                    normalizedTokenTenant,
                    effectiveTenant,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult<string>(0, null, "当前 Token 与 V8 租户不一致。");
            }

            JObject tokenCurrentUser = null;
            if (authenticatedToken?.CurrentUser != null)
            {
                tokenCurrentUser = authenticatedToken.CurrentUser;
            }
            if (trustedCurrentUser != null
                && tokenCurrentUser != null
                && !string.Equals(
                    trustedCurrentUser["Id"]?.ToString(),
                    tokenCurrentUser["Id"]?.ToString(),
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult<string>(0, null, "可信身份与当前 Token 用户不一致。");
            }

            var actor = trustedCurrentUser ?? tokenCurrentUser;
            var actorUserId = actor?["Id"]?.ToString()?.Trim();
            if (actorUserId.DosIsNullOrWhiteSpace())
                return new DosResult<string>(1001, null, "登录身份已过期，无法刷新登录投影。");
            if (UserAccessKeySecurity.IsSession(actor))
                return new DosResult<string>(0, null, "访问密钥会话不能刷新登录投影。");
            if (explicitTokenCredential
                && (tokenCurrentUser == null
                    || !string.Equals(
                        targetUserId,
                        tokenCurrentUser["Id"]?.ToString()?.Trim(),
                        StringComparison.OrdinalIgnoreCase)))
            {
                return new DosResult<string>(0, null, "显式 Token 只能刷新其所属用户的登录投影。");
            }

            if (!string.Equals(targetUserId, actorUserId, StringComparison.OrdinalIgnoreCase)
                && !isPlatformAdministrator(canonicalTenant, actor))
            {
                return new DosResult<string>(0, null, "普通用户只能刷新自己的登录投影。");
            }

            return new DosResult<string>(1, canonicalTenant);
        }

        private static string NormalizeOptionalLoginProjectionTenant(string osClient)
        {
            return osClient.DosIsNullOrWhiteSpace()
                ? string.Empty
                : TenantConfigurationSecurity.NormalizeTenantId(osClient);
        }

        private static string ResolveCanonicalLoginProjectionTenant(string osClient)
        {
            var normalized = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            var client = OsClientExtend.GetClient(normalized);
            return client?.Db == null
                ? null
                : TenantConfigurationSecurity.NormalizeTenantId(
                    client.OsClient.DosIsNullOrWhiteSpace() ? normalized : client.OsClient);
        }

        /// <summary>
        /// 清除指定用户全部终端的登录信息，立即吊销所有 Token。仅系统管理员可调用。
        /// </summary>
        public DosResult ClearUserLoginInfo(string userId, string osClient = null)
        {
            try
            {
                var currentToken = DiyToken.GetCurrentToken().GetAwaiter().GetResult();
                var currentUser = currentToken?.CurrentUser;
                if (currentUser == null)
                {
                    return new DosResult(1001, null, "登录身份已过期");
                }

                var currentOsClient = currentToken.OsClient;
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = currentOsClient;
                }
                if (!string.Equals(osClient, currentOsClient, StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult(0, null, "禁止跨租户清除用户登录信息");
                }

                return OnlineTerminalService
                    .ClearUserLoginInfoAsync(osClient, currentUser, userId)
                    .GetAwaiter()
                    .GetResult();
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"清除用户登录信息失败：{ex.Message}");
            }
        }

        /// <summary>
        /// V8 后端敏感业务的一次性二次认证原子能力。前端先完成 Passkey/人脸验证取得 Ticket，
        /// 接口引擎再用相同 Purpose 与 ActionHash 消费；成功后同一 Ticket 立即失效。
        /// </summary>
        public DosResult ConsumeIdentityVerificationTicket(dynamic dynamicParam)
        {
            try
            {
                var currentToken = DiyToken.GetCurrentToken().GetAwaiter().GetResult();
                var currentUser = currentToken?.CurrentUser;
                if (currentUser == null) return new DosResult(1001, null, "登录身份已过期。");
                if (UserAccessKeySecurity.IsSession(currentUser))
                    return new DosResult(0, null, "访问密钥会话不能执行生物识别二次认证。");

                var param = JsonHelper.ToJObject(dynamicParam);
                var result = IdentityVerificationSecurity.ConsumeTicketAsync(
                        currentToken.OsClient,
                        currentUser["Id"]?.ToString(),
                        param["Ticket"]?.ToString(),
                        param["Purpose"]?.ToString(),
                        param["ActionHash"]?.ToString())
                    .GetAwaiter()
                    .GetResult();
                if (result.Code != 1) return new DosResult(result.Code, null, result.Msg);
                return new DosResult(1, new
                {
                    Verified = true,
                    result.Data.Method,
                    result.Data.Purpose,
                    result.Data.VerifiedAt,
                    result.Data.AuthenticatorId
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "消费身份验证票据失败：" + ex.Message);
            }
        }
        /// <summary>
        /// 获取token
        /// </summary>
        /// <returns></returns>
        public CurrentToken GetCurrentToken(string token = null, string osClient = null)
        {
            if (token.DosIsNullOrWhiteSpace())
            {
                return DiyToken.GetCurrentToken().GetAwaiter().GetResult();
            }
            return DiyToken.GetCurrentToken(token, osClient).GetAwaiter().GetResult();
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public DiyUploadParam DynamicToDiyUploadParam(dynamic dynamicParam)
        {
            JObject jobjParam = JsonHelper.ToJObject(dynamicParam);
            DiyUploadParam param = jobjParam.ToObject<DiyUploadParam>(DiyCommon.GetJsonSerializer());//这里时间格式化没有用
            return param;
        }
        /// <summary>
        /// 获取私有文件地址
        /// </summary>
        /// <returns></returns>
        public DosResult GetPrivateFileUrl(dynamic dynamicParam)
        {
            DiyUploadParam diyUploadParam = DynamicToDiyUploadParam(dynamicParam);
            return CreateTenantHdfs(diyUploadParam)
                .GetPrivateFileUrl(diyUploadParam)
                .GetAwaiter()
                .GetResult();
        }

        /// <summary>
        /// 读取私有文本文件内容。用于接口引擎读取源码、模板等小型文本文件。
        /// 二进制文件仍应通过 GetPrivateFileUrl 下载，不要转成字符串。
        /// </summary>
        public DosResult GetPrivateFileText(dynamic dynamicParam)
        {
            var diyUploadParam = DynamicToDiyUploadParam(dynamicParam);
            var result = CreateTenantHdfs(diyUploadParam)
                .GetPrivateFileByte(diyUploadParam)
                .GetAwaiter()
                .GetResult();
            if (result.Code != 1)
            {
                return result;
            }
            if (result.Data is byte[] bytes)
            {
                // dynamic 调用会把 JsonHelper.ToJObject 的返回值继续传播为 dynamic，
                // 后续 JValue.Val<T>() 因而会被 CLR 当作实例成员绑定并在运行时失败。
                // 先强制回到 JObject/JToken 的静态类型，保证接口引擎内嵌调用与 HTTP
                // 调用使用完全相同的参数解析路径。
                JObject request = JsonHelper.ToJObject((object)dynamicParam);
                var requestedMaxBytes = request["MaxBytes"]?.Val<long>() ?? 64L * 1024 * 1024;
                var maxBytes = Math.Max(1, Math.Min(requestedMaxBytes, 256L * 1024 * 1024));
                if (bytes.LongLength > maxBytes)
                {
                    return new DosResult(0, null, $"文本文件超过读取上限：{bytes.LongLength} > {maxBytes} bytes");
                }
                return new DosResult(1, Encoding.UTF8.GetString(bytes));
            }
            if (result.Data == null)
            {
                return new DosResult(1, "");
            }
            return new DosResult(1, result.Data.ToString());
        }

        /// <summary>
        /// 传入OsClient
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public DosResult Upload(dynamic dynamicParam)
        //public DosResult Upload(DiyUploadParam param)
        {

            var param = DynamicToDiyUploadParam(dynamicParam);

            //param.OsClient = currentToken.OsClient;

            #region 测试手动传入文件流，也可以不用这样
            //param.Files = new Dictionary<string, Stream>();
            //foreach (var file in HttpContext.Request.Form.Files)
            //{
            //    if (file != null)
            //        param.Files.Add(file.FileName, file.OpenReadStream());
            //}
            #endregion

            var result = CreateTenantHdfs(param).Upload(param).GetAwaiter().GetResult();
            return result;
        }

        /// <summary>
        /// 直接上传 UTF-8 文本。该原子能力专用于接口引擎生成的 JSON、源码和模板，
        /// 避免 String -&gt; Base64 -&gt; byte[] 的 4/3 膨胀与多份累计分配；桶权限、
        /// 租户目录、扩展名、配额和上传大小仍统一经过 MicroiHDFS 安全策略。
        /// </summary>
        public DosResult UploadText(dynamic dynamicParam)
        {
            try
            {
                // 不能让 dynamic 参数把 JObject/JToken 继续污染为 dynamic；否则
                // JValue.Val<T>() 会被错误地解析成实例方法（JValue 并不存在 Val）。
                JObject request = JsonHelper.ToJObject((object)dynamicParam);
                JToken contentToken = request["Content"];
                if (contentToken == null || contentToken.Type == JTokenType.Null)
                {
                    return new DosResult(0, null, "UploadText.Content 不能为空");
                }

                var content = contentToken.Type == JTokenType.String
                    ? contentToken.Val<string>()
                    : contentToken.ToString(Newtonsoft.Json.Formatting.None);
                var fileName = (request["FileName"]?.Val<string>() ?? "content.txt").Trim();
                if (fileName.DosIsNullOrWhiteSpace()
                    || fileName != Path.GetFileName(fileName)
                    || fileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
                {
                    return new DosResult(0, null, "UploadText.FileName 不合法");
                }

                var bytes = Encoding.UTF8.GetBytes(content ?? "");
                const int maxTextUploadBytes = 256 * 1024 * 1024;
                if (bytes.Length > maxTextUploadBytes)
                {
                    return new DosResult(0, null, $"UploadText 文本超过 {maxTextUploadBytes} bytes 上限");
                }

                var param = DynamicToDiyUploadParam(dynamicParam);
                param.FilesByte ??= new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
                if (param.FilesByte.Count > 0 || (param.FilesByteBase64?.Count ?? 0) > 0 || (param.Files?.Count ?? 0) > 0)
                {
                    return new DosResult(0, null, "UploadText 不能同时传入其它文件载荷");
                }
                param.FilesByte[fileName] = bytes;
                param.Preview = false;
                param.Multiple = false;
                var result = CreateTenantHdfs(param).Upload(param).GetAwaiter().GetResult();
                return result ?? new DosResult(0, null, "UploadText HDFS 未返回结果");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "UploadText 失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 在受控沙箱中创建 ZIP。V8 脚本不能直接访问 System.IO，所有条目只接受内存中的
        /// Base64/文本内容，并统一执行路径、文件数和解压尺寸限制。
        /// </summary>
        public DosResult CreateZip(dynamic dynamicParam)
        {
            try
            {
                var param = ToJObject(dynamicParam);
                var entries = param["Entries"] as JArray ?? param["Files"] as JArray ?? new JArray();
                var maxFileCount = ReadZipLimit(param, "MaxFileCount", 20000, 1, 20000);
                var maxEntryBytes = ReadZipLimit(param, "MaxEntryBytes", 256L * 1024 * 1024, 1, 512L * 1024 * 1024);
                var maxTotalBytes = ReadZipLimit(param, "MaxTotalBytes", 2L * 1024 * 1024 * 1024, 1, 4L * 1024 * 1024 * 1024);
                if (entries.Count == 0) return new DosResult(0, null, "ZIP文件列表不能为空");
                if (entries.Count > maxFileCount) return new DosResult(0, null, $"ZIP文件数量不能超过{maxFileCount}个");

                long totalBytes = 0;
                using var output = new MemoryStream();
                using (var archive = new ZipArchive(output, ZipArchiveMode.Create, true))
                {
                    foreach (var token in entries)
                    {
                        var item = token as JObject ?? new JObject();
                        var path = NormalizeZipEntryPath(item["Path"]?.ToString()
                            ?? item["FilePath"]?.ToString()
                            ?? item["FileName"]?.ToString());
                        if (string.IsNullOrWhiteSpace(path)) return new DosResult(0, null, "ZIP文件路径不能为空");

                        byte[] bytes;
                        var base64 = item["FileByteBase64"]?.ToString()
                            ?? item["ContentBase64"]?.ToString()
                            ?? item["Base64"]?.ToString();
                        if (!string.IsNullOrWhiteSpace(base64))
                        {
                            try { bytes = Convert.FromBase64String(base64); }
                            catch { return new DosResult(0, null, $"ZIP文件不是有效Base64：{path}"); }
                        }
                        else
                        {
                            bytes = Encoding.UTF8.GetBytes(item["Content"]?.ToString() ?? "");
                        }

                        if (bytes.LongLength > maxEntryBytes) return new DosResult(0, null, $"ZIP单文件超过限制：{path}");
                        totalBytes += bytes.LongLength;
                        if (totalBytes > maxTotalBytes) return new DosResult(0, null, "ZIP文件总大小超过限制");

                        var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
                        using var stream = entry.Open();
                        stream.Write(bytes, 0, bytes.Length);
                    }
                }

                var zipBytes = output.ToArray();
                return new DosResult(1, new
                {
                    FileByteBase64 = Convert.ToBase64String(zipBytes),
                    Size = zipBytes.LongLength,
                    Sha256 = ComputeSha256Hex(zipBytes),
                    FileCount = entries.Count,
                    TotalSourceSize = totalBytes
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"创建ZIP失败：{ex.Message}");
            }
        }

        /// <summary>
        /// 在受控沙箱中读取 ZIP，返回安全的相对路径和 Base64 内容。
        /// 拒绝 Zip Slip、超大条目、异常压缩比和解压炸弹。
        /// </summary>
        public DosResult ExtractZip(dynamic dynamicParam)
        {
            try
            {
                var param = ToJObject(dynamicParam);
                var base64 = param["FileByteBase64"]?.ToString()
                    ?? param["ContentBase64"]?.ToString()
                    ?? param["Base64"]?.ToString();
                if (string.IsNullOrWhiteSpace(base64)) return new DosResult(0, null, "ZIP内容不能为空");

                byte[] zipBytes;
                try { zipBytes = Convert.FromBase64String(base64); }
                catch { return new DosResult(0, null, "ZIP内容不是有效Base64"); }

                var maxFileCount = ReadZipLimit(param, "MaxFileCount", 20000, 1, 20000);
                var maxEntryBytes = ReadZipLimit(param, "MaxEntryBytes", 256L * 1024 * 1024, 1, 512L * 1024 * 1024);
                var maxTotalBytes = ReadZipLimit(param, "MaxTotalBytes", 2L * 1024 * 1024 * 1024, 1, 4L * 1024 * 1024 * 1024);
                var maxCompressionRatio = ReadZipLimit(param, "MaxCompressionRatio", 200, 1, 1000);
                var result = new List<object>();
                long totalBytes = 0;

                using var input = new MemoryStream(zipBytes, false);
                using var archive = new ZipArchive(input, ZipArchiveMode.Read, false);
                if (archive.Entries.Count > maxFileCount) return new DosResult(0, null, $"ZIP文件数量不能超过{maxFileCount}个");

                foreach (var entry in archive.Entries)
                {
                    if (string.IsNullOrEmpty(entry.Name)) continue;
                    string path;
                    try { path = NormalizeZipEntryPath(entry.FullName); }
                    catch (Exception ex) { return new DosResult(0, null, ex.Message); }

                    if (entry.Length > maxEntryBytes) return new DosResult(0, null, $"ZIP单文件超过限制：{path}");
                    if (entry.CompressedLength > 0 && entry.Length / Math.Max(1, entry.CompressedLength) > maxCompressionRatio)
                    {
                        return new DosResult(0, null, $"ZIP文件压缩比异常：{path}");
                    }
                    totalBytes += entry.Length;
                    if (totalBytes > maxTotalBytes) return new DosResult(0, null, "ZIP解压总大小超过限制");

                    using var entryStream = entry.Open();
                    using var memory = new MemoryStream();
                    entryStream.CopyTo(memory);
                    var bytes = memory.ToArray();
                    result.Add(new
                    {
                        Path = path,
                        FileName = Path.GetFileName(path),
                        FileByteBase64 = Convert.ToBase64String(bytes),
                        Size = bytes.LongLength,
                        Sha256 = ComputeSha256Hex(bytes)
                    });
                }

                return new DosResult(1, new { Entries = result, FileCount = result.Count, TotalSize = totalBytes });
            }
            catch (InvalidDataException ex)
            {
                return new DosResult(0, null, $"ZIP格式无效：{ex.Message}");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"读取ZIP失败：{ex.Message}");
            }
        }

        private static long ReadZipLimit(JObject param, string name, long defaultValue, long minValue, long maxValue)
        {
            if (!long.TryParse(param[name]?.ToString(), out var value)) return defaultValue;
            return Math.Min(maxValue, Math.Max(minValue, value));
        }

        private static string ComputeSha256Hex(byte[] bytes)
        {
            using var sha256 = SHA256.Create();
            return BitConverter.ToString(sha256.ComputeHash(bytes ?? Array.Empty<byte>()))
                .Replace("-", "")
                .ToLowerInvariant();
        }

        private static string NormalizeZipEntryPath(string value)
        {
            var raw = (value ?? "").Replace('\\', '/').Trim();
            if (string.IsNullOrWhiteSpace(raw) || raw.StartsWith('/') || Path.IsPathRooted(raw))
            {
                throw new InvalidDataException("ZIP包含非法绝对路径");
            }
            var parts = raw.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Any(part => part == "." || part == ".."))
            {
                throw new InvalidDataException($"ZIP包含不安全路径：{raw}");
            }
            return string.Join('/', parts.Select(part => string.Concat(part.Select(ch => Path.GetInvalidFileNameChars().Contains(ch) ? '_' : ch))));
        }

        /// <summary>
        /// 移动 HDFS 文件到指定完整路径。
        /// 传入 FilePathName（原完整路径）、Path（目标完整路径）、Limit、OsClient。
        /// </summary>
        public DosResult MoveObject(dynamic dynamicParam)
        {
            var param = DynamicToDiyUploadParam(dynamicParam);
            if (string.IsNullOrWhiteSpace(param.FilePathName))
            {
                return new DosResult(0, null, "FilePathName不能为空！");
            }
            if (string.IsNullOrWhiteSpace(param.Path))
            {
                return new DosResult(0, null, "Path不能为空！");
            }

            return CreateTenantHdfs(param).MoveObject(param).GetAwaiter().GetResult();
        }

        private static V8TenantHDFS CreateTenantHdfs(DiyUploadParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            var osClient = V8TenantContext.IsActive
                ? V8TenantContext.Current.OsClient
                : param.OsClient;
            if (osClient.DosIsNullOrWhiteSpace()) osClient = DiyToken.GetCurrentOsClient();
            if (osClient.DosIsNullOrWhiteSpace()) throw new InvalidOperationException("OsClient不能为空！");
            param.OsClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            return new V8TenantHDFS(param.OsClient);
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public DosResult<CurrentToken> GetAccessToken(dynamic dynamicParam)
        {
            JObject jobjParam = JsonHelper.ToJObject(dynamicParam);
            DiyTokenParam param = jobjParam.ToObject<DiyTokenParam>(DiyCommon.GetJsonSerializer());//这里时间格式化没有用
            return new DiyToken().GetAccessToken(param).GetAwaiter().GetResult();
        }

        /// <summary>
        /// 获取当前时间戳
        /// </summary>
        /// <returns></returns>
        public long GetTimestamp()
        {
            return DateTimeOffset.Now.ToUnixTimeSeconds();
        }
        /// <summary>
        ///
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public SysLogParam DynamicToSysLogParam(dynamic dynamicParam)
        {
            JObject jobjParam = JsonHelper.ToJObject(dynamicParam);
            SysLogParam param = jobjParam.ToObject<SysLogParam>(DiyCommon.GetJsonSerializer());//这里时间格式化没有用
            return param;
        }
        /// <summary>
        ///
        /// </summary>
        /// <param name="dynamicParam"></param>
        /// <returns></returns>
        public DosResult AddSysLog(dynamic dynamicParam)
        {
            SysLogParam param;
            try
            {
                param = DynamicToSysLogParam(dynamicParam);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "AddSysLog parameter error: " + ex.Message);
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    var result = await MicroiEngine.MongoDB.AddSysLog(param);
                    if (result?.Code != 1)
                    {
                        Console.WriteLine($"Microi: AddSysLog failed. Type={param?.Type}, Title={param?.Title}, Msg={result?.Msg}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi: AddSysLog exception. Type={param?.Type}, Title={param?.Title}, Error={ex.Message}");
                }
            });

            return new DosResult(1, null, "SysLog queued.");
        }

        public DosResult GetTraceTimeline(dynamic dynamicParam)
        {
            try
            {
                JObject request = ToJObject((object)dynamicParam);
                var denied = RequireCurrentTenantSuperAdmin(out var osClient, out _);
                if (denied != null) return denied;
                var traceId = GetJsonString(request, "TraceId").ToLowerInvariant();
                if (!Regex.IsMatch(traceId, "^[0-9a-f]{32}$"))
                    return new DosResult(0, null, "TraceId必须是32位十六进制W3C TraceId。");
                var pageSize = Math.Max(1, Math.Min(500, request["PageSize"].Val<int>()));
                if (pageSize == 0) pageSize = 200;
                var result = MicroiEngine.MongoDB.GetTraceTimeline(new SysLogTraceQueryParam
                {
                    OsClient = osClient,
                    TraceId = traceId,
                    SearchMonth = GetJsonString(request, "SearchMonth", "_SearchMonth"),
                    PageSize = pageSize
                }).GetAwaiter().GetResult();
                if (result == null) return new DosResult(0, null, "Trace时间线查询失败。");
                if (result.Code != 1) return new DosResult(result.Code, result.Data, result.Msg);
                var rows = (result.Data ?? new List<SysLog>()).Select(row => new
                {
                    row.EventId,
                    row.TraceId,
                    row.SpanId,
                    row.ParentSpanId,
                    row.TraceFlags,
                    row.ServiceName,
                    row.ServiceVersion,
                    row.NodeId,
                    row.Environment,
                    row.Category,
                    row.Action,
                    row.Source,
                    row.Type,
                    row.Title,
                    Content = LimitLogText(row.Content, 2000),
                    row.Success,
                    row.Level,
                    row.DurationMs,
                    row.HttpStatusCode,
                    row.CreateTime
                }).OrderBy(row => row.CreateTime).ToList();
                return new DosResult(1, new
                {
                    TraceId = traceId,
                    SpanCount = rows.Count,
                    Spans = rows
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "查询Trace时间线失败：" + ex.Message);
            }
        }

        public DosResult PlanSystemLogLifecycle(dynamic dynamicParam)
        {
            try
            {
                JObject request = ToJObject((object)dynamicParam);
                var denied = RequireCurrentTenantSuperAdmin(out var osClient, out _);
                if (denied != null) return denied;
                DateTime cutoff;
                if (!TryReadUtcDateTime(request["CutoffTime"], out cutoff))
                    return new DosResult(0, null, "CutoffTime不是有效时间。");
                var match = request["Match"] as JObject ?? new JObject();
                var result = MicroiEngine.MongoDB.PlanSystemLogLifecycle(new SysLogLifecycleParam
                {
                    OsClient = osClient,
                    CutoffTime = cutoff,
                    Type = LimitLogText(GetJsonString(match, "Type"), 200),
                    Category = LimitLogText(GetJsonString(match, "Category"), 200),
                    Source = LimitLogText(GetJsonString(match, "Source"), 200),
                    MaxCollections = Math.Max(1, Math.Min(120, request["MaxCollections"].Val<int>() == 0
                        ? 120
                        : request["MaxCollections"].Val<int>())),
                    BatchSize = 200
                }).GetAwaiter().GetResult();
                return result == null
                    ? new DosResult(0, null, "生成日志生命周期计划失败。")
                    : new DosResult(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "生成日志生命周期计划失败：" + ex.Message);
            }
        }

        public DosResult RunSystemLogLifecycle(dynamic dynamicParam)
        {
            try
            {
                JObject request = ToJObject((object)dynamicParam);
                JObject currentUser;
                var denied = RequireCurrentTenantSuperAdmin(out var osClient, out currentUser);
                if (denied != null) return denied;
                JObject trustedTask;
                denied = RequireTrustedBackgroundTask(request, osClient, out trustedTask);
                if (denied != null) return denied;
                DateTime cutoff;
                if (!TryReadUtcDateTime(request["CutoffTime"], out cutoff))
                    return new DosResult(0, null, "CutoffTime不是有效时间。");
                var mode = GetJsonString(request, "ArchiveMode");
                if (mode != "PrivateHdfs" && mode != "Extension" && mode != "DeleteOnly")
                    return new DosResult(0, null, "ArchiveMode只允许PrivateHdfs、Extension或DeleteOnly。");
                var runKey = GetJsonString(request, "RunKey");
                var taskId = GetJsonString(request, "BackgroundTaskId");
                var fencingToken = request["FencingToken"].Val<long>();
                var match = request["Match"] as JObject ?? new JObject();
                var checkpoint = request["Checkpoint"] as JObject ?? new JObject();
                var lifecycle = new SysLogLifecycleParam
                {
                    OsClient = osClient,
                    CutoffTime = cutoff,
                    Type = LimitLogText(GetJsonString(match, "Type"), 200),
                    Category = LimitLogText(GetJsonString(match, "Category"), 200),
                    Source = LimitLogText(GetJsonString(match, "Source"), 200),
                    MaxCollections = 120,
                    BatchSize = Math.Max(1, Math.Min(500, request["BatchSize"].Val<int>() == 0 ? 200 : request["BatchSize"].Val<int>())),
                    SearchMonth = GetJsonString(checkpoint, "SearchMonth"),
                    PolicyKey = GetJsonString(request, "PolicyKey"),
                    RunKey = runKey,
                    ArchiveMode = mode,
                    BackgroundTaskId = taskId,
                    FencingToken = fencingToken
                };
                var batchResult = MicroiEngine.MongoDB.ReadSystemLogLifecycleBatch(lifecycle).GetAwaiter().GetResult();
                if (batchResult == null) return new DosResult(0, null, "读取日志生命周期批次失败。");
                if (batchResult.Code != 1) return new DosResult(batchResult.Code, batchResult.Data, batchResult.Msg);
                var batch = batchResult.Data;
                if (batch == null || batch.Items == null || batch.Items.Count == 0)
                {
                    var emptyState = MicroiEngine.MongoDB.GetSystemLogLifecycleRunState(lifecycle).GetAwaiter().GetResult();
                    if (emptyState == null) return new DosResult(0, null, "读取日志生命周期运行状态失败。");
                    if (emptyState.Code != 1) return new DosResult(emptyState.Code, emptyState.Data, emptyState.Msg);
                    return new DosResult(1, new
                    {
                        Scanned = emptyState.Data.Scanned,
                        Archived = emptyState.Data.Archived,
                        Deleted = emptyState.Data.Deleted,
                        HasMore = false,
                        Checkpoint = new { SearchMonth = "" },
                        ArchiveProofHash = emptyState.Data.LastArchiveProofHash,
                        ArchivePath = emptyState.Data.LastArchivePath,
                        Cumulative = true
                    });
                }

                var eventIds = batch.Items.Select(item => item.Id ?? item.EventId)
                    .Where(id => !id.DosIsNullOrWhiteSpace()).Distinct(StringComparer.Ordinal).ToList();
                if (eventIds.Count != batch.Items.Count)
                    return new DosResult(0, null, "日志批次存在缺失或重复EventId，拒绝归档删除。");
                byte[] archiveBytes = null;
                string archivePath = "";
                string proofHash;
                if (mode == "DeleteOnly")
                {
                    proofHash = ComputeSha256Hex(Encoding.UTF8.GetBytes(
                        osClient + "\n" + runKey + "\n" + batch.SearchMonth + "\n" + string.Join("\n", eventIds)));
                }
                else
                {
                    archiveBytes = CreateCompressedLogArchive(batch.Items);
                    proofHash = ComputeSha256Hex(archiveBytes);
                    archivePath = "microi/ai-platform/log-archive/"
                                  + SafePathSegment(lifecycle.PolicyKey, "default") + "/"
                                  + SafePathSegment(runKey, "run") + "/"
                                  + batch.SearchMonth + "/" + proofHash + ".jsonl.gz";
                    var clientModel = OsClientExtend.GetClient(osClient);
                    if (clientModel?.OsClientModel == null)
                        return new DosResult(0, null, "当前租户私有文件存储配置不可用。");
                    var hdfs = ResolveTenantHdfs(clientModel);
                    using (var stream = new MemoryStream(archiveBytes, writable: false))
                    {
                        var upload = hdfs.PutObject(new HDFSParam
                        {
                            ClientModel = clientModel,
                            Limit = true,
                            Preview = false,
                            FileFullPath = archivePath,
                            FileStream = stream,
                            TimeoutSeconds = 300
                        }).GetAwaiter().GetResult();
                        if (upload == null || upload.Code != 1)
                            return new DosResult(0, null, "日志归档上传失败：" + (upload?.Msg ?? "未知错误"));
                    }
                    DosResult<bool> existence = null;
                    for (var attempt = 1; attempt <= 5; attempt++)
                    {
                        existence = hdfs.ObjectExist(new HDFSParam
                        {
                            ClientModel = clientModel,
                            Limit = true,
                            FileFullPath = archivePath,
                            NetworkIsInternet = false
                        }).GetAwaiter().GetResult();
                        if (existence?.Code == 1 && existence.Data) break;
                        if (attempt < 5) Thread.Sleep(attempt * 100);
                    }
                    if (existence?.Code != 1 || !existence.Data)
                        return new DosResult(0, null, "日志归档上传成功但私有对象回读失败，源日志未删除。");
                }

                var commit = MicroiEngine.MongoDB.CommitSystemLogLifecycleBatch(new SysLogLifecycleCommitParam
                {
                    OsClient = lifecycle.OsClient,
                    CutoffTime = lifecycle.CutoffTime,
                    Type = lifecycle.Type,
                    Category = lifecycle.Category,
                    Source = lifecycle.Source,
                    MaxCollections = lifecycle.MaxCollections,
                    BatchSize = lifecycle.BatchSize,
                    SearchMonth = batch.SearchMonth,
                    PolicyKey = lifecycle.PolicyKey,
                    RunKey = lifecycle.RunKey,
                    ArchiveMode = lifecycle.ArchiveMode,
                    BackgroundTaskId = lifecycle.BackgroundTaskId,
                    FencingToken = lifecycle.FencingToken,
                    EventIds = eventIds,
                    ArchivePath = archivePath,
                    ArchiveProofHash = proofHash,
                    ScannedCount = batch.Items.Count,
                    ArchivedCount = mode == "DeleteOnly" ? 0 : batch.Items.Count
                }).GetAwaiter().GetResult();
                if (commit == null) return new DosResult(0, null, "提交日志生命周期批次失败。");
                if (commit.Code != 1) return new DosResult(commit.Code, commit.Data, commit.Msg);
                return new DosResult(1, new
                {
                    Scanned = commit.Data.Scanned,
                    Archived = commit.Data.Archived,
                    Deleted = commit.Data.Deleted,
                    HasMore = batch.HasMore,
                    Checkpoint = new { SearchMonth = batch.NextSearchMonth ?? "" },
                    ArchiveProofHash = proofHash,
                    ArchivePath = archivePath,
                    Cumulative = true,
                    ExtensionRequired = mode == "Extension"
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "执行日志生命周期失败：" + ex.Message);
            }
        }

        private static DosResult RequireCurrentTenantSuperAdmin(
            out string osClient,
            out JObject currentUser,
            string capabilityName = "平台治理能力")
        {
            osClient = V8TenantContext.IsActive ? V8TenantContext.Current.OsClient : DiyToken.GetCurrentOsClient();
            currentUser = V8TrustedExecutionContext.CurrentUser;
            try
            {
                if (currentUser == null)
                {
                    var token = DiyToken.GetCurrentToken().GetAwaiter().GetResult();
                    currentUser = token?.CurrentUser;
                    if (osClient.DosIsNullOrWhiteSpace()) osClient = token?.OsClient;
                }
                if (osClient.DosIsNullOrWhiteSpace()) return new DosResult(0, null, "当前租户上下文不存在。");
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                if (currentUser == null || currentUser["Id"].Val<string>().DosIsNullOrWhiteSpace())
                    return new DosResult(1001, null, "登录身份已过期。");
                if (currentUser["Level"].Val<int>() < DiyCommon.MaxRoleLevel)
                    return new DosResult(0, null, "只有当前租户超级管理员可以使用" + capabilityName + "。");
                if (UserAccessKeySecurity.IsSession(currentUser))
                    return new DosResult(0, null, "访问密钥会话不能使用" + capabilityName + "。");
                return null;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "校验" + capabilityName + "管理员身份失败：" + ex.Message);
            }
        }

        private static DosResult RequireTrustedBackgroundTask(JObject request, string osClient, out JObject trustedTask)
        {
            trustedTask = V8TrustedExecutionContext.CurrentBackgroundTask;
            if (trustedTask == null) return new DosResult(0, null, "日志生命周期只能由服务端持久后台任务执行。");
            var taskId = GetJsonString(request, "BackgroundTaskId");
            var fencingToken = request["FencingToken"].Val<long>();
            var trustedId = GetJsonString(trustedTask, "Id");
            var trustedFence = trustedTask["FencingToken"].Val<long>();
            var leaseOwner = GetJsonString(trustedTask, "LeaseOwner");
            if (taskId.DosIsNullOrWhiteSpace() || fencingToken <= 0
                || !string.Equals(taskId, trustedId, StringComparison.Ordinal)
                || fencingToken != trustedFence)
                return new DosResult(0, null, "后台任务身份或栅栏令牌不匹配。");
            if (!BackgroundTaskRuntime.IsLeaseCurrent(osClient, taskId, leaseOwner, fencingToken))
                return new DosResult(0, null, "后台任务租约已失效，拒绝旧执行者处理日志。");
            return null;
        }

        private static bool TryReadUtcDateTime(JToken token, out DateTime value)
        {
            if (token != null && DateTime.TryParse(token.ToString(), CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out value)) return true;
            value = default(DateTime);
            return false;
        }

        private static byte[] CreateCompressedLogArchive(IEnumerable<SysLog> rows)
        {
            using (var output = new MemoryStream())
            {
                using (var gzip = new GZipStream(output, CompressionLevel.Optimal, true))
                using (var writer = new StreamWriter(gzip, new UTF8Encoding(false), 8192, true))
                {
                    foreach (var row in rows)
                        writer.WriteLine(JsonConvert.SerializeObject(row, Formatting.None));
                }
                return output.ToArray();
            }
        }

        private static string SafePathSegment(string value, string fallback)
        {
            var normalized = Regex.Replace((value ?? "").Trim(), "[^a-zA-Z0-9_.-]", "_");
            if (normalized.DosIsNullOrWhiteSpace()) normalized = fallback;
            return normalized.Length <= 100 ? normalized : normalized.Substring(0, 100);
        }

        private static string LimitLogText(string value, int max)
        {
            if (value == null || value.Length <= max) return value;
            return value.Substring(0, max) + "…";
        }

        private static IMicroiHDFS ResolveTenantHdfs(OsClientSecret client)
        {
            var type = client?.OsClientModel?["HDFS"]?.ToString();
            return type switch
            {
                "MinIO" => MicroiEngine.HDFSFactory(HDFSType.MinIO),
                "S3" => MicroiEngine.HDFSFactory(HDFSType.AmazonS3),
                _ => MicroiEngine.HDFSFactory(HDFSType.Aliyun)
            };
        }

        /// <summary>
        /// 当前租户超级管理员执行受限缓存/Redis 管理操作。接口引擎负责动作编排，
        /// 插件运行时负责 Redis 协议；这里固定可信租户、拒绝访问密钥和 temporary
        /// 公网连接，并对写操作生成不含密码的系统审计。
        /// </summary>
        public DosResult ManageCache(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(
                out var osClient,
                out _,
                "缓存与 Redis 管理能力");
            if (denied != null) return denied;

            try
            {
                JObject request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var action = (request["Action"]?.ToString() ?? "").Trim();
                var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "Statistics", "Invalidate", "InvalidatePattern", "Connections",
                    "SaveConnection", "DeleteConnection", "TestConnection",
                    "RedisStatistics", "Keys", "Key", "DeleteKeys", "ReplaceValue",
                    "RenameKey", "SetTtl"
                };
                if (!allowed.Contains(action))
                    return new DosResult(0, null, "不支持的缓存管理动作。");

                var mode = (request["Mode"]?.ToString() ?? "tenant").Trim().ToLowerInvariant();
                if (mode == "temporary")
                    return new DosResult(0, null, "公网缓存管理不支持 temporary 连接模式，请先保存受控连接。");
                if (mode != "tenant" && mode != "saved")
                    return new DosResult(0, null, "不支持的 Redis 连接模式。");

                request = (JObject)request.DeepClone();
                request.Remove("OsClient");
                request.Remove("_OsClient");
                request.Remove("_CurrentUser");
                var runtime = MicroiEngine.TryGetService<IMicroiCacheManagementRuntime>();
                if (runtime == null)
                    return new DosResult(0, null, "缓存管理插件尚未安装或未启动。");
                var data = runtime.ExecuteAsync(osClient, action, request)
                    .GetAwaiter()
                    .GetResult();

                if (IsCacheMutation(action))
                {
                    MicroiEngine.QueueSystemLog(
                        osClient,
                        "CacheManager",
                        action,
                        "超级管理员执行缓存管理操作",
                        JsonConvert.SerializeObject(CreateCacheAuditData(request)),
                        1,
                        true);
                }

                return new DosResult(1, data, GetCacheActionMessage(action));
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "缓存管理操作失败：" + RedactCacheSecret(ex.Message));
            }
        }

        private static bool IsCacheMutation(string action)
        {
            return !string.Equals(action, "Statistics", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(action, "Connections", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(action, "TestConnection", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(action, "RedisStatistics", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(action, "Keys", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(action, "Key", StringComparison.OrdinalIgnoreCase);
        }

        private static JObject CreateCacheAuditData(JObject request)
        {
            var audit = (JObject)(request?.DeepClone() ?? new JObject());
            audit.Remove("Password");
            if (audit["Connection"] is JObject connection) connection.Remove("Password");
            if (audit["Value"] != null) audit["Value"] = "[REDACTED]";
            if (audit["Keys"] is JArray keys && keys.Count > 50)
                audit["Keys"] = new JArray(keys.Take(50));
            return audit;
        }

        private static string RedactCacheSecret(string message)
        {
            if (message.DosIsNullOrWhiteSpace()) return "未知错误";
            var result = message;
            foreach (var marker in new[] { "password=", "pwd=" })
            {
                var index = result.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                if (index < 0) continue;
                var end = result.IndexOf(',', index);
                if (end < 0) end = result.Length;
                result = result.Substring(0, index + marker.Length) + "***" + result.Substring(end);
            }
            return result.Length <= 500 ? result : result.Substring(0, 500);
        }

        private static string GetCacheActionMessage(string action)
        {
            switch ((action ?? "").ToLowerInvariant())
            {
                case "invalidate": return "缓存 Key 已清除。";
                case "invalidatepattern": return "缓存模式已清除。";
                case "saveconnection": return "Redis 连接已保存。";
                case "deleteconnection": return "Redis 连接已删除。";
                case "deletekeys": return "Redis Key 已删除。";
                case "replacevalue": return "Redis 内容已保存。";
                case "renamekey": return "Redis Key 已重命名。";
                case "setttl": return "Redis TTL 已更新。";
                default: return "缓存管理操作成功。";
            }
        }

        /// <summary>
        /// 在线终端的可信运行时原子能力。动作由 platform-online-terminal 接口引擎
        /// 编排；租户、当前用户和管理员级别均从服务端上下文解析。
        /// </summary>
        public DosResult ManageOnlineTerminal(dynamic dynamicParam)
        {
            try
            {
                JObject request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var identityDenied = ResolveBackgroundTaskIdentity(
                    out var osClient,
                    out var currentUser,
                    out var userKey);
                if (identityDenied != null) return identityDenied;
                var action = (request["Action"]?.ToString() ?? "").Trim();
                switch (action.ToLowerInvariant())
                {
                    case "mine":
                        return new DosResult(
                            1,
                            OnlineTerminalService.GetUserTerminals(osClient, userKey));
                    case "list":
                        if (currentUser["Level"].Val<int>() < DiyCommon.MaxRoleLevel)
                            return new DosResult(0, null, "仅超级管理员可查看当前登录用户。");
                        if (UserAccessKeySecurity.IsSession(currentUser))
                            return new DosResult(0, null, "访问密钥会话不能查看全租户在线终端。");
                        return new DosResult(1, OnlineTerminalService.ListOnlineUsers(osClient));
                    case "kick":
                        if (UserAccessKeySecurity.IsSession(currentUser))
                            return new DosResult(0, null, "访问密钥会话不能踢出在线终端。");
                        return OnlineTerminalService.KickTerminalAsync(
                                osClient,
                                currentUser,
                                request["UserId"]?.ToString(),
                                request["ConnectionId"]?.ToString())
                            .GetAwaiter()
                            .GetResult();
                    default:
                        return new DosResult(0, null, "不支持的在线终端动作。");
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "在线终端操作失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 对当前登录用户的持久后台任务执行受限原子操作。
        /// Action 的业务编排由官方 platform-background-task 接口引擎负责；这里仅提供
        /// V8 无法直接访问的任务运行时，并且从不信任请求中的 OsClient、UserId 或
        /// _CurrentUser。所有身份都从 ApiEngine 的可信租户上下文或当前令牌解析。
        /// </summary>
        public DosResult ManageBackgroundTask(dynamic dynamicParam)
        {
            try
            {
                // JsonHelper.ToJObject accepts dynamic for legacy compatibility. When its
                // result is assigned to `var`, C# keeps the expression dynamic even though
                // the declared return type is JObject. That made Status/Detail attempt to
                // resolve string extension methods through the runtime binder. Pin the V8
                // boundary to JObject so all task actions use normal static dispatch.
                JObject request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var identityDenied = ResolveBackgroundTaskIdentity(
                    out var osClient,
                    out var currentUser,
                    out var userKey);
                if (identityDenied != null) return identityDenied;

                var action = (request["Action"]?.ToString() ?? "").Trim();
                switch (action.ToLowerInvariant())
                {
                    case "list":
                    {
                        var pageIndex = Math.Max(1,
                            request["_PageIndex"]?.Val<int>()
                            ?? request["PageIndex"]?.Val<int>()
                            ?? 1);
                        var pageSize = Math.Max(1, Math.Min(100,
                            request["_PageSize"]?.Val<int>()
                            ?? request["PageSize"]?.Val<int>()
                            ?? 15));
                        int dataCount;
                        var data = BackgroundTaskService.ListSummaries(
                            osClient,
                            userKey,
                            pageIndex,
                            pageSize,
                            out dataCount);
                        return new DosResult(1, data, "", dataCount);
                    }
                    case "detail":
                    {
                        var taskId = GetBackgroundTaskId(request);
                        if (taskId.DosIsNullOrWhiteSpace())
                            return new DosResult(0, null, "后台任务Id不能为空。");
                        var data = BackgroundTaskService.GetDetail(osClient, userKey, taskId);
                        return data == null
                            ? new DosResult(0, null, "未找到属于当前用户的后台任务。")
                            : new DosResult(1, data);
                    }
                    case "status":
                    {
                        var taskId = GetBackgroundTaskId(request);
                        if (taskId.DosIsNullOrWhiteSpace())
                            return new DosResult(0, null, "后台任务Id不能为空。");
                        var data = BackgroundTaskService.GetSummary(osClient, userKey, taskId);
                        return data == null
                            ? new DosResult(0, null, "未找到属于当前用户的后台任务。")
                            : new DosResult(1, data);
                    }
                    case "workerstatus":
                    {
                        var denied = RequireCurrentTenantSuperAdmin(
                            out _,
                            out _,
                            "后台任务 Worker 状态");
                        if (denied != null) return denied;
                        var data = BackgroundTaskWorkerRuntime.Snapshot();
                        data["Readiness"] = BackgroundTaskService.GetWorkerReadiness();
                        return new DosResult(1, data);
                    }
                    case "clearcompleted":
                    {
                        var count = BackgroundTaskService.ClearCompleted(osClient, userKey);
                        BackgroundTaskService.SendTaskListToUserAsync(osClient, userKey)
                            .GetAwaiter()
                            .GetResult();
                        return new DosResult(1, new { Count = count }, $"已清除{count}条成功任务");
                    }
                    case "remove":
                    {
                        var taskId = GetBackgroundTaskId(request);
                        if (taskId.DosIsNullOrWhiteSpace())
                            return new DosResult(0, null, "后台任务Id不能为空。");
                        var removed = BackgroundTaskService.Remove(osClient, userKey, taskId);
                        if (removed)
                        {
                            BackgroundTaskService.SendTaskListToUserAsync(osClient, userKey)
                                .GetAwaiter()
                                .GetResult();
                        }
                        return removed
                            ? new DosResult(1, null, "后台任务已清除。")
                            : new DosResult(0, null, "只能清除属于当前用户且已结束的后台任务。");
                    }
                    case "cancel":
                    {
                        var taskId = GetBackgroundTaskId(request);
                        if (taskId.DosIsNullOrWhiteSpace())
                            return new DosResult(0, null, "后台任务Id不能为空。");
                        return BackgroundTaskService.Cancel(osClient, userKey, taskId)
                            ? new DosResult(1, null, "已请求停止后台任务。")
                            : new DosResult(0, null, "未找到可停止的后台任务。");
                    }
                    case "runapiengine":
                        return QueueBackgroundApiEngine(request, osClient, currentUser, userKey);
                    default:
                        return new DosResult(0, null, "不支持的后台任务动作。");
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "执行后台任务动作失败：" + ex.Message);
            }
        }

        private static DosResult ResolveBackgroundTaskIdentity(
            out string osClient,
            out JObject currentUser,
            out string userKey)
        {
            osClient = V8TenantContext.IsActive
                ? V8TenantContext.Current.OsClient
                : DiyToken.GetCurrentOsClient();
            currentUser = V8TrustedExecutionContext.CurrentUser;
            userKey = "";
            try
            {
                if (currentUser == null)
                {
                    var token = DiyToken.GetCurrentToken().GetAwaiter().GetResult();
                    currentUser = token?.CurrentUser;
                    if (osClient.DosIsNullOrWhiteSpace()) osClient = token?.OsClient;
                }
                if (osClient.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "当前租户上下文不存在。");
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                if (currentUser == null)
                    return new DosResult(1001, null, "登录身份已过期。");
                userKey = currentUser["Id"].Val<string>();
                if (userKey.DosIsNullOrWhiteSpace())
                    userKey = currentUser["Account"].Val<string>();
                if (userKey.DosIsNullOrWhiteSpace())
                    return new DosResult(1001, null, "登录身份已过期。");
                return null;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "解析后台任务身份失败：" + ex.Message);
            }
        }

        private static string GetBackgroundTaskId(JObject request)
        {
            return request?["Id"]?.ToString()
                   ?? request?["TaskId"]?.ToString()
                   ?? request?["BackgroundTaskId"]?.ToString();
        }

        private static DosResult QueueBackgroundApiEngine(
            JObject request,
            string osClient,
            JObject currentUser,
            string userKey)
        {
            // ApiEngineKey belongs to the dispatcher selected by the HTTP route.
            // The queued engine uses a separate field so an untrusted body cannot
            // redirect /apiengine/platform-background-task before this primitive runs.
            var apiEngineKey = request["TargetApiEngineKey"]?.ToString()?.Trim();
            if (apiEngineKey.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "TargetApiEngineKey不能为空。");
            if (string.Equals(apiEngineKey, "platform-background-task", StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "后台任务管理接口不能把自身再次加入队列。");
            if (BackgroundTaskService.IsReservedNativeWorkerKey(apiEngineKey))
            {
                return new DosResult(
                    0,
                    null,
                    "该任务标识属于平台保留的原生 Worker，不能通过通用接口引擎入口提交。");
            }
            if (currentUser["Id"].Val<string>().DosIsNullOrWhiteSpace())
                return new DosResult(1001, null, "登录身份已失效，请重新登录后再提交后台任务。");
            if (!UserAccessKeySecurity.IsApiEngineAllowed(currentUser, apiEngineKey))
                return new DosResult(0, null, "当前访问密钥未授权运行此接口引擎。");

            var apiEngineModelResult = MicroiEngine.ApiEngine
                .GetAuthoritativeApiEngineModel(new ApiEngineParam
                {
                    OsClient = osClient,
                    ApiEngineKey = apiEngineKey,
                    _CurrentUser = currentUser
                })
                .GetAwaiter()
                .GetResult();
            if (apiEngineModelResult.Code != 1 || apiEngineModelResult.Data == null)
            {
                return new DosResult(
                    0,
                    null,
                    apiEngineModelResult.Msg ?? "接口引擎不存在或已停用。");
            }

            var apiRole = DynamicHelper.GetDynamicStringValue(
                apiEngineModelResult.Data,
                "ApiRole",
                "");
            var roleAuthorization = ApiEngineRoleAuthorization.Evaluate(currentUser, apiRole);
            if (!roleAuthorization.IsAllowed)
            {
                var deniedMessage = roleAuthorization.HasOnlyGet
                                    && !roleAuthorization.HasExplicitRoles
                                    && !roleAuthorization.HasMalformedPolicy
                    ? ApiEngineRoleAuthorization.OnlyGetDeniedMessage
                    : DiyMessage.GetLang(osClient, "NoAuth");
                return new DosResult(0, null, deniedMessage);
            }

            var apiParam = request["Param"] as JObject ?? new JObject();
            apiParam = (JObject)apiParam.DeepClone();
            apiParam.Remove("_CurrentUser");
            apiParam.Remove(ApiEngineRoleAuthorization.BackgroundAuthorizationMarker);
            apiParam["ApiEngineKey"] = apiEngineKey;
            apiParam["OsClient"] = osClient;
            apiParam[ApiEngineRoleAuthorization.BackgroundAuthorizationMarker] = true;

            var options = request["Options"] as JObject
                          ?? apiParam["_BackgroundTaskOptions"] as JObject
                          ?? new JObject();
            options = (JObject)options.DeepClone();
            apiParam.Remove("_BackgroundTaskOptions");
            try
            {
                var item = BackgroundTaskService.StartApiEngine(
                    osClient,
                    userKey,
                    request["Title"]?.ToString(),
                    apiParam,
                    currentUser,
                    options);
                return new DosResult(
                    1,
                    item,
                    item.ExecutionCount > 0 || item.Status != "Pending"
                        ? "已返回相同幂等键的后台任务"
                        : "后台任务已持久化并进入队列");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "后台任务提交失败：" + ex.Message);
            }
        }

        public DosResult UpdateBackgroundTask(dynamic dynamicParam)
        {
            try
            {
                var jobjParam = JsonHelper.ToJObject(dynamicParam);
                string taskId = jobjParam["_BackgroundTaskId"]?.ToString()
                                ?? jobjParam["TaskId"]?.ToString()
                                ?? jobjParam["Id"]?.ToString();
                if (taskId.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "后台任务Id不能为空。");
                }

                int? progress = null;
                var progressToken = jobjParam["Progress"] ?? jobjParam["progress"];
                int parsedProgress = 0;
                if (progressToken != null && int.TryParse(progressToken.ToString(), out parsedProgress))
                {
                    progress = parsedProgress;
                }

                int? current = null;
                int parsedCurrent = 0;
                var currentToken = jobjParam["Current"] ?? jobjParam["current"];
                if (currentToken != null && int.TryParse(currentToken.ToString(), out parsedCurrent))
                {
                    current = parsedCurrent;
                }

                int? total = null;
                int parsedTotal = 0;
                var totalToken = jobjParam["Total"] ?? jobjParam["total"];
                if (totalToken != null && int.TryParse(totalToken.ToString(), out parsedTotal))
                {
                    total = parsedTotal;
                }

                if (!progress.HasValue && current.HasValue && total.HasValue && total.Value > 0)
                {
                    progress = Convert.ToInt32(Math.Round(current.Value * 100.0 / total.Value));
                }

                string msg = jobjParam["Msg"]?.ToString()
                             ?? jobjParam["msg"]?.ToString()
                             ?? jobjParam["Message"]?.ToString()
                             ?? jobjParam["message"]?.ToString();
                string log = jobjParam["Log"]?.ToString()
                             ?? jobjParam["log"]?.ToString()
                             ?? jobjParam["AppendLog"]?.ToString()
                             ?? jobjParam["appendLog"]?.ToString();
                var progressUpdated = BackgroundTaskRuntime.TryUpdateProgress(taskId, progress, msg, current, total);
                var logAppended = string.IsNullOrWhiteSpace(log)
                    ? false
                    : BackgroundTaskRuntime.TryAppendLog(taskId, log);
                var ok = progressUpdated || logAppended;
                return ok
                    ? new DosResult(1, null, logAppended ? "后台任务进度和日志已更新。" : "后台任务进度已更新。")
                    : new DosResult(0, null, "后台任务不存在或当前运行环境未启用后台任务。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "更新后台任务进度失败：" + ex.Message);
            }
        }

    }
}
