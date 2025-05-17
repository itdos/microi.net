using System;
using System.IO;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net;
using System.Net.Mime;
using Aop.Api;
using Aop.Api.Request;
using Aop.Api.Response;
using Aop.Api.Domain;
using Aop.Api.Util;
using Microi.Model.Aliyun;
using Dos.Common;
using System.Threading.Tasks;

namespace Microi.net
{
    public class Alipay
    {
        public string Test22(string value)
        {
            return "111111" + value;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult SignV2(AlipayParam param)
        {
            //签名过程：生成签名方（通常为商家）首先将所有参数和值放入一个map 中，并按照 key 值升序排列（调用Collections.sort 方法）。然后将所有参数拼接起来，去掉 key 或 value 为空的参数，并用 & 连接，组成签名原文。最后使用 RSA 的私钥对签名原文进行签名。若接口中需携带图片/视频等文件上传请求，文件流不参与签名，请自行将文件转换成文件流形式，且以文件流格式请求。
            AlipayConfig alipayConfig = new AlipayConfig();
            alipayConfig.ServerUrl = "https://openapi.alipay.com/gateway.do";
            alipayConfig.AppId = param.AppId;
            alipayConfig.PrivateKey = param.PrivateKey;
            alipayConfig.Format = "json";
            alipayConfig.Charset = "UTF-8";
            alipayConfig.AlipayPublicKey = param.AlipayPublicKey;
            //设置签名类型
            alipayConfig.SignType = "RSA2";
            //构造client
            IAopClient alipayClient = new DefaultAopClient(alipayConfig);
            return new DosResult(1);
        }
        public DosResult CheckSignV2(AlipayParam param)
        {
            AlipayConfig alipayConfig = new AlipayConfig();
            alipayConfig.ServerUrl = "https://openapi.alipay.com/gateway.do";
            alipayConfig.AppId = param.AppId;
            alipayConfig.PrivateKey = param.PrivateKey;
            alipayConfig.Format = "json";
            alipayConfig.Charset = "UTF-8";
            alipayConfig.AlipayPublicKey = param.AlipayPublicKey;
            //设置签名类型
            alipayConfig.SignType = "RSA2";
            //构造client
            IAopClient alipayClient = new DefaultAopClient(alipayConfig);
            try
            {
                var result = AlipaySignature.VerifyV1(param.SignParams, param.AlipayPublicKey, "UTF-8", param.SignType, false);
                return new DosResult(result ? 1 : 0);
            }
            catch (System.Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
        public DosResult CheckSign(AlipayParam param)
        {
            AlipayConfig alipayConfig = new AlipayConfig();
            alipayConfig.ServerUrl = "https://openapi.alipay.com/gateway.do";
            alipayConfig.AppId = param.AppId;
            alipayConfig.PrivateKey = param.PrivateKey;
            alipayConfig.Format = "json";
            alipayConfig.Charset = "UTF-8";
            alipayConfig.AlipayPublicKey = param.AlipayPublicKey;
            //设置签名类型
            alipayConfig.SignType = "RSA2";
            //构造client
            IAopClient alipayClient = new DefaultAopClient(alipayConfig);
            try
            {
                var result = AlipaySignature.VerifyV1(param.SignParams, param.AlipayPublicKey, "UTF-8", param.SignType, false);
                return new DosResult(result ? 1 : 0);
            }
            catch (System.Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult CreatePay(AlipayParam param)
        {
            try
            {
                AlipayConfig alipayConfig = new AlipayConfig();
                alipayConfig.ServerUrl = "https://openapi.alipay.com/gateway.do";
                alipayConfig.AppId = param.AppId;
                alipayConfig.PrivateKey = param.PrivateKey;
                alipayConfig.Format = "json";
                alipayConfig.AlipayPublicKey = param.AlipayPublicKey;
                alipayConfig.Charset = "UTF-8";
                alipayConfig.SignType = "RSA2";

                if (!param.EncryptKey.DosIsNullOrWhiteSpace())
                {
                    alipayConfig.EncryptKey = param.EncryptKey;
                }

                // 初始化SDK
                // IAopClient alipayClient = new DefaultAopClient(alipayConfig);
                IAopClient alipayClient = new DefaultAopClient(
                    alipayConfig.ServerUrl,
                    alipayConfig.AppId,
                    alipayConfig.PrivateKey,
                    "json",
                    "2.0",
                    "RSA2",
                    alipayConfig.AlipayPublicKey,
                    "UTF-8");

                // 构造请求参数以调用接口
                AlipayTradeWapPayRequest request = new AlipayTradeWapPayRequest();
                request.SetApiVersion("2.0");

                AlipayTradeWapPayModel model = new AlipayTradeWapPayModel();
                // 设置商户订单号
                model.OutTradeNo = param.OutTradeNo;
                // 设置订单总金额
                model.TotalAmount = param.TotalAmount;
                // 设置订单标题
                model.Subject = param.Subject;
                // 设置产品码
                model.ProductCode = param.ProductCode;
                if (!param.SellerId.DosIsNullOrWhiteSpace())
                {
                    model.SellerId = param.SellerId;
                }
                // 设置针对用户授权接口
                if (!param.AuthToken.DosIsNullOrWhiteSpace())
                {
                    model.AuthToken = param.AuthToken;
                }
                // 设置用户付款中途退出返回商户网站的地址
                if (!param.QuitUrl.DosIsNullOrWhiteSpace())
                {
                    model.QuitUrl = param.QuitUrl;
                }


                // 设置订单包含的商品列表信息
                // List<GoodsDetail> goodsDetail = new List<GoodsDetail>();
                // GoodsDetail goodsDetail0 = new GoodsDetail();
                // goodsDetail0.GoodsName = "ipad";
                // goodsDetail0.AlipayGoodsId = "20010001";
                // goodsDetail0.Quantity = 1;
                // goodsDetail0.Price = param.TotalAmount;
                // goodsDetail0.GoodsId = "apple-01";
                // goodsDetail0.GoodsCategory = "34543238";
                // goodsDetail0.CategoriesTree = "124868003|126232002|126252004";
                // goodsDetail0.Body = param.Subject;
                // goodsDetail0.ShowUrl = "http://www.alipay.com/xxx.jpg";
                // goodsDetail.Add(goodsDetail0);
                // model.GoodsDetail = goodsDetail;//可选

                // 设置订单绝对超时时间
                // model.TimeExpire = "2016-12-31 10:05:00";//可选
                // 设置业务扩展参数
                // ExtendParams extendParams = new ExtendParams();
                // extendParams.SysServiceProviderId = "2088511833207846";
                // extendParams.HbFqSellerPercent = "100";
                // extendParams.HbFqNum = "3";
                // extendParams.IndustryRefluxInfo = "{\"scene_code\":\"metro_tradeorder\",\"channel\":\"xxxx\",\"scene_data\":{\"asset_name\":\"ALIPAY\"}}";
                // extendParams.RoyaltyFreeze = "true";
                // extendParams.CardType = "S0JP0000";
                // model.ExtendParams = extendParams;
                // 设置商户传入业务信息
                // model.BusinessParams = "{\"mc_create_trade_ip\":\"127.0.0.1\"}";
                // 设置公用回传参数
                // model.PassbackParams = "merchantBizType%3d3C%26merchantBizNo%3d2016010101111";
                // 设置商户的原始订单号
                // model.MerchantOrderNo = "20161008001";
                // 设置外部指定买家
                // ExtUserInfo extUserInfo = new ExtUserInfo();
                // extUserInfo.CertType = "IDENTITY_CARD";
                // extUserInfo.CertNo = "362334768769238881";
                // extUserInfo.Name = "李明";
                // extUserInfo.Mobile = "16587658765";
                // extUserInfo.FixBuyer = "F";
                // extUserInfo.MinAge = "18";
                // extUserInfo.NeedCheckInfo = "F";
                // extUserInfo.IdentityHash = "27bfcd1dee4f22c8fe8a2374af9b660419d1361b1c207e9b41a754a113f38fcc";
                // model.ExtUserInfo = extUserInfo;

                request.SetBizModel(model);

                // 第三方代调用模式下请设置app_auth_token
                // request.PutOtherTextParam("app_auth_token", "<-- 请填写应用授权令牌 -->");
                if (!param.EncryptKey.DosIsNullOrWhiteSpace())
                {
                    request.SetNeedEncrypt(true);
                }

                if (!param.NotifyUrl.DosIsNullOrWhiteSpace())
                {
                    request.SetNotifyUrl(param.NotifyUrl);
                }

                if (!param.ReturnUrl.DosIsNullOrWhiteSpace())
                {
                    request.SetReturnUrl(param.ReturnUrl);
                }

                AlipayTradeWapPayResponse response = null;

                if (param.PageExecute == "GET")
                {
                    // 如果需要返回GET请求，请使用
                    response = alipayClient.pageExecute(request, null, "GET");
                }
                else
                {
                    response = alipayClient.pageExecute(request, null, "POST");
                }
                string pageRedirectionData = response.Body;

                // Console.WriteLine(pageRedirectionData);
                if (!response.IsError)
                {
                    return new DosResult(1, pageRedirectionData, "", 0, new
                    {
                        response = response
                    });
                    // Console.WriteLine("调用成功");
                }
                else
                {
                    return new DosResult(0, response, response.Msg);
                    // Console.WriteLine("调用失败");
                }
            }
            catch (System.Exception ex)
            {
                return new DosResult(0, ex, ex.Message);
            }
        }
    }
}