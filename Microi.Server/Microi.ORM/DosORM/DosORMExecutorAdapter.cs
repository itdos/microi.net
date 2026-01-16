using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
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

        /// <summary>
        /// 构造函数
        /// </summary>
        /// <param name="dosSection">Dos.ORM原生Section对象（动态类型）</param>
        public DosORMExecutorAdapter(dynamic dosSection)
        {
            _dosSection = dosSection ?? throw new ArgumentNullException(nameof(dosSection));
        }

        /// <summary>
        /// 执行SQL，返回受影响的行数
        /// </summary>
        public int ExecuteNonQuery()
        {
            return _dosSection.ExecuteNonQuery();
        }

        /// <summary>
        /// 返回第一行数据
        /// </summary>
        public T ToFirst<T>()
        {
            return _dosSection.ToFirst<T>();
        }
        public dynamic ToFirst()
        {
            return _dosSection.ToFirst<dynamic>();
        }
        public dynamic First()
        {
            return _dosSection.ToFirst<dynamic>();
        }

        /// <summary>
        /// 返回所有数据
        /// </summary>
        public List<T> ToList<T>()
        {
            return _dosSection.ToList<T>();
        }
        public dynamic[] ToArray()
        {
            return ToList<dynamic>().ToArray();
        }

        /// <summary>
        /// 返回标量值
        /// </summary>
        public T ToScalar<T>()
        {
            return _dosSection.ToScalar<T>();
        }

        /// <summary>
        /// 添加输入参数
        /// </summary>
        public ISqlExecutor AddInParameter(string name, object value)
        {
            // Dos.ORM 没有 (string, object) 重载，自动推断类型为 String
            _dosSection.AddInParameter(name, DbType.String, value);
            return this; // 链式调用
        }

        /// <summary>
        /// 添加输入参数（带类型）
        /// </summary>
        public ISqlExecutor AddInParameter(string name, object value, DbType dbType)
        {
            // Dos.ORM 要求参数顺序：name, dbType, value
            _dosSection.AddInParameter(name, dbType, value);
            return this;
        }

        /// <summary>
        /// 添加输入参数（带类型，另一种参数顺序）
        /// </summary>
        public ISqlExecutor AddInParameter(string name, DbType dbType, object value)
        {
            // 直接传递，参数顺序已经正确
            _dosSection.AddInParameter(name, dbType, value);
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
                }
            }
            return this;
        }

        /// <summary>
        /// 返回DataTable
        /// </summary>
        public DataTable ToDataTable()
        {
            return _dosSection.ToDataTable();
        }

        /// <summary>
        /// 添加参数（简化版本）
        /// </summary>
        public ISqlExecutor AddParameter(string name, object value)
        {
            // Dos.ORM 需要 DbType，默认使用 String
            _dosSection.AddInParameter(name, DbType.String, value);
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
                }
            }
            return this;
        }
    }
}
