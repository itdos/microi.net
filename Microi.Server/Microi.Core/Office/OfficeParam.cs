using System;
using Newtonsoft.Json.Linq;
using System.IO;
using System.Collections.Generic;

namespace Microi.net
{
    /// <summary>
    /// Excel 导出单元格样式。颜色使用 6 位十六进制 RGB（可带 #）。
    /// </summary>
    public class OfficeExcelCellStyleParam
    {
        public string FontName { get; set; }
        public double? FontSize { get; set; }
        public string FontColor { get; set; }
        public bool? Bold { get; set; }
        public bool? Italic { get; set; }
        public bool? Underline { get; set; }
        public string BackgroundColor { get; set; }
        public string HorizontalAlignment { get; set; }
        public string VerticalAlignment { get; set; }
        public bool? WrapText { get; set; }
        public bool? ShrinkToFit { get; set; }
        public short? Rotation { get; set; }
        public string NumberFormat { get; set; }
        public string BorderStyle { get; set; }
        public string BorderColor { get; set; }
        public string BorderTopStyle { get; set; }
        public string BorderTopColor { get; set; }
        public string BorderRightStyle { get; set; }
        public string BorderRightColor { get; set; }
        public string BorderBottomStyle { get; set; }
        public string BorderBottomColor { get; set; }
        public string BorderLeftStyle { get; set; }
        public string BorderLeftColor { get; set; }
    }

    /// <summary>
    /// Excel 工作表导出选项。列宽单位为 Excel 字符宽度，行高单位为磅。
    /// </summary>
    public class OfficeExcelExportOptionsParam
    {
        public string SheetName { get; set; }
        public double? DefaultColumnWidth { get; set; }
        public double? DefaultRowHeight { get; set; }
        public double? HeaderRowHeight { get; set; }
        public double? DataRowHeight { get; set; }
        public bool? FreezeHeader { get; set; }
        public int? FreezeRows { get; set; }
        public int? FreezeColumns { get; set; }
        public bool? AutoFilter { get; set; }
        public string AutoFilterRange { get; set; }
        public bool? AutoSizeColumns { get; set; }
        public bool? ShowGridLines { get; set; }
        public int? Zoom { get; set; }
        public string PrintOrientation { get; set; }
        public string PaperSize { get; set; }
        public int? FitToWidth { get; set; }
        public int? FitToHeight { get; set; }
        public string PrintArea { get; set; }
        public double? MarginTop { get; set; }
        public double? MarginRight { get; set; }
        public double? MarginBottom { get; set; }
        public double? MarginLeft { get; set; }
        public bool? CenterHorizontally { get; set; }
        public bool? CenterVertically { get; set; }
        public string HeaderText { get; set; }
        public string FooterText { get; set; }
        public bool? ShowPageNumber { get; set; }
        public OfficeExcelCellStyleParam HeaderStyle { get; set; }
        public OfficeExcelCellStyleParam CellStyle { get; set; }
    }

    /// <summary>
    /// Excel 高级布局。所有行列序号均从 1 开始，Range 使用 A1 或 A1:K10。
    /// </summary>
    public class OfficeExcelLayoutParam
    {
        public List<OfficeExcelLayoutCellParam> Cells { get; set; } = new List<OfficeExcelLayoutCellParam>();
        public List<string> MergedRanges { get; set; } = new List<string>();
        public List<OfficeExcelLayoutColumnParam> Columns { get; set; } = new List<OfficeExcelLayoutColumnParam>();
        public List<OfficeExcelLayoutRowParam> Rows { get; set; } = new List<OfficeExcelLayoutRowParam>();
        public List<OfficeExcelLayoutRowGroupParam> RowGroups { get; set; } = new List<OfficeExcelLayoutRowGroupParam>();
    }

    public class OfficeExcelLayoutCellParam
    {
        public string Range { get; set; }
        public object Value { get; set; }
        public string Formula { get; set; }
        public string DataType { get; set; }
        public bool? Merge { get; set; }
        public OfficeExcelCellStyleParam Style { get; set; }
    }

    public class OfficeExcelLayoutColumnParam
    {
        public string Column { get; set; }
        public int? Index { get; set; }
        public double? Width { get; set; }
        public bool? Hidden { get; set; }
        public bool? AutoSize { get; set; }
        public double? MinWidth { get; set; }
        public double? MaxWidth { get; set; }
    }

    public class OfficeExcelLayoutRowParam
    {
        public int Row { get; set; }
        public double? Height { get; set; }
        public bool? Hidden { get; set; }
    }

    public class OfficeExcelLayoutRowGroupParam
    {
        public int StartRow { get; set; }
        public int EndRow { get; set; }
        public bool? Collapsed { get; set; }
    }

    public partial class OfficeExportParam : BaseParam
    {
        public string FormEngineKey { get; set; }
        public string FormDataId { get; set; }
        public JObject FormData { get; set; }
        public byte[] TplFileByte { get; set; }
        public string TplKey { get; set; }
        public string TplId { get; set; }
    }

    public partial class OfficeExportWordTextParam : BaseParam
    {
        public string FileName { get; set; }
        public string Title { get; set; }
        public string Content { get; set; }
        public List<string> Lines { get; set; } = new List<string>();
        public string FontFamily { get; set; } = "Microsoft YaHei";
        public int? FontSize { get; set; } = 9;
        public int? TitleFontSize { get; set; } = 14;
        public int? SpacingAfter { get; set; } = 40;
        public bool? Compact { get; set; } = true;
    }

    /// <summary>
    /// 通用 Word 文档导出参数。长度单位除字体外均为厘米。
    /// </summary>
    public class OfficeExportWordParam : BaseParam
    {
        public string FileName { get; set; }
        public string Title { get; set; }
        public string Subtitle { get; set; }
        public string Content { get; set; }
        public List<string> Lines { get; set; } = new List<string>();
        public List<OfficeWordParagraphParam> Paragraphs { get; set; } = new List<OfficeWordParagraphParam>();
        public List<OfficeWordSectionParam> Sections { get; set; } = new List<OfficeWordSectionParam>();
        public List<OfficeWordTableParam> Tables { get; set; } = new List<OfficeWordTableParam>();
        public List<OfficeExportImageParam> Images { get; set; } = new List<OfficeExportImageParam>();
        public string Author { get; set; }
        public string Subject { get; set; }
        public string Keywords { get; set; }
        public string Description { get; set; }
        public string FontFamily { get; set; } = "Microsoft YaHei";
        public double? FontSize { get; set; } = 10.5;
        public string FontColor { get; set; } = "000000";
        public double? TitleFontSize { get; set; } = 20;
        public double? SubtitleFontSize { get; set; } = 12;
        public string TitleAlignment { get; set; } = "Center";
        public string PageSize { get; set; } = "A4";
        public string Orientation { get; set; } = "Portrait";
        public double? MarginTop { get; set; } = 2.54;
        public double? MarginRight { get; set; } = 2.54;
        public double? MarginBottom { get; set; } = 2.54;
        public double? MarginLeft { get; set; } = 2.54;
        public double? LineSpacing { get; set; } = 1.25;
        public double? ParagraphSpacingAfter { get; set; } = 6;
        public string HeaderText { get; set; }
        public string FooterText { get; set; }
        public bool? ShowPageNumber { get; set; } = false;
    }

    public class OfficeWordParagraphParam
    {
        public string Text { get; set; }
        public string Alignment { get; set; } = "Left";
        public bool? Bold { get; set; }
        public bool? Italic { get; set; }
        public bool? Underline { get; set; }
        public string FontFamily { get; set; }
        public double? FontSize { get; set; }
        public string FontColor { get; set; }
        public double? SpacingBefore { get; set; }
        public double? SpacingAfter { get; set; }
        public double? LineSpacing { get; set; }
        public double? FirstLineIndent { get; set; }
        public bool? PageBreakBefore { get; set; }
    }

    public class OfficeWordSectionParam
    {
        public string Heading { get; set; }
        public int? HeadingLevel { get; set; } = 1;
        public string Content { get; set; }
        public List<OfficeWordParagraphParam> Paragraphs { get; set; } = new List<OfficeWordParagraphParam>();
        public List<OfficeWordTableParam> Tables { get; set; } = new List<OfficeWordTableParam>();
        public List<OfficeExportImageParam> Images { get; set; } = new List<OfficeExportImageParam>();
        public bool? PageBreakBefore { get; set; }
    }

    public class OfficeWordTableParam
    {
        public string Title { get; set; }
        public List<string> Headers { get; set; } = new List<string>();
        public List<List<object>> Rows { get; set; } = new List<List<object>>();
        public List<double> ColumnWidths { get; set; } = new List<double>();
        public string Alignment { get; set; } = "Center";
        public bool? HeaderBold { get; set; } = true;
        public string HeaderBackgroundColor { get; set; } = "D9EAF7";
        public string HeaderFontColor { get; set; } = "000000";
        public string BorderColor { get; set; } = "B7C9D6";
        public double? FontSize { get; set; }
    }

    /// <summary>
    /// Office 文档通用图片参数。Word 中 Width/Height 为厘米；PPT 中 X/Y/Width/Height 为英寸。
    /// </summary>
    public class OfficeExportImageParam
    {
        public string FileByteBase64 { get; set; }
        public string FileName { get; set; }
        public string ContentType { get; set; }
        public double? Width { get; set; }
        public double? Height { get; set; }
        public double? X { get; set; }
        public double? Y { get; set; }
        public string Alignment { get; set; } = "Center";
        public string Caption { get; set; }
    }

    /// <summary>
    /// PowerPoint 导出参数。页面、位置与尺寸单位均为英寸。
    /// </summary>
    public class OfficeExportPowerPointParam : BaseParam
    {
        public string FileName { get; set; }
        public string Title { get; set; }
        public string Author { get; set; }
        public string Subject { get; set; }
        public string Keywords { get; set; }
        public string Company { get; set; }
        public double? SlideWidth { get; set; } = 13.333;
        public double? SlideHeight { get; set; } = 7.5;
        public string FontFamily { get; set; } = "Microsoft YaHei";
        public string BackgroundColor { get; set; } = "FFFFFF";
        public string TitleColor { get; set; } = "17365D";
        public string TextColor { get; set; } = "222222";
        public double? TitleFontSize { get; set; } = 28;
        public double? BodyFontSize { get; set; } = 18;
        public bool? ShowSlideNumber { get; set; } = false;
        public List<OfficePowerPointSlideParam> Slides { get; set; } = new List<OfficePowerPointSlideParam>();
    }

    public class OfficePowerPointSlideParam
    {
        public string Layout { get; set; } = "TitleAndContent";
        public string Title { get; set; }
        public string Subtitle { get; set; }
        public string Content { get; set; }
        public List<string> Bullets { get; set; } = new List<string>();
        public List<OfficePowerPointTextParam> TextItems { get; set; } = new List<OfficePowerPointTextParam>();
        public List<OfficeExportImageParam> Images { get; set; } = new List<OfficeExportImageParam>();
        public List<OfficePowerPointTableParam> Tables { get; set; } = new List<OfficePowerPointTableParam>();
        public string BackgroundColor { get; set; }
        public string TitleColor { get; set; }
        public string TextColor { get; set; }
        public double? TitleFontSize { get; set; }
        public double? BodyFontSize { get; set; }
    }

    public class OfficePowerPointTextParam
    {
        public string Text { get; set; }
        public int? Level { get; set; } = 0;
        public bool? Bullet { get; set; }
        public bool? Bold { get; set; }
        public bool? Italic { get; set; }
        public double? FontSize { get; set; }
        public string FontColor { get; set; }
        public string Alignment { get; set; } = "Left";
    }

    public class OfficePowerPointTableParam
    {
        public List<string> Headers { get; set; } = new List<string>();
        public List<List<object>> Rows { get; set; } = new List<List<object>>();
        public List<double> ColumnWidths { get; set; } = new List<double>();
        public double? X { get; set; } = 0.7;
        public double? Y { get; set; } = 3.8;
        public double? Width { get; set; } = 11.9;
        public double? Height { get; set; } = 2.8;
        public string HeaderBackgroundColor { get; set; } = "17365D";
        public string HeaderFontColor { get; set; } = "FFFFFF";
        public string CellBackgroundColor { get; set; } = "FFFFFF";
        public string CellFontColor { get; set; } = "222222";
        public double? FontSize { get; set; } = 12;
    }
}

