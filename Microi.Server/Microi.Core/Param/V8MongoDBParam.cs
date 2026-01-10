using System;
using System.Collections.Generic;

namespace Microi.net
{
    public class V8MongoDBParam
    {
        public string _Lang = DiyMessage.Lang;
        public string OsClient { get; set; }
        public string Id { get; set; }
        public string DbName { get; set; }
        public string TableName { get; set; }
        public Dictionary<string, object> _FormData { get; set; }
        public DateTime CreateTime { get; set; }
        public int? _PageSize { get; set; }
        public int? _PageIndex { get; set; }
        public int? _Top { get; set; }
        public object _Where { get; set; }

    }
}


