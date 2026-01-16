using System;
using System.IO;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net;
using System.Net.Mime;
using AlipaySDKNet.OpenAPI.Client;
using AlipaySDKNet.OpenAPI.Util;
using AlipaySDKNet.OpenAPI.Util.Model;
using Dos.Common;

namespace Microi.net
{
    public class AlipayV3
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
        public DosResult CreatePay(AlipayParam param)
        {
            try
            {
                AlipayConfig alipayConfig = new AlipayConfig();
                alipayConfig.ServerUrl = "https://openapi.alipay.com";
                alipayConfig.AppId = param.AppId;
                alipayConfig.PrivateKey = param.PrivateKey;
                alipayConfig.AlipayPublicKey = param.AlipayPublicKey;
                // 初始化SDK
                AlipayConfigUtil alipayConfigUtil = new AlipayConfigUtil(alipayConfig);
                GenericExecuteApi api = new GenericExecuteApi();
                api.Client.SetAlipayConfigUtil(alipayConfigUtil);
                // 构造请求参数以调用接口
                Dictionary<string, Object> bizParams = new Dictionary<string, object>();
                Dictionary<string, Object> bizContent = new Dictionary<string, Object>();
                // 设置商户订单号
                bizContent.Add("out_trade_no", param.OutTradeNo);
                // 设置订单总金额
                bizContent.Add("total_amount", param.TotalAmount);
                // 设置订单标题
                bizContent.Add("subject", param.Subject);
                // 设置产品码
                bizContent.Add("product_code", param.ProductCode);
                // 设置针对用户授权接口
                // bizContent.Add("auth_token", "appopenBb64d181d0146481ab6a762c00714cC27");
                // 设置订单附加信息
                // bizContent.Add("body", "Iphone6 16G");
                // 设置用户付款中途退出返回商户网站的地址
                // bizContent.Add("quit_url", "http://www.taobao.com/product/113714.html");
                // 设置订单包含的商品列表信息
                // List<Dictionary<string, Object>> goodsDetail = new List<Dictionary<string, Object>>();
                // Dictionary<string, Object> goodsDetail0 = new Dictionary<string, Object>();
                // goodsDetail0.Add("out_sku_id", "outSku_01");
                // goodsDetail0.Add("goods_name", "ipad");
                // goodsDetail0.Add("alipay_goods_id", "20010001");
                // goodsDetail0.Add("quantity", 1);
                // goodsDetail0.Add("price", "2000");
                // goodsDetail0.Add("out_item_id", "outItem_01");
                // goodsDetail0.Add("goods_id", "apple-01");
                // goodsDetail0.Add("goods_category", "34543238");
                // goodsDetail0.Add("categories_tree", "124868003|126232002|126252004");
                // goodsDetail0.Add("body", "特价手机");
                // goodsDetail0.Add("show_url", "http://www.alipay.com/xxx.jpg");
                // goodsDetail.Add(goodsDetail0);
                // bizContent.Add("goods_detail", goodsDetail);
                // 设置订单绝对超时时间
                // bizContent.Add("time_expire", "2016-12-31 10:05:00");
                // 设置建议使用time_expire字段
                // bizContent.Add("timeout_express", "90m");
                // 设置结算信息
                // Dictionary<string, Object> settleInfo = new Dictionary<string, Object>();
                // settleInfo.Add("settle_period_time", "7d");
                // List<Dictionary<string, Object>> settleDetailInfos = new List<Dictionary<string, Object>>();
                // Dictionary<string, Object> settleDetailInfos0 = new Dictionary<string, Object>();
                // settleDetailInfos0.Add("amount", "0.1");
                // settleDetailInfos0.Add("trans_in", "A0001");
                // settleDetailInfos0.Add("settle_entity_type", "SecondMerchant");
                // settleDetailInfos0.Add("summary_dimension", "A0001");
                // settleDetailInfos0.Add("actual_amount", "0.1");
                // settleDetailInfos0.Add("settle_entity_id", "2088xxxxx;ST_0001");
                // settleDetailInfos0.Add("trans_in_type", "cardAliasNo");
                // settleDetailInfos.Add(settleDetailInfos0);
                // settleInfo.Add("settle_detail_infos", settleDetailInfos);
                // bizContent.Add("settle_info", settleInfo);
                // 设置业务扩展参数
                // Dictionary<string, Object> extendParams = new Dictionary<string, Object>();
                // extendParams.Add("sys_service_provider_id", "2088511833207846");
                // extendParams.Add("hb_fq_seller_percent", "100");
                // extendParams.Add("hb_fq_num", "3");
                // extendParams.Add("tc_installment_order_id", "2015042321001004720200028594");
                // extendParams.Add("industry_reflux_info", "{\"scene_code\":\"metro_tradeorder\",\"channel\":\"xxxx\",\"scene_data\":{\"asset_name\":\"ALIPAY\"}}");
                // extendParams.Add("specified_seller_name", "XXX的跨境小铺");
                // extendParams.Add("royalty_freeze", "true");
                // extendParams.Add("card_type", "S0JP0000");
                // extendParams.Add("credit_ext_info", "{\"category\":\"CHARGE_PILE_CAR\",\"serviceId\":\"2020042800000000000001450466\"}");
                // extendParams.Add("trade_component_order_id", "2023060801502300000008810000005657");
                // bizContent.Add("extend_params", extendParams);
                // 设置商户传入业务信息
                // bizContent.Add("business_params", "{\"mc_create_trade_ip\":\"127.0.0.1\"}");
                // 设置公用回传参数
                // bizContent.Add("passback_params", "merchantBizType%3d3C%26merchantBizNo%3d2016010101111");
                // 设置指定支付渠道
                // bizContent.Add("enable_pay_channels", "pcredit,moneyFund,debitCardExpress");
                // 设置禁用渠道
                // bizContent.Add("disable_pay_channels", "pcredit,moneyFund,debitCardExpress");
                // 设置指定单通道
                // bizContent.Add("specified_channel", "pcredit");
                // 设置商户的原始订单号
                // bizContent.Add("merchant_order_no", "20161008001");
                // 设置外部指定买家
                // Dictionary<string, Object> extUserInfo = new Dictionary<string, Object>();
                // extUserInfo.Add("cert_type", "IDENTITY_CARD");
                // extUserInfo.Add("cert_no", "362334768769238881");
                // extUserInfo.Add("name", "李明");
                // extUserInfo.Add("mobile", "16587658765");
                // extUserInfo.Add("min_age", "18");
                // extUserInfo.Add("need_check_info", "F");
                // extUserInfo.Add("identity_hash", "27bfcd1dee4f22c8fe8a2374af9b660419d1361b1c207e9b41a754a113f38fcc");
                // bizContent.Add("ext_user_info", extUserInfo);
                // 设置返回参数选项
                // List<string> queryOptions = new List<string>();
                // queryOptions.Add("hyb_amount");
                // queryOptions.Add("enterprise_pay_info");
                // bizContent.Add("query_options", queryOptions);
                // bizParams.Add("biz_content", bizContent);
                try
                {
                    // 如果是第三方代调用模式，请设置app_auth_token（应用授权令牌）
                    // string pageRedirectionData = api.PageExecute("alipay.trade.wap.pay", "POST", bizParams, null, "<-- 请填写应用授权令牌 -->");
                    // 如果需要返回GET请求，请使用
                    string pageRedirectionData = api.PageExecute("alipay.trade.wap.pay", "GET", bizParams);
                    // Console.WriteLine(pageRedirectionData);
                    return new DosResult(1, pageRedirectionData);

                }
                catch (ApiException e)
                {
                    return new DosResult(0, e, e.Message);
                }
            }
            catch (System.Exception ex)
            {
                return new DosResult(0, ex, ex.Message);
            }
        }
    }
}