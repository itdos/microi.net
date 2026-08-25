using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class BackgroundTaskV8MethodTests
{
    [Fact]
    public void ManageBackgroundTask_StatusWithBlankId_UsesStaticStringValidation()
    {
        var currentUser = new JObject
        {
            ["Id"] = "background-task-user",
            ["Account"] = "background-task-user",
            ["Level"] = 1
        };

        using var tenantScope = V8TenantContext.Enter(
            "background-task-test",
            "platform-background-task");
        using var identityScope = V8TrustedExecutionContext.Enter(currentUser);

        dynamic request = new JObject
        {
            ["Action"] = "Status",
            ["Id"] = ""
        };
        var result = new V8Method().ManageBackgroundTask(request);

        Assert.Equal(0, result.Code);
        Assert.Equal("后台任务Id不能为空。", result.Msg);
        Assert.DoesNotContain("DosIsNullOrWhiteSpace", result.Msg, StringComparison.Ordinal);
    }
}
