using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Resolves the interaction between a user's base role limits and an API
    /// engine's explicit role allow-list. A role with OnlyGet may call an API
    /// engine only when that engine deliberately names one of the user's roles.
    /// </summary>
    public static class ApiEngineRoleAuthorization
    {
        /// <summary>
        /// Portable API-role marker for endpoints that deliberately allow every
        /// authenticated tenant user. It is resolved only from the authoritative
        /// sys_apiengine policy; clients cannot opt themselves into this role.
        /// </summary>
        public const string AuthenticatedRoleId = "$authenticated";
        public const string BackgroundAuthorizationMarker = "_RequireApiRoleAuthorization";
        public const string OnlyGetDeniedMessage = "该账户角色拥有【仅查询】权限！";

        public static ApiEngineRoleAuthorizationResult Evaluate(
            JObject currentUser,
            string configuredApiRoles)
        {
            if (currentUser == null)
            {
                return ApiEngineRoleAuthorizationResult.Allow();
            }

            // 平台超级管理员已经通过登录身份、租户边界和访问密钥白名单校验。
            // 历史接口引擎 ApiRole 可能只保存旧角色 Id，不能反过来阻止 Level=999
            // 的平台管理员执行受信任后台任务。
            if (int.TryParse(currentUser["Level"]?.ToString(), out var level)
                && level >= DiyCommon.MaxRoleLevel)
            {
                return ApiEngineRoleAuthorizationResult.Allow();
            }

            if (!TryReadOnlyGet(currentUser, out var hasOnlyGet))
            {
                return ApiEngineRoleAuthorizationResult.Deny(false, false, true);
            }

            if (!TryReadConfiguredRoleIds(
                    configuredApiRoles,
                    out var allowedRoleIds,
                    out var hasExplicitRoles))
            {
                return ApiEngineRoleAuthorizationResult.Deny(
                    hasOnlyGet,
                    false,
                    true);
            }

            if (!hasExplicitRoles)
            {
                return hasOnlyGet
                    ? ApiEngineRoleAuthorizationResult.Deny(true, false, false)
                    : ApiEngineRoleAuthorizationResult.Allow(false, false);
            }

            if (!TryReadUserRoleIds(currentUser, out var userRoleIds))
            {
                return ApiEngineRoleAuthorizationResult.Deny(
                    hasOnlyGet,
                    true,
                    true);
            }

            return allowedRoleIds.Contains(AuthenticatedRoleId)
                || allowedRoleIds.Overlaps(userRoleIds)
                ? ApiEngineRoleAuthorizationResult.Allow(hasOnlyGet, true)
                : ApiEngineRoleAuthorizationResult.Deny(hasOnlyGet, true, false);
        }

        /// <summary>
        /// Adds the portable authenticated marker to a per-invocation clone of
        /// the server-derived user. The legacy ApiEngine runtime still compares
        /// concrete RoleIds, so this bridge lets old and new executors honor the
        /// same policy without mutating the cached login identity.
        /// </summary>
        public static JObject AddAuthenticatedVirtualRole(
            JObject currentUser,
            string configuredApiRoles)
        {
            if (currentUser == null) return null;
            if (!TryReadConfiguredRoleIds(
                    configuredApiRoles,
                    out var allowedRoleIds,
                    out var hasExplicitRoles)
                || !hasExplicitRoles
                || !allowedRoleIds.Contains(AuthenticatedRoleId))
            {
                return currentUser;
            }

            var clone = (JObject)currentUser.DeepClone();
            AddVirtualRole(clone, "RoleIds", includeBaseLimit: false);
            AddVirtualRole(clone, "_Roles", includeBaseLimit: true);
            return clone;
        }

        /// <summary>
        /// Builds a per-request identity for the legacy API-engine executor after
        /// this class has already evaluated the authoritative ApiRole policy.
        /// OnlyGet is removed only from the clone and only for an explicitly
        /// authorized engine; the cached/login identity and every ordinary
        /// controller or FormEngine permission remain unchanged.
        /// </summary>
        public static JObject PrepareInvocationUser(
            JObject currentUser,
            string configuredApiRoles)
        {
            if (currentUser == null) return null;
            var authorization = Evaluate(currentUser, configuredApiRoles);
            if (!authorization.IsAllowed || !authorization.HasExplicitRoles)
            {
                return currentUser;
            }

            var clone = (JObject)currentUser.DeepClone();
            if (TryReadConfiguredRoleIds(
                    configuredApiRoles,
                    out var allowedRoleIds,
                    out _)
                && allowedRoleIds.Contains(AuthenticatedRoleId))
            {
                AddVirtualRole(clone, "RoleIds", includeBaseLimit: false);
                AddVirtualRole(clone, "_Roles", includeBaseLimit: true);
            }

            if (authorization.HasOnlyGet)
            {
                RemoveOnlyGetFromInvocationClone(clone);
            }
            return clone;
        }

        public static bool HasOnlyGet(JObject currentUser)
        {
            return TryReadOnlyGet(currentUser, out var hasOnlyGet) && hasOnlyGet;
        }

        private static bool TryReadOnlyGet(JObject currentUser, out bool hasOnlyGet)
        {
            hasOnlyGet = false;
            if (currentUser == null) return true;

            var rolesToken = currentUser["_Roles"];
            if (!TryReadArray(rolesToken, out var roles)) return false;
            if (roles == null) return true;

            foreach (var roleToken in roles)
            {
                if (!(roleToken is JObject role)) continue;
                var baseLimitToken = role["BaseLimit"];
                if (baseLimitToken == null
                    || baseLimitToken.Type == JTokenType.Null
                    || string.IsNullOrWhiteSpace(baseLimitToken.ToString()))
                {
                    continue;
                }

                if (!TryReadStringSet(baseLimitToken, out var baseLimits))
                {
                    return false;
                }

                if (baseLimits.Contains("OnlyGet"))
                {
                    hasOnlyGet = true;
                }
            }

            return true;
        }

        private static bool TryReadConfiguredRoleIds(
            string configuredApiRoles,
            out HashSet<string> roleIds,
            out bool hasExplicitRoles)
        {
            roleIds = NewSet();
            hasExplicitRoles = false;
            if (string.IsNullOrWhiteSpace(configuredApiRoles)) return true;

            JArray roles;
            try
            {
                roles = JArray.Parse(configuredApiRoles);
            }
            catch
            {
                return false;
            }

            if (roles.Count == 0) return true;
            hasExplicitRoles = true;
            foreach (var roleToken in roles)
            {
                var roleId = ReadRoleId(roleToken);
                if (string.IsNullOrWhiteSpace(roleId)) return false;
                roleIds.Add(roleId.Trim());
            }

            return roleIds.Count > 0;
        }

        private static bool TryReadUserRoleIds(
            JObject currentUser,
            out HashSet<string> roleIds)
        {
            roleIds = NewSet();
            if (!TryAddRoleIds(currentUser?["RoleIds"], roleIds)) return false;
            if (!TryAddRoleIds(currentUser?["_Roles"], roleIds)) return false;
            return true;
        }

        private static bool TryAddRoleIds(JToken token, ISet<string> roleIds)
        {
            if (token == null || token.Type == JTokenType.Null) return true;
            if (!TryReadArray(token, out var roles)) return false;
            if (roles == null) return true;

            foreach (var roleToken in roles)
            {
                var roleId = ReadRoleId(roleToken);
                if (!string.IsNullOrWhiteSpace(roleId))
                {
                    roleIds.Add(roleId.Trim());
                }
            }

            return true;
        }

        private static string ReadRoleId(JToken roleToken)
        {
            return roleToken?.Type == JTokenType.Object
                ? roleToken["Id"]?.ToString()
                : roleToken?.ToString();
        }

        private static void AddVirtualRole(
            JObject currentUser,
            string fieldName,
            bool includeBaseLimit)
        {
            if (!TryReadArray(currentUser[fieldName], out var roles) || roles == null)
            {
                roles = new JArray();
            }
            else
            {
                roles = (JArray)roles.DeepClone();
            }

            if (!roles.Any(role => string.Equals(
                    ReadRoleId(role),
                    AuthenticatedRoleId,
                    StringComparison.OrdinalIgnoreCase)))
            {
                var virtualRole = new JObject
                {
                    ["Id"] = AuthenticatedRoleId,
                    ["Name"] = "已登录用户"
                };
                if (includeBaseLimit) virtualRole["BaseLimit"] = "[]";
                roles.Add(virtualRole);
            }
            currentUser[fieldName] = roles;
        }

        private static void RemoveOnlyGetFromInvocationClone(JObject currentUser)
        {
            if (!TryReadArray(currentUser?["_Roles"], out var roles) || roles == null) return;
            foreach (var role in roles.OfType<JObject>())
            {
                var original = role["BaseLimit"];
                if (!TryReadStringSet(original, out var values)) continue;
                values.Remove("OnlyGet");
                var normalized = new JArray(values.OrderBy(value => value, StringComparer.OrdinalIgnoreCase));
                if (original is JArray)
                {
                    role["BaseLimit"] = normalized;
                }
                else
                {
                    role["BaseLimit"] = normalized.ToString(Newtonsoft.Json.Formatting.None);
                }
            }
        }

        private static bool TryReadStringSet(
            JToken token,
            out HashSet<string> values)
        {
            values = NewSet();
            if (token == null || token.Type == JTokenType.Null) return true;

            JArray array;
            if (token is JArray tokenArray)
            {
                array = tokenArray;
            }
            else
            {
                var raw = token.ToString().Trim();
                if (raw.Length == 0) return true;
                try
                {
                    array = JArray.Parse(raw);
                }
                catch
                {
                    return false;
                }
            }

            foreach (var item in array)
            {
                if (item.Type != JTokenType.String) return false;
                var value = item.ToString().Trim();
                if (value.Length > 0) values.Add(value);
            }

            return true;
        }

        private static bool TryReadArray(JToken token, out JArray array)
        {
            array = null;
            if (token == null || token.Type == JTokenType.Null) return true;
            if (token is JArray tokenArray)
            {
                array = tokenArray;
                return true;
            }

            var raw = token.ToString().Trim();
            if (raw.Length == 0) return true;
            try
            {
                array = JArray.Parse(raw);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static HashSet<string> NewSet()
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }
    }

    public sealed class ApiEngineRoleAuthorizationResult
    {
        public bool IsAllowed { get; private set; }
        public bool HasOnlyGet { get; private set; }
        public bool HasExplicitRoles { get; private set; }
        public bool HasMalformedPolicy { get; private set; }

        internal static ApiEngineRoleAuthorizationResult Allow(
            bool hasOnlyGet = false,
            bool hasExplicitRoles = false)
        {
            return new ApiEngineRoleAuthorizationResult
            {
                IsAllowed = true,
                HasOnlyGet = hasOnlyGet,
                HasExplicitRoles = hasExplicitRoles
            };
        }

        internal static ApiEngineRoleAuthorizationResult Deny(
            bool hasOnlyGet,
            bool hasExplicitRoles,
            bool hasMalformedPolicy)
        {
            return new ApiEngineRoleAuthorizationResult
            {
                IsAllowed = false,
                HasOnlyGet = hasOnlyGet,
                HasExplicitRoles = hasExplicitRoles,
                HasMalformedPolicy = hasMalformedPolicy
            };
        }
    }
}
