using System;
using System.Collections.Generic;

using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiEngine
    {
        private static IServiceProvider _serviceProvider;

        public static void Init(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }
        public static T GetService<T>() where T : class
        {
            if (_serviceProvider == null)
                throw new InvalidOperationException("Microi：【Error异常】ServiceLocator未初始化！");
            return _serviceProvider.GetRequiredService<T>();
        }
        // public static IMicroiPlugins Plugins => GetService<IMicroiPlugins>();
        public static IApiEngine ApiEngine => GetService<IApiEngine>();
        public static IFormEngine FormEngine => GetService<IFormEngine>();
        public static IV8Engine V8Engine => GetService<IV8Engine>();
        public static IDataSourceEngine DataSource => GetService<IDataSourceEngine>();
        public static IModuleEngine ModuleEngine => GetService<IModuleEngine>();
        public static IMicroiHttp Http => GetService<IMicroiHttp>();
        public static IV8Method V8Method => GetService<IV8Method>();
        public static IMicroiCacheTenant CacheTenant => GetService<IMicroiCacheTenant>();
        public static ITranslateEngine Translate => GetService<ITranslateEngine>();
        public static IMicroiSpider Spider => GetService<IMicroiSpider>();
        public static IMicroiOffice Office => GetService<IMicroiOffice>();
        public static IMicroiMQ MQ => GetService<IMicroiMQ>();
        public static IWFEngine WFEngine => GetService<IWFEngine>();
        public static IMicroiJob Job => GetService<IMicroiJob>();
        public static IMongoDB MongoDB => GetService<IMongoDB>();
        public static IMicroiLock Lock => GetService<IMicroiLock>();

        public static IMicroiORM ORM(DatabaseType dbType) => GetService<IDbFactory>().Create(dbType);
        /// <summary>
        /// 此模式下仅用于调用【public class MicroiHDFS 】下的3个方法
        /// </summary>
        public static IMicroiHDFS HDFS => GetService<IHDFSFactory>().Create(HDFSType.Default);
        public static IMicroiHDFS HDFSFactory(HDFSType hdfsType) => GetService<IHDFSFactory>().Create(hdfsType);

    }
    public interface IMicroiCacheTenant
    {
        IMicroiCache Cache(string osClient);
        IMicroiCache Default();
    }
    public interface IDbFactory
    {
        IMicroiORM Create(DatabaseType dbType);
    }
    public interface IHDFSFactory
    {
        IMicroiHDFS Create(HDFSType hdfsType);
    }
}