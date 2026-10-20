using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>旧等级仅按旧库证据转换；内置管理员身份独立修复。</summary>
    public static class SecurityLevelMigrationPolicy
    {
        public const string Version = "7.6.17.0";

        public static bool IsLegacyDatabase(string version, bool hasModernAdministrator)
        {
            if (hasModernAdministrator) return false;
            if (string.IsNullOrWhiteSpace(version)) return true;
            return System.Version.TryParse(version, out var parsed)
                && parsed.Revision >= 0
                && parsed < new System.Version("7.6.15.0");
        }

        public static int RoleLevel(string name, int level, bool legacy) =>
            string.Equals(name?.Trim(), "超级管理员", StringComparison.Ordinal)
                ? 9999 : LegacyLevel(level, legacy);

        public static int UserLevel(string account, int level, bool legacy) =>
            string.Equals(account?.Trim(), "admin", StringComparison.OrdinalIgnoreCase)
                ? 9999 : LegacyLevel(level, legacy);

        private static int LegacyLevel(int level, bool legacy) =>
            !legacy ? level : level == 999 ? 9999 : level == 998 ? 9998 : level;

        public static string RefreshRoleSnapshot(string json, IReadOnlyDictionary<string, int> levels)
        {
            if (string.IsNullOrWhiteSpace(json)) return json;
            var roles = JArray.Parse(json);
            var changed = false;
            foreach (var item in roles)
            {
                // 历史快照也支持纯 Id 列表；只同步对象的等级，不猜测或添加角色绑定。
                if (item is not JObject role) continue;
                var id = role["Id"]?.ToString();
                if (id != null && levels.TryGetValue(id, out var level)
                    && role["Level"]?.ToString() != level.ToString())
                {
                    role["Level"] = level;
                    changed = true;
                }
            }
            return changed ? roles.ToString(Newtonsoft.Json.Formatting.None) : json;
        }
    }
}
