using System.Reflection;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class V8McpAdministrativeDataTests
{
    [Theory]
    [InlineData("sys_user", true)]
    [InlineData("Diy_Table", true)]
    [InlineData("mci_ai_app_file", true)]
    [InlineData("sys.user", false)]
    [InlineData("sys-user", false)]
    [InlineData("sys user", false)]
    [InlineData("", false)]
    public void TableNamesAreRestrictedToSingleSafeIdentifiers(string tableName, bool expected)
    {
        Assert.Equal(expected, V8McpLogic.IsAdministrativeTableName(tableName));
    }

    [Theory]
    [InlineData("Pwd")]
    [InlineData("Password")]
    [InlineData("AiApiKey")]
    [InlineData("AuthSecret")]
    [InlineData("DbConn")]
    [InlineData("RedisPwd")]
    [InlineData("SecretCipher")]
    [InlineData("private_key")]
    [InlineData("MinIOSecretKey")]
    [InlineData("MinIOAccessKey")]
    [InlineData("AliOssAccessKeyId")]
    [InlineData("TencentSecretId")]
    public void KnownSecretFieldsAreDetected(string fieldName)
    {
        Assert.True(V8McpLogic.IsAdministrativeSensitiveField(fieldName));
    }

    [Fact]
    public void GenericReadbackRedactsSecretsRecursivelyButPreservesStructure()
    {
        var input = JObject.Parse("""
        {
          "Id": "u1",
          "Name": "管理员",
          "Pwd": "plain-or-hash",
          "Nested": {
            "ClientSecret": "secret-value",
            "Enabled": true
          },
          "Items": [
            {
              "DbConn": "Server=db;Password=secret",
              "MinIOSecretKey": "storage-secret",
              "MinIOAccessKey": "storage-access",
              "AliOssAccessKeyId": "oss-access-id",
              "Label": "主库"
            }
          ]
        }
        """);

        var redacted = (JObject)V8McpLogic.RedactAdministrativeData(input);

        Assert.Equal("u1", redacted.Value<string>("Id"));
        Assert.Equal("管理员", redacted.Value<string>("Name"));
        Assert.Equal("***REDACTED***", redacted.Value<string>("Pwd"));
        Assert.Equal("***REDACTED***", redacted["Nested"]?.Value<string>("ClientSecret"));
        Assert.True(redacted["Nested"]?.Value<bool>("Enabled"));
        Assert.Equal("***REDACTED***", redacted["Items"]?[0]?.Value<string>("DbConn"));
        Assert.Equal("***REDACTED***", redacted["Items"]?[0]?.Value<string>("MinIOSecretKey"));
        Assert.Equal("***REDACTED***", redacted["Items"]?[0]?.Value<string>("MinIOAccessKey"));
        Assert.Equal("***REDACTED***", redacted["Items"]?[0]?.Value<string>("AliOssAccessKeyId"));
        Assert.Equal("主库", redacted["Items"]?[0]?.Value<string>("Label"));
    }

    [Fact]
    public void GenericMutationRejectsCallerIdentityAndSecretFields()
    {
        var result = V8McpLogic.SanitizeAdministrativeMutationRow(new JObject
        {
            ["Id"] = "r1",
            ["Name"] = "可写字段",
            ["OsClient"] = "forged",
            ["_CurrentUser"] = new JObject { ["Level"] = 999999 },
            ["Password"] = "must-not-pass",
            ["Config"] = new JObject { ["ClientSecret"] = "nested-secret" },
            ["ConfigJson"] = "{\"Authorization\":\"Bearer secret\",\"Enabled\":true}"
        });

        Assert.Equal("r1", result.Row.Value<string>("Id"));
        Assert.Equal("可写字段", result.Row.Value<string>("Name"));
        Assert.DoesNotContain(result.Row.Properties(), item => item.Name == "OsClient");
        Assert.Contains("OsClient", result.ReservedFields);
        Assert.Contains("_CurrentUser", result.ReservedFields);
        Assert.Contains("Password", result.SensitiveFields);
        Assert.Contains("Config.ClientSecret", result.SensitiveFields);
        Assert.Contains("ConfigJson.Authorization", result.SensitiveFields);
    }

    [Theory]
    [InlineData("add", "sys_role", null, "ADD:sys_role")]
    [InlineData("update", "sys_role", "r1", "UPDATE:sys_role:r1")]
    [InlineData("delete", "sys_role", "r1", "DELETE:sys_role:r1")]
    public void WriteConfirmationsAreOperationAndRowScoped(
        string operation,
        string tableName,
        string? id,
        string expected)
    {
        Assert.Equal(expected,
            V8McpLogic.BuildAdministrativeDataConfirmation(operation, tableName, id));
    }

    [Fact]
    public void AdministrativeEndpointsRequireAdminCapability()
    {
        foreach (var actionName in new[]
                 {
                     nameof(V8EngineController.GetAdministrativeCapabilities),
                     nameof(V8EngineController.AdministerTableData)
                 })
        {
            var method = typeof(V8EngineController).GetMethod(actionName,
                BindingFlags.Instance | BindingFlags.Public);
            var declaration = method?.GetCustomAttribute<V8McpCapabilityAttribute>(true);
            Assert.NotNull(declaration);
            Assert.Equal(V8McpScope.Admin, declaration.Scope);
        }
    }
}
