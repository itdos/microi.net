using System;
using System.Data.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class TenantProvisioningService
    {
        // 数据库 DDL 无法和主库任务事务原子提交。先把随机账号凭据写入受任务栅栏保护的
        // 加密检查点，再执行 DDL；节点强杀后只恢复同一任务的资源，绝不旋转既有账号密码。
        private TenantDatabaseAccess CreatePublicTrialDatabaseAccess(
            BackgroundTaskRecord task, string dbName, string requestId, out bool seedImported)
        {
            if (task == null || task.ApiEngineKey != SaasPromotionSecurity.WorkerEngine
                || task.UserKey != SaasPromotionSecurity.PublicTrialPrincipalId(requestId) || task.OsClient != OsClientDefault.OsClient)
                throw new InvalidOperationException("公开开通检查点的任务归属不正确。");
            using var databaseLease = TenantProvisioningLease.TryAcquire("database:" + dbName.ToLowerInvariant());
            if (databaseLease == null) throw new InvalidOperationException("目标数据库正在由另一开通任务处理。");
            var databaseType = DiyCommon.GetDbInfo(OsClientDefault.OsClientDbType).DbType;
            var commands = DatabaseAdministrationCompatibility.BuildCommands(databaseType, dbName);
            var principalName = DatabaseAdministrationCompatibility.BuildTenantPrincipalName(databaseType, dbName);
            var principalCommands = DatabaseAdministrationCompatibility.BuildPrincipalCommands(databaseType, dbName, principalName);
            var master = MicroiORMExtensions.CreateDbSession(
                DatabaseAdministrationCompatibility.BuildMasterConnectionString(databaseType, OsClientDefault.OsClientDbConn), databaseType);
            var databaseExists = master.FromSql(commands.ExistsSql).AddInParameter("p0", dbName).ToScalar<int>() > 0;
            var principalExists = master.FromSql(principalCommands.ExistsSql)
                .AddInParameter("p0", principalName).AddInParameter("p1", "%").ToScalar<int>() > 0;
            JObject checkpoint;
            var purpose = "Saas.PublicTrialDatabase:" + task.Id;
            if (string.IsNullOrWhiteSpace(task.CheckpointJson))
            {
                if (databaseExists || principalExists)
                    throw new InvalidOperationException("同名数据库或账号已有其它归属，拒绝接管。");
                var password = DatabaseAdministrationCompatibility.GenerateSecurePassword();
                checkpoint = new JObject
                {
                    ["RequestId"] = requestId, ["DbName"] = dbName, ["PrincipalName"] = principalName,
                    ["Password"] = password, ["SeedImported"] = false,
                    ["ConnectionString"] = DatabaseAdministrationCompatibility.BuildScopedConnectionString(
                        databaseType, OsClientDefault.OsClientDbConn, dbName, principalName, password)
                };
                SavePublicTrialDatabaseCheckpoint(task, checkpoint, purpose);
            }
            else
            {
                var cipher = JObject.Parse(task.CheckpointJson)["SaasPublicDatabaseAccess"]?.ToString();
                checkpoint = JObject.Parse(TenantSystemSettingsSecurity.UnprotectSecret(OsClientDefault.OsClient, purpose, cipher));
                if (!OpaqueTokenSecurity.FixedEquals(checkpoint["RequestId"]?.ToString(), requestId)
                    || checkpoint["DbName"]?.ToString() != dbName || checkpoint["PrincipalName"]?.ToString() != principalName)
                    throw new InvalidOperationException("数据库检查点与当前开通请求不一致。");
            }
            databaseLease.ThrowIfLost();
            if (!databaseExists) checkpoint["SeedImported"] = false;
            // 即使租约在 DDL 之前丢失，栅栏条件更新也必须成功，才允许继续产生副作用。
            SavePublicTrialDatabaseCheckpoint(task, checkpoint, purpose);
            if (!databaseExists) master.FromSql(commands.CreateSql).ExecuteNonQuery();
            if (!principalExists) master.FromSql(principalCommands.CreateSql)
                .AddSensitiveInParameter("p0", checkpoint["Password"]?.ToString()).ExecuteNonQuery();
            var connection = checkpoint["ConnectionString"]?.ToString();
            if (principalExists)
            {
                // 既有账号必须使用原检查点凭据成功连入目标库；失败时保留原资源，禁止 ALTER 密码。
                var credentialConnection = new DbConnectionStringBuilder { ConnectionString = connection };
                credentialConnection.Remove("Database");
                credentialConnection.Remove("Initial Catalog");
                var existingDb = MicroiORMExtensions.CreateDbSession(credentialConnection.ConnectionString, databaseType);
                if (existingDb.FromSql("SELECT 1").ToScalar<int>() != 1)
                    throw new InvalidOperationException("既有数据库账号未通过归属连接校验。");
            }
            master.FromSql(principalCommands.GrantSql).ExecuteNonQuery();
            var tenant = MicroiORMExtensions.CreateDbSession(connection, databaseType);
            if (!string.Equals(tenant.FromSql("SELECT DATABASE()").ToScalar<string>(), dbName, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("租户数据库连接自检失败。");
            databaseLease.ThrowIfLost();
            seedImported = SaasPromotionSecurity.Flag(checkpoint["SeedImported"]);
            return new TenantDatabaseAccess { DbName = dbName, PrincipalName = principalName, ConnectionString = connection };
        }

        private static void MarkPublicTrialSeedImported(BackgroundTaskRecord task)
        {
            var purpose = "Saas.PublicTrialDatabase:" + task.Id;
            var cipher = JObject.Parse(task.CheckpointJson)["SaasPublicDatabaseAccess"]?.ToString();
            var checkpoint = JObject.Parse(TenantSystemSettingsSecurity.UnprotectSecret(OsClientDefault.OsClient, purpose, cipher));
            checkpoint["SeedImported"] = true;
            SavePublicTrialDatabaseCheckpoint(task, checkpoint, purpose);
        }

        private static void SavePublicTrialDatabaseCheckpoint(BackgroundTaskRecord task, JObject checkpoint, string purpose)
        {
            var protectedCheckpoint = new JObject { ["SaasPublicDatabaseAccess"] =
                TenantSystemSettingsSecurity.ProtectSecret(OsClientDefault.OsClient, purpose, checkpoint.ToString()) };
            if (!BackgroundTaskStore.SaveProvisioningCheckpoint(task, protectedCheckpoint))
                throw new InvalidOperationException("开通任务租约已变更，拒绝继续创建数据库。");
        }
    }
}
