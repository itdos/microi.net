using System;
using System.Collections.Generic;
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
#if NETSTANDARD
        //public static IConfiguration Configuration { get; set; }
        public static IConfigurationRoot Configuration { get; set; }
        static ConfigHelper()
        {
            //ReloadOnChange = true 当appsettings.json被修改时重新加载            
            Configuration = new ConfigurationBuilder()
                .Add(new JsonConfigurationSource { Path = "appsettings.json", ReloadOnChange = true,Optional = true })
                .Build();
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


    }
}
