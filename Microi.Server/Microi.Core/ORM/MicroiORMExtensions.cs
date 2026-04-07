using System;
using System.Data.Common;
using System.Linq;
using Dos.ORM;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Microi.net
{
    /// <summary>
    /// 数据库工厂实现，支持多数据库类型
    /// </summary>
    public class DbFactory : IDbFactory
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DbFactory> _logger;

        public DbFactory(IServiceProvider serviceProvider, ILogger<DbFactory> logger = null)
        {
            _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
            _logger = logger;
        }

        public IMicroiORM Create(Dos.ORM.DatabaseType dbType)
        {
            try
            {
                IMicroiORM service = dbType switch
                {
                    Dos.ORM.DatabaseType.MySql => _serviceProvider.GetRequiredService<MySqlService>(),
                    Dos.ORM.DatabaseType.Oracle => _serviceProvider.GetRequiredService<OracleService>(),
                    Dos.ORM.DatabaseType.SqlServer => _serviceProvider.GetRequiredService<SqlServerService>(),
                    Dos.ORM.DatabaseType.PostgreSql => _serviceProvider.GetRequiredService<PostgreSqlService>(),
                    Dos.ORM.DatabaseType.DaMeng => _serviceProvider.GetRequiredService<DaMengService>(),
                    Dos.ORM.DatabaseType.KingBase => _serviceProvider.GetRequiredService<KingBaseService>(),
                    _ => throw new ArgumentException($"不支持的数据库类型: {dbType}", nameof(dbType))
                };
                return service;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, $"创建数据库服务失败，类型: {dbType}");
                throw;
            }
        }
    }

    public static class MicroiORMExtensions
    {
        /// <summary>
        /// 创建 Dos.ORM DbSession（含 MySQL 连接字符串自动补充参数）
        /// </summary>
        public static DbSession CreateDbSession(string connectionString, Dos.ORM.DatabaseType dbType)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new ArgumentNullException(nameof(connectionString));

            // MySQL连接字符串补充关键参数
            if (dbType == Dos.ORM.DatabaseType.MySql)
            {
                if (!connectionString.Contains("ConnectionReset", StringComparison.OrdinalIgnoreCase)
                    && !connectionString.Contains("Connection Reset", StringComparison.OrdinalIgnoreCase))
                    connectionString = connectionString.TrimEnd(';') + ";Connection Reset=true";

                if (!connectionString.Contains("DefaultCommandTimeout", StringComparison.OrdinalIgnoreCase)
                    && !connectionString.Contains("Default Command Timeout", StringComparison.OrdinalIgnoreCase))
                    connectionString = connectionString.TrimEnd(';') + ";Default Command Timeout=300";

                if (!connectionString.Contains("AllowUserVariables", StringComparison.OrdinalIgnoreCase)
                    && !connectionString.Contains("Allow User Variables", StringComparison.OrdinalIgnoreCase))
                    connectionString = connectionString.TrimEnd(';') + ";Allow User Variables=True";

                if (!connectionString.Contains("UseAffectedRows", StringComparison.OrdinalIgnoreCase)
                    && !connectionString.Contains("Use Affected Rows", StringComparison.OrdinalIgnoreCase))
                    connectionString = connectionString.TrimEnd(';') + ";Use Affected Rows=False";
            }

            return new DbSession(dbType, connectionString);
        }

        /// <summary>
        /// 注册Microi ORM服务
        /// </summary>
        public static IServiceCollection AddMicroiORM(this IServiceCollection services)
        {
            if (services == null)
                throw new ArgumentNullException(nameof(services));

            try
            {
                services.AddSingleton<MySqlService>();
                services.AddSingleton<OracleService>();
                services.AddSingleton<SqlServerService>();
                services.AddSingleton<PostgreSqlService>();
                services.AddSingleton<DaMengService>();
                services.AddSingleton<KingBaseService>();
                services.AddSingleton<IDbFactory, DbFactory>();

                // 设置DDL多语言回调
                DDLConfig.GetLang = DiyMessage.GetLang;
                DDLConfig.DefaultLang = DiyMessage.Lang;

                // 设置慢SQL日志回调
                Section.SlowSqlThresholdMs = DiyCommon.SlowSqlThresholdMs;
                Section.OnSlowSql = (cmd, elapsedMs, method) =>
                {
                    var sqlText = cmd?.CommandText ?? "(unknown)";
                    if (sqlText.Length > 2000) sqlText = sqlText.Substring(0, 2000) + "...";

                    string paramText = null;
                    string executableSql = null;
                    if (cmd?.Parameters != null && cmd.Parameters.Count > 0)
                    {
                        try
                        {
                            var paramDict = new System.Collections.Generic.Dictionary<string, string>();
                            foreach (DbParameter p in cmd.Parameters)
                                paramDict[p.ParameterName] = p.Value?.ToString() ?? "NULL";
                            paramText = System.Text.Json.JsonSerializer.Serialize(paramDict);

                            executableSql = cmd.CommandText ?? "";
                            var paramList = new System.Collections.Generic.List<DbParameter>();
                            foreach (DbParameter p in cmd.Parameters) paramList.Add(p);
                            foreach (var p in paramList.OrderByDescending(x => x.ParameterName.Length))
                            {
                                var val = p.Value;
                                string replacement;
                                if (val == null || val == System.DBNull.Value) replacement = "NULL";
                                else if (val is string || val is DateTime || val is Guid) replacement = $"'{val.ToString().Replace("'", "''")}'";
                                else replacement = val.ToString();
                                executableSql = System.Text.RegularExpressions.Regex.Replace(
                                    executableSql,
                                    "[?@:]" + System.Text.RegularExpressions.Regex.Escape(p.ParameterName.TrimStart('@', '?', ':')) + @"\b",
                                    _ => replacement);
                            }
                            if (executableSql.Length > 4000) executableSql = executableSql.Substring(0, 4000) + "...";
                        }
                        catch { }
                    }

                    var msg = $"慢SQL[{method}] 耗时{elapsedMs}ms（阈值{DiyCommon.SlowSqlThresholdMs}ms）: {sqlText}";
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】{msg}");
                    _ = MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                    {
                        Type = "数据库慢SQL",
                        Title = $"慢SQL[{method}] {elapsedMs}ms",
                        Content = sqlText,
                        Param = paramText,
                        OtherInfo = executableSql,
                        Timer = (int)elapsedMs,
                        Level = elapsedMs >= DiyCommon.SlowSqlThresholdMs * 5 ? 3 : 2,
                        Remark = method
                    });
                };

                Console.WriteLine($"Microi：【成功】注入【Dos.ORM数据库引擎】成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】注入【Dos.ORM数据库引擎】失败：{ex.Message}");
                throw;
            }
        }
    }
}
