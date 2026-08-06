using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 移除历史上授予普通角色的管理员专用平台表直连权限。
    /// 菜单权限由业务菜单继续维护，本迁移只处理 Type=Table 的直接授权。
    /// </summary>
    public class Upgrade15
    {
        // 升级步骤必须按实际发布日期保持全局单调递增。该步骤虽最初在
        // 6.5.3 开发分支编写，但直到 6.5.7 才随安全修复正式交付；
        // 若继续使用旧版本号，ServerVersion 已较新的客户会直接跳过。
        public static string Version = "6.5.7.1";

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在。");
                    return messages;
                }

                var tableRows = client.Db
                    .FromSql("SELECT Id, Name FROM diy_table")
                    .ToList<Upgrade15TableRow>();
                var protectedTableIds = tableRows
                    .Where(row => !string.IsNullOrWhiteSpace(row.Id)
                        && !string.IsNullOrWhiteSpace(row.Name)
                        && PlatformResourceSecurity.IsProtectedTable(row.Name))
                    .Select(row => row.Id)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                if (protectedTableIds.Count == 0)
                {
                    Console.WriteLine(
                        $"Microi：【信息】平台自动升级【{osClient}】【升级15】未发现管理员专用表元数据，无需清理表级直连权限。");
                    return messages;
                }

                var roleLevels = client.Db
                    .FromSql("SELECT Id, Level FROM sys_role")
                    .ToList<Upgrade15RoleRow>()
                    .Where(row => !string.IsNullOrWhiteSpace(row.Id))
                    .GroupBy(row => row.Id, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        group => group.Key,
                        group => group.Max(row => row.Level),
                        StringComparer.OrdinalIgnoreCase);

                var tableGrants = client.Db
                    .FromSql("SELECT Id, RoleId, FkId FROM sys_rolelimit WHERE Type = @p0")
                    .AddInParameter("p0", "Table")
                    .ToList<Upgrade15RoleLimitRow>();

                var dangerousGrants = tableGrants
                    .Where(row => !string.IsNullOrWhiteSpace(row.Id)
                        && !string.IsNullOrWhiteSpace(row.FkId)
                        && protectedTableIds.Contains(row.FkId)
                        && (!roleLevels.TryGetValue(row.RoleId ?? "", out var level)
                            || level < DiyCommon.MaxRoleLevel))
                    .ToList();

                var deletedCount = 0;
                foreach (var grant in dangerousGrants)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    deletedCount += client.Db
                        .FromSql(@"DELETE FROM sys_rolelimit
                            WHERE Id = @p0 AND Type = @p1 AND FkId = @p2")
                        .AddInParameter("p0", grant.Id)
                        .AddInParameter("p1", "Table")
                        .AddInParameter("p2", grant.FkId)
                        .ExecuteNonQuery();
                }

                UpgradeExecutionLeaseContext.ThrowIfLost();
                var remainingGrants = client.Db
                    .FromSql("SELECT Id, RoleId, FkId FROM sys_rolelimit WHERE Type = @p0")
                    .AddInParameter("p0", "Table")
                    .ToList<Upgrade15RoleLimitRow>()
                    .Where(row => !string.IsNullOrWhiteSpace(row.FkId)
                        && protectedTableIds.Contains(row.FkId)
                        && (!roleLevels.TryGetValue(row.RoleId ?? "", out var level)
                            || level < DiyCommon.MaxRoleLevel))
                    .ToList();

                if (remainingGrants.Count > 0)
                {
                    messages.Add($"仍有 {remainingGrants.Count} 条普通角色敏感表直连权限未清理。");
                }
                else
                {
                    // 授权快照由所有 API/Worker 节点共享使用。升级程序直接写库不会经过
                    // SysRoleLimit/FormEngine 的常规缓存清理路径，因此即使本次没有删到数据
                    // （例如上一次升级在删库后、失效缓存前中断），也必须提升租户授权版本。
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    await FormEngineAuthorizationCache.InvalidateAsync(osClient)
                        .ConfigureAwait(false);
                    Console.WriteLine(
                        $"Microi：【成功】平台自动升级【{osClient}】【升级15】已清理 {deletedCount} 条普通角色敏感表直连权限；菜单权限未改动。");
                }
            }
            catch (Exception ex)
            {
                messages.Add("清理普通角色敏感表直连权限失败：" + ex.Message);
            }

            return messages;
        }

        public sealed class Upgrade15TableRow
        {
            public string Id { get; set; }
            public string Name { get; set; }
        }

        public sealed class Upgrade15RoleRow
        {
            public string Id { get; set; }
            public int Level { get; set; }
        }

        public sealed class Upgrade15RoleLimitRow
        {
            public string Id { get; set; }
            public string RoleId { get; set; }
            public string FkId { get; set; }
        }
    }
}
