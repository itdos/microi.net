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
using System.Collections.Generic;

namespace Microi.net
{
    /// <summary>
    /// 微信模板消息参数类。（TODO:后期要实现参数类解耦）
    /// </summary>
    public partial class WxTplMsgParam
    {
        public string AppId { get; set; }
        public string AppSecret { get; set; }
        public string OpenId { get; set; }
        /// <summary>
        /// 点击详情后跳转后的链接地址，为空则不跳转  
        /// </summary>
        public string LinkUrl { get; set; }
        public string TemplateId { get; set; }
        public WxMiniProgram MiniProgram { get; set; }
        public Dictionary<string, string> Data { get; set; } = new Dictionary<string, string>();
    }
    /// <summary>
    /// 微信模板消息小程序参数类
    /// </summary>
    public partial class WxMiniProgram
    {
        public string AppId { get; set; }
        public string PagePath { get; set; }
    }
}

