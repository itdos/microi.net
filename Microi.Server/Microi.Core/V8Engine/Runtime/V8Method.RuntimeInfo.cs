using System;
using System.Reflection;
using System.Text.RegularExpressions;

namespace Microi.net
{
    public partial class V8Method
    {
        private static readonly Lazy<string> BackendVersion =
            new Lazy<string>(ResolveBackendVersion, isThreadSafe: true);

        /// <summary>
        /// 返回当前 Microi.Core 运行程序集的真实文件版本。该信息不包含密钥、路径或
        /// 主机信息，可由固定匿名健康接口安全返回给前端用于诊断与版本展示。
        /// </summary>
        public string GetBackendVersion()
        {
            return GetCurrentBackendVersion();
        }

        /// <summary>
        /// 宿主固定健康入口复用同一版本投影，不创建 V8 上下文，也不读取租户配置。
        /// </summary>
        public static string GetCurrentBackendVersion()
        {
            return BackendVersion.Value;
        }

        private static string ResolveBackendVersion()
        {
            var assembly = typeof(V8Method).Assembly;
            var fileVersion = assembly
                .GetCustomAttribute<AssemblyFileVersionAttribute>()
                ?.Version;
            var candidate = fileVersion ?? assembly.GetName().Version?.ToString();
            var match = Regex.Match(candidate ?? string.Empty, @"\d+\.\d+\.\d+");
            return match.Success ? "v" + match.Value : "未知";
        }
    }
}
