using System.Net.Http.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.FullStack;

/// <summary>通过真实 DiyToken、V8 和数据库验证日志入口；只使用隔离测试租户及本用例拥有的行。</summary>
[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
public class ScheduleExecutionLogHttpTests
{
    [Fact]
    public async Task HistoryAndMongoLogs_UseRealHttpCursors_AndRejectAnonymousOrMalformedRequests()
    {
        string Required(string key) => Environment.GetEnvironmentVariable(key) ?? throw new InvalidOperationException("缺少 " + key);
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        var tenant = Required("MICROI_TEST_OSCLIENT");
        Assert.StartsWith("StandardSuite", tenant);
        var endpoint = new Uri(Required("MICROI_TEST_API_BASE"));
        Assert.True(endpoint.IsLoopback, "日志写入验收仅允许本机隔离夹具。");
        using var client = new HttpClient { BaseAddress = endpoint, Timeout = TimeSpan.FromSeconds(30) };
        client.DefaultRequestHeaders.TryAddWithoutValidation("authorization", Required("MICROI_TEST_TOKEN"));
        client.DefaultRequestHeaders.TryAddWithoutValidation("osclient", tenant);
        client.DefaultRequestHeaders.TryAddWithoutValidation("did", Required("MICROI_TEST_DID"));
        var id = Guid.NewGuid().ToString("N");
        var key = "std_job_log_" + id;
        var month = DateTime.Now.ToString("yyyyMM");
        var date = DateTime.Now.ToString("yyyy-MM-15 01:02:03");
        var route = "apiengine/" + key;
        // 查询代码只接入正式可信原子；造数/清理由固定测试 Key 约束，不能接收外部 SQL 或租户。
        var code = $$"""
            if (V8.Param.JobName == '{{key}}' && V8.Param.JobRunId) return {Code:1,Data:'scheduled-log-probe'};
            if (V8.Param.Action == 'register') return V8.Method.SaveScheduleJob({
                JobName:'{{key}}',ApiEngineKey:'{{key}}',CronExpression:'0/5 * * * * ?',RuntimeOnly:true
            });
            if (V8.Param.Action == 'unregister') return V8.Method.ManageScheduleJob({Action:'Delete',JobName:'{{key}}'});
            if (V8.Param.Action == 'seed') {
                for (var i=0;i<25;i++) {
                    var suffix = ('000'+i).slice(-3);
                    V8.Db.FromSql('INSERT INTO diy_schedule_job_log (Id,JobName,CreateTime,Message,IsDeleted) VALUES (@id,@job,@time,@message,0)')
                        .AddInParameter('@id','{{id}}'+suffix).AddInParameter('@job','{{key}}')
                        .AddInParameter('@time','{{date}}').AddInParameter('@message','history-'+suffix).ExecuteNonQuery();
                }
                return {Code:1};
            }
            if (V8.Param.Action == 'clean') {
                V8.Db.FromSql('DELETE FROM diy_schedule_job_log WHERE JobName=@job').AddInParameter('@job','{{key}}').ExecuteNonQuery();
                return {Code:1};
            }
            return V8.Method.ManageScheduleJob(V8.Param);
            """;
        async Task<JObject> Post(string path, object body, bool success = true)
        {
            using var response = await client.PostAsJsonAsync(path, body,
                new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = null }, TestContext.Current.CancellationToken);
            response.EnsureSuccessStatusCode();
            var token = JToken.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            if (token.Type == JTokenType.String) token = JToken.Parse(token.Value<string>()!);
            var result = Assert.IsType<JObject>(token);
            if (success) Assert.True(result["Code"]?.Value<int>() == 1, result["Msg"]?.ToString());
            return result;
        }
        var created = false;
        var registered = false;
        try
        {
            await Post("api/FormEngine/AddFormData", new { FormEngineKey = "sys_apiengine", OsClient = tenant,
                Id = id, ApiEngineKey = key, ApiName = "隔离任务日志验收", ApiV8Code = code, IsEnable = 1, AllowAnonymous = 0, StopHttp = 0, ApiRole = "[]" });
            created = true;
            await Post(route, new { Action = "seed" });
            var first = await Post(route, new { Action = "historylogs", JobName = key, SearchMonth = month, PageSize = 20 });
            var rows = Assert.IsType<JArray>(first["Data"]);
            Assert.Equal(20, rows.Count);
            Assert.True(first["DataAppend"]!["HasMore"]!.Value<bool>());
            Assert.False(first["DataAppend"]!["ExactTotal"]!.Value<bool>());
            var second = await Post(route, new { Action = "historylogs", JobName = key, SearchMonth = month, PageSize = 20,
                BeforeLogTime = first["DataAppend"]!["BeforeLogTime"]!.ToString(), BeforeLogId = first["DataAppend"]!["BeforeLogId"]!.ToString() });
            var tail = Assert.IsType<JArray>(second["Data"]);
            Assert.Equal(5, tail.Count);
            Assert.False(second["DataAppend"]!["HasMore"]!.Value<bool>());
            Assert.Equal(25, rows.Concat(tail).Select(row => row["Id"]!.ToString()).Distinct().Count());
            foreach (var action in new[] { "historylogs", "logs" })
            {
                var empty = await Post(route, new { Action = action, JobName = key + "_missing", SearchMonth = month });
                Assert.Empty(Assert.IsType<JArray>(empty["Data"]));
                foreach (var invalid in new object[] {
                    new { Action=action,JobName=key,SearchMonth="invalid" },
                    new { Action=action,JobName=key,SearchMonth=month,BeforeLogId="orphan" } })
                    Assert.Equal(0, (await Post(route, invalid, false))["Code"]!.Value<int>());
            }
            var capabilities = await Post(route, new { Action = "capabilities" });
            Assert.Equal("mongo-cursor-v1", capabilities["Data"]!["ExecutionLogs"]!.ToString());
            using var anonymous = new HttpClient { BaseAddress = endpoint };
            anonymous.DefaultRequestHeaders.TryAddWithoutValidation("osclient", tenant);
            using var denied = await anonymous.PostAsJsonAsync(route, new { Action = "historylogs", JobName = key, SearchMonth = month }, TestContext.Current.CancellationToken);
            var deniedText = await denied.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            Assert.DoesNotContain("history-", deniedText);
            Assert.DoesNotContain("mongo-cursor-v1", deniedText);
            // 真实 Quartz 到点、V8 执行、异步队列与 MongoDB 查询闭环；测试任务没有业务副作用。
            registered = true; // 保存若超时仍在 finally 尝试收回本用例唯一 JobKey。
            await Post(route, new { Action = "register" });
            JArray? execution = null;
            var deadline = DateTime.UtcNow.AddSeconds(60);
            while (DateTime.UtcNow < deadline)
            {
                execution = Assert.IsType<JArray>((await Post(route, new { Action = "logs", JobName = key, SearchMonth = month }))["Data"]);
                if (execution.Count > 0) break;
                await Task.Delay(1000, TestContext.Current.CancellationToken);
            }
            Assert.NotNull(execution);
            Assert.NotEmpty(execution);
            Assert.All(execution, row =>
            {
                Assert.True(row["Success"]!.Value<bool>(), row["Content"]?.ToString());
                Assert.Contains("scheduled-log-probe", row["Content"]!.ToString());
            });
            var historyAfterRun = await Post(route, new { Action = "historylogs", JobName = key, SearchMonth = month, PageSize = 100 });
            Assert.Equal(25, Assert.IsType<JArray>(historyAfterRun["Data"]).Count); // 新日志不回写关系库。
        }
        finally
        {
            if (created)
            {
                try
                {
                    if (registered)
                    {
                        await Post(route, new { Action = "unregister" }, false);
                        var remaining = await Post(route, new { Action = "GetByNames", Names = new[] { key } });
                        Assert.Empty(Assert.IsType<JArray>(remaining["Data"]));
                    }
                }
                finally
                {
                    await Post(route, new { Action = "clean" });
                    await Post("api/FormEngine/DelFormData", new { FormEngineKey = "sys_apiengine", OsClient = tenant, Id = id });
                }
            }
        }
    }
}
