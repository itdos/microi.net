using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Tea;
using Tea.Utils;

namespace Microi.net
{
    public class Alidns
    {
        internal const string EsaEndpoint = "esa.cn-hangzhou.aliyuncs.com";
        internal const string EsaCnameType = "CNAME";
        internal const string EsaDomainSourceType = "Domain";
        internal const string EsaWebBizName = "web";
        internal const string EsaFollowOriginDomainPolicy = "follow_origin_domain";
        internal const string EsaHttpPorts = "80";
        internal const string EsaHttpsPorts = "443";
        internal const int EsaAutomaticTtl = 1;

        private readonly Func<string, string, IEsaExactRecordClient> _esaClientFactory;
        private readonly Func<string, string, EsaDataPlaneProbeResult> _dataPlaneProbe;

        public Alidns()
            : this((accessKeyId, accessKeySecret) =>
                    new AlibabaEsaExactRecordClient(accessKeyId, accessKeySecret, EsaEndpoint),
                EsaExactDataPlaneProbe.Probe)
        {
        }

        internal Alidns(Func<string, string, IEsaExactRecordClient> esaClientFactory)
            : this(esaClientFactory, EsaExactDataPlaneProbe.Probe)
        {
        }

        internal Alidns(
            Func<string, string, IEsaExactRecordClient> esaClientFactory,
            Func<string, string, EsaDataPlaneProbeResult> dataPlaneProbe)
        {
            _esaClientFactory = esaClientFactory
                ?? throw new ArgumentNullException(nameof(esaClientFactory));
            _dataPlaneProbe = dataPlaneProbe
                ?? throw new ArgumentNullException(nameof(dataPlaneProbe));
        }

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

        /// <summary>
        /// 幂等创建或更新一条 ESA 精确主机 CNAME 记录。
        /// 固定开启 Web 代理、使用域名源站、自动 TTL，并让回源 Host 跟随源站域名；
        /// ESA 默认让回源 TLS SNI 跟随回源 Host，因此二者都会使用 OriginDomain。
        /// 本方法硬拒绝任何通配主机，且创建/更新后必须通过 GetRecord 强回读。
        /// </summary>
        public DosResult EnsureExactESACnameRecord(EsaExactCnameParam param)
        {
            var stage = "Validate";
            long? recordIdForLog = null;

            try
            {
                var spec = BuildExactCnameSpec(param);
                var client = _esaClientFactory(param.AccessKeyId, param.AccessKeySecret);

                stage = "ListSites";
                var sites = client.ListSites(spec.SiteName)
                    .Where(item => item != null
                        && string.Equals(NormalizeReturnedHostname(item.SiteName), spec.SiteName, StringComparison.Ordinal))
                    .ToList();
                if (sites.Count != 1 || !sites[0].SiteId.HasValue)
                {
                    return SafeFailure("ESA 精确站点匹配失败：必须且只能找到一个目标站点。");
                }
                if (!string.Equals(sites[0].Status, "active", StringComparison.OrdinalIgnoreCase))
                {
                    return SafeFailure("ESA 目标站点尚未处于 active 状态，已拒绝修改记录。");
                }

                var siteId = sites[0].SiteId.Value;
                spec.SiteId = siteId;

                stage = "ListRecords";
                var records = FindExactRecords(client, spec);
                if (records.Count > 1)
                {
                    return SafeFailure("ESA 精确主机存在多条记录，已拒绝自动选择或覆盖。");
                }

                string action;
                if (records.Count == 0)
                {
                    stage = "CreateRecord";
                    try
                    {
                        recordIdForLog = client.CreateExactCname(spec);
                        action = "Created";
                    }
                    catch
                    {
                        // 创建响应丢失或并发创建时，只按同一 SiteId + 精确 RecordName 回查；
                        // 仍然不允许模糊匹配，更不会接触通配记录。
                        var reconciled = FindExactRecords(client, spec);
                        if (reconciled.Count != 1 || !reconciled[0].RecordId.HasValue)
                        {
                            throw;
                        }

                        recordIdForLog = reconciled[0].RecordId.Value;
                        if (!RecordMatches(reconciled[0], spec))
                        {
                            stage = "UpdateAfterCreateReconcile";
                            client.UpdateExactCname(recordIdForLog.Value, spec);
                        }
                        action = "ReconciledAfterCreate";
                    }
                }
                else
                {
                    if (!records[0].RecordId.HasValue)
                    {
                        return SafeFailure("ESA 精确主机记录缺少 RecordId，已拒绝修改。");
                    }

                    recordIdForLog = records[0].RecordId.Value;
                    if (RecordMatches(records[0], spec))
                    {
                        action = "Unchanged";
                    }
                    else
                    {
                        stage = "UpdateRecord";
                        try
                        {
                            client.UpdateExactCname(recordIdForLog.Value, spec);
                            action = "Updated";
                        }
                        catch
                        {
                            // 更新出现不确定响应时，只用 RecordId 强回读；若已达到目标状态则幂等收敛。
                            var reconciled = client.GetRecord(recordIdForLog.Value);
                            if (!RecordMatches(reconciled, spec))
                            {
                                throw;
                            }
                            action = "ReconciledAfterUpdate";
                        }
                    }
                }

                if (!recordIdForLog.HasValue || recordIdForLog.Value <= 0)
                {
                    return SafeFailure("ESA 未返回有效的精确主机 RecordId，绑定结果不可确认。");
                }

                stage = "StrongReadback";
                var verified = client.GetRecord(recordIdForLog.Value);
                if (!RecordMatches(verified, spec)
                    || !verified.SiteId.HasValue
                    || verified.SiteId.Value != siteId
                    || !verified.RecordId.HasValue
                    || verified.RecordId.Value != recordIdForLog.Value)
                {
                    return SafeFailure("ESA 精确主机绑定强回读不一致，结果未被确认为成功。");
                }

                stage = "DataPlaneProbe";
                EsaDataPlaneProbeResult dataPlane;
                try
                {
                    // 控制面强回读只证明配置收敛；必须继续验证真实精确域名的数据面，
                    // 且探测器禁止重定向、拒绝非公网解析，避免把域名绑定能力变成 SSRF 跳板。
                    dataPlane = _dataPlaneProbe(spec.RecordName, spec.SiteName)
                        ?? EsaDataPlaneProbeResult.Failed(
                            "NetworkError",
                            "HTTPS 数据面探测未返回有效结果。");
                }
                catch (Exception probeError)
                {
                    WriteEsaExactBindingFailure(stage, probeError, recordIdForLog);
                    dataPlane = EsaDataPlaneProbeResult.Failed(
                        "NetworkError",
                        "HTTPS 数据面探测发生网络异常。");
                }

                EsaOriginProtectionSnapshot originProtection = null;
                var originProtectionDiagnosticStatus = "NotRequested";
                if (dataPlane.HttpStatus == 522)
                {
                    stage = "GetOriginProtection";
                    try
                    {
                        // 522 只触发 ESA GetOriginProtection 只读诊断。这里绝不调用创建、更新、
                        // 删除或白名单确认接口，避免诊断动作扩大源站网络权限。
                        originProtection = client.GetOriginProtection(siteId);
                        originProtectionDiagnosticStatus = originProtection == null
                            ? "Unavailable"
                            : "Available";
                    }
                    catch (Exception protectionError)
                    {
                        WriteEsaExactBindingFailure(stage, protectionError, recordIdForLog);
                        originProtectionDiagnosticStatus = "Unavailable";
                    }
                }

                var result = new EsaExactCnameResult
                {
                    Action = action,
                    ControlPlaneVerified = true,
                    BareDomainReady = dataPlane.Ready,
                    DataPlaneStatus = dataPlane.Status,
                    HttpStatus = dataPlane.HttpStatus,
                    Diagnostic = dataPlane.Diagnostic,
                    SiteId = siteId,
                    SiteName = spec.SiteName,
                    RecordId = recordIdForLog.Value,
                    RecordName = spec.RecordName,
                    RecordType = EsaCnameType,
                    OriginDomain = spec.OriginDomain,
                    OriginHost = spec.OriginDomain,
                    OriginSni = spec.OriginDomain,
                    SourceType = EsaDomainSourceType,
                    Proxied = true,
                    BizName = EsaWebBizName,
                    HostPolicy = EsaFollowOriginDomainPolicy,
                    HttpPorts = EsaHttpPorts,
                    HttpsPorts = EsaHttpsPorts,
                    Ttl = EsaAutomaticTtl,
                    OriginProtectionDiagnosticStatus = originProtectionDiagnosticStatus
                };
                ApplyOriginProtectionDiagnostic(result, originProtection);
                return new DosResult(1, result);
            }
            catch (EsaExactRecordValidationException error)
            {
                return SafeFailure(error.Message);
            }
            catch (Exception error)
            {
                WriteEsaExactBindingFailure(stage, error, recordIdForLog);
                return SafeFailure("ESA 精确主机绑定失败，请检查站点状态、RAM 权限或 ESA 控制面服务。");
            }
        }

        private static EsaExactCnameSpec BuildExactCnameSpec(EsaExactCnameParam param)
        {
            if (param == null)
            {
                throw new EsaExactRecordValidationException("ESA 精确主机绑定参数不能为空。");
            }
            if (string.IsNullOrWhiteSpace(param.AccessKeyId)
                || string.IsNullOrWhiteSpace(param.AccessKeySecret))
            {
                throw new EsaExactRecordValidationException("ESA 访问凭据未配置。");
            }

            var siteName = NormalizeExactHostname(param.SiteName, "SiteName");
            var recordName = NormalizeExactHostname(param.RecordName, "RecordName");
            var originDomain = NormalizeExactHostname(param.OriginDomain, "OriginDomain");

            if (!string.Equals(recordName, siteName, StringComparison.Ordinal)
                && !recordName.EndsWith("." + siteName, StringComparison.Ordinal))
            {
                throw new EsaExactRecordValidationException("RecordName 必须是目标 SiteName 下的精确主机。");
            }
            if (string.Equals(recordName, originDomain, StringComparison.Ordinal))
            {
                throw new EsaExactRecordValidationException("RecordName 与 OriginDomain 不能相同，以免形成回源环路。");
            }

            return new EsaExactCnameSpec
            {
                SiteName = siteName,
                RecordName = recordName,
                OriginDomain = originDomain
            };
        }

        private static string NormalizeExactHostname(string value, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new EsaExactRecordValidationException(fieldName + " 不能为空。");
            }

            var candidate = value.Trim().TrimEnd('.');
            if (candidate.IndexOf('*') >= 0)
            {
                throw new EsaExactRecordValidationException(fieldName + " 禁止使用通配符。");
            }
            if (candidate.IndexOf("://", StringComparison.Ordinal) >= 0
                || candidate.IndexOf('/') >= 0
                || candidate.IndexOf('\\') >= 0
                || candidate.IndexOf('@') >= 0
                || candidate.IndexOf(':') >= 0)
            {
                throw new EsaExactRecordValidationException(fieldName + " 必须是纯主机名，不能包含协议、端口、路径或凭据。");
            }

            string ascii;
            try
            {
                ascii = new IdnMapping().GetAscii(candidate).ToLowerInvariant();
            }
            catch (ArgumentException)
            {
                throw new EsaExactRecordValidationException(fieldName + " 不是有效的主机名。");
            }

            if (IPAddress.TryParse(ascii, out _))
            {
                throw new EsaExactRecordValidationException(fieldName + " 必须是域名，不能是 IP 地址。");
            }
            if (ascii.Length > 253)
            {
                throw new EsaExactRecordValidationException(fieldName + " 超过 DNS 主机名长度限制。");
            }

            var labels = ascii.Split('.');
            if (labels.Length < 2)
            {
                throw new EsaExactRecordValidationException(fieldName + " 必须是完整域名。");
            }
            foreach (var label in labels)
            {
                if (label.Length == 0 || label.Length > 63
                    || label[0] == '-' || label[label.Length - 1] == '-')
                {
                    throw new EsaExactRecordValidationException(fieldName + " 不是有效的 DNS 主机名。");
                }
                for (var index = 0; index < label.Length; index++)
                {
                    var ch = label[index];
                    if ((ch < 'a' || ch > 'z')
                        && (ch < '0' || ch > '9')
                        && ch != '-')
                    {
                        throw new EsaExactRecordValidationException(fieldName + " 不是有效的 DNS 主机名。");
                    }
                }
            }

            return ascii;
        }

        private static string NormalizeReturnedHostname(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            try
            {
                return new IdnMapping().GetAscii(value.Trim().TrimEnd('.')).ToLowerInvariant();
            }
            catch
            {
                return string.Empty;
            }
        }

        private static List<EsaRecordSnapshot> FindExactRecords(
            IEsaExactRecordClient client,
            EsaExactCnameSpec spec)
        {
            return client.ListRecords(spec.SiteId, spec.RecordName)
                .Where(item => item != null
                    && item.SiteId == spec.SiteId
                    && string.Equals(
                        NormalizeReturnedHostname(item.RecordName),
                        spec.RecordName,
                        StringComparison.Ordinal))
                .ToList();
        }

        private static bool RecordMatches(EsaRecordSnapshot record, EsaExactCnameSpec spec)
        {
            return record != null
                && record.SiteId == spec.SiteId
                && string.Equals(NormalizeReturnedHostname(record.RecordName), spec.RecordName, StringComparison.Ordinal)
                && string.Equals(record.RecordType, EsaCnameType, StringComparison.OrdinalIgnoreCase)
                && string.Equals(NormalizeReturnedHostname(record.Value), spec.OriginDomain, StringComparison.Ordinal)
                && string.Equals(record.SourceType, EsaDomainSourceType, StringComparison.OrdinalIgnoreCase)
                && record.Proxied == true
                && string.Equals(record.BizName, EsaWebBizName, StringComparison.OrdinalIgnoreCase)
                && string.Equals(record.HostPolicy, EsaFollowOriginDomainPolicy, StringComparison.OrdinalIgnoreCase)
                && string.Equals(record.HttpPorts, EsaHttpPorts, StringComparison.Ordinal)
                && string.Equals(record.HttpsPorts, EsaHttpsPorts, StringComparison.Ordinal)
                && record.Ttl == EsaAutomaticTtl;
        }

        private static void ApplyOriginProtectionDiagnostic(
            EsaExactCnameResult result,
            EsaOriginProtectionSnapshot protection)
        {
            if (result == null || protection == null) return;

            result.OriginProtection = protection.OriginProtection;
            result.OriginConverge = protection.OriginConverge;
            result.AutoConfirmIPList = protection.AutoConfirmIPList;
            result.NeedUpdate = protection.NeedUpdate;
            result.CurrentIPv4Cidrs = protection.CurrentIPv4Cidrs;
            result.CurrentIPv6Cidrs = protection.CurrentIPv6Cidrs;
            result.LatestIPv4Cidrs = protection.LatestIPv4Cidrs;
            result.LatestIPv6Cidrs = protection.LatestIPv6Cidrs;
            result.AddedIPv4Cidrs = protection.AddedIPv4Cidrs;
            result.AddedIPv6Cidrs = protection.AddedIPv6Cidrs;
            result.RemovedIPv4Cidrs = protection.RemovedIPv4Cidrs;
            result.RemovedIPv6Cidrs = protection.RemovedIPv6Cidrs;
            result.UnchangedIPv4Cidrs = protection.UnchangedIPv4Cidrs;
            result.UnchangedIPv6Cidrs = protection.UnchangedIPv6Cidrs;
            result.CidrListTruncated = protection.CidrListTruncated;
        }

        private static DosResult SafeFailure(string message)
        {
            return new DosResult(0, null, message);
        }

        private static void WriteEsaExactBindingFailure(string stage, Exception error, long? recordId)
        {
            // 禁止把异常正文、SDK 请求对象或访问凭据写入日志；只记录阶段和异常类型。
            var errorType = error == null ? "Unknown" : error.GetType().FullName;
            MicroiEngine.QueueSystemLog(
                null,
                "AliDNS",
                "EnsureExactEsaCnameRecordFailed",
                "ESA 精确主机 CNAME 绑定失败",
                "Stage=" + stage + "; ErrorType=" + errorType,
                3,
                false,
                recordId?.ToString());
        }

        private static void WriteAliDnsFailure(string action, string title, Exception error, string recordId)
        {
            var recommend = error?.Data?["Recommend"]?.ToString();
            MicroiEngine.QueueSystemLog(null, "AliDNS", action, title, error?.ToString(), 3, false, recordId, recommend);
        }
    }

    internal sealed class EsaExactRecordValidationException : Exception
    {
        public EsaExactRecordValidationException(string message)
            : base(message)
        {
        }
    }

    internal sealed class EsaExactCnameSpec
    {
        public long SiteId { get; set; }
        public string SiteName { get; set; }
        public string RecordName { get; set; }
        public string OriginDomain { get; set; }
    }

    internal sealed class EsaSiteSnapshot
    {
        public long? SiteId { get; set; }
        public string SiteName { get; set; }
        public string Status { get; set; }
    }

    internal sealed class EsaRecordSnapshot
    {
        public long? SiteId { get; set; }
        public long? RecordId { get; set; }
        public string RecordName { get; set; }
        public string RecordType { get; set; }
        public string Value { get; set; }
        public string SourceType { get; set; }
        public bool? Proxied { get; set; }
        public string BizName { get; set; }
        public string HostPolicy { get; set; }
        public string HttpPorts { get; set; }
        public string HttpsPorts { get; set; }
        public int? Ttl { get; set; }
    }

    internal sealed class EsaDataPlaneProbeResult
    {
        public bool Ready { get; set; }
        public string Status { get; set; }
        public int? HttpStatus { get; set; }
        public string Diagnostic { get; set; }

        public static EsaDataPlaneProbeResult ReadyResult(int httpStatus)
        {
            return new EsaDataPlaneProbeResult
            {
                Ready = true,
                Status = "Ready",
                HttpStatus = httpStatus,
                Diagnostic = "精确域名 HTTPS 数据面已返回非 5xx 状态。"
            };
        }

        public static EsaDataPlaneProbeResult Failed(
            string status,
            string diagnostic,
            int? httpStatus = null)
        {
            return new EsaDataPlaneProbeResult
            {
                Ready = false,
                Status = status,
                HttpStatus = httpStatus,
                Diagnostic = diagnostic
            };
        }
    }

    internal sealed class EsaOriginProtectionSnapshot
    {
        public string OriginProtection { get; set; }
        public string OriginConverge { get; set; }
        public string AutoConfirmIPList { get; set; }
        public bool? NeedUpdate { get; set; }
        public List<string> CurrentIPv4Cidrs { get; set; }
        public List<string> CurrentIPv6Cidrs { get; set; }
        public List<string> LatestIPv4Cidrs { get; set; }
        public List<string> LatestIPv6Cidrs { get; set; }
        public List<string> AddedIPv4Cidrs { get; set; }
        public List<string> AddedIPv6Cidrs { get; set; }
        public List<string> RemovedIPv4Cidrs { get; set; }
        public List<string> RemovedIPv6Cidrs { get; set; }
        public List<string> UnchangedIPv4Cidrs { get; set; }
        public List<string> UnchangedIPv6Cidrs { get; set; }
        public bool CidrListTruncated { get; set; }
    }

    internal interface IEsaExactRecordClient
    {
        IReadOnlyList<EsaSiteSnapshot> ListSites(string siteName);
        IReadOnlyList<EsaRecordSnapshot> ListRecords(long siteId, string recordName);
        long CreateExactCname(EsaExactCnameSpec spec);
        void UpdateExactCname(long recordId, EsaExactCnameSpec spec);
        EsaRecordSnapshot GetRecord(long recordId);
        EsaOriginProtectionSnapshot GetOriginProtection(long siteId);
    }

    internal sealed class AlibabaEsaExactRecordClient : IEsaExactRecordClient
    {
        private const int MaximumDiagnosticCidrsPerList = 256;
        private readonly AlibabaCloud.SDK.ESA20240910.Client _client;

        public AlibabaEsaExactRecordClient(
            string accessKeyId,
            string accessKeySecret,
            string endpoint)
        {
            var config = new AlibabaCloud.OpenApiClient.Models.Config
            {
                AccessKeyId = accessKeyId,
                AccessKeySecret = accessKeySecret,
                Endpoint = endpoint
            };
            _client = new AlibabaCloud.SDK.ESA20240910.Client(config);
        }

        public IReadOnlyList<EsaSiteSnapshot> ListSites(string siteName)
        {
            var response = _client.ListSites(new AlibabaCloud.SDK.ESA20240910.Models.ListSitesRequest
            {
                SiteName = siteName,
                SiteSearchType = "exact",
                PageNumber = 1,
                PageSize = 10
            });
            return response?.Body?.Sites?
                .Select(item => new EsaSiteSnapshot
                {
                    SiteId = item.SiteId,
                    SiteName = item.SiteName,
                    Status = item.Status
                })
                .ToList()
                ?? new List<EsaSiteSnapshot>();
        }

        public IReadOnlyList<EsaRecordSnapshot> ListRecords(long siteId, string recordName)
        {
            var response = _client.ListRecords(new AlibabaCloud.SDK.ESA20240910.Models.ListRecordsRequest
            {
                SiteId = siteId,
                RecordName = recordName,
                RecordMatchType = "exact",
                PageNumber = 1,
                PageSize = 10
            });
            return response?.Body?.Records?
                .Select(item => new EsaRecordSnapshot
                {
                    SiteId = item.SiteId,
                    RecordId = item.RecordId,
                    RecordName = item.RecordName,
                    RecordType = item.RecordType,
                    Value = item.Data?.Value,
                    SourceType = item.RecordSourceType,
                    Proxied = item.Proxied,
                    BizName = item.BizName,
                    HostPolicy = item.HostPolicy,
                    HttpPorts = item.HttpPorts,
                    HttpsPorts = item.HttpsPorts,
                    Ttl = item.Ttl.HasValue ? (int?)checked((int)item.Ttl.Value) : null
                })
                .ToList()
                ?? new List<EsaRecordSnapshot>();
        }

        public long CreateExactCname(EsaExactCnameSpec spec)
        {
            var response = _client.CreateRecord(new AlibabaCloud.SDK.ESA20240910.Models.CreateRecordRequest
            {
                SiteId = spec.SiteId,
                RecordName = spec.RecordName,
                Type = Alidns.EsaCnameType,
                Data = new AlibabaCloud.SDK.ESA20240910.Models.CreateRecordRequest.CreateRecordRequestData
                {
                    Value = spec.OriginDomain
                },
                SourceType = Alidns.EsaDomainSourceType,
                Proxied = true,
                BizName = Alidns.EsaWebBizName,
                HostPolicy = Alidns.EsaFollowOriginDomainPolicy,
                HttpPorts = Alidns.EsaHttpPorts,
                HttpsPorts = Alidns.EsaHttpsPorts,
                Ttl = Alidns.EsaAutomaticTtl
            });
            if (response?.Body == null
                || !response.Body.RecordId.HasValue
                || response.Body.RecordId.Value <= 0)
            {
                throw new InvalidOperationException("ESA CreateRecord 未返回有效 RecordId。");
            }
            return response.Body.RecordId.Value;
        }

        public void UpdateExactCname(long recordId, EsaExactCnameSpec spec)
        {
            _client.UpdateRecord(new AlibabaCloud.SDK.ESA20240910.Models.UpdateRecordRequest
            {
                RecordId = recordId,
                Type = Alidns.EsaCnameType,
                Data = new AlibabaCloud.SDK.ESA20240910.Models.UpdateRecordRequest.UpdateRecordRequestData
                {
                    Value = spec.OriginDomain
                },
                SourceType = Alidns.EsaDomainSourceType,
                Proxied = true,
                BizName = Alidns.EsaWebBizName,
                HostPolicy = Alidns.EsaFollowOriginDomainPolicy,
                HttpPorts = Alidns.EsaHttpPorts,
                HttpsPorts = Alidns.EsaHttpsPorts,
                Ttl = Alidns.EsaAutomaticTtl
            });
        }

        public EsaRecordSnapshot GetRecord(long recordId)
        {
            var response = _client.GetRecord(new AlibabaCloud.SDK.ESA20240910.Models.GetRecordRequest
            {
                RecordId = recordId
            });
            var item = response?.Body?.RecordModel;
            if (item == null) return null;
            return new EsaRecordSnapshot
            {
                SiteId = item.SiteId,
                RecordId = item.RecordId,
                RecordName = item.RecordName,
                RecordType = item.RecordType,
                Value = item.Data?.Value,
                SourceType = item.RecordSourceType,
                Proxied = item.Proxied,
                BizName = item.BizName,
                HostPolicy = item.HostPolicy,
                HttpPorts = item.HttpPorts,
                HttpsPorts = item.HttpsPorts,
                Ttl = item.Ttl
            };
        }

        public EsaOriginProtectionSnapshot GetOriginProtection(long siteId)
        {
            var response = _client.GetOriginProtection(
                new AlibabaCloud.SDK.ESA20240910.Models.GetOriginProtectionRequest
                {
                    SiteId = siteId
                });
            var body = response?.Body;
            if (body == null || body.SiteId != siteId)
            {
                throw new InvalidOperationException("ESA GetOriginProtection 未返回目标站点的有效结果。");
            }

            var truncated = false;
            var result = new EsaOriginProtectionSnapshot
            {
                OriginProtection = body.OriginProtection,
                OriginConverge = body.OriginConverge,
                AutoConfirmIPList = body.AutoConfirmIPList,
                NeedUpdate = body.NeedUpdate,
                CurrentIPv4Cidrs = CopyDiagnosticCidrs(body.CurrentIPWhitelist?.IPv4, ref truncated),
                CurrentIPv6Cidrs = CopyDiagnosticCidrs(body.CurrentIPWhitelist?.IPv6, ref truncated),
                LatestIPv4Cidrs = CopyDiagnosticCidrs(body.LatestIPWhitelist?.IPv4, ref truncated),
                LatestIPv6Cidrs = CopyDiagnosticCidrs(body.LatestIPWhitelist?.IPv6, ref truncated),
                AddedIPv4Cidrs = CopyDiagnosticCidrs(
                    body.DiffIPWhitelist?.AddedIPWhitelist?.IPv4,
                    ref truncated),
                AddedIPv6Cidrs = CopyDiagnosticCidrs(
                    body.DiffIPWhitelist?.AddedIPWhitelist?.IPv6,
                    ref truncated),
                RemovedIPv4Cidrs = CopyDiagnosticCidrs(
                    body.DiffIPWhitelist?.RemovedIPWhitelist?.IPv4,
                    ref truncated),
                RemovedIPv6Cidrs = CopyDiagnosticCidrs(
                    body.DiffIPWhitelist?.RemovedIPWhitelist?.IPv6,
                    ref truncated),
                UnchangedIPv4Cidrs = CopyDiagnosticCidrs(
                    body.DiffIPWhitelist?.NoChangeIpWhitelist?.IPv4,
                    ref truncated),
                UnchangedIPv6Cidrs = CopyDiagnosticCidrs(
                    body.DiffIPWhitelist?.NoChangeIpWhitelist?.IPv6,
                    ref truncated)
            };
            result.CidrListTruncated = truncated;
            return result;
        }

        private static List<string> CopyDiagnosticCidrs(
            IEnumerable<string> values,
            ref bool truncated)
        {
            var normalized = (values ?? Enumerable.Empty<string>())
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (normalized.Count > MaximumDiagnosticCidrsPerList)
            {
                truncated = true;
                normalized = normalized.Take(MaximumDiagnosticCidrsPerList).ToList();
            }
            return normalized;
        }
    }

    internal static class EsaExactDataPlaneProbe
    {
        private static readonly TimeSpan DnsTimeout = TimeSpan.FromSeconds(5);
        private static readonly TimeSpan TotalTimeout = TimeSpan.FromSeconds(30);
        private static readonly TimeSpan PerAddressTimeout = TimeSpan.FromSeconds(8);
        private const int MaximumResolvedAddresses = 8;
        private const int MaximumStatusLineBytes = 1024;

        /// <summary>
        /// 只探测已经通过控制面强回读的精确 HTTPS 主机。DNS 只解析一次，随后把连接固定到
        /// 已验证公网 IP，并以原精确主机执行 TLS SNI/证书校验；只读取 HTTP 状态行，不跟随
        /// 重定向、不读取响应体，从而消除二次解析的 DNS rebinding/TOCTOU 窗口。
        /// </summary>
        public static EsaDataPlaneProbeResult Probe(string recordName, string siteName)
        {
            if (!IsExactRecordWithinVerifiedSite(recordName, siteName))
            {
                return EsaDataPlaneProbeResult.Failed(
                    "UnsafeTarget",
                    "HTTPS 数据面探测目标不属于已验证 ESA 站点。");
            }

            var totalWatch = Stopwatch.StartNew();
            IPAddress[] addresses;
            try
            {
                var dnsTask = Dns.GetHostAddressesAsync(recordName);
                if (!TryWaitForTask(dnsTask, DnsTimeout, out addresses))
                {
                    return EsaDataPlaneProbeResult.Failed(
                        "DnsResolutionTimeout",
                        "精确域名 DNS 解析超时，数据面尚未就绪。");
                }
            }
            catch (Exception error) when (IsSocketOrAggregateSocketException(error))
            {
                return EsaDataPlaneProbeResult.Failed(
                    "DnsResolutionFailed",
                    "精确域名 DNS 解析失败，数据面尚未就绪。");
            }

            if (addresses == null || addresses.Length == 0)
            {
                return EsaDataPlaneProbeResult.Failed(
                    "DnsResolutionFailed",
                    "精确域名没有可用 DNS 地址，数据面尚未就绪。");
            }
            if (addresses.Any(address => !IsPublicInternetAddress(address)))
            {
                return EsaDataPlaneProbeResult.Failed(
                    "UnsafeResolvedAddress",
                    "精确域名解析包含非公网地址，已拒绝数据面探测。");
            }

            EsaDataPlaneProbeResult lastFailure = null;
            foreach (var address in addresses
                .Distinct()
                .Take(MaximumResolvedAddresses))
            {
                var remaining = TotalTimeout - totalWatch.Elapsed;
                if (remaining <= TimeSpan.Zero)
                {
                    break;
                }
                var attemptBudget = remaining < PerAddressTimeout
                    ? remaining
                    : PerAddressTimeout;
                var attempt = ProbePinnedAddress(recordName, address, attemptBudget);
                if (attempt.HttpStatus.HasValue)
                {
                    return attempt;
                }
                lastFailure = PreferDiagnostic(lastFailure, attempt);
            }

            if (totalWatch.Elapsed >= TotalTimeout)
            {
                return EsaDataPlaneProbeResult.Failed(
                    "RequestTimeout",
                    "精确域名 HTTPS 请求超时，数据面尚未就绪。");
            }
            return lastFailure ?? EsaDataPlaneProbeResult.Failed(
                "NetworkError",
                "精确域名 HTTPS 网络请求失败，数据面尚未就绪。");
        }

        private static EsaDataPlaneProbeResult ProbePinnedAddress(
            string recordName,
            IPAddress address,
            TimeSpan budget)
        {
            var attemptWatch = Stopwatch.StartNew();
            try
            {
                using (var tcpClient = new TcpClient(address.AddressFamily))
                {
                    var connectTask = tcpClient.ConnectAsync(address, 443);
                    if (!TryWaitForTask(connectTask, Remaining(budget, attemptWatch)))
                    {
                        return TimeoutFailure();
                    }
                    connectTask.GetAwaiter().GetResult();

                    using (var networkStream = tcpClient.GetStream())
                    using (var tlsStream = new SslStream(networkStream, false))
                    {
                        var tlsTask = tlsStream.AuthenticateAsClientAsync(recordName);
                        if (!TryWaitForTask(tlsTask, Remaining(budget, attemptWatch)))
                        {
                            return TimeoutFailure();
                        }
                        tlsTask.GetAwaiter().GetResult();

                        // HEAD 只验证真实数据面状态，状态行到达后立即断开，不读取响应头或正文。
                        var requestBytes = Encoding.ASCII.GetBytes(
                            "HEAD / HTTP/1.1\r\n"
                            + "Host: " + recordName + "\r\n"
                            + "User-Agent: Microi-Esa-Readiness/1.0\r\n"
                            + "Accept: */*\r\n"
                            + "Connection: close\r\n\r\n");
                        var writeTask = tlsStream.WriteAsync(
                            requestBytes,
                            0,
                            requestBytes.Length);
                        if (!TryWaitForTask(writeTask, Remaining(budget, attemptWatch)))
                        {
                            return TimeoutFailure();
                        }
                        writeTask.GetAwaiter().GetResult();

                        var statusLine = ReadStatusLine(
                            tlsStream,
                            Remaining(budget, attemptWatch));
                        if (statusLine == null)
                        {
                            return TimeoutFailure();
                        }
                        if (!TryParseHttpStatus(statusLine, out var httpStatus))
                        {
                            return EsaDataPlaneProbeResult.Failed(
                                "InvalidHttpResponse",
                                "精确域名返回了无法识别的 HTTPS 状态行，数据面尚未就绪。");
                        }
                        if (httpStatus >= 100 && httpStatus < 500)
                        {
                            return EsaDataPlaneProbeResult.ReadyResult(httpStatus);
                        }
                        if (httpStatus == 522)
                        {
                            return EsaDataPlaneProbeResult.Failed(
                                "OriginConnectionTimeout",
                                "精确域名返回 HTTP 522，ESA 尚未成功连接源站。",
                                httpStatus);
                        }
                        return EsaDataPlaneProbeResult.Failed(
                            "HttpServerError",
                            "精确域名返回 HTTP 5xx，数据面尚未就绪。",
                            httpStatus);
                    }
                }
            }
            catch (Exception error) when (ContainsException<AuthenticationException>(error))
            {
                return EsaDataPlaneProbeResult.Failed(
                    "TlsHandshakeFailed",
                    "精确域名 TLS 握手失败，数据面尚未就绪。");
            }
            catch (Exception error) when (
                ContainsException<SocketException>(error)
                || ContainsException<IOException>(error))
            {
                return EsaDataPlaneProbeResult.Failed(
                    "NetworkError",
                    "精确域名 HTTPS 网络请求失败，数据面尚未就绪。");
            }
            catch (Exception)
            {
                return EsaDataPlaneProbeResult.Failed(
                    "NetworkError",
                    "精确域名 HTTPS 网络请求失败，数据面尚未就绪。");
            }
        }

        private static string ReadStatusLine(SslStream stream, TimeSpan timeout)
        {
            if (timeout <= TimeSpan.Zero) return null;
            var watch = Stopwatch.StartNew();
            var buffer = new byte[256];
            using (var output = new MemoryStream())
            {
                while (output.Length < MaximumStatusLineBytes)
                {
                    var readTask = stream.ReadAsync(buffer, 0, buffer.Length);
                    if (!TryWaitForTask(
                            readTask,
                            Remaining(timeout, watch),
                            out var readCount))
                    {
                        return null;
                    }
                    if (readCount <= 0) break;
                    var newLineIndex = Array.IndexOf(buffer, (byte)'\n', 0, readCount);
                    var writeCount = newLineIndex >= 0 ? newLineIndex + 1 : readCount;
                    if (output.Length + writeCount > MaximumStatusLineBytes)
                    {
                        writeCount = (int)(MaximumStatusLineBytes - output.Length);
                    }
                    output.Write(buffer, 0, writeCount);
                    if (newLineIndex >= 0) break;
                }
                if (output.Length == 0) return string.Empty;
                return Encoding.ASCII.GetString(output.ToArray()).TrimEnd('\r', '\n');
            }
        }

        private static bool TryParseHttpStatus(string statusLine, out int httpStatus)
        {
            httpStatus = 0;
            if (string.IsNullOrWhiteSpace(statusLine)
                || !statusLine.StartsWith("HTTP/", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
            var parts = statusLine.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length >= 2
                && int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out httpStatus)
                && httpStatus >= 100
                && httpStatus <= 599;
        }

        private static EsaDataPlaneProbeResult PreferDiagnostic(
            EsaDataPlaneProbeResult current,
            EsaDataPlaneProbeResult candidate)
        {
            if (current == null) return candidate;
            if (candidate == null) return current;
            if (candidate.Status == "TlsHandshakeFailed") return candidate;
            if (current.Status == "TlsHandshakeFailed") return current;
            if (candidate.Status == "RequestTimeout") return candidate;
            return current;
        }

        private static EsaDataPlaneProbeResult TimeoutFailure()
        {
            return EsaDataPlaneProbeResult.Failed(
                "RequestTimeout",
                "精确域名 HTTPS 请求超时，数据面尚未就绪。");
        }

        private static TimeSpan Remaining(TimeSpan budget, Stopwatch watch)
        {
            var remaining = budget - watch.Elapsed;
            return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
        }

        private static bool TryWaitForTask(Task task, TimeSpan timeout)
        {
            if (task == null || timeout <= TimeSpan.Zero) return false;
            var completed = Task.WhenAny(task, Task.Delay(timeout))
                .GetAwaiter()
                .GetResult();
            return ReferenceEquals(completed, task);
        }

        private static bool TryWaitForTask<T>(Task<T> task, TimeSpan timeout, out T value)
        {
            value = default;
            if (!TryWaitForTask(task, timeout)) return false;
            value = task.GetAwaiter().GetResult();
            return true;
        }

        internal static bool IsExactRecordWithinVerifiedSite(string recordName, string siteName)
        {
            if (string.IsNullOrWhiteSpace(recordName) || string.IsNullOrWhiteSpace(siteName))
            {
                return false;
            }
            var record = recordName.Trim().TrimEnd('.').ToLowerInvariant();
            var site = siteName.Trim().TrimEnd('.').ToLowerInvariant();
            return record == site || record.EndsWith("." + site, StringComparison.Ordinal);
        }

        internal static bool IsPublicInternetAddress(IPAddress address)
        {
            if (address == null || IPAddress.IsLoopback(address)) return false;
            if (address.IsIPv4MappedToIPv6)
            {
                return IsPublicInternetAddress(address.MapToIPv4());
            }
            var bytes = address.GetAddressBytes();
            if (address.AddressFamily == AddressFamily.InterNetwork)
            {
                return bytes.Length == 4
                    && bytes[0] != 0
                    && bytes[0] != 10
                    && bytes[0] != 127
                    && !(bytes[0] == 100 && bytes[1] >= 64 && bytes[1] <= 127)
                    && !(bytes[0] == 169 && bytes[1] == 254)
                    && !(bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
                    && !(bytes[0] == 192 && bytes[1] == 0 && bytes[2] == 0)
                    && !(bytes[0] == 192 && bytes[1] == 0 && bytes[2] == 2)
                    && !(bytes[0] == 192 && bytes[1] == 168)
                    && !(bytes[0] == 198 && (bytes[1] == 18 || bytes[1] == 19))
                    && !(bytes[0] == 198 && bytes[1] == 51 && bytes[2] == 100)
                    && !(bytes[0] == 203 && bytes[1] == 0 && bytes[2] == 113)
                    && bytes[0] < 224;
            }
            if (address.AddressFamily == AddressFamily.InterNetworkV6)
            {
                return bytes.Length == 16
                    && !address.Equals(IPAddress.IPv6Any)
                    && !address.Equals(IPAddress.IPv6None)
                    && !address.Equals(IPAddress.IPv6Loopback)
                    && !address.IsIPv6LinkLocal
                    && !address.IsIPv6SiteLocal
                    && !address.IsIPv6Multicast
                    && (bytes[0] & 0xfe) != 0xfc;
            }
            return false;
        }

        private static bool IsSocketOrAggregateSocketException(Exception error)
        {
            return ContainsException<SocketException>(error);
        }

        private static bool ContainsException<TException>(Exception error)
            where TException : Exception
        {
            if (error == null) return false;
            if (error is TException) return true;
            if (error is AggregateException aggregate)
            {
                return aggregate.InnerExceptions.Any(ContainsException<TException>);
            }
            return ContainsException<TException>(error.InnerException);
        }
    }
}

