using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Linq;
using Dos.ORM;


namespace Microi.net
{
    /// <summary>
    /// Dos.ORM SQL执行器适配器
    /// 将 Dos.ORM.Section 适配为 ISqlExecutor
    /// </summary>
    public class DosORMExecutorAdapter : ISqlExecutor
    {
        private readonly dynamic _dosSection;
        private string _sql;
        private readonly List<KeyValuePair<string, object>> _parameterValues = new List<KeyValuePair<string, object>>();

        /// <summary>
        /// 构造函数
        /// </summary>
        /// <param name="dosSection">Dos.ORM原生Section对象（动态类型）</param>
        /// <param name="sql">原始SQL文本（用于慢SQL日志记录）</param>
        public DosORMExecutorAdapter(dynamic dosSection, string sql = null)
        {
            _dosSection = dosSection ?? throw new ArgumentNullException(nameof(dosSection));
            _sql = sql;
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
                if (_parameterValues != null && _parameterValues.Count > 0)
                {
                    try
                    {
                        var paramDict = new Dictionary<string, string>();
                        foreach (var p in _parameterValues)
                        {
                            paramDict[p.Key] = p.Value?.ToString() ?? "NULL";
                        }
                        paramText = System.Text.Json.JsonSerializer.Serialize(paramDict);

                        // 构建可直接执行的SQL（替换参数占位符）
                        executableSql = _sql ?? "";
                        foreach (var p in _parameterValues.OrderByDescending(x => x.Key.Length))
                        {
                            var val = p.Value;
                            string replacement;
                            if (val == null || val == DBNull.Value) replacement = "NULL";
                            else if (val is string || val is DateTime || val is Guid) replacement = $"'{val.ToString().Replace("'", "''")}'";
                            else replacement = val.ToString();
                            // 使用正则匹配 [?@:]paramName\b，只替换参数占位符（?Id/@Id/:Id），而不是列名等单独出现的同名字符串
                            executableSql = System.Text.RegularExpressions.Regex.Replace(
                                executableSql,
                                "[?@:]" + System.Text.RegularExpressions.Regex.Escape(p.Key.TrimStart('@', '?', ':')) + @"\b",
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
        /// 执行SQL，返回受影响的行数
        /// </summary>
        public int ExecuteNonQuery()
        {
            var sw = Stopwatch.StartNew();
            var result = _dosSection.ExecuteNonQuery();
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
            T result = _dosSection.ToFirst<T>();
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToFirst");
            return result;
        }
        public dynamic ToFirst()
        {
            var sw = Stopwatch.StartNew();
            dynamic result = _dosSection.ToFirst<dynamic>();
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToFirst");
            return result;
        }
        public dynamic First()
        {
            var sw = Stopwatch.StartNew();
            dynamic result = _dosSection.ToFirst<dynamic>();
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
            List<T> result = _dosSection.ToList<T>();
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToList");
            return result;
        }
        public dynamic[] ToArray()
        {
            var sw = Stopwatch.StartNew();
            dynamic[] result = ToList<dynamic>().ToArray();
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToArray");
            return result;
        }

        /// <summary>
        /// 返回标量值
        /// </summary>
        public T ToScalar<T>()
        {
            var sw = Stopwatch.StartNew();
            T result = _dosSection.ToScalar<T>();
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToScalar");
            return result;
        }

        /// <summary>
        /// 添加输入参数
        /// </summary>
        public ISqlExecutor AddInParameter(string name, object value)
        {
            // Dos.ORM 没有 (string, object) 重载，自动推断类型为 String
            _dosSection.AddInParameter(name, DbType.String, value);
            _parameterValues.Add(new KeyValuePair<string, object>(name, value));
            return this; // 链式调用
        }

        /// <summary>
        /// 添加输入参数（带类型）
        /// </summary>
        public ISqlExecutor AddInParameter(string name, object value, DbType dbType)
        {
            // Dos.ORM 要求参数顺序：name, dbType, value
            _dosSection.AddInParameter(name, dbType, value);
            _parameterValues.Add(new KeyValuePair<string, object>(name, value));
            return this;
        }

        /// <summary>
        /// 添加输入参数（带类型，另一种参数顺序）
        /// </summary>
        public ISqlExecutor AddInParameter(string name, DbType dbType, object value)
        {
            // 直接传递，参数顺序已经正确
            _dosSection.AddInParameter(name, dbType, value);
            _parameterValues.Add(new KeyValuePair<string, object>(name, value));
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
                    // 修正参数顺序：name, dbType, value
                    _dosSection.AddInParameter(param.ParameterName, param.DbType, param.Value);
                    _parameterValues.Add(new KeyValuePair<string, object>(param.ParameterName, param.Value));
                }
            }
            return this;
        }

        /// <summary>
        /// 返回DataTable
        /// </summary>
        public DataTable ToDataTable()
        {
            var sw = Stopwatch.StartNew();
            var result = _dosSection.ToDataTable();
            sw.Stop();
            LogSlowSql(sw.ElapsedMilliseconds, "ToDataTable");
            return result;
        }

        /// <summary>
        /// 添加参数（简化版本）
        /// </summary>
        public ISqlExecutor AddParameter(string name, object value)
        {
            // Dos.ORM 需要 DbType，默认使用 String
            _dosSection.AddInParameter(name, DbType.String, value);
            _parameterValues.Add(new KeyValuePair<string, object>(name, value));
            return this;
        }

        /// <summary>
        /// 批量添加参数（数组版本）
        /// </summary>
        public ISqlExecutor AddParameter(params DbParameter[] parameters)
        {
            if (parameters != null)
            {
                foreach (var param in parameters)
                {
                    // 修正参数顺序：name, dbType, value
                    _dosSection.AddInParameter(param.ParameterName, param.DbType, param.Value);
                    _parameterValues.Add(new KeyValuePair<string, object>(param.ParameterName, param.Value));
                }
            }
            return this;
        }
    }
}
