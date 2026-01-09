using System;

namespace Microi.net
{
    /// <summary>
    /// 数据库会话工厂提供器（全局静态访问）
    /// 用于解决 Microi.Core 不能直接引用 Microi.ORM 的问题
    /// </summary>
    public static class MicroiDbSessionFactoryProvider
    {
        private static IMicroiDbSessionFactory _factory;

        /// <summary>
        /// 注册工厂实现（从 Microi.ORM 或 Microi.net 调用）
        /// </summary>
        public static void RegisterFactory(IMicroiDbSessionFactory factory)
        {
            _factory = factory ?? throw new ArgumentNullException(nameof(factory));
        }

        /// <summary>
        /// 创建数据库会话
        /// </summary>
        public static IMicroiDbSession CreateSession(string connectionString, DatabaseType dbType)
        {
            if (_factory == null)
            {
                throw new InvalidOperationException(
                    "MicroiDbSessionFactory has not been registered. " +
                    "Call MicroiDbSessionFactoryProvider.RegisterFactory() first.");
            }

            return _factory.CreateSession(connectionString, dbType);
        }

        /// <summary>
        /// 获取工厂类型
        /// </summary>
        public static string GetFactoryType()
        {
            return _factory?.FactoryType ?? "Unknown";
        }
    }
}
