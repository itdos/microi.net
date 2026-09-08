using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json;
using Quartz;
using Quartz.Impl.Matchers;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 只读观察被新版停用的计划并写跳过日志。绝不触发/暂停/删除任务或推进共享 Cron。
    /// 按“租户 + Job + Trigger + 计划时间”去重，多个新版节点不会每秒重复写同一条日志。
    /// </summary>
    internal sealed class MicroiDisabledScheduleObserver : BackgroundService
    {
        private readonly ISchedulerFactory factory;
        private readonly IMicroiJob runtime;
        private List<ObservedSchedule> schedules = new List<ObservedSchedule>();
        private DateTimeOffset catalogAt = DateTimeOffset.MinValue;
        public MicroiDisabledScheduleObserver(ISchedulerFactory factory, IMicroiJob runtime) { this.factory = factory; this.runtime = runtime; }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var previous = DateTimeOffset.UtcNow;
            var lastFailure = DateTimeOffset.MinValue;
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken).ConfigureAwait(false);
                    var now = DateTimeOffset.UtcNow;
                    var tenants = await MicroiTaskSchedulingPolicy.ReadTenantsAsync().ConfigureAwait(false);
                    if (!tenants.Values.Any(x => x))
                    {
                        schedules.Clear();
                        catalogAt = DateTimeOffset.MinValue;
                        previous = now;
                        continue;
                    }
                    var scheduler = (runtime as MicroiQuartzScheduledTask)?.CurrentScheduler
                        ?? await factory.GetScheduler(stoppingToken).ConfigureAwait(false);
                    if (now - catalogAt >= TimeSpan.FromSeconds(10))
                    {
                        schedules = await ReadSchedules(scheduler, tenants.Keys, stoppingToken).ConfigureAwait(false);
                        catalogAt = now;
                    }
                    // 不补写进程停机期间的记录，更不会补跑业务。单轮观察有界。
                    var from = previous < now.AddMinutes(-1) ? now.AddMinutes(-1) : previous;
                    foreach (var item in schedules)
                    {
                        if (!tenants.TryGetValue(item.Tenant, out var disabled) || !disabled) continue;
                        var due = DueTimes(item.Trigger, from, now);
                        if (due.Count == 0) continue;
                        var state = await scheduler.GetTriggerState(item.Trigger.Key, stoppingToken).ConfigureAwait(false);
                        if (state == TriggerState.None || state == TriggerState.Paused || state == TriggerState.Complete || state == TriggerState.Error) continue;
                        foreach (var time in due)
                        {
                            if (item.Calendar != null && !item.Calendar.IsTimeIncluded(time)) continue;
                            // 写记录前再读当前缓存；关闭停用开关后不继续写旧停用记录。
                            if (!await MicroiTaskSchedulingPolicy.IsDisabledAsync(item.Tenant).ConfigureAwait(false)) break;
                            await WriteSkip(item.Tenant, item.Job, item.Trigger.Key, time, scheduler.SchedulerInstanceId).ConfigureAwait(false);
                        }
                    }
                    previous = now;
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (Exception ex)
                {
                    // 观察器故障不能放开调度门禁，也不能无限并发重试/记录错误。
                    var now = DateTimeOffset.UtcNow;
                    if (now - lastFailure > TimeSpan.FromMinutes(1))
                    {
                        Console.WriteLine($"Microi：停用任务调度日志观察失败（不会执行被停用业务）：{ex.Message}");
                        lastFailure = now;
                    }
                }
            }
        }

        private static async Task<List<ObservedSchedule>> ReadSchedules(IScheduler scheduler, IEnumerable<string> tenants, CancellationToken ct)
        {
            var allowed = new HashSet<string>(tenants, StringComparer.OrdinalIgnoreCase);
            var result = new List<ObservedSchedule>();
            foreach (var group in allowed.Select(MicroiQuartzScheduledTask.GetTenantGroup).Append("default_group").Distinct())
            {
                foreach (var key in await scheduler.GetJobKeys(GroupMatcher<JobKey>.GroupEquals(group), ct).ConfigureAwait(false))
                {
                    var job = await scheduler.GetJobDetail(key, ct).ConfigureAwait(false);
                    var tenant = MicroiTaskSchedulingPolicy.GetTenant(job);
                    if (job == null || !allowed.Contains(tenant)) continue;
                    foreach (var trigger in await scheduler.GetTriggersOfJob(key, ct).ConfigureAwait(false))
                    {
                        result.Add(new ObservedSchedule
                        {
                            Tenant = tenant, Job = key, Trigger = trigger,
                            Calendar = string.IsNullOrEmpty(trigger.CalendarName) ? null : await scheduler.GetCalendar(trigger.CalendarName, ct).ConfigureAwait(false)
                        });
                    }
                }
            }
            return result;
        }

        internal static IReadOnlyList<DateTimeOffset> DueTimes(ITrigger trigger, DateTimeOffset after, DateTimeOffset until)
        {
            var result = new List<DateTimeOffset>();
            var cursor = after;
            while (result.Count < 100)
            {
                var next = trigger.GetFireTimeAfter(cursor);
                if (!next.HasValue || next.Value > until || next.Value <= cursor) break;
                result.Add(next.Value);
                cursor = next.Value;
            }
            return result;
        }

        internal static string LogId(string tenant, JobKey job, TriggerKey trigger, DateTimeOffset time)
        {
            var identity = JsonConvert.SerializeObject(new[] { tenant.ToLowerInvariant(), job.Group, job.Name, trigger.Group, trigger.Name, time.UtcTicks.ToString() });
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(identity));
            var guidBytes = new byte[16];
            Array.Copy(bytes, guidBytes, 16);
            return new Guid(guidBytes).ToString();
        }

        internal static async Task WriteSkip(string tenant, JobKey job, TriggerKey trigger, DateTimeOffset time, string node)
        {
            var id = LogId(tenant, job, trigger, time);
            var db = MicroiEngine.CacheTenant.Cache(tenant).GetIDatabase();
            var key = $"Microi:{tenant}:JobSchedulingSkipped:{id}";
            var owner = Guid.NewGuid().ToString("N");
            // 这是日志的短期写入预留，不是业务互斥锁。数据库确定性主键最终防重。
            if (!await db.StringSetAsync(key, owner, TimeSpan.FromSeconds(30), When.NotExists).ConfigureAwait(false)) return;
            try
            {
                var message = JsonConvert.SerializeObject(new
                {
                    Code = 1, Status = "Skipped", Executed = false, Reason = "SystemTaskSchedulingDisabled",
                    Msg = MicroiTaskSchedulingPolicy.SkipMessage, ScheduledFireTime = time.UtcDateTime.ToString("O"),
                    Trigger = trigger.ToString(), NodeId = node
                });
                var result = await MicroiEngine.FormEngine.AddFormDataAsync(new
                {
                    FormEngineKey = MicroiJobConst.logTable, OsClient = tenant, Id = id,
                    _RowModel = new { Id = id, JobName = job.Name, Message = message }
                }).ConfigureAwait(false);
                if (result.Code != 1)
                {
                    // 节点在“日志已提交、去重键尚未确认”之间退出后，重试必须回读同一 Id。
                    var existing = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(new { FormEngineKey = MicroiJobConst.logTable, OsClient = tenant, Id = id }).ConfigureAwait(false);
                    if (existing.Code != 1 || existing.Data == null) throw new InvalidOperationException(result.Msg);
                }
                await db.ScriptEvaluateAsync("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('set',KEYS[1],'done','EX',604800) end return 0",
                    new RedisKey[] { key }, new RedisValue[] { owner }).ConfigureAwait(false);
            }
            catch
            {
                await db.ScriptEvaluateAsync("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) end return 0",
                    new RedisKey[] { key }, new RedisValue[] { owner }).ConfigureAwait(false);
                throw;
            }
        }

        private sealed class ObservedSchedule
        {
            internal string Tenant;
            internal JobKey Job;
            internal ITrigger Trigger;
            internal ICalendar Calendar;
        }
    }
}
