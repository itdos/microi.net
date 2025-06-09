using System;
using System.Collections.Generic;
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
    /// </summary>
    public class OsClientSecret
    {
        public string CorsAllowOrigins { get; set; }

        #region SearchEngine
        public string SearchEngineHost { get; set; }
        
        public string SearchEnginePort { get; set; }
        #endregion
        #region MQ
        public string MQType { get; set; }
        public string MQHost { get; set; }
        public string MQPort { get; set; }
        public string MQListenerTime { get; set; }
        public string MQUserName { get; set; }
        public string MQPassword { get; set; }
        public string MQVitrualHost { get; set; }
        #endregion
        public string _Lang = DiyMessage.Lang;
        public string IndexCodeAuth { get; set; }
        public string IndexCodeApi { get; set; }
        public bool EnableSwagger { get; set; }
        public string OsClient { get; set; }
        public string ClientName { get; set; }
        public string DomainName { get; set; }

        /// <summary>
        /// 数据库【增、删、改】对象
        /// </summary>
        public DbSession Db { get; set; }
        /// <summary>
        /// 数据库【读】对象
        /// </summary>
        public DbSession DbRead { get; set; }
        public DbSession DbLog { get; set; }
        /// <summary>
        /// 不能包含中文。会以报文的形式返回到前端：Response Headers：diy-server-tag:ServerTag值
        /// </summary>
        public string ServerTag { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public string AuthServer { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string AuthServerV2 { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string AuthSecret { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string NoSqlType { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string RedisHost { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string RedisPwd { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string RedisPort { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string RedisDataBase { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string RedisTimeout { get; set; }
        /// <summary>
        /// 缓存连接类型 1=单节点，2=哨兵
        /// </summary>
        public string CacheConnectionType { get; set; }
        /// <summary>
        /// 哨兵节点信息
        /// </summary>
        public string SentinelHost { get; set; }
        /// <summary>
        /// 集群名称
        /// </summary>
        public string SentinelServiceName { get; set; }
        /// <summary>
        /// 哨兵认证密码
        /// </summary>
        public string SentinelPwd { get; set; }

        #region Database
        //BlockingCollection<T>, ConcurrentBag<T>, ConcurrentDictionary<TKey, TValue>, ConcurrentQueue<T> and ConcurrentStack<T>.
        /// <summary>
        /// 其它数据库连接。未做读写分离访问对象，若有需求请使用数据库中间件实现。
        /// Key：microi_database的Id值，Value：DbSession
        /// </summary>
        //public Dictionary<string, DbSession> DataBases { get; set; } //ConcurrentDictionary

        public List<OsClientDataBase> DataBases { get; set; } //ConcurrentDictionary

        public string DbConn { get; set; }
        public string DbType { get; set; }
        public string DbVersion { get; set; }
        public string DbOracleTableSpace { get; set; }
        public string DbReadConn { get; set; }
        public string DbReadType { get; set; }
        public string DbLogConn { get; set; }
        public string DbLogType { get; set; }
        public string DbMongoConnection { get; set; }
        #endregion

        public string UseAliOssPrivate { get; set; }
        /// <summary>
        /// 外网
        /// </summary>
        public string AliOssPrivateEndpoint { get; set; }
        /// <summary>
        /// 内网
        /// </summary>
        public string AliOssPrivateEndpointInternal { get; set; }
        public string AliOssPrivateDomain { get; set; }
        public string AliOssPrivateAccessKeyId { get; set; }
        public string AliOssPrivateAccessKeySecret { get; set; }
        public string AliOssPrivateBucketName { get; set; }

        public string UseAliOssPublic { get; set; }
        public string AliOssPublicEndpoint { get; set; }
        public string AliOssPublicDomain { get; set; }
        public string AliOssPublicAccessKeyId { get; set; }
        public string AliOssPublicAccessKeySecret { get; set; }
        public string AliOssPublicBucketName { get; set; }



        public string UseAliOssImgProcess { get; set; }
        public string AliOssImgProcess { get; set; }
        public string SessionAuthTimeout { get; set; }

        #region 阿里SMS配置
        private string _AliSmsRegionId = "cn-hangzhou";
        public string AliSmsRegionId
        {
            get { return _AliSmsRegionId; }
            set { _AliSmsRegionId = value; }
        }
        public string AliSmsAccessKeyId { get; set; }
        public string AliSmsAccessKeySecret { get; set; }

        private string _AliSmsDomain = "dysmsapi.aliyuncs.com";
        public string AliSmsDomain
        {
            get { return _AliSmsDomain; }
            set { _AliSmsDomain = value; }
        }

        private string _AliSmsVersion = "2017-05-25";
        public string AliSmsVersion
        {
            get { return _AliSmsVersion; }
            set { _AliSmsVersion = value; }
        }

        private string _AliSmsAction = "SendSms";
        public string AliSmsAction
        {
            get { return _AliSmsAction; }
            set { _AliSmsAction = value; }
        }
        #endregion

        public string MinIOAccessKey { get; set; }
        public string MinIOSecretKey { get; set; }
        /// <summary>
        /// MinIOPrivateEndPoint
        /// </summary>
        public string MinIOEndPoint { get; set; }
        /// <summary>
        /// MinIOPublicEndPoint
        /// </summary>
        public string MinIOEndPointInternet { get; set; }
        /// <summary>
        /// MinIOPublicEndPointSSL
        /// </summary>
        public int? MinIOEndPointSSL { get; set; }
        public int? MinIOPrivateEndPointSSL { get; set; }
        public string MinIOPrivateBucketName { get; set; }
        public string MinIOPublicBucketName { get; set; }
        public string MinIORegion { get; set; }
        public string CloudFrontPrivateCDN { get; set; }
        public string CloudFrontPrivatePemXml { get; set; }
        public string CloudFrontPublicPemId { get; set; }
        public int? FileNameGuid { get; set; }
        

        /// <summary>
        /// MinIO、AliyunOSS
        /// </summary>
        public string HDFS { get; set; }

        //public int? EnableWeChat { get; set; }

    }
}

