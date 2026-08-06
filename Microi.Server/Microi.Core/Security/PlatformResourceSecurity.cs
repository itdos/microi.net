using System;
using System.Collections.Generic;
using System.Linq;

namespace Microi.net
{
    /// <summary>
    /// Server-owned policy for generic client FormEngine access to platform tables.
    ///
    /// Platform tables are deliberately split into three groups:
    /// 1. AdministratorOnly: credentials, executable code, authorization policy and
    ///    infrastructure state. Ordinary roles can never receive generic access.
    /// 2. ReadOnly: runtime/catalog metadata that may be read only after an explicit
    ///    menu or direct-table grant. Writes still require Level >= 9999.
    /// 3. RoleManaged: runtime business resources whose CRUD operations follow the
    ///    same explicit role permissions as ordinary business tables.
    ///
    /// Every platform table remains unavailable to anonymous FormEngine calls. Do not
    /// protect tables by a broad prefix such as mci_: some mci_ tables contain ordinary
    /// tenant business data.
    /// </summary>
    public static class PlatformResourceSecurity
    {
        public const string AdministratorOnlyMode = "AdministratorOnly";
        public const string ReadOnlyMode = "ReadOnly";
        public const string RoleManagedMode = "RoleManaged";

        private static readonly string[] DirectTablePermissionValues =
        {
            "Read", "Add", "Edit", "Del"
        };

        private static readonly string[] RoleManagedTableNameValues =
        {
            // Page/print definitions are runtime business resources. Their designers
            // and renderers already use explicit menu/direct-table authorization.
            "mic_page",
            "mic_print"
        };

        private static readonly string[] ReadOnlyTableNameValues =
        {
            // Runtime workflow and application/catalog metadata. Reading requires an
            // explicit role grant; generic writes remain platform-administrator-only.
            "wf_flowdesign",
            "wf_node",
            "wf_line",
            "sys_microiservice",
            "sys_microiservice_page",
            "sys_microistore",
            "sys_microistoreversion",
            "sys_appinstalled",
            "sys_business_blueprint",
            "sys_blueprint_relation",
            "sys_blueprint_history",
            "mic_micro_app",
            "mic_micro_app_asset",
            "mic_micro_app_version"
        };

        private static readonly string[] AdministratorOnlyTableNameValues =
        {
            // Tenant, credentials, executable code and authorization metadata.
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
            "microi_database",

            // Logs, node state and credential-bearing platform integrations.
            "sys_log",
            "sys_servernode",
            "mic_ai",
            "mic_email_server",
            "wx_mp",

            // Infrastructure credentials, backup state and security telemetry.
            "mci_database_backup",
            "mci_background_task",
            "mci_file_remote_connection",
            "mci_redis_connection",
            "mci_license_server",
            "mci_user_access_key",
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

        private static readonly string[] PlatformTableNameValues =
            RoleManagedTableNameValues
                .Concat(ReadOnlyTableNameValues)
                .Concat(AdministratorOnlyTableNameValues)
                .ToArray();

        private static readonly HashSet<string> DirectTablePermissionSet =
            new HashSet<string>(DirectTablePermissionValues, StringComparer.OrdinalIgnoreCase);

        private static readonly HashSet<string> RoleManagedTableNameSet =
            new HashSet<string>(RoleManagedTableNameValues, StringComparer.OrdinalIgnoreCase);

        private static readonly HashSet<string> ReadOnlyTableNameSet =
            new HashSet<string>(ReadOnlyTableNameValues, StringComparer.OrdinalIgnoreCase);

        private static readonly HashSet<string> AdministratorOnlyTableNameSet =
            new HashSet<string>(AdministratorOnlyTableNameValues, StringComparer.OrdinalIgnoreCase);

        private static readonly HashSet<string> PlatformTableNameSet =
            new HashSet<string>(PlatformTableNameValues, StringComparer.OrdinalIgnoreCase);

        private static readonly IReadOnlyList<string> PlatformTableNameView =
            Array.AsReadOnly(PlatformTableNameValues);

        private static readonly IReadOnlyList<string> AdministratorOnlyTableNameView =
            Array.AsReadOnly(AdministratorOnlyTableNameValues);

        private static readonly IReadOnlyList<string> ReadOnlyTableNameView =
            Array.AsReadOnly(ReadOnlyTableNameValues);

        private static readonly IReadOnlyList<string> RoleManagedTableNameView =
            Array.AsReadOnly(RoleManagedTableNameValues);

        private static readonly IReadOnlyList<PlatformTableGrantPolicy> DirectTableGrantPolicyView =
            Array.AsReadOnly(PlatformTableNameValues
                .Select(tableName => new PlatformTableGrantPolicy(
                    tableName,
                    GetDirectGrantMode(tableName),
                    GetAllowedDirectTablePermissions(tableName)))
                .ToArray());

        /// <summary>
        /// Backward-compatible name: this now means the hard administrator-only set.
        /// Use PlatformTableNames when anonymous-access policy needs the full set.
        /// </summary>
        public static IReadOnlyList<string> ProtectedTableNames => AdministratorOnlyTableNameView;

        public static IReadOnlyList<string> PlatformTableNames => PlatformTableNameView;

        public static IReadOnlyList<string> ReadOnlyTableNames => ReadOnlyTableNameView;

        public static IReadOnlyList<string> RoleManagedTableNames => RoleManagedTableNameView;

        public static IReadOnlyList<PlatformTableGrantPolicy> DirectTableGrantPolicies =>
            DirectTableGrantPolicyView;

        /// <summary>
        /// Returns true only for resources that require a platform administrator for
        /// every generic FormEngine operation.
        /// </summary>
        public static bool IsProtectedTable(string tableName)
        {
            return Contains(AdministratorOnlyTableNameSet, tableName);
        }

        public static bool IsPlatformTable(string tableName)
        {
            return Contains(PlatformTableNameSet, tableName);
        }

        public static bool IsReadOnlyTable(string tableName)
        {
            return Contains(ReadOnlyTableNameSet, tableName);
        }

        public static bool IsRoleManagedTable(string tableName)
        {
            return Contains(RoleManagedTableNameSet, tableName);
        }

        public static bool DeniesAnonymousAccess(string tableName)
        {
            return IsPlatformTable(tableName);
        }

        /// <summary>
        /// Operation-aware hard boundary used by all generic client paths. ReadOnly
        /// tables permit only Read/List for explicitly authorized ordinary roles.
        /// </summary>
        public static bool RequiresPlatformAdministrator(string tableName, string operation)
        {
            if (IsProtectedTable(tableName))
            {
                return true;
            }
            if (!IsReadOnlyTable(tableName))
            {
                return false;
            }
            return !string.Equals(operation, "Read", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(operation, "List", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Server-side validation for sys_rolelimit Type=Table. UI state is never an
        /// authorization source and arbitrary Postman payloads are checked here.
        /// </summary>
        public static bool CanGrantDirectTablePermission(
            string tableName,
            string permission,
            int targetRoleLevel)
        {
            if (string.IsNullOrWhiteSpace(permission)
                || !DirectTablePermissionSet.Contains(permission.Trim()))
            {
                return false;
            }
            if (targetRoleLevel >= DiyCommon.MaxRoleLevel)
            {
                return true;
            }
            if (IsProtectedTable(tableName))
            {
                return false;
            }
            if (IsReadOnlyTable(tableName))
            {
                return string.Equals(permission, "Read", StringComparison.OrdinalIgnoreCase);
            }
            return true;
        }

        private static string GetDirectGrantMode(string tableName)
        {
            if (IsProtectedTable(tableName))
            {
                return AdministratorOnlyMode;
            }
            if (IsReadOnlyTable(tableName))
            {
                return ReadOnlyMode;
            }
            return RoleManagedMode;
        }

        private static IReadOnlyList<string> GetAllowedDirectTablePermissions(string tableName)
        {
            if (IsProtectedTable(tableName))
            {
                return Array.Empty<string>();
            }
            if (IsReadOnlyTable(tableName))
            {
                return Array.AsReadOnly(new[] { "Read" });
            }
            return Array.AsReadOnly((string[])DirectTablePermissionValues.Clone());
        }

        private static bool Contains(ISet<string> values, string tableName)
        {
            return !string.IsNullOrWhiteSpace(tableName)
                   && values.Contains(tableName.Trim());
        }
    }

    public sealed class PlatformTableGrantPolicy
    {
        public PlatformTableGrantPolicy(
            string tableName,
            string mode,
            IReadOnlyList<string> allowedPermissions)
        {
            TableName = tableName;
            Mode = mode;
            AllowedPermissions = allowedPermissions ?? Array.Empty<string>();
        }

        public string TableName { get; }

        public string Mode { get; }

        public IReadOnlyList<string> AllowedPermissions { get; }
    }
}
