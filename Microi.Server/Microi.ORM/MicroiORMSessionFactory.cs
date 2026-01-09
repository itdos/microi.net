using System;

namespace Microi.net
{
    /// <summary>
    /// ORM 会话工厂
    /// 根据配置动态选择 Dos.ORM 或 SqlSugar
    /// </summary>
    public class MicroiORMSessionFactory : IMicroiDbSessionFactory
    {
        private readonly IMicroiDbSessionFactory _dosORMFactory;
        private readonly IMicroiDbSessionFactory _sqlSugarFactory;
        private readonly string _ormType;

        /// <summary>
        /// 工厂类型（实现接口）
        /// </summary>
        public string FactoryType => _ormType;

        /// <summary>
        /// 构造函数
        /// </summary>
        /// <param name="ormType">ORM 类型："Dos.ORM" 或 "SqlSugar"</param>
        public MicroiORMSessionFactory(string ormType = "Dos.ORM")
        {
            _ormType = ormType ?? "Dos.ORM";
            _dosORMFactory = new DosORMSessionFactory();
            _sqlSugarFactory = new SqlSugarSessionFactory();
        }

        /// <summary>
        /// 创建数据库会话
        /// </summary>
        public IMicroiDbSession CreateSession(string connectionString, DatabaseType dbType)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new ArgumentException("Connection string cannot be null or empty.", nameof(connectionString));

            return _ormType.ToUpper() switch
            {
                "SQLSUGAR" => _sqlSugarFactory.CreateSession(connectionString, dbType),
                "DOS.ORM" => _dosORMFactory.CreateSession(connectionString, dbType),
                _ => _dosORMFactory.CreateSession(connectionString, dbType) // 默认使用 Dos.ORM
            };
        }

        /// <summary>
        /// 获取当前 ORM 类型
        /// </summary>
        public string GetCurrentORMType()
        {
            return _ormType;
        }
    }
}
