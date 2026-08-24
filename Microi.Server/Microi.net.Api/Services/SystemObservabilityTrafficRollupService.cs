using Microi.net;
using Dos.ORM;

namespace Microi.net.Api;

/// <summary>
/// 将内存网络流量指标按固定 5 分钟桶批量幂等写入 MySQL。
/// 请求明细不进入 MySQL；大流量/可疑明细由现有 SysLogQueueService 异步批量写 MongoDB。
/// </summary>
public sealed class SystemObservabilityTrafficRollupService : BackgroundService
{
    private const int BucketMinutes = 5;
    private const int TopPerDimension = 10;
    private readonly ILogger<SystemObservabilityTrafficRollupService> _logger;
    private readonly SortedSet<DateTime> _pendingBuckets = new();
    private DateTime _lastScheduledMinuteUtc = DateTime.MinValue;
    private DateTime _lastWarningUtc = DateTime.MinValue;

    public SystemObservabilityTrafficRollupService(
        ILogger<SystemObservabilityTrafficRollupService> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                NetworkTrafficObservabilityService.SampleNetworkInterfaces();
                var nowUtc = DateTime.UtcNow;
                var minuteUtc = new DateTime(
                    nowUtc.Year,
                    nowUtc.Month,
                    nowUtc.Day,
                    nowUtc.Hour,
                    nowUtc.Minute,
                    0,
                    DateTimeKind.Utc);
                if (minuteUtc != _lastScheduledMinuteUtc)
                {
                    _lastScheduledMinuteUtc = minuteUtc;
                    var currentBucket = FloorBucket(minuteUtc);
                    _pendingBuckets.Add(currentBucket);
                    if (minuteUtc == currentBucket) _pendingBuckets.Add(currentBucket.AddMinutes(-BucketMinutes));
                    while (_pendingBuckets.Count > 4) _pendingBuckets.Remove(_pendingBuckets.Min);
                    await FlushPendingAsync(stoppingToken).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                WarnRateLimited(ex, "网络流量汇总后台任务执行失败");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        try
        {
            _pendingBuckets.Add(FloorBucket(DateTime.UtcNow));
            await FlushPendingAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            WarnRateLimited(ex, "停机前网络流量汇总刷新失败");
        }
        await base.StopAsync(cancellationToken).ConfigureAwait(false);
    }

    private Task FlushPendingAsync(CancellationToken cancellationToken)
    {
        foreach (var bucketStartUtc in _pendingBuckets.ToArray())
        {
            cancellationToken.ThrowIfCancellationRequested();
            var rows = NetworkTrafficObservabilityService.BuildRollupRows(
                bucketStartUtc,
                BucketMinutes,
                TopPerDimension);
            if (rows.Count == 0)
            {
                if (bucketStartUtc < FloorBucket(DateTime.UtcNow)) _pendingBuckets.Remove(bucketStartUtc);
                continue;
            }

            WriteRows(rows);
            _pendingBuckets.Remove(bucketStartUtc);
        }
        return Task.CompletedTask;
    }

    private static void WriteRows(IReadOnlyList<NetworkTrafficRollupRow> rows)
    {
        var db = OsClient.GetClient(OsClientDefault.OsClient).Db;
        var trans = db.BeginTransaction();
        try
        {
            var now = DateTime.Now;
            foreach (var row in rows)
            {
                var updated = ExecuteRollupCommand(trans, UpdateSql, row, now, false);
                if (updated == 0) ExecuteRollupCommand(trans, InsertSql, row, now, true);
            }
            trans.Commit();
        }
        catch
        {
            try { trans.Rollback(); } catch { }
            throw;
        }
        finally
        {
            try { trans.Close(); } catch { }
        }
    }

    private static int ExecuteRollupCommand(
        DbTrans trans,
        string sql,
        NetworkTrafficRollupRow row,
        DateTime now,
        bool insert)
    {
        var command = trans.FromSql(sql);
        command.AddInParameter("Id", row.Id);
        command.AddInParameter("BucketStartUtc", row.BucketStartUtc.ToString("yyyy-MM-dd HH:mm:ss"));
        command.AddInParameter("BucketMinutes", row.BucketMinutes);
        command.AddInParameter("NodeId", row.NodeId);
        command.AddInParameter("ObservedOsClient", row.ObservedOsClient);
        command.AddInParameter("DimensionType", row.DimensionType);
        command.AddInParameter("DimensionKey", row.DimensionKey);
        command.AddInParameter("DimensionKeyHash", row.DimensionKeyHash);
        command.AddInParameter("RequestCount", row.RequestCount);
        command.AddInParameter("ErrorCount", row.ErrorCount);
        command.AddInParameter("SlowCount", row.SlowCount);
        command.AddInParameter("ReceivedBytes", row.ReceivedBytes);
        command.AddInParameter("SentBytes", row.SentBytes);
        command.AddInParameter("TotalBytes", row.TotalBytes);
        command.AddInParameter("DurationMs", row.DurationMs);
        command.AddInParameter("MaxDurationMs", row.MaxDurationMs);
        command.AddInParameter("AnonymousCount", row.AnonymousCount);
        command.AddInParameter("UploadCount", row.UploadCount);
        command.AddInParameter("DownloadCount", row.DownloadCount);
        command.AddInParameter("SuspiciousCount", row.SuspiciousCount);
        command.AddInParameter("RiskLevel", row.RiskLevel);
        command.AddInParameter("LastSeenAtUtc", row.LastSeenAtUtc.ToString("yyyy-MM-dd HH:mm:ss"));
        command.AddInParameter("UpdateTime", now);
        if (insert)
        {
            command.AddInParameter("CreateTime", now);
            command.AddInParameter("IsDeleted", 0);
        }
        return command.ExecuteNonQuery();
    }

    private const string UpdateSql = @"UPDATE mci_network_traffic_rollup SET
BucketStartUtc=@BucketStartUtc, BucketMinutes=@BucketMinutes, NodeId=@NodeId,
ObservedOsClient=@ObservedOsClient, DimensionType=@DimensionType, DimensionKey=@DimensionKey,
DimensionKeyHash=@DimensionKeyHash, RequestCount=@RequestCount, ErrorCount=@ErrorCount,
SlowCount=@SlowCount, ReceivedBytes=@ReceivedBytes, SentBytes=@SentBytes, TotalBytes=@TotalBytes,
DurationMs=@DurationMs, MaxDurationMs=@MaxDurationMs, AnonymousCount=@AnonymousCount,
UploadCount=@UploadCount, DownloadCount=@DownloadCount, SuspiciousCount=@SuspiciousCount,
RiskLevel=@RiskLevel, LastSeenAtUtc=@LastSeenAtUtc, UpdateTime=@UpdateTime, IsDeleted=0
WHERE Id=@Id";

    private const string InsertSql = @"INSERT INTO mci_network_traffic_rollup
(Id, CreateTime, UpdateTime, IsDeleted, BucketStartUtc, BucketMinutes, NodeId, ObservedOsClient,
DimensionType, DimensionKey, DimensionKeyHash, RequestCount, ErrorCount, SlowCount, ReceivedBytes,
SentBytes, TotalBytes, DurationMs, MaxDurationMs, AnonymousCount, UploadCount, DownloadCount,
SuspiciousCount, RiskLevel, LastSeenAtUtc)
VALUES
(@Id, @CreateTime, @UpdateTime, @IsDeleted, @BucketStartUtc, @BucketMinutes, @NodeId, @ObservedOsClient,
@DimensionType, @DimensionKey, @DimensionKeyHash, @RequestCount, @ErrorCount, @SlowCount, @ReceivedBytes,
@SentBytes, @TotalBytes, @DurationMs, @MaxDurationMs, @AnonymousCount, @UploadCount, @DownloadCount,
@SuspiciousCount, @RiskLevel, @LastSeenAtUtc)";

    private static DateTime FloorBucket(DateTime valueUtc)
    {
        valueUtc = valueUtc.ToUniversalTime();
        var minute = valueUtc.Minute - valueUtc.Minute % BucketMinutes;
        return new DateTime(
            valueUtc.Year,
            valueUtc.Month,
            valueUtc.Day,
            valueUtc.Hour,
            minute,
            0,
            DateTimeKind.Utc);
    }

    private void WarnRateLimited(Exception exception, string message)
    {
        var nowUtc = DateTime.UtcNow;
        if (nowUtc - _lastWarningUtc < TimeSpan.FromMinutes(10)) return;
        _lastWarningUtc = nowUtc;
        if (exception == null) _logger.LogWarning("{Message}", message);
        else _logger.LogWarning(exception, "{Message}", message);
        try
        {
            MicroiEngine.QueueSystemLog(
                OsClientDefault.OsClient,
                "NetworkTraffic",
                "RollupWriteFailed",
                message,
                exception?.ToString() ?? message,
                2);
        }
        catch { }
    }
}
