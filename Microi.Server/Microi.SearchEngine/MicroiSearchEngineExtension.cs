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
            return services;
        }
    }
}
