#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：Biz_CarsInfoLogic
* Copyright(c) 道斯软件
* CLR 版本: 4.0.30319.17929
* 创 建 人：iTdos
* 电子邮箱：admin@iTdos.com
* 创建日期：2016/10/1 11:00:49
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Runtime.Serialization;
using System.ComponentModel.DataAnnotations;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
//using Microsoft.AspNetCore.Http;
//using Microsoft.Extensions.Primitives;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public partial class BaseParam
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Id { get; set; }
        /// <summary>
        /// 调用方式，Server、Client
        /// 这里之所以不使用【InvokeType】是因为【表单引擎】需要区分【表单字段】和【系统字段】
        /// </summary>
        public string _InvokeType { get; set; }
        public string _ClientType { get; set; }
        /// <summary>
        /// .net9需要这样使用
        /// </summary>
        public string _lang = DiyMessage.Lang.ToString();
        /// <summary>
        /// .net9需要这样使用
        /// </summary>
        public string _Lang
        {
            get
            {
                return _lang;
            }
            set { _lang = value; }
        }
        /// <summary>
        /// .net9开始，如果这样写无法在OnActionExecuting中通过type.GetProperty("_Lang")获取到此属性
        /// </summary>
        /// <value></value>
        // public string _Lang = DiyMessage.Lang;
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string authorization { get; set; }


        private string _osClient = "";
        public string _OsClient
        {
            get
            {
                return _osClient;
            }
            set
            {
                _osClient = value;
            }
        }

        public string OsClient
        {
            get
            {
                return _osClient;
            }
            set
            {
                _osClient = value;
            }
        }

        /// <summary>
        /// 前多少条
        /// </summary>
        public int? _Top { get; set; }
        /// <summary>
        /// 每页多少条
        /// </summary>
        public int? _PageSize { get; set; }
        /// <summary>
        /// 第几页。1开始计数
        /// </summary>
        public int? _PageIndex { get; set; }
        /// <summary>
        /// 排序字段
        /// </summary>
        public string _OrderBy { get; set; }
        /// <summary>
        /// 多字段排序
        /// </summary>
        public Dictionary<string, string> _OrderBys { get; set; } = new Dictionary<string, string>();

        /// <summary>
        /// 排序方式
        /// </summary>
        public string _OrderByType { get; set; }
        /// <summary>
        /// 缓存时间（单位：秒）
        /// </summary>
        public int? _Cache { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public int? Level { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string _Keyword { get; set; }
        /// <summary>
        /// Example：{"FieldName":"value", "FieldName2":"value2"}
        /// </summary>
        //public string _Search { get; set; }
        public Dictionary<string, string> _Search { get; set; } = new Dictionary<string, string>();

        //bool类型值传1、0
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public Dictionary<string, string> _SearchEqual { get; set; } = new Dictionary<string, string>();
        /// <summary>
        /// _SearchEqualOr允许出现重复字段名。_SearchEqual是不允许的。所以这里不能使用Dictionary
        /// </summary>
        //public List<KeyValuePair> _SearchEqualOr { get; set; }
        //不能像Dictionary一样把new { key, value }转换成这个对象
        public List<KeyValue> _SearchEqualOr { get; set; } = new List<KeyValue>();
        //这种试方式也可以，但也不能把new { key, value }转换成这个对象
        //public List<KeyValue<string, string>> _SearchEqualOr { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        [Obsolete("已弃用，请使用_Where")]
        public List<List<KeyValue>> _SearchEqualOrGroup { get; set; } = new List<List<KeyValue>>();
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<KeyValue> _SearchOr { get; set; } = new List<KeyValue>();
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>

        public List<List<KeyValue>> _SearchOrGroup { get; set; } = new List<List<KeyValue>>();
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string _SearchJsonString { get; set; }
        //public string _Search { get; set; }
        /// <summary>
        /// Example：[{"FieldName":["value1","value2"]}]
        /// </summary>
        public Dictionary<string, List<string>> _SearchCheckbox { get; set; } = new Dictionary<string, List<string>>();
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public Dictionary<string, List<string>> _SearchDateTime { get; set; } = new Dictionary<string, List<string>>();
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string _Captcha { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string _IMEI { get; set; }
        /// <summary>
        /// 等同于_CurrentSysUser，且包含DIY扩展信息
        /// </summary>
        public JObject _CurrentUser { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<string> _SelectFields { get; set; } = new List<string>();
        /// <summary>
        /// 默认为True，临时使用
        /// </summary>
        public bool? _UseDiyLock { get; set; }
        /// <summary>
        /// [{Name:'Age',Value:'v1',Type:'Equal'},{Name:'Sex',Value:'["a","b"]',Type:'In'}]
        /// 生成Sql：AND ( Age = 'v1' AND Sex = 'v2' )
        /// </summary>
        public object _Where { get; set; }
        // public List<DiyWhere> _Where { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    // public class DiyWhere
    // {
    //     /// <summary>
    //     /// 
    //     /// </summary>
    //     /// <value></value>
    //     public string Name { get; set; }
    //     /// <summary>
    //     /// 
    //     /// </summary>
    //     /// <value></value>
    //     public string FormEngineKey { get; set; }
    //     /// <summary>
    //     /// Type=In时，Value参数格式：'["a","b"]'
    //     /// </summary>
    //     [DisplayFormat(ConvertEmptyStringToNull = false)]
    //     public string Value { get; set; }
    //     /// <summary>
    //     /// Equal、NotEqual、In、NotIn、Like、NotLike、StartLike、NotStartLike、EndLike、NotEndLike
    //     /// </summary>
    //     public string Type { get; set; }
    //     /// <summary>
    //     /// 是否有左括号
    //     /// </summary>
    //     public bool GroupStart { get; set; }
    //     /// <summary>
    //     /// 是否有右括号
    //     /// </summary>
    //     public bool GroupEnd { get; set; }
    //     /// <summary>
    //     /// 左侧是and还是or，默认and
    //     /// </summary>
    //     public string AndOr { get; set; }
    // }
    /// <summary>
    /// 动态 Where 条件
    /// </summary>
    public class DiyWhere
    {
        /// <summary>
        /// 字段名
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// 表标识
        /// </summary>
        public string FormEngineKey { get; set; }

        /// <summary>
        /// Type=In时，Value参数格式：'["a","b"]'
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public object Value { get; set; }

        /// <summary>
        /// Equal、NotEqual、In、NotIn、Like、NotLike、StartLike、NotStartLike、EndLike、NotEndLike
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// 是否有左括号
        /// </summary>
        public bool GroupStart { get; set; }

        /// <summary>
        /// 是否有右括号
        /// </summary>
        public bool GroupEnd { get; set; }

        /// <summary>
        /// 左侧是and还是or，默认and
        /// </summary>
        public string AndOr { get; set; }

        /// <summary>
        /// 默认构造函数
        /// </summary>
        public DiyWhere() { }
    }
}
