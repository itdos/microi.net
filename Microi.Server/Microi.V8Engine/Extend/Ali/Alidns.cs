using System;
using System.Collections.Generic;
using Dos.Common;
using Tea;
using Tea.Utils;

namespace Microi.net
{
    public class Alidns
    {
        /// <summary>
        /// 更新阿里云DNS解析，传入AccessKeyId、AccessKeySecret、RecordId、Value、RR、Type
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult UptDomainRecord(AlidnsParam param)
        {
            // 工程代码泄露可能会导致 AccessKey 泄露，并威胁账号下所有资源的安全性。以下代码示例仅供参考。
            // 建议使用更安全的 STS 方式，更多鉴权访问方式请参见：https://help.aliyun.com/document_detail/378671.html。
            AlibabaCloud.OpenApiClient.Models.Config config = new AlibabaCloud.OpenApiClient.Models.Config
            {
                // 必填，请确保代码运行环境设置了环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID。
                AccessKeyId = param.AccessKeyId,//Environment.GetEnvironmentVariable(),//"ALIBABA_CLOUD_ACCESS_KEY_ID"
                // 必填，请确保代码运行环境设置了环境变量 ALIBABA_CLOUD_ACCESS_KEY_SECRET。
                AccessKeySecret = param.AccessKeySecret,//Environment.GetEnvironmentVariable(),//"ALIBABA_CLOUD_ACCESS_KEY_SECRET"
            };
            // Endpoint 请参考 https://api.aliyun.com/product/Alidns
            config.Endpoint = "alidns.cn-hongkong.aliyuncs.com";
            AlibabaCloud.SDK.Alidns20150109.Client client = new AlibabaCloud.SDK.Alidns20150109.Client(config);
            AlibabaCloud.SDK.Alidns20150109.Models.UpdateDomainRecordRequest updateDomainRecordRequest = new AlibabaCloud.SDK.Alidns20150109.Models.UpdateDomainRecordRequest
            {
                Value = param.Value,// "115.215.242.226",
                RecordId = param.RecordId,// "1910410534064325632",
                RR = param.RR,// "test1",
                Type = param.Type,//"A",
            };
            AlibabaCloud.TeaUtil.Models.RuntimeOptions runtime = new AlibabaCloud.TeaUtil.Models.RuntimeOptions();
            try
            {
                // 复制代码运行请自行打印 API 的返回值
                client.UpdateDomainRecordWithOptions(updateDomainRecordRequest, runtime);
                return new DosResult(1);
            }
            catch (TeaException error)
            {
                WriteAliDnsFailure("UpdateDomainRecordFailed", "更新阿里云 DNS 解析失败", error, param?.RecordId);
                return new DosResult(0, null, error.Message);
            }
            catch (Exception _error)
            {
                WriteAliDnsFailure("UpdateDomainRecordFailed", "更新阿里云 DNS 解析失败", _error, param?.RecordId);
                return new DosResult(0, null, _error.Message);
            }
        }
        /// <summary>
        /// 更新阿里云ESA的DNS，传入AccessKeyId、AccessKeySecret、RecordId、Value
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult UptESADomainRecord(AlidnsParam param)
        {
            // 工程代码建议使用更安全的无AK方式，凭据配置方式请参见：https://help.aliyun.com/document_detail/378671.html。
            // Aliyun.Credentials.Client credential = new Aliyun.Credentials.Client();
            AlibabaCloud.OpenApiClient.Models.Config config = new AlibabaCloud.OpenApiClient.Models.Config
            {
                // Credential = credential,
                // 必填，请确保代码运行环境设置了环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID。
                AccessKeyId = param.AccessKeyId,//Environment.GetEnvironmentVariable(),//"ALIBABA_CLOUD_ACCESS_KEY_ID"
                // 必填，请确保代码运行环境设置了环境变量 ALIBABA_CLOUD_ACCESS_KEY_SECRET。
                AccessKeySecret = param.AccessKeySecret,//Environment.GetEnvironmentVariable(),//"ALIBABA_CLOUD_ACCESS_KEY_SECRET"
            };
            // Endpoint 请参考 https://api.aliyun.com/product/ESA
            config.Endpoint = "esa.cn-hangzhou.aliyuncs.com";

            AlibabaCloud.SDK.ESA20240910.Client client = new AlibabaCloud.SDK.ESA20240910.Client(config);
            AlibabaCloud.SDK.ESA20240910.Models.UpdateRecordRequest updateRecordRequest = new AlibabaCloud.SDK.ESA20240910.Models.UpdateRecordRequest()
            {
                // Value = param.Value,// "115.215.242.226",
                RecordId = long.Parse(param.RecordId),// "1910410534064325632",
                Data = new AlibabaCloud.SDK.ESA20240910.Models.UpdateRecordRequest.UpdateRecordRequestData()
                {
                    Value = param.Value
                }
                // RR = param.RR,// "test1",
                // Type = param.Type,//"A",
            };
            AlibabaCloud.TeaUtil.Models.RuntimeOptions runtime = new AlibabaCloud.TeaUtil.Models.RuntimeOptions();
            try
            {
                // 复制代码运行请自行打印 API 的返回值
                client.UpdateRecordWithOptions(updateRecordRequest, runtime);
                return new DosResult(1);
            }
            catch (TeaException error)
            {
                WriteAliDnsFailure("UpdateEsaDomainRecordFailed", "更新阿里云 ESA DNS 解析失败", error, param?.RecordId);
                return new DosResult(0, null, error.Message);
            }
            catch (Exception _error)
            {
                WriteAliDnsFailure("UpdateEsaDomainRecordFailed", "更新阿里云 ESA DNS 解析失败", _error, param?.RecordId);
                return new DosResult(0, null, _error.Message);
            }
        }

        private static void WriteAliDnsFailure(string action, string title, Exception error, string recordId)
        {
            var recommend = error?.Data?["Recommend"]?.ToString();
            MicroiEngine.QueueSystemLog(null, "AliDNS", action, title, error?.ToString(), 3, false, recordId, recommend);
        }
    }
}

