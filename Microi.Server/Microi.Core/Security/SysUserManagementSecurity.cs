using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public enum SysUserManagementOperation
    {
        Add,
        Edit,
        Delete
    }

    /// <summary>
    /// Result of the server-owned account hierarchy check. RoleIds and Level in a
    /// browser payload are never authoritative; callers persist only the normalized
    /// values returned here.
    /// </summary>
    public sealed class SysUserManagementDecision
    {
        public bool Allowed { get; set; }

        public string Reason { get; set; }

        public IReadOnlyList<string> RoleIds { get; set; } = Array.Empty<string>();

        public int AssignedLevel { get; set; }

        public bool RoleIdsChanged { get; set; }
    }

    /// <summary>
    /// Trusted hierarchy boundary for delegated sys_user management.
    ///
    /// Menu/table CRUD grants decide whether an account manager may perform an
    /// operation at all. This class independently prevents that grant from becoming
    /// a privilege-escalation primitive: an ordinary manager cannot change their own
    /// roles, edit/delete a superior, or assign a higher/equal-level role they do not
    /// already hold. Equal-level role reuse is limited to the actor's own active roles
    /// so a delegated manager can maintain accounts without acquiring new authority.
    /// </summary>
    public static class SysUserManagementSecurity
    {
        private static readonly HashSet<string> ServerOwnedDelegatedWriteFields =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "CreateTime",
                "UpdateTime",
                "UserId",
                "UserName",
                "IsDeleted",
                "Level",
                "PwdEncode",
                "BtnDisplayPwd",
                "LastLoginTime",
                "LastLoginIP",
                "PwdErrorCount",
                "LicenseType",
                "TenantId",
                "TenantName",
                "TenantDatabaseQuota",
                "AiTokenRechargeRecords",
                "AiTokenUsageRecords",
                "GiteeUserId",
                "GiteeLogin",
                "GiteeStarVerified",
                "GiteeStarVerifiedAt",
                "GiteeStarRepository",
                "WxOpenId",
                "WxMpId",
                "MiniProgramOpenId",
                "UserType"
            };

        public static SysUserManagementDecision Authorize(
            DbSession dbSession,
            JObject currentUser,
            SysUserManagementOperation operation,
            string targetUserId,
            JToken requestedRoleIds,
            bool roleIdsSupplied)
        {
            if (dbSession == null)
            {
                return Deny("database_unavailable");
            }

            var actorUserId = currentUser?["Id"].Val<string>();
            if (actorUserId.DosIsNullOrWhiteSpace())
            {
                return Deny("actor_missing");
            }

            try
            {
                var actor = dbSession.From<SysUser>()
                    .Where(d => d.Id == actorUserId
                                && d.State == 1
                                && d.IsDeleted != 1)
                    .First();
                if (actor == null)
                {
                    return Deny("actor_inactive");
                }

                var actorRoleIds = PlatformAdministratorSecurity.ParseRoleIds(actor.RoleIds);
                var actorRoles = LoadRoles(dbSession, actorRoleIds);
                var actorLevel = GetEffectiveLevel(actor, actorRoles);
                // Level 0 is a valid ordinary-role level in existing tenants. The
                // authority source is an active role row, not a positive integer.
                if (actorRoles.Count == 0)
                {
                    return Deny("actor_has_no_effective_role");
                }

                SysUser target = null;
                var currentTargetRoleIds = new List<string>();
                var targetLevel = 0;
                if (operation != SysUserManagementOperation.Add)
                {
                    if (targetUserId.DosIsNullOrWhiteSpace())
                    {
                        return Deny("target_missing");
                    }

                    target = dbSession.From<SysUser>()
                        .Where(d => d.Id == targetUserId && d.IsDeleted != 1)
                        .First();
                    if (target == null)
                    {
                        return Deny("target_not_found");
                    }
                    currentTargetRoleIds = PlatformAdministratorSecurity.ParseRoleIds(target.RoleIds);
                    targetLevel = GetEffectiveLevel(target, LoadRoles(dbSession, currentTargetRoleIds));
                }

                var normalizedRequestedRoleIds = new List<string>();
                var requestedRoleLevels = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                if (roleIdsSupplied)
                {
                    if (!TryParseRoleIds(requestedRoleIds, out normalizedRequestedRoleIds))
                    {
                        return Deny("role_payload_invalid");
                    }

                    var requestedRoles = LoadRoles(dbSession, normalizedRequestedRoleIds);
                    if (requestedRoles.Count != normalizedRequestedRoleIds.Count)
                    {
                        return Deny("role_not_found_or_deleted");
                    }
                    requestedRoleLevels = requestedRoles
                        .ToDictionary(d => d.Id, d => d.Level, StringComparer.OrdinalIgnoreCase);
                }

                return Evaluate(
                    actorUserId,
                    actorLevel,
                    actorRoleIds,
                    operation,
                    targetUserId,
                    targetLevel,
                    currentTargetRoleIds,
                    normalizedRequestedRoleIds,
                    requestedRoleLevels,
                    roleIdsSupplied);
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：[SysUserManagementSecurity] 主库权限复核失败：{ex.Message}");
                return Deny("authorization_check_failed");
            }
        }

        internal static SysUserManagementDecision Evaluate(
            string actorUserId,
            int actorLevel,
            IEnumerable<string> actorRoleIds,
            SysUserManagementOperation operation,
            string targetUserId,
            int targetLevel,
            IEnumerable<string> currentTargetRoleIds,
            IEnumerable<string> requestedRoleIds,
            IReadOnlyDictionary<string, int> requestedRoleLevels,
            bool roleIdsSupplied)
        {
            var currentRoles = NormalizeRoleIds(currentTargetRoleIds);
            var requestedRoles = NormalizeRoleIds(requestedRoleIds);
            var actorRoles = NormalizeRoleIds(actorRoleIds)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var roleIdsChanged = roleIdsSupplied
                && !currentRoles.ToHashSet(StringComparer.OrdinalIgnoreCase)
                    .SetEquals(requestedRoles);
            var isSelf = !actorUserId.DosIsNullOrWhiteSpace()
                         && string.Equals(actorUserId, targetUserId, StringComparison.OrdinalIgnoreCase);

            if (operation == SysUserManagementOperation.Delete && isSelf)
            {
                return Deny("self_delete_denied");
            }
            if (operation == SysUserManagementOperation.Edit && isSelf && roleIdsChanged)
            {
                return Deny("self_role_change_denied");
            }
            if (operation != SysUserManagementOperation.Add
                && !isSelf
                && (targetLevel > actorLevel
                    || (targetLevel == actorLevel
                        && currentRoles.Any(roleId => !actorRoles.Contains(roleId)))))
            {
                return Deny("target_level_not_lower");
            }

            var assignedLevel = roleIdsSupplied && requestedRoles.Count > 0
                ? requestedRoles.Max(roleId => requestedRoleLevels != null
                    && requestedRoleLevels.TryGetValue(roleId, out var level)
                        ? level
                        : int.MaxValue)
                : 0;
            if (roleIdsSupplied
                && requestedRoles.Any(roleId => requestedRoleLevels == null
                    || !requestedRoleLevels.ContainsKey(roleId)))
            {
                return Deny("role_not_found_or_deleted");
            }
            if (roleIdsSupplied
                && (assignedLevel > actorLevel
                    || requestedRoles.Any(roleId =>
                        requestedRoleLevels[roleId] == actorLevel
                        && !actorRoles.Contains(roleId))))
            {
                return Deny("assigned_role_level_not_lower");
            }

            return new SysUserManagementDecision
            {
                Allowed = true,
                Reason = string.Empty,
                RoleIds = requestedRoles,
                AssignedLevel = assignedLevel,
                RoleIdsChanged = roleIdsChanged
            };
        }

        internal static bool TryParseRoleIds(JToken token, out List<string> roleIds)
        {
            roleIds = new List<string>();
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
            {
                return true;
            }

            JToken normalized = token;
            if (token.Type == JTokenType.String)
            {
                var raw = token.Val<string>()?.Trim();
                if (raw.DosIsNullOrWhiteSpace())
                {
                    return true;
                }
                if (!raw.StartsWith("[", StringComparison.Ordinal)
                    && !raw.StartsWith("{", StringComparison.Ordinal))
                {
                    roleIds.Add(raw);
                    return true;
                }
                try
                {
                    normalized = JToken.Parse(raw);
                }
                catch
                {
                    return false;
                }
            }

            var tokens = normalized.Type == JTokenType.Array
                ? normalized.Children().ToList()
                : new List<JToken> { normalized };
            foreach (var item in tokens)
            {
                var roleId = item.Type == JTokenType.String
                    ? item.Val<string>()
                    : item.Type == JTokenType.Object
                        ? item["Id"].Val<string>()
                        : null;
                if (roleId.DosIsNullOrWhiteSpace())
                {
                    return false;
                }
                roleIds.Add(roleId.Trim());
            }

            roleIds = NormalizeRoleIds(roleIds);
            return true;
        }

        public static void RemoveServerOwnedFields(JObject row)
        {
            if (row == null)
            {
                return;
            }
            foreach (var property in row.Properties().ToList())
            {
                if (ServerOwnedDelegatedWriteFields.Contains(property.Name))
                {
                    property.Remove();
                }
            }
        }

        /// <summary>
        /// Returns the least-privilege role catalog needed by delegated account
        /// managers. The actor is reloaded from the tenant database, so a stale or
        /// forged token cannot reveal or assign administrator/foreign peer roles.
        /// Only lower roles and the actor's own equal-level roles are returned, and
        /// only Id/Name/Level leave this boundary.
        /// </summary>
        public static IReadOnlyList<SysRole> GetAssignableRoleCatalog(
            DbSession dbSession,
            JObject currentUser,
            IEnumerable<SysRole> candidates)
        {
            if (dbSession == null || candidates == null)
            {
                return Array.Empty<SysRole>();
            }

            var actorUserId = currentUser?["Id"].Val<string>();
            if (actorUserId.DosIsNullOrWhiteSpace())
            {
                return Array.Empty<SysRole>();
            }

            try
            {
                var actor = dbSession.From<SysUser>()
                    .Where(d => d.Id == actorUserId
                                && d.State == 1
                                && d.IsDeleted != 1)
                    .First();
                if (actor == null)
                {
                    return Array.Empty<SysRole>();
                }

                var actorRoleIds = PlatformAdministratorSecurity.ParseRoleIds(actor.RoleIds);
                var actorRoles = LoadRoles(dbSession, actorRoleIds);
                if (actorRoles.Count == 0)
                {
                    return Array.Empty<SysRole>();
                }

                var actorTenantId = (actor.TenantId ?? string.Empty).Trim();
                var tenantCandidates = candidates.Where(role => role != null
                    && string.Equals(
                        (role.TenantId ?? string.Empty).Trim(),
                        actorTenantId,
                        StringComparison.OrdinalIgnoreCase)).ToList();

                return SelectAssignableRoles(
                    GetEffectiveLevel(actor, actorRoles),
                    actorRoleIds,
                    tenantCandidates);
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：[SysUserManagementSecurity] 可分配角色目录复核失败：{ex.Message}");
                return Array.Empty<SysRole>();
            }
        }

        public static IReadOnlyList<SysRole> GetAssignableRoleCatalog(
            DbSession dbSession,
            JObject currentUser)
        {
            if (dbSession == null)
            {
                return Array.Empty<SysRole>();
            }
            try
            {
                var candidates = dbSession.From<SysRole>()
                    .Where(role => role.IsDeleted != 1)
                    .ToList();
                return GetAssignableRoleCatalog(dbSession, currentUser, candidates);
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：[SysUserManagementSecurity] 可分配角色目录读取失败：{ex.Message}");
                return Array.Empty<SysRole>();
            }
        }

        internal static IReadOnlyList<SysRole> SelectAssignableRoles(
            int actorLevel,
            IEnumerable<string> actorRoleIds,
            IEnumerable<SysRole> candidates)
        {
            var ownRoleIds = NormalizeRoleIds(actorRoleIds)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            return (candidates ?? Array.Empty<SysRole>())
                .Where(role => role != null
                               && role.IsDeleted != 1
                               && !role.Id.DosIsNullOrWhiteSpace()
                               && (role.Level < actorLevel
                                   || (role.Level == actorLevel
                                       && ownRoleIds.Contains(role.Id))))
                .GroupBy(role => role.Id, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .OrderByDescending(role => role.Level)
                .ThenBy(role => role.Name)
                .Select(role => new SysRole
                {
                    Id = role.Id,
                    Name = role.Name,
                    Level = role.Level
                })
                .ToList();
        }

        private static List<SysRole> LoadRoles(DbSession dbSession, IReadOnlyCollection<string> roleIds)
        {
            if (roleIds == null || roleIds.Count == 0)
            {
                return new List<SysRole>();
            }

            // Dos.ORM translates the concrete List<T> overload to SQL IN. Keeping
            // the captured value typed as IReadOnlyCollection<T> can yield an empty
            // predicate on real providers even though the collection contains ids.
            var queryRoleIds = roleIds.ToList();
            return dbSession.From<SysRole>()
                .Where(d => d.Id.In(queryRoleIds) && d.IsDeleted != 1)
                .ToList();
        }

        private static int GetEffectiveLevel(SysUser user, IEnumerable<SysRole> roles)
        {
            var roleList = (roles ?? Array.Empty<SysRole>()).ToList();
            if (roleList.Count > 0)
            {
                return roleList.Max(d => d.Level);
            }
            return string.Equals(user?.Account, "admin", StringComparison.OrdinalIgnoreCase)
                ? user.Level
                : 0;
        }

        private static List<string> NormalizeRoleIds(IEnumerable<string> values)
        {
            return (values ?? Array.Empty<string>())
                .Where(d => !d.DosIsNullOrWhiteSpace())
                .Select(d => d.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(d => d, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static SysUserManagementDecision Deny(string reason)
        {
            return new SysUserManagementDecision
            {
                Allowed = false,
                Reason = reason ?? string.Empty
            };
        }
    }
}
