using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class V8McpFieldRelationGuardTests
{
    [Fact]
    public void ReadMcpPatchValue_HandlesJValueScalarsAndMissingValues()
    {
        var patch = new JObject
        {
            ["Id"] = "field-1",
            ["Visible"] = 1,
            ["FormWidth"] = null
        };

        Assert.Equal("field-1", V8McpLogic.ReadMcpPatchValue<string>(patch, "Id"));
        Assert.Equal(1, V8McpLogic.ReadMcpPatchValue<int?>(patch, "Visible"));
        Assert.Null(V8McpLogic.ReadMcpPatchValue<int?>(patch, "FormWidth"));
        Assert.Null(V8McpLogic.ReadMcpPatchValue<string>(patch, "Missing"));
    }

    private static readonly JArray ParentFields = JArray.Parse("""
        [{"Name":"Id"},{"Name":"CustomerId"},{"Name":"CustomerProfile"},{"Name":"Items"}]
        """);

    [Fact]
    public void JoinFormRejectsCurrentTableAsItsOwnTarget()
    {
        var errors = V8McpLogic.ValidateMcpFieldRelationSnapshotForTest(
            "parent-id",
            "Biz_Order",
            "CustomerProfile",
            "JoinForm",
            """{"JoinForm":{"TableId":"parent-id","TableName":"Biz_Order","JoinFieldName":"CustomerId"}}""",
            JObject.Parse("""{"Id":"parent-id","Name":"Biz_Order"}"""),
            ParentFields,
            new JArray(),
            null!);

        Assert.Contains(errors, error => error.Contains("不能与当前表相同"));
    }

    [Fact]
    public void JoinFormRequiresARealParentForeignKeyAndConsistentTargetIdentity()
    {
        var errors = V8McpLogic.ValidateMcpFieldRelationSnapshotForTest(
            "parent-id",
            "Biz_Order",
            "CustomerProfile",
            "JoinForm",
            """{"JoinForm":{"TableId":"stale-id","TableName":"Biz_Customer","JoinFieldName":"Name"}}""",
            JObject.Parse("""{"Id":"customer-id","Name":"Biz_Customer"}"""),
            ParentFields,
            new JArray(),
            null!);

        Assert.Contains(errors, error => error.Contains("TableId/TableName"));
        Assert.Contains(errors, error => error.Contains("不存在的字段：Name"));
    }

    [Fact]
    public void ValidJoinFormPassesTheMcpBoundaryContract()
    {
        var errors = V8McpLogic.ValidateMcpFieldRelationSnapshotForTest(
            "parent-id",
            "Biz_Order",
            "CustomerProfile",
            "JoinForm",
            """{"JoinForm":{"TableId":"customer-id","TableName":"Biz_Customer","JoinFieldName":"CustomerId"}}""",
            JObject.Parse("""{"Id":"customer-id","Name":"Biz_Customer"}"""),
            ParentFields,
            new JArray(),
            null!);

        Assert.Empty(errors);
    }

    [Fact]
    public void TableChildRequiresDifferentChildTableForeignKeyAndHiddenBoundMenu()
    {
        var config = """
            {
              "TableChildTableId":"child-id",
              "TableChildSysMenuId":"child-menu-id",
              "TableChildFkFieldName":"OrderId",
              "TableChild":{"PrimaryTableFieldName":"Id"}
            }
            """;
        var targetTable = JObject.Parse("""{"Id":"child-id","Name":"Biz_OrderItem"}""");
        var childFields = JArray.Parse("""[{"Name":"Id"},{"Name":"OrderId"}]""");
        var badMenu = JObject.Parse("""
            {"Id":"child-menu-id","DiyTableId":"child-id","Display":1,"AppDisplay":0,"HasChild":0}
            """);

        var errors = V8McpLogic.ValidateMcpFieldRelationSnapshotForTest(
            "parent-id", "Biz_Order", "Items", "TableChild", config,
            targetTable, ParentFields, childFields, badMenu);
        Assert.Contains(errors, error => error.Contains("Display=0"));

        var hiddenMenu = JObject.Parse("""
            {"Id":"child-menu-id","DiyTableId":"child-id","Display":0,"AppDisplay":0,"HasChild":0}
            """);
        var valid = V8McpLogic.ValidateMcpFieldRelationSnapshotForTest(
            "parent-id", "Biz_Order", "Items", "TableChild", config,
            targetTable, ParentFields, childFields, hiddenMenu);
        Assert.Empty(valid);
    }

    [Fact]
    public void TableChildAcceptsForeignKeyIndexWhenPhysicalTableHasNoOsClient()
    {
        var indexes = new[]
        {
            new V8McpLogic.TableIndexInfo
            {
                Key_name = "idx_project",
                Columns = new List<string> { "XiangmuID" }
            }
        };

        Assert.True(V8McpLogic.HasTableChildRequiredIndexForTest(
            indexes,
            new[] { "Id", "XiangmuID", "GoujianBH" },
            "XiangmuID"));
        Assert.Equal(
            new[] { "XiangmuID" },
            V8McpLogic.BuildTableChildRequiredIndexPrefixForTest(
                new[] { "Id", "XiangmuID" },
                "XiangmuID"));
    }

    [Fact]
    public void TableChildRequiresOsClientThenForeignKeyWhenPhysicalTableIsShared()
    {
        var wrongOrder = new[]
        {
            new V8McpLogic.TableIndexInfo
            {
                Key_name = "idx_wrong",
                Columns = new List<string> { "XiangmuID", "OsClient" }
            }
        };
        var correct = new[]
        {
            new V8McpLogic.TableIndexInfo
            {
                Key_name = "idx_tenant_project",
                Columns = new List<string> { "OsClient", "XiangmuID", "CreateTime" }
            }
        };

        var physicalColumns = new[] { "Id", "OsClient", "XiangmuID" };
        Assert.False(V8McpLogic.HasTableChildRequiredIndexForTest(
            wrongOrder, physicalColumns, "XiangmuID"));
        Assert.True(V8McpLogic.HasTableChildRequiredIndexForTest(
            correct, physicalColumns, "XiangmuID"));
        Assert.Equal(
            new[] { "OsClient", "XiangmuID" },
            V8McpLogic.BuildTableChildRequiredIndexPrefixForTest(
                physicalColumns,
                "XiangmuID"));
    }
}
