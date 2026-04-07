using System.Collections.Generic;

namespace Dos.ORM
{
    public class DbInfo
    {
        public char L { get; set; }
        public char R { get; set; }
        public char P { get; set; }
        public DatabaseType DbType { get; set; }
    }

    public class DbServiceParam
    {
        public string FieldName { get; set; }
        public string NewFieldName { get; set; }
        public string FieldType { get; set; }
        public string OldFieldType { get; set; }
        public bool FieldNotNull { get; set; }
        public string FieldLabel { get; set; }

        public string DataBaseId { get; set; }
        public string OsClient { get; set; }
        public string TableName { get; set; }
        public string OldTableName { get; set; }

        /// <summary>
        /// 字段Model（上层为 DiyField 类型）
        /// </summary>
        public dynamic Field { get; set; }

        /// <summary>
        /// 字段列表（上层为 List&lt;DiyField&gt; 类型）
        /// </summary>
        public dynamic FieldList { get; set; }

        public DbInfo DbInfo { get; set; }

        /// <summary>
        /// OsClient配置（上层为 OsClientSecret 类型）
        /// </summary>
        public dynamic OsClientModel { get; set; }

        public DbSession DbSession { get; set; }
        public string _Lang = DDLConfig.DefaultLang;

        /// <summary>
        /// 索引名称
        /// </summary>
        public string IndexName { get; set; }
        /// <summary>
        /// 索引字段列表（逗号分隔）
        /// </summary>
        public string IndexColumns { get; set; }
        /// <summary>
        /// 是否唯一索引
        /// </summary>
        public bool IndexUnique { get; set; }
    }
}
