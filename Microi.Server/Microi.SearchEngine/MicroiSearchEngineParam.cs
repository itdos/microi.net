using System;
using System.Collections.Generic;
using System.Text;

namespace Microi.net
{
    public class MicroiSearchEngineParam
    {
        //表id
        public string TableId { get; set; }
        // 表名称
        public string TableName { get; set; }
        // 查询条件
        public QueryParam Query { get; set; }
        //分页
        public int pageIndex { get; set; }
        // 每页数量
        public int pageSize { get; set; }
        // 排序
        public List<MicroiSearchEngineSortModel> Sorts { get; set; }

        // 分页类型，1=from、size类型，2= SearchAfter类型
        public int PageType { get; set; }
        public object[] SearchAfter { get; set; }
        public string Id { get; set; }
    }

    public class QueryParam
    {
        // and
        public List<QueryParamDetail> Must { get; set; }
        // or
        public List<QueryParamDetail> Should { get; set; }
    }

    public class QueryParamDetail
    {
        // 字段名称
        public string Name { get; set; }
        // 字段值
        public string Value { get; set; }
    }
}
