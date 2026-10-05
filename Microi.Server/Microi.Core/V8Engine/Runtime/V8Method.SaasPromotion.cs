using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>重新核验主租户账号、角色和菜单，返回推广业务的最小授权投影。</summary>
        public DosResult AuthorizeSaasPromotion()
        {
            var denied = ResolveSaasPromotionActor(out var actor, out var all, out var configure);
            if (denied != null) return denied;
            return new DosResult(1, new
            {
                UserId = actor["Id"]?.ToString(), UserName = actor["Name"]?.ToString(),
                CanViewAll = all, CanConfigure = configure,
                OsClient = OsClientDefault.OsClient, OsClientType = OsClientDefault.OsClientType,
                OsClientNetwork = OsClientDefault.OsClientNetwork
            });
        }

        private static DosResult ResolveSaasPromotionActor(out JObject actor, out bool all, out bool configure)
        {
            actor = null; all = false; configure = false;
            var denied = ResolveTrustedManagedCurrentUser(SaasPromotionSecurity.ManagerEngine, true, 0,
                out var osClient, out var principal);
            if (denied != null) return denied;
            if (!string.Equals(osClient, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
                return new DosResult(1002, null, "推广中心仅供当前部署的主租户使用。");
            try
            {
                var db = OsClientExtend.GetClient(osClient)?.Db;
                var row = db?.FromSql("SELECT Id,Account,Name,State,Level,RoleIds,IsDeleted FROM sys_user WHERE Id=@id")
                    .AddInParameter("id", principal["Id"]?.ToString()).First<dynamic>();
                actor = row == null ? null : JObject.FromObject((object)row);
                if (actor == null || actor["State"].Val<int>() != 1 || actor["IsDeleted"].Val<int>() == 1)
                    return new DosResult(1002, null, "账号不存在或已停用。");
                configure = PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, principal);
                var roleIds = PlatformAdministratorSecurity.ParseRoleIds(actor["RoleIds"]?.ToString());
                var activeRoles = db.FromSql("SELECT Id FROM sys_role WHERE IsDeleted IS NULL OR IsDeleted=0").ToList<dynamic>()
                    .Select(row => JObject.FromObject((object)row)["Id"]?.ToString()).Where(id => roleIds.Contains(id, StringComparer.OrdinalIgnoreCase)).ToArray();
                var config = ReadSaasPromotionMainConfiguration();
                var managers = PlatformAdministratorSecurity.ParseRoleIds(config["SaasPromotionManagerRoleIds"]?.ToString());
                all = configure || activeRoles.Any(id => managers.Contains(id, StringComparer.OrdinalIgnoreCase));
                if (!configure)
                {
                    // 菜单原生存储使用微服务 Id 和页面路由；不依赖未进入通用 MCP 模型的虚拟模块 Key。
                    var menus = db.FromSql(@"SELECT m.Id FROM sys_menu m INNER JOIN sys_microiservice s ON s.Id=m.MicroServiceId
                        WHERE (m.IsDeleted IS NULL OR m.IsDeleted=0) AND (s.IsDeleted IS NULL OR s.IsDeleted=0)
                        AND s.MsKey=@app AND m.MicroServiceRoutePath=@route AND m.OpenType=@kind")
                        .AddInParameter("app", SaasPromotionSecurity.PublicApp)
                        .AddInParameter("route", "/saas-promotion").AddInParameter("kind", "MicroService").ToList<dynamic>()
                        .Select(row => JObject.FromObject((object)row)["Id"]?.ToString()).ToHashSet(StringComparer.OrdinalIgnoreCase);
                    var grants = db.FromSql("SELECT RoleId,FkId FROM sys_rolelimit WHERE Type=@type")
                        .AddInParameter("type", "Menu").ToList<dynamic>();
                    if (!grants.Any(row => { var grant = JObject.FromObject((object)row); return activeRoles.Contains(grant["RoleId"]?.ToString(), StringComparer.OrdinalIgnoreCase)
                        && menus.Contains(grant["FkId"]?.ToString()); }))
                        return new DosResult(1002, null, "当前岗位尚未获授推广中心菜单权限。");
                }
                return null;
            }
            catch { return new DosResult(0, null, "推广授权暂不可读；请先更新 SaaS 应用并重试。"); }
        }

        internal static JObject ReadSaasPromotionMainConfiguration()
        {
            var db = OsClientExtend.GetClient(OsClientDefault.OsClient)?.Db
                ?? throw new InvalidOperationException("主租户尚未初始化。");
            var rows = db.FromSql(@"SELECT Id,ClientName,SaasPublicTrialEnabled,SaasPublicTrialDays,
                SaasPublicTrialDailyLimit,SaasPublicTrialLinkLimit,SaasPublicTrialWebBase,
                SaasPromotionManagerRoleIds FROM sys_osclients
                WHERE OsClient=@tenant AND OsClientType=@type AND OsClientNetwork=@network AND (IsDeleted IS NULL OR IsDeleted=0)")
                .AddInParameter("tenant", OsClientDefault.OsClient)
                .AddInParameter("type", OsClientDefault.OsClientType)
                .AddInParameter("network", OsClientDefault.OsClientNetwork).ToList<dynamic>();
            if (rows.Count != 1) throw new InvalidOperationException("当前主租户分区配置必须唯一。");
            return JObject.FromObject(rows[0]);
        }

        /// <summary>有界读取租户统计；每次从主库重新核验推荐归属，不返回基础设施秘密。</summary>
        public DosResult ReadSaasTenantUsage(object parameters)
        {
            var denied = ResolveSaasPromotionActor(out var actor, out var all, out _);
            if (denied != null) return denied;
            try
            {
                var request = ToJObject(parameters);
                if (!(request["TenantIds"] is JArray ids) || ids.Count == 0 || ids.Count > 20
                    || ids.Any(id => id.Type != JTokenType.String || id.ToString().Length > 50)
                    || ids.Select(id => id.ToString()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != ids.Count)
                    return new DosResult(0, null, "一次仅允许读取 1 到 20 个明确的租户记录。");
                var query = OsClientExtend.GetClient(OsClientDefault.OsClient).Db.FromSql(
                    "SELECT Id,OsClient,ReferralUserId,IsEnable FROM sys_osclients WHERE (IsDeleted IS NULL OR IsDeleted=0) AND OsClient<>@main "
                    + "AND OsClientType=@type AND OsClientNetwork=@network AND Id IN ("
                    + string.Join(",", Enumerable.Range(0, ids.Count).Select(i => "@t" + i)) + ")")
                    .AddInParameter("main", OsClientDefault.OsClient)
                    .AddInParameter("type", OsClientDefault.OsClientType)
                    .AddInParameter("network", OsClientDefault.OsClientNetwork);
                for (var index = 0; index < ids.Count; index++) query.AddInParameter("t" + index, ids[index].ToString());
                var tenants = query.ToList<dynamic>().Select(row => JObject.FromObject((object)row)).ToArray();
                if (tenants.Length != ids.Count || tenants.Any(row => !SaasPromotionSecurity.CanReadTenant(all, actor["Id"]?.ToString(), row)))
                    return new DosResult(1002, null, "选择的租户不在当前推广授权范围内。");
                var result = SaasTenantUsageReader.Read(tenants, SaasPromotionSecurity.Flag(request["Refresh"]));
                return new DosResult(1, result);
            }
            catch { return new DosResult(0, null, "租户用量读取失败，请稍后重试。"); }
        }

        /// <summary>仅已授权的推荐人或管理者可签发绑定主租户及运行分区的推广能力票据。</summary>
        public DosResult CreateSaasReferralCapability(string linkId)
        {
            var denied = ResolveSaasPromotionActor(out var actor, out var all, out _);
            if (denied != null) return denied;
            try
            {
                var row = ReadSaasReferralLink(linkId);
                if (row == null || (!all && row["ReferralUserId"]?.ToString() != actor["Id"]?.ToString()))
                    return new DosResult(1002, null, "推广链接不在当前权限范围内。");
                var capability = new JObject
                {
                    ["LinkId"] = linkId, ["ReferralUserId"] = row["ReferralUserId"],
                    ["Type"] = OsClientDefault.OsClientType, ["Network"] = OsClientDefault.OsClientNetwork,
                    ["Revision"] = row["CapabilityRevision"], ["Expires"] = DateTime.UtcNow.AddDays(365).ToString("o")
                };
                return new DosResult(1, new { LinkId = linkId, ReferralUserId = row["ReferralUserId"],
                    LinkToken = TenantSystemSettingsSecurity.ProtectSecret(OsClientDefault.OsClient, "Saas.ReferralCapability", capability.ToString()) });
            }
            catch { return new DosResult(0, null, "推广链接签发失败，请重试。"); }
        }

        internal static JObject ReadSaasReferralLink(string id)
        {
            if (string.IsNullOrWhiteSpace(id) || id.Length > 50) return null;
            var row = OsClientExtend.GetClient(OsClientDefault.OsClient).Db.FromSql(@"SELECT Id,Title,ReferralUserId,IsEnable,
                ExpiresAt,MaxTenants,TrialDays,CapabilityRevision,OsClientType,OsClientNetwork FROM mci_saas_referral_link
                WHERE Id=@id AND IsDeleted=0 AND OsClientType=@type AND OsClientNetwork=@network")
                .AddInParameter("id", id).AddInParameter("type", OsClientDefault.OsClientType)
                .AddInParameter("network", OsClientDefault.OsClientNetwork).First<dynamic>();
            return row == null ? null : JObject.FromObject((object)row);
        }
    }
}
