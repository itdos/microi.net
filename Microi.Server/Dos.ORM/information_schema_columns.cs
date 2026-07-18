using System;
namespace Dos.ORM
{
    public class information_schema_columns
    {
        public string table_name { get; set; }
        public string column_name { get; set; }
        public string data_type { get; set; }
        public string column_comment { get; set; }
        public string column_key { get; set; }
        public string is_nullable { get; set; }
        public string column_type { get; set; }
        /// <summary>
        /// 字符列的最大长度；非字符列或数据库未提供时为 null。
        /// </summary>
        public long? character_maximum_length { get; set; }
    }
}
