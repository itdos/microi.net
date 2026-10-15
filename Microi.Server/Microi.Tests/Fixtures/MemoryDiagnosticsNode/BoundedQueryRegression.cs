using System.Diagnostics;
using Dos.ORM;

/// <summary>对本任务专属 MySQL 端口执行只读查询，比较旧的全量物化与有界物化。</summary>
internal static class BoundedQueryRegression
{
    public static void Run()
    {
        var connectionString = Environment.GetEnvironmentVariable("MICROI_MEMORY_TEST_CONN")
            ?? Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_MYSQL");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("MICROI_MEMORY_TEST_CONN or MICROI_TEST_SCHEDULE_MYSQL must point to a dedicated test MySQL database.");
        var db = new DbSession(DatabaseType.MySql, connectionString);
        // 8+ 保留原 CTE；5.7 使用同一数字集合的派生表，不把兼容分支误报为 CTE 实测。
        var serverVersion = Convert.ToString(db.FromSql("SELECT VERSION()").ToScalar())?.Trim() ?? string.Empty;
        var versionMatch = System.Text.RegularExpressions.Regex.Match(serverVersion,
            @"^(?<version>[0-9]+\.[0-9]+\.[0-9]+)(?:[-+][0-9A-Za-z._+-]+)?$",
            System.Text.RegularExpressions.RegexOptions.CultureInvariant);
        if (!versionMatch.Success || !Version.TryParse(versionMatch.Groups["version"].Value, out var parsedVersion))
            throw new InvalidOperationException("Cannot parse the actual MySQL server version for the ordered query fixture.");
        var orderedCte = parsedVersion.Major >= 8;
        if (!orderedCte && (parsedVersion.Major != 5 || parsedVersion.Minor != 7))
            throw new InvalidOperationException("Unsupported MySQL server version for the ordered query fixture: " + serverVersion);
        const string cteSql = """
            WITH digits AS (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9),
            numbered AS (SELECT a.n+10*b.n+100*c.n+1000*d.n+10000*e.n AS RowNo FROM digits a CROSS JOIN digits b CROSS JOIN digits c CROSS JOIN digits d CROSS JOIN digits e)
            SELECT RowNo, REPEAT('x',1024) AS Payload FROM numbered WHERE RowNo < 20000 ORDER BY RowNo DESC
            """;
        const string derivedSql = """
            SELECT RowNo, REPEAT('x',1024) AS Payload FROM (
                SELECT a.n+10*b.n+100*c.n+1000*d.n+10000*e.n AS RowNo
                FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
                CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
                CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
                CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d
                CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) e
            ) numbered WHERE RowNo < 20000 ORDER BY RowNo DESC
            """;
        var sql = orderedCte ? cteSql : derivedSql;
        // 先初始化连接和实体映射缓存，再衡量对象分配，避免将 JIT/首次连接归入查询差异。
        db.FromSql("SELECT 1 AS RowNo, 'x' AS Payload").ToBoundedList<dynamic>(1);
        var timer = Stopwatch.StartNew();
        var before = GC.GetAllocatedBytesForCurrentThread();
        var bounded = db.FromSql(sql).ToBoundedList<dynamic>(1001);
        var boundedBytes = GC.GetAllocatedBytesForCurrentThread() - before;
        var boundedMs = timer.ElapsedMilliseconds;
        if (bounded.Count != 1001 || Convert.ToInt32(bounded[0].RowNo) != 19999 || Convert.ToInt32(bounded[^1].RowNo) != 18999)
            throw new InvalidOperationException("Bounded query changed result order or row limit.");
        // 只有一个池连接，后续查询成功即证明提前停止读取后连接已经释放可复用。
        if (Convert.ToInt32(db.FromSql("SELECT 1").ToScalar()) != 1) throw new InvalidOperationException("Reader not released.");
        timer.Restart(); before = GC.GetAllocatedBytesForCurrentThread();
        var full = db.FromSql(sql).ToList<dynamic>();
        var fullBytes = GC.GetAllocatedBytesForCurrentThread() - before;
        if (full.Count != 20000 || boundedBytes >= fullBytes / 4)
            throw new InvalidOperationException("Bounded materialization did not materially reduce managed allocation.");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {
            Passed = true, Rows = full.Count, BoundedRows = bounded.Count, BoundedBytes = boundedBytes,
            FullBytes = fullBytes, ReductionPercent = 100.0 * (1.0 - (double)boundedBytes / fullBytes),
            BoundedMs = boundedMs, FullMs = timer.ElapsedMilliseconds, OrderedCte = orderedCte, OrderedDerivedTable = !orderedCte, MySqlServerVersion = serverVersion, PoolConnectionReused = true,
            Boundary = "Client allocation only; database scan work is not bounded by this API."
        }));
        GC.KeepAlive(full); GC.KeepAlive(bounded);
    }
}
