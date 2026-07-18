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
            return string.Equals(
                    databaseTypeName,
                    nameof(DatabaseType.SqlServer),
                    StringComparison.OrdinalIgnoreCase)
                ? nameof(DatabaseType.SqlServer9)
                : databaseTypeName;
        }
    }
}
