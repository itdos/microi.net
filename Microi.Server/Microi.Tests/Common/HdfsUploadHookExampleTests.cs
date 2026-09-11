using System.Text.RegularExpressions;
using Jint;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class HdfsUploadHookExampleTests
{
    [Theory]
    [InlineData(false, 0)]
    [InlineData(false, 1)]
    [InlineData(false, 2)]
    [InlineData(true, 0)]
    [InlineData(true, 1)]
    [InlineData(true, 2)]
    public void PublishedHookExamplesExtendEveryClrWrappedFile(bool documentation, int arrayLength)
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !Directory.Exists(Path.Combine(root.FullName, "microi.doc"))) root = root.Parent;
        Assert.NotNull(root);
        var file = documentation ? "microi.doc/docs/doc/more/hdfs.md"
            : "Microi.Server/Microi.Upgrade/Resource/platform-hdfs-upload-hook.js";
        var source = File.ReadAllText(Path.Combine(root.FullName, file));
        var example = documentation
            ? Regex.Match(source, @"```javascript\s*(var result = V8.Param.Result;[\s\S]*?|var result = JSON.parse[\s\S]*?)```").Groups[1].Value
            : Regex.Match(source, @"示例：([\s\S]*?return \{ Code: 1, UploadResult: result \};)").Groups[1].Value;
        Assert.NotEmpty(example);
        example = Regex.Replace(example, @"(?m)^\s*\* ?", "");
        var files = new JArray(Enumerable.Range(0, Math.Max(1, arrayLength)).Select(i => new JObject
        {
            ["Id"] = "file-" + i, ["Name"] = "文件" + i + ".gif", ["Url"] = "https://example.test/private-ticket-" + i
        }));
        var result = new JObject { ["Code"] = 1, ["Data"] = arrayLength == 0 ? files[0]!.DeepClone() : files };
        var engine = new Engine();
        // ApiEngine 将参数作为 JObject 交给 Jint；纯 Node 数组会掩盖包装对象的差异。
        engine.SetValue("V8", new { Param = new JObject { ["Result"] = result } });
        var actual = JObject.Parse(engine.Evaluate("JSON.stringify((function(){" + example + "})())").AsString());
        Assert.Equal(1, actual["Code"]!.Value<int>());
        var data = actual["UploadResult"]!["Data"]!;
        Assert.Equal(arrayLength != 0, data is JArray);
        var rows = data is JArray array ? array : new JArray(data);
        Assert.Equal(Math.Max(1, arrayLength), rows.Count);
        Assert.All(rows, row =>
        {
            Assert.Equal(documentation ? "custom" : "example", row["BusinessTag"]?.Value<string>());
            Assert.StartsWith("https://example.test/private-ticket-", row["Url"]!.Value<string>());
        });
    }
}
