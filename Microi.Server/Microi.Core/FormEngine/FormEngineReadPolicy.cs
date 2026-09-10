using System;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 表配置决定原生业务查询的连接；调用者只能传已解析的 diy_table 元数据。
    /// 此策略不提供授权，也不改变显式事务中的隔离级别或未提交数据可见性。
    /// </summary>
    public static class FormEngineReadPolicy
    {
        /// <summary>配置值只可在真实 diy_table 写入中校验，业务记录同名字段不改变路由。</summary>
        public static void ValidateConfigurationWrite(string tableName, JObject form)
        {
            if (!string.Equals(tableName, "diy_table", StringComparison.OrdinalIgnoreCase) || form == null)
                return;
            var seen = false;
            foreach (var property in form.Properties())
                if (string.Equals(property.Name, "ReadPrimary", StringComparison.OrdinalIgnoreCase))
                {
                    if (seen) throw new InvalidOperationException("ReadPrimary 不能重复提供不同大小写的字段。");
                    seen = true;
                    ParseReadPrimary(property.Value);
                }
        }

        /// <summary>缺省/NULL 保持旧语义；只有整数 0/1 是有效配置，历史数值字符串可兼容。</summary>
        public static int? ParseReadPrimary(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null || value.Type == JTokenType.Undefined)
                return null;
            if ((value.Type == JTokenType.Integer || value.Type == JTokenType.String)
                && (value.ToString() == "0" || value.ToString() == "1"))
                return value.ToString() == "1" ? 1 : 0;
            throw new InvalidOperationException("diy_table.ReadPrimary 只允许 NULL、0 或 1。");
        }

        /// <summary>
        /// 一次决策供 Rows/Count/SUM/Tree/Export 共用。泛型仅避免策略依赖数据库驱动；
        /// 生产传入的 writer/reader 必须属于同一可信 DataBaseId，不能从请求参数构造。
        /// </summary>
        public static TSession SelectQuerySession<TSession>(object trustedTableMetadata,
            TSession writer, TSession reader, bool hasTransaction) where TSession : class
        {
            if (trustedTableMetadata == null)
                throw new InvalidOperationException("表单查询缺少可信表配置。");
            var table = trustedTableMetadata as JObject ?? JObject.FromObject(trustedTableMetadata);
            var primary = ParseReadPrimary(table.GetValue("ReadPrimary", StringComparison.OrdinalIgnoreCase));
            // 显式事务始终由原生执行分支使用，不能悄悄跳出事务进行自动提交读。
            if (hasTransaction) return reader;
            var selected = primary == 1 ? writer : reader;
            if (selected == null)
                throw new InvalidOperationException(primary == 1
                    ? "ReadPrimary 已启用，但目标数据库主库连接不可用。"
                    : "目标数据库只读连接不可用。");
            return selected;
        }
    }
}
