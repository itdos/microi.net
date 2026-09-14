using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;

namespace Microi.net
{
    /// <summary>历史路由的单一清单，同时供官方包生成器与受限兼容 Controller 使用。</summary>
    public sealed class LegacyApiRoute
    {
        public string Path { get; set; }
        public string EngineKey { get; set; }
        public string Action { get; set; }
        public string Fallback { get; set; }
        public bool Authenticated { get; set; }
        public bool PostOnly { get; set; }
    }

    public static class LegacyApiRouteCatalog
    {
        private sealed class Catalog { public List<LegacyApiRoute> Routes { get; set; } }
        public static IReadOnlyList<LegacyApiRoute> Routes { get; } = Load();
        private static IReadOnlyList<LegacyApiRoute> Load()
        {
            using var stream = typeof(LegacyApiRouteCatalog).Assembly.GetManifestResourceStream("Microi.LegacyApiRoutes.json");
            using var reader = new StreamReader(stream ?? throw new InvalidOperationException("历史路由清单缺失。"));
            var routes = JsonConvert.DeserializeObject<Catalog>(reader.ReadToEnd())?.Routes
                ?? throw new InvalidOperationException("历史路由清单无效。");
            if (routes.Any(route => !route.Path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
                || string.IsNullOrWhiteSpace(route.EngineKey) || string.IsNullOrWhiteSpace(route.Fallback))
                || routes.GroupBy(route => route.Path, StringComparer.OrdinalIgnoreCase).Any(group => group.Count() != 1))
                throw new InvalidOperationException("历史路由清单存在非法地址或重复定义。");
            return routes.AsReadOnly();
        }
    }
}
