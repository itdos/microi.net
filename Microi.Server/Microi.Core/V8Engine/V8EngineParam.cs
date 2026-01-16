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
    /// 
    /// 继承自 V8EngineExtend 以获得扩展功能（如 Alipay、WeChat 等）
    /// 具体扩展实现在 Microi.V8Engine 中通过 partial 提供
    /// </summary>
    public partial class V8EngineParam : V8EngineExtend
    {
        public bool? SyncRun { get; set; }
        public MqttParam MQTT { get; set; }
        public HttpContext HttpContext { get; set; }
        public bool EnableLog { get; set; }
        public Engine Engine { get; set; }
        public string EventName { get; set; }
        public string ApiEngineKey { get; set; }
        /// <summary>
        /// 调用方式，Server、Client
        /// 这里之所以不使用_InvokeType是因为不用像表单引擎那里区别表单字段和系统字段
        /// </summary>
        public string InvokeType { get; set; }
        public string OsClient { get; set; }
        public dynamic OsClientModel { get; set; }
        public dynamic SysConfig { get; set; }
        public dynamic TableModel { get; set; }
        public dynamic Result { get; set; }
        //object的话，传入function无法带参数
        //Action的话，没试过
        //dynamic

        //public SysUser CurrentUser { get; set; }
        public dynamic CurrentSysUser { get; set; }
        public dynamic CurrentUser { get; set; }
        public dynamic Form { get; set; }
        /// <summary>
        /// 表格数据列表，用于批量数据处理
        /// </summary>
        public List<JObject> TableData { get; set; } = new List<JObject>();
        public dynamic OldForm { get; set; }
        public string LineValue { get; set; }
        public string V8Code { get; set; }
        public IMicroiDbSession Db { get; set; }
        public Dictionary<string, IMicroiDbSession> Dbs { get; set; } = new Dictionary<string, IMicroiDbSession>();
        public IMicroiDbSession DbRead { get; set; }
        public IMicroiDbTransaction DbTrans { get; set; }
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
        private Dictionary<string, dynamic> _param = new Dictionary<string, dynamic>();
        public Dictionary<string, dynamic> Param
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
        public Dictionary<string, string> FilesByteBase64 { get; set; } = new Dictionary<string, string>();

        public IMicroiOffice Office { get; set; }
        public IMicroiMQ MQ { get; set; }

        public IMicroiHDFS HDFS;//  = new MicroiHDFS();
    }
}