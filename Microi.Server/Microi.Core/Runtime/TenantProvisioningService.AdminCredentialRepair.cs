using System;
using Dos.Common;

namespace Microi.net
{
    public partial class TenantProvisioningService
    {
        /// <summary>只修正自助租户 admin 经过验证的历史 DES 编码标记，不改密码或业务数据。</summary>
        public DosResult RepairOwnedTenantAdminPasswordEncoding(string tenantKey, bool apply)
        {
            tenantKey = (tenantKey ?? "").Trim();
            var main = OsClientExtend.GetClient(OsClientDefault.OsClient);
            var ownerId = main.Db.FromSql(@"SELECT OwnerUserId FROM sys_osclients
                WHERE LOWER(OsClient)=LOWER(@Tenant) AND OsClientType=@Type AND IsDeleted=0
                  AND IsEnable=1 AND OwnerUserId IS NOT NULL AND OwnerUserId<>''")
                .AddInParameter("Tenant", tenantKey).AddInParameter("Type", OsClientDefault.OsClientType)
                .ToScalar<string>();
            if (string.IsNullOrWhiteSpace(ownerId)) return new DosResult(0, null, "未找到已启用且有所有者的自助租户。");
            using var lease = apply ? TenantProvisioningLease.TryAcquire("admin-credential:" + ownerId + ":" + tenantKey.ToLowerInvariant()) : null;
            if (apply && lease == null) return new DosResult(0, null, "管理员凭据正在处理，请稍后回读。");
            var denied = ResolveOwnedTenantAdmin(ownerId, tenantKey, out var context);
            if (denied != null) return denied;
            var encoding = ReadNullableText(context.AdminUser, "PwdEncode");
            if (!string.Equals(encoding, "V8", StringComparison.OrdinalIgnoreCase))
                return new DosResult(1, new { TenantKey = tenantKey, Changed = false, CanRepair = false, PasswordChanged = false });
            var stored = ReadNullableText(context.AdminUser, "Pwd");
            if (TenantAdminCredentialSecurity.DetectProvisionedPasswordEncoding(stored) != "DES")
                return new DosResult(0, null, "密码不是可验证的历史 DES 密文，不修改自定义编码或单向哈希。");
            if (!apply) return new DosResult(1, new { TenantKey = tenantKey, Changed = false, CanRepair = true,
                EncodingFrom = "V8", EncodingTo = "DES", PasswordChanged = false });
            lease.ThrowIfLost();
            var affected = context.Client.Db.FromSql(@"UPDATE sys_user SET PwdEncode=@Encoding,UpdateTime=@Now
                WHERE Id=@Id AND Pwd=@ExpectedPassword AND PwdEncode=@ExpectedEncoding
                  AND (IsDeleted IS NULL OR IsDeleted<>1)")
                .AddInParameter("Encoding", "DES").AddInParameter("Now", DateTime.Now)
                .AddInParameter("Id", context.AdminUser["Id"].ToString())
                .AddSensitiveInParameter("ExpectedPassword", stored).AddInParameter("ExpectedEncoding", encoding)
                .ExecuteNonQuery();
            var verified = context.Client.Db.FromSql(@"SELECT COUNT(*) FROM sys_user
                WHERE Id=@Id AND Pwd=@ExpectedPassword AND PwdEncode=@Encoding")
                .AddInParameter("Id", context.AdminUser["Id"].ToString())
                .AddSensitiveInParameter("ExpectedPassword", stored).AddInParameter("Encoding", "DES").ToScalar<int>() == 1;
            return new DosResult(affected == 1 && verified ? 1 : 0, new { TenantKey = tenantKey,
                Changed = affected == 1, Verified = verified, PasswordChanged = false },
                verified ? "已修正历史密码编码标记，原密码保持不变。" : "密码记录已变化，请先回读再重试。");
        }
    }
}
