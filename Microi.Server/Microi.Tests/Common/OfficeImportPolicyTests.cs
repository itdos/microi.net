using System.Collections;
using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class OfficeImportPolicyTests
{
    private static MethodInfo PrivateStatic(string name)
    {
        var method = typeof(MicroiOffice).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return method;
    }

    [Theory]
    [InlineData(null, "RollbackAll")]
    [InlineData("", "RollbackAll")]
    [InlineData(" rollbackall ", "RollbackAll")]
    [InlineData("continueonerror", "ContinueOnError")]
    public void Error_policy_is_normalized_and_legacy_default_is_rollback_all(string? input, string expected)
    {
        var result = PrivateStatic("ImportNormalizeErrorPolicy").Invoke(null, new object?[] { input });
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Unknown_error_policy_is_rejected()
    {
        var exception = Assert.Throws<TargetInvocationException>(() =>
            PrivateStatic("ImportNormalizeErrorPolicy").Invoke(null, new object?[] { "IgnoreEverything" }));

        Assert.IsType<ArgumentException>(exception.InnerException);
    }

    [Fact]
    public void Every_standalone_unique_field_is_a_rule_and_all_composite_fields_share_one_rule()
    {
        var fields = new List<JObject>
        {
            Field("Code", "编号", "Alone", 1),
            Field("Phone", "手机号", "Alone", 2),
            Field("TenantId", "租户", "All", 3),
            Field("ExternalCode", "外部编号", "all", 4),
            Field("Name", "名称", "Alone", 5, unique: false)
        };

        var rules = PrivateStatic("ImportBuildUniqueRules").Invoke(null, new object?[] { fields });
        var enumerable = Assert.IsAssignableFrom<IEnumerable>(rules);
        var list = enumerable.Cast<object>().ToList();

        Assert.Equal(3, list.Count);
        Assert.Equal(new[] { "Alone", "Alone", "All" }, list.Select(ReadRuleType));
        Assert.Equal(new[] { 1, 1, 2 }, list.Select(ReadRuleFieldCount));

        var description = PrivateStatic("ImportDescribeUniqueRules").Invoke(null, new[] { rules })?.ToString();
        Assert.Contains("编号(Code)", description);
        Assert.Contains("手机号(Phone)", description);
        Assert.Contains("租户(TenantId) + 外部编号(ExternalCode)", description);
    }

    private static JObject Field(string name, string label, string mode, int sort, bool unique = true)
    {
        return new JObject
        {
            ["Name"] = name,
            ["Label"] = label,
            ["Sort"] = sort,
            ["Unique"] = unique ? 1 : 0,
            ["Config"] = new JObject
            {
                ["Unique"] = new JObject { ["Type"] = mode }
            }.ToString(Newtonsoft.Json.Formatting.None)
        };
    }

    private static string ReadRuleType(object rule)
    {
        return rule.GetType().GetProperty("Type")?.GetValue(rule)?.ToString() ?? "";
    }

    private static int ReadRuleFieldCount(object rule)
    {
        var fields = rule.GetType().GetProperty("Fields")?.GetValue(rule);
        return Assert.IsAssignableFrom<IEnumerable>(fields).Cast<object>().Count();
    }
}
