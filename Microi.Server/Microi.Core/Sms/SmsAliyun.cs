using System;
using System.Collections.Generic;
using AlibabaCloud.TeaUtil.Models;
using Dos.Common;
using Tea;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public class SmsAliyun : ISms
	{
      
        /// <summary>
        /// 使用 AK & SK 初始化账号Client
        /// </summary>
        /// <param name="accessKeyId"></param>
        /// <param name="accessKeySecret"></param>
        /// <returns></returns>
        public static AlibabaCloud.SDK.Dysmsapi20170525.Client CreateClient(string accessKeyId, string accessKeySecret)
        {
            AlibabaCloud.OpenApiClient.Models.Config config = new AlibabaCloud.OpenApiClient.Models.Config
            {
                // 必填，您的 AccessKey ID
                AccessKeyId = accessKeyId,
                // 必填，您的 AccessKey Secret
                AccessKeySecret = accessKeySecret,
            };
            // Endpoint 请参考 https://api.aliyun.com/product/Dysmsapi
            config.Endpoint = "dysmsapi.aliyuncs.com";
            return new AlibabaCloud.SDK.Dysmsapi20170525.Client(config);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult Send(SmsParam param)
        {
            // 请确保代码运行环境设置了环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID 和 ALIBABA_CLOUD_ACCESS_KEY_SECRET。
            // 工程代码泄露可能会导致 AccessKey 泄露，并威胁账号下所有资源的安全性。以下代码示例使用环境变量获取 AccessKey 的方式进行调用，仅供参考，建议使用更安全的 STS 方式，更多鉴权访问方式请参见：https://help.aliyun.com/document_detail/378671.html
            AlibabaCloud.SDK.Dysmsapi20170525.Client client = CreateClient(param.AccessKeyId, param.AccessKeySecret);
            AlibabaCloud.SDK.Dysmsapi20170525.Models.SendSmsRequest sendSmsRequest = new AlibabaCloud.SDK.Dysmsapi20170525.Models.SendSmsRequest();
            RuntimeOptions runtime = new RuntimeOptions();
            // 忽略证书校验
            runtime.IgnoreSSL = true;
            sendSmsRequest.PhoneNumbers = param.PhoneNumbers;
            sendSmsRequest.SignName = param.SignName;
            sendSmsRequest.TemplateCode = param.TemplateCode;
            sendSmsRequest.TemplateParam = param.TemplateParam;
            sendSmsRequest.OutId = param.OutId;
            sendSmsRequest.SmsUpExtendCode = param.SmsUpExtendCode;
            sendSmsRequest.PhoneNumbers = param.PhoneNumbers;
            try
            {
                // 复制代码运行请自行打印 API 的返回值
                var result = client.SendSmsWithOptions(sendSmsRequest, runtime);
                return new DosResult(1, result);
            }
            catch (TeaException error)
            {
                // 如有需要，请打印 error
                var errorResult = AlibabaCloud.TeaUtil.Common.AssertAsString(error.Message);
                return new DosResult(0, null, errorResult);
            }
            catch (Exception _error)
            {
                TeaException error = new TeaException(new Dictionary<string, object>
                {
                    { "message", _error.Message }
                });
                // 如有需要，请打印 error
                var errorResult = AlibabaCloud.TeaUtil.Common.AssertAsString(error.Message);
                return new DosResult(0, null, errorResult);
            }
        }
    }
}