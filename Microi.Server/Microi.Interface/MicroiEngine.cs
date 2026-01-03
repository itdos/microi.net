using System;
using System.Collections.Generic;
using Dos.ORM;
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

        public static IMicroiORM ORM(DatabaseType dbType) => GetService<IDbFactory>().Create(dbType);
        public static IMicroiHDFS HDFS(HDFSType hdfsType) => GetService<IHDFSFactory>().Create(hdfsType);

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
    public enum HDFSType
    {
        MinIO,
        Aliyun,
        AmazonS3
    }
    // public interface IMicroiPlugins
    // {
    //     // 新增缓存工厂
    //     IMicroiCacheTenant MicroiCacheTenant { get; }
    //     // 保留原有的无参缓存（使用默认）
    //     // IMicroiCache MicroiCache { get; }

    //     IMicroiOffice MicroiOffice { get; }
    //     IMicroiSpider MicroiSpider { get; }
    //     IMicroiMQ MicroiMQ { get; }
    //     IMicroiWeChat MicroiWeChat { get; }
    //     IMicroiJob MicroiJob { get; }
    //     IWFEngine WFEngine { get; }
    //     IFormEngine FormEngine { get; }
    //     IApiEngine ApiEngine { get; }
    //     IV8Engine V8Engine { get; }
    //     IDataSourceEngine DataSourceEngine { get; }
    //     IModuleEngine ModuleEngine { get; }
    //     IMicroiHttp MicroiHttp{ get; }
    //     ITranslateEngine TranslateEngine{ get; }
    //     // 数据库属性
    //     IMicroiORM DbMySql { get; }
    //     IMicroiORM DbOracle { get; }
    //     IMicroiORM DbSqlServer { get; }
    //     IMicroiORM Db(DatabaseType dbType);
    //     // 分布式存储属性
    //     IMicroiHDFS HDFSMinIO { get; }
    //     IMicroiHDFS HDFSAliyun { get; }
    //     IMicroiHDFS HDFSAmazonS3 { get; }
    //     IMicroiHDFS HDFS(HDFSType dbType);
    // }
}


