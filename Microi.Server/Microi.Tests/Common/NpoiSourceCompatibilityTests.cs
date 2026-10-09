using NPOI.HSSF.UserModel;
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;
using NPOI.XWPF.UserModel;
using SkiaSharp;

namespace Dos.Common.Tests;

public class NpoiSourceCompatibilityTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Excel_SourceBuildPreservesCellsFormulaStylesAndImages(bool legacy)
    {
        using IWorkbook workbook = legacy ? new HSSFWorkbook() : new XSSFWorkbook();
        var sheet = workbook.CreateSheet("吾码导出");
        var row = sheet.CreateRow(0);
        row.CreateCell(0).SetCellValue("客户名称");
        row.CreateCell(1).SetCellValue(42);
        row.CreateCell(2).SetCellFormula("B1*2");
        var style = workbook.CreateCellStyle();
        style.FillForegroundColor = IndexedColors.LightBlue.Index;
        style.FillPattern = FillPattern.SolidForeground;
        row.GetCell(0).CellStyle = style;
        var png = CreatePng();
        int imageIndex = workbook.AddPicture(png, NPOI.SS.UserModel.PictureType.PNG);
        var anchor = workbook.GetCreationHelper().CreateClientAnchor();
        anchor.Col1 = 3;
        anchor.Row1 = 1;
        sheet.CreateDrawingPatriarch().CreatePicture(anchor, imageIndex).Resize();
        using var output = new MemoryStream();
        workbook.Write(output, leaveOpen: true);
        using var input = new MemoryStream(output.ToArray());
        using IWorkbook reopened = legacy ? new HSSFWorkbook(input) : new XSSFWorkbook(input);
        var actual = reopened.GetSheetAt(0).GetRow(0);
        Assert.Equal("客户名称", actual.GetCell(0).StringCellValue);
        Assert.Equal(42, actual.GetCell(1).NumericCellValue);
        Assert.Equal("B1*2", actual.GetCell(2).CellFormula);
        Assert.Equal(IndexedColors.LightBlue.Index, actual.GetCell(0).CellStyle.FillForegroundColor);
        Assert.Equal(png, Assert.Single(reopened.GetAllPictures().Cast<IPictureData>()).Data);
        using var image = new MemoryStream(png);
        Assert.Equal(new SKSizeI(16, 8), ImageUtils.GetImageDimension(image));
        Assert.DoesNotContain(AppDomain.CurrentDomain.GetAssemblies(), assembly => assembly.GetName().Name == "SixLabors.ImageSharp");
    }

    [Fact]
    public void Word_SourceBuildPreservesTextAndEmbeddedImage()
    {
        using var document = new XWPFDocument();
        var run = document.CreateParagraph().CreateRun();
        run.SetText("吾码中文模板");
        var png = CreatePng();
        using var image = new MemoryStream(png);
        run.AddPicture(image, (int)NPOI.XWPF.UserModel.PictureType.PNG, "logo.png", 16 * 9525, 8 * 9525);
        using var output = new MemoryStream();
        document.Write(output);
        using var input = new MemoryStream(output.ToArray());
        using var reopened = new XWPFDocument(input);
        Assert.Contains("吾码中文模板", reopened.Paragraphs[0].Text);
        Assert.Equal(png, Assert.Single(reopened.AllPictures).Data);
    }

    private static byte[] CreatePng()
    {
        using var bitmap = new SKBitmap(16, 8);
        bitmap.Erase(SKColors.CornflowerBlue);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }
}
