using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;

namespace Microi.net
{
    /// <summary>
    /// SQL执行器抽象接口
    /// 负责执行SQL并返回结果
    /// </summary>
    public interface ISqlExecutor
    {
        /// <summary>
        /// 执行SQL，返回受影响的行数（用于INSERT、UPDATE、DELETE）
        /// </summary>
        /// <returns>受影响的行数</returns>
        int ExecuteNonQuery();

        /// <summary>
        /// 执行查询，返回第一行数据（泛型版本）
        /// </summary>
        /// <typeparam name="T">实体类型</typeparam>
        /// <returns>第一行数据，没有数据返回default(T)</returns>
        T ToFirst<T>();

        /// <summary>
        /// 执行查询，返回所有数据（泛型版本）
        /// </summary>
        /// <typeparam name="T">实体类型</typeparam>
        /// <returns>数据列表</returns>
        List<T> ToList<T>();

        /// <summary>
        /// 执行查询，返回第一行第一列的值（用于COUNT、SUM等聚合查询）
        /// </summary>
        /// <typeparam name="T">返回值类型</typeparam>
        /// <returns>标量值</returns>
        T ToScalar<T>();

        /// <summary>
        /// 添加输入参数（参数化查询，防止SQL注入）
        /// </summary>
        /// <param name="name">参数名（如：@UserId 或 :UserId）</param>
        /// <param name="value">参数值</param>
        /// <returns>链式调用，返回自身</returns>
        ISqlExecutor AddInParameter(string name, object value);

        /// <summary>
        /// 添加输入参数（带类型）
        /// </summary>
        /// <param name="name">参数名</param>
        /// <param name="value">参数值</param>
        /// <param name="dbType">数据库类型</param>
        /// <returns>链式调用，返回自身</returns>
        ISqlExecutor AddInParameter(string name, object value, DbType dbType);

        /// <summary>
        /// 添加输入参数（带类型，另一种参数顺序 - 兼容某些Dos.ORM API）
        /// </summary>
        /// <param name="name">参数名</param>
        /// <param name="dbType">数据库类型</param>
        /// <param name="value">参数值</param>
        /// <returns>链式调用，返回自身</returns>
        ISqlExecutor AddInParameter(string name, DbType dbType, object value);

        /// <summary>
        /// 批量添加参数
        /// </summary>
        /// <param name="parameters">参数列表</param>
        /// <returns>链式调用，返回自身</returns>
        ISqlExecutor AddParameters(List<DbParameter> parameters);

        /// <summary>
        /// 执行查询，返回DataTable
        /// </summary>
        /// <returns>查询结果DataTable</returns>
        DataTable ToDataTable();

        /// <summary>
        /// 添加参数（简化版本，自动推断类型）
        /// </summary>
        /// <param name="name">参数名</param>
        /// <param name="value">参数值</param>
        /// <returns>链式调用，返回自身</returns>
        ISqlExecutor AddParameter(string name, object value);

        /// <summary>
        /// 批量添加参数（数组版本）
        /// </summary>
        /// <param name="parameters">参数数组</param>
        /// <returns>链式调用，返回自身</returns>
        ISqlExecutor AddParameter(params DbParameter[] parameters);
    }
}
