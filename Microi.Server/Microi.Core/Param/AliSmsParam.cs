using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    public partial class AliOssParam
    {
        public string _Lang = DiyMessage.Lang;
        public string OsClient { get; set; }
        public bool? Limit { get; set; }
        /// <summary>
        /// 注意：这里包含了完整的路径 ，但不能以/开头，如：static/img/itdos.png
        /// </summary>
        public string FilePathName { get; set; }
        public Stream FileStream { get; set; }
    }
    public partial class AliSmsResult
    {
        public string Message { get; set; }
        public string RequestId { get; set; }
        public string Code { get; set; }
        public string BizId { get; set; }
    }
    public partial class AliSmsParam
    {
        /// <summary>
        /// 必须。"接收号码，多个号码可以逗号分隔"
        /// </summary>
        public string PhoneNumbers { get; set; }
        /// <summary>
        /// 必须。"管理控制台中配置的短信签名（状态必须是验证通过）"
        /// </summary>
        public string SignName { get; set; }
        /// <summary>
        /// 必须。"SMS_xxxxxxx" 管理控制台中配置的审核通过的短信模板的模板CODE（状态必须是验证通过）"
        /// </summary>
        public string TemplateCode { get; set; }
        /// <summary>
        /// 可选。{\"code\":\"123\"} 短信模板中的变量；数字需要转换为字符串；个人用户每个变量长度必须小于15个字符。"
        /// </summary>
        public string TemplateParam { get; set; }
        /// <summary>
        /// 上行短信扩展码，上行短信，指发送给通信服务提供商的短信，用于定制某种服务、完成查询，或是办理某种业务等，需要收费的，按运营商普通短信资费进行扣费。无特殊需要此字段的用户请忽略此字段。
        /// </summary>
        public string SmsUpExtendCode { get; set; }
        /// <summary>
        /// 可选。外部流水扩展字段
        /// </summary>
        public string OutId { get; set; }
        public string OsClient { get; set; }
        public string _Lang = DiyMessage.Lang;
    }
}
