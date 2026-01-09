using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    /// <summary>
    /// ORM 工厂全局访问器
    /// 提供静态方法访问 ORM 会话工厂
    /// </summary>
    public static class MicroiORMFactory
    {
        private static IServiceProvider _serviceProvider;
        private static MicroiORMSessionFactory _sessionFactory;

        /// <summary>
        /// 初始化工厂（从 Program.cs 调用）
        /// </summary>
        public static void Initialize(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
            _sessionFactory = serviceProvider.GetService<MicroiORMSessionFactory>();
        }

        /// <summary>
        /// 创建数据库会话
        /// </summary>
        public static IMicroiDbSession CreateSession(string connectionString, DatabaseType dbType)
        {
            if (_sessionFactory == null)
            {
                throw new InvalidOperationException("MicroiORMFactory has not been initialized. Call Initialize() first.");
            }

            return _sessionFactory.CreateSession(connectionString, dbType);
        }

        /// <summary>
        /// 获取当前 ORM 类型
        /// </summary>
        public static string GetCurrentORMType()
        {
            return _sessionFactory?.GetCurrentORMType() ?? "Unknown";
        }
    }
}
