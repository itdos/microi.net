using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.Common;

namespace Microi.net
{
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
