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

            //2026-03-16：为MySQL连接字符串补充关键参数，防止事务期间连接超时+Fatal error
            //注意：项目使用MySql.Data（Oracle官方驱动），不支持MySqlConnector专有参数如Keepalive
            if (dbType == DatabaseType.MySql)
            {
                if (!connectionString.Contains("ConnectionReset", StringComparison.OrdinalIgnoreCase)
                    && !connectionString.Contains("Connection Reset", StringComparison.OrdinalIgnoreCase))
                {
                    connectionString = connectionString.TrimEnd(';') + ";Connection Reset=true";
                }
                if (!connectionString.Contains("DefaultCommandTimeout", StringComparison.OrdinalIgnoreCase)
                    && !connectionString.Contains("Default Command Timeout", StringComparison.OrdinalIgnoreCase))
                {
                    connectionString = connectionString.TrimEnd(';') + ";Default Command Timeout=300";
                }
                if (!connectionString.Contains("AllowUserVariables", StringComparison.OrdinalIgnoreCase)
                    && !connectionString.Contains("Allow User Variables", StringComparison.OrdinalIgnoreCase))
                {
                    connectionString = connectionString.TrimEnd(';') + ";Allow User Variables=True";
                }
                if (!connectionString.Contains("UseAffectedRows", StringComparison.OrdinalIgnoreCase)
                    && !connectionString.Contains("Use Affected Rows", StringComparison.OrdinalIgnoreCase))
                {
                    connectionString = connectionString.TrimEnd(';') + ";Use Affected Rows=False";
                }
            }

            // 将 Microi.net.DatabaseType 转换为 Dos.ORM.DatabaseType
            var dosDbType = (Dos.ORM.DatabaseType)(int)dbType;

            // 使用 Dos.ORM 创建会话（注意参数顺序：先DatabaseType后连接字符串）
            var dosSession = new DbSession(dosDbType, connectionString);

            // 包装为适配器
            return new DosORMSessionAdapter(dosSession);
        }
    }
}
