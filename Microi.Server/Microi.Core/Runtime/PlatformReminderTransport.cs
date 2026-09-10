using System;
using System.Security.Cryptography;
using System.Text;

namespace Microi.net
{
    /// <summary>提醒只广播无内容的唤醒信号；群组由 Hub 的可信登录身份决定。</summary>
    public static class PlatformReminderTransport
    {
        public const string TransportName = "platform-reminders";
        public const string EventName = "ReceivePlatformReminder";
        public static string Group(string osClient)
        {
            var scope = string.Join("|", osClient?.Trim().ToLowerInvariant(),
                OsClientDefault.OsClientType, OsClientDefault.OsClientNetwork);
            using var hash = SHA256.Create();
            return "platform-reminders:" + BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(scope))).Replace("-", "").ToLowerInvariant();
        }
    }
}
