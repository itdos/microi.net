#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：OperateStatus
* Copyright(c) www.iTdos.com
* CLR 版本: 4.0.30319.17929
* 创 建 人：iTdos
* 电子邮箱：admin@iTdos.com
* 创建日期：2014/10/1 11:00:49
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion

using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
#if NETFRAMEWORK
using System.ServiceModel;
#endif
namespace Dos.Common
{
    /// <summary>
    /// 
    /// </summary>
    /// <typeparam name="T"></typeparam>
    [DataContract]
    public class DosResultList<T> : DynamicObject
    {
        /// <summary>
        /// 存储动态属性
        /// </summary>
        private readonly Dictionary<string, object> _dynamicProperties = new Dictionary<string, object>();

        [DataMember]
        public int? Code { get; set; }
        [DataMember]
        public List<T> Data { get; set; }
        [DataMember]
        public object DataAppend { get; set; }
        [DataMember]
        public string Msg { get; set; }
        /// <summary>
        /// 
        /// </summary>
        //[DataMember]
        //public int? DataTotal { get; set; }
        [DataMember]
        public int? DataCount { get; set; }

        /// <summary>
        /// 获取动态属性字典（用于 JSON 序列化）
        /// </summary>
        [Newtonsoft.Json.JsonExtensionData]
        public Dictionary<string, object> DynamicProperties => _dynamicProperties;

        /// <summary>
        /// 支持动态设置属性：result.XXX = value
        /// </summary>
        public override bool TrySetMember(SetMemberBinder binder, object value)
        {
            _dynamicProperties[binder.Name] = value;
            return true;
        }

        /// <summary>
        /// 支持动态获取属性：var x = result.XXX
        /// </summary>
        public override bool TryGetMember(GetMemberBinder binder, out object result)
        {
            return _dynamicProperties.TryGetValue(binder.Name, out result);
        }

        /// <summary>
        /// 获取所有动态属性名
        /// </summary>
        public override IEnumerable<string> GetDynamicMemberNames()
        {
            return _dynamicProperties.Keys;
        }

        public DosResultList()
        {
            // this.Code = 0;
            this.Data = default;
        }
        public DosResultList(int? code)
        {
            this.Code = code;
            this.Data = default;
        }
        public DosResultList(int? code, List<T> data)
        {
            this.Code = code;
            this.Data = data;
        }
        public DosResultList(int? code, List<T> data, string msg)
        {
            this.Code = code;
            this.Data = data;
            this.Msg = msg;
        }
        public DosResultList(int? code, List<T> data, string msg, int? dataCount)
        {
            this.Code = code;
            this.Data = data;
            this.Msg = msg;
            this.DataCount = dataCount;
        }
        public DosResultList(int? code, List<T> data, string msg, int? dataCount, object dataAppend)
        {
            this.Code = code;
            this.Data = data;
            this.Msg = msg;
            this.DataCount = dataCount;
            this.DataAppend = dataAppend;
        }
    }
    /// <summary>
    /// 一般返回的Data为单个对象
    /// </summary>
    /// <typeparam name="T"></typeparam>
    [DataContract]
    public class DosResult<T> : DynamicObject
    {
        /// <summary>
        /// 存储动态属性
        /// </summary>
        private readonly Dictionary<string, object> _dynamicProperties = new Dictionary<string, object>();

        [DataMember]
        public int? Code { get; set; }
        [DataMember]
        public T Data { get; set; }
        [DataMember]
        public object DataAppend { get; set; }
        [DataMember]
        public string Msg { get; set; }

        /// <summary>
        /// 获取动态属性字典（用于 JSON 序列化）
        /// </summary>
        [Newtonsoft.Json.JsonExtensionData]
        public Dictionary<string, object> DynamicProperties => _dynamicProperties;

        /// <summary>
        /// 支持动态设置属性：result.XXX = value
        /// </summary>
        public override bool TrySetMember(SetMemberBinder binder, object value)
        {
            _dynamicProperties[binder.Name] = value;
            return true;
        }

        /// <summary>
        /// 支持动态获取属性：var x = result.XXX
        /// </summary>
        public override bool TryGetMember(GetMemberBinder binder, out object result)
        {
            return _dynamicProperties.TryGetValue(binder.Name, out result);
        }

        /// <summary>
        /// 获取所有动态属性名
        /// </summary>
        public override IEnumerable<string> GetDynamicMemberNames()
        {
            return _dynamicProperties.Keys;
        }

        public DosResult()
        {
            // this.Code = 0;
            this.Data = default;
        }
        public DosResult(int? code)
        {
            this.Code = code;
            this.Data = default;
        }
        public DosResult(int? code, T data)
        {
            this.Code = code;
            this.Data = data;
        }
        public DosResult(int? code, T data, string msg)
        {
            this.Code = code;
            this.Data = data;
            this.Msg = msg;
        }
        public DosResult(int? code, T data, string msg, object dataAppend)
        {
            this.Code = code;
            this.Data = data;
            this.Msg = msg;
            this.DataAppend = dataAppend;
        }
    }

    /// <summary>
    /// 一般返回的Data为单个对象，也可以是List
    /// </summary>
    [DataContract]
    public class DosResult : DynamicObject
    {
        /// <summary>
        /// 存储动态属性
        /// </summary>
        private readonly Dictionary<string, object> _dynamicProperties = new Dictionary<string, object>();

        [DataMember]
        public int? Code { get; set; }
        [DataMember]
        public object Data { get; set; }
        [DataMember]
        public object DataAppend { get; set; }
        [DataMember]
        public string Msg { get; set; }
        /// <summary>
        /// 
        /// </summary>
        [DataMember]
        public int? DataCount { get; set; }

        /// <summary>
        /// 获取动态属性字典（用于 JSON 序列化）
        /// </summary>
        [Newtonsoft.Json.JsonExtensionData]
        public Dictionary<string, object> DynamicProperties => _dynamicProperties;

        /// <summary>
        /// 支持动态设置属性：result.XXX = value
        /// </summary>
        public override bool TrySetMember(SetMemberBinder binder, object value)
        {
            _dynamicProperties[binder.Name] = value;
            return true;
        }

        /// <summary>
        /// 支持动态获取属性：var x = result.XXX
        /// </summary>
        public override bool TryGetMember(GetMemberBinder binder, out object result)
        {
            return _dynamicProperties.TryGetValue(binder.Name, out result);
        }

        /// <summary>
        /// 获取所有动态属性名
        /// </summary>
        public override IEnumerable<string> GetDynamicMemberNames()
        {
            return _dynamicProperties.Keys;
        }

        public DosResult()
        {
            // this.Code = 0;
            this.Data = null;
        }
        public DosResult(int? code)
        {
            this.Code = code;
            this.Data = null;
        }
        public DosResult(int? code, object data)
        {
            this.Code = code;
            this.Data = data;
        }
        public DosResult(int? code, object data, string msg)
        {
            this.Code = code;
            this.Data = data;
            this.Msg = msg;
        }
        public DosResult(int? code, object data, string msg, int? dataCount)
        {
            this.Code = code;
            this.Data = data;
            this.Msg = msg;
            this.DataCount = dataCount;
        }
        public DosResult(int? code, object data, string msg, int? dataCount, object dataAppend)
        {
            this.Code = code;
            this.Data = data;
            this.Msg = msg;
            this.DataCount = dataCount;
            this.DataAppend = dataAppend;
        }
    }
}
