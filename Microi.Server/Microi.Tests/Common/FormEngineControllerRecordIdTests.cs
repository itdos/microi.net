using System.Reflection;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class FormEngineControllerRecordIdTests
{
    private static readonly MethodInfo Validator = typeof(FormEngineController).GetMethod(
        "TryGetInvalidRecordIdField",
        BindingFlags.NonPublic | BindingFlags.Static)!;

    [Theory]
    [InlineData("Id")]
    [InlineData("_TableRowId")]
    public void RecordIdentity_RejectsObjectsAndArrays(string field)
    {
        Assert.True(Validate(new JObject { [field] = new JObject() }, out var objectField));
        Assert.Equal(field, objectField);
        Assert.True(Validate(new JObject { [field] = new JArray("row") }, out var arrayField));
        Assert.Equal(field, arrayField);
    }

    [Theory]
    [InlineData("row-id")]
    [InlineData(123)]
    public void RecordIdentity_AcceptsScalarValues(object value)
    {
        Assert.False(Validate(new JObject { ["Id"] = JToken.FromObject(value) }, out var field));
        Assert.Null(field);
    }

    private static bool Validate(JObject param, out string? invalidField)
    {
        var arguments = new object?[] { param, null };
        var result = (bool)Validator.Invoke(null, arguments)!;
        invalidField = arguments[1] as string;
        return result;
    }
}
