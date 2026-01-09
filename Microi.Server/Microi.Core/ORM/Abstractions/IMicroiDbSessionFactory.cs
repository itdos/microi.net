using System;
using System.Data;

namespace Microi.net
{
    /// <summary>
    /// 数据库会话工厂接口
    /// 负责创建不同ORM的会话实例（Dos.ORM、SqlSugar等）
    /// </summary>
    public interface IMicroiDbSessionFactory
    {
        /// <summary>
        /// 创建数据库会话
        /// </summary>
        /// <param name="connectionString">数据库连接字符串</param>
        /// <param name="dbType">数据库类型</param>
        /// <returns>数据库会话实例</returns>
        IMicroiDbSession CreateSession(string connectionString, DatabaseType dbType);

        /// <summary>
        /// 获取当前工厂类型（Dos.ORM、SqlSugar等）
        /// </summary>
        string FactoryType { get; }
    }
}
