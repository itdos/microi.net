using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        public static DosResult ListDatabaseBackupTenants(
            string osClient,
            JObject currentUser)
        {
            return DatabaseBackupControlService.ListEligibleTenants(currentUser, osClient);
        }

        public static DosResult RunDatabaseBackup(
            string osClient,
            JObject currentUser,
            JObject param)
        {
            param ??= new JObject();
            return DatabaseBackupControlService.QueueManualBackup(
                currentUser,
                osClient,
                param["TenantOsClients"],
                param["RetainCount"]?.Val<int>() ?? 7,
                param["IdempotencyKey"]?.ToString());
        }

        public static Task<DosResult> GetDatabaseBackupSettings(
            string osClient,
            JObject currentUser)
        {
            return DatabaseBackupControlService.GetSettingsAsync(currentUser, osClient);
        }

        public static Task<DosResult> SaveDatabaseBackupSettings(
            string osClient,
            JObject currentUser,
            JObject param)
        {
            return DatabaseBackupControlService.SaveSettingsAsync(currentUser, osClient, param);
        }
    }
}
