using Microi.Panel;
using Microi.Panel.Panel;

namespace Microi.Tests.Panel;

public sealed class PanelFileTests
{
    [Theory]
    [InlineData("../certs/key")][InlineData("/etc/passwd")][InlineData("a/../../key")]
    [InlineData("a\\..\\key")][InlineData("a//key")][InlineData("a/.mci-panel-hidden")][InlineData("a\nfile")]
    public void FilePathsCannotEscapeOrAccessPanelInternals(string value) => Assert.Throws<OpsException>(() => PanelFiles.SafePath(value));

    [Fact]
    public void NestedAndUnicodeFileNamesAreKept()
    {
        Assert.Equal("assets/客户 logo.svg", PanelFiles.SafePath("assets/客户 logo.svg"));
        Assert.Equal("", PanelFiles.SafePath("", allowRoot:true));
        Assert.Throws<OpsException>(() => PanelFiles.SafePath(""));
    }
    [Fact]
    public void FileContentRequiresValidBoundedBase64()
    {
        Assert.Equal("你好", System.Text.Encoding.UTF8.GetString(PanelFiles.DecodeContent(Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("你好")))));
        Assert.Throws<OpsException>(() => PanelFiles.DecodeContent("not base64"));
        Assert.Throws<OpsException>(() => PanelFiles.DecodeContent(new string('A',28*1024*1024+4)));
    }
}
