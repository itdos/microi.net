using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Linq;
using SqlSugar;

namespace Microi.net
{
    /// <summary>
    /// SqlSugar 原始 SQL 执行器适配器
    /// 用于执行 FromSql 创建的原始 SQL 语句
    /// </summary>
    public class SqlSugarRawSqlExecutorAdapter : ISqlExecutor
    {
        private readonly SqlSugarClient _client;
        private string _sql;
        private readonly List<SugarParameter> _parameters = new List<SugarParameter>();

        public SqlSugarRawSqlExecutorAdapter(SqlSugarClient client, string sql)
        {
            _client = client ?? throw new ArgumentNullException(nameof(client));
            _sql = sql ?? throw new ArgumentNullException(nameof(sql));
        }

        /// <summary>
        /// 记录慢SQL日志
        /// </summary>
        private void LogSlowSql(long elapsedMs, string method)
        {
            if (elapsedMs >= DiyCommon.SlowSqlThresholdMs)
            {
                var sqlText = _sql ?? "(unknown)";
                if (sqlText.Length > 2000) sqlText = sqlText.Substring(0, 2000) + "...";

                // 序列化参数值
                string paramText = null;
                string executableSql = null;
                if (_parameters != null && _parameters.Count > 0)
                {
                    try
                    {
                        var paramDict = new Dictionary<string, string>();
                        foreach (var p in _parameters)
                        {
                            paramDict[p.ParameterName] = p.Value?.ToString() ?? "NULL";
                        }
                        paramText = System.Text.Json.JsonSerializer.Serialize(paramDict);

                        // 构建可直接执行的SQL（替换参数占位符）
                        executableSql = _sql ?? "";
                        // 按参数名长度降序替换，避免 @p10 被 @p1 部分替换
                        foreach (var p in _parameters.OrderByDescending(x => x.ParameterName.Length))
                        {
                            var val = p.Value;
                            string replacement;
                            if (val == null || val == DBNull.Value) replacement = "NULL";
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
            }
        }

        /// <summary>
        /// 执行 SQL，返回受影响的行数
        /// </summary>
        public int ExecuteNonQuery()
        {
            var sw = Stopwatch.StartNew();
            var result = _client.Ado.ExecuteCommand(_sql, _parameters);
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ExecuteNonQuery");
            return result;
        }

        /// <summary>
        /// 返回第一行数据
        /// </summary>
        public T ToFirst<T>()
        {
            var sw = Stopwatch.StartNew();
            var result = _client.Ado.SqlQuerySingle<T>(_sql, _parameters);
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToFirst");
            return result;
        }
        public dynamic ToFirst()
        {
            var sw = Stopwatch.StartNew();
            var result = _client.Ado.SqlQuerySingle<dynamic>(_sql, _parameters);
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToFirst");
            return result;
        }
        public dynamic First()
        {
            var sw = Stopwatch.StartNew();
            var result = _client.Ado.SqlQuerySingle<dynamic>(_sql, _parameters);
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "First");
            return result;
        }

        /// <summary>
        /// 返回所有数据
        /// </summary>
        public List<T> ToList<T>()
        {
            var sw = Stopwatch.StartNew();
            var result = _client.Ado.SqlQuery<T>(_sql, _parameters);
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToList");
            return result;
        }
        
        /// <summary>
        /// 返回数组数据
        /// </summary>
        public dynamic[] ToArray()
        {
            return ToList<dynamic>().ToArray();
        }

        /// <summary>
        /// 返回标量值
        /// </summary>
        public T ToScalar<T>()
        {
            var sw = Stopwatch.StartNew();
            var result = _client.Ado.GetScalar(_sql, _parameters);
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToScalar");
            if (result == null || result == DBNull.Value)
                return default(T);

            return (T)Convert.ChangeType(result, typeof(T));
        }

        /// <summary>
        /// 添加输入参数
        /// </summary>
        public ISqlExecutor AddInParameter(string name, object value)
        {
            _parameters.Add(new SugarParameter(name, value));
            return this;
        }

        public ISqlExecutor AddInParameter(string name, object value, System.Data.DbType dbType)
        {
            _parameters.Add(new SugarParameter(name, value) { DbType = dbType });
            return this;
        }

        public ISqlExecutor AddInParameter(string name, System.Data.DbType dbType, object value)
        {
            _parameters.Add(new SugarParameter(name, value) { DbType = dbType });
            return this;
        }

        /// <summary>
        /// 批量添加参数
        /// </summary>
        public ISqlExecutor AddParameters(List<DbParameter> parameters)
        {
            if (parameters != null)
            {
                foreach (var param in parameters)
                {
                    _parameters.Add(new SugarParameter(param.ParameterName, param.Value)
                    {
                        DbType = param.DbType
                    });
                }
            }
            return this;
        }

        public ISqlExecutor AddParameter(string name, object value)
        {
            _parameters.Add(new SugarParameter(name, value));
            return this;
        }

        public ISqlExecutor AddParameter(params DbParameter[] parameters)
        {
            if (parameters != null)
            {
                foreach (var param in parameters)
                {
                    _parameters.Add(new SugarParameter(param.ParameterName, param.Value)
                    {
                        DbType = param.DbType
                    });
                }
            }
            return this;
        }

        /// <summary>
        /// 返回 DataTable
        /// </summary>
        public DataTable ToDataTable()
        {
            var sw = Stopwatch.StartNew();
            var result = _client.Ado.GetDataTable(_sql, _parameters);
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToDataTable");
            return result;
        }
    }
}
