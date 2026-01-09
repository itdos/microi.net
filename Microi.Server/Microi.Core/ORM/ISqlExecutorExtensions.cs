using System;
using System.Collections.Generic;

namespace Microi.net
{
    /// <summary>
    /// ISqlExecutor 扩展方法
    /// 提供Dos.ORM API兼容性
    /// </summary>
    public static class ISqlExecutorExtensions
    {
        /// <summary>
        /// 查询第一条记录（兼容Dos.ORM API的.First()方法）
        /// </summary>
        public static T First<T>(this ISqlExecutor executor)
        {
            return executor.ToFirst<T>();
        }

        /// <summary>
        /// 查询列表（兼容Dos.ORM API的.List()方法）
        /// </summary>
        public static List<T> List<T>(this ISqlExecutor executor)
        {
            return executor.ToList<T>();
        }
    }
}
