using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Revalidates platform-administrator authority from the tenant primary database.
    /// A token is an identity hint, not the final authorization source: this prevents
    /// stale or forged request data from retaining role-management authority after a
    /// role downgrade.
    /// </summary>
    public static class PlatformAdministratorSecurity
    {
        public static bool IsCurrentPlatformAdministrator(string osClient, JObject currentUser)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return false;
            }

            try
            {
                var dbSession = OsClientExtend.GetClient(osClient)?.Db;
                return IsCurrentPlatformAdministrator(dbSession, currentUser);
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：[PlatformAdministratorSecurity] 管理员主库复核失败：{ex.Message}");
                return false;
            }
        }

        public static bool IsCurrentPlatformAdministrator(
            DbSession dbSession,
            JObject currentUser)
        {
            var userId = currentUser?["Id"].Val<string>();
            if (dbSession == null || userId.DosIsNullOrWhiteSpace())
            {
                return false;
            }

            try
            {
                var databaseUser = dbSession.From<SysUser>()
                    .Where(d => d.Id == userId
                                && d.State == 1
                                && d.IsDeleted != 1)
                    .First();
                if (databaseUser == null)
                {
                    return false;
                }

                var roleIds = ParseRoleIds(databaseUser.RoleIds);
                var databaseRoles = roleIds.Count == 0
                    ? new List<SysRole>()
                    : dbSession.From<SysRole>()
                        .Where(d => d.Id.In(roleIds) && d.IsDeleted != 1)
                        .ToList();

                return HasEffectivePlatformAdministratorLevel(
                    currentUser,
                    databaseUser,
                    databaseRoles);
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：[PlatformAdministratorSecurity] 管理员主库复核失败：{ex.Message}");
                return false;
            }
        }

        internal static bool HasEffectivePlatformAdministratorLevel(
            JObject currentUser,
            SysUser databaseUser,
            IEnumerable<SysRole> databaseRoles)
        {
            if (currentUser == null
                || databaseUser == null
                || databaseUser.State != 1
                || databaseUser.IsDeleted == 1)
            {
                return false;
            }

            var tokenUserId = currentUser["Id"].Val<string>();
            if (tokenUserId.DosIsNullOrWhiteSpace()
                || !string.Equals(tokenUserId, databaseUser.Id, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            // Requiring both the signed-in principal and the primary database to say
            // "administrator" makes request-body forgery useless and fails closed
            // while login/authorization caches are being refreshed.
            var tokenClaimsAdministrator =
                currentUser["_IsAdmin"].Val<bool>() == true
                || currentUser["Level"].Val<int>() >= DiyCommon.MaxRoleLevel;
            if (!tokenClaimsAdministrator || databaseUser.Level < DiyCommon.MaxRoleLevel)
            {
                return false;
            }

            var roleIds = ParseRoleIds(databaseUser.RoleIds);
            if (roleIds.Count == 0)
            {
                // Legacy installations may retain the built-in admin account without
                // serialized RoleIds. Do not extend this fallback to named users.
                return string.Equals(
                    databaseUser.Account,
                    "admin",
                    StringComparison.OrdinalIgnoreCase);
            }

            var activeAdministratorRoleIds = (databaseRoles ?? Array.Empty<SysRole>())
                .Where(d => d != null
                            && d.IsDeleted != 1
                            && d.Level >= DiyCommon.MaxRoleLevel
                            && !d.Id.DosIsNullOrWhiteSpace())
                .Select(d => d.Id)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            return roleIds.Any(activeAdministratorRoleIds.Contains);
        }

        internal static List<string> ParseRoleIds(string serializedRoleIds)
        {
            if (serializedRoleIds.DosIsNullOrWhiteSpace())
            {
                return new List<string>();
            }

            try
            {
                return JArray.Parse(serializedRoleIds)
                    .Select(token => token.Type == JTokenType.String
                        ? token.Val<string>()
                        : token["Id"].Val<string>())
                    .Where(id => !id.DosIsNullOrWhiteSpace())
                    .Select(id => id.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
            catch
            {
                return new List<string>();
            }
        }
    }
}
