using System;

namespace Dos.ORM
{
    /// <summary>
    /// 兼容历史配置中的数据库类型名称，避免应用层维护供应商别名分支。
    /// </summary>
    public static class DatabaseTypeCompatibility
    {
        public static string NormalizeConfigurationName(string databaseTypeName)
        {
            return IsSqlServerConfigurationName(databaseTypeName)
                ? nameof(DatabaseType.SqlServer)
                : databaseTypeName;
        }

        /// <summary>
        /// SQL Server 与 SqlServer9 是同一平台的历史配置名；运行时模型统一保留
        /// SqlServer，避免升级与业务方言判断因 Provider 版本名发生分叉。
        /// </summary>
        public static bool IsSqlServerConfigurationName(string databaseTypeName)
        {
            return string.Equals(
                       databaseTypeName,
                       nameof(DatabaseType.SqlServer),
                       StringComparison.OrdinalIgnoreCase)
                   || string.Equals(
                       databaseTypeName,
                       nameof(DatabaseType.SqlServer9),
                       StringComparison.OrdinalIgnoreCase)
                   || string.Equals(
                       databaseTypeName,
                       "mssql",
                       StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// SQL Server 2005 及以上版本统一使用支持 ROW_NUMBER 分页的 SqlServer9
        /// 会话 Provider；配置仍可继续写 SqlServer 或 SqlServer9。
        /// </summary>
        public static DatabaseType NormalizeSessionProviderType(DatabaseType databaseType)
        {
            return databaseType == DatabaseType.SqlServer
                ? DatabaseType.SqlServer9
                : databaseType;
        }

        /// <summary>
        /// 将会话 Provider 的历史 SQL Server 版本枚举归一到共享的 ORM/DDL 方言服务。
        /// SqlServer 与 SqlServer9 仍保留各自的连接 Provider，但标识符、元数据和 DDL
        /// 生成规则由同一个 SqlServerService 负责，避免上层业务散落版本别名分支。
        /// </summary>
        public static DatabaseType NormalizeOrmServiceType(DatabaseType databaseType)
        {
            return databaseType == DatabaseType.SqlServer9
                ? DatabaseType.SqlServer
                : databaseType;
        }
    }
}
