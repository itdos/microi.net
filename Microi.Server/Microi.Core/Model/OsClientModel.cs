using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

using Dos.ORM;

namespace Microi.net
{
    public class OsClientDataBase
    {
        public string Id { get; set; }
        public string DbName { get; set; }
        public string DbKey { get; set; }
        public string DbType { get; set; }
        public string DbVersion { get; set; }
        public string DbConn { get; set; }
        public string DbReadConn { get; set; }
        public string DbReadType { get; set; }
        public string Remark { get; set; }
        public string IsEnable { get; set; }
        /// <summary>
        /// 数据库【增、删、改】对象
        /// </summary>
        public DbSession Db { get; set; }
        /// <summary>
        /// 数据库【读】对象
        /// </summary>
        public DbSession DbRead { get; set; }
    }
    public class DiyLang
    {
        public string Key { get; set; }
        public string Code { get; set; }
        public string ZhCN { get; set; }
        public string En { get; set; }
        public string ZhTW { get; set; }
    }
    /// <summary>
    /// OsClientSecret对应sys_osclients表
    /// 后期要做修改，此类只保留几个数据库对象，再创建一个属性用于存储表信息，因为表字段会动态增加
    /// </summary>
    public partial class OsClientSecret
    {
        /// <summary>
        /// 包含了sys_osclients的所有字段
        /// </summary>
        public JObject OsClientModel { get; set; } = new JObject();
      
        public string OsClient { get; set; }

        /// <summary>
        /// 数据库【增、删、改】对象
        /// </summary>
        public DbSession Db { get; set; }
        /// <summary>
        /// 数据库【读】对象
        /// </summary>
        public DbSession DbRead { get; set; }

        public List<OsClientDataBase> DataBases { get; set; } //ConcurrentDictionary

        /// <summary>
        /// 当前进程是否已经完成扩展数据库列表初始化。
        /// DataBases 为空列表表示“已加载且没有扩展库”，不能与尚未加载混为一谈，
        /// 否则每次 V8 执行都会重复查询 microi_database 并回写 SaaS 配置缓存。
        /// 这是可丢失的进程内运行态，不写入 Redis 或数据库。
        /// </summary>
        [JsonIgnore]
        public bool DataBasesInitialized { get; set; }

        /// <summary>
        /// 本节点最近一次从共享业务数据库加载扩展数据库配置的时间。
        /// 短 TTL 允许多节点最终看到 UI/MCP 的配置修改；该值可随重启丢失。
        /// </summary>
        [JsonIgnore]
        public DateTime DataBasesLoadedAtUtc { get; set; }

        /// <summary>
        /// 本节点加载扩展数据库列表时观察到的共享 Redis 版本。
        /// microi_database 提交成功后递增版本，所有节点下次访问 V8.Dbs 时重载。
        /// </summary>
        [JsonIgnore]
        public long DataBasesVersion { get; set; }
    }
}
