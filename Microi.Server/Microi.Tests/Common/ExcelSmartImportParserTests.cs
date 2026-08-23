using System.Collections.Generic;
using System.IO;
using Microi.net;
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

    private static byte[] BuildWorkbook(Action<XSSFWorkbook> configure)
    {
        using var workbook = new XSSFWorkbook();
        configure(workbook);
        using var output = new MemoryStream();
        workbook.Write(output, true);
        return output.ToArray();
    }
}
