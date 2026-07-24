using System.IO.Compression;
using System.Text;
using Microi.net;

namespace Dos.Common.Tests;

public class OfficeDocumentSecurityTests
{
    [Theory]
    [InlineData("https://office.example.com/cache/a.docx", "https://office.example.com", true)]
    [InlineData("https://office.example.com/base/a.docx", "https://office.example.com/base", true)]
    [InlineData("https://office.example.com/other/a.docx", "https://office.example.com/base", false)]
    [InlineData("http://office.example.com/cache/a.docx", "https://office.example.com", false)]
    [InlineData("https://office.example.com:8443/cache/a.docx", "https://office.example.com", false)]
    [InlineData("https://office.example.com.evil.test/cache/a.docx", "https://office.example.com", false)]
    [InlineData("https://user@office.example.com/cache/a.docx", "https://office.example.com", false)]
    [InlineData("https://office.example.com/cache/a.docx#fragment", "https://office.example.com", false)]
    public void DownloadUrl_MustMatchConfiguredOriginAndBasePath(
        string downloadUrl,
        string apiBase,
        bool expected)
    {
        Assert.Equal(expected, OfficeDocumentSecurity.IsAllowedDownloadUrl(downloadUrl, apiBase));
    }

    [Theory]
    [InlineData(".docx", "word/document.xml")]
    [InlineData(".xlsx", "xl/workbook.xml")]
    [InlineData(".pptx", "ppt/presentation.xml")]
    public void OpenXmlSignature_RequiresExpectedPackagePart(string extension, string expectedPart)
    {
        var valid = BuildOpenXml(expectedPart);
        var wrongType = BuildOpenXml("other/not-the-requested-type.xml");

        Assert.True(OfficeDocumentSecurity.HasExpectedFileSignature(extension, valid));
        Assert.False(OfficeDocumentSecurity.HasExpectedFileSignature(extension, wrongType));
    }

    [Fact]
    public void FileSignature_RejectsDisguisedPayloads()
    {
        Assert.True(OfficeDocumentSecurity.HasExpectedFileSignature(
            ".pdf",
            Encoding.ASCII.GetBytes("%PDF-1.7\n")));
        Assert.False(OfficeDocumentSecurity.HasExpectedFileSignature(
            ".pdf",
            Encoding.ASCII.GetBytes("<html>not a pdf</html>")));
        Assert.False(OfficeDocumentSecurity.HasExpectedFileSignature(
            ".csv",
            Encoding.ASCII.GetBytes("<script>alert(1)</script>")));
        Assert.False(OfficeDocumentSecurity.HasExpectedFileSignature(
            ".exe",
            Encoding.ASCII.GetBytes("MZ")));
    }

    private static byte[] BuildOpenXml(string expectedPart)
    {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddEntry(archive, "[Content_Types].xml", "<Types />");
            AddEntry(archive, "_rels/.rels", "<Relationships />");
            AddEntry(archive, expectedPart, "<root />");
        }
        return output.ToArray();
    }

    private static void AddEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path);
        using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
        writer.Write(content);
    }
}
