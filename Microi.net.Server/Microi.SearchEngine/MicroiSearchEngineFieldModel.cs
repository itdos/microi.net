using System;
using System.Collections.Generic;
using System.Text;

namespace Microi.net
{
    public  class MicroiSearchEngineFieldModel
    {
        // 索引名称
        public string IndexName { get; set; }
        // 字段名称
        public string Name { get; set; }
        // 字段类型
        public string Type { get; set; }
        // 是否分词
        public bool Participle  { get; set; }
    }
}
