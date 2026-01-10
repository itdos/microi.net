using System;
using System.Linq;
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
        /// 【混合 ORM 方案】：
        /// 1. 如果是 Dos.ORM 适配器，直接返回底层 DbSession
        /// 2. 如果是 SqlSugar 适配器，从当前请求上下文获取 OsClient 的 DosOrmDbRead
        /// 3. 这样即使配置了 SqlSugar，旧代码的 From<T>() 等方法仍使用 Dos.ORM
        /// </summary>
        public static DbSession GetDosSession(IMicroiDbSession session)
        {
            if (session == null)
                return null;

            // 检查是否为 SqlSugar 适配器
            if (session.GetType().Name == "SqlSugarSessionAdapter")
            {
                // 【修复】优先从 session 对象自身获取 OsClient
                try
                {
                    var osClientProp = session.GetType().GetProperty("OsClient");
                    var osClientName = osClientProp?.GetValue(session) as string;

                    // 如果 session 没有 OsClient，尝试从 HTTP 上下文获取
                    if (string.IsNullOrWhiteSpace(osClientName))
                    {
                        var context = DiyHttpContext.Current;
                        if (context != null)
                        {
                            osClientName = GetOsClientFromContext(context);
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(osClientName))
                    {
                        var client = OsClientExtend.GetClient(osClientName);
                        if (client?.DosOrmDbRead != null)
                        {
                            return client.DosOrmDbRead;
                        }
                    }
                }
                catch
                {
                    // 如果无法获取上下文，抛出明确错误
                }

                throw new InvalidOperationException(
                    "当前使用的是 SqlSugar ORM，旧代码的 From<T>() 扩展方法需要 Dos.ORM 支持。\n" +
                    "请确保通过 OsClientExtend.GetClient(osClient).DbRead 获取 session，" +
                    "系统会自动使用 DosOrmDbRead 来执行 Dos.ORM 特有操作。");
            }

            // 通过反射获取 UnderlyingSession 属性（Dos.ORM 适配器）
            var property = session.GetType().GetProperty("UnderlyingSession");
            if (property != null && property.PropertyType == typeof(DbSession))
            {
                return property.GetValue(session) as DbSession;
            }

            throw new InvalidOperationException($"无法将 {session.GetType().Name} 转换为 Dos.ORM.DbSession");
        }

        /// <summary>
        /// 从 HTTP 上下文中获取 OsClient 名称
        /// </summary>
        private static string GetOsClientFromContext(Microsoft.AspNetCore.Http.HttpContext context)
        {
            try
            {
                var claims = context.User.Claims;
                var token = context.Request.Headers["authorization"].ToString();
                if (!string.IsNullOrWhiteSpace(token))
                {
                    claims = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler()
                        .ReadJwtToken(token.Replace("Bearer ", "")).Claims;
                }
                return claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 将 IMicroiDbTransaction 转换为 Dos.ORM.DbTrans
        /// 【混合 ORM 方案】：与 GetDosSession 逻辑相同
        /// </summary>
        public static DbTrans GetDosTrans(IMicroiDbTransaction trans)
        {
            if (trans == null)
                return null;

            // 检查是否为 SqlSugar 适配器
            if (trans.GetType().Name == "SqlSugarTransactionAdapter")
            {
                // 【修复】优先从 transaction 对象关联的 session 获取 OsClient
                try
                {
                    // 尝试获取 session 属性
                    var sessionProp = trans.GetType().GetProperty("Session");
                    var session = sessionProp?.GetValue(trans) as IMicroiDbSession;

                    string osClientName = null;
                    if (session != null)
                    {
                        var osClientProp = session.GetType().GetProperty("OsClient");
                        osClientName = osClientProp?.GetValue(session) as string;
                    }

                    // 如果 session 没有 OsClient，尝试从 HTTP 上下文获取
                    if (string.IsNullOrWhiteSpace(osClientName))
                    {
                        var context = DiyHttpContext.Current;
                        if (context != null)
                        {
                            osClientName = GetOsClientFromContext(context);
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(osClientName))
                    {
                        var client = OsClientExtend.GetClient(osClientName);
                        if (client?.DosOrmDb != null)
                        {
                            // 需要在事务内，所以创建新事务
                            return client.DosOrmDb.BeginTransaction();
                        }
                    }
                }
                catch
                {
                    // 如果无法获取上下文，抛出明确错误
                }

                throw new InvalidOperationException(
                    "当前使用的是 SqlSugar ORM，旧代码的事务扩展方法需要 Dos.ORM 支持。\n" +
                    "请确保通过 OsClientExtend.GetClient(osClient).Db 获取 session 并开启事务。");
            }

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
