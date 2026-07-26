using System.Reflection;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class UpgradeFieldConfigCompatibilityTests
{
    private static readonly MethodInfo NormalizeMethod =
        typeof(MicroiUpgrade).GetMethod(
            "TryNormalizeLegacyFieldConfig",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("字段Config兼容方法不存在。");

    private static readonly FieldInfo LockConfigField =
        typeof(MicroiUpgrade).GetField(
            "ApiEngineLockFieldConfig",
            BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("接口引擎Lock标准Config不存在。");

    [Fact]
    public void ValidObjectConfigIsPreservedByteForByte()
    {
        const string config =
            "{ \"V8Code\": \"if(V8.Form.Lock){ V8.Result=true; }\", \"NumberText\": 0 }";
        var arguments = new object?[] { config, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        Assert.Equal(config, Assert.IsType<string>(arguments[1]));
    }

    [Fact]
    public void FormattedJsonWhitespaceOutsideStringsIsPreservedByteForByte()
    {
        const string config = "{\n  \"V8Code\": \"line1\\nline2\",\n  \"NumberText\": 0\n}";
        var arguments = new object?[] { config, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        Assert.Equal(config, Assert.IsType<string>(arguments[1]));
    }

    [Fact]
    public void DoubleEncodedObjectConfigIsUnwrappedToPlainJson()
    {
        const string config =
            "{\"V8Code\":\"if(V8.Form.Lock){\\n  V8.Result=true;\\n}\"}";
        var doubleEncoded = JsonConvert.SerializeObject(config);
        var arguments = new object?[] { doubleEncoded, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        var normalized = Assert.IsType<string>(arguments[1]);
        Assert.Equal(JToken.Parse(config), JToken.Parse(normalized));
        Assert.IsType<JObject>(JToken.Parse(normalized));
    }

    [Theory]
    [InlineData("{'V8Code':'return true;'}")]
    [InlineData("{\"V8Code\":\"return true;\",}")]
    [InlineData("{/*legacy*/\"V8Code\":\"return true;\"}")]
    public void NewtonsoftOnlyJsonIsCanonicalizedForBrowserJsonParse(string config)
    {
        var arguments = new object?[] { config, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        var normalized = Assert.IsType<string>(arguments[1]);
        Assert.NotEqual(config, normalized);
        using var document = System.Text.Json.JsonDocument.Parse(normalized);
        Assert.Equal(System.Text.Json.JsonValueKind.Object, document.RootElement.ValueKind);
    }

    [Fact]
    public void RawControlCharactersInsideV8CodeAreEscapedWithoutLosingOtherConfig()
    {
        const string config =
            "{\"ParamData\":{},\"NumberText\":0,\"Path\":\"C:\\\\temp\\\\file\",\"V8Code\":\"if(V8.Form.Lock){\n  V8.FieldSet('LockKey', 'Visible', true);\r\n}\telse{\n  V8.FieldSet('LockKey', 'Visible', false);\n}\",\"MapCompany\":\"Baidu\"}";
        var arguments = new object?[] { config, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        var normalized = Assert.IsType<string>(arguments[1]);
        Assert.DoesNotContain("\n", normalized);
        Assert.DoesNotContain("\r", normalized);
        Assert.DoesNotContain("\t", normalized);
        var model = JObject.Parse(normalized);
        Assert.NotNull(model["ParamData"]);
        Assert.Equal(0, model.Value<int>("NumberText"));
        Assert.Equal(@"C:\temp\file", model.Value<string>("Path"));
        Assert.Equal("Baidu", model.Value<string>("MapCompany"));
        Assert.Equal(
            "if(V8.Form.Lock){\n  V8.FieldSet('LockKey', 'Visible', true);\r\n}\telse{\n  V8.FieldSet('LockKey', 'Visible', false);\n}",
            model.Value<string>("V8Code"));
    }

    [Theory]
    [InlineData("ApiRole")]
    [InlineData("Lock")]
    [InlineData("ApiV8Code")]
    public void RawV8ControlCharactersAreRepairableForEveryApiEngineField(string fieldName)
    {
        var config =
            $"{{\"V8Code\":\"if(V8.Form.{fieldName}){{\n  V8.Result=true;\n}}\",\"Visible\":true}}";
        var arguments = new object?[] { config, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        var normalized = Assert.IsType<string>(arguments[1]);
        Assert.DoesNotContain("\n", normalized);
        using var document = System.Text.Json.JsonDocument.Parse(normalized);
        Assert.Equal(System.Text.Json.JsonValueKind.Object, document.RootElement.ValueKind);
        Assert.Contains($"V8.Form.{fieldName}", document.RootElement.GetProperty("V8Code").GetString());
    }

    [Fact]
    public void RawControlCharactersInsideApiRoleSqlAreEscapedWithoutChangingSql()
    {
        const string config =
            "{\"DataSource\":\"Sql\",\"Sql\":\"select Id,Name from sys_role\nwhere IsDeleted=0\",\"V8Code\":\"\"}";
        var arguments = new object?[] { config, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.True(success);
        var normalized = Assert.IsType<string>(arguments[1]);
        Assert.DoesNotContain("\n", normalized);
        using var document = System.Text.Json.JsonDocument.Parse(normalized);
        Assert.Equal(
            "select Id,Name from sys_role\nwhere IsDeleted=0",
            document.RootElement.GetProperty("Sql").GetString());
    }

    [Theory]
    [InlineData("")]
    [InlineData("System.String")]
    [InlineData("{\"V8Code\":\"unterminated}")]
    [InlineData("[]")]
    public void InvalidOrNonObjectConfigIsRejectedForTargetedFallback(string config)
    {
        var arguments = new object?[] { config, null };

        var success = Assert.IsType<bool>(NormalizeMethod.Invoke(null, arguments));

        Assert.False(success);
        Assert.Equal("", Assert.IsType<string>(arguments[1]));
    }

    [Fact]
    public void LockFallbackIsValidLegacyCompatibleJson()
    {
        var config = Assert.IsType<string>(LockConfigField.GetValue(null));
        var model = JObject.Parse(config);
        var v8Code = model.Value<string>("V8Code");

        Assert.Contains("V8.Form.Lock", v8Code);
        Assert.Contains("'LockKey', 'Visible', true", v8Code);
        Assert.Contains("'LockKey', 'Visible', false", v8Code);
    }
}
