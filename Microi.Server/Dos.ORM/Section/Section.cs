#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) iTdos
* CLR 版本: 4.0.30319.18408
* 创 建 人：steven hu
* 电子邮箱：
* 官方网站：www.iTdos.com
* 创建日期：2010/2/10
* 文件描述：
******************************************************
* 修 改 人：iTdos
* 修改日期：
* 备注描述：
*******************************************************/
#endregion

using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Text;
using System.Data.Common;
using Dos.ORM;
using Dos.ORM.Common;
using System.Data;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using System.Reflection.Emit;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using System.Threading;

namespace Dos.ORM
{

    /// <summary>
    /// Section
    /// </summary>
    public abstract class Section
    {

        protected DbSession dbSession;
        protected DbCommand cmd;
        protected DbTransaction tran = null;

        /// <summary>
        /// 慢SQL阈值（毫秒），0 = 不启用
        /// </summary>
        public static long SlowSqlThresholdMs { get; set; } = 5000;

        /// <summary>
        /// 慢SQL回调：(DbCommand, 耗时ms, 方法名)
        /// </summary>
        public static Action<DbCommand, long, string> OnSlowSql;

        private sealed class SensitiveParameterNames
        {
            internal readonly HashSet<string> Names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        private static readonly ConditionalWeakTable<DbCommand, SensitiveParameterNames> SensitiveParameters
            = new ConditionalWeakTable<DbCommand, SensitiveParameterNames>();

        /// <summary>
        /// 标记当前命令的敏感参数。日志、慢 SQL 与诊断输出必须调用
        /// <see cref="IsSensitiveParameter"/> 后再读取参数值。
        /// </summary>
        protected void MarkSensitiveParameter(string parameterName)
        {
            if (cmd == null || string.IsNullOrWhiteSpace(parameterName)) return;
            var names = SensitiveParameters.GetOrCreateValue(cmd);
            lock (names.Names)
            {
                names.Names.Add(NormalizeParameterName(parameterName));
            }
        }

        /// <summary>
        /// 判断命令参数是否已被调用方标记为敏感信息。
        /// </summary>
        public static bool IsSensitiveParameter(DbCommand command, string parameterName)
        {
            if (command == null || string.IsNullOrWhiteSpace(parameterName)) return false;
            if (SensitiveParameters.TryGetValue(command, out var names))
            {
                lock (names.Names)
                {
                    if (names.Names.Contains(NormalizeParameterName(parameterName))) return true;
                }
            }

            // FormEngine 会按字段名生成参数，凭据字段不一定能逐层显式调用
            // AddSensitiveInParameter。这里提供最后一道日志脱敏保护。
            var normalized = NormalizeParameterName(parameterName).Replace("_", string.Empty).ToLowerInvariant();
            return normalized.Contains("password") || normalized.Contains("pwd")
                   || normalized.Contains("secret") || normalized.Contains("token")
                   || normalized.Contains("apikey") || normalized.Contains("authorization")
                   || normalized.Contains("dbconn") || normalized.Contains("connectionstring");
        }

        private static string NormalizeParameterName(string parameterName)
        {
            return (parameterName ?? string.Empty).Trim().TrimStart('@', '?', ':');
        }

        [ThreadStatic] private static bool _isTiming;
        private T ExecuteWithTiming<T>(Func<T> action, string method)
        {
            if (_isTiming || OnSlowSql == null || SlowSqlThresholdMs <= 0)
                return action();
            _isTiming = true;
            try
            {
                var sw = Stopwatch.StartNew();
                var result = action();
                sw.Stop();
                if (sw.ElapsedMilliseconds >= SlowSqlThresholdMs)
                {
                    try { OnSlowSql(cmd, sw.ElapsedMilliseconds, method); } catch { }
                }
                return result;
            }
            finally { _isTiming = false; }
        }

        public Section(DbSession dbSession)
        {
            Check.Require(dbSession, "dbSession", Check.NotNullOrEmpty);
            this.dbSession = dbSession;
        }

        public Section SetCommandTimeout(int seconds)
        {
            if (cmd != null && seconds > 0)
            {
                cmd.CommandTimeout = seconds;
            }
            return this;
        }

        #region 执行

        /// <summary>
        /// 返回单个值
        /// </summary>
        /// <returns></returns>
        public virtual object ToScalar()
        {
            return ExecuteWithTiming(() =>
                tran == null ? this.dbSession.ExecuteScalar(cmd) : this.dbSession.ExecuteScalar(cmd, tran),
                "ToScalar");
        }


        /// <summary>
        /// 返回单个值
        /// </summary>
        /// <returns></returns>
        public TResult ToScalar<TResult>()
        {
            return DataUtils.ConvertValue<TResult>(ToScalar());
        }

        /// <summary>
        /// 返回int值
        /// </summary>
        public int ToInt()
        {
            var val = ToScalar();
            if (val == null || val == DBNull.Value) return 0;
            return Convert.ToInt32(val);
        }

        /// <summary>
        /// 返回long值
        /// </summary>
        public long ToLong()
        {
            var val = ToScalar();
            if (val == null || val == DBNull.Value) return 0;
            return Convert.ToInt64(val);
        }

        /// <summary>
        /// 返回decimal值
        /// </summary>
        public decimal ToDecimal()
        {
            var val = ToScalar();
            if (val == null || val == DBNull.Value) return 0;
            return Convert.ToDecimal(val);
        }

        /// <summary>
        /// 返回string值
        /// </summary>
        public string ToStringValue()
        {
            var val = ToScalar();
            if (val == null || val == DBNull.Value) return null;
            return Convert.ToString(val);
        }

        /// <summary>
        /// 判断是否存在数据
        /// </summary>
        public bool Exists()
        {
            var val = ToScalar();
            return val != null && val != DBNull.Value;
        }

        /// <summary>
        /// 返回第一个实体，同ToFirst()。无数据返回Null。
        /// </summary>
        /// <returns></returns>
        public TEntity First<TEntity>()
        {
            return ToFirst<TEntity>();
        }
        /// <summary>
        /// 返回单个实体
        /// </summary>
        /// <typeparam name="TEntity"></typeparam>
        /// <returns></returns>
        public TEntity ToFirst<TEntity>()
        {
            return ExecuteWithTiming(() =>
            {
                TEntity t = default(TEntity);
                using (IDataReader reader = ToDataReaderInternal())
                {
                    var result = EntityUtils.ReaderToEnumerable<TEntity>(reader).ToArray();
                    if (result.Any())
                    {
                        t = result.First();
                    }
                }
                return t;
            }, "ToFirst");
        }

        /// <summary>
        /// 返回单个实体
        /// </summary>
        /// <typeparam name="TEntity"></typeparam>
        /// <returns></returns>
        public TEntity ToFirstDefault<TEntity>()
            where TEntity : Entity
        {
            TEntity t = ToFirst<TEntity>();

            if (t == null)
                t = DataUtils.Create<TEntity>();

            return t;
        }

        public dynamic[] ToArray()
        {
            return ExecuteWithTiming(() => ToListInternal<dynamic>().ToArray(), "ToArray");
        }


        /// <summary>
        /// 返回实体列表
        /// </summary>
        /// <typeparam name="TEntity"></typeparam>
        /// <returns></returns>
        public List<TEntity> ToList<TEntity>()
        {
            return ExecuteWithTiming(() => ToListInternal<TEntity>(), "ToList");
        }

        private List<TEntity> ToListInternal<TEntity>()
        {
            using (IDataReader reader = ToDataReaderInternal())
            {
                return EntityUtils.ReaderToEnumerable<TEntity>(reader).ToList();
            }
        }
        /// <summary>
        /// 返回懒加载数据
        /// </summary>
        /// <typeparam name="TEntity"></typeparam>
        /// <returns></returns>
        public IEnumerable<TEntity> ToEnumerable<TEntity>()
        {
            //IEnumerable<TEntity> result;
            using (IDataReader reader = ToDataReaderInternal())
            {
                var info = new EntityUtils.CacheInfo()
                {
                    Deserializer = EntityUtils.GetDeserializer(typeof(TEntity), reader, 0, -1, false)
                };
                while (reader.Read())
                {
                    dynamic next = info.Deserializer(reader);
                    yield return (TEntity)next;
                }
            }
        }

        /// <summary>
        /// 返回DataReader
        /// </summary>
        /// <returns></returns>
        public virtual IDataReader ToDataReader()
        {
            return ToDataReaderInternal();
        }

        protected IDataReader ToDataReaderInternal()
        {
            return (tran == null ? this.dbSession.ExecuteReader(cmd) : this.dbSession.ExecuteReader(cmd, tran));
        }

        /// <summary>
        /// 返回DataSet
        /// </summary>
        /// <returns></returns>
        public virtual DataSet ToDataSet()
        {
            return ExecuteWithTiming(() =>
                tran == null ? this.dbSession.ExecuteDataSet(cmd) : this.dbSession.ExecuteDataSet(cmd, tran),
                "ToDataSet");
        }


        /// <summary>
        /// 返回DataTable
        /// </summary>
        /// <returns></returns>
        public DataTable ToDataTable()
        {
            return ExecuteWithTiming(() => this.ToDataSet().Tables[0], "ToDataTable");
        }

        /// <summary>
        /// 执行ExecuteNonQuery
        /// </summary>
        /// <returns></returns>
        public virtual int ExecuteNonQuery()
        {
            return ExecuteWithTiming(() =>
                tran == null ? this.dbSession.ExecuteNonQuery(cmd) : this.dbSession.ExecuteNonQuery(cmd, tran),
                "ExecuteNonQuery");
        }


        #endregion

        #region 异步执行

        private async Task<T> ExecuteWithTimingAsync<T>(Func<Task<T>> action, string method)
        {
            if (_isTiming || OnSlowSql == null || SlowSqlThresholdMs <= 0)
                return await action().ConfigureAwait(false);
            _isTiming = true;
            try
            {
                var sw = Stopwatch.StartNew();
                var result = await action().ConfigureAwait(false);
                sw.Stop();
                if (sw.ElapsedMilliseconds >= SlowSqlThresholdMs)
                {
                    try { OnSlowSql(cmd, sw.ElapsedMilliseconds, method); } catch { }
                }
                return result;
            }
            finally { _isTiming = false; }
        }

        protected async Task<DbDataReader> ToDataReaderInternalAsync()
        {
            return tran == null
                ? await this.dbSession.ExecuteReaderAsync(cmd).ConfigureAwait(false)
                : await this.dbSession.ExecuteReaderAsync(cmd, tran).ConfigureAwait(false);
        }

        /// <summary>
        /// 异步返回单个值
        /// </summary>
        public virtual Task<object> ToScalarAsync()
        {
            return ExecuteWithTimingAsync(async () =>
                tran == null
                    ? await this.dbSession.ExecuteScalarAsync(cmd).ConfigureAwait(false)
                    : await this.dbSession.ExecuteScalarAsync(cmd, tran).ConfigureAwait(false),
                "ToScalar");
        }

        /// <summary>
        /// 异步返回单个值（泛型）
        /// </summary>
        public async Task<TResult> ToScalarAsync<TResult>()
        {
            return DataUtils.ConvertValue<TResult>(await ToScalarAsync().ConfigureAwait(false));
        }

        /// <summary>
        /// 异步返回int值
        /// </summary>
        public async Task<int> ToIntAsync()
        {
            var val = await ToScalarAsync().ConfigureAwait(false);
            if (val == null || val == DBNull.Value) return 0;
            return Convert.ToInt32(val);
        }

        /// <summary>
        /// 异步返回long值
        /// </summary>
        public async Task<long> ToLongAsync()
        {
            var val = await ToScalarAsync().ConfigureAwait(false);
            if (val == null || val == DBNull.Value) return 0;
            return Convert.ToInt64(val);
        }

        /// <summary>
        /// 异步返回decimal值
        /// </summary>
        public async Task<decimal> ToDecimalAsync()
        {
            var val = await ToScalarAsync().ConfigureAwait(false);
            if (val == null || val == DBNull.Value) return 0;
            return Convert.ToDecimal(val);
        }

        /// <summary>
        /// 异步返回string值
        /// </summary>
        public async Task<string> ToStringValueAsync()
        {
            var val = await ToScalarAsync().ConfigureAwait(false);
            if (val == null || val == DBNull.Value) return null;
            return Convert.ToString(val);
        }

        /// <summary>
        /// 异步判断是否存在数据
        /// </summary>
        public async Task<bool> ExistsAsync()
        {
            var val = await ToScalarAsync().ConfigureAwait(false);
            return val != null && val != DBNull.Value;
        }

        /// <summary>
        /// 异步返回第一个实体，同ToFirstAsync()。无数据返回Null。
        /// </summary>
        public Task<TEntity> FirstAsync<TEntity>()
        {
            return ToFirstAsync<TEntity>();
        }

        /// <summary>
        /// 异步返回单个实体
        /// </summary>
        public Task<TEntity> ToFirstAsync<TEntity>()
        {
            return ExecuteWithTimingAsync(async () =>
            {
                using (var reader = await ToDataReaderInternalAsync().ConfigureAwait(false))
                {
                    var list = await EntityUtils.ReaderToListAsync<TEntity>(reader).ConfigureAwait(false);
                    return list.Count > 0 ? list[0] : default;
                }
            }, "ToFirst");
        }

        /// <summary>
        /// 异步返回dynamic数组
        /// </summary>
        public Task<dynamic[]> ToArrayAsync()
        {
            return ExecuteWithTimingAsync(async () =>
            {
                var list = await ToListInternalAsync<dynamic>().ConfigureAwait(false);
                return list.ToArray();
            }, "ToArray");
        }

        /// <summary>
        /// 异步返回实体列表
        /// </summary>
        public Task<List<TEntity>> ToListAsync<TEntity>()
        {
            return ExecuteWithTimingAsync(() => ToListInternalAsync<TEntity>(), "ToList");
        }

        private async Task<List<TEntity>> ToListInternalAsync<TEntity>()
        {
            using (var reader = await ToDataReaderInternalAsync().ConfigureAwait(false))
            {
                return await EntityUtils.ReaderToListAsync<TEntity>(reader).ConfigureAwait(false);
            }
        }

        /// <summary>
        /// 异步执行 ExecuteNonQuery
        /// </summary>
        public virtual Task<int> ExecuteNonQueryAsync()
        {
            return ExecuteWithTimingAsync(async () =>
                tran == null
                    ? await this.dbSession.ExecuteNonQueryAsync(cmd).ConfigureAwait(false)
                    : await this.dbSession.ExecuteNonQueryAsync(cmd, tran).ConfigureAwait(false),
                "ExecuteNonQuery");
        }

        #endregion

    }
}

