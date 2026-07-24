using System;
using System.Collections.Generic;

namespace Microi.net
{
    /// <summary>
    /// Generic client FormEngine access to these platform resources is restricted to
    /// platform administrators. Keep this as the single source of truth for runtime
    /// authorization and upgrade-time role-grant cleanup.
    ///
    /// Do not protect tables by a broad prefix such as mci_: some mci_ tables contain
    /// ordinary tenant business data. Add entries only after confirming that the table
    /// stores credentials, executable code, authorization policy, platform metadata,
    /// private source, infrastructure configuration or security audit state.
    /// </summary>
    public static class PlatformResourceSecurity
    {
        private static readonly string[] ProtectedTableNameValues =
        {
            // Tenant, configuration, executable code and low-code metadata.
            "sys_osclients",
            "sys_config",
            "sys_apiengine",
            "diy_table",
            "diy_field",
            "sys_menu",
            "sys_role",
            "sys_rolelimit",
            "sys_user",
            "sys_userfk",
            "sys_onlineuser",
            "sys_datasource",
            "diy_schedule_job",
            "diy_schedule_job_log",
            "sys_mq",
            "sys_mqtt",
            "mic_page",
            "mic_print",
            "wf_flowdesign",
            "wf_node",
            "wf_line",
            "microi_database",
            "sys_microiservice",
            "sys_microiservice_page",
            "sys_microistore",
            "sys_microistoreversion",
            "sys_appinstalled",
            "sys_business_blueprint",
            "sys_blueprint_relation",
            "sys_blueprint_history",

            // Logs, node state and credential-bearing platform integrations.
            "sys_log",
            "sys_servernode",
            "mic_ai",
            "mic_email_server",
            "wx_mp",
            "mic_micro_app",
            "mic_micro_app_asset",
            "mic_micro_app_version",

            // Infrastructure credentials, backup state and security telemetry.
            "mci_database_backup",
            "mci_file_remote_connection",
            "mci_redis_connection",
            "mci_license_server",
            "mci_security_access_log",
            "mci_security_attack_event",
            "mci_security_ip_block",
            "mci_spider_account",
            "mci_spider_profile",
            "mci_spider_rule",

            // AI application private source, build versions and authorization policy.
            "mci_ai_app",
            "mci_ai_app_file",
            "mci_ai_app_version",
            "mci_ai_data_domain",
            "mci_ai_role_policy"
        };

        private static readonly HashSet<string> ProtectedTableNameSet =
            new HashSet<string>(ProtectedTableNameValues, StringComparer.OrdinalIgnoreCase);

        private static readonly IReadOnlyList<string> ProtectedTableNameView =
            Array.AsReadOnly(ProtectedTableNameValues);

        public static IReadOnlyList<string> ProtectedTableNames => ProtectedTableNameView;

        public static bool IsProtectedTable(string tableName)
        {
            return !string.IsNullOrWhiteSpace(tableName)
                   && ProtectedTableNameSet.Contains(tableName.Trim());
        }

    }
}
