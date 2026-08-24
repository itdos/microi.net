namespace Dos.Common.Tests;

public class ImageCropUploadContractTests
{
    [Fact]
    public void MultipartControllerSeparatesCropOriginalFromBusinessDisplayFile()
    {
        var source = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(),
            "Microi.Server",
            "Microi.net.Api",
            "Controllers",
            "HDFSController.cs"));

        Assert.Contains("file.Name", source, StringComparison.Ordinal);
        Assert.Contains("MicroiOriginalFile", source, StringComparison.Ordinal);
        Assert.Contains("param.OriginalFiles", source, StringComparison.Ordinal);
        Assert.Contains("param.CropEnabled != true", source, StringComparison.Ordinal);
    }

    [Fact]
    public void HdfsWritesPrivateOriginalBeforeAnyCroppedDisplayObject()
    {
        var source = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(),
            "Microi.Server",
            "Microi.HDFS",
            "MicroiHDFS.cs"));
        var originalWrite = source.IndexOf("putCropOriginalResult", StringComparison.Ordinal);
        var compressionBranch = source.IndexOf("#region \u538b\u7f29\u5904\u7406", originalWrite, StringComparison.Ordinal);
        var publicDisplayWrite = source.IndexOf("FileFullPath = resultPath", originalWrite, StringComparison.Ordinal);

        Assert.True(originalWrite > 0);
        Assert.True(compressionBranch > originalWrite);
        Assert.True(publicDisplayWrite > originalWrite);
        Assert.Contains("Limit = true", source[originalWrite..compressionBranch], StringComparison.Ordinal);
        Assert.Contains("!hasSeparateOriginal", source, StringComparison.Ordinal);
        Assert.Contains("OriginalStored = hasSeparateOriginal", source, StringComparison.Ordinal);
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
        throw new DirectoryNotFoundException("Unable to locate the Microi repository root.");
    }
}
