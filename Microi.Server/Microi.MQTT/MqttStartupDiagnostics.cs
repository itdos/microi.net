using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace Microi.net
{
    /// <summary>启动原因与处理建议使用同一份脱敏文本，控制台和系统日志均能直接诊断。</summary>
    public static class MqttStartupDiagnostics
    {
        public static string Describe(Exception exception, int port, int? fallbackPort = null,
            IEnumerable<string> secrets = null)
        {
            var cause = exception;
            while (cause?.InnerException != null) cause = cause.InnerException;
            var message = cause?.Message ?? "Broker 未进入运行状态";
            foreach (var secret in secrets ?? Array.Empty<string>())
                if (!string.IsNullOrEmpty(secret)) message = message.Replace(secret, "<redacted>");
            message = Regex.Replace(message, @"(?i)(password|pwd|token|apikey|secret)\s*[=:]\s*[^\s;,]+", "$1=<redacted>");
            message = message.Replace('\r', ' ').Replace('\n', ' ');
            if (message.Length > 1000) message = message.Substring(0, 1000);
            var remedy = "检查 SaaS 引擎的 MqttPort、MqttUseTls、MqttTlsPort、证书路径和服务账号权限后，仅重启对应 MQTT 节点。";
            if (cause is SocketException socket)
            {
                message = $"{socket.SocketErrorCode} ({socket.ErrorCode})：{message}";
                if (socket.SocketErrorCode == SocketError.AddressAlreadyInUse)
                    remedy = "端口已被其它监听器占用。Windows 用 Get-NetTCPConnection -State Listen，Linux 用 ss -ltnp 核对端口和 PID；复用现有 Broker，或在 SaaS 引擎修改 MQTT 端口。多 API 节点应使用独立 Broker 节点，勿重复启动或结束其它服务。";
                else if (socket.SocketErrorCode == SocketError.AccessDenied)
                    remedy = "系统拒绝绑定端口。Windows 用 netsh interface ipv4 show excludedportrange protocol=tcp 检查保留端口，并核对服务账号权限；在 SaaS 引擎配置可用的 MqttPort/MqttFallbackPort。";
            }
            else if (cause is CryptographicException || cause is FileNotFoundException)
                remedy = "核对 SaaS 引擎的 MqttCertPath/MqttCertPassword：证书文件必须存在、服务账号可读、PFX 密码正确且包含私钥。";
            else if (cause is ArgumentOutOfRangeException)
                remedy = "在 SaaS 引擎把 MqttPort/MqttTlsPort/MqttFallbackPort 设置为 1–65535 范围内的可用端口。";
            return $"MQTT 启动失败；TCP 端口：{port}"
                + (fallbackPort.HasValue ? $"；备用端口：{fallbackPort.Value}" : "")
                + $"；原因：{cause?.GetType().Name ?? "Unknown"}：{message}；解决方案：{remedy}";
        }

        internal static void Report(string osClient, string action, string detail)
        {
            // 日志服务异常也不能吞掉本机启动诊断；先输出控制台，再进入既有可靠日志队列。
            // 宿主会把普通 Console 消息改送日志队列；必须使用关键启动失败标识保留控制台出口。
            Console.WriteLine("Microi：【❌启动失败】【MQTT】" + detail);
            MicroiEngine.QueueSystemLog(osClient, "MQTT", action, "MQTT Broker 启动失败", detail, 3, false);
        }
    }
}
