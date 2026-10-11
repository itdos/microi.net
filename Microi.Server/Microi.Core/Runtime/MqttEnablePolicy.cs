using System;

namespace Microi.net
{
    /// <summary>
    /// MQTT 开关的协议版本门。旧库的 NULL 曾表示关闭；完成一次性数据迁移后，
    /// NULL 才能表示默认开启。未知值和缺失版本一律按旧语义关闭。
    /// </summary>
    public static class MqttEnablePolicy
    {
        public const string NullMeansEnabledVersion = "7.6.16.0";

        public static bool IsMigrationApplied(string serverVersion)
        {
            return Version.TryParse(serverVersion, out var actual)
                   && actual.Revision >= 0
                   && actual.CompareTo(new Version(NullMeansEnabledVersion)) >= 0;
        }

        public static bool IsEnabled(string rawValue, bool migrationApplied)
        {
            var value = (rawValue ?? string.Empty).Trim();
            if (value == "0") return false;
            if (value == "1") return true;
            return migrationApplied && value.Length == 0;
        }
    }
}
