using System;
using Dos.ORM;


namespace Microi.net
{
    /// <summary>
    /// Dos.ORM 会话工厂实现
    /// 负责创建基于Dos.ORM的数据库会话
    /// </summary>
    public class DosORMSessionFactory : IMicroiDbSessionFactory
    {
        /// <summary>
        /// 工厂类型标识
        /// </summary>
        public string FactoryType => "Dos.ORM";

        /// <summary>
        /// 创建数据库会话
        /// </summary>
        /// <param name="connectionString">数据库连接字符串</param>
        /// <param name="dbType">数据库类型</param>
        /// <returns>数据库会话实例</returns>
        public IMicroiDbSession CreateSession(string connectionString, DatabaseType dbType)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new ArgumentNullException(nameof(connectionString));

            // 将 Microi.net.DatabaseType 转换为 Dos.ORM.DatabaseType
            var dosDbType = (Dos.ORM.DatabaseType)(int)dbType;

            // 使用 Dos.ORM 创建会话（注意参数顺序：先DatabaseType后连接字符串）
            var dosSession = new DbSession(dosDbType, connectionString);

            // 包装为适配器
            return new DosORMSessionAdapter(dosSession);
        }
    }
}
