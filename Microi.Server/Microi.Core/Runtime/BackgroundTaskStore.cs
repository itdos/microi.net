using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    internal sealed class BackgroundTaskRecord : BackgroundTaskItem
    {
        public string ApiEngineKey { get; set; }
        public string ParamJson { get; set; }
        public string TrustedUserJson { get; set; }
        public string ResultJson { get; set; }
        public string ConcurrencyKey { get; set; }
        public string LeaseOwner { get; set; }
        public DateTime? LeaseExpiresAt { get; set; }
        public int RetryOnFailure { get; set; }
        public DateTime? NextRunTime { get; set; }
        public DateTime? ProgressSampleTime { get; set; }
        public int ProgressSampleCurrent { get; set; }
        public double? ThroughputPerSecond { get; set; }
        public int ProgressSampleCount { get; set; }
        public string CheckpointJson { get; set; }
        public string LastError { get; set; }
        public string RuntimeOsClientType { get; set; }
        public string RuntimeOsClientNetwork { get; set; }
    }

    internal static class BackgroundTaskStore
    {
        internal const string TableName = "mci_background_task";
        private const int DefaultLeaseSeconds = 90;
        private const int EmptyDatabaseReleaseLeaseSeconds = 900;
        private const string EmptyDatabaseReleaseApiEngineKey =
            "admin_build_sanitized_empty_database";
        private static long _tenantScanCursor;
        private const string Projection = @"Id,OsClient,UserKey,Title,Type,ApiEngineKey,Status,StatusText,
Progress,ProgressMode,WorkCurrent AS Current,WorkTotal AS Total,Msg,Log,CreateTime,StartTime,EndTime,
HeartbeatTime,EstimatedEndTime,RemainingSeconds,EstimateConfidence,CancelRequested,ResultJson,ParamJson,
TrustedUserJson,IdempotencyKey,ConcurrencyKey,LeaseOwner,LeaseExpiresAt,FencingToken,AttemptCount,MaxAttempts,
ExecutionCount,RetryOnFailure,NextRunTime,ProgressSampleTime,ProgressSampleCurrent,ThroughputPerSecond,
ProgressSampleCount,CheckpointJson,LastError,BusinessTable,BusinessId,BusinessStatusField,BusinessTaskIdField,
BusinessProgressField,BusinessEtaField,RuntimeOsClientType,RuntimeOsClientNetwork";
        internal const string RuntimeScopePredicate = @"(RuntimeOsClientType IS NULL OR RuntimeOsClientType='' OR RuntimeOsClientType=@runtimeType)
  AND (RuntimeOsClientNetwork IS NULL OR RuntimeOsClientNetwork='' OR RuntimeOsClientNetwork=@runtimeNetwork)";

        public static bool IsAvailable(string osClient)
        {
            return TryGetAvailability(osClient, out _);
        }

        /// <summary>
        /// Validates the complete projection in one database round-trip. A table-only
        /// check can report a half-installed package as ready, while checking columns
        /// one by one is too expensive for every worker scan.
        /// </summary>
        internal static bool TryGetAvailability(string osClient, out string reason)
        {
            reason = "";
            var client = GetClient(osClient);
            if (client?.Db == null)
            {
                reason = $"租户 {osClient} 的数据库连接不可用";
                return false;
            }
            return ValidateSchema(client, out reason);
        }

        public static BackgroundTaskRecord FindByIdempotency(string osClient, string idempotencyKey)
        {
            if (idempotencyKey.DosIsNullOrWhiteSpace()) return null;
            var client = GetRequiredClient(osClient);
            var sql = FirstSql(client, $@"SELECT {Projection} FROM {TableName}
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p0 AND IdempotencyKey=@p1
  AND {RuntimeScopePredicate}
ORDER BY CreateTime DESC");
            return Hydrate(client.Db.FromSql(sql)
                .AddInParameter("p0", osClient)
                .AddInParameter("p1", idempotencyKey)
                .AddInParameter("runtimeType", CurrentRuntimeOsClientType())
                .AddInParameter("runtimeNetwork", CurrentRuntimeOsClientNetwork())
                .ToFirst<BackgroundTaskRecord>());
        }

        /// <summary>
        /// Returns the oldest live task for a native/API-engine worker. Scheduled
        /// producers use this read before enqueueing the next occurrence so a
        /// long-running job cannot accumulate an unbounded backlog. The stable
        /// per-fire idempotency key remains the final cross-node race guard.
        /// </summary>
        public static BackgroundTaskRecord FindActiveByApiEngineKey(string osClient, string apiEngineKey)
        {
            if (apiEngineKey.DosIsNullOrWhiteSpace()) return null;
            var client = GetRequiredClient(osClient);
            var sql = FirstSql(client, $@"SELECT {Projection} FROM {TableName}
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p0 AND ApiEngineKey=@p1
  AND {RuntimeScopePredicate}
  AND CancelRequested=0 AND Status IN ('Pending','Retrying','Running')
ORDER BY CreateTime ASC");
            return Hydrate(client.Db.FromSql(sql)
                .AddInParameter("p0", osClient)
                .AddInParameter("p1", apiEngineKey)
                .AddInParameter("runtimeType", CurrentRuntimeOsClientType())
                .AddInParameter("runtimeNetwork", CurrentRuntimeOsClientNetwork())
                .ToFirst<BackgroundTaskRecord>());
        }

        public static void Insert(BackgroundTaskRecord item, string userId, string userName)
        {
            var client = GetRequiredClient(item.OsClient);
            var sql = $@"INSERT INTO {TableName}
(Id,CreateTime,UpdateTime,UserId,UserName,IsDeleted,OsClient,UserKey,Title,Type,ApiEngineKey,Status,StatusText,
 Progress,ProgressMode,WorkCurrent,WorkTotal,Msg,Log,CancelRequested,ResultJson,ParamJson,TrustedUserJson,
 IdempotencyKey,ConcurrencyKey,FencingToken,AttemptCount,MaxAttempts,ExecutionCount,RetryOnFailure,
 ProgressSampleCurrent,ProgressSampleCount,BusinessTable,BusinessId,BusinessStatusField,BusinessTaskIdField,
 BusinessProgressField,BusinessEtaField,RuntimeOsClientType,RuntimeOsClientNetwork)
VALUES
(@id,@now,@now,@userId,@userName,0,@osClient,@userKey,@title,'ApiEngine',@apiEngineKey,'Pending','排队中',
 0,'Indeterminate',0,0,'','',0,'',@paramJson,@trustedUserJson,@idempotencyKey,@concurrencyKey,0,0,@maxAttempts,0,
 @retryOnFailure,0,0,@businessTable,@businessId,@businessStatusField,@businessTaskIdField,
 @businessProgressField,@businessEtaField,@runtimeType,@runtimeNetwork)";
            var command = client.Db.FromSql(sql)
                .AddInParameter("id", item.Id)
                .AddInParameter("now", DbTime(item.CreateTime))
                .AddInParameter("userId", userId ?? "")
                .AddInParameter("userName", userName ?? "")
                .AddInParameter("osClient", item.OsClient)
                .AddInParameter("userKey", item.UserKey)
                .AddInParameter("title", item.Title)
                .AddInParameter("apiEngineKey", item.ApiEngineKey)
                .AddInParameter("paramJson", item.ParamJson ?? "{}")
                .AddInParameter("trustedUserJson", item.TrustedUserJson ?? "{}")
                .AddInParameter("idempotencyKey", item.IdempotencyKey)
                .AddInParameter("concurrencyKey", item.ConcurrencyKey ?? "")
                .AddInParameter("maxAttempts", item.MaxAttempts)
                .AddInParameter("retryOnFailure", item.RetryOnFailure)
                .AddInParameter("businessTable", item.BusinessTable ?? "")
                .AddInParameter("businessId", item.BusinessId ?? "")
                .AddInParameter("businessStatusField", item.BusinessStatusField ?? "")
                .AddInParameter("businessTaskIdField", item.BusinessTaskIdField ?? "")
                .AddInParameter("businessProgressField", item.BusinessProgressField ?? "")
                .AddInParameter("businessEtaField", item.BusinessEtaField ?? "")
                .AddInParameter("runtimeType", item.RuntimeOsClientType ?? "")
                .AddInParameter("runtimeNetwork", item.RuntimeOsClientNetwork ?? "");
            command.ExecuteNonQuery();
        }

        public static List<BackgroundTaskRecord> List(string osClient, string userKey, int take = 100)
        {
            var client = GetRequiredClient(osClient);
            take = Math.Max(1, Math.Min(500, take));
            var sql = TakeSql(client, $@"SELECT {Projection} FROM {TableName}
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p0 AND UserKey=@p1
  AND {RuntimeScopePredicate}
ORDER BY CreateTime DESC", take);
            return client.Db.FromSql(sql)
                .AddInParameter("p0", osClient)
                .AddInParameter("p1", userKey)
                .AddInParameter("runtimeType", CurrentRuntimeOsClientType())
                .AddInParameter("runtimeNetwork", CurrentRuntimeOsClientNetwork())
                .ToList<BackgroundTaskRecord>()
                .Select(Hydrate)
                .Where(item => item != null)
                .ToList();
        }

        public static BackgroundTaskRecord Get(string osClient, string taskId)
        {
            var client = GetRequiredClient(osClient);
            var sql = FirstSql(client, $@"SELECT {Projection} FROM {TableName}
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p0 AND Id=@p1
  AND {RuntimeScopePredicate}");
            return Hydrate(client.Db.FromSql(sql)
                .AddInParameter("p0", osClient)
                .AddInParameter("p1", taskId)
                .AddInParameter("runtimeType", CurrentRuntimeOsClientType())
                .AddInParameter("runtimeNetwork", CurrentRuntimeOsClientNetwork())
                .ToFirst<BackgroundTaskRecord>());
        }

        public static int ClearSucceeded(string osClient, string userKey)
        {
            var client = GetRequiredClient(osClient);
            return client.Db.FromSql($@"UPDATE {TableName} SET IsDeleted=1,
IdempotencyKey={ArchivedIdempotencySql(client)},UpdateTime=@p0
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p1 AND UserKey=@p2 AND Status='Succeeded'
  AND {RuntimeScopePredicate}")
                .AddInParameter("p0", DbTime(DateTime.Now))
                .AddInParameter("p1", osClient)
                .AddInParameter("p2", userKey)
                .AddInParameter("runtimeType", CurrentRuntimeOsClientType())
                .AddInParameter("runtimeNetwork", CurrentRuntimeOsClientNetwork())
                .ExecuteNonQuery();
        }

        public static int SoftDelete(string osClient, string userKey, string taskId)
        {
            var client = GetRequiredClient(osClient);
            return client.Db.FromSql($@"UPDATE {TableName} SET IsDeleted=1,
IdempotencyKey={ArchivedIdempotencySql(client)},UpdateTime=@p0
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p1 AND UserKey=@p2 AND Id=@p3
  AND {RuntimeScopePredicate}
  AND Status IN ('Succeeded','Failed','Canceled')")
                .AddInParameter("p0", DbTime(DateTime.Now))
                .AddInParameter("p1", osClient)
                .AddInParameter("p2", userKey)
                .AddInParameter("p3", taskId)
                .AddInParameter("runtimeType", CurrentRuntimeOsClientType())
                .AddInParameter("runtimeNetwork", CurrentRuntimeOsClientNetwork())
                .ExecuteNonQuery();
        }

        public static int RequestCancel(string osClient, string userKey, string taskId)
        {
            var client = GetRequiredClient(osClient);
            var now = DateTime.Now;
            return client.Db.FromSql($@"UPDATE {TableName}
SET CancelRequested=1,Status=CASE WHEN Status='Pending' THEN 'Canceled' ELSE Status END,
    StatusText=CASE WHEN Status='Pending' THEN '已停止' ELSE '停止中' END,
    Msg='已请求停止，正在等待当前执行点结束。',
    EndTime=CASE WHEN Status='Pending' THEN @p0 ELSE EndTime END,
    EstimatedEndTime=NULL,RemainingSeconds=NULL,EstimateConfidence='None',UpdateTime=@p0
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p1 AND UserKey=@p2 AND Id=@p3
  AND {RuntimeScopePredicate}
  AND Status NOT IN ('Succeeded','Failed','Canceled')")
                .AddInParameter("p0", DbTime(now))
                .AddInParameter("p1", osClient)
                .AddInParameter("p2", userKey)
                .AddInParameter("p3", taskId)
                .AddInParameter("runtimeType", CurrentRuntimeOsClientType())
                .AddInParameter("runtimeNetwork", CurrentRuntimeOsClientNetwork())
                .ExecuteNonQuery();
        }

        public static BackgroundTaskRecord TryClaimNext(
            string nodeId,
            string excludedApiEngineKey = null)
        {
            var tenantNames = OsClientExtend.ClientList.Keys
                .Where(name => !name.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
                .ToList();
            var configuredTenant = OsClientExtend.GetConfigOsClient();
            if (configuredTenant.DosIsNullOrWhiteSpace()) configuredTenant = OsClientDefault.OsClient;
            tenantNames.RemoveAll(name => string.Equals(name, configuredTenant, StringComparison.OrdinalIgnoreCase));
            tenantNames.Insert(0, configuredTenant);

            if (tenantNames.Count == 0) return null;
            var scanSequence = RotateTenantScanOrder(
                tenantNames,
                Interlocked.Increment(ref _tenantScanCursor) - 1);
            foreach (var osClient in scanSequence)
            {
                try
                {
                    if (!IsAvailable(osClient)) continue;
                    var item = TryClaimNext(osClient, nodeId, excludedApiEngineKey);
                    if (item != null) return item;
                }
                catch (Exception ex)
                {
                    // One legacy tenant can still be awaiting its expand migration;
                    // it must not block healthy tenants on the same worker node.
                    try
                    {
                        MicroiEngine.QueueSystemLog(
                            osClient,
                            "BackgroundTask",
                            "TenantClaimSkipped",
                            "后台任务租户扫描已跳过",
                            ex.ToString(),
                            2,
                            false,
                            nodeId);
                    }
                    catch { }
                }
            }
            return null;
        }

        public static BackgroundTaskRecord TryClaimConfiguredTenant(
            string nodeId,
            string excludedApiEngineKey = null)
        {
            var configuredTenant = OsClientExtend.GetConfigOsClient();
            if (configuredTenant.DosIsNullOrWhiteSpace()) configuredTenant = OsClientDefault.OsClient;
            if (configuredTenant.DosIsNullOrWhiteSpace() || !IsAvailable(configuredTenant)) return null;
            return TryClaimNext(configuredTenant, nodeId, excludedApiEngineKey);
        }

        internal static IReadOnlyList<string> RotateTenantScanOrder(
            IReadOnlyList<string> tenantNames,
            long cursor)
        {
            if (tenantNames == null || tenantNames.Count == 0)
            {
                return Array.Empty<string>();
            }

            var start = (int)(unchecked((ulong)cursor) % (ulong)tenantNames.Count);
            var result = new List<string>(tenantNames.Count);
            for (var offset = 0; offset < tenantNames.Count; offset++)
            {
                result.Add(tenantNames[(start + offset) % tenantNames.Count]);
            }
            return result;
        }

        private static BackgroundTaskRecord TryClaimNext(
            string osClient,
            string nodeId,
            string excludedApiEngineKey)
        {
            var client = GetRequiredClient(osClient);
            var now = DateTime.Now;
            var runtimeType = CurrentRuntimeOsClientType();
            var runtimeNetwork = CurrentRuntimeOsClientNetwork();
            // A stale execution can be reclaimed just before its still-running
            // predecessor releases the distributed concurrency lease. The claim is
            // then deferred before user code starts, so it must not consume the last
            // recovery attempt and leave a resumable chunk permanently Pending.
            client.Db.FromSql($@"UPDATE {TableName}
SET AttemptCount=CASE WHEN MaxAttempts>0 THEN MaxAttempts-1 ELSE 0 END,UpdateTime=@p0
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p1
  AND {RuntimeScopePredicate}
  AND Status='Pending' AND (LeaseOwner IS NULL OR LeaseOwner='')
  AND AttemptCount>=MaxAttempts
  AND Msg='等待同一并发组的上一项任务完成'")
                .AddInParameter("p0", DbTime(now))
                .AddInParameter("p1", osClient)
                .AddInParameter("runtimeType", runtimeType)
                .AddInParameter("runtimeNetwork", runtimeNetwork)
                .ExecuteNonQuery();
            // Legacy rows and interrupted workers could leave exhausted work in an
            // active state forever. Finalize only ownerless work (or Running work
            // whose lease has expired), preserving a live owner's execution.
            client.Db.FromSql($@"UPDATE {TableName}
SET Status='Failed',StatusText='执行失败',
    Msg='任务已耗尽重试次数，系统已自动终结；请查看错误与日志，修复原因后重新提交。',
    LastError=CASE WHEN LastError IS NULL OR LastError='' THEN '任务已耗尽重试次数。' ELSE LastError END,
    EndTime=@p0,EstimatedEndTime=NULL,RemainingSeconds=NULL,EstimateConfidence='None',
    LeaseOwner='',LeaseExpiresAt=NULL,UpdateTime=@p0
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p1 AND CancelRequested=0
  AND {RuntimeScopePredicate}
  AND (MaxAttempts IS NULL OR MaxAttempts<=0 OR AttemptCount>=MaxAttempts)
  AND (Status IN ('Pending','Retrying')
       OR (Status='Running' AND (LeaseExpiresAt IS NULL OR LeaseExpiresAt<@p0)))")
                .AddInParameter("p0", DbTime(now))
                .AddInParameter("p1", osClient)
                .AddInParameter("runtimeType", runtimeType)
                .AddInParameter("runtimeNetwork", runtimeNetwork)
                .ExecuteNonQuery();
            // Heal cancellation races and cancellations whose owning node died.
            // A running task is finalized only after its lease expires; pending or
            // retrying work has no active owner and can be finalized immediately.
            client.Db.FromSql($@"UPDATE {TableName}
SET Status='Canceled',StatusText='已停止',
    Msg='任务已停止；失败或取消不会伪装成 100%。',EndTime=@p0,
    EstimatedEndTime=NULL,RemainingSeconds=NULL,EstimateConfidence='None',
    LeaseOwner='',LeaseExpiresAt=NULL,UpdateTime=@p0
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p1 AND CancelRequested=1
  AND {RuntimeScopePredicate}
  AND (Status IN ('Pending','Retrying')
       OR (Status='Running' AND (LeaseExpiresAt IS NULL OR LeaseExpiresAt<@p0)))")
                .AddInParameter("p0", DbTime(now))
                .AddInParameter("p1", osClient)
                .AddInParameter("runtimeType", runtimeType)
                .AddInParameter("runtimeNetwork", runtimeNetwork)
                .ExecuteNonQuery();
            var excludedPredicate = excludedApiEngineKey.DosIsNullOrWhiteSpace()
                ? ""
                : " AND (ApiEngineKey IS NULL OR ApiEngineKey<>@excludedApiEngineKey)";
            var candidateSql = FirstSql(client, $@"SELECT {Projection} FROM {TableName}
WHERE (IsDeleted=0 OR IsDeleted IS NULL) AND OsClient=@p0 AND CancelRequested=0
  AND {RuntimeScopePredicate}
  {excludedPredicate}
  AND AttemptCount < MaxAttempts
  AND (NextRunTime IS NULL OR NextRunTime<=@p1)
  AND (Status IN ('Pending','Retrying') OR (Status='Running' AND (LeaseExpiresAt IS NULL OR LeaseExpiresAt<@p1)))
ORDER BY CreateTime ASC");
            var candidateCommand = client.Db.FromSql(candidateSql)
                .AddInParameter("p0", osClient)
                .AddInParameter("p1", DbTime(now))
                .AddInParameter("runtimeType", runtimeType)
                .AddInParameter("runtimeNetwork", runtimeNetwork);
            if (!excludedApiEngineKey.DosIsNullOrWhiteSpace())
            {
                candidateCommand = candidateCommand.AddInParameter(
                    "excludedApiEngineKey",
                    excludedApiEngineKey);
            }
            var candidate = Hydrate(candidateCommand.ToFirst<BackgroundTaskRecord>());
            if (candidate == null) return null;

            var owner = nodeId + ":" + Guid.NewGuid().ToString("N");
            var staleRecovery = string.Equals(candidate.Status, "Running", StringComparison.OrdinalIgnoreCase);
            var leaseSeconds = ResolveLeaseSeconds(candidate.ApiEngineKey);
            var leaseExpiresAt = now.AddSeconds(leaseSeconds);
            var affected = client.Db.FromSql($@"UPDATE {TableName}
SET Status='Running',StatusText='执行中',LeaseOwner=@p0,LeaseExpiresAt=@p1,HeartbeatTime=@p2,
    StartTime=CASE WHEN StartTime IS NULL THEN @p2 ELSE StartTime END,
    RuntimeOsClientType=CASE WHEN RuntimeOsClientType IS NULL OR RuntimeOsClientType='' THEN @runtimeType ELSE RuntimeOsClientType END,
    RuntimeOsClientNetwork=CASE WHEN RuntimeOsClientNetwork IS NULL OR RuntimeOsClientNetwork='' THEN @runtimeNetwork ELSE RuntimeOsClientNetwork END,
    FencingToken=FencingToken+1,ExecutionCount=ExecutionCount+1,
    AttemptCount=AttemptCount+@p3,UpdateTime=@p2
WHERE Id=@p4 AND OsClient=@p5 AND CancelRequested=0 AND AttemptCount<MaxAttempts
  AND {RuntimeScopePredicate}
  AND (Status IN ('Pending','Retrying') OR (Status='Running' AND (LeaseExpiresAt IS NULL OR LeaseExpiresAt<@p2)))")
                .AddInParameter("p0", owner)
                .AddInParameter("p1", DbTime(leaseExpiresAt))
                .AddInParameter("p2", DbTime(now))
                .AddInParameter("p3", staleRecovery ? 1 : 0)
                .AddInParameter("p4", candidate.Id)
                .AddInParameter("p5", osClient)
                .AddInParameter("runtimeType", runtimeType)
                .AddInParameter("runtimeNetwork", runtimeNetwork)
                .ExecuteNonQuery();
            return affected == 1 ? Get(osClient, candidate.Id) : null;
        }

        public static bool RenewLease(BackgroundTaskRecord item, out bool cancelRequested)
        {
            cancelRequested = false;
            var client = GetRequiredClient(item.OsClient);
            var now = DateTime.Now;
            var leaseSeconds = ResolveLeaseSeconds(item.ApiEngineKey);
            var leaseExpiresAt = now.AddSeconds(leaseSeconds);
            var affected = client.Db.FromSql($@"UPDATE {TableName}
SET LeaseExpiresAt=@p0,HeartbeatTime=@p1,UpdateTime=@p1
WHERE Id=@p2 AND OsClient=@p3 AND Status='Running' AND LeaseOwner=@p4 AND FencingToken=@p5")
                .AddInParameter("p0", DbTime(leaseExpiresAt))
                .AddInParameter("p1", DbTime(now))
                .AddInParameter("p2", item.Id)
                .AddInParameter("p3", item.OsClient)
                .AddInParameter("p4", item.LeaseOwner)
                .AddInParameter("p5", item.FencingToken)
                .ExecuteNonQuery();
            if (affected != 1) return false;
            item.HeartbeatTime = now;
            item.LeaseExpiresAt = leaseExpiresAt;
            cancelRequested = client.Db.FromSql($@"SELECT CancelRequested FROM {TableName}
WHERE Id=@p0 AND OsClient=@p1")
                .AddInParameter("p0", item.Id)
                .AddInParameter("p1", item.OsClient)
                .ToScalar<int>() == 1;
            return true;
        }

        internal static int ResolveLeaseSeconds(string apiEngineKey)
        {
            return string.Equals(
                apiEngineKey,
                EmptyDatabaseReleaseApiEngineKey,
                StringComparison.OrdinalIgnoreCase)
                ? EmptyDatabaseReleaseLeaseSeconds
                : DefaultLeaseSeconds;
        }

        internal static bool IsLeaseCurrent(
            string osClient,
            string taskId,
            string leaseOwner,
            long fencingToken)
        {
            try
            {
                var client = GetClient(osClient);
                if (client?.Db == null
                    || taskId.DosIsNullOrWhiteSpace()
                    || leaseOwner.DosIsNullOrWhiteSpace()) return false;
                return client.Db.FromSql($@"SELECT COUNT(1) FROM {TableName}
WHERE Id=@p0 AND OsClient=@p1 AND Status='Running' AND CancelRequested=0
  AND LeaseOwner=@p2 AND FencingToken=@p3 AND LeaseExpiresAt>@p4")
                    .AddInParameter("p0", taskId)
                    .AddInParameter("p1", osClient)
                    .AddInParameter("p2", leaseOwner)
                    .AddInParameter("p3", fencingToken)
                    .AddInParameter("p4", DbTime(DateTime.Now))
                    .ToScalar<int>() == 1;
            }
            catch
            {
                return false;
            }
        }

        public static bool UpdateProgress(BackgroundTaskRecord item)
        {
            var client = GetRequiredClient(item.OsClient);
            var now = DateTime.Now;
            var affected = client.Db.FromSql($@"UPDATE {TableName}
SET Progress=@p0,ProgressMode=@p1,WorkCurrent=@p2,WorkTotal=@p3,Msg=@p4,StatusText=@p5,
    HeartbeatTime=@p6,EstimatedEndTime=@p7,RemainingSeconds=@p8,EstimateConfidence=@p9,
    ProgressSampleTime=@p10,ProgressSampleCurrent=@p11,ThroughputPerSecond=@p12,
    ProgressSampleCount=@p13,UpdateTime=@p6
WHERE Id=@p14 AND OsClient=@p15 AND Status='Running' AND LeaseOwner=@p16 AND FencingToken=@p17")
                .AddInParameter("p0", item.Progress)
                .AddInParameter("p1", item.ProgressMode)
                .AddInParameter("p2", item.Current)
                .AddInParameter("p3", item.Total)
                .AddInParameter("p4", item.Msg ?? "")
                .AddInParameter("p5", item.StatusText ?? "执行中")
                .AddInParameter("p6", DbTime(now))
                .AddInParameter("p7", DbTime(item.EstimatedEndTime))
                .AddInParameter("p8", (object)item.RemainingSeconds ?? DBNull.Value)
                .AddInParameter("p9", item.EstimateConfidence ?? "None")
                .AddInParameter("p10", DbTime(item.ProgressSampleTime))
                .AddInParameter("p11", item.ProgressSampleCurrent)
                .AddInParameter("p12", (object)item.ThroughputPerSecond ?? DBNull.Value)
                .AddInParameter("p13", item.ProgressSampleCount)
                .AddInParameter("p14", item.Id)
                .AddInParameter("p15", item.OsClient)
                .AddInParameter("p16", item.LeaseOwner)
                .AddInParameter("p17", item.FencingToken)
                .ExecuteNonQuery();
            return affected == 1;
        }

        public static bool UpdateLog(BackgroundTaskRecord item)
        {
            return OwnedUpdate(item, "Log=@p0,HeartbeatTime=@p1,UpdateTime=@p1", command => command
                .AddInParameter("p0", item.Log ?? "")
                .AddInParameter("p1", DbTime(DateTime.Now)));
        }

        public static bool Complete(BackgroundTaskRecord item, string status, string statusText, JObject result, string message)
        {
            var succeeded = string.Equals(status, "Succeeded", StringComparison.OrdinalIgnoreCase);
            var now = DateTime.Now;
            item.Status = status;
            item.StatusText = statusText;
            item.Msg = message ?? "";
            item.Result = result ?? new JObject();
            item.ResultJson = item.Result.ToString(Newtonsoft.Json.Formatting.None);
            item.EndTime = now;
            item.EstimatedEndTime = null;
            item.RemainingSeconds = null;
            item.EstimateConfidence = "None";
            if (succeeded)
            {
                item.Progress = 100;
                item.ProgressMode = "Completed";
                if (item.Total > 0) item.Current = item.Total;
            }
            return OwnedUpdate(item, @"Status=@p0,StatusText=@p1,Progress=@p2,ProgressMode=@p3,
WorkCurrent=@p4,WorkTotal=@p5,Msg=@p6,ResultJson=@p7,EndTime=@p8,EstimatedEndTime=NULL,
RemainingSeconds=NULL,EstimateConfidence='None',LeaseOwner='',LeaseExpiresAt=NULL,HeartbeatTime=@p8,UpdateTime=@p8",
                command => command
                    .AddInParameter("p0", status)
                    .AddInParameter("p1", statusText)
                    .AddInParameter("p2", item.Progress)
                    .AddInParameter("p3", item.ProgressMode)
                    .AddInParameter("p4", item.Current)
                    .AddInParameter("p5", item.Total)
                    .AddInParameter("p6", item.Msg)
                    .AddInParameter("p7", item.ResultJson)
                    .AddInParameter("p8", DbTime(now)));
        }

        public static bool RequeueChunk(
            BackgroundTaskRecord item,
            JObject nextParam,
            JToken checkpoint,
            int delaySeconds,
            string message)
        {
            item.ParamJson = (nextParam ?? new JObject()).ToString(Newtonsoft.Json.Formatting.None);
            item.CheckpointJson = checkpoint == null
                ? ""
                : checkpoint.ToString(Newtonsoft.Json.Formatting.None);
            item.Msg = message ?? item.Msg ?? "等待下一批";
            // Give the current execution's finally block time to release its
            // cross-node concurrency lease before another node claims the next chunk.
            var nextRun = DateTime.Now.AddSeconds(Math.Max(1, Math.Min(3600, delaySeconds)));
            item.Status = item.CancelRequested ? "Canceled" : "Pending";
            item.StatusText = item.CancelRequested ? "已停止" : "等待下一批";
            item.NextRunTime = item.CancelRequested ? (DateTime?)null : nextRun;
            return OwnedUpdate(item, @"Status=CASE WHEN CancelRequested=1 THEN 'Canceled' ELSE 'Pending' END,
StatusText=CASE WHEN CancelRequested=1 THEN '已停止' ELSE '等待下一批' END,
Msg=CASE WHEN CancelRequested=1 THEN '任务已停止；失败或取消不会伪装成 100%。' ELSE @p0 END,
ParamJson=@p1,CheckpointJson=@p2,
NextRunTime=CASE WHEN CancelRequested=1 THEN NULL ELSE @p3 END,
EndTime=CASE WHEN CancelRequested=1 THEN @p4 ELSE EndTime END,
EstimatedEndTime=CASE WHEN CancelRequested=1 THEN NULL ELSE EstimatedEndTime END,
RemainingSeconds=CASE WHEN CancelRequested=1 THEN NULL ELSE RemainingSeconds END,
EstimateConfidence=CASE WHEN CancelRequested=1 THEN 'None' ELSE EstimateConfidence END,
LeaseOwner='',LeaseExpiresAt=NULL,UpdateTime=@p4",
                command => command
                    .AddInParameter("p0", item.Msg)
                    .AddInParameter("p1", item.ParamJson)
                    .AddInParameter("p2", item.CheckpointJson)
                    .AddInParameter("p3", DbTime(nextRun))
                    .AddInParameter("p4", DbTime(DateTime.Now)));
        }

        public static bool ReleaseToPending(
            BackgroundTaskRecord item,
            string message,
            int delaySeconds)
        {
            var nextRun = DateTime.Now.AddSeconds(Math.Max(1, Math.Min(300, delaySeconds)));
            item.Status = item.CancelRequested ? "Canceled" : "Pending";
            item.StatusText = item.CancelRequested ? "已停止" : "排队中";
            item.Msg = item.CancelRequested
                ? "任务已停止；失败或取消不会伪装成 100%。"
                : message ?? "等待执行";
            item.NextRunTime = item.CancelRequested ? (DateTime?)null : nextRun;
            if (!item.CancelRequested && item.AttemptCount >= item.MaxAttempts)
            {
                item.AttemptCount = Math.Max(0, item.MaxAttempts - 1);
            }
            return OwnedUpdate(item, @"Status=CASE WHEN CancelRequested=1 THEN 'Canceled' ELSE 'Pending' END,
StatusText=CASE WHEN CancelRequested=1 THEN '已停止' ELSE '排队中' END,
Msg=CASE WHEN CancelRequested=1 THEN '任务已停止；失败或取消不会伪装成 100%。' ELSE @p0 END,
NextRunTime=CASE WHEN CancelRequested=1 THEN NULL ELSE @p1 END,
EndTime=CASE WHEN CancelRequested=1 THEN @p2 ELSE EndTime END,
EstimatedEndTime=CASE WHEN CancelRequested=1 THEN NULL ELSE EstimatedEndTime END,
RemainingSeconds=CASE WHEN CancelRequested=1 THEN NULL ELSE RemainingSeconds END,
EstimateConfidence=CASE WHEN CancelRequested=1 THEN 'None' ELSE EstimateConfidence END,
AttemptCount=CASE
  WHEN CancelRequested=0 AND AttemptCount>=MaxAttempts
    THEN CASE WHEN MaxAttempts>0 THEN MaxAttempts-1 ELSE 0 END
  ELSE AttemptCount
END,
LeaseOwner='',LeaseExpiresAt=NULL,UpdateTime=@p2",
                command => command
                    .AddInParameter("p0", message ?? "等待执行")
                    .AddInParameter("p1", DbTime(nextRun))
                    .AddInParameter("p2", DbTime(DateTime.Now)));
        }

        public static bool RetryOrFail(BackgroundTaskRecord item, Exception error, bool hostStopping)
        {
            var now = DateTime.Now;
            var safeError = SafeError(error);
            var nextAttempt = item.AttemptCount + 1;
            if (!hostStopping && nextAttempt >= item.MaxAttempts)
            {
                item.AttemptCount = nextAttempt;
                item.LastError = safeError;
                item.Status = "Failed";
                item.StatusText = "执行失败";
                item.Msg = safeError;
                item.EndTime = now;
                return OwnedUpdate(item, @"Status='Failed',StatusText='执行失败',Msg=@p0,LastError=@p0,
AttemptCount=@p1,EndTime=@p2,EstimatedEndTime=NULL,RemainingSeconds=NULL,EstimateConfidence='None',
LeaseOwner='',LeaseExpiresAt=NULL,UpdateTime=@p2",
                    command => command
                        .AddInParameter("p0", safeError)
                        .AddInParameter("p1", nextAttempt)
                        .AddInParameter("p2", DbTime(now)));
            }

            item.AttemptCount = nextAttempt;
            item.LastError = safeError;
            var statusText = hostStopping ? "节点停止，等待恢复" : "等待重试";
            var nextRun = now.AddSeconds(hostStopping ? 5 : Math.Min(300, 5 * (1 << Math.Min(6, nextAttempt - 1))));
            item.Status = "Retrying";
            item.StatusText = statusText;
            item.Msg = safeError;
            item.NextRunTime = nextRun;
            return OwnedUpdate(item, @"Status='Retrying',StatusText=@p0,Msg=@p1,LastError=@p1,
AttemptCount=@p2,NextRunTime=@p3,EstimatedEndTime=NULL,RemainingSeconds=NULL,EstimateConfidence='None',
LeaseOwner='',LeaseExpiresAt=NULL,UpdateTime=@p4",
                command => command
                    .AddInParameter("p0", statusText)
                    .AddInParameter("p1", safeError)
                    .AddInParameter("p2", nextAttempt)
                    .AddInParameter("p3", DbTime(nextRun))
                    .AddInParameter("p4", DbTime(now)));
        }

        private static bool OwnedUpdate(
            BackgroundTaskRecord item,
            string setSql,
            Func<SqlSection, SqlSection> addParameters)
        {
            var client = GetRequiredClient(item.OsClient);
            var command = client.Db.FromSql($@"UPDATE {TableName} SET {setSql}
WHERE Id=@ownerId AND OsClient=@ownerOsClient AND Status='Running'
  AND LeaseOwner=@ownerLease AND FencingToken=@ownerFence");
            command = addParameters(command)
                .AddInParameter("ownerId", item.Id)
                .AddInParameter("ownerOsClient", item.OsClient)
                .AddInParameter("ownerLease", item.LeaseOwner)
                .AddInParameter("ownerFence", item.FencingToken);
            return command.ExecuteNonQuery() == 1;
        }

        private static BackgroundTaskRecord Hydrate(BackgroundTaskRecord item)
        {
            if (item == null) return null;
            item.ProgressMode = item.ProgressMode.DosIsNullOrWhiteSpace() ? "Indeterminate" : item.ProgressMode;
            item.StatusText = item.StatusText ?? "";
            item.Msg = item.Msg ?? "";
            item.Log = item.Log ?? "";
            item.Result = ParseObject(item.ResultJson);
            return item;
        }

        private static JObject ParseObject(string json)
        {
            if (json.DosIsNullOrWhiteSpace()) return new JObject();
            try { return JObject.Parse(json); }
            catch { return JObject.FromObject(new { Code = 0, Msg = "任务结果不是有效 JSON。" }); }
        }

        private static OsClientSecret GetClient(string osClient)
        {
            try { return OsClientExtend.GetClient(osClient); }
            catch { return null; }
        }

        private static OsClientSecret GetRequiredClient(string osClient)
        {
            var client = GetClient(osClient);
            if (client?.Db == null) throw new InvalidOperationException($"租户 {osClient} 的数据库连接不可用。");
            if (!ValidateSchema(client, out var reason))
                throw new InvalidOperationException($"租户 {osClient} 的后台任务表尚未就绪：{reason}。");
            return client;
        }

        private static bool ValidateSchema(OsClientSecret client, out string reason)
        {
            reason = "";
            try
            {
                if (client?.Db?.TableExists(TableName) != true)
                {
                    reason = $"物理表 {TableName} 不存在";
                    return false;
                }

                // WHERE 1=0 never reads business rows, but the database must still
                // resolve every runtime column and alias used by the worker.
                client.Db.FromSql($"SELECT {Projection} FROM {TableName} WHERE 1=0").ToArray();
                return true;
            }
            catch (Exception ex)
            {
                reason = SafeSchemaError(ex);
                return false;
            }
        }

        private static string SafeSchemaError(Exception error)
        {
            var text = error?.GetBaseException()?.Message ?? error?.Message ?? "物理字段校验失败";
            text = text.Replace("\r", " ").Replace("\n", " ").Trim();
            return text.Length <= 500 ? text : text.Substring(0, 500);
        }

        private static string FirstSql(OsClientSecret client, string sql)
        {
            return TakeSql(client, sql, 1);
        }

        private static string ArchivedIdempotencySql(OsClientSecret client)
        {
            var dbType = client.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            if (string.Equals(dbType, "Oracle", StringComparison.OrdinalIgnoreCase))
                return "('deleted:' || Id)";
            return "CONCAT('deleted:', Id)";
        }

        private static string TakeSql(OsClientSecret client, string sql, int take)
        {
            var dbType = client.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            if (string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase))
            {
                return sql.Replace("SELECT ", $"SELECT TOP {take} ");
            }
            if (string.Equals(dbType, "Oracle", StringComparison.OrdinalIgnoreCase))
            {
                return sql + $" FETCH FIRST {take} ROWS ONLY";
            }
            return sql + $" LIMIT {take}";
        }

        private static string SafeError(Exception error)
        {
            var text = error?.Message ?? "后台任务执行异常。";
            text = text.Replace("\r", " ").Replace("\n", " ").Trim();
            return text.Length <= 2000 ? text : text.Substring(0, 2000);
        }

        internal static string CurrentRuntimeOsClientType()
        {
            return NormalizeRuntimeScopeValue(OsClientDefault.OsClientType);
        }

        internal static string CurrentRuntimeOsClientNetwork()
        {
            return NormalizeRuntimeScopeValue(OsClientDefault.OsClientNetwork);
        }

        internal static string NormalizeRuntimeScopeValue(string value)
        {
            var normalized = (value ?? "").Trim();
            return normalized.Length <= 50 ? normalized : normalized.Substring(0, 50);
        }

        private static string DbTime(DateTime value)
        {
            return value.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
        }

        private static object DbTime(DateTime? value)
        {
            return value.HasValue ? (object)DbTime(value.Value) : DBNull.Value;
        }
    }
}
