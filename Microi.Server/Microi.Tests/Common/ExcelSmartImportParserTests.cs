using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Microi.net;
using Newtonsoft.Json.Linq;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;

namespace Dos.Common.Tests;

public class ExcelSmartImportParserTests
{
    [Fact]
    public void EnhancedParser_UsesConfirmedRangeMappingsAndFormulaValues()
    {
        var workbookBytes = BuildWorkbook(workbook =>
        {
            var sheet = workbook.CreateSheet("客户");
            sheet.CreateRow(0).CreateCell(0).SetCellValue("客户资料导入模板");
            sheet.CreateRow(1).CreateCell(0).SetCellValue("说明：上方图片与文字不参与导入");
            var group = sheet.CreateRow(3);
            group.CreateCell(0).SetCellValue("基本信息");
            group.CreateCell(2).SetCellValue("业务信息");
            sheet.AddMergedRegion(new CellRangeAddress(3, 3, 0, 1));
            var header = sheet.CreateRow(4);
            header.CreateCell(0).SetCellValue("客户名称");
            header.CreateCell(1).SetCellValue("客户编码");
            header.CreateCell(2).SetCellValue("数量");
            var first = sheet.CreateRow(5);
            first.CreateCell(1).SetCellValue("C001");
            first.CreateCell(2).SetCellFormula("2+3");
            var second = sheet.CreateRow(6);
            second.CreateCell(1).SetCellValue("C002");
            second.CreateCell(2).SetCellValue(7);
        });

        var rows = new NPOIHelper(workbookBytes).ExcelToListDynamic(
            0,
            100,
            20,
            4,
            5,
            6,
            7,
            new[]
            {
                new ExcelImportColumnParam { ColumnIndex = 1, Name = "CustomerCode" },
                new ExcelImportColumnParam { Column = "C", Name = "Quantity" }
            });

        Assert.Equal(2, rows.Count);
        var firstRow = Assert.IsAssignableFrom<IDictionary<string, object>>((object)rows[0]);
        Assert.Equal("C001", firstRow["CustomerCode"]);
        Assert.Equal("5", firstRow["Quantity"]);
        Assert.Equal(6, firstRow["_ExcelRow"]);
    }

    [Fact]
    public void EnhancedParser_ComposesMergedMultiLevelHeaderWhenMappingIsNotProvided()
    {
        var workbookBytes = BuildWorkbook(workbook =>
        {
            var sheet = workbook.CreateSheet("客户");
            var group = sheet.CreateRow(0);
            group.CreateCell(0).SetCellValue("基本信息");
            sheet.AddMergedRegion(new CellRangeAddress(0, 0, 0, 1));
            var header = sheet.CreateRow(1);
            header.CreateCell(0).SetCellValue("客户名称");
            header.CreateCell(1).SetCellValue("客户编码");
            var data = sheet.CreateRow(2);
            data.CreateCell(0).SetCellValue("甲公司");
            data.CreateCell(1).SetCellValue("C001");
        });

        var rows = new NPOIHelper(workbookBytes).ExcelToListDynamic(
            headerStartRow: 1,
            headerEndRow: 2,
            dataStartRow: 3,
            dataEndRow: 3);

        var row = Assert.IsAssignableFrom<IDictionary<string, object>>((object)Assert.Single(rows));
        Assert.Equal("甲公司", row["基本信息 / 客户名称"]);
        Assert.Equal("C001", row["基本信息 / 客户编码"]);
        Assert.Equal(3, row["_ExcelRow"]);
    }

    [Fact]
    public void LegacyParser_PreservesFirstRowHeaderContract()
    {
        var workbookBytes = BuildWorkbook(workbook =>
        {
            var sheet = workbook.CreateSheet("旧模板");
            var header = sheet.CreateRow(0);
            header.CreateCell(0).SetCellValue("名称");
            var data = sheet.CreateRow(1);
            data.CreateCell(0).SetCellValue("甲");
        });

        var rows = new NPOIHelper(workbookBytes).ExcelToListDynamic();
        var row = Assert.IsAssignableFrom<IDictionary<string, object>>((object)Assert.Single(rows));
        Assert.Equal("甲", row["名称"]);
        Assert.False(row.ContainsKey("_ExcelRow"));
    }

    [Fact]
    public void EnhancedParser_RejectsDuplicateTargetMappings()
    {
        var workbookBytes = BuildWorkbook(workbook =>
        {
            var sheet = workbook.CreateSheet("重复映射");
            var header = sheet.CreateRow(0);
            header.CreateCell(0).SetCellValue("A");
            header.CreateCell(1).SetCellValue("B");
            var data = sheet.CreateRow(1);
            data.CreateCell(0).SetCellValue("1");
            data.CreateCell(1).SetCellValue("2");
        });

        var error = Assert.Throws<ArgumentException>(() =>
            new NPOIHelper(workbookBytes).ExcelToListDynamic(
                columnMappings: new[]
                {
                    new ExcelImportColumnParam { Column = "A", Name = "Same" },
                    new ExcelImportColumnParam { Column = "B", Name = "Same" }
                }));
        Assert.Contains("重复", error.Message);
    }

    [Fact]
    public void CsvParser_DetectsUtf8AndKeepsQuotedCommaAndNewline()
    {
        var preamble = Encoding.UTF8.GetPreamble();
        var content = Encoding.UTF8.GetBytes(
            "导入说明\r\n资产名称,资产状态,备注\r\n\"电脑,主机\",使用中,\"第一行\r\n第二行\"\r\n");
        var bytes = new byte[preamble.Length + content.Length];
        Buffer.BlockCopy(preamble, 0, bytes, 0, preamble.Length);
        Buffer.BlockCopy(content, 0, bytes, preamble.Length, content.Length);

        var result = CsvImportHelper.CsvToListDynamic(
            bytes,
            maxDataRows: 100,
            maxColumns: 20,
            headerStartRow: 2,
            headerEndRow: 2,
            dataStartRow: 3,
            dataEndRow: 3,
            columnMappings: new[]
            {
                new ExcelImportColumnParam { Column = "A", Name = "AssetName" },
                new ExcelImportColumnParam { Column = "B", Name = "AssetStatus" },
                new ExcelImportColumnParam { Column = "C", Name = "Remark" }
            });

        Assert.Equal("UTF-8", result.Encoding);
        Assert.Equal(",", result.Delimiter);
        var row = Assert.IsAssignableFrom<IDictionary<string, object>>((object)Assert.Single(result.Rows));
        Assert.Equal("电脑,主机", row["AssetName"]);
        Assert.Equal("使用中", row["AssetStatus"]);
        Assert.Equal("第一行\r\n第二行", row["Remark"]);
        Assert.Equal(3, row["_ExcelRow"]);
    }

    [Fact]
    public void CsvParser_AutomaticallyFallsBackToGbk()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        var bytes = Encoding.GetEncoding(936).GetBytes("资产名称,资产状态\r\n电脑,使用中");

        var result = CsvImportHelper.CsvToListDynamic(bytes);

        Assert.Equal("GBK", result.Encoding);
        var row = Assert.IsAssignableFrom<IDictionary<string, object>>((object)Assert.Single(result.Rows));
        Assert.Equal("电脑", row["资产名称"]);
        Assert.Equal("使用中", row["资产状态"]);
    }

    [Fact]
    public void OfficeExcelToList_RoutesCsvAndReturnsDetectedSourceMetadata()
    {
        var bytes = Encoding.UTF8.GetBytes("资产名称;资产状态\r\n电脑;使用中");
        var result = new MicroiOffice(null).ExcelToList(new
        {
            FileByteBase64 = Convert.ToBase64String(bytes),
            FileName = "assets.csv"
        });

        Assert.Equal(1, result.Code);
        var row = Assert.IsAssignableFrom<IDictionary<string, object>>((object)Assert.Single(result.Data));
        Assert.Equal("电脑", row["资产名称"]);
        var append = JObject.FromObject(result.DataAppend);
        Assert.Equal("csv", append.Value<string>("FileType"));
        Assert.Equal("UTF-8", append.Value<string>("Encoding"));
        Assert.Equal(";", append.Value<string>("Delimiter"));
    }

    private static byte[] BuildWorkbook(Action<XSSFWorkbook> configure)
    {
        using var workbook = new XSSFWorkbook();
        configure(workbook);
        using var output = new MemoryStream();
        workbook.Write(output, true);
        return output.ToArray();
    }
}
