#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
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
#if !NETFRAMEWORK
using RestSharp;
#endif
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Web;

namespace Microi.net
{

    /// <summary>
    /// 
    /// </summary>
    public class DiyHttpParam
    {
        /// <summary>
        /// GET/POST
        /// </summary>
        public string Method { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public string Url { get; set; }
        /// <summary>
        /// 参数类型。可选：Json、Form。默认Form。传入Form则会将new { Key1 = Value1, Key2 = Value2}转换成"key1=value1＆key2=value2"形式。
        /// </summary>
        //public EnumHelper.HttpParamType ParamType { get; set; }
        public string ParamType { get; set; }
        /// <summary>
        /// Delete参数。
        /// <para>可以传入Json对像：new { Key1 = Value1, Key2 = Value2}</para>
        /// <para>可以传入Json字符串：{"Key1":"Value1","Key2":"Value2"}</para>
        /// <para>可以传入key/value字符串："key1=value1＆key2=value2"</para>
        /// <para>可以传入xml字符串等等</para>
        /// </summary>
        public object PatchParam { get; set; }
        /// <summary>
        /// Put参数。
        /// <para>可以传入Json对像：new { Key1 = Value1, Key2 = Value2}</para>
        /// <para>可以传入Json字符串：{"Key1":"Value1","Key2":"Value2"}</para>
        /// <para>可以传入key/value字符串："key1=value1＆key2=value2"</para>
        /// <para>可以传入xml字符串等等</para>
        /// </summary>
        public object PutParam { get; set; }
        /// <summary>
        /// Post参数。
        /// <para>可以传入Json对像：new { Key1 = Value1, Key2 = Value2}</para>
        /// <para>可以传入Json字符串：{"Key1":"Value1","Key2":"Value2"}</para>
        /// <para>可以传入key/value字符串："key1=value1＆key2=value2"</para>
        /// <para>可以传入xml字符串等等</para>
        /// </summary>
        public object PostParam { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string PostParamString { get; set; }
        /// <summary>
        /// Get参数
        /// <para>可以传入Json对像：new { Key1 = Value1, Key2 = Value2}</para>
        /// <para>可以传入Json字符串：{"Key1":"Value1","Key2":"Value2"}</para>
        /// </summary>
        public object GetParam { get; set; }
        /// <summary>
        /// Headers
        /// <para>可以传入Json对像：new { Key1 = Value1, Key2 = Value2}</para>
        /// </summary>
        public object Headers { get; set; }
        /// <summary>
        /// 同Headers
        /// </summary>
        public object Header { get; set; }

        private int _timeOut = 30;
        /// <summary>
        /// 请求超时时间。单位：秒。默认值5秒。
        /// </summary>
        public int TimeOut
        {
            get { return _timeOut; }
            set { _timeOut = value; }
        }
        public int Timeout
        {
            get { return _timeOut; }
            set { _timeOut = value; }
        }
        private Encoding _encoding = Encoding.UTF8;
        /// <summary>
        /// 
        /// </summary>
        public Encoding Encoding
        {
            get { return _encoding; }
            set { _encoding = value; }
        }
        /// <summary>
        /// 
        /// </summary>
        public CookieContainer CookieContainer { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string Referer { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string CertPath { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string CertPwd { get; set; }
        private string _contentType = "application/x-www-form-urlencoded";
        /// <summary>
        /// 默认application/x-www-form-urlencoded
        /// application/xml、application/json、application/text、application/x-www-form-urlencoded等
        /// </summary>
        public string ContentType
        {
            get { return _contentType; }
            set { _contentType = value; }
        }
        private string _userAgent = "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Maxthon/4.1.2.4000 Chrome/26.0.1410.43 Safari/537.1";
        /// <summary>
        /// 
        /// </summary>
        public string UserAgent
        {
            get { return _userAgent; }
            set { _userAgent = value; }
        }
#if NETFRAMEWORK
        /// <summary>
        /// 
        /// </summary>
        public HttpPostedFileBase PostedFile { get; set; }

#endif
        /// <summary>
        /// 要上传的文件的流
        /// </summary>
        public Dictionary<string, Stream>  FilesStream { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public Dictionary<string, byte[]> FilesByte { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public Dictionary<string, string> FilesByteBase64 { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public Dictionary<string, string> FilesByteString { get; set; }
        
        /// <summary>
        /// 
        /// </summary>
        public string FileName { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        [Obsolete("请使用FilesStream、FilesByte、FilesByteBase64参数直接传入文件名")]
        public string UploadParamName { get; set; }
        /// <summary>
        /// 获取或设置请求的身份验证信息。示例： new NetworkCredential(username, password)
        /// </summary>
        public ICredentials Credentials { get; set; }
    }
}
