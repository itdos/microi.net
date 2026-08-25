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
