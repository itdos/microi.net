using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

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
        public IMicroiDbSession Db { get; set; }
        /// <summary>
        /// 数据库【读】对象
        /// </summary>
        public IMicroiDbSession DbRead { get; set; }
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
        public IMicroiDbSession Db { get; set; }
        /// <summary>
        /// 数据库【读】对象
        /// </summary>
        public IMicroiDbSession DbRead { get; set; }

        /// <summary>
        /// 强制使用 Dos.ORM 的数据库【增、删、改】对象
        /// 用于旧代码兼容（From、Insert、Update、Delete 等扩展方法）
        /// </summary>
        public Dos.ORM.DbSession DosOrmDb { get; set; }
        /// <summary>
        /// 强制使用 Dos.ORM 的数据库【读】对象
        /// 用于旧代码兼容（From、Insert、Update、Delete 等扩展方法）
        /// </summary>
        public Dos.ORM.DbSession DosOrmDbRead { get; set; }

        public List<OsClientDataBase> DataBases { get; set; } //ConcurrentDictionary
    }
}