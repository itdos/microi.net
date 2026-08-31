using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.Common;

namespace Microi.net
{
    public sealed class ApiEngineCacheAliasOwner
    {
        public ApiEngineCacheAliasOwner(object apiEngine, string engineId, string engineKey, int priority)
        {
            ApiEngine = apiEngine;
            EngineId = engineId ?? string.Empty;
            EngineKey = engineKey ?? string.Empty;
            Priority = priority;
        }

        public object ApiEngine { get; }
        public string EngineId { get; }
        public string EngineKey { get; }
        public int Priority { get; }
    }

    public sealed class ApiEngineCacheAliasConflict
    {
        public ApiEngineCacheAliasConflict(string alias, IReadOnlyList<ApiEngineCacheAliasOwner> owners)
        {
            Alias = alias;
            Owners = owners;
        }

        public string Alias { get; }
        public IReadOnlyList<ApiEngineCacheAliasOwner> Owners { get; }
    }

    public sealed class ApiEngineCacheAliasResolution
    {
        public ApiEngineCacheAliasResolution(
            IReadOnlyDictionary<string, ApiEngineCacheAliasOwner> aliases,
            IReadOnlyList<ApiEngineCacheAliasConflict> conflicts)
        {
            Aliases = aliases;
            Conflicts = conflicts;
        }

        public IReadOnlyDictionary<string, ApiEngineCacheAliasOwner> Aliases { get; }
        public IReadOnlyList<ApiEngineCacheAliasConflict> Conflicts { get; }
    }

    /// <summary>
    /// 接口引擎路由别名协议。
    /// ApiAddress 是唯一主路由；ApiRoutes（界面名称“多路由”）保存以英文分号
    /// 分隔的兼容路由。缓存、动态路由、MCP 和应用导入必须共同使用本协议，
    /// 避免同一字段在不同入口出现不一致的裁剪、大小写或模板语义。
    /// </summary>
    public static class ApiEngineRouteAliases
    {
        public const string MultiRouteFieldName = "ApiRoutes";
        public const char Separator = ';';
        public const int MaxRouteLength = 500;
        public const int MaxRouteCount = 128;

        private static readonly Regex PlaceholderRegex = new Regex(
            @"^\{[A-Za-z][A-Za-z0-9_]{0,63}\}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        /// <summary>
        /// 解析英文分号分隔的多路由；保持原始大小写，按不区分大小写去重。
        /// </summary>
        public static IReadOnlyList<string> Parse(string apiRoutes)
        {
            if (apiRoutes.DosIsNullOrWhiteSpace()) return Array.Empty<string>();
            return apiRoutes
                .Split(new[] { Separator }, StringSplitOptions.RemoveEmptyEntries)
                .Select(route => route?.Trim())
                .Where(route => !route.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        /// <summary>
        /// 返回接口引擎的所有 HTTP 路由（主路由 + 多路由）。
        /// </summary>
        public static IReadOnlyList<string> GetConfiguredRoutes(object apiEngine)
        {
            if (apiEngine == null) return Array.Empty<string>();
            var routes = new List<string>();
            var primary = DynamicHelper.GetDynamicStringValue(
                apiEngine,
                "ApiAddress",
                string.Empty)?.Trim();
            if (!primary.DosIsNullOrWhiteSpace()) routes.Add(primary);
            routes.AddRange(Parse(DynamicHelper.GetDynamicStringValue(
                apiEngine,
                MultiRouteFieldName,
                string.Empty)));
            return routes.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        }

        /// <summary>
        /// 返回缓存必须写入的 Id、Key、主路由和全部多路由别名。
        /// </summary>
        public static IReadOnlyList<string> GetCacheAliases(object apiEngine)
        {
            if (apiEngine == null) return Array.Empty<string>();
            var aliases = new List<string>
            {
                DynamicHelper.GetDynamicStringValue(apiEngine, "Id", string.Empty),
                DynamicHelper.GetDynamicStringValue(apiEngine, "ApiEngineKey", string.Empty)
            };
            aliases.AddRange(GetConfiguredRoutes(apiEngine));
            return aliases
                .Where(alias => !alias.DosIsNullOrWhiteSpace())
                .Select(alias => alias.Trim().ToLowerInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        /// <summary>
        /// 返回同名缓存别名的确定性优先级。历史租户可能用另一条接口的 Id 作为
        /// 兼容 ApiEngineKey；这类 Key-vs-Id 交叉别名是可判定的，显式 Key 应覆盖
        /// 隐式 Id。相同来源类型之间的冲突必须隔离歧义别名，不能恢复为启动顺序覆盖。
        /// </summary>
        public static int GetCacheAliasPriority(object apiEngine, string alias)
        {
            if (apiEngine == null || alias.DosIsNullOrWhiteSpace()) return 0;
            var normalized = alias.Trim();
            var key = DynamicHelper.GetDynamicStringValue(
                apiEngine,
                "ApiEngineKey",
                string.Empty)?.Trim();
            if (string.Equals(key, normalized, StringComparison.OrdinalIgnoreCase)) return 300;

            if (GetConfiguredRoutes(apiEngine).Any(route => string.Equals(
                    route,
                    normalized,
                    StringComparison.OrdinalIgnoreCase)))
            {
                return 200;
            }

            var id = DynamicHelper.GetDynamicStringValue(
                apiEngine,
                "Id",
                string.Empty)?.Trim();
            return string.Equals(id, normalized, StringComparison.OrdinalIgnoreCase) ? 100 : 0;
        }

        /// <summary>
        /// 以与数据返回顺序无关的方式解析全部缓存别名。Key、Route、Id 的优先级
        /// 依次降低；若最高优先级仍有多个接口归属，则仅隔离该歧义别名，保留各
        /// 接口的其它唯一别名，避免一条租户脏数据阻断整个平台启动与升级。
        /// </summary>
        public static ApiEngineCacheAliasResolution ResolveCacheAliases(IEnumerable<object> apiEngines)
        {
            var claims = new Dictionary<string, List<ApiEngineCacheAliasOwner>>(
                StringComparer.OrdinalIgnoreCase);
            foreach (var apiEngine in apiEngines ?? Enumerable.Empty<object>())
            {
                if (apiEngine == null) continue;
                var engineId = DynamicHelper.GetDynamicStringValue(
                    apiEngine,
                    "Id",
                    string.Empty)?.Trim() ?? string.Empty;
                var engineKey = DynamicHelper.GetDynamicStringValue(
                    apiEngine,
                    "ApiEngineKey",
                    string.Empty)?.Trim() ?? string.Empty;
                foreach (var alias in GetCacheAliases(apiEngine))
                {
                    if (!claims.TryGetValue(alias, out var owners))
                    {
                        owners = new List<ApiEngineCacheAliasOwner>();
                        claims[alias] = owners;
                    }

                    var ownerIdentity = !engineId.DosIsNullOrWhiteSpace()
                        ? engineId
                        : "Key:" + engineKey;
                    if (owners.Any(owner => string.Equals(
                            !owner.EngineId.DosIsNullOrWhiteSpace()
                                ? owner.EngineId
                                : "Key:" + owner.EngineKey,
                            ownerIdentity,
                            StringComparison.OrdinalIgnoreCase)))
                    {
                        continue;
                    }

                    owners.Add(new ApiEngineCacheAliasOwner(
                        apiEngine,
                        engineId,
                        engineKey,
                        GetCacheAliasPriority(apiEngine, alias)));
                }
            }

            var aliases = new Dictionary<string, ApiEngineCacheAliasOwner>(
                StringComparer.OrdinalIgnoreCase);
            var conflicts = new List<ApiEngineCacheAliasConflict>();
            foreach (var claim in claims.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase))
            {
                var maxPriority = claim.Value.Max(owner => owner.Priority);
                var highestPriorityOwners = claim.Value
                    .Where(owner => owner.Priority == maxPriority)
                    .OrderBy(owner => owner.EngineKey, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(owner => owner.EngineId, StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                if (highestPriorityOwners.Length > 1)
                {
                    conflicts.Add(new ApiEngineCacheAliasConflict(claim.Key, highestPriorityOwners));
                    continue;
                }

                aliases[claim.Key] = highestPriorityOwners[0];
            }

            return new ApiEngineCacheAliasResolution(aliases, conflicts);
        }

        public static bool ContainsExactRoute(object apiEngine, string route)
        {
            if (route.DosIsNullOrWhiteSpace()) return false;
            return GetConfiguredRoutes(apiEngine).Any(configured =>
                string.Equals(configured, route.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        public static bool IsTemplateRoute(string route)
        {
            return !route.DosIsNullOrWhiteSpace()
                && route.IndexOf('{') >= 0;
        }

        /// <summary>
        /// 验证主路由与多路由的协议格式。数据库唯一性由保存事件和缓存初始化
        /// 结合租户全表检查；本方法只验证单条记录内部语义。
        /// </summary>
        public static bool TryValidate(string apiAddress, string apiRoutes, out string error)
        {
            error = string.Empty;
            var routes = Parse(apiRoutes);
            if (routes.Count > MaxRouteCount)
            {
                error = $"多路由最多允许 {MaxRouteCount} 个地址。";
                return false;
            }

            var all = new List<string>();
            if (!apiAddress.DosIsNullOrWhiteSpace()) all.Add(apiAddress.Trim());
            all.AddRange(routes);
            foreach (var route in all)
            {
                if (!TryValidateRoute(route, out error)) return false;
            }

            if (!apiAddress.DosIsNullOrWhiteSpace()
                && routes.Any(route => string.Equals(
                    route,
                    apiAddress.Trim(),
                    StringComparison.OrdinalIgnoreCase)))
            {
                error = "多路由不能重复填写主路由 ApiAddress。";
                return false;
            }
            return true;
        }

        public static bool TryValidateRoute(string route, out string error)
        {
            error = string.Empty;
            if (route.DosIsNullOrWhiteSpace())
            {
                error = "路由不能为空。";
                return false;
            }
            route = route.Trim();
            if (route.Length > MaxRouteLength)
            {
                error = $"路由长度不能超过 {MaxRouteLength} 个字符。";
                return false;
            }
            if (!route.StartsWith("/", StringComparison.Ordinal)
                || route.IndexOf('\\') >= 0
                || route.IndexOf('?') >= 0
                || route.IndexOf('#') >= 0
                || route.IndexOf('\r') >= 0
                || route.IndexOf('\n') >= 0)
            {
                error = $"路由[{route}]必须以 / 开头，且不能包含查询串、片段、反斜杠或换行。";
                return false;
            }

            foreach (var segment in route.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (segment.IndexOf('{') < 0 && segment.IndexOf('}') < 0) continue;
                if (!PlaceholderRegex.IsMatch(segment))
                {
                    error = $"模板路由[{route}]的占位符必须独占完整路径段，并使用 {{Name}} 格式。";
                    return false;
                }
            }
            return true;
        }
    }
}
