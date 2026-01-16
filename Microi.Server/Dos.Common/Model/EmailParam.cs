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
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Web;

namespace Dos.Common
{
    /// <summary>
    /// 
    /// </summary>
    public class EmailParam
    {
        /// <summary>
        /// 指定发送者电子邮件地址
        /// </summary>
        public string FromAddress { get; set; }
        public string ToAddress { get; set; }
        public List<string> ToAddressList { get; set; } = new List<string>();
        /// <summary>
        /// 指定发送者显示名和地址信息构成的显示名
        /// </summary>
        public string DisplayName { get; set; }
        /// <summary>
        /// 电子邮件的主题行.
        /// </summary>
        public string Subject { get; set; }
        public bool EnableSsl { get; set; }

        public string Host { get; set; }
        /// <summary>
        /// 邮件正文
        /// </summary>
        public string Body { get; set; }
        /// <summary>
        /// 默认false
        /// </summary>
        public bool IsUnnormal { get; set; }
        /// <summary>
        /// 密码
        /// </summary>
        public string Password { get; set; }
        /// <summary>
        /// 发件端口
        /// </summary>
        public int Port { get; set; }
        /// <summary>
        /// 附件
        /// </summary>
        public List<Attachment> Attachment { get; set; } = new List<Attachment>();


        private bool isBodyHtml = true;
        /// <summary>
        /// 邮件正文是否为 Html 格式的值。默认true
        /// </summary>
        public bool IsBodyHtml
        {
            get { return isBodyHtml; }
            set { isBodyHtml = value; }
        }
        /// <summary>
        /// 是否异步。默认false。当为true时，.Send()方法永远返回true。
        /// </summary>
        public bool IsAsync { get; set; }
        /// <summary>
        /// 编码。默认Encoding.UTF8
        /// </summary>
        public Encoding BodyEncoding { get; set; }
    }
}
