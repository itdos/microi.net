#if NETSTANDARD || NETCOREAPP
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
#else
using System.Web;
#endif
namespace Microi.net.Api
{
    public static class UEditorMvcExtension
    {
#if NETSTANDARD || NETCOREAPP
        /// <summary>
        /// 添加UEditor后端服务
        /// </summary>
        /// <param name="services">IServiceCollection</param>
        /// <param name="configFileRelativePath">配置文件相对路径</param>
        /// <param name="isCacheConfig">是否缓存配置文件</param>
        /// <param name="basePath">配置文件、文件存储路径等各种路径的根目录，默认为Web项目的根目录</param>
        public static void AddUEditorService(this IServiceCollection services,
            string configFileRelativePath = "ueditor.json",
            bool isCacheConfig = true,
            string basePath = "")
        {

            UeditorConfig.ConfigFile = configFileRelativePath;
            UeditorConfig.NoCache = isCacheConfig;
            UeditorConfig.WebRootPath = basePath;

            services.TryAddSingleton<UEditorService>();
        }
#endif
#if NET40
        public static void AddUEditorService(string configFileRelativePath = "ueditor.json", bool isCacheConfig = true, string basePath = "", string environmentName = "")
        {
            Config.ConfigFile = configFileRelativePath;
            Config.NoCache = isCacheConfig;
            if (!basePath.IsNullOrWhiteSpace())
            {
                Config.WebRootPath = basePath;
            }
            else
            {
                Config.WebRootPath = HttpContext.Current.Server.MapPath("~/");
            }

            Config.EnvName = environmentName;
        }
#endif

    }
}
