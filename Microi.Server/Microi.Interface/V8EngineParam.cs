#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using Dos.Common;
using Dos.ORM;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using System.Security.Cryptography;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Text;
using System.Linq;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Http;
using Jint;

namespace Microi.net
{
    /// <summary>
    /// V8引擎参数类
    /// </summary>
    public partial class V8EngineParam : V8EngineExtend
    {
        public bool? SyncRun { get; set; }
        public MqttParam MQTT { get; set; }
        public HttpContext HttpContext { get; set; }
        public bool EnableLog { get; set; }
        public Engine Engine{ get; set; }
        public string EventName { get; set; }
        public string ApiEngineKey { get; set; }
        /// <summary>
        /// 调用方式，Server、Client
        /// </summary>
        public string InvokeType { get; set; }
        public string OsClient { get; set; }
        public dynamic OsClientModel { get; set; }
        public dynamic SysConfig { get; set; }
        public dynamic TableModel { get; set; }
        public object Result { get; set; }
        //object的话，传入function无法带参数
        //Action的话，没试过
        //dynamic

        //public SysUser CurrentUser { get; set; }
        public dynamic CurrentSysUser { get; set; }
        public dynamic CurrentUser { get; set; }
        public dynamic Form { get; set; }
        public List<dynamic> TableData { get; set; }
        public dynamic OldForm { get; set; }
        public string LineValue { get; set; }
        public string V8Code { get; set; }
        public DbSession Db { get; set; }
        public Dictionary<string, DbSession> Dbs { get; set; }
        public DbSession DbRead { get; set; }
        public DbTrans DbTrans { get; set; }
        public string[] NotSaveField { get; set; }
        public IFormEngine FormEngine { get; set; }
        public IApiEngine ApiEngine { get; set; }
        public IDataSourceEngine DataSourceEngine { get; set; }
        public IModuleEngine ModuleEngine { get; set; }
        public IMongoDB MongoDb;//  = new V8MongoDB();
        public ISms Sms;// = new V8EngineSms();
        public ITranslateEngine TranslateEngine;// = new V8EngineTranslate();
        public int? RowIndex { get; set; }
        public dynamic CacheData { get; set; }
        private Dictionary<string, object> _action = new Dictionary<string, object>();
        public Dictionary<string, object> Action
        {
            get { return _action; }
            set { this._action = value; }
        }
        private Dictionary<string, object> _param = new Dictionary<string, object>();
        public Dictionary<string, object> Param
        {
            get { return _param; }
            set { this._param = value; }
        }
        private Dictionary<string, string> _header = new Dictionary<string, string>();
        public Dictionary<string, string> Header
        {
            get { return _header; }
            set { this._header = value; }
        }
        public string FormSubmitAction { get; set; }
        public EncryptHelper EncryptHelper { get; set; }
        public IPHelper IPHelper { get; set; }

        public IWFEngine WFEngine { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public IMicroiHttp Http { get; set; }

        public IMicroiSpider Spider { get; set; }
        public IV8Method Method { get; set; }

        public IMicroiCache Cache { get; set; }

        //public HttpHelper HttpHelper { get; set; }
        public WFParam WF { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public V8Base64 Base64 = new V8Base64();
        public Dictionary<string, string> FilesByteBase64 { get; set; }

        public IMicroiOffice Office { get; set; }
        public IMicroiMQ MQ { get; set; }

        public IMicroiHDFS HDFS;//  = new MicroiHDFS();
    }
}