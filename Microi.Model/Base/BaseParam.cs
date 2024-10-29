﻿#region << 版 本 注 释 >>
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
//using Microsoft.AspNetCore.Http;
//using Microsoft.Extensions.Primitives;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public partial class DiyBaseParam : BaseParamCommon
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Id { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    public partial class BaseParam : BaseParamCommon
    {
        //public Guid? Id { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Id { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public InvokeType _InvokeType { get; set; }
    }
    /// <summary>
    /// 参数基类
    /// </summary>
    public partial class BaseParamCommon
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string _Lang = DiyMessage.Lang;
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string authorization { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string OsClient { get; set; }
        //public Guid? Id { get; set; }
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
        public Dictionary<string, string> _OrderBys { get; set; }
        
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
        public Dictionary<string, string> _Search { get; set; }
        
        //bool类型值传1、0
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public Dictionary<string, string> _SearchEqual { get; set; }
        /// <summary>
        /// _SearchEqualOr允许出现重复字段名。_SearchEqual是不允许的。所以这里不能使用Dictionary
        /// </summary>
        //public List<KeyValuePair> _SearchEqualOr { get; set; }
        //不能像Dictionary一样把new { key, value }转换成这个对象
        public List<KeyValue> _SearchEqualOr { get; set; }
        //这种试方式也可以，但也不能把new { key, value }转换成这个对象
        //public List<KeyValue<string, string>> _SearchEqualOr { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<List<KeyValue>> _SearchEqualOrGroup { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<KeyValue> _SearchOr { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>

        public List<List<KeyValue>> _SearchOrGroup { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string _SearchJsonString { get; set; }
        //public string _Search { get; set; }
        /// <summary>
        /// Example：[{"FieldName":["value1","value2"]}]
        /// </summary>
        public Dictionary<string, List<string>> _SearchCheckbox { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public Dictionary<string, List<string>> _SearchDateTime { get; set; }
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
        /// 注意不包含DIY扩展信息，要访问扩展信息请使用_CurrentUser
        /// </summary>
        public SysUser _CurrentSysUser { get; set; }
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
        public List<string> _SelectFields { get; set; }
        //public SysUser CurrentSysUser { get; set; }
        //public BizUser CurrentBizUser { get; set; }
        //public HttpContext _HttpContext { get; set; }

        /// <summary>
        /// 默认为True，临时使用
        /// </summary>
        public bool? _UseDiyLock { get; set; }

        /// <summary>
        /// [{Name:'Age',Value:'v1',Type:'Equal'},{Name:'Sex',Value:'["a","b"]',Type:'In'}]
        /// 生成Sql：AND ( Age = 'v1' AND Sex = 'v2' )
        /// </summary>
        public List<DiyWhere> _Where { get; set; }

        /// <summary>
        /// 最后一条可以不用传OutType
        /// [
        ///   { InType : "AND", OutType : "OR" , _Where : [{Name:'Age',Value:'v1',Type:'Equal'}, {Name:'Sex',Value:'v2',Type:'Equal'}] },
        ///   { InType : "AND", _Where : [{Name:'Age',Value:'v3',Type:'Equal'}, {Name:'Sex',Value:'v4',Type:'Equal'}] }
        /// ]
        /// 生成Sql：AND (
        ///                 ( Age = 'v1' AND Sex IN ('a', 'b') )
        ///                 OR ( Age = 'v3' AND Sex = 'v4' )
        ///             )
        ///
        ///
        ///
        /// 
        /// </summary>
        public List<DiyWhereGroup> _WhereGroup { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    public class DiyWhere
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string Name { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string FormEngineKey { get; set; }
        /// <summary>
        /// Type=In时，Value参数格式：'["a","b"]'
        /// </summary>
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Value { get; set; }
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
    }
    /// <summary>
    /// 
    /// </summary>
    public class DiyWhereGroup
    {
        /// <summary>
        /// 这里面默认为and
        /// </summary>
        public List<DiyWhere> _Where { get; set; }
        /// <summary>
        /// OR
        /// </summary>
        public string OutType { get; set; }
        /// <summary>
        /// AND
        /// </summary>
        public string InType { get; set; }
    }
}
