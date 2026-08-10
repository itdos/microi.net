using Dos.Common;
using Microsoft.CSharp.RuntimeBinder;
using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class V8McpMenuBadgeTokenTests
{
    [Fact]
    public void LegacyAutoMenuFieldPattern_ThrowsWhenExtensionMethodReceivesDynamicString()
    {
        var exception = Assert.Throws<RuntimeBinderException>(() =>
            LegacyAutoMenuFieldBlankCheck(new JObject
            {
                ["Name"] = "Title"
            }));

        Assert.Contains("DosIsNullOrWhiteSpace", exception.Message);
    }

    [Fact]
    public void BuildDefaultModuleMenuConfigFromRows_CutsDynamicBoundaryAndReturnsExpectedDefaults()
    {
        var method = typeof(V8McpLogic).GetMethod(
            "BuildDefaultModuleMenuConfigFromRows",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var rows = new List<dynamic>
        {
            new JObject
            {
                ["Id"] = "field-title",
                ["TableId"] = "table-orders",
                ["Name"] = "Title",
                ["Label"] = "订单标题",
                ["Component"] = "Text",
                ["Type"] = "varchar(200)",
                ["Sort"] = 10
            },
            new JObject
            {
                ["Id"] = "field-status",
                ["TableId"] = "table-orders",
                ["Name"] = "Status",
                ["Label"] = "状态",
                ["Component"] = "Select",
                ["Type"] = "int",
                ["Sort"] = 20
            },
            new JObject
            {
                ["Id"] = "field-amount",
                ["TableId"] = "table-orders",
                ["Name"] = "TotalAmount",
                ["Label"] = "总金额",
                ["Component"] = "NumberText",
                ["Type"] = "decimal(18,2)",
                ["Sort"] = 30
            },
            new JObject
            {
                ["Id"] = "field-notes",
                ["TableId"] = "table-orders",
                ["Name"] = "Notes",
                ["Label"] = "备注",
                ["Component"] = "RichText",
                ["Type"] = "text",
                ["Sort"] = 40
            }
        };

        var defaults = method!.Invoke(null, [rows, "table-orders", "订单", "订单管理"]);
        Assert.NotNull(defaults);
        var result = JObject.FromObject(defaults!);

        AssertStringSet(
            new[] { "field-title", "field-status", "field-amount" },
            ParseArray(result, "TableDiyFieldIds").Values<string>());
        AssertStringSet(
            new[] { "Title", "Status", "TotalAmount" },
            ParseArray(result, "SelectFields").Select(item => item["Name"]?.ToString()));

        var searchNames = ParseArray(result, "SearchFieldIds")
            .Select(item => item["Name"]?.ToString())
            .ToArray();
        Assert.Contains("Title", searchNames);
        Assert.Contains("Status", searchNames);
        Assert.Contains("CreateTime", searchNames);
        Assert.Contains("UpdateTime", searchNames);
        Assert.Contains("UserName", searchNames);

        AssertStringSet(
            new[] { "field-status", "field-amount" },
            ParseArray(result, "SortFieldIds").Values<string>());
        AssertStringSet(
            new[] { "field-notes" },
            ParseArray(result, "NotShowFields").Values<string>());

        var statistics = ParseArray(result, "StatisticsFields");
        var statistic = Assert.Single(statistics);
        Assert.Equal("field-amount", statistic["Id"]?.ToString());
        Assert.Equal("Sum", statistic["Type"]?.ToString());

        AssertStringSet(
            new[] { "Title", "Status", "TotalAmount" },
            ParseArray(result, "MobileListFields").Select(item => item["Name"]?.ToString()));
        AssertStringSet(
            new[] { "Status" },
            ParseArray(result, "CardTitleTagFields").Select(item => item["Name"]?.ToString()));
        AssertStringSet(
            new[] { "Status", "TotalAmount" },
            ParseArray(result, "CardBottomTagFields").Select(item => item["Name"]?.ToString()));

        var defaultOrder = Assert.Single(ParseArray(result, "DefaultOrderBy"));
        Assert.Equal("CreateTime", defaultOrder["Id"]?.ToString());
        Assert.Equal("CreateTime", defaultOrder["Name"]?.ToString());
        Assert.Equal("DESC", defaultOrder["Type"]?.ToString());

        var viewSchema = JObject.Parse(result["ViewSchema"]?.ToString() ?? "{}");
        var views = Assert.IsType<JArray>(viewSchema["Views"]);
        Assert.Equal(new[] { "List", "Card" }, views.Select(view => view["Scene"]?.ToString()));
        Assert.DoesNotContain(views, view => new[] { "Detail", "Edit" }.Contains(view["Scene"]?.ToString()));
        var listView = Assert.IsType<JObject>(views[0]);
        var listLayout = Assert.IsType<JObject>(listView["Layout"]);
        var list = Assert.IsType<JObject>(listLayout["List"]);
        var columns = Assert.IsType<JArray>(list["Columns"]);
        Assert.True(columns[0]?["MinWidth"]?.Val<int>() >= 340);
        var metrics = Assert.IsType<JArray>(listLayout["Hero"]?["Metrics"]);
        Assert.Equal(new[] { "Field", "DataCount", "PageCount" }, metrics.Select(metric => metric["Source"]?.ToString()));
        Assert.Empty(result["Warnings"] as JArray ?? new JArray());
    }

    [Fact]
    public void BuildDefaultModuleMenuConfigFromRows_UsesTruthfulCountMetricsWhenNoNumericFieldExists()
    {
        var method = typeof(V8McpLogic).GetMethod(
            "BuildDefaultModuleMenuConfigFromRows",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        var rows = new List<dynamic>
        {
            new JObject
            {
                ["Id"] = "field-name",
                ["TableId"] = "table-customers",
                ["Name"] = "CustomerName",
                ["Label"] = "客户名称",
                ["Component"] = "Text",
                ["Type"] = "varchar(200)",
                ["Sort"] = 10
            }
        };

        var defaults = method!.Invoke(null, [rows, "table-customers", "客户", "客户管理"]);
        var result = JObject.FromObject(defaults!);
        var schemaText = result["ViewSchema"]?.ToString() ?? "";
        Assert.DoesNotContain("random", schemaText, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("随机", schemaText, StringComparison.OrdinalIgnoreCase);
        var schema = JObject.Parse(schemaText);
        var metrics = Assert.IsType<JArray>(schema["Views"]?[0]?["Layout"]?["Hero"]?["Metrics"]);
        Assert.Equal(new[] { "DataCount", "PageCount" }, metrics.Select(metric => metric["Source"]?.ToString()));
    }

    [Theory]
    [InlineData("CustomerName", "客户名称", "varchar(200)", "Text", 200)]
    [InlineData("CreateTime", "创建时间", "varchar(25)", "DateTime", 170)]
    [InlineData("Amount", "金额", "decimal(18,2)", "NumberText", 140)]
    [InlineData("Status", "状态", "varchar(25)", "Select", 130)]
    public void GetDefaultMcpTableWidth_UsesFieldSemantics(
        string name,
        string label,
        string type,
        string component,
        int expected)
    {
        var method = typeof(V8McpLogic).GetMethod(
            "GetDefaultMcpTableWidth",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        Assert.Equal(expected, method!.Invoke(null, [name, label, type, component]));
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(0, 0)]
    [InlineData(2, 0)]
    public void NormalizeMenuBadgeEnabledToken_HandlesJValueWithoutDynamicBinding(
        int value,
        int expected)
    {
        var method = typeof(V8McpLogic).GetMethod(
            "NormalizeMenuBadgeEnabledToken",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(method);
        var actual = method!.Invoke(null, [new JValue(value)]);

        Assert.Equal(expected, Assert.IsType<int>(actual));
    }

    private static bool LegacyAutoMenuFieldBlankCheck(dynamic item)
    {
        var row = JObject.FromObject(item);
        var name = row["Name"]?.ToString() ?? "";
        return name.DosIsNullOrWhiteSpace();
    }

    private static JArray ParseArray(JObject result, string propertyName)
    {
        return JArray.Parse(result[propertyName]?.ToString() ?? "[]");
    }

    private static void AssertStringSet(IEnumerable<string> expected, IEnumerable<string?> actual)
    {
        Assert.Equal(
            expected.OrderBy(item => item, StringComparer.Ordinal),
            actual.Where(item => item != null).Select(item => item!).OrderBy(item => item, StringComparer.Ordinal));
    }
}
