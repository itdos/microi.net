using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public class V8MongoDBParam
    {
        public string _Lang = DiyMessage.Lang;
        public string OsClient { get; set; }
        public string Id { get; set; }
        public string DbName { get; set; }
        public string TableName { get; set; }
        public JObject _FormData { get; set; } = new JObject();
        public DateTime CreateTime { get; set; }
        /// <summary>可选业务事实发生时间；分区重试写入保留原始时间，省略时使用服务器当前时间。</summary>
        public DateTime? OccurredAt { get; set; }
        public int? _PageSize { get; set; }
        public int? _PageIndex { get; set; }
        public int? _Top { get; set; }
        public object _Where { get; set; }
        public string _OrderBy { get; set; }
        public string _OrderByType { get; set; }

    }
}


