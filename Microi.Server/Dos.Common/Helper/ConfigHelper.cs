using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;

#if NETSTANDARD
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Configuration.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
//using Microsoft.Extensions.Options;
using Newtonsoft.Json;
#endif

namespace Dos.Common
{
    /// <summary>
    /// 读取配置文件
    /// </summary>
    public class ConfigHelper
    {
        private static Func<string, string> RuntimeConfigurationReader { get; set; }

        /// <summary>
        /// 注册运行期配置读取器。用于让主租户 sys_osclients 中的平台级配置参与统一配置优先级：
        /// 环境变量 > 主租户 sys_osclients > appsettings.json > 代码默认值。
        /// </summary>
        public static void SetRuntimeConfigurationReader(Func<string, string> reader)
        {
            RuntimeConfigurationReader = reader;
        }

        private static string GetRuntimeConfiguration(string key)
        {
            if (string.IsNullOrWhiteSpace(key) || RuntimeConfigurationReader == null)
            {
                return null;
            }

            try
            {
                return RuntimeConfigurationReader.Invoke(key);
            }
            catch
            {
                return null;
            }
        }

#if NETSTANDARD
        //public static IConfiguration Configuration { get; set; }
        public static IConfigurationRoot Configuration { get; set; }
        static ConfigHelper()
        {
            //ReloadOnChange = true 当appsettings.json被修改时重新加载
            var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
            var basePath = ResolveConfigurationBasePath(environment);

            Configuration = new ConfigurationBuilder()
                .SetBasePath(basePath)
                .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
                .AddJsonFile($"appsettings.{environment}.json", optional: true, reloadOnChange: true)
                .AddEnvironmentVariables()
                .Build();
        }

        private static string ResolveConfigurationBasePath(string environment)
        {
            var configured = Environment.GetEnvironmentVariable("MICROI_CONFIG_BASE_PATH");
            if (!string.IsNullOrWhiteSpace(configured))
            {
                var configuredPath = Path.GetFullPath(configured);
                if (Directory.Exists(configuredPath)) return configuredPath;
            }

            var candidates = new[]
            {
                Directory.GetCurrentDirectory(),
                AppContext.BaseDirectory,
                Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", ".."))
            }
            .Where(path => !string.IsNullOrWhiteSpace(path) && Directory.Exists(path))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

            var environmentFile = $"appsettings.{environment}.json";
            return candidates.FirstOrDefault(path => File.Exists(Path.Combine(path, environmentFile)))
                   ?? candidates.FirstOrDefault(path => File.Exists(Path.Combine(path, "appsettings.json")))
                   ?? Directory.GetCurrentDirectory();
        }
        /// <summary>
        /// 直接传入 Name
        /// </summary>
        /// <param name="name"></param>
        /// <returns></returns>
        public static string GetAppSettings(string name)
        {
            return Configuration["AppSettings:" + name];
        }
        /// <summary>
        /// 传入形如"AliyunSmsSettings:AccessKeyId"、"AppSettings:SystemName"
        /// </summary>
        /// <param name="name"></param>
        /// <returns></returns>
        public static string GetConfiguration(string path)
        {
            return Configuration[path];
        }
        public static List<T> GetConfiguration<T>(string path)
        {
            //集合配置
            var spList = new ServiceCollection()
                            .AddOptions()
                            .Configure<List<T>>(Configuration.GetSection(path))
                            .BuildServiceProvider();
            var jobConfigList1 = spList.GetService<IOptions<List<T>>>().Value;
            return jobConfigList1;
        }
        //public static T GetConfiguration<T>(string path)
        //{
        //    return JsonConvert.DeserializeObject<T>(Configuration.GetSection(path).Value);
        //}
        /// <summary>
        /// 直接传入Name
        /// </summary>
        /// <param name="name"></param>
        /// <returns></returns>
        public static string GetConnectionString(string name)
        {
            return Configuration.GetConnectionString(name);
        }
        /// <summary>
        /// 注意：core中没有ProviderName的概念，Dos.Common定义ProviderName为ConnectionStringName + ProviderName， 如SqlServer9TzyProviderName
        /// </summary>
        /// <param name="name"></param>
        /// <returns></returns>
        public static string GetConnectionStringProviderName(string name)
        {
            return Configuration.GetConnectionString(name + "ProviderName");
        }
        //读取数据库链接字符串
        //    ConfigHelper.Configuration.GetConnectionString("CxyOrder");
        ////得到 Server=LAPTOP-AQUL6MDE\\MSSQLSERVERS;Database=CxyOrder;User ID=sa;Password=123456;Trusted_Connection=False;

        //读取一级配置节点配置
        //    ConfigHelper.Configuration["ServiceUrl"];
        ////得到 https://www.baidu.com/getnews

        //读取二级子节点配置
        //    ConfigHelper.Configuration["AppSettings:SystemName"];
        ////得到 PDF .NET CORE
        //ConfigHelper.Configuration["AppSettings:Author"];
        ////得到 PDF
#else
        /// <summary>
        /// 直接传入Name
        /// </summary>
        /// <param name="name"></param>
        /// <returns></returns>
        public static string GetAppSettings(string name) {
            return System.Configuration.ConfigurationManager.AppSettings[name];
        }
        /// <summary>
        /// 直接传入Name
        /// </summary>
        /// <param name="name"></param>
        /// <returns></returns>
        public static string GetConnectionString(string name)
        {
            return System.Configuration.ConfigurationManager.ConnectionStrings[name].ConnectionString;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="name"></param>
        /// <returns></returns>
        public static string GetConnectionStringProviderName(string name)
        {
            return System.Configuration.ConfigurationManager.ConnectionStrings[name].ProviderName;
        }
        public static string GetConfiguration(string path)
        {
            return null;
        }
#endif

        public static string GetEnvOrConfiguration(string envKey, string configPath = null)
        {
            var value = Environment.GetEnvironmentVariable(envKey, EnvironmentVariableTarget.Process)
                        ?? Environment.GetEnvironmentVariable(envKey);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }

            if (!string.IsNullOrWhiteSpace(configPath))
            {
                value = GetRuntimeConfiguration(configPath);
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }

            value = GetRuntimeConfiguration(envKey);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }

            if (!string.IsNullOrWhiteSpace(configPath))
            {
                value = GetConfiguration(configPath);
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }

            return null;
        }

        public static int GetEnvOrConfigurationInt(string envKey, string configPath, int defaultValue)
        {
            var value = GetEnvOrConfiguration(envKey, configPath);
            if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) && parsed > 0)
            {
                return parsed;
            }

            return defaultValue;
        }

        public static bool GetEnvOrConfigurationBool(string envKey, string configPath, bool defaultValue)
        {
            var value = GetEnvOrConfiguration(envKey, configPath);
            if (bool.TryParse(value, out var parsed))
            {
                return parsed;
            }
            if (string.Equals(value, "1", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "on", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            if (string.Equals(value, "0", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "no", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "off", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return defaultValue;
        }


    }
}
