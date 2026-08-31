using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Dos.ORM.SeedConversion;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    public sealed class AdminTenantProvisioningRequest
    {
        public string TenantKey { get; set; }
        public string SystemName { get; set; }
        public string OwnerPhone { get; set; }
        public string UserName { get; set; }
        public string EncryptedPwd { get; set; }
        public string OsClientType { get; set; }
        public string OsClientNetwork { get; set; }
        public string DomainName { get; set; }
        public string DatabaseZipPath { get; set; }
        public string DatabaseZipName { get; set; }
    }

    /// <summary>
    /// 租户自动开通服务
    /// 用于用户注册后自动创建数据库、SaaS租户记录并初始化空库
    /// </summary>
    public class TenantProvisioningService
    {
        /// <summary>
        /// 空库SQL文件路径（相对于应用程序根目录）
        /// </summary>
        private static string _emptySqlFilePath;

        /// <summary>
        /// 初始化SQL文件路径
        /// </summary>
        public static void SetEmptySqlFilePath(string path)
        {
            _emptySqlFilePath = path;
        }

        /// <summary>
        /// 为新注册用户自动开通租户
        /// 1. 创建新数据库
        /// 2. 导入空库SQL
        /// 3. 在主库sys_osclients表新增租户记录
        /// 4. 在新库sys_user表创建admin用户
        /// 5. 刷新SaaS引擎内存
        /// </summary>
        /// <param name="phone">手机号（用作OsClient标识）</param>
        /// <param name="userId">主库用户Id</param>
        /// <param name="userName">用户名</param>
        /// <param name="encryptedPwd">加密后的密码</param>
        /// <returns>操作结果，Data中包含新OsClient值</returns>
        public async Task<DosResult> ProvisionTenantAsync(string phone, string userId, string userName, string encryptedPwd)
        {
            string createdOsClient = null;
            string createdDbName = null;
            var databaseCreated = false;
            TenantProvisioningLease lease = null;
            try
            {
                // OsClient用手机号（全小写无特殊字符）
                var osClient = "u" + phone; // 前缀u避免纯数字在某些场景的问题
                var dbName = "microi_" + osClient;
                createdOsClient = osClient;
                createdDbName = dbName;

                // 获取主库连接信息
                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                if (mainClient == null)
                {
                    return new DosResult(0, null, "主库OsClient未初始化！");
                }

                EnsureProvisioningColumns(mainClient);

                lease = TenantProvisioningLease.TryAcquire(userId);
                if (lease == null)
                {
                    return new DosResult(0, null, "当前账号的租户开通任务正在其它节点执行，请勿重复提交。");
                }
                lease.ThrowIfLost();

                // 检查该手机号是否已有租户
                var existCheck = mainClient.Db.FromSql(
                    "SELECT COUNT(*) FROM sys_osclients WHERE OsClient = @p0 AND IsDeleted = 0")
                    .AddInParameter("p0", osClient)
                    .ToScalar<int>();

                if (existCheck > 0)
                {
                    // 已有租户，返回成功（幂等）
                    return new DosResult(1, new { OsClient = osClient }, "租户已存在");
                }

                var tenantDatabaseQuota = GetTenantDatabaseQuota(mainClient, userId);
                var usedQuota = GetOwnedTenantCount(mainClient, userId);
                if (usedQuota >= tenantDatabaseQuota)
                {
                    return BuildTenantQuotaExceededResult(tenantDatabaseQuota, usedQuota);
                }

                // Step 1-2: 创建数据库及仅能访问该库的独立账号，并构建受限连接串。
                var databaseAccess = CreateTenantDatabaseAccess(dbName);
                databaseCreated = true;
                var newDbConn = databaseAccess.ConnectionString;
                lease.ThrowIfLost();

                // Step 3: 导入空库SQL到新数据库
                var importResult = ImportEmptySql(newDbConn, OsClientDefault.OsClientDbType);
                if (importResult.Code != 1)
                {
                    return CompensateProvisioningFailure(importResult, osClient, dbName);
                }
                lease.ThrowIfLost();

                // Step 4: 在主库sys_osclients表新增租户记录
                var addTenantResult = AddOsClientRecord(mainClient, osClient, dbName, newDbConn, phone, userName);
                if (addTenantResult.Code != 1)
                {
                    return CompensateProvisioningFailure(addTenantResult, osClient, dbName);
                }

                lease.ThrowIfLost();
                UpdateOsClientOwner(mainClient, osClient, userId, phone, userName);

                // Step 5: 在新数据库中复用空库默认管理员并初始化配置
                var initResult = InitNewTenantData(newDbConn, OsClientDefault.OsClientDbType,
                    phone, userName, encryptedPwd, osClient);
                if (initResult.Code != 1)
                {
                    return CompensateProvisioningFailure(initResult, osClient, dbName);
                }
                lease.ThrowIfLost();
                UpdateTenantSysConfig(mainClient, newDbConn, OsClientDefault.OsClientDbType, osClient, userName);
                UpdateMainUserTenant(mainClient, userId, osClient, userName);
                lease.ThrowIfLost();

                // Step 6: 刷新SaaS引擎内存中的租户配置
                try
                {
                    MicroiEngine.GetService<IOsClientRuntime>().ReloadSingleOsClient(osClient);
                    Console.WriteLine($"Microi：【成功】租户[{osClient}]自动开通完成并已加载到内存！");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【警告】租户[{osClient}]已创建但刷新内存失败：{ex.Message}，需重启生效。");
                }

                lease.ThrowIfLost();

                var success = new DosResult(1, new { OsClient = osClient, DbName = dbName }, "租户开通成功");
                success.DataAppend = addTenantResult.DataAppend;
                return success;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】租户自动开通失败：{ex.Message}");
                var failure = new DosResult(0, null, $"租户开通失败：{ex.Message}");
                return databaseCreated
                    ? CompensateProvisioningFailure(failure, createdOsClient, createdDbName)
                    : failure;
            }
            finally
            {
                lease?.Dispose();
            }
        }

        /// <summary>
        /// 创建新数据库
        /// </summary>
        public async Task<DosResult> ProvisionTenantAsync(string tenantKey, string systemName,
            string userId, string phone, string userName, string encryptedPwd, string aiApiKey = null)
        {
            string createdOsClient = null;
            string createdDbName = null;
            var databaseCreated = false;
            TenantProvisioningLease lease = null;
            try
            {
                tenantKey = (tenantKey ?? "").Trim();
                systemName = (systemName ?? "").Trim();
                phone = (phone ?? "").Trim();

                if (!Regex.IsMatch(tenantKey, @"^[A-Za-z][A-Za-z0-9_-]*$"))
                {
                    return new DosResult(0, null, "租户Key必须以英文字母开头，且只能包含英文字母、数字、-、_。");
                }
                if (systemName.DosIsNullOrWhiteSpace())
                {
                    systemName = tenantKey;
                }

                var osClient = tenantKey;
                var dbName = "microi_" + tenantKey.Replace("-", "_");
                createdOsClient = osClient;
                createdDbName = dbName;
                if (!Regex.IsMatch(dbName, @"^[A-Za-z0-9_]+$"))
                {
                    return new DosResult(0, null, "数据库名称不合法。");
                }

                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                if (mainClient == null)
                {
                    return new DosResult(0, null, "主租户OsClient未初始化。");
                }

                EnsureProvisioningColumns(mainClient);

                lease = TenantProvisioningLease.TryAcquire(userId);
                if (lease == null)
                {
                    return new DosResult(0, null, "当前账号的租户开通任务正在其它节点执行，请勿重复提交。");
                }
                lease.ThrowIfLost();

                var tenantDatabaseQuota = GetTenantDatabaseQuota(mainClient, userId);
                var usedQuota = GetOwnedTenantCount(mainClient, userId);
                if (usedQuota >= tenantDatabaseQuota)
                {
                    return BuildTenantQuotaExceededResult(tenantDatabaseQuota, usedQuota);
                }

                var existCheck = mainClient.Db.FromSql(
                        "SELECT COUNT(*) FROM sys_osclients WHERE OsClient = @p0 AND IsDeleted = 0")
                    .AddInParameter("p0", osClient)
                    .ToScalar<int>();
                if (existCheck > 0)
                {
                    return new DosResult(0, new { OsClient = osClient, Domain = $"{osClient}.microi.net" }, "租户Key已存在，请更换后重试。");
                }

                var databaseAccess = CreateTenantDatabaseAccess(dbName);
                databaseCreated = true;
                var newDbConn = databaseAccess.ConnectionString;
                lease.ThrowIfLost();

                var importResult = ImportEmptySql(newDbConn, OsClientDefault.OsClientDbType);
                if (importResult.Code != 1)
                {
                    return CompensateProvisioningFailure(importResult, osClient, dbName);
                }
                lease.ThrowIfLost();

                var addTenantResult = AddOsClientRecord(mainClient, osClient, dbName, newDbConn, phone, systemName);
                if (addTenantResult.Code != 1)
                {
                    return CompensateProvisioningFailure(addTenantResult, osClient, dbName);
                }

                lease.ThrowIfLost();
                UpdateOsClientOwner(mainClient, osClient, userId, phone, systemName);

                var initResult = InitNewTenantData(newDbConn, OsClientDefault.OsClientDbType,
                    phone, userName, encryptedPwd, osClient);
                if (initResult.Code != 1)
                {
                    return CompensateProvisioningFailure(initResult, osClient, dbName);
                }
                lease.ThrowIfLost();
                UpdateTenantSysConfig(mainClient, newDbConn, OsClientDefault.OsClientDbType,
                    osClient, systemName, aiApiKey);
                UpdateMainUserTenant(mainClient, userId, osClient, systemName);
                lease.ThrowIfLost();

                var reloadResult = MicroiEngine.GetService<IOsClientRuntime>()
                    .ReloadSingleOsClient(osClient);
                if (reloadResult.Code != 1)
                {
                    return CompensateProvisioningFailure(
                        new DosResult(0, reloadResult.Data, $"刷新租户运行配置失败：{reloadResult.Msg}"),
                        osClient, dbName);
                }
                lease.ThrowIfLost();

                var success = new DosResult(1, new
                {
                    OsClient = osClient,
                    DbName = dbName,
                    SystemName = systemName,
                    Domain = $"{osClient}.microi.net",
                    DomainName = $"{osClient}.microi.net",
                    Url = $"https://{osClient}.microi.net",
                    FreeTenantCreated = true,
                    NextTenantPrice = 9.9M
                }, "租户创建成功。");
                success.DataAppend = addTenantResult.DataAppend;
                return success;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Tenant provisioning failed: {ex.Message}");
                var failure = new DosResult(0, null, $"租户创建失败：{ex.Message}");
                return databaseCreated
                    ? CompensateProvisioningFailure(failure, createdOsClient, createdDbName)
                    : failure;
            }
            finally
            {
                lease?.Dispose();
            }
        }

        /// <summary>
        /// 主租户超级管理员使用的原子开通流程。数据库连接串仅在本方法进程内使用，
        /// 不返回给 V8；自定义数据库包从主租户私有 HDFS 读取，ZIP 内必须且只能有一个 SQL。
        /// </summary>
        public async Task<DosResult> ProvisionAdminTenantAsync(AdminTenantProvisioningRequest request)
        {
            request ??= new AdminTenantProvisioningRequest();
            var tenantKey = (request.TenantKey ?? "").Trim();
            var systemName = (request.SystemName ?? "").Trim();
            var ownerPhone = (request.OwnerPhone ?? "").Trim();
            var osClientType = (request.OsClientType ?? OsClientDefault.OsClientType ?? "Product").Trim();
            var osClientNetwork = (request.OsClientNetwork ?? OsClientDefault.OsClientNetwork ?? "Internal").Trim();
            var domainName = (request.DomainName ?? "").Trim();
            var databaseZipPath = (request.DatabaseZipPath ?? "").Trim();
            var databaseZipName = (request.DatabaseZipName ?? "").Trim();
            var dbName = "";
            var databaseCreated = false;
            TenantProvisioningLease lease = null;

            try
            {
                if (!Regex.IsMatch(tenantKey, @"^[A-Za-z][A-Za-z0-9_-]*$"))
                    return new DosResult(0, null, "租户Key必须以英文字母开头，且只能包含英文字母、数字、-、_。");
                if (systemName.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "系统名称不能为空。");
                if ((request.EncryptedPwd ?? "").Trim().DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "admin 密码不能为空。");
                if (!Regex.IsMatch(osClientType, @"^[A-Za-z][A-Za-z0-9_-]*$"))
                    return new DosResult(0, null, "OsClientType 格式不正确。");
                if (!Regex.IsMatch(osClientNetwork, @"^[A-Za-z][A-Za-z0-9_.-]{0,49}$"))
                    return new DosResult(0, null, "OsClientNetwork 格式不正确。");

                if (domainName.DosIsNullOrWhiteSpace()) domainName = tenantKey + ".microi.net";
                if (!Regex.IsMatch(domainName, @"^[A-Za-z0-9.-]+$") || domainName.Contains(".."))
                    return new DosResult(0, null, "域名格式不正确，请只填写域名，不要包含协议或路径。");
                if (!databaseZipPath.DosIsNullOrWhiteSpace()
                    && !databaseZipName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                    return new DosResult(0, null, "自定义数据库包必须是 .zip 文件。");

                dbName = "microi_" + tenantKey.Replace("-", "_");
                if (!Regex.IsMatch(dbName, @"^[A-Za-z0-9_]+$"))
                    return new DosResult(0, null, "数据库名称不合法。");

                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                if (mainClient == null)
                    return new DosResult(0, null, "主租户OsClient未初始化。");

                EnsureProvisioningColumns(mainClient);
                lease = TenantProvisioningLease.TryAcquire("admin:" + tenantKey.ToLowerInvariant());
                if (lease == null)
                    return new DosResult(0, null, "该租户的开通任务正在其它节点执行，请勿重复提交。");
                lease.ThrowIfLost();

                var existCheck = mainClient.Db.FromSql(
                        "SELECT COUNT(*) FROM sys_osclients WHERE OsClient = @p0 AND IsDeleted = 0")
                    .AddInParameter("p0", tenantKey)
                    .ToScalar<int>();
                if (existCheck > 0)
                    return new DosResult(0, new { OsClient = tenantKey, DomainName = domainName },
                        "租户Key已存在，请更换后重试。");

                var databaseAccess = CreateTenantDatabaseAccess(dbName);
                databaseCreated = true;
                var newDbConn = databaseAccess.ConnectionString;
                lease.ThrowIfLost();

                var importResult = databaseZipPath.DosIsNullOrWhiteSpace()
                    ? ImportEmptySql(newDbConn, OsClientDefault.OsClientDbType)
                    : ImportTenantSqlZip(mainClient, databaseZipPath, databaseZipName,
                        newDbConn, OsClientDefault.OsClientDbType);
                if (importResult.Code != 1)
                    return CompensateProvisioningFailure(importResult, tenantKey, dbName);
                lease.ThrowIfLost();

                var addTenantResult = AddOsClientRecord(mainClient, tenantKey, dbName, newDbConn,
                    ownerPhone, systemName, osClientType, osClientNetwork, domainName);
                if (addTenantResult.Code != 1)
                    return CompensateProvisioningFailure(addTenantResult, tenantKey, dbName);
                lease.ThrowIfLost();

                var adminName = (request.UserName ?? "").Trim();
                if (adminName.DosIsNullOrWhiteSpace()) adminName = "管理员";
                var initResult = InitNewTenantData(newDbConn, OsClientDefault.OsClientDbType,
                    ownerPhone, adminName,
                    (request.EncryptedPwd ?? "").Trim(), tenantKey);
                if (initResult.Code != 1)
                    return CompensateProvisioningFailure(initResult, tenantKey, dbName);

                UpdateTenantSysConfig(mainClient, newDbConn, OsClientDefault.OsClientDbType,
                    tenantKey, systemName);
                if (!databaseZipPath.DosIsNullOrWhiteSpace())
                    PauseRestoredTenantSchedules(newDbConn, OsClientDefault.OsClientDbType);
                lease.ThrowIfLost();

                var reloadResult = MicroiEngine.GetService<IOsClientRuntime>()
                    .ReloadSingleOsClient(tenantKey);
                if (reloadResult.Code != 1)
                {
                    return CompensateProvisioningFailure(
                        new DosResult(0, reloadResult.Data, "刷新租户运行配置失败：" + reloadResult.Msg),
                        tenantKey, dbName);
                }
                lease.ThrowIfLost();

                var success = new DosResult(1, new
                {
                    OsClient = tenantKey,
                    DbName = dbName,
                    SystemName = systemName,
                    DomainName = domainName,
                    Url = "https://" + domainName,
                    OsClientType = osClientType,
                    OsClientNetwork = osClientNetwork,
                    DbType = OsClientDefault.OsClientDbType,
                    AdminAccount = "admin",
                    DatabaseSource = databaseZipPath.DosIsNullOrWhiteSpace() ? "OfficialEmpty" : "CustomZip",
                    DatabaseZipName = databaseZipPath.DosIsNullOrWhiteSpace() ? null : databaseZipName,
                    DatabaseImport = importResult.Data
                }, "SaaS租户创建成功。");
                success.DataAppend = addTenantResult.DataAppend;
                return success;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi: Admin tenant provisioning failed: " + ex.Message);
                var failure = new DosResult(0, null, "SaaS租户创建失败：" + ex.Message);
                return databaseCreated
                    ? CompensateProvisioningFailure(failure, tenantKey, dbName)
                    : failure;
            }
            finally
            {
                lease?.Dispose();
            }
        }

        private DosResult CompensateProvisioningFailure(DosResult failure, string osClient, string dbName)
        {
            var rollback = RollbackTenantProvisioning(osClient, dbName);
            var suffix = rollback.Code == 1
                ? "；本次创建的租户记录、数据库及专属账号已回滚。"
                : "；自动回滚未完全成功，请按租户Key核查残留资源。";
            return new DosResult(0, failure?.Data, (failure?.Msg ?? "租户开通失败。") + suffix);
        }

        public DosResult GetUserTenant(string userId)
        {
            try
            {
                if (userId.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(2, null, "UserId is required.");
                }

                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                EnsureProvisioningColumns(mainClient);

                var row = mainClient.Db.FromSql(
                        "SELECT Id, OsClient, ClientName, DomainName FROM sys_osclients WHERE IsDeleted = 0 AND OwnerUserId = @p0")
                    .AddInParameter("p0", userId)
                    .First<dynamic>();

                if (row == null)
                {
                    return new DosResult(2, null, "Tenant does not exist.");
                }

                string rowDomainName = row.DomainName == null ? "" : row.DomainName.ToString();
                string rowOsClient = row.OsClient == null ? "" : row.OsClient.ToString();
                return new DosResult(1, new
                {
                    Id = row.Id,
                    OsClient = rowOsClient,
                    ClientName = row.ClientName,
                    DomainName = rowDomainName,
                    Url = rowDomainName.DosIsNullOrWhiteSpace()
                        ? $"https://{rowOsClient}.microi.net"
                        : (rowDomainName.StartsWith("http") ? rowDomainName : $"https://{rowDomainName}")
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        public DosResult GetUserTenants(string userId)
        {
            try
            {
                if (userId.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "UserId is required.");
                }

                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                if (mainClient == null)
                {
                    return new DosResult(0, null, "主租户OsClient未初始化。");
                }

                EnsureProvisioningColumns(mainClient);
                var list = mainClient.Db.FromSql(
                        @"SELECT Id, OsClient, ClientName, DomainName, IsEnable, CreateTime, UpdateTime
                          FROM sys_osclients
                          WHERE IsDeleted = 0 AND OwnerUserId = @p0
                          ORDER BY CreateTime DESC")
                    .AddInParameter("p0", userId)
                    .ToArray();

                var usedQuota = list?.Length ?? 0;
                var tenantDatabaseQuota = GetTenantDatabaseQuota(mainClient, userId);
                var remainingQuota = Math.Max(tenantDatabaseQuota - usedQuota, 0);

                return new DosResult(1, new
                {
                    List = list,
                    Count = usedQuota,
                    TenantDatabaseQuota = tenantDatabaseQuota,
                    FreeQuota = tenantDatabaseQuota,
                    UsedQuota = usedQuota,
                    RemainingQuota = remainingQuota,
                    CanCreateFreeTenant = usedQuota < tenantDatabaseQuota,
                    NextTenantPrice = 9.9M
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"获取用户租户列表失败：{ex.Message}");
            }
        }

        /// <summary>
        /// Reads the reversible legacy password of the default admin for one SaaS tenant.
        /// The caller must supply the website owner Id from a validated DiyToken; the target
        /// database and user are resolved entirely on the server after the ownership check.
        /// </summary>
        public DosResult GetOwnedTenantAdminCredential(string ownerUserId, string tenantKey)
        {
            try
            {
                var resolveResult = ResolveOwnedTenantAdmin(ownerUserId, tenantKey, out var context);
                if (resolveResult != null)
                {
                    return resolveResult;
                }

                var passwordEncoding = ReadNullableText(context.AdminUser, "PwdEncode");
                var decodeResult = SysUserLogic.DecodeStoredPassword(
                    ReadNullableText(context.AdminUser, "Pwd"),
                    passwordEncoding);
                if (decodeResult.Code != 1)
                {
                    return new DosResult(0, null,
                        decodeResult.Msg + " 可使用随机重置生成新的可显示密码。");
                }

                return BuildTenantAdminCredentialResult(context, decodeResult.Data, false, null);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: read owned tenant admin credential failed. Tenant={tenantKey}, Error={ex.Message}");
                return new DosResult(0, null, "读取租户管理员密码失败，请稍后重试。");
            }
        }

        /// <summary>
        /// Atomically replaces an owned SaaS tenant's default admin password with a CSPRNG
        /// value, then revokes every existing admin session. The plaintext is returned only
        /// in the short-lived no-store response prepared by the controller.
        /// </summary>
        public async Task<DosResult> ResetOwnedTenantAdminCredentialAsync(
            string ownerUserId,
            string tenantKey)
        {
            TenantProvisioningLease lease = null;
            try
            {
                var normalizedTenantKey = (tenantKey ?? "").Trim();
                lease = TenantProvisioningLease.TryAcquire(
                    "admin-credential:" + (ownerUserId ?? "").Trim() + ":" + normalizedTenantKey.ToLowerInvariant());
                if (lease == null)
                {
                    return new DosResult(0, null, "该租户的管理员密码正在重置，请勿重复提交。");
                }
                lease.ThrowIfLost();

                var resolveResult = ResolveOwnedTenantAdmin(ownerUserId, normalizedTenantKey, out var context);
                if (resolveResult != null)
                {
                    return resolveResult;
                }

                if (!ColumnExists(context.Client.Db, "sys_user", "PwdEncode"))
                {
                    return new DosResult(0, null,
                        "当前租户缺少 PwdEncode 字段，无法安全写入单向密码哈希，请先升级平台。");
                }

                var password = TenantAdminCredentialSecurity.GenerateRandomPassword();
                var passwordHash = PasswordHashSecurity.HashPassword(password);
                var assignments = new List<string>
                {
                    "Pwd = @Password",
                    "PwdEncode = @PasswordEncoding"
                };
                if (ColumnExists(context.Client.Db, "sys_user", "PwdErrorCount"))
                {
                    assignments.Add("PwdErrorCount = 0");
                }
                if (ColumnExists(context.Client.Db, "sys_user", "UpdateTime"))
                {
                    assignments.Add("UpdateTime = @UpdateTime");
                }

                var deletedWhere = ColumnExists(context.Client.Db, "sys_user", "IsDeleted")
                    ? " AND (IsDeleted IS NULL OR IsDeleted <> 1)"
                    : "";
                using (var transaction = context.Client.Db.BeginTransaction())
                {
                    lease.ThrowIfLost();
                    var command = transaction.FromSql(
                            $"UPDATE sys_user SET {string.Join(", ", assignments)} "
                            + $"WHERE Id = @AdminId AND Account = @AdminAccount{deletedWhere}")
                        .AddSensitiveInParameter("Password", passwordHash)
                        .AddInParameter("PasswordEncoding", PasswordHashSecurity.EncodingName)
                        .AddInParameter("AdminId", context.AdminUser["Id"]?.ToString())
                        .AddInParameter("AdminAccount", "admin");
                    if (assignments.Any(item => item.StartsWith("UpdateTime", StringComparison.Ordinal)))
                    {
                        command.AddInParameter("UpdateTime", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
                    }

                    var affected = command.ExecuteNonQuery();
                    if (affected != 1)
                    {
                        return new DosResult(0, null, "租户默认 admin 用户已变化，密码未重置，请刷新后重试。");
                    }
                    transaction.Commit();
                }

                DosResult revokeResult;
                try
                {
                    revokeResult = await OnlineTerminalService
                        .RevokeUserSessionsFromTrustedHostAsync(
                            context.TenantKey,
                            context.AdminUser["Id"]?.ToString(),
                            "租户所有者已重置 admin 密码，请使用新密码重新登录。")
                        .ConfigureAwait(false);
                }
                catch (Exception revokeException)
                {
                    Console.WriteLine($"Microi: revoke reset tenant admin sessions failed. Tenant={context.TenantKey}, Error={revokeException.Message}");
                    revokeResult = new DosResult(0, null, "旧登录态吊销失败，请立即联系平台管理员。");
                }

                return BuildTenantAdminCredentialResult(
                    context,
                    password,
                    true,
                    revokeResult);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: reset owned tenant admin credential failed. Tenant={tenantKey}, Error={ex.Message}");
                return new DosResult(0, null, "重置租户管理员密码失败，请稍后重试。");
            }
            finally
            {
                lease?.Dispose();
            }
        }

        private DosResult ResolveOwnedTenantAdmin(
            string ownerUserId,
            string tenantKey,
            out OwnedTenantAdminContext context)
        {
            context = null;
            ownerUserId = (ownerUserId ?? "").Trim();
            tenantKey = (tenantKey ?? "").Trim();
            if (ownerUserId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(1002, null, "登录用户无效，请重新登录。");
            }
            if (!Regex.IsMatch(tenantKey, @"^[A-Za-z][A-Za-z0-9_-]*$"))
            {
                return new DosResult(0, null, "租户标识格式不正确。");
            }
            if (string.Equals(tenantKey, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(0, null, "主租户不属于个人 SaaS 租户密码管理范围。");
            }

            var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
            if (mainClient?.Db == null)
            {
                return new DosResult(0, null, "主租户数据库尚未初始化。");
            }
            EnsureProvisioningColumns(mainClient);

            var tenantRow = mainClient.Db.FromSql(
                    @"SELECT Id, OsClient FROM sys_osclients
                      WHERE IsDeleted = 0 AND OwnerUserId = @OwnerUserId
                        AND LOWER(OsClient) = LOWER(@TenantKey)")
                .AddInParameter("OwnerUserId", ownerUserId)
                .AddInParameter("TenantKey", tenantKey)
                .First<dynamic>();
            if (tenantRow == null)
            {
                return new DosResult(0, null, "租户不存在或当前账号不是该租户所有者。");
            }

            var canonicalTenantKey = tenantRow.OsClient?.ToString() ?? "";
            var targetClient = OsClientExtend.GetClient(canonicalTenantKey);
            if (targetClient?.Db == null)
            {
                try
                {
                    MicroiEngine.GetService<IOsClientRuntime>()
                        .ReloadSingleOsClient(canonicalTenantKey);
                    targetClient = OsClientExtend.GetClient(canonicalTenantKey);
                }
                catch { }
            }
            if (targetClient?.Db == null)
            {
                return new DosResult(0, null, "租户数据库暂不可用，请稍后重试。");
            }

            var selectPasswordEncoding = ColumnExists(targetClient.Db, "sys_user", "PwdEncode")
                ? ", PwdEncode"
                : "";
            var deletedWhere = ColumnExists(targetClient.Db, "sys_user", "IsDeleted")
                ? " AND (IsDeleted IS NULL OR IsDeleted <> 1)"
                : "";
            var orderBy = ColumnExists(targetClient.Db, "sys_user", "CreateTime")
                ? " ORDER BY CreateTime"
                : "";
            var adminRow = targetClient.Db.FromSql(
                    $"SELECT Id, Account, Pwd{selectPasswordEncoding} FROM sys_user "
                    + $"WHERE Account = @AdminAccount{deletedWhere}{orderBy}")
                .AddInParameter("AdminAccount", "admin")
                .First<dynamic>();
            if (adminRow == null)
            {
                return new DosResult(0, null, "租户默认 admin 用户不存在。");
            }

            var adminUser = JObject.FromObject((object)adminRow);
            if (adminUser["PwdEncode"] == null)
            {
                adminUser["PwdEncode"] = "";
            }
            context = new OwnedTenantAdminContext
            {
                TenantKey = canonicalTenantKey,
                Client = targetClient,
                AdminUser = adminUser
            };
            return null;
        }

        private static string ReadNullableText(JObject source, string fieldName)
        {
            var token = source?[fieldName];
            return token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined
                ? ""
                : token.ToString();
        }

        private static DosResult BuildTenantAdminCredentialResult(
            OwnedTenantAdminContext context,
            string password,
            bool reset,
            DosResult revokeResult)
        {
            var sessionsRevoked = !reset || revokeResult?.Code == 1;
            var result = new DosResult(1, new
            {
                TenantKey = context.TenantKey,
                Account = "admin",
                Password = password,
                Reset = reset,
                ExpiresInSeconds = 60,
                SessionsRevoked = sessionsRevoked,
                SessionRevocation = reset ? revokeResult?.Data : null
            }, reset ? "已生成新的随机密码。" : "已读取租户管理员密码。");
            if (reset && !sessionsRevoked)
            {
                result.Msg += " 但旧登录态吊销失败，请立即联系平台管理员。";
            }
            return result;
        }

        private sealed class OwnedTenantAdminContext
        {
            public string TenantKey { get; set; }
            public OsClientSecret Client { get; set; }
            public JObject AdminUser { get; set; }
        }

        public DosResult RollbackTenantProvisioning(string osClient, string dbName)
        {
            var messages = new List<string>();
            var hasFailure = false;
            try
            {
                osClient = (osClient ?? "").Trim();
                dbName = (dbName ?? "").Trim();

                if (!Regex.IsMatch(osClient, @"^[A-Za-z][A-Za-z0-9_-]*$"))
                    return new DosResult(0, null, "回滚租户Key不合法。");
                var expectedDbName = "microi_" + osClient.Replace("-", "_");
                if (!string.Equals(dbName, expectedDbName, StringComparison.OrdinalIgnoreCase))
                    return new DosResult(0, null, "回滚数据库名与租户Key不匹配，已拒绝执行。");

                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                if (mainClient == null)
                {
                    return new DosResult(0, null, "主租户OsClient未初始化。");
                }

                if (!osClient.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        var ownerRow = mainClient.Db.FromSql(@"SELECT Id, OwnerUserId FROM sys_osclients
                                WHERE OsClient = @p0 AND IsDeleted = 0 LIMIT 1")
                            .AddInParameter("p0", osClient)
                            .First<dynamic>();
                        var ownerUserId = ownerRow == null
                            ? ""
                            : (JObject.FromObject(ownerRow)["OwnerUserId"]?.ToString() ?? "");

                        mainClient.Db.FromSql(@"DELETE FROM sys_osclients
                                WHERE OsClient = @p0 AND IsDeleted = 0")
                            .AddInParameter("p0", osClient)
                            .ExecuteNonQuery();

                        if (!ownerUserId.DosIsNullOrWhiteSpace()
                            && ColumnExists(mainClient.Db, "sys_user", "TenantId")
                            && ColumnExists(mainClient.Db, "sys_user", "TenantName"))
                        {
                            mainClient.Db.FromSql(@"UPDATE sys_user
                                    SET TenantId = NULL, TenantName = NULL, UpdateTime = @p0
                                    WHERE Id = @p1 AND TenantId = @p2")
                                .AddInParameter("p0", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                                .AddInParameter("p1", ownerUserId)
                                .AddInParameter("p2", osClient)
                                .ExecuteNonQuery();
                        }
                        messages.Add($"已回滚SaaS租户记录：{osClient}");
                    }
                    catch (Exception ex)
                    {
                        hasFailure = true;
                        messages.Add($"回滚SaaS租户记录失败：{ex.Message}");
                    }

                    try
                    {
                        OsClientExtend.ClientList.TryRemove(osClient, out _);
                        var cache = MicroiEngine.CacheTenant.Default();
                        OsClientExtend.InvalidateSaasConfigurationCache(osClient, cache);
                        cache.Remove($"Microi:{osClient}:SysConfig");
                    }
                    catch (Exception ex)
                    {
                        hasFailure = true;
                        messages.Add($"清理租户运行态失败：{ex.Message}");
                    }
                }

                if (!dbName.DosIsNullOrWhiteSpace())
                {
                    var dropResult = DropDatabase(dbName);
                    messages.Add(dropResult.Code == 1
                        ? $"已回滚租户数据库：{dbName}"
                        : $"回滚租户数据库失败：{dropResult.Msg}");
                    if (dropResult.Code != 1) hasFailure = true;
                }

                return new DosResult(hasFailure ? 0 : 1, new { Messages = messages },
                    hasFailure ? "租户开通回滚未完全成功。" : "租户开通回滚完成。");
            }
            catch (Exception ex)
            {
                messages.Add(ex.Message);
                return new DosResult(0, new { Messages = messages }, $"租户开通回滚异常：{ex.Message}");
            }
        }

        public DosResult EnsureProvisioningColumns()
        {
            try
            {
                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                if (mainClient == null)
                {
                    return new DosResult(0, null, "主租户OsClient未初始化。");
                }

                EnsureProvisioningColumns(mainClient);
                return new DosResult(1, null, "开通租户所需字段检查完成。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"检查开通租户字段失败：{ex.Message}");
            }
        }

        public DosResult BuildTenantDatabaseInfo(string tenantKey)
        {
            try
            {
                tenantKey = (tenantKey ?? "").Trim();
                if (!Regex.IsMatch(tenantKey, @"^[A-Za-z][A-Za-z0-9_-]*$"))
                {
                    return new DosResult(0, null, "租户Key必须以英文字母开头，且只能包含英文字母、数字、-、_。");
                }

                var dbName = "microi_" + tenantKey.Replace("-", "_");
                if (!Regex.IsMatch(dbName, @"^[A-Za-z0-9_]+$"))
                {
                    return new DosResult(0, null, "数据库名称不合法。");
                }

                var databaseType = DiyCommon.GetDbInfo(OsClientDefault.OsClientDbType).DbType;
                var dbUser = DatabaseAdministrationCompatibility.BuildTenantPrincipalName(databaseType, dbName);

                return new DosResult(1, new
                {
                    OsClient = tenantKey,
                    DbName = dbName,
                    DbUser = dbUser,
                    DbType = OsClientDefault.OsClientDbType,
                    CredentialScope = "DatabaseOnly",
                    DomainName = $"{tenantKey}.microi.net",
                    Url = $"https://{tenantKey}.microi.net"
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"构建租户数据库信息失败：{ex.Message}");
            }
        }

        public DosResult CreateTenantDatabase(string dbName)
        {
            try
            {
                var access = CreateTenantDatabaseAccess(dbName);
                return new DosResult(1, new
                {
                    access.DbName,
                    DbUser = access.PrincipalName,
                    DbConn = access.ConnectionString,
                    DbType = OsClientDefault.OsClientDbType,
                    CredentialScope = "DatabaseOnly"
                }, "租户数据库及独立数据库账号创建成功。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"创建租户数据库失败：{ex.Message}");
            }
        }

        public DosResult ImportTenantEmptySql(string dbConn)
        {
            if (dbConn.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "租户数据库连接字符串不能为空。");
            }

            return ImportEmptySql(dbConn, OsClientDefault.OsClientDbType);
        }

        public DosResult CreateTenantOsClient(string osClient, string dbName, string dbConn, string phone, string systemName)
        {
            try
            {
                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                if (mainClient == null)
                {
                    return new DosResult(0, null, "主租户OsClient未初始化。");
                }

                return AddOsClientRecord(mainClient, osClient, dbName, dbConn, phone, systemName);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"创建SaaS租户配置失败：{ex.Message}");
            }
        }

        public DosResult UpdateTenantOwner(string osClient, string userId, string phone, string systemName)
        {
            TenantProvisioningLease lease = null;
            try
            {
                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                if (mainClient == null)
                {
                    return new DosResult(0, null, "主租户OsClient未初始化。");
                }

                EnsureProvisioningColumns(mainClient);
                if (userId.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "租户归属用户Id不能为空。");
                }

                var dbName = "microi_" + (osClient ?? "").Replace("-", "_");
                lease = TenantProvisioningLease.TryAcquire(userId);
                if (lease == null)
                {
                    return CompensateProvisioningFailure(
                        new DosResult(0, null, "当前账号的租户开通任务正在其它节点执行，请勿重复提交。"),
                        osClient, dbName);
                }
                lease.ThrowIfLost();

                if (IsTenantOwnedByUser(mainClient, userId, osClient))
                {
                    return new DosResult(1, null, "租户归属关系已存在。");
                }

                var tenantDatabaseQuota = GetTenantDatabaseQuota(mainClient, userId);
                var usedQuota = GetOwnedTenantCount(mainClient, userId);
                if (usedQuota >= tenantDatabaseQuota)
                {
                    return CompensateProvisioningFailure(
                        BuildTenantQuotaExceededResult(tenantDatabaseQuota, usedQuota),
                        osClient, dbName);
                }

                UpdateOsClientOwner(mainClient, osClient, userId, phone, systemName);
                UpdateMainUserTenant(mainClient, userId, osClient, systemName);
                lease.ThrowIfLost();
                return new DosResult(1, null, "租户归属关系更新成功。");
            }
            catch (Exception ex)
            {
                var failure = new DosResult(0, null, $"更新租户归属关系失败：{ex.Message}");
                var dbName = "microi_" + (osClient ?? "").Replace("-", "_");
                return Regex.IsMatch(osClient ?? "", @"^[A-Za-z][A-Za-z0-9_-]*$")
                    ? CompensateProvisioningFailure(failure, osClient, dbName)
                    : failure;
            }
            finally
            {
                lease?.Dispose();
            }
        }

        private bool IsTenantOwnedByUser(OsClientSecret mainClient, string userId, string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return false;
            }

            return mainClient.Db.FromSql(@"SELECT COUNT(*) FROM sys_osclients
                    WHERE IsDeleted = 0 AND OwnerUserId = @p0 AND OsClient = @p1")
                .AddInParameter("p0", userId)
                .AddInParameter("p1", osClient)
                .ToScalar<int>() > 0;
        }

        private int GetOwnedTenantCount(OsClientSecret mainClient, string userId)
        {
            if (userId.DosIsNullOrWhiteSpace())
            {
                return 0;
            }

            return mainClient.Db.FromSql(@"SELECT COUNT(*) FROM sys_osclients
                    WHERE IsDeleted = 0 AND OwnerUserId = @p0")
                .AddInParameter("p0", userId)
                .ToScalar<int>();
        }

        private int GetTenantDatabaseQuota(OsClientSecret mainClient, string userId)
        {
            if (userId.DosIsNullOrWhiteSpace())
            {
                return 1;
            }

            var quota = mainClient.Db.FromSql(@"SELECT CASE
                        WHEN TenantDatabaseQuota IS NULL OR TenantDatabaseQuota < 1 THEN 1
                        ELSE TenantDatabaseQuota
                    END
                    FROM sys_user
                    WHERE Id = @p0 AND (IsDeleted IS NULL OR IsDeleted <> 1)")
                .AddInParameter("p0", userId)
                .ToScalar<int>();
            return quota < 1 ? 1 : quota;
        }

        private DosResult BuildTenantQuotaExceededResult(int tenantDatabaseQuota, int usedQuota)
        {
            var remainingQuota = Math.Max(tenantDatabaseQuota - usedQuota, 0);
            return new DosResult(0, new
            {
                TenantDatabaseQuota = tenantDatabaseQuota,
                FreeQuota = tenantDatabaseQuota,
                UsedQuota = usedQuota,
                RemainingQuota = remainingQuota,
                CanCreateFreeTenant = false
            }, $"当前账号的租户数据库额度已用完（已使用 {usedQuota}/{tenantDatabaseQuota}），请联系管理员充值额度后重试。");
        }

        public DosResult InitTenantAdmin(string dbConn, string phone, string userName, string encryptedPwd, string osClient)
        {
            if (dbConn.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "租户数据库连接字符串不能为空。");
            }

            return InitNewTenantData(dbConn, OsClientDefault.OsClientDbType, phone, userName, encryptedPwd, osClient);
        }

        public DosResult InitTenantSysConfig(string dbConn, string osClient, string systemName, string aiApiKey = null)
        {
            try
            {
                if (dbConn.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "租户数据库连接字符串不能为空。");
                }

                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient);
                if (mainClient == null)
                {
                    return new DosResult(0, null, "主租户OsClient未初始化。");
                }

                UpdateTenantSysConfig(mainClient, dbConn, OsClientDefault.OsClientDbType,
                    osClient, systemName, aiApiKey);
                return new DosResult(1, null, "租户系统设置初始化成功。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"初始化租户系统设置失败：{ex.Message}");
            }
        }

        private void InitTenantAiRelay(string dbConn, string dbType, string aiApiKey)
        {
            if (aiApiKey.DosIsNullOrWhiteSpace()) return;
            try
            {
                var db = MicroiORMExtensions.CreateDbSession(dbConn, (DatabaseType)Enum.Parse(typeof(DatabaseType), dbType));
                if (!db.TableExists("mic_ai")) return;
                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                var affected = db.FromSql(@"UPDATE mic_ai SET Name=@p0,AiModel=@p0,Endpoint=@p1,ApiKey=@p2,
IsEnable=1,UpdateTime=@p3 WHERE Name IN (@p0,@p4) OR AiModel IN (@p0,@p4)")
                    .AddInParameter("p0", "Microi.AI中转站")
                    .AddInParameter("p1", "https://api.itdos.com/v1")
                    .AddSensitiveInParameter("p2", aiApiKey)
                    .AddInParameter("p3", now)
                    .AddInParameter("p4", "Microi吾码AI中转站")
                    .ExecuteNonQuery();
                if (affected > 0) return;
                db.FromSql(@"INSERT INTO mic_ai(Id,CreateTime,UpdateTime,Name,AiModel,Endpoint,ApiKey,IsEnable,SystemChatMsg,Remark,IsDeleted)
VALUES(@p0,@p1,@p1,@p2,@p2,@p3,@p4,1,@p5,@p6,0)")
                    .AddInParameter("p0", Guid.NewGuid().ToString())
                    .AddInParameter("p1", now)
                    .AddInParameter("p2", "Microi.AI中转站")
                    .AddInParameter("p3", "https://api.itdos.com/v1")
                    .AddSensitiveInParameter("p4", aiApiKey)
                    .AddInParameter("p5", "你是 Microi.AI 中转站。请根据用户选择的中转模型清晰、准确地回答。")
                    .AddInParameter("p6", "ApiKey 由吾码官网个人中心生成，SaaS 开通时自动写入。")
                    .ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi: Init tenant AI relay failed. " + ex.Message);
            }
        }

        /// <summary>
        /// 确保指定租户至少有一条启用的系统设置。兼容旧空库、半初始化租户和官网开库流程。
        /// </summary>
        public DosResult EnsureTenantSysConfig(string osClient, string systemName = null)
        {
            try
            {
                osClient = (osClient ?? "").Trim();
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "OsClient不能为空。");
                }

                var tenantClient = OsClientExtend.GetClient(osClient);
                if (tenantClient == null)
                {
                    return new DosResult(0, null, $"未找到OsClient：{osClient}");
                }

                var mainClient = OsClientExtend.GetClient(OsClientDefault.OsClient) ?? tenantClient;
                CopyMainSysConfigToTenant(mainClient, tenantClient.Db, osClient);

                if (GetEnabledSysConfigCount(tenantClient.Db) == 0)
                {
                    EnableFirstSysConfigRow(tenantClient.Db);
                }

                if (GetEnabledSysConfigCount(tenantClient.Db) == 0)
                {
                    InsertMinimalSysConfig(tenantClient.Db, osClient, systemName);
                }

                NormalizeSysConfigRows(tenantClient.Db, osClient, systemName);
                UpdateTenantSysConfigField(tenantClient.Db, "SysLang", "zh-CN");
                ClearSysConfigCache(osClient);

                return GetEnabledSysConfigCount(tenantClient.Db) > 0
                    ? new DosResult(1, null, "系统设置兜底初始化成功。")
                    : new DosResult(0, null, "系统设置兜底初始化失败。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"系统设置兜底初始化异常：{ex.Message}");
            }
        }

        private void EnsureProvisioningColumns(OsClientSecret mainClient)
        {
            EnsureColumn(mainClient.Db, "sys_osclients", "OwnerUserId", "varchar(50)");
            EnsureColumn(mainClient.Db, "sys_osclients", "OwnerPhone", "varchar(50)");
            EnsureColumn(mainClient.Db, "sys_osclients", "DomainName", "varchar(500)");
            EnsureColumn(mainClient.Db, "sys_user", "TenantId", "varchar(50)");
            EnsureColumn(mainClient.Db, "sys_user", "TenantName", "varchar(200)");
            EnsureColumn(mainClient.Db, "sys_user", "TenantDatabaseQuota", "int");
        }

        private void EnsureColumn(DbSession db, string tableName, string columnName, string fieldType)
        {
            try
            {
                if (ColumnExists(db, tableName, columnName))
                {
                    return;
                }

                var dbType = db.Db.DbProvider.DatabaseType;
                var result = MicroiEngine.ORM(dbType).AddColumn(new DbServiceParam
                {
                    OsClient = OsClientDefault.OsClient,
                    TableName = tableName,
                    FieldName = columnName,
                    FieldType = fieldType,
                    FieldNotNull = false,
                    DbSession = db
                });
                if (result.Code != 1 && !db.ColumnExists(tableName, columnName))
                {
                    throw new InvalidOperationException(result.Msg ?? "字段创建失败。");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Ensure column failed. Table={tableName}, Field={columnName}, Error={ex.Message}");
                throw new InvalidOperationException(
                    $"无法为 {tableName} 创建兼容字段 {columnName}。", ex);
            }
        }

        private bool ColumnExists(DbSession db, string tableName, string columnName)
        {
            return db.ColumnExists(tableName, columnName);
        }

        private void UpdateOsClientOwner(OsClientSecret mainClient, string osClient, string userId, string phone, string systemName)
        {
            if (userId.DosIsNullOrWhiteSpace())
            {
                throw new InvalidOperationException("租户归属用户Id不能为空。");
            }

            var affected = mainClient.Db.FromSql(@"UPDATE sys_osclients
                    SET OwnerUserId = @p0, OwnerPhone = @p1, ClientName = @p2, UpdateTime = @p3
                    WHERE OsClient = @p4 AND IsDeleted = 0")
                .AddInParameter("p0", userId)
                .AddInParameter("p1", phone ?? "")
                .AddInParameter("p2", systemName ?? osClient)
                .AddInParameter("p3", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                .AddInParameter("p4", osClient)
                .ExecuteNonQuery();
            if (affected <= 0)
            {
                throw new InvalidOperationException($"未找到可绑定归属关系的租户记录：{osClient}");
            }
        }

        private void UpdateMainUserTenant(OsClientSecret mainClient, string userId, string osClient, string systemName)
        {
            if (userId.DosIsNullOrWhiteSpace())
            {
                throw new InvalidOperationException("租户归属用户Id不能为空。");
            }

            var affected = mainClient.Db.FromSql(@"UPDATE sys_user
                    SET TenantId = @p0, TenantName = @p1, UpdateTime = @p2
                    WHERE Id = @p3 AND (IsDeleted IS NULL OR IsDeleted <> 1)")
                .AddInParameter("p0", osClient)
                .AddInParameter("p1", systemName ?? osClient)
                .AddInParameter("p2", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                .AddInParameter("p3", userId)
                .ExecuteNonQuery();
            if (affected <= 0)
            {
                throw new InvalidOperationException($"未找到可绑定租户的主库用户：{userId}");
            }
        }

        private void UpdateTenantSysConfig(OsClientSecret mainClient, string newDbConn, string dbType,
            string osClient, string systemName, string aiApiKey = null)
        {
            var newDb = MicroiORMExtensions.CreateDbSession(
                newDbConn, (DatabaseType)Enum.Parse(typeof(DatabaseType), dbType));

            CopyMainSysConfigToTenant(mainClient, newDb, osClient);
            if (GetEnabledSysConfigCount(newDb) == 0)
            {
                EnableFirstSysConfigRow(newDb);
            }
            if (GetEnabledSysConfigCount(newDb) == 0)
            {
                InsertMinimalSysConfig(newDb, osClient, systemName);
            }
            NormalizeSysConfigRows(newDb, osClient, systemName);
            UpdateTenantSysConfigField(newDb, "SysLang", "zh-CN");
            InitTenantAiRelay(newDbConn, dbType, aiApiKey);

            if (GetEnabledSysConfigCount(newDb) == 0)
            {
                throw new InvalidOperationException($"租户[{osClient}]未能生成有效的系统设置。");
            }

            ClearSysConfigCache(osClient);

            try
            {
                newDb.FromSql("UPDATE sys_osclients SET OsClient = @p0, ClientName = @p1 WHERE IsDeleted = 0")
                    .AddInParameter("p0", osClient)
                    .AddInParameter("p1", systemName ?? osClient)
                    .ExecuteNonQuery();
            }
            catch { }
        }

        private void CopyMainSysConfigToTenant(OsClientSecret mainClient, DbSession newDb, string osClient)
        {
            try
            {
                const string sourceSql = "SELECT * FROM sys_config WHERE (IsDeleted IS NULL OR IsDeleted <> 1) AND IsEnable = 1 ORDER BY CreateTime DESC";
                var source = mainClient.Db.FromSql(sourceSql).First<dynamic>();
                if (source == null)
                {
                    return;
                }

                var sourceData = JObject.FromObject(source);
                var existingCount = newDb.FromSql("SELECT COUNT(*) FROM sys_config WHERE IsDeleted IS NULL OR IsDeleted <> 1").ToScalar<int>();
                if (existingCount > 0)
                {
                    UpdateSysConfigFromTemplate(newDb, sourceData, osClient);
                }
                else
                {
                    InsertSysConfigFromTemplate(newDb, sourceData, osClient);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Copy main sys_config failed. OsClient={osClient}, Error={ex.Message}");
            }
        }

        private int GetEnabledSysConfigCount(DbSession db)
        {
            try
            {
                var isDeletedWhere = ColumnExists(db, "sys_config", "IsDeleted")
                    ? "(IsDeleted IS NULL OR IsDeleted <> 1)"
                    : "1 = 1";
                var isEnableWhere = ColumnExists(db, "sys_config", "IsEnable")
                    ? "IsEnable = 1"
                    : "1 = 1";
                return db.FromSql($"SELECT COUNT(*) FROM sys_config WHERE {isDeletedWhere} AND {isEnableWhere}")
                    .ToScalar<int>();
            }
            catch
            {
                return 0;
            }
        }

        private void EnableFirstSysConfigRow(DbSession db)
        {
            try
            {
                if (!ColumnExists(db, "sys_config", "IsEnable"))
                {
                    return;
                }

                var where = ColumnExists(db, "sys_config", "IsDeleted")
                    ? "WHERE IsDeleted IS NULL OR IsDeleted <> 1"
                    : "";
                var updateDeleted = ColumnExists(db, "sys_config", "IsDeleted")
                    ? $", {QuoteField("IsDeleted")} = 0"
                    : "";
                db.FromSql($"UPDATE sys_config SET {QuoteField("IsEnable")} = 1{updateDeleted} {where}")
                    .ExecuteNonQuery();
            }
            catch { }
        }

        private void InsertMinimalSysConfig(DbSession db, string osClient, string systemName)
        {
            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var displayName = systemName.DosIsNullOrWhiteSpace() ? osClient : systemName;
            var fields = new List<string>();
            var parameters = new List<string>();
            var values = new List<KeyValuePair<string, object>>();

            void AddField(string fieldName, object value)
            {
                if (!ColumnExists(db, "sys_config", fieldName) || fields.Contains(QuoteField(fieldName)))
                {
                    return;
                }
                var paramName = "MinimalSysConfig" + values.Count;
                fields.Add(QuoteField(fieldName));
                parameters.Add("@" + paramName);
                values.Add(new KeyValuePair<string, object>(paramName, value));
            }

            AddField("Id", Guid.NewGuid().ToString());
            AddField("CreateTime", now);
            AddField("UpdateTime", now);
            AddField("IsDeleted", 0);
            AddField("IsEnable", 1);
            AddField("OsClient", osClient);
            AddField("ConfigName", "未配置");
            AddField("PeizhiMC", "未配置");
            AddField("SysTitle", displayName);
            AddField("SysShortTitle", displayName);
            AddField("CompanyName", displayName);
            AddField("SysLang", "zh-CN");
            AddField("SysLangs", "zh-CN,zh-TW,en");

            if (fields.Count == 0)
            {
                return;
            }

            var cmd = db.FromSql($"INSERT INTO sys_config ({string.Join(", ", fields)}) VALUES ({string.Join(", ", parameters)})");
            foreach (var item in values)
            {
                cmd.AddInParameter(item.Key, item.Value);
            }
            cmd.ExecuteNonQuery();
        }

        private void ClearSysConfigCache(string osClient)
        {
            try
            {
                var cacheKey = $"Microi:{osClient}:SysConfig";
                MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync(cacheKey).GetAwaiter().GetResult();
                MicroiEngine.CacheTenant.Default().RemoveAsync(cacheKey).GetAwaiter().GetResult();
            }
            catch { }
        }

        private void UpdateSysConfigFromTemplate(DbSession db, JObject sourceData, string osClient)
        {
            var skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Id", "CreateTime", "CreateUser", "UpdateTime", "UpdateUser", "IsDeleted", "OsClient"
            };
            var assignments = new List<string>();
            var values = new List<KeyValuePair<string, object>>();
            var index = 0;

            foreach (var prop in sourceData.Properties())
            {
                if (skip.Contains(prop.Name)
                    || !TenantConfigurationSecurity.ShouldCopySysConfigFromMain(prop.Name)
                    || !ColumnExists(db, "sys_config", prop.Name))
                {
                    continue;
                }

                var paramName = "SysConfigField" + index++;
                assignments.Add($"{QuoteField(prop.Name)} = @{paramName}");
                values.Add(new KeyValuePair<string, object>(paramName,
                    prop.Value.Type == JTokenType.Null ? null : prop.Value.ToString()));
            }

            if (ColumnExists(db, "sys_config", "OsClient") && !assignments.Any(d => d.StartsWith(QuoteField("OsClient"))))
            {
                assignments.Add($"{QuoteField("OsClient")} = @SysConfigOsClient");
                values.Add(new KeyValuePair<string, object>("SysConfigOsClient", osClient));
            }
            if (ColumnExists(db, "sys_config", "UpdateTime"))
            {
                assignments.Add($"{QuoteField("UpdateTime")} = @SysConfigUpdateTime");
                values.Add(new KeyValuePair<string, object>("SysConfigUpdateTime", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")));
            }

            if (assignments.Count == 0)
            {
                return;
            }

            var cmd = db.FromSql($"UPDATE sys_config SET {string.Join(", ", assignments)} WHERE IsDeleted <> 1");
            foreach (var item in values)
            {
                cmd.AddInParameter(item.Key, item.Value);
            }
            cmd.ExecuteNonQuery();
        }

        private void NormalizeSysConfigRows(DbSession db, string osClient, string systemName)
        {
            try
            {
                var displayName = systemName.DosIsNullOrWhiteSpace() ? osClient : systemName;
                if (!ColumnExists(db, "sys_config", "Id"))
                {
                    UpdateTenantSysConfigField(db, "SysTitle", displayName);
                    UpdateTenantSysConfigField(db, "SysShortTitle", displayName);
                    UpdateTenantSysConfigField(db, "CompanyName", displayName);
                    UpdateTenantSysConfigField(db, "PeizhiMC", displayName);
                    UpdateTenantSysConfigField(db, "ConfigName", "默认配置");
                    UpdateTenantSysConfigField(db, "OsClient", osClient);
                    return;
                }

                var aliveWhere = ColumnExists(db, "sys_config", "IsDeleted")
                    ? "(IsDeleted IS NULL OR IsDeleted <> 1)"
                    : "1 = 1";
                var orderBy = ColumnExists(db, "sys_config", "IsEnable")
                    ? "ORDER BY IsEnable DESC, CreateTime DESC"
                    : "ORDER BY CreateTime DESC";
                var keepSql = $"SELECT Id FROM sys_config WHERE {aliveWhere} {orderBy}";
                var keepId = db.FromSql(keepSql).ToScalar<string>();
                if (keepId.DosIsNullOrWhiteSpace())
                {
                    InsertMinimalSysConfig(db, osClient, displayName);
                    keepId = db.FromSql(keepSql).ToScalar<string>();
                }
                if (keepId.DosIsNullOrWhiteSpace())
                {
                    return;
                }

                if (ColumnExists(db, "sys_config", "IsDeleted"))
                {
                    db.FromSql($"UPDATE sys_config SET {QuoteField("IsDeleted")} = 1 WHERE Id <> @p0")
                        .AddInParameter("p0", keepId)
                        .ExecuteNonQuery();
                    db.FromSql($"UPDATE sys_config SET {QuoteField("IsDeleted")} = 0 WHERE Id = @p0")
                        .AddInParameter("p0", keepId)
                        .ExecuteNonQuery();
                }
                if (ColumnExists(db, "sys_config", "IsEnable"))
                {
                    db.FromSql($"UPDATE sys_config SET {QuoteField("IsEnable")} = 0 WHERE Id <> @p0")
                        .AddInParameter("p0", keepId)
                        .ExecuteNonQuery();
                    db.FromSql($"UPDATE sys_config SET {QuoteField("IsEnable")} = 1 WHERE Id = @p0")
                        .AddInParameter("p0", keepId)
                        .ExecuteNonQuery();
                }

                UpdateTenantSysConfigSingleRowField(db, keepId, "OsClient", osClient);
                UpdateTenantSysConfigSingleRowField(db, keepId, "SysTitle", displayName);
                UpdateTenantSysConfigSingleRowField(db, keepId, "SysShortTitle", displayName);
                UpdateTenantSysConfigSingleRowField(db, keepId, "CompanyName", displayName);
                UpdateTenantSysConfigSingleRowField(db, keepId, "PeizhiMC", displayName);
                UpdateTenantSysConfigSingleRowField(db, keepId, "ConfigName", "默认配置");
                UpdateTenantSysConfigSingleRowField(db, keepId, "UpdateTime", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Normalize sys_config failed. OsClient={osClient}, Error={ex.Message}");
            }
        }

        private void UpdateTenantSysConfigSingleRowField(DbSession db, string id, string fieldName, string value)
        {
            try
            {
                if (id.DosIsNullOrWhiteSpace() || !ColumnExists(db, "sys_config", fieldName))
                {
                    return;
                }

                db.FromSql($"UPDATE sys_config SET {QuoteField(fieldName)} = @p0 WHERE Id = @p1")
                    .AddInParameter("p0", value ?? "")
                    .AddInParameter("p1", id)
                    .ExecuteNonQuery();
            }
            catch { }
        }

        private void InsertSysConfigFromTemplate(DbSession db, JObject sourceData, string osClient)
        {
            var skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Id", "CreateTime", "CreateUser", "UpdateTime", "UpdateUser", "IsDeleted", "IsEnable", "OsClient"
            };
            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var fields = new List<string>();
            var parameters = new List<string>();
            var values = new List<KeyValuePair<string, object>>();

            void AddField(string fieldName, object value)
            {
                if (!ColumnExists(db, "sys_config", fieldName) || fields.Contains(QuoteField(fieldName)))
                {
                    return;
                }
                var paramName = "InsertSysConfig" + values.Count;
                fields.Add(QuoteField(fieldName));
                parameters.Add("@" + paramName);
                values.Add(new KeyValuePair<string, object>(paramName, value));
            }

            AddField("Id", Guid.NewGuid().ToString());
            AddField("CreateTime", now);
            AddField("UpdateTime", now);
            AddField("IsDeleted", 0);
            AddField("IsEnable", 1);
            AddField("OsClient", osClient);

            foreach (var prop in sourceData.Properties())
            {
                if (skip.Contains(prop.Name)
                    || !TenantConfigurationSecurity.ShouldCopySysConfigFromMain(prop.Name))
                {
                    continue;
                }
                AddField(prop.Name, prop.Value.Type == JTokenType.Null ? null : prop.Value.ToString());
            }

            if (fields.Count == 0)
            {
                return;
            }

            var cmd = db.FromSql($"INSERT INTO sys_config ({string.Join(", ", fields)}) VALUES ({string.Join(", ", parameters)})");
            foreach (var item in values)
            {
                cmd.AddInParameter(item.Key, item.Value);
            }
            cmd.ExecuteNonQuery();
        }

        private void UpdateTenantSysConfigField(DbSession db, string fieldName, string value)
        {
            try
            {
                if (!ColumnExists(db, "sys_config", fieldName))
                {
                    return;
                }

                var field = QuoteField(fieldName);
                db.FromSql($"UPDATE sys_config SET {field} = @p0 WHERE IsDeleted <> 1")
                    .AddInParameter("p0", value ?? "")
                    .ExecuteNonQuery();
            }
            catch { }
        }

        private sealed class TenantDatabaseAccess
        {
            public string DbName { get; set; }
            public string PrincipalName { get; set; }
            public string ConnectionString { get; set; }
        }

        /// <summary>
        /// 原子创建租户数据库及数据库级账号。所有数据库方言、账号命名、密码生成和
        /// 连接串替换都由 Dos.ORM 统一实现；本服务只负责执行受控计划。
        /// </summary>
        private TenantDatabaseAccess CreateTenantDatabaseAccess(string dbName)
        {
            var databaseCreated = false;
            var principalCreated = false;
            DbSession masterDb = null;
            DatabaseAdministrationCommands databaseCommands = null;
            DatabasePrincipalAdministrationCommands principalCommands = null;
            try
            {
                var databaseType = DiyCommon.GetDbInfo(OsClientDefault.OsClientDbType).DbType;
                var principalName = DatabaseAdministrationCompatibility.BuildTenantPrincipalName(databaseType, dbName);
                var password = DatabaseAdministrationCompatibility.GenerateSecurePassword();
                databaseCommands = DatabaseAdministrationCompatibility.BuildCommands(databaseType, dbName);
                principalCommands = DatabaseAdministrationCompatibility.BuildPrincipalCommands(
                    databaseType, dbName, principalName);

                var masterConnStr = DatabaseAdministrationCompatibility.BuildMasterConnectionString(
                    databaseType, OsClientDefault.OsClientDbConn);
                masterDb = MicroiORMExtensions.CreateDbSession(masterConnStr, databaseType);

                var databaseExists = masterDb.FromSql(databaseCommands.ExistsSql)
                    .AddInParameter("p0", dbName)
                    .ToScalar<int>();
                var principalExists = masterDb.FromSql(principalCommands.ExistsSql)
                    .AddInParameter("p0", principalName)
                    .AddInParameter("p1", "%")
                    .ToScalar<int>();
                if (databaseExists > 0 || principalExists > 0)
                {
                    throw new InvalidOperationException(
                        "租户数据库或专属账号已存在，为避免覆盖现有资源已停止创建，请先核对并清理同名残留资源。");
                }

                masterDb.FromSql(databaseCommands.CreateSql).ExecuteNonQuery();
                databaseCreated = true;

                masterDb.FromSql(principalCommands.CreateSql)
                    .AddSensitiveInParameter("p0", password)
                    .ExecuteNonQuery();
                principalCreated = true;
                masterDb.FromSql(principalCommands.GrantSql).ExecuteNonQuery();

                var scopedConnection = DatabaseAdministrationCompatibility.BuildScopedConnectionString(
                    databaseType,
                    OsClientDefault.OsClientDbConn,
                    dbName,
                    principalName,
                    password);
                var tenantDb = MicroiORMExtensions.CreateDbSession(scopedConnection, databaseType);
                var selectedDatabase = tenantDb.FromSql("SELECT DATABASE()").ToScalar<string>();
                if (!string.Equals(selectedDatabase, dbName, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("租户专属数据库账号连接自检失败。");
                }

                Console.WriteLine($"Microi：【成功】租户数据库[{dbName}]及专属账号创建成功。");
                return new TenantDatabaseAccess
                {
                    DbName = dbName,
                    PrincipalName = principalName,
                    ConnectionString = scopedConnection
                };
            }
            catch
            {
                if (masterDb != null && principalCreated && principalCommands != null)
                {
                    try { masterDb.FromSql(principalCommands.DropSql).ExecuteNonQuery(); } catch { }
                }
                if (masterDb != null && databaseCreated && databaseCommands != null)
                {
                    try
                    {
                        masterDb.FromSql(databaseCommands.DropSql)
                            .AddInParameter("p0", dbName)
                            .ExecuteNonQuery();
                    }
                    catch { }
                }
                throw;
            }
        }

        private DosResult DropDatabase(string dbName)
        {
            var errors = new List<string>();
            if (!Regex.IsMatch(dbName ?? "", @"^microi_[a-zA-Z0-9_]+$"))
            {
                return new DosResult(0, null, "数据库名称不符合租户数据库命名规则！");
            }

            try
            {
                var databaseType = DiyCommon.GetDbInfo(OsClientDefault.OsClientDbType).DbType;
                var masterConnStr = DatabaseAdministrationCompatibility.BuildMasterConnectionString(
                    databaseType, OsClientDefault.OsClientDbConn);
                var masterDb = MicroiORMExtensions.CreateDbSession(
                    masterConnStr, databaseType);
                var databaseCommands = DatabaseAdministrationCompatibility.BuildCommands(databaseType, dbName);
                var principalName = DatabaseAdministrationCompatibility.BuildTenantPrincipalName(databaseType, dbName);
                var principalCommands = DatabaseAdministrationCompatibility.BuildPrincipalCommands(
                    databaseType, dbName, principalName);
                try
                {
                    masterDb.FromSql(principalCommands.DropSql).ExecuteNonQuery();
                }
                catch (Exception ex)
                {
                    errors.Add("删除专属数据库账号失败：" + ex.Message);
                }
                try
                {
                    masterDb.FromSql(databaseCommands.DropSql)
                        .AddInParameter("p0", dbName)
                        .ExecuteNonQuery();
                }
                catch (Exception ex)
                {
                    errors.Add("删除租户数据库失败：" + ex.Message);
                }

                return errors.Count == 0
                    ? new DosResult(1, new { DbName = dbName, DbUser = principalName },
                        "租户数据库及专属数据库账号已删除。")
                    : new DosResult(0, new { DbName = dbName, Errors = errors },
                        "租户数据库或专属账号未完全删除。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"删除数据库失败：{ex.Message}");
            }
        }

        /// <summary>
        /// 空库SQL CDN下载地址
        /// </summary>
        private const string EmptySqlCdnUrl = "https://static.itdos.com/install/microi_empty_mysql57.sql.zip";
        private const string EmptySqlObjectPath = "/install/microi_empty_mysql57.sql.zip";
        private static readonly HttpClient EmptySqlDownloadHttpClient = new HttpClient
        {
            Timeout = TimeSpan.FromMinutes(5)
        };

        /// <summary>
        /// 导入空库SQL文件到新数据库。
        /// 官网开通租户必须每次从CDN重新下载，避免模板包更新后继续复用旧文件。
        /// </summary>
        private DosResult ImportEmptySql(string newDbConn, string dbType)
        {
            var sqlFilePath = "";
            try
            {
                var tempDir = Path.Combine(Path.GetTempPath(), "microi-empty-sql");
                sqlFilePath = Path.Combine(tempDir, $"microi_empty_mysql57_{DateTime.Now:yyyyMMddHHmmss}_{Guid.NewGuid():N}.sql");
                Console.WriteLine("Microi：正在从CDN获取最新空库SQL模板...");
                var downloadResult = DownloadAndExtractEmptySql(sqlFilePath);
                if (downloadResult.Code != 1)
                {
                    return downloadResult;
                }

                if (!File.Exists(sqlFilePath))
                {
                    return new DosResult(0, null, $"空库SQL文件不存在：{sqlFilePath}");
                }

                var sqlContent = File.ReadAllText(sqlFilePath, Encoding.UTF8);
                var databaseType = DiyCommon.GetDbInfo(dbType).DbType;
                var newDb = MicroiORMExtensions.CreateDbSession(newDbConn, databaseType);
                var importResult = DatabaseSeedImporter.ImportMySql57(newDb, sqlContent);

                if (!newDb.TableExists("sys_user") || !newDb.TableExists("sys_menu")
                    || !newDb.TableExists("sys_apiengine") || !newDb.TableExists("diy_table")
                    || !newDb.TableExists("diy_field"))
                {
                    throw new InvalidOperationException("导入后的空库缺少核心表。");
                }
                var userTable = newDb.Db.DbProvider.BuildTableName("sys_user", null);
                var accountField = newDb.Db.DbProvider.BuildTableName("Account", null);
                var deletedField = newDb.Db.DbProvider.BuildTableName("IsDeleted", null);
                var adminCount = newDb.FromSql($"SELECT COUNT(1) FROM {userTable} WHERE {accountField}=@p0 AND ({deletedField} IS NULL OR {deletedField}<>1)")
                    .AddInParameter("p0", "admin")
                    .ToScalar<int>();
                if (adminCount < 1)
                {
                    throw new InvalidOperationException("导入后的空库缺少默认 admin 用户。");
                }
                Console.WriteLine("Microi：" + importResult.Summary + "，核心表和默认 admin 校验成功。");
                return new DosResult(1, new
                {
                    StatementCount = importResult.BatchCount,
                    importResult.BatchCount,
                    importResult.TableCount,
                    importResult.RowCount,
                    importResult.Converted,
                    AdminValidated = true,
                    SeedPackage = downloadResult.Data
                }, importResult.Summary + "，核心表和默认 admin 校验成功。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"导入SQL失败：{ex.Message}");
            }
            finally
            {
                try { if (!sqlFilePath.DosIsNullOrWhiteSpace() && File.Exists(sqlFilePath)) File.Delete(sqlFilePath); } catch { }
            }
        }

        /// <summary>
        /// 从CDN下载空库SQL ZIP文件并解压
        /// </summary>
        private DosResult DownloadAndExtractEmptySql(string targetSqlPath)
        {
            var tempZipPath = targetSqlPath + ".download.zip";
            try
            {
                // 确保目标目录存在
                var targetDir = Path.GetDirectoryName(targetSqlPath);
                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                // 后端优先直接读取 iTdos 公有桶，避免 CDN 长缓存导致新租户仍导入旧模板。
                var downloadedFromBucket = false;
                var packageSource = "";
                try
                {
                    var clientModel = OsClientExtend.GetClient("iTdos");
                    if (clientModel != null)
                    {
                        var hdfs = clientModel.OsClientModel?["HDFS"]?.ToString() switch
                        {
                            "MinIO" => MicroiEngine.HDFSFactory(HDFSType.MinIO),
                            "S3" => MicroiEngine.HDFSFactory(HDFSType.AmazonS3),
                            _ => MicroiEngine.HDFSFactory(HDFSType.Aliyun)
                        };
                        var objectResult = hdfs.GetPrivateFileUrl(new HDFSParam
                        {
                            ClientModel = clientModel,
                            Limit = false,
                            FileFullPath = EmptySqlObjectPath,
                            ReturnFileType = "Byte"
                        }).GetAwaiter().GetResult();
                        if (objectResult?.Code == 1 && objectResult.Data is byte[] objectBytes && objectBytes.Length > 0)
                        {
                            File.WriteAllBytes(tempZipPath, objectBytes);
                            downloadedFromBucket = true;
                            packageSource = "AliyunOssPublicBucket";
                            Console.WriteLine($"Microi：已直接从公有桶读取最新空库SQL，共 {objectBytes.Length} 字节");
                        }
                    }
                }
                catch (Exception bucketEx)
                {
                    Console.WriteLine("Microi：直接读取空库公有桶失败，将回退CDN：" + bucketEx.Message);
                }

                if (!downloadedFromBucket)
                {
                    Console.WriteLine($"Microi：正在从CDN下载空库SQL：{EmptySqlCdnUrl}");

                    var downloadUrl = EmptySqlCdnUrl + "?t=" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    using (var request = new HttpRequestMessage(HttpMethod.Get, downloadUrl))
                    {
                        request.Headers.CacheControl =
                            new System.Net.Http.Headers.CacheControlHeaderValue { NoCache = true, NoStore = true };
                        using var response = EmptySqlDownloadHttpClient.SendAsync(
                                request,
                                HttpCompletionOption.ResponseHeadersRead)
                            .GetAwaiter()
                            .GetResult();
                        if (!response.IsSuccessStatusCode)
                        {
                            return new DosResult(0, null, $"下载空库SQL失败，HTTP {(int)response.StatusCode}");
                        }

                        using (var fs = new FileStream(tempZipPath, FileMode.Create, FileAccess.Write))
                        {
                            response.Content.CopyToAsync(fs).GetAwaiter().GetResult();
                        }
                        packageSource = "CDNCacheBusted";
                    }
                }

                Console.WriteLine("Microi：下载完成，正在解压...");
                var packageSha256 = ComputeFileSha256(tempZipPath);
                var packageBytes = new FileInfo(tempZipPath).Length;

                // 解压ZIP文件，查找规范包中的 MySQL 5.7 SQL 文件。
                var found = false;
                var sqlEntryName = "";
                using (var zipStream = new FileStream(tempZipPath, FileMode.Open, FileAccess.Read))
                using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Read))
                {
                    foreach (var entry in archive.Entries)
                    {
                        // 包内 SQL 文件名允许随发布规范演进，但只能选择非空 .sql 文件。
                        if (entry.Name.EndsWith(".sql", StringComparison.OrdinalIgnoreCase) && entry.Length > 0)
                        {
                            using (var entryStream = entry.Open())
                            using (var outStream = new FileStream(targetSqlPath, FileMode.Create, FileAccess.Write))
                            {
                                entryStream.CopyTo(outStream);
                            }
                            found = true;
                            sqlEntryName = entry.Name;
                            Console.WriteLine($"Microi：已解压SQL文件：{entry.Name} -> {targetSqlPath}");
                            break;
                        }
                    }
                }

                if (!found)
                {
                    return new DosResult(0, null, "ZIP文件中未找到SQL文件");
                }

                Console.WriteLine("Microi：空库SQL文件下载解压完成");
                return new DosResult(1, new
                {
                    Source = packageSource,
                    ObjectPath = EmptySqlObjectPath,
                    PackageSha256 = packageSha256,
                    PackageBytes = packageBytes,
                    SqlEntryName = sqlEntryName,
                    SqlSha256 = ComputeFileSha256(targetSqlPath),
                    SqlBytes = new FileInfo(targetSqlPath).Length
                }, "下载解压成功");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】下载空库SQL失败：{ex.Message}");
                return new DosResult(0, null, $"下载空库SQL失败：{ex.Message}");
            }
            finally
            {
                // 清理临时ZIP文件
                try { if (File.Exists(tempZipPath)) File.Delete(tempZipPath); } catch { }
            }
        }

        private static string ComputeFileSha256(string path)
        {
            using (var stream = File.OpenRead(path))
            using (var sha256 = SHA256.Create())
            {
                return BitConverter.ToString(sha256.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
            }
        }

        private const long MaxTenantSqlZipBytes = 256L * 1024 * 1024;
        private const long MaxTenantSqlBytes = 512L * 1024 * 1024;
        private const long MaxTenantSqlCompressionRatio = 250;

        private sealed class TenantSqlZipPackage
        {
            public string EntryName { get; set; }
            public long CompressedBytes { get; set; }
            public long UncompressedBytes { get; set; }
            public string Sql { get; set; }
        }

        /// <summary>
        /// 可供定向回归测试调用的纯 ZIP 校验，不读取数据库或 HDFS，也不返回 SQL 内容。
        /// </summary>
        public static DosResult ValidateTenantSqlZipPackage(byte[] zipBytes)
        {
            try
            {
                var package = ExtractTenantSqlZipPackage(zipBytes);
                return new DosResult(1, new
                {
                    package.EntryName,
                    package.CompressedBytes,
                    package.UncompressedBytes
                }, "数据库 ZIP 校验通过。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        private DosResult ImportTenantSqlZip(OsClientSecret mainClient, string databaseZipPath,
            string databaseZipName, string newDbConn, string dbType)
        {
            try
            {
                var zipBytes = ReadPrivateTenantSqlZip(mainClient, databaseZipPath);
                var package = ExtractTenantSqlZipPackage(zipBytes);
                var databaseType = DiyCommon.GetDbInfo(dbType).DbType;
                var newDb = MicroiORMExtensions.CreateDbSession(newDbConn, databaseType);
                var importResult = DatabaseSeedImporter.ImportMySql57(newDb, package.Sql);
                ValidateImportedTenantDatabase(newDb);

                Console.WriteLine($"Microi：自定义数据库包[{databaseZipName}]导入成功，SQL={package.EntryName}。");
                return new DosResult(1, new
                {
                    StatementCount = importResult.BatchCount,
                    importResult.BatchCount,
                    importResult.TableCount,
                    importResult.RowCount,
                    importResult.Converted,
                    package.EntryName,
                    package.CompressedBytes,
                    package.UncompressedBytes,
                    AdminValidated = true
                }, importResult.Summary + "，核心表和默认 admin 校验成功。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "导入自定义数据库 ZIP 失败：" + ex.Message);
            }
        }

        private static byte[] ReadPrivateTenantSqlZip(OsClientSecret mainClient, string databaseZipPath)
        {
            var path = (databaseZipPath ?? "").Trim().Replace('\\', '/').TrimStart('/');
            if (path.DosIsNullOrWhiteSpace() || path.Contains("..") || path.Contains(":")
                || path.Contains("?") || path.Contains("#"))
                throw new InvalidOperationException("数据库 ZIP 私有文件路径不合法。");

            var expectedPrefix = (OsClientDefault.OsClient ?? "").Trim().ToLowerInvariant() + "/file/";
            if (expectedPrefix == "/file/"
                || !path.StartsWith(expectedPrefix, StringComparison.OrdinalIgnoreCase)
                || !path.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("数据库 ZIP 必须来自当前主租户的私有 file 目录。");

            var hdfsName = mainClient.OsClientModel?["HDFS"]?.ToString();
            var hdfs = string.Equals(hdfsName, "MinIO", StringComparison.OrdinalIgnoreCase)
                ? MicroiEngine.HDFSFactory(HDFSType.MinIO)
                : string.Equals(hdfsName, "S3", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(hdfsName, "AmazonS3", StringComparison.OrdinalIgnoreCase)
                    ? MicroiEngine.HDFSFactory(HDFSType.AmazonS3)
                    : MicroiEngine.HDFSFactory(HDFSType.Aliyun);
            var result = hdfs.GetPrivateFileUrl(new HDFSParam
            {
                ClientModel = mainClient,
                Limit = true,
                FileFullPath = path,
                ReturnFileType = "Byte"
            }).GetAwaiter().GetResult();
            if (result?.Code != 1 || !(result.Data is byte[] bytes) || bytes.Length == 0)
                throw new InvalidOperationException(result?.Msg ?? "无法读取数据库 ZIP 私有文件。");
            if (bytes.LongLength > MaxTenantSqlZipBytes)
                throw new InvalidOperationException("数据库 ZIP 不能超过 256MB。");
            return bytes;
        }

        private static TenantSqlZipPackage ExtractTenantSqlZipPackage(byte[] zipBytes)
        {
            if (zipBytes == null || zipBytes.Length == 0)
                throw new InvalidOperationException("数据库 ZIP 不能为空。");
            if (zipBytes.LongLength > MaxTenantSqlZipBytes)
                throw new InvalidOperationException("数据库 ZIP 不能超过 256MB。");

            using (var zipStream = new MemoryStream(zipBytes, writable: false))
            using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Read, leaveOpen: false))
            {
                if (archive.Entries.Count != 1)
                    throw new InvalidOperationException(
                        $"ZIP 内必须且只能有一个 .sql 文件，当前检测到 {archive.Entries.Count} 个条目。");

                var entry = archive.Entries[0];
                var fullName = (entry.FullName ?? "").Replace('\\', '/');
                if (fullName.DosIsNullOrWhiteSpace() || fullName.EndsWith("/")
                    || !string.Equals(fullName, entry.Name, StringComparison.Ordinal)
                    || fullName == "." || fullName == ".." || fullName.Contains("../")
                    || fullName.Contains(":") || !fullName.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("ZIP 内必须且只能包含根目录下的一个普通 .sql 文件。");
                if (entry.Length <= 0)
                    throw new InvalidOperationException("ZIP 内的 SQL 文件不能为空。");
                if (entry.Length > MaxTenantSqlBytes)
                    throw new InvalidOperationException("SQL 解压后不能超过 512MB。");
                if (entry.Length > 10L * 1024 * 1024
                    && (entry.CompressedLength <= 0
                        || entry.Length / Math.Max(entry.CompressedLength, 1) > MaxTenantSqlCompressionRatio))
                    throw new InvalidOperationException("数据库 ZIP 压缩比异常，已按解压炸弹风险拒绝。");

                using (var entryStream = entry.Open())
                using (var output = new MemoryStream())
                {
                    var buffer = new byte[81920];
                    long total = 0;
                    int read;
                    while ((read = entryStream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        total += read;
                        if (total > MaxTenantSqlBytes || total > entry.Length)
                            throw new InvalidOperationException("SQL 解压后的实际大小超出安全限制。");
                        output.Write(buffer, 0, read);
                    }
                    if (total != entry.Length)
                        throw new InvalidOperationException("SQL 解压后的实际大小与 ZIP 元数据不一致。");

                    string sql;
                    try
                    {
                        sql = new UTF8Encoding(false, true).GetString(output.ToArray()).TrimStart('\uFEFF');
                    }
                    catch (DecoderFallbackException)
                    {
                        throw new InvalidOperationException("SQL 文件必须使用 UTF-8 编码。");
                    }
                    if (sql.DosIsNullOrWhiteSpace())
                        throw new InvalidOperationException("ZIP 内的 SQL 文件不能为空。");
                    return new TenantSqlZipPackage
                    {
                        EntryName = entry.Name,
                        CompressedBytes = entry.CompressedLength,
                        UncompressedBytes = total,
                        Sql = sql
                    };
                }
            }
        }

        private void ValidateImportedTenantDatabase(DbSession db)
        {
            if (!db.TableExists("sys_user") || !db.TableExists("sys_menu")
                || !db.TableExists("sys_apiengine") || !db.TableExists("diy_table")
                || !db.TableExists("diy_field"))
                throw new InvalidOperationException("导入后的数据库缺少 Microi 核心表。");

            var userTable = db.Db.DbProvider.BuildTableName("sys_user", null);
            var accountField = db.Db.DbProvider.BuildTableName("Account", null);
            var deletedWhere = ColumnExists(db, "sys_user", "IsDeleted")
                ? " AND (" + db.Db.DbProvider.BuildTableName("IsDeleted", null) + " IS NULL OR "
                    + db.Db.DbProvider.BuildTableName("IsDeleted", null) + "<>1)"
                : "";
            var adminCount = db.FromSql(
                    $"SELECT COUNT(1) FROM {userTable} WHERE {accountField}=@p0{deletedWhere}")
                .AddInParameter("p0", "admin")
                .ToScalar<int>();
            if (adminCount < 1)
                throw new InvalidOperationException("导入后的数据库缺少默认 admin 用户。");
        }

        private void PauseRestoredTenantSchedules(string dbConn, string dbType)
        {
            var databaseType = DiyCommon.GetDbInfo(dbType).DbType;
            var db = MicroiORMExtensions.CreateDbSession(dbConn, databaseType);
            if (db.TableExists("diy_schedule_job") && ColumnExists(db, "diy_schedule_job", "Status"))
                db.FromSql("UPDATE diy_schedule_job SET Status=@p0")
                    .AddInParameter("p0", "暂停")
                    .ExecuteNonQuery();
            if (db.TableExists("microi_job_triggers")
                && ColumnExists(db, "microi_job_triggers", "TRIGGER_STATE"))
                db.FromSql("UPDATE microi_job_triggers SET TRIGGER_STATE=@p0")
                    .AddInParameter("p0", "PAUSED")
                    .ExecuteNonQuery();
        }

        /// <summary>
        /// 分割SQL语句（处理MySQL导出格式）
        /// </summary>
        private string[] SplitSqlStatements(string sql)
        {
            // 移除MySQL特有的注释前缀
            sql = Regex.Replace(sql, @"/\*![\d]+\s*", "");
            sql = sql.Replace("*/;", ";");

            // 按单个分号分割（简化处理，适用于标准SQL导出）
            var statements = sql.Split(new[] { ";\n", ";\r\n" }, StringSplitOptions.RemoveEmptyEntries);
            return statements;
        }

        /// <summary>
        /// 在主库sys_osclients表新增租户记录
        /// </summary>
        private DosResult AddOsClientRecord(OsClientSecret mainClient, string osClient, string dbName,
            string newDbConn, string phone, string systemName, string osClientType = null,
            string osClientNetwork = null, string requestedDomainName = null)
        {
            try
            {
                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                var id = Ulid.NewUlid().ToString();
                var domainName = requestedDomainName.DosIsNullOrWhiteSpace()
                    ? $"{osClient}.microi.net"
                    : requestedDomainName.Trim();
                osClientType = osClientType.DosIsNullOrWhiteSpace()
                    ? OsClientDefault.OsClientType
                    : osClientType.Trim();
                osClientNetwork = osClientNetwork.DosIsNullOrWhiteSpace()
                    ? OsClientDefault.OsClientNetwork
                    : osClientNetwork.Trim();
                var authSecret = Ulid.NewUlid().ToString();
                var clientName = systemName.DosIsNullOrWhiteSpace() ? $"用户{phone}的工作空间" : systemName;

                var sql = @"INSERT INTO sys_osclients
                    (Id, CreateTime, UpdateTime, IsDeleted, OsClient, IsEnable, ClientName,
                     OsClientType, OsClientNetwork, DbConn, DbType, DbReadConn, DbReadType,
                     AuthSecret, DomainName, ServerTag, SessionAuthTimeout, AccessTokenLifetime)
                    VALUES
                    (@p0, @p1, @p2, 0, @p3, 1, @p4,
                     @p5, @p6, @p7, @p8, @p9, @p10,
                     @p11, @p12, @p13, '60', '30')";

                mainClient.Db.FromSql(sql)
                    .AddInParameter("p0", id)
                    .AddInParameter("p1", now)
                    .AddInParameter("p2", now)
                    .AddInParameter("p3", osClient)
                    .AddInParameter("p4", clientName)
                    .AddInParameter("p5", osClientType)
                    .AddInParameter("p6", osClientNetwork)
                    .AddSensitiveInParameter("p7", newDbConn)
                    .AddInParameter("p8", OsClientDefault.OsClientDbType)
                    .AddSensitiveInParameter("p9", newDbConn)       // DbReadConn = DbConn
                    .AddInParameter("p10", OsClientDefault.OsClientDbType)  // DbReadType = DbType
                    .AddSensitiveInParameter("p11", authSecret)
                    .AddInParameter("p12", domainName)
                    .AddInParameter("p13", osClient)        // ServerTag
                    .ExecuteNonQuery();

                CopyMainOsClientConfig(mainClient, osClient, newDbConn, clientName, domainName, authSecret);
                var serviceWarnings = ConfigureTenantServiceCredentials(mainClient, osClient);

                Console.WriteLine($"Microi：【成功】sys_osclients新增租户[{osClient}]记录成功！");
                var result = new DosResult(1);
                if (serviceWarnings.Count > 0)
                {
                    result.DataAppend = new
                    {
                        InfrastructureWarnings = serviceWarnings,
                        IsolationMode = "FailClosed"
                    };
                }
                return result;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"新增租户记录失败：{ex.Message}");
            }
        }

        private void CopyMainOsClientConfig(OsClientSecret mainClient, string osClient, string newDbConn,
            string clientName, string domainName, string authSecret)
        {
            try
            {
                const string sourceSql = @"SELECT * FROM sys_osclients
                        WHERE IsDeleted = 0 AND IsEnable = 1
                        AND OsClient = @p0 AND OsClientType = @p1 AND OsClientNetwork = @p2
                        ORDER BY CreateTime DESC";
                var source = mainClient.Db.FromSql(sourceSql)
                    .AddInParameter("p0", OsClientDefault.OsClient)
                    .AddInParameter("p1", OsClientDefault.OsClientType)
                    .AddInParameter("p2", OsClientDefault.OsClientNetwork)
                    .First<dynamic>();
                if (source == null)
                {
                    return;
                }

                var data = JObject.FromObject(source);
                var assignments = new List<string>
                {
                    $"{QuoteField("ClientName")} = @ClientName",
                    $"{QuoteField("DbConn")} = @DbConn",
                    $"{QuoteField("DbReadConn")} = @DbReadConn",
                    $"{QuoteField("AuthSecret")} = @AuthSecret",
                    $"{QuoteField("DomainName")} = @DomainName",
                    $"{QuoteField("ServerTag")} = @ServerTag",
                    $"{QuoteField("UpdateTime")} = @UpdateTime"
                };
                var copyValues = new List<KeyValuePair<string, object>>();
                var sensitiveCopyParameters = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var index = 0;
                foreach (var prop in data.Properties())
                {
                    if (!TenantConfigurationSecurity.ShouldCopyFromMain(prop.Name)
                        || !ColumnExists(mainClient.Db, "sys_osclients", prop.Name))
                    {
                        continue;
                    }
                    var paramName = "CopyField" + index++;
                    assignments.Add($"{QuoteField(prop.Name)} = @{paramName}");
                    copyValues.Add(new KeyValuePair<string, object>(paramName,
                        prop.Value.Type == JTokenType.Null ? null : prop.Value.ToString()));
                    if (TenantConfigurationSecurity.IsSensitiveConfigurationField(prop.Name))
                    {
                        sensitiveCopyParameters.Add(paramName);
                    }
                }

                var cmd = mainClient.Db.FromSql(
                    $"UPDATE sys_osclients SET {string.Join(", ", assignments)} WHERE OsClient = @WhereOsClient AND IsDeleted = 0");
                cmd.AddInParameter("ClientName", clientName ?? osClient)
                    .AddSensitiveInParameter("DbConn", newDbConn)
                    .AddSensitiveInParameter("DbReadConn", newDbConn)
                    .AddSensitiveInParameter("AuthSecret", authSecret)
                    .AddInParameter("DomainName", domainName)
                    .AddInParameter("ServerTag", osClient)
                    .AddInParameter("UpdateTime", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                    .AddInParameter("WhereOsClient", osClient);

                foreach (var item in copyValues)
                {
                    if (sensitiveCopyParameters.Contains(item.Key))
                        cmd.AddSensitiveInParameter(item.Key, item.Value);
                    else
                        cmd.AddInParameter(item.Key, item.Value);
                }
                cmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi: Copy main sys_osclients config failed. OsClient={osClient}, Error={ex.Message}");
            }
        }

        /// <summary>
        /// 重置新租户的第三方服务凭据，并仅为平台内嵌 MQTT 生成可立即生效的
        /// 租户账号。RabbitMQ/Elasticsearch 需外部管理 API 真实创建 ACL；当前项目
        /// 没有这两类管理契约，因此留空凭据并明确警告，不伪造已开通状态。
        /// </summary>
        private List<string> ConfigureTenantServiceCredentials(OsClientSecret mainClient, string osClient)
        {
            var warnings = new List<string>();
            var model = mainClient?.OsClientModel;

            var resetValues = TenantConfigurationSecurity.TenantServiceCredentialFields
                .Where(field => ColumnExists(mainClient.Db, "sys_osclients", field))
                .ToDictionary(
                    field => field,
                    GetResetTenantServiceValue,
                    StringComparer.OrdinalIgnoreCase);
            UpdateTenantServiceFields(mainClient, osClient, resetValues);

            if (IsEnabled(ReadModelValue(model, "MqttEnable")))
            {
                var mqttRequiredFields = new[] { "MqttEnable", "MqttAccount", "MqttPwd" };
                if (mqttRequiredFields.All(field => ColumnExists(mainClient.Db, "sys_osclients", field)))
                {
                    var mqttValues = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["MqttEnable"] = 1,
                        ["MqttAccount"] = TenantConfigurationSecurity.CreateTenantServiceUserName(osClient, "mqtt"),
                        ["MqttPwd"] = TenantConfigurationSecurity.GenerateRandomCredential()
                    };
                    // 旧版标准库没有这两个列；运行时对所有子租户仍强制禁匿名并强制 Topic 隔离。
                    if (ColumnExists(mainClient.Db, "sys_osclients", "MqttAllowAnonymous"))
                        mqttValues["MqttAllowAnonymous"] = 0;
                    if (ColumnExists(mainClient.Db, "sys_osclients", "MqttTopicIsolation"))
                        mqttValues["MqttTopicIsolation"] = 1;
                    UpdateTenantServiceFields(mainClient, osClient, mqttValues);
                }
                else
                {
                    warnings.Add("共享 MQTT 已启用，但 sys_osclients 缺少租户 MQTT 凭据字段；MQTT 已对该租户保持禁用。");
                }
            }

            if (!ReadModelValue(model, "MQHost").DosIsNullOrWhiteSpace())
            {
                warnings.Add("共享 RabbitMQ Broker 已配置，但未配置 RabbitMQ Management API 资源创建契约；"
                             + "未为该租户伪造账号/vhost，MQ 将 fail-closed，直到部署管理员真实创建资源并回填租户凭据。");
            }

            if (!ReadModelValue(model, "SearchEngineHost").DosIsNullOrWhiteSpace())
            {
                warnings.Add("共享搜索集群已配置，但未配置 Elasticsearch/OpenSearch 安全 API 资源创建契约；"
                             + "未为该租户伪造 API Key，搜索将 fail-closed，直到部署管理员真实创建索引 ACL 并回填租户凭据。");
            }

            foreach (var warning in warnings)
            {
                Console.WriteLine($"Microi：【租户基础设施警告】OsClient={osClient}，{warning}");
            }
            return warnings;
        }

        private static object GetResetTenantServiceValue(string fieldName)
        {
            if (string.Equals(fieldName, "MqttEnable", StringComparison.OrdinalIgnoreCase)
                || string.Equals(fieldName, "MqttAllowAnonymous", StringComparison.OrdinalIgnoreCase))
            {
                return 0;
            }
            return string.Equals(fieldName, "MqttTopicIsolation", StringComparison.OrdinalIgnoreCase)
                ? (object)1
                : string.Empty;
        }

        private void UpdateTenantServiceFields(OsClientSecret mainClient, string osClient,
            IDictionary<string, object> values)
        {
            if (values == null || values.Count == 0)
            {
                return;
            }

            var entries = values
                .Where(pair => ColumnExists(mainClient.Db, "sys_osclients", pair.Key))
                .ToList();
            if (entries.Count == 0)
            {
                return;
            }

            var assignments = entries.Select((pair, index) => $"{QuoteField(pair.Key)} = @TenantService{index}");
            var command = mainClient.Db.FromSql(
                    $"UPDATE sys_osclients SET {string.Join(", ", assignments)} WHERE OsClient = @TenantServiceOsClient AND IsDeleted = 0")
                .AddInParameter("TenantServiceOsClient", osClient);
            for (var index = 0; index < entries.Count; index++)
            {
                var pair = entries[index];
                var value = pair.Value ?? DBNull.Value;
                if (TenantConfigurationSecurity.IsSensitiveConfigurationField(pair.Key))
                {
                    command.AddSensitiveInParameter("TenantService" + index, value);
                }
                else
                {
                    command.AddInParameter("TenantService" + index, value);
                }
            }
            command.ExecuteNonQuery();
        }

        private static string ReadModelValue(JObject model, string fieldName)
        {
            var token = model?.Properties()
                .FirstOrDefault(property => string.Equals(property.Name, fieldName, StringComparison.OrdinalIgnoreCase))
                ?.Value;
            return token == null || token.Type == JTokenType.Null ? string.Empty : token.ToString().Trim();
        }

        private static bool IsEnabled(string value)
        {
            var text = (value ?? string.Empty).Trim();
            return string.Equals(text, "1", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(text, "yes", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(text, "on", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(text, "enabled", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(text, "是", StringComparison.OrdinalIgnoreCase);
        }

        private string QuoteField(string fieldName)
        {
            return MicroiEngine.ORM(DiyCommon.GetDbInfo(OsClientDefault.OsClientDbType).DbType)
                .GetFieldName(fieldName);
        }

        /// <summary>
        /// 初始化新租户数据（复用空库模板默认管理员、系统配置等）
        /// </summary>
        private DosResult InitNewTenantData(string newDbConn, string dbType,
            string phone, string userName, string encryptedPwd, string osClient)
        {
            try
            {
                newDbConn = (newDbConn ?? "").Trim();
                dbType = (dbType ?? OsClientDefault.OsClientDbType ?? "").Trim();
                phone = (phone ?? "").Trim();
                userName = (userName ?? "").Trim();
                encryptedPwd = (encryptedPwd ?? "").Trim();
                osClient = (osClient ?? "").Trim();

                var newDb = MicroiORMExtensions.CreateDbSession(
                    newDbConn, (DatabaseType)Enum.Parse(typeof(DatabaseType), dbType));
                {
                    var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                    const string adminSql = @"SELECT Id FROM sys_user
                            WHERE Account = @p0 AND (IsDeleted IS NULL OR IsDeleted <> 1)
                            ORDER BY CreateTime";
                    var adminRow = newDb.FromSql(adminSql)
                        .AddInParameter("p0", "admin")
                        .First<dynamic>();
                    var adminId = adminRow?.Id == null ? "" : adminRow.Id.ToString();
                    if (string.IsNullOrWhiteSpace(adminId))
                    {
                        return new DosResult(0, null, "空库模板缺少默认 admin 用户，请更新 microi_empty_mysql57.sql.zip 后重试。");
                    }

                    var assignments = new List<string>();
                    var values = new List<KeyValuePair<string, object>>();
                    var sensitiveValueParameters = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                    void AddUserField(string fieldName, object value, bool allowEmpty = true, bool sensitive = false)
                    {
                        if (!ColumnExists(newDb, "sys_user", fieldName))
                        {
                            return;
                        }
                        var valueText = value == null ? "" : value.ToString();
                        if (!allowEmpty && string.IsNullOrWhiteSpace(valueText))
                        {
                            return;
                        }
                        var paramName = "InitAdmin" + values.Count;
                        assignments.Add($"{QuoteField(fieldName)} = @{paramName}");
                        values.Add(new KeyValuePair<string, object>(paramName, value));
                        if (sensitive)
                        {
                            sensitiveValueParameters.Add(paramName);
                        }
                    }

                    AddUserField("UpdateTime", now);
                    AddUserField("IsDeleted", 0);
                    AddUserField("State", 1);
                    AddUserField("Level", 9999);
                    AddUserField("Phone", phone);
                    AddUserField("Name", string.IsNullOrWhiteSpace(userName) ? phone : userName);
                    AddUserField("Pwd", encryptedPwd, false, true);
                    AddUserField("OsClient", osClient, false);

                    if (assignments.Count > 0)
                    {
                        var cmd = newDb.FromSql(
                            $"UPDATE sys_user SET {string.Join(", ", assignments)} WHERE Id = @WhereAdminId");
                        foreach (var item in values)
                        {
                            if (sensitiveValueParameters.Contains(item.Key))
                                cmd.AddSensitiveInParameter(item.Key, item.Value);
                            else
                                cmd.AddInParameter(item.Key, item.Value);
                        }
                        cmd.AddInParameter("WhereAdminId", adminId);
                        cmd.ExecuteNonQuery();
                    }

                    // 更新sys_osclients中的OsClient值为当前租户（空库模板中有默认的iTdos值）
                    try
                    {
                        newDb.FromSql("UPDATE sys_osclients SET OsClient = @p0 WHERE IsDeleted = 0")
                            .AddInParameter("p0", osClient)
                            .ExecuteNonQuery();
                    }
                    catch { }

                    Console.WriteLine($"Microi：【成功】租户[{osClient}]已复用空库模板默认admin用户！");
                    return new DosResult(1);
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"初始化租户数据失败：{ex.Message}");
            }
        }

        /// <summary>
        /// 按主租户和用户隔离的 Redis 分布式租约。所有权值携带单调递增的 fencing token，
        /// 续租和释放均使用 Lua 校验 owner，避免旧节点误续租或误释放新节点的租约。
        /// </summary>
        private sealed class TenantProvisioningLease : IDisposable
        {
            private const int LeaseMilliseconds = 120000;
            private readonly IDatabase _database;
            private readonly string _lockKey;
            private readonly CancellationTokenSource _renewCancellation = new CancellationTokenSource();
            private readonly Task _renewTask;
            private int _lost;

            private string Owner { get; }

            private TenantProvisioningLease(IDatabase database, string lockKey, string owner)
            {
                _database = database;
                _lockKey = lockKey;
                Owner = owner;
                _renewTask = Task.Run(RenewLoop);
            }

            public static TenantProvisioningLease TryAcquire(string userId)
            {
                userId = (userId ?? "").Trim();
                if (userId.DosIsNullOrWhiteSpace())
                {
                    throw new InvalidOperationException("租户归属用户Id不能为空。");
                }

                var database = MicroiEngine.CacheTenant.Default().GetIDatabase()
                               ?? throw new InvalidOperationException(
                                   "Redis 不可用，已拒绝在无分布式租约情况下开通租户。");
                var keyPrefix = "Microi:" + NormalizeKeySegment(OsClientDefault.OsClient)
                                + ":TenantProvisioning:User:" + ComputeSha256(userId);
                var lockKey = keyPrefix + ":Lease";
                var fenceKey = keyPrefix + ":FencingToken";
                var instanceToken = Guid.NewGuid().ToString("N");
                const string acquireScript = @"
if redis.call('exists', KEYS[1]) == 0 then
  local fence = redis.call('incr', KEYS[2])
  local owner = tostring(fence) .. ':' .. ARGV[1]
  redis.call('psetex', KEYS[1], ARGV[2], owner)
  return owner
end
return ''";
                var result = database.ScriptEvaluate(acquireScript,
                    new RedisKey[] { lockKey, fenceKey },
                    new RedisValue[] { instanceToken, LeaseMilliseconds });
                var owner = result.ToString();
                return owner.DosIsNullOrWhiteSpace()
                    ? null
                    : new TenantProvisioningLease(database, lockKey, owner);
            }

            public void ThrowIfLost()
            {
                var lost = Volatile.Read(ref _lost) != 0;
                if (!lost)
                {
                    try
                    {
                        lost = !string.Equals(_database.StringGet(_lockKey).ToString(), Owner,
                            StringComparison.Ordinal);
                    }
                    catch
                    {
                        // 无法确认自己仍是持有者时必须 fail-closed。
                        lost = true;
                    }
                }
                if (lost)
                {
                    Interlocked.Exchange(ref _lost, 1);
                    throw new InvalidOperationException(
                        "租户开通分布式租约已丢失，已中止任务并开始补偿回滚。");
                }
            }

            private async Task RenewLoop()
            {
                const string renewScript = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0";
                while (!_renewCancellation.IsCancellationRequested)
                {
                    try
                    {
                        await Task.Delay(20000, _renewCancellation.Token).ConfigureAwait(false);
                        var renewed = (long)await _database.ScriptEvaluateAsync(renewScript,
                            new RedisKey[] { _lockKey },
                            new RedisValue[] { Owner, LeaseMilliseconds }).ConfigureAwait(false);
                        if (renewed != 1)
                        {
                            Interlocked.Exchange(ref _lost, 1);
                            return;
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        return;
                    }
                    catch
                    {
                        Interlocked.Exchange(ref _lost, 1);
                        return;
                    }
                }
            }

            public void Dispose()
            {
                _renewCancellation.Cancel();
                try { _renewTask.Wait(TimeSpan.FromSeconds(3)); } catch { }
                const string releaseScript = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0";
                try
                {
                    _database.ScriptEvaluate(releaseScript,
                        new RedisKey[] { _lockKey }, new RedisValue[] { Owner });
                }
                catch { }
                _renewCancellation.Dispose();
            }

            private static string NormalizeKeySegment(string value)
            {
                var normalized = Regex.Replace((value ?? "main").Trim(), @"[^A-Za-z0-9_-]", "_");
                return normalized.DosIsNullOrWhiteSpace() ? "main" : normalized;
            }

            private static string ComputeSha256(string value)
            {
                using (var sha256 = SHA256.Create())
                {
                    var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(value));
                    var builder = new StringBuilder(bytes.Length * 2);
                    foreach (var item in bytes)
                    {
                        builder.Append(item.ToString("x2"));
                    }
                    return builder.ToString();
                }
            }
        }

    }
}
