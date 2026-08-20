using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class WorkflowCopyReadStateTests
{
    [Fact]
    public void LegacyCopyEntryWithoutReadFlag_IsTreatedAsAlreadyRead()
    {
        const string json = "[{\"Id\":\"user-1\",\"Name\":\"管理员\",\"NodeId\":\"node-1\"}]";

        Assert.True(WorkflowCopyReadState.ContainsRecipient(json, "USER-1"));
        Assert.False(WorkflowCopyReadState.IsUnreadForUser(json, "user-1"));
    }

    [Fact]
    public void ExplicitUnreadEntry_IsCountedOncePerFlow()
    {
        var flows = new[]
        {
            new WFFlow { CopyUsers = "[{\"Id\":\"user-1\",\"IsRead\":false}]" },
            new WFFlow { CopyUsers = "[{\"Id\":\"user-1\",\"IsRead\":true}]" },
            new WFFlow { CopyUsers = "[{\"Id\":\"user-1\"}]" },
            new WFFlow { CopyUsers = "[{\"Id\":\"other\",\"IsRead\":false}]" }
        };

        Assert.Equal(1, WorkflowCopyReadState.CountUnreadForUser(flows, "user-1"));
    }

    [Fact]
    public void MarkRead_OnlyChangesTargetUsersExplicitUnreadEntriesAndPreservesExtraFields()
    {
        const string json = "["
            + "{\"Id\":\"user-1\",\"IsRead\":false,\"Custom\":\"keep\"},"
            + "{\"Id\":\"user-1\"},"
            + "{\"Id\":\"other\",\"IsRead\":false}]";
        var now = new DateTime(2026, 8, 20, 10, 0, 0, DateTimeKind.Local);

        var updated = WorkflowCopyReadState.MarkRead(json, "user-1", now, out var changed);
        var items = JArray.Parse(updated);

        Assert.True(changed);
        Assert.True(items[0]!["IsRead"]!.Value<bool>());
        Assert.Equal("keep", items[0]!["Custom"]!.Value<string>());
        Assert.NotNull(items[0]!["ReadTime"]);
        Assert.Null(items[1]!["IsRead"]);
        Assert.False(items[2]!["IsRead"]!.Value<bool>());
    }
}
