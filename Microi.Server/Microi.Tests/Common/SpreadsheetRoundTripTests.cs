using Microi.net;
using NPOI.HSSF.UserModel;
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;
using System.IO.Compression;
using System.Text;

namespace Microi.Tests.Common;

public class SpreadsheetRoundTripTests
{
    [Theory]
    [InlineData(false, ".xls")]
    [InlineData(true, ".xlsx")]
    [InlineData(true, ".xls")]
    [InlineData(true, ".XLS")]
    public void RealWorkbook_ImportsCurrentAndHistoricalDownloadNames(bool openXml, string extension)
    {
        using IWorkbook workbook = openXml ? new XSSFWorkbook() : new HSSFWorkbook();
        var sheet = workbook.CreateSheet("业务数据");
        sheet.CreateRow(0).CreateCell(0).SetCellValue("编号");
        sheet.CreateRow(1).CreateCell(0).SetCellValue("原样导出再导入");
        using var stream = new MemoryStream();
        workbook.Write(stream, true);
        var bytes = stream.ToArray();
        Assert.True(OfficeDocumentSecurity.HasExpectedSpreadsheetImportSignature(extension, bytes));
        using var parsed = WorkbookFactory.Create(new MemoryStream(bytes));
        Assert.Equal("原样导出再导入", parsed.GetSheetAt(0).GetRow(1).GetCell(0).StringCellValue);
        if (openXml && extension.Equals(".xls", StringComparison.OrdinalIgnoreCase))
            Assert.False(OfficeDocumentSecurity.HasExpectedFileSignature(extension, bytes));
    }

    [Fact]
    public void LegacyName_DoesNotAllowHtmlExecutablesOrUnrelatedZip()
    {
        Assert.False(OfficeDocumentSecurity.HasExpectedSpreadsheetImportSignature(".xls", Encoding.UTF8.GetBytes("<html>伪表格</html>")));
        Assert.False(OfficeDocumentSecurity.HasExpectedSpreadsheetImportSignature(".xls", Encoding.UTF8.GetBytes("MZ executable")));
        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, true))
            archive.CreateEntry("word/document.xml");
        Assert.False(OfficeDocumentSecurity.HasExpectedSpreadsheetImportSignature(".xls", stream.ToArray()));
        Assert.False(OfficeDocumentSecurity.HasExpectedSpreadsheetImportSignature(".xls", new byte[] { 0x50, 0x4b, 3, 4 }));
    }
}
