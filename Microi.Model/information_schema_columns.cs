using System;
namespace Microi.net
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
    }
}
