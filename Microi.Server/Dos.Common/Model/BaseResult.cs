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
    public class DosResultList<T> //: DosResult<T>
    {
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
    /// 
    /// </summary>
    /// <typeparam name="T"></typeparam>
    [DataContract]
    public class DosResult<T>
    {
        [DataMember]
        public int? Code { get; set; }
        [DataMember]
        public T Data { get; set; }
        [DataMember]
        public object DataAppend { get; set; }
        [DataMember]
        public string Msg { get; set; }
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


    [DataContract]
    public class DosResult
    {
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
        public DosResult(int? code,object data)
        {
            this.Code = code;
            this.Data = data;
        }
        public DosResult(int? code, object data,string msg)
        {
            this.Code = code;
            this.Data = data;
            this.Msg = msg;
        }
        public DosResult(int? code, object data, string msg,int? dataCount)
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
    /// <summary>
    /// 
    /// </summary>
    //[Serializable]
    [DataContract]
    [Obsolete("please use dosResult.")]
    //[CollectionDataContractAttribute]
    public class BaseResult : DynamicObject
    {
        /// <summary>
        /// 是否成功
        /// </summary>
        [DataMember]
        public bool IsSuccess { get; set; }
        /// <summary>
        /// 返回数据
        /// </summary>
        [DataMember]
        public object Data { get; set; }
        /// <summary>
        /// 数据总数
        /// </summary>
        [DataMember]
        public int? DataCount { get; set; }
        /// <summary>
        /// 信息
        /// </summary>
        [DataMember]
        public string Message { get; set; }
        /// <summary>
        /// 信息代码
        /// </summary>
        [DataMember]
        public int? Code { get; set; }
        /// <summary>
        /// 构造函数
        /// </summary>
        public BaseResult()
        {
            this.IsSuccess = true;
            this.Data = null;
            this.Message = null;
            this.Code = null;
        }
        /// <summary>
        /// 构造函数
        /// </summary>
        /// <Param name="isSuccess"></Param>
        public BaseResult(bool isSuccess)
        {
            this.IsSuccess = isSuccess;
            this.Data = null;
            this.Message = null;
            this.Code = null;
        }
        /// <summary>
        /// 构造函数
        /// </summary>
        /// <Param name="isSuccess"></Param>
        /// <Param name="data"></Param>
        public BaseResult(bool isSuccess, object data)
        {
            this.IsSuccess = isSuccess;
            this.Data = data;
            this.Message = null;
            this.Code = null;
        }
        ///// <summary>
        ///// 
        ///// </summary>
        ///// <param name="isSuccess"></param>
        ///// <param name="message"></param>
        //public BaseResult(bool isSuccess, string message)
        //{
        //    this.IsSuccess = isSuccess;
        //    this.Data = null;
        //    this.Message = message;
        //    this.Code = null;
        //}
        /// <summary>
        /// 构造函数
        /// </summary>
        /// <Param name="isSuccess"></Param>
        /// <Param name="data"></Param>
        /// <Param name="message"></Param>
        public BaseResult(bool isSuccess, object data, string message)
        {
            this.IsSuccess = isSuccess;
            this.Data = data;
            this.Message = message;
            this.Code = null;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="isSuccess"></param>
        /// <param name="data"></param>
        /// <param name="dataCount"></param>
        public BaseResult(bool isSuccess, object data, int? dataCount)
        {
            this.IsSuccess = isSuccess;
            this.Data = data;
            this.DataCount = dataCount;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <Param name="isSuccess"></Param>
        /// <Param name="data"></Param>
        /// <Param name="message"></Param>
        /// <Param name="dataCount"></Param>
        public BaseResult(bool isSuccess, object data, string message, int? dataCount)
        {
            this.IsSuccess = isSuccess;
            this.Data = data;
            this.Message = message;
            this.DataCount = dataCount;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="isSuccess"></param>
        /// <param name="data"></param>
        /// <param name="message"></param>
        /// <param name="dataCount"></param>
        /// <param name="code"></param>
        public BaseResult(bool isSuccess, object data, string message, int? dataCount,int code)
        {
            this.IsSuccess = isSuccess;
            this.Data = data;
            this.Message = message;
            this.DataCount = dataCount;
            this.Code = code;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="isSuccess"></param>
        /// <param name="data"></param>
        /// <param name="dataCount"></param>
        /// <param name="message"></param>
        public BaseResult(bool isSuccess, object data, int? dataCount, string message)
        {
            this.IsSuccess = isSuccess;
            this.Data = data;
            this.Message = message;
            this.DataCount = dataCount;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="isSuccess"></param>
        /// <param name="data"></param>
        /// <param name="dataCount"></param>
        /// <param name="message"></param>
        /// <param name="code"></param>
        public BaseResult(bool isSuccess, object data, int? dataCount, string message,int code)
        {
            this.IsSuccess = isSuccess;
            this.Data = data;
            this.Message = message;
            this.DataCount = dataCount;
            this.Code = code;
        }
        /// <summary>
        /// 
        /// </summary>
        public Dictionary<string, object> Properties = new Dictionary<string, object>();
        /// <summary>
        /// 
        /// </summary>
        /// <param name="binder"></param>
        /// <param name="value"></param>
        /// <returns></returns>
        public override bool TrySetMember(SetMemberBinder binder, object value)
        {
            if (!Properties.Keys.Contains(binder.Name))
            {
                Properties.Add(binder.Name, value.ToString());
            }
            return true;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="binder"></param>
        /// <param name="result"></param>
        /// <returns></returns>
        public override bool TryGetMember(GetMemberBinder binder, out object result)
        {
            return Properties.TryGetValue(binder.Name, out result);
        }
    }
}
