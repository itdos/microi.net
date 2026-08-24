namespace Dos.Common.Tests;

public class V8MethodTextUploadContractTests
{
    [Fact]
    public void TextFileAtomsRestoreStaticJsonTypesBeforeReadingJValues()
    {
        var source = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(),
            "Microi.Server",
            "Microi.Core",
            "V8Engine",
            "Runtime",
            "V8Method.cs"));

        Assert.Contains(
            "JObject request = JsonHelper.ToJObject((object)dynamicParam);",
            source,
            StringComparison.Ordinal);
        Assert.Contains(
            "JToken contentToken = request[\"Content\"]",
            source,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "var request = JsonHelper.ToJObject(dynamicParam);",
            source,
            StringComparison.Ordinal);
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(current.FullName, "Microi.Client")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Unable to locate repository root.");
    }
}
