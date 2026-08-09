using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class V8CodeVersionServiceTests
{
    [Fact]
    public void LayoutOnlyBatch_DoesNotProduceVersionLookups()
    {
        var oldRows = new List<JObject>();
        var newRows = new List<JObject>();
        var unchangedCode = V8Base64.StringToBase64("return { Code: 1 };");

        for (var index = 0; index < 215; index++)
        {
            var oldRow = CreateField($"field-{index}", unchangedCode);
            var newRow = (JObject)oldRow.DeepClone();
            newRow["Label"] = $"字段 {index}";
            newRow["Sort"] = index + 1;
            oldRows.Add(oldRow);
            newRows.Add(newRow);
        }

        var changes = V8CodeVersionService.CollectChangedCodeRows(
            "diy_field",
            oldRows,
            newRows);

        Assert.Empty(changes);
    }

    [Fact]
    public void CodeBatch_OnlyReturnsRowsAndFieldsWhoseDecodedCodeChanged()
    {
        var originalCode = V8Base64.StringToBase64("return { Code: 1 };\r\n");
        var newlineOnlyCode = V8Base64.StringToBase64("return { Code: 1 };\n");
        var changedCode = V8Base64.StringToBase64("// @version 2.0.0\nreturn { Code: 1, Data: true };");
        var oldRows = new[]
        {
            CreateField("unchanged", originalCode),
            CreateField("changed", originalCode)
        };
        var newRows = new[]
        {
            CreateField("unchanged", newlineOnlyCode),
            CreateField("changed", changedCode)
        };

        var change = Assert.Single(V8CodeVersionService.CollectChangedCodeRows(
            "diy_field",
            oldRows,
            newRows));

        Assert.Equal("changed", change.RowId);
        var field = Assert.Single(change.Fields);
        Assert.Equal("V8Code", field.FieldName);
        Assert.Contains("@version 2.0.0", field.Code, StringComparison.Ordinal);
    }

    [Fact]
    public void FormEnginePackage_DeclaresLatestVersionCompositeIndexForNewAndExistingDatabases()
    {
        var root = FindRepositoryRoot();
        var package = JObject.Parse(File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Upgrade",
            "Resource",
            "app.microi.form-engine.json")));
        var ddlStatements = package["DDLStatements"]?.Children<JObject>().ToList() ?? [];
        var tableDdl = Assert.Single(ddlStatements, item =>
            item["TableName"]?.Value<string>() == "mic_data_version"
            && item["DDL"]?.Value<string>()?.StartsWith("CREATE TABLE", StringComparison.OrdinalIgnoreCase) == true);
        var indexDdl = Assert.Single(ddlStatements, item =>
            item["TableName"]?.Value<string>() == "mic_data_version"
            && item["DDL"]?.Value<string>()?.StartsWith("CREATE INDEX", StringComparison.OrdinalIgnoreCase) == true);

        Assert.Equal(ddlStatements.Count, package["PackageInfo"]?["DDLCount"]?.Value<int>());
        Assert.Contains("KEY `ix_mic_data_version_table_row_time` (`TableId`,`TableRowId`,`CreateTime`)",
            tableDdl["DDL"]?.Value<string>());
        Assert.Equal(
            "CREATE INDEX `ix_mic_data_version_table_row_time` ON `mic_data_version` (`TableId`,`TableRowId`,`CreateTime`);",
            indexDdl["DDL"]?.Value<string>());
    }

    [Fact]
    public void PersistenceFastPath_PrecedesAllDatabaseReads()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Core",
            "FormEngine",
            "V8CodeVersionService.cs"));
        var fastPath = source.IndexOf("if (changedRows.Count == 0)", StringComparison.Ordinal);
        var tableRead = source.IndexOf(
            "GetFormDataAsync<dynamic>(\"diy_table\"",
            StringComparison.Ordinal);
        var latestVersionRead = source.IndexOf("GetLatestVersionAsync(osClient", StringComparison.Ordinal);

        Assert.True(fastPath >= 0 && fastPath < tableRead && tableRead < latestVersionRead);
    }

    private static JObject CreateField(string id, string v8Code)
    {
        return new JObject
        {
            ["Id"] = id,
            ["Label"] = id,
            ["Sort"] = 1,
            ["V8Code"] = v8Code,
            ["KeyupV8Code"] = "",
            ["V8TmpEngineTable"] = "",
            ["V8TmpEngineForm"] = ""
        };
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Unable to locate Microi repository root.");
    }
}
