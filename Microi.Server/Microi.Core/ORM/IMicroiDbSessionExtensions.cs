using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// IMicroiDbSession 扩展方法
    /// 提供对Dos.ORM原生API的兼容支持
    /// </summary>
    public static class IMicroiDbSessionExtensions
    {
        /// <summary>
        /// 从表查询（兼容Dos.ORM API）
        /// </summary>
        public static FromSection<T> From<T>(this IMicroiDbSession session) where T : Entity, new()
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.From<T>();
        }

        /// <summary>
        /// 插入实体（兼容Dos.ORM API）
        /// </summary>
        public static int Insert<T>(this IMicroiDbSession session, params T[] entities) where T : Entity
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Insert(entities);
        }

        /// <summary>
        /// 插入实体集合（兼容Dos.ORM API）
        /// </summary>
        public static int Insert<T>(this IMicroiDbSession session, IEnumerable<T> entities) where T : Entity
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Insert(entities);
        }

        /// <summary>
        /// 更新实体（兼容Dos.ORM API）
        /// </summary>
        public static int Update<T>(this IMicroiDbSession session, params T[] entities) where T : Entity
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Update(entities);
        }

        /// <summary>
        /// 更新实体集合（兼容Dos.ORM API）
        /// </summary>
        public static int Update<T>(this IMicroiDbSession session, IEnumerable<T> entities) where T : Entity
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Update(entities);
        }

        /// <summary>
        /// 更新实体并根据条件过滤（兼容Dos.ORM API）
        /// </summary>
        public static int Update<T>(this IMicroiDbSession session, T entity, Expression<Func<T, bool>> where) where T : Entity
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Update(entity, where);
        }

        /// <summary>
        /// 删除实体（兼容Dos.ORM API）
        /// </summary>
        public static int Delete<T>(this IMicroiDbSession session, params T[] entities) where T : Entity
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Delete(entities);
        }

        /// <summary>
        /// 删除实体集合（兼容Dos.ORM API）
        /// </summary>
        public static int Delete<T>(this IMicroiDbSession session, IEnumerable<T> entities) where T : Entity
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Delete(entities);
        }

        /// <summary>
        /// 根据主键删除（兼容Dos.ORM API）
        /// </summary>
        public static int Delete<T>(this IMicroiDbSession session, params string[] pkValues) where T : Entity
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Delete<T>(pkValues);
        }

        /// <summary>
        /// 根据Lambda表达式删除（兼容Dos.ORM API）
        /// </summary>
        public static int Delete<T>(this IMicroiDbSession session, Expression<Func<T, bool>> lambdaWhere) where T : Entity
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Delete(lambdaWhere);
        }

        /// <summary>
        /// 获取底层Dos.ORM Database对象（用于访问DbProviderFactory等底层API）
        /// </summary>
        public static Dos.ORM.Database GetDb(this IMicroiDbSession session)
        {
            var dosSession = ORMAdapterHelper.GetDosSession(session);
            return dosSession.Db;
        }
    }

    /// <summary>
    /// IMicroiDbTransaction 扩展方法
    /// 提供对Dos.ORM原生API的兼容支持
    /// </summary>
    public static class IMicroiDbTransactionExtensions
    {
        /// <summary>
        /// 从表查询（兼容Dos.ORM API）
        /// </summary>
        public static FromSection<T> From<T>(this IMicroiDbTransaction trans) where T : Entity, new()
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.From<T>();
        }

        /// <summary>
        /// 插入实体（兼容Dos.ORM API）
        /// </summary>
        public static int Insert<T>(this IMicroiDbTransaction trans, params T[] entities) where T : Entity
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.Insert(entities);
        }

        /// <summary>
        /// 插入实体集合（兼容Dos.ORM API）
        /// </summary>
        public static int Insert<T>(this IMicroiDbTransaction trans, IEnumerable<T> entities) where T : Entity
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.Insert(entities);
        }

        /// <summary>
        /// 更新实体（兼容Dos.ORM API）
        /// </summary>
        public static int Update<T>(this IMicroiDbTransaction trans, params T[] entities) where T : Entity
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.Update(entities);
        }

        /// <summary>
        /// 更新实体集合（兼容Dos.ORM API）
        /// </summary>
        public static int Update<T>(this IMicroiDbTransaction trans, IEnumerable<T> entities) where T : Entity
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.Update(entities);
        }

        /// <summary>
        /// 更新实体并根据条件过滤（兼容Dos.ORM API）
        /// </summary>
        public static int Update<T>(this IMicroiDbTransaction trans, T entity, Expression<Func<T, bool>> where) where T : Entity
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.Update(entity, where);
        }

        /// <summary>
        /// 删除实体（兼容Dos.ORM API）
        /// </summary>
        public static int Delete<T>(this IMicroiDbTransaction trans, params T[] entities) where T : Entity
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.Delete(entities);
        }

        /// <summary>
        /// 删除实体集合（兼容Dos.ORM API）
        /// </summary>
        public static int Delete<T>(this IMicroiDbTransaction trans, IEnumerable<T> entities) where T : Entity
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.Delete(entities);
        }

        /// <summary>
        /// 根据主键删除（兼容Dos.ORM API）
        /// </summary>
        public static int Delete<T>(this IMicroiDbTransaction trans, params string[] pkValues) where T : Entity
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.Delete<T>(pkValues);
        }

        /// <summary>
        /// 根据Lambda表达式删除（兼容Dos.ORM API）
        /// </summary>
        public static int Delete<T>(this IMicroiDbTransaction trans, Expression<Func<T, bool>> lambdaWhere) where T : Entity
        {
            var dosTrans = ORMAdapterHelper.GetDosTrans(trans);
            return dosTrans.Delete(lambdaWhere);
        }
    }
}
