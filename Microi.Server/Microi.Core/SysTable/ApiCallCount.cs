using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;

namespace Microi.net
{
    /// <summary>
    /// 接口引擎调用次数统计（存储于 MongoDB）
    /// </summary>
    public class ApiCallCount
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; }
        public string ApiEngineKey { get; set; }
        public string Name { get; set; }
        public string OsClient { get; set; }
        public long CallCount { get; set; }
        public DateTime CreateTime { get; set; }
        public DateTime LastCallTime { get; set; }
    }
}
