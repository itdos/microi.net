using System;
using System.Collections.Generic;
using System.Text;

namespace Microi.Cache
{
    public class CacheConnectionParam
    {
        public string InstanceName { get; set; }
        public string Host { get; set; }
        public string Pwd { get; set; }
        public int Port { get; set; } = 6379;
        public int DatabaseIndex { get; set; } = 0;
        // 缓存连接类型 1=单节点，2=哨兵
        public string CacheConnectionType { get; set; }
        //哨兵节点信息
        public string SentinelHost { get; set; }
        // 集群名称
        public string SentinelServiceName { get; set; }
        // 哨兵认证密码
        public string SentinelPwd { get; set; }

    }
}
