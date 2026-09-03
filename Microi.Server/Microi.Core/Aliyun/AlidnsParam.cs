using System;
using System.Collections.Generic;

namespace Microi.net
{
    public class AlidnsParam
    {
        public string Value { get; set; }
        public string RecordId { get; set; }
        public string RR { get; set; }
        public string Type { get; set; }
        public string AccessKeyId { get; set; }
        public string AccessKeySecret { get; set; }

    }

    /// <summary>
    /// 阿里云 ESA 精确主机 CNAME 绑定参数。
    /// 记录类型、代理状态、回源 Host 与回源 SNI 策略由服务端固定，调用方不能覆盖。
    /// </summary>
    public class EsaExactCnameParam
    {
        public string SiteName { get; set; }
        public string RecordName { get; set; }
        public string OriginDomain { get; set; }
        public string AccessKeyId { get; set; }
        public string AccessKeySecret { get; set; }
    }

    /// <summary>
    /// 阿里云 ESA 精确主机 CNAME 绑定的安全回读结果，不包含任何访问凭据。
    /// </summary>
    public class EsaExactCnameResult
    {
        public string Action { get; set; }
        /// <summary>
        /// ESA 记录已按固定安全策略完成强回读。该值不等于公网入口已经可用。
        /// </summary>
        public bool ControlPlaneVerified { get; set; }
        /// <summary>
        /// 只有精确域名的有界 HTTPS 数据面探测成功时才为 true。
        /// </summary>
        public bool BareDomainReady { get; set; }
        public string DataPlaneStatus { get; set; }
        public int? HttpStatus { get; set; }
        public string Diagnostic { get; set; }
        public long SiteId { get; set; }
        public string SiteName { get; set; }
        public long RecordId { get; set; }
        public string RecordName { get; set; }
        public string RecordType { get; set; }
        public string OriginDomain { get; set; }
        public string OriginHost { get; set; }
        public string OriginSni { get; set; }
        public string SourceType { get; set; }
        public bool Proxied { get; set; }
        public string BizName { get; set; }
        public string HostPolicy { get; set; }
        public string HttpPorts { get; set; }
        public string HttpsPorts { get; set; }
        public int Ttl { get; set; }

        /// <summary>
        /// 仅在数据面返回 HTTP 522 时读取的 ESA 回源保护诊断；本对象永不触发白名单写入。
        /// </summary>
        public string OriginProtectionDiagnosticStatus { get; set; }
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
}


