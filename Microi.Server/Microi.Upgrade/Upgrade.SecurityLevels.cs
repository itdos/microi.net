using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    public partial class MicroiUpgrade
    {
        private async Task EnsureSecurityLevelsAsync(OsClientSecret client, string beforeVersion)
        {
            UpgradeExecutionLeaseContext.ConfirmOwnership();
            if (client?.Db == null) throw new InvalidOperationException("租户数据库连接不存在。");
            if (!TableExists(client, "sys_user") || !TableExists(client, "sys_role"))
                throw new InvalidOperationException("内置用户或角色表不存在，不能完成管理员等级兼容。");
            var sqlServer = (client.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType) == "SqlServer";
            string Q(string name) => sqlServer ? "[" + name + "]" : "`" + name + "`";
            var changedUsers = new List<string>();
            using (var trans = client.Db.BeginTransaction())
            {
                var modernCount = trans.FromSql(
                    $"SELECT (SELECT COUNT(*) FROM {Q("sys_user")} WHERE {Q("Level")}>=9999) + " +
                    $"(SELECT COUNT(*) FROM {Q("sys_role")} WHERE {Q("Level")}>=9999)").ToScalar();
                var legacy = SecurityLevelMigrationPolicy.IsLegacyDatabase(beforeVersion, Convert.ToInt64(modernCount) > 0);
                var roles = trans.FromSql(
                    $"SELECT {Q("Id")},{Q("Name")},{Q("Level")} FROM {Q("sys_role")} WHERE COALESCE({Q("IsDeleted")},0)=0")
                    .ToList<SecurityLevelMigrationRow>();
                var levels = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var role in roles)
                {
                    var next = SecurityLevelMigrationPolicy.RoleLevel(role.Name, role.Level, legacy);
                    levels.Add(role.Id, next);
                    if (next == role.Level) continue;
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var count = trans.FromSql(
                        $"UPDATE {Q("sys_role")} SET {Q("Level")}=@next WHERE {Q("Id")}=@id AND COALESCE({Q("Level")},0)=@old")
                        .AddInParameter("next", next).AddInParameter("id", role.Id).AddInParameter("old", role.Level)
                        .ExecuteNonQuery();
                    if (count != 1) throw new InvalidOperationException("管理员角色已被并发修改，请重试升级。");
                }
                var users = trans.FromSql(
                    $"SELECT {Q("Id")},{Q("Account")},{Q("Level")},{Q("RoleIds")} FROM {Q("sys_user")} " +
                    $"WHERE COALESCE({Q("IsDeleted")},0)=0 AND (LOWER(LTRIM(RTRIM({Q("Account")})))=@admin" +
                    (legacy ? $" OR {Q("Level")} IN (998,999)" : "") + ")")
                    .AddInParameter("admin", "admin").ToList<SecurityLevelMigrationRow>();
                foreach (var user in users)
                {
                    changedUsers.Add(user.Id);
                    var next = SecurityLevelMigrationPolicy.UserLevel(user.Account, user.Level, legacy);
                    var roleIds = SecurityLevelMigrationPolicy.RefreshRoleSnapshot(user.RoleIds, levels);
                    if (next == user.Level && roleIds == user.RoleIds) continue;
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var count = trans.FromSql(
                        $"UPDATE {Q("sys_user")} SET {Q("Level")}=@next,{Q("RoleIds")}=@roles WHERE {Q("Id")}=@id " +
                        $"AND COALESCE({Q("Level")},0)=@old AND " + (user.RoleIds == null ? $"{Q("RoleIds")} IS NULL" : $"{Q("RoleIds")}=@oldRoles"))
                        .AddInParameter("next", next).AddInParameter("roles", roleIds).AddInParameter("id", user.Id)
                        .AddInParameter("old", user.Level).AddInParameter("oldRoles", user.RoleIds).ExecuteNonQuery();
                    if (count != 1) throw new InvalidOperationException("管理员账号已被并发修改，请重试升级。");
                }
                var invalid = trans.FromSql(
                    $"SELECT (SELECT COUNT(*) FROM {Q("sys_user")} WHERE COALESCE({Q("IsDeleted")},0)=0 " +
                    $"AND LOWER(LTRIM(RTRIM({Q("Account")})))=@admin AND COALESCE({Q("Level")},0)<>9999) + " +
                    $"(SELECT COUNT(*) FROM {Q("sys_role")} WHERE COALESCE({Q("IsDeleted")},0)=0 " +
                    $"AND {Q("Name")}=@role AND COALESCE({Q("Level")},0)<>9999)")
                    .AddInParameter("admin", "admin").AddInParameter("role", "超级管理员").ToScalar();
                if (Convert.ToInt64(invalid) != 0) throw new InvalidOperationException("内置管理员等级回读未通过。");
                UpgradeExecutionLeaseContext.ThrowIfLost();
                trans.Commit();
            }
            // 缓存刷新失败不推进版本；重跑时仍刷新，避免已提交数据库与旧授权缓存不一致。
            await FormEngineAuthorizationCache.InvalidateAsync(client.OsClient).ConfigureAwait(false);
            var cache = MicroiEngine.CacheTenant.Cache(client.OsClient);
            foreach (var id in changedUsers)
            {
                var key = LoginSessionCacheKeys.User(client.OsClient, id);
                if (await cache.GetAsync<CurrentToken>(key).ConfigureAwait(false) == null) continue;
                var refreshed = await new SysUserLogic().RefreshLoginUser(id, client.OsClient).ConfigureAwait(false);
                if (refreshed.Code != 1 && await cache.GetAsync<CurrentToken>(key).ConfigureAwait(false) != null)
                    throw new InvalidOperationException("管理员登录投影刷新失败，升级版本未推进。");
            }
        }

        public sealed class SecurityLevelMigrationRow
        {
            public string Id { get; set; }
            public string Name { get; set; }
            public string Account { get; set; }
            public int Level { get; set; }
            public string RoleIds { get; set; }
        }
    }
}
