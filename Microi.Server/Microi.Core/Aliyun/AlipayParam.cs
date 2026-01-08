using System;
using System.Collections.Generic;

namespace Microi.net
{
    public class AlipayParam
    {
        public string SignType { get; set;}
        public Dictionary<string, string> SignParams { get; set; }
        /// <summary>
        /// 【必传】请填写您的应用私钥，例如：MIIEvQIBADANB
        /// </summary>
        public string PrivateKey { get; set; }
        /// <summary>
        /// POST、GET
        /// </summary>
        public string PageExecute{get;set;}
        
        /// <summary>
        /// 接口内容加密方式为DES时，填写AES的key
        /// </summary>
        public string EncryptKey{get;set;}
        public string NotifyUrl{get;set;}
        public string ReturnUrl{get;set;}
        
        
        /// <summary>
        /// 【必传】请填写您的支付宝公钥，例如：MIIBIjANBg...
        /// </summary>
        public string AlipayPublicKey{get;set;}
        /// <summary>
        /// 请填写您的AppId，例如：2019091767145019
        /// </summary>
        public string AppId{get;set;}
        /// <summary>
        /// 【必传】订单总金额，如9.00。单位为元，精确到小数点后两位，取值范围：[0.01,100000000] 。
        /// </summary>
        public string TotalAmount { get; set; }
        /// <summary>
        /// 【必传】商户订单号：如：70501111111S001111119
        /// </summary>
        public string OutTradeNo { get; set; }
        /// <summary>
        /// 【必传】订单标题，如：大乐透。注意：不可使用特殊字符，如 /，=  等。
        /// </summary>
        public string Subject { get; set; }
        /// <summary>
        /// 【必传】产品码，如：QUICK_WAP_WAY。销售产品码，商家和支付宝签约的产品码。手机网站支付为：QUICK_WAP_WAY
        /// </summary>
        public string ProductCode { get; set; }
        public string SellerId {get;set;}
        /// <summary>
        /// 【可选】针对用户授权接口，如：appopenBb64d181d0146481ab6a762c00714cC27
        /// </summary>
        public string AuthToken { get; set; }
        /// <summary>
        /// 【可选】用户付款中途退出返回商户网站的地址，如：http://www.taobao.com/product/113714.html
        /// </summary>
        public string QuitUrl { get; set; }
    }
}


