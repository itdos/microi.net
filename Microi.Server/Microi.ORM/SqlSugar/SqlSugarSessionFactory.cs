using System;
using SqlSugar;

namespace Microi.net
{
    /// <summary>
    /// SqlSugar 会话工厂
    /// 用于创建 SqlSugar 数据库会话
    /// </summary>
    public class SqlSugarSessionFactory : IMicroiDbSessionFactory
    {
        /// <summary>
        /// 工厂类型
        /// </summary>
        public string FactoryType => "SqlSugar";
        /// <summary>
        /// 创建数据库会话
        /// </summary>
        public IMicroiDbSession CreateSession(string connectionString, DatabaseType dbType)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new ArgumentException("Connection string cannot be null or empty.", nameof(connectionString));

            var sugarDbType = ConvertToSugarDbType(dbType);
            
            // 【MySQL 修复】为 MySQL 添加必要的连接参数，避免 "Out of sync" 错误
            if (dbType == DatabaseType.MySql)
            {
                // AllowUserVariables=True: 允许用户变量
                // UseAffectedRows=False: 使用匹配行数而非影响行数
                if (!connectionString.Contains("AllowUserVariables", StringComparison.OrdinalIgnoreCase))
                {
                    connectionString = connectionString.TrimEnd(';') + ";AllowUserVariables=True;UseAffectedRows=False";
                }
            }
            
            // 修复：为 SQL Server 添加 MARS 支持，避免 "already an open DataReader" 错误
            if (dbType == DatabaseType.SqlServer || dbType == DatabaseType.SqlServer9)
            {
                if (!connectionString.Contains("MultipleActiveResultSets", StringComparison.OrdinalIgnoreCase))
                {
                    connectionString = connectionString.TrimEnd(';') + ";MultipleActiveResultSets=true";
                }
            }
            
            var config = new ConnectionConfig
            {
                ConnectionString = connectionString,
                DbType = sugarDbType,
                IsAutoCloseConnection = true,  // 【关键】自动关闭连接，每次查询后立即关闭
                InitKeyType = InitKeyType.Attribute,
                // 【关键配置】避免 DataReader 冲突
                MoreSettings = new ConnMoreSettings
                {
                    IsAutoRemoveDataCache = true,  // 自动移除数据缓存，避免缓存冲突
                    // 【重要】禁用命令缓存，确保每次查询都是全新的命令对象
                    DisableNvarchar = false
                },
                // 【MySQL 修复】配置连接字符串不要使用压缩协议，避免 "Out of sync" 错误
                ConfigureExternalServices = new ConfigureExternalServices()
            };

            var client = new SqlSugarClient(config);
            
            // 【关键】每次 Ado 操作都使用新的 Command 对象，避免状态冲突
            client.Ado.IsEnableLogEvent = false;  // 关闭日志避免干扰
            
            return new SqlSugarSessionAdapter(client);
        }

        /// <summary>
        /// 转换数据库类型
        /// </summary>
        private SqlSugar.DbType ConvertToSugarDbType(DatabaseType dbType)
        {
            return dbType switch
            {
                DatabaseType.MySql => SqlSugar.DbType.MySql,
                DatabaseType.SqlServer => SqlSugar.DbType.SqlServer,
                DatabaseType.Oracle => SqlSugar.DbType.Oracle,
                _ => SqlSugar.DbType.MySql
            };
        }
    }
}
