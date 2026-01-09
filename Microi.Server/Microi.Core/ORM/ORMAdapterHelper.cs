using System;
using Dos.ORM;


namespace Microi.net
{
    /// <summary>
    /// ORM适配器辅助工具类
    /// 用于在接口和具体实现之间进行转换
    /// </summary>
    public static class ORMAdapterHelper
    {
        /// <summary>
        /// 将 IMicroiDbSession 转换为 Dos.ORM.DbSession
        /// 使用反射避免直接引用适配器类
        /// </summary>
        public static DbSession GetDosSession(IMicroiDbSession session)
        {
            if (session == null)
                return null;

            // 通过反射获取 UnderlyingSession 属性
            var property = session.GetType().GetProperty("UnderlyingSession");
            if (property != null && property.PropertyType == typeof(DbSession))
            {
                return property.GetValue(session) as DbSession;
            }

            throw new InvalidOperationException($"无法将 {session.GetType().Name} 转换为 Dos.ORM.DbSession");
        }

        /// <summary>
        /// 将 IMicroiDbTransaction 转换为 Dos.ORM.DbTrans
        /// </summary>
        public static DbTrans GetDosTrans(IMicroiDbTransaction trans)
        {
            if (trans == null)
                return null;

            // 通过反射获取 UnderlyingTransaction 属性
            var underlyingTrans = trans.UnderlyingTransaction;
            if (underlyingTrans is DbTrans dbTrans)
            {
                return dbTrans;
            }

            throw new InvalidOperationException($"无法将 {trans.GetType().Name} 转换为 Dos.ORM.DbTrans");
        }

        /// <summary>
        /// 通用方法：获取会话或事务的底层对象（用于FromSql）
        /// </summary>
        public static dynamic GetUnderlyingObject(IMicroiDbTransaction trans, IMicroiDbSession session)
        {
            if (trans != null)
                return GetDosTrans(trans);
            
            if (session != null)
                return GetDosSession(session);

            throw new ArgumentNullException("trans和session不能同时为null");
        }
    }
}
