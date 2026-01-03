using System;
using Dos.ORM;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public class DbFactory : IDbFactory
    {
        private readonly IServiceProvider _serviceProvider;
        
        public DbFactory(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }
        
        public IMicroiORM Create(DatabaseType dbType)
        {
            return dbType switch
            {
                DatabaseType.MySql => _serviceProvider.GetRequiredService<MySqlService>(),
                DatabaseType.Oracle => _serviceProvider.GetRequiredService<OracleService>(),
                DatabaseType.SqlServer => _serviceProvider.GetRequiredService<SqlServerService>(),
                _ => throw new ArgumentException($"不支持的数据库类型: {dbType}")
            };
        }
    }

    public static class MicroiORMExtensions
    {
        public static IServiceCollection AddMicroiORM(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<MySqlService>();
                services.AddSingleton<OracleService>();
                services.AddSingleton<SqlServerService>();

                // 注册工厂
                services.AddSingleton<IDbFactory, DbFactory>();

                Console.WriteLine("Microi：【成功】注入【Microi.ORM数据库插件】成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【Microi.ORM数据库插件】失败：" + ex.Message);
                return services;
            }
        }
    }
}
