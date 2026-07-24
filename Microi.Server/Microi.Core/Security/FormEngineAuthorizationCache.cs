using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// The minimum menu metadata needed by the FormEngine authorization boundary.
    /// Presentation-only menu settings deliberately do not belong in this snapshot.
    /// </summary>
    public sealed class FormEngineAuthorizationMenuSnapshot
    {
        public string Id { get; set; }
        public string ModuleEngineKey { get; set; }
        public string DiyTableId { get; set; }
        public string SqlWhere { get; set; }
        public string SqlJoin { get; set; }
        public string JoinTables { get; set; }
    }

    public sealed class FormEngineAuthorizationSnapshot
    {
        public string UserId { get; set; }
        public int UserLevel { get; set; }
        public bool IsActiveUser { get; set; }
        public List<string> EffectiveRoleIds { get; set; } = new List<string>();
        public List<SysRoleLimit> RoleLimits { get; set; } = new List<SysRoleLimit>();
        public List<FormEngineAuthorizationMenuSnapshot> Menus { get; set; } =
            new List<FormEngineAuthorizationMenuSnapshot>();
    }

    /// <summary>
    /// Server-created legacy authorization scope. JsonIgnore on the owning request
    /// property prevents a browser from supplying or weakening this policy.
    /// </summary>
    public sealed class FormEngineAuthorizationPolicy
    {
        public List<string> MenuIds { get; set; } = new List<string>();
        public string SqlWhere { get; set; }
        public string SqlJoin { get; set; }
        public string JoinTables { get; set; }

        public bool HasRowScope => !string.IsNullOrWhiteSpace(SqlWhere);
    }

    /// <summary>
    /// Shared, versioned authorization cache. The version is read directly from the
    /// tenant Redis connection on every external authorization check, so a role/menu
    /// change on one API node immediately makes old L1/L2 snapshots unreachable on
    /// every other node. Snapshot values may still use the normal two-level cache.
    /// </summary>
    public static class FormEngineAuthorizationCache
    {
        private static readonly TimeSpan SnapshotTtl = TimeSpan.FromMinutes(10);
        // Increment whenever the serialized snapshot contract or authorization
        // semantics change. Redis survives API restarts and rolling upgrades, so
        // an old payload that lacks newly-added security fields must never be
        // deserialized as the current contract (missing bool/int values otherwise
        // become false/0 and can incorrectly deny a valid platform administrator).
        private const string SnapshotSchemaVersion = "2";

        public static string BuildVersionKey(string osClient)
        {
            return $"Microi:{osClient}:FormEngineAuthz:Version";
        }

        public static string BuildSnapshotKey(
            string osClient,
            string version,
            IEnumerable<string> roleIds,
            string userId = null)
        {
            var normalizedRoleSet = string.Join(
                "|",
                (roleIds ?? Array.Empty<string>())
                    .Where(d => !string.IsNullOrWhiteSpace(d))
                    .Select(d => d.Trim().ToLowerInvariant())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(d => d, StringComparer.Ordinal));
            var roleSetHash = DiyCommon.SHA256Encode(normalizedRoleSet);
            var userHash = string.IsNullOrWhiteSpace(userId)
                ? "shared"
                : DiyCommon.SHA256Encode(userId.Trim().ToLowerInvariant());
            return $"Microi:{osClient}:FormEngineAuthz:Snapshot:v{SnapshotSchemaVersion}:{version}:{userHash}:{roleSetHash}";
        }

        /// <summary>
        /// Returns null when Redis is unavailable. Callers must then bypass cached
        /// authorization and read the database; they must never use a stale snapshot.
        /// </summary>
        public static async Task<string> GetCurrentVersionAsync(string osClient)
        {
            if (string.IsNullOrWhiteSpace(osClient))
            {
                return null;
            }

            try
            {
                var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
                var key = BuildVersionKey(osClient);
                var value = await database.StringGetAsync(key).ConfigureAwait(false);
                if (value.IsNullOrEmpty)
                {
                    await database.StringSetAsync(
                            key,
                            "1",
                            expiry: null,
                            when: When.NotExists)
                        .ConfigureAwait(false);
                    value = await database.StringGetAsync(key).ConfigureAwait(false);
                }
                return value.IsNullOrEmpty ? null : value.ToString();
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：[FormEngineAuthzCache] 读取租户授权版本失败，将回源数据库：{ex.Message}");
                return null;
            }
        }

        public static async Task<FormEngineAuthorizationSnapshot> GetSnapshotAsync(
            string osClient,
            string version,
            IEnumerable<string> roleIds,
            string userId)
        {
            if (string.IsNullOrWhiteSpace(osClient) || string.IsNullOrWhiteSpace(version))
            {
                return null;
            }

            try
            {
                var key = BuildSnapshotKey(osClient, version, roleIds, userId);
                return await MicroiEngine.CacheTenant.Cache(osClient)
                    .GetAsync<FormEngineAuthorizationSnapshot>(key)
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：[FormEngineAuthzCache] 读取授权快照失败，将回源数据库：{ex.Message}");
                return null;
            }
        }

        public static async Task SetSnapshotAsync(
            string osClient,
            string version,
            IEnumerable<string> roleIds,
            string userId,
            FormEngineAuthorizationSnapshot snapshot)
        {
            if (snapshot == null
                || string.IsNullOrWhiteSpace(osClient)
                || string.IsNullOrWhiteSpace(version))
            {
                return;
            }

            try
            {
                var key = BuildSnapshotKey(osClient, version, roleIds, userId);
                await MicroiEngine.CacheTenant.Cache(osClient)
                    .SetAsync(key, snapshot, SnapshotTtl)
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                // Cache population is an optimization. The already-loaded database
                // result remains authoritative for the current request.
                Console.WriteLine(
                    $"Microi：[FormEngineAuthzCache] 写入授权快照失败：{ex.Message}");
            }
        }

        public static async Task InvalidateAsync(string osClient)
        {
            if (string.IsNullOrWhiteSpace(osClient))
            {
                return;
            }

            var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
            await database.StringIncrementAsync(BuildVersionKey(osClient))
                .ConfigureAwait(false);
        }

        public static async Task InvalidateMenuAsync(
            string osClient,
            params string[] idOrKeys)
        {
            if (string.IsNullOrWhiteSpace(osClient))
            {
                return;
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var normalizedIdOrKeys = (idOrKeys ?? Array.Empty<string>())
                .Where(d => !string.IsNullOrWhiteSpace(d))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            if (normalizedIdOrKeys.Length == 0)
            {
                // ByWhere/批量配置写入无法可靠获知所有受影响的 Id、ModuleEngineKey。
                // 这类低频管理操作按租户清理菜单元数据前缀，并由两级缓存实现广播失效。
                await cache.RemoveParentAsync(
                        $"Microi:{osClient}:FormData:sys_menu:*")
                    .ConfigureAwait(false);
            }
            else
            {
                foreach (var idOrKey in normalizedIdOrKeys)
                {
                    await cache.RemoveAsync(
                            $"Microi:{osClient}:FormData:sys_menu:{idOrKey.ToLowerInvariant()}")
                        .ConfigureAwait(false);
                }
            }
            await InvalidateAsync(osClient).ConfigureAwait(false);
        }
    }
}
