using System;
using Dos.ORM;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Microi.net
{
    /// <summary>
    /// 数据库工厂实现，支持多数据库类型
    /// 优化：线程安全、缓存、异常处理
    /// </summary>
    public class DbFactory : IDbFactory
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DbFactory> _logger;

        public DbFactory(IServiceProvider serviceProvider, ILogger<DbFactory> logger = null)
        {
            _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
            _logger = logger;
        }

        /// <summary>
        /// 创建指定类型的数据库服务实例（单例模式，线程安全）
        /// </summary>
        public IMicroiORM Create(DatabaseType dbType)
        {
            try
            {
                IMicroiORM service = dbType switch
                {
                    DatabaseType.MySql => _serviceProvider.GetRequiredService<MySqlService>(),
                    DatabaseType.Oracle => _serviceProvider.GetRequiredService<OracleService>(),
                    DatabaseType.SqlServer => _serviceProvider.GetRequiredService<SqlServerService>(),
                    _ => throw new ArgumentException($"不支持的数据库类型: {dbType}", nameof(dbType))
                };

                return service;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, $"创建数据库服务失败，类型: {dbType}");
                throw;
            }
        }
    }

    public static class MicroiORMExtensions
    {
        /// <summary>
        /// 注册Microi ORM服务（线程安全、高并发优化）
        /// 支持 Dos.ORM 和 SqlSugar 双引擎
        /// </summary>
        public static IServiceCollection AddMicroiORM(this IServiceCollection services, string ormType = "Dos.ORM")
        {
            if (services == null)
                throw new ArgumentNullException(nameof(services));

            try
            {
                // 使用Singleton确保线程安全和高并发性能
                services.AddSingleton<MySqlService>();
                services.AddSingleton<OracleService>();
                services.AddSingleton<SqlServerService>();

                // 注册 ORM 会话工厂（根据配置选择 Dos.ORM 或 SqlSugar）
                var sessionFactory = new MicroiORMSessionFactory(ormType);
                services.AddSingleton(sessionFactory);

                // 注册到全局静态访问器（供 Microi.Core 使用）
                MicroiDbSessionFactoryProvider.RegisterFactory(sessionFactory);

                // 注册数据库服务工厂
                services.AddSingleton<IDbFactory, DbFactory>();

                Console.WriteLine($"Microi：【成功】注入【Microi.ORM数据库插件】成功！当前ORM引擎：{ormType}");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】注入【Microi.ORM数据库插件】失败：{ex.Message}");
                Console.WriteLine($"详细错误：{ex.StackTrace}");
                throw; // 重新抛出异常，让上层处理
            }
        }
    }
}
