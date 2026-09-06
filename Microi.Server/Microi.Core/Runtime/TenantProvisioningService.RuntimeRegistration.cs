using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class TenantProvisioningService
    {
        /// <summary>
        /// 为自助开通租户补齐明确指定的网络登记。编排/确认由 Managed 接口负责；
        /// 这里只在主库内复制同一租户的配置，凭据不进入 V8，不创建/重置业务数据库。
        /// </summary>
        public DosResult EnsureOwnedTenantRuntimeRegistration(string tenantKey, string targetNetwork, bool apply)
        {
            tenantKey = (tenantKey ?? "").Trim();
            targetNetwork = (targetNetwork ?? "").Trim();
            if (!Regex.IsMatch(tenantKey, @"^[A-Za-z][A-Za-z0-9_-]{0,79}$")
                || !Regex.IsMatch(targetNetwork, @"^[A-Za-z][A-Za-z0-9_.-]{0,49}$")
                || string.Equals(tenantKey, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "租户标识或目标网络无效，主租户不在修复范围。");

            var main = OsClientExtend.GetClient(OsClientDefault.OsClient);
            var type = OsClientDefault.OsClientType;
            using var lease = apply ? TenantProvisioningLease.TryAcquire("runtime-registration:" + tenantKey.ToLowerInvariant()) : null;
            if (apply && lease == null) return new DosResult(0, null, "该租户运行登记正在处理，请稍后回读。");
            // 目标分区必须是主库已经登记的真实部署分区，客户端不能凭空指定网络。
            var mainTargetCount = main.Db.FromSql(@"SELECT COUNT(*) FROM sys_osclients
                WHERE OsClient=@Main AND OsClientType=@Type AND OsClientNetwork=@Network
                  AND IsDeleted=0 AND IsEnable=1")
                .AddInParameter("Main", OsClientDefault.OsClient).AddInParameter("Type", type)
                .AddInParameter("Network", targetNetwork).ToScalar<int>();
            if (mainTargetCount != 1) return new DosResult(0, null, "目标网络没有唯一、已启用的主租户配置。");

            var rows = main.Db.FromSql(@"SELECT * FROM sys_osclients WHERE LOWER(OsClient)=LOWER(@Tenant) AND OsClientType=@Type")
                .AddInParameter("Tenant", tenantKey).AddInParameter("Type", type).ToArray();
            var variants = rows.Select(row => JObject.FromObject((object)row)).ToArray();
            var existing = variants.Where(row => string.Equals(row.Value<string>("OsClientNetwork"), targetNetwork, StringComparison.OrdinalIgnoreCase)).ToArray();
            if (existing.Length != 0)
            {
                // 已存在记录（包括禁用和墓碑）完全属于管理员，不恢复、不覆盖。
                return new DosResult(1, new { TenantKey = tenantKey, TargetNetwork = targetNetwork, Changed = false, Exists = true });
            }
            var candidates = variants.Where(row => row.Value<int?>("IsDeleted") == 0
                && row.Value<int?>("IsEnable") == 1 && !string.IsNullOrWhiteSpace(row.Value<string>("OwnerUserId"))).ToArray();
            if (candidates.Length != 1) return new DosResult(0, null, "缺少唯一的自助租户来源配置，已停止自动补齐。");
            var source = candidates[0];
            var owner = source.Value<string>("OwnerUserId");
            if (source.Value<string>("DbConn").DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "来源租户数据库连接尚未配置。");
            var sourceNetwork = source.Value<string>("OsClientNetwork");
            if (!apply) return new DosResult(1, new { TenantKey = tenantKey, SourceNetwork = sourceNetwork, TargetNetwork = targetNetwork, Changed = false, CanCreate = true });

            // 使用确定 Id + INSERT SELECT 条件保证重放幂等；连接串不离开数据库。
            // 共享 Redis/对象存储等字段不复制，目标节点按自己的主租户重新投影。
            var fields = source.Properties().Select(p => p.Name)
                .Where(name => Regex.IsMatch(name, @"^[A-Za-z_][A-Za-z0-9_]*$")
                    && !TenantConfigurationSecurity.SharedInfrastructureFields.Contains(name, StringComparer.OrdinalIgnoreCase)).ToArray();
            var id = RuntimeRegistrationId(tenantKey, type, targetNetwork);
            var values = fields.Select(name => name == "Id" ? "@NewId"
                : name == "OsClientNetwork" ? "@Network"
                : name == "CreateTime" || name == "UpdateTime" ? "@Now" : QuoteField(name));
            lease.ThrowIfLost();
            using (var trans = main.Db.BeginTransaction())
            {
                var affected = trans.FromSql($"INSERT INTO {QuoteField("sys_osclients")} ({string.Join(",", fields.Select(QuoteField))}) "
                    + $"SELECT {string.Join(",", values)} FROM {QuoteField("sys_osclients")} "
                    + "WHERE Id=@SourceId AND OwnerUserId=@Owner AND IsDeleted=0 AND IsEnable=1 AND DbConn=@ExpectedConnection")
                    .AddInParameter("NewId", id).AddInParameter("Network", targetNetwork)
                    .AddInParameter("Now", DateTime.Now).AddInParameter("SourceId", source.Value<string>("Id"))
                    .AddInParameter("Owner", owner).AddSensitiveInParameter("ExpectedConnection", source.Value<string>("DbConn"))
                    .ExecuteNonQuery();
                if (affected != 1) return new DosResult(0, null, "来源配置已变化，未创建运行登记，请重新检查。");
                lease.ThrowIfLost();
                trans.Commit();
            }
            var verified = main.Db.FromSql(@"SELECT COUNT(*) FROM sys_osclients
                WHERE Id=@Id AND OsClient=@Tenant AND OsClientType=@Type AND OsClientNetwork=@Network
                  AND OwnerUserId=@Owner AND IsDeleted=0 AND IsEnable=1")
                .AddInParameter("Id", id).AddInParameter("Tenant", source.Value<string>("OsClient"))
                .AddInParameter("Type", type).AddInParameter("Network", targetNetwork)
                .AddInParameter("Owner", owner).ToScalar<int>() == 1;
            return new DosResult(verified ? 1 : 0, new { TenantKey = tenantKey, SourceNetwork = sourceNetwork,
                TargetNetwork = targetNetwork, Changed = true, Verified = verified },
                verified ? "已补齐租户运行登记，原配置及数据库保持不变。" : "运行登记已写入但回读未通过，请先检查再重试。");
        }

        internal static string RuntimeRegistrationId(string tenantKey, string type, string network)
        {
            using var hash = SHA256.Create();
            var bytes = hash.ComputeHash(Encoding.UTF8.GetBytes("Microi:RuntimeRegistration:v1:"
                + tenantKey.Trim().ToLowerInvariant() + ":" + type.Trim().ToLowerInvariant() + ":" + network.Trim().ToLowerInvariant()));
            return new Guid(bytes.Take(16).ToArray()).ToString();
        }
    }
}
