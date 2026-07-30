using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public static class MicroiSearchEngineExtension
    {
        public static IServiceCollection AddMicroiSearchEngine(this IServiceCollection services)
        {
            services.AddSingleton<IMicroiSearchEngineHelper, MicroiElasticSearchHelper>();
            Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】注入【搜索引擎】插件成功！");
            return services;
        }
    }
}
