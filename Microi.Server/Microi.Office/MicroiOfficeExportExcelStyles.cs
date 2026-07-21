using System;
using System.Collections.Generic;
using System.Globalization;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;

namespace Microi.net
{
    public partial class MicroiOffice
    {
        private OfficeExcelExportOptionsParam MergeExcelExportOptions(
            OfficeExcelExportOptionsParam defaults,
            OfficeExcelExportOptionsParam overrides)
        {
            if (defaults == null && overrides == null) return null;
            defaults = defaults ?? new OfficeExcelExportOptionsParam();
            overrides = overrides ?? new OfficeExcelExportOptionsParam();
            return new OfficeExcelExportOptionsParam
            {
                SheetName = overrides.SheetName ?? defaults.SheetName,
                DefaultColumnWidth = overrides.DefaultColumnWidth ?? defaults.DefaultColumnWidth,
                DefaultRowHeight = overrides.DefaultRowHeight ?? defaults.DefaultRowHeight,
                HeaderRowHeight = overrides.HeaderRowHeight ?? defaults.HeaderRowHeight,
                DataRowHeight = overrides.DataRowHeight ?? defaults.DataRowHeight,
                FreezeHeader = overrides.FreezeHeader ?? defaults.FreezeHeader,
                FreezeRows = overrides.FreezeRows ?? defaults.FreezeRows,
                FreezeColumns = overrides.FreezeColumns ?? defaults.FreezeColumns,
                AutoFilter = overrides.AutoFilter ?? defaults.AutoFilter,
                AutoFilterRange = overrides.AutoFilterRange ?? defaults.AutoFilterRange,
                AutoSizeColumns = overrides.AutoSizeColumns ?? defaults.AutoSizeColumns,
                ShowGridLines = overrides.ShowGridLines ?? defaults.ShowGridLines,
                Zoom = overrides.Zoom ?? defaults.Zoom,
                PrintOrientation = overrides.PrintOrientation ?? defaults.PrintOrientation,
                PaperSize = overrides.PaperSize ?? defaults.PaperSize,
                FitToWidth = overrides.FitToWidth ?? defaults.FitToWidth,
                FitToHeight = overrides.FitToHeight ?? defaults.FitToHeight,
                PrintArea = overrides.PrintArea ?? defaults.PrintArea,
                MarginTop = overrides.MarginTop ?? defaults.MarginTop,
                MarginRight = overrides.MarginRight ?? defaults.MarginRight,
                MarginBottom = overrides.MarginBottom ?? defaults.MarginBottom,
                MarginLeft = overrides.MarginLeft ?? defaults.MarginLeft,
                CenterHorizontally = overrides.CenterHorizontally ?? defaults.CenterHorizontally,
                CenterVertically = overrides.CenterVertically ?? defaults.CenterVertically,
                HeaderText = overrides.HeaderText ?? defaults.HeaderText,
                FooterText = overrides.FooterText ?? defaults.FooterText,
                ShowPageNumber = overrides.ShowPageNumber ?? defaults.ShowPageNumber,
                HeaderStyle = MergeExcelCellStyle(defaults.HeaderStyle, overrides.HeaderStyle),
                CellStyle = MergeExcelCellStyle(defaults.CellStyle, overrides.CellStyle)
            };
        }

        private OfficeExcelCellStyleParam MergeExcelCellStyle(
            OfficeExcelCellStyleParam defaults,
            OfficeExcelCellStyleParam overrides)
        {
            if (defaults == null && overrides == null) return null;
            defaults = defaults ?? new OfficeExcelCellStyleParam();
            overrides = overrides ?? new OfficeExcelCellStyleParam();
            return new OfficeExcelCellStyleParam
            {
                FontName = overrides.FontName ?? defaults.FontName,
                FontSize = overrides.FontSize ?? defaults.FontSize,
                FontColor = overrides.FontColor ?? defaults.FontColor,
                Bold = overrides.Bold ?? defaults.Bold,
                Italic = overrides.Italic ?? defaults.Italic,
                Underline = overrides.Underline ?? defaults.Underline,
                BackgroundColor = overrides.BackgroundColor ?? defaults.BackgroundColor,
                HorizontalAlignment = overrides.HorizontalAlignment ?? defaults.HorizontalAlignment,
                VerticalAlignment = overrides.VerticalAlignment ?? defaults.VerticalAlignment,
                WrapText = overrides.WrapText ?? defaults.WrapText,
                ShrinkToFit = overrides.ShrinkToFit ?? defaults.ShrinkToFit,
                Rotation = overrides.Rotation ?? defaults.Rotation,
                NumberFormat = overrides.NumberFormat ?? defaults.NumberFormat,
                BorderStyle = overrides.BorderStyle ?? defaults.BorderStyle,
                BorderColor = overrides.BorderColor ?? defaults.BorderColor,
                BorderTopStyle = overrides.BorderTopStyle ?? defaults.BorderTopStyle,
                BorderTopColor = overrides.BorderTopColor ?? defaults.BorderTopColor,
                BorderRightStyle = overrides.BorderRightStyle ?? defaults.BorderRightStyle,
                BorderRightColor = overrides.BorderRightColor ?? defaults.BorderRightColor,
                BorderBottomStyle = overrides.BorderBottomStyle ?? defaults.BorderBottomStyle,
                BorderBottomColor = overrides.BorderBottomColor ?? defaults.BorderBottomColor,
                BorderLeftStyle = overrides.BorderLeftStyle ?? defaults.BorderLeftStyle,
                BorderLeftColor = overrides.BorderLeftColor ?? defaults.BorderLeftColor
            };
        }

        private void ApplyExcelSheetFormatting(
            IWorkbook workbook,
            ISheet sheet,
            int dataRowCount,
            List<JObject> fieldList,
            Dictionary<string, int> expandedImageColumns,
            bool appendDefaultFields,
            OfficeExcelExportOptionsParam options)
        {
            options = options ?? new OfficeExcelExportOptionsParam();
            fieldList = fieldList ?? new List<JObject>();
            expandedImageColumns = expandedImageColumns ?? new Dictionary<string, int>();
            var styleCache = new Dictionary<string, ICellStyle>(StringComparer.Ordinal);

            var headerHeight = options.HeaderRowHeight;
            var dataHeight = options.DataRowHeight;
            foreach (var field in fieldList)
            {
                headerHeight = MaxNullable(headerHeight, GetExcelFieldDouble(field, "HeaderHeight"));
                dataHeight = MaxNullable(dataHeight, GetExcelFieldDouble(field, "RowHeight"));
            }
            if (headerHeight.HasValue && headerHeight.Value > 0 && sheet.GetRow(0) != null)
            {
                sheet.GetRow(0).HeightInPoints = (float)Math.Min(headerHeight.Value, 409.5d);
            }
            if (dataHeight.HasValue && dataHeight.Value > 0)
            {
                var height = (float)Math.Min(dataHeight.Value, 409.5d);
                for (var rowIndex = 1; rowIndex <= dataRowCount; rowIndex++)
                {
                    var dataRow = sheet.GetRow(rowIndex);
                    if (dataRow != null) dataRow.HeightInPoints = height;
                }
            }

            var columnIndex = 0;
            foreach (var field in fieldList)
            {
                var fieldName = GetExcelFieldString(field, "Name");
                var repeat = !string.IsNullOrWhiteSpace(fieldName) && expandedImageColumns.ContainsKey(fieldName)
                    ? Math.Max(1, expandedImageColumns[fieldName])
                    : 1;
                for (var repeatIndex = 0; repeatIndex < repeat; repeatIndex++)
                {
                    ApplyExcelColumnFormatting(workbook, sheet, columnIndex, dataRowCount, field, options, styleCache);
                    columnIndex++;
                }
            }

            if (appendDefaultFields)
            {
                foreach (var ignored in CommonModel.DefaultExportFields)
                {
                    ApplyExcelColumnFormatting(workbook, sheet, columnIndex, dataRowCount, null, options, styleCache);
                    columnIndex++;
                }
            }

            ApplyExcelWorksheetOptions(workbook, sheet, options, columnIndex, dataRowCount + 1);
        }

        private void ApplyExcelWorksheetOptions(
            IWorkbook workbook,
            ISheet sheet,
            OfficeExcelExportOptionsParam options,
            int columnCount,
            int rowCount)
        {
            options = options ?? new OfficeExcelExportOptionsParam();
            if (options.ShowGridLines.HasValue) sheet.DisplayGridlines = options.ShowGridLines.Value;
            if (options.DefaultRowHeight.HasValue && options.DefaultRowHeight.Value > 0)
            {
                sheet.DefaultRowHeightInPoints = (float)Math.Min(options.DefaultRowHeight.Value, 409.5d);
            }
            if (options.Zoom.HasValue) sheet.SetZoom(Math.Max(10, Math.Min(400, options.Zoom.Value)));

            var freezeColumns = Math.Min(Math.Max(0, columnCount), Math.Max(0, options.FreezeColumns ?? 0));
            var requestedFreezeRows = options.FreezeRows ?? (options.FreezeHeader == true ? 1 : 0);
            var freezeRows = Math.Min(Math.Max(0, rowCount), Math.Max(0, requestedFreezeRows));
            if (freezeColumns > 0 || freezeRows > 0) sheet.CreateFreezePane(freezeColumns, freezeRows);

            if ((options.AutoFilter == true || !string.IsNullOrWhiteSpace(options.AutoFilterRange))
                && columnCount > 0 && rowCount > 0)
            {
                var filterRange = !string.IsNullOrWhiteSpace(options.AutoFilterRange)
                    ? ParseExcelRange(options.AutoFilterRange)
                    : new CellRangeAddress(0, Math.Max(0, rowCount - 1), 0, columnCount - 1);
                sheet.SetAutoFilter(filterRange);
            }

            if (!string.IsNullOrWhiteSpace(options.PrintOrientation))
            {
                sheet.PrintSetup.Landscape = string.Equals(
                    options.PrintOrientation,
                    "Landscape",
                    StringComparison.OrdinalIgnoreCase);
            }
            var paperSize = GetExcelPaperSize(options.PaperSize);
            if (paperSize.HasValue) sheet.PrintSetup.PaperSize = paperSize.Value;
            if (options.FitToWidth.HasValue || options.FitToHeight.HasValue)
            {
                sheet.FitToPage = true;
                sheet.PrintSetup.FitWidth = (short)Math.Max(0, Math.Min(short.MaxValue, options.FitToWidth ?? 1));
                sheet.PrintSetup.FitHeight = (short)Math.Max(0, Math.Min(short.MaxValue, options.FitToHeight ?? 0));
            }
            if (!string.IsNullOrWhiteSpace(options.PrintArea))
            {
                ParseExcelRange(options.PrintArea);
                workbook.SetPrintArea(workbook.GetSheetIndex(sheet), options.PrintArea);
            }
            if (options.MarginTop.HasValue) sheet.SetMargin(MarginType.TopMargin, Math.Max(0, options.MarginTop.Value));
            if (options.MarginRight.HasValue) sheet.SetMargin(MarginType.RightMargin, Math.Max(0, options.MarginRight.Value));
            if (options.MarginBottom.HasValue) sheet.SetMargin(MarginType.BottomMargin, Math.Max(0, options.MarginBottom.Value));
            if (options.MarginLeft.HasValue) sheet.SetMargin(MarginType.LeftMargin, Math.Max(0, options.MarginLeft.Value));
            if (options.CenterHorizontally.HasValue) sheet.HorizontallyCenter = options.CenterHorizontally.Value;
            if (options.CenterVertically.HasValue) sheet.VerticallyCenter = options.CenterVertically.Value;
            if (!string.IsNullOrWhiteSpace(options.HeaderText)) sheet.Header.Center = options.HeaderText;
            if (!string.IsNullOrWhiteSpace(options.FooterText)) sheet.Footer.Center = options.FooterText;
            if (options.ShowPageNumber == true)
            {
                var pageText = "第 &P 页 / 共 &N 页";
                sheet.Footer.Right = string.IsNullOrWhiteSpace(sheet.Footer.Right)
                    ? pageText
                    : sheet.Footer.Right + "  " + pageText;
            }
        }

        private short? GetExcelPaperSize(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            switch (value.Trim().ToUpperInvariant())
            {
                case "LETTER": return 1;
                case "LEGAL": return 5;
                case "A3": return 8;
                case "A4": return 9;
                case "A5": return 11;
                default: return short.TryParse(value, out var paperSize) ? paperSize : (short?)null;
            }
        }

        private void ApplyExcelColumnFormatting(
            IWorkbook workbook,
            ISheet sheet,
            int columnIndex,
            int dataRowCount,
            JObject field,
            OfficeExcelExportOptionsParam options,
            Dictionary<string, ICellStyle> styleCache)
        {
            var headerStyle = MergeExcelCellStyle(options.HeaderStyle, GetExcelFieldStyle(field, "HeaderStyle"));
            var cellStyle = MergeExcelCellStyle(options.CellStyle, GetExcelFieldStyle(field, "Style"));
            var inlineNumberFormat = GetExcelFieldString(field, "NumberFormat");
            if (!string.IsNullOrWhiteSpace(inlineNumberFormat))
            {
                cellStyle = cellStyle ?? new OfficeExcelCellStyleParam();
                cellStyle.NumberFormat = inlineNumberFormat;
            }

            var headerCellStyle = CreateExcelCellStyle(workbook, headerStyle, styleCache);
            var dataCellStyle = CreateExcelCellStyle(workbook, cellStyle, styleCache);
            if (headerCellStyle != null)
            {
                var headerRow = sheet.GetRow(0);
                var headerCell = headerRow?.GetCell(columnIndex) ?? headerRow?.CreateCell(columnIndex);
                if (headerCell != null) headerCell.CellStyle = headerCellStyle;
            }
            if (dataCellStyle != null)
            {
                for (var rowIndex = 1; rowIndex <= dataRowCount; rowIndex++)
                {
                    var row = sheet.GetRow(rowIndex);
                    var cell = row?.GetCell(columnIndex) ?? row?.CreateCell(columnIndex);
                    if (cell != null) cell.CellStyle = dataCellStyle;
                }
            }

            var hidden = GetExcelFieldBool(field, "Hidden") == true;
            sheet.SetColumnHidden(columnIndex, hidden);

            var autoSize = GetExcelFieldBool(field, "AutoSize") ?? options.AutoSizeColumns == true;
            var width = GetExcelFieldDouble(field, "Width")
                ?? GetExcelFieldDouble(field, "ColumnWidth")
                ?? options.DefaultColumnWidth;
            var minWidth = GetExcelFieldDouble(field, "MinWidth");
            var maxWidth = GetExcelFieldDouble(field, "MaxWidth");
            if (autoSize && !hidden)
            {
                try
                {
                    sheet.AutoSizeColumn(columnIndex, true);
                }
                catch
                {
                    if (width.HasValue) SetExcelColumnWidth(sheet, columnIndex, width.Value);
                }
            }
            else if (width.HasValue)
            {
                SetExcelColumnWidth(sheet, columnIndex, width.Value);
            }

            var currentWidth = sheet.GetColumnWidth(columnIndex) / 256d;
            if (minWidth.HasValue && currentWidth < minWidth.Value)
            {
                SetExcelColumnWidth(sheet, columnIndex, minWidth.Value);
                currentWidth = minWidth.Value;
            }
            if (maxWidth.HasValue && currentWidth > maxWidth.Value)
            {
                SetExcelColumnWidth(sheet, columnIndex, maxWidth.Value);
            }
        }

        private ICellStyle CreateExcelCellStyle(
            IWorkbook workbook,
            OfficeExcelCellStyleParam param,
            Dictionary<string, ICellStyle> styleCache)
        {
            if (!HasExcelCellStyle(param)) return null;
            var cacheKey = JsonConvert.SerializeObject(param, Formatting.None);
            if (styleCache.TryGetValue(cacheKey, out var cachedStyle)) return cachedStyle;
            var style = workbook.CreateCellStyle();
            if (!string.IsNullOrWhiteSpace(param.HorizontalAlignment)
                && Enum.TryParse(param.HorizontalAlignment, true, out HorizontalAlignment horizontalAlignment))
            {
                style.Alignment = horizontalAlignment;
            }
            if (!string.IsNullOrWhiteSpace(param.VerticalAlignment)
                && Enum.TryParse(param.VerticalAlignment, true, out VerticalAlignment verticalAlignment))
            {
                style.VerticalAlignment = verticalAlignment;
            }
            if (param.WrapText.HasValue) style.WrapText = param.WrapText.Value;
            if (param.ShrinkToFit.HasValue) style.ShrinkToFit = param.ShrinkToFit.Value;
            if (param.Rotation.HasValue)
            {
                style.Rotation = (short)Math.Max(-90, Math.Min(90, (int)param.Rotation.Value));
            }
            if (!string.IsNullOrWhiteSpace(param.NumberFormat))
            {
                style.DataFormat = workbook.CreateDataFormat().GetFormat(param.NumberFormat);
            }

            var fillColor = CreateExcelColor(param.BackgroundColor);
            if (fillColor != null && style is XSSFCellStyle xssfCellStyle)
            {
                xssfCellStyle.SetFillForegroundColor(fillColor);
                style.FillPattern = FillPattern.SolidForeground;
            }

            ApplyExcelBorders(style, param);

            if (HasExcelFontStyle(param))
            {
                var font = workbook.CreateFont();
                if (!string.IsNullOrWhiteSpace(param.FontName)) font.FontName = param.FontName;
                if (param.FontSize.HasValue && param.FontSize.Value > 0)
                {
                    font.FontHeightInPoints = (short)Math.Max(1, Math.Min(409, Math.Round(param.FontSize.Value)));
                }
                if (param.Bold.HasValue) font.IsBold = param.Bold.Value;
                if (param.Italic.HasValue) font.IsItalic = param.Italic.Value;
                if (param.Underline == true) font.Underline = FontUnderlineType.Single;
                var fontColor = CreateExcelColor(param.FontColor);
                if (fontColor != null && font is XSSFFont xssfFont)
                {
                    xssfFont.SetColor(fontColor);
                }
                style.SetFont(font);
            }
            styleCache[cacheKey] = style;
            return style;
        }

        private bool HasExcelCellStyle(OfficeExcelCellStyleParam param)
        {
            return param != null && (
                HasExcelFontStyle(param)
                || !string.IsNullOrWhiteSpace(param.BackgroundColor)
                || !string.IsNullOrWhiteSpace(param.HorizontalAlignment)
                || !string.IsNullOrWhiteSpace(param.VerticalAlignment)
                || param.WrapText.HasValue
                || param.ShrinkToFit.HasValue
                || param.Rotation.HasValue
                || !string.IsNullOrWhiteSpace(param.NumberFormat)
                || !string.IsNullOrWhiteSpace(param.BorderStyle)
                || !string.IsNullOrWhiteSpace(param.BorderTopStyle)
                || !string.IsNullOrWhiteSpace(param.BorderRightStyle)
                || !string.IsNullOrWhiteSpace(param.BorderBottomStyle)
                || !string.IsNullOrWhiteSpace(param.BorderLeftStyle));
        }

        private void ApplyExcelBorders(ICellStyle style, OfficeExcelCellStyleParam param)
        {
            var topStyle = ParseExcelBorderStyle(param.BorderTopStyle ?? param.BorderStyle);
            var rightStyle = ParseExcelBorderStyle(param.BorderRightStyle ?? param.BorderStyle);
            var bottomStyle = ParseExcelBorderStyle(param.BorderBottomStyle ?? param.BorderStyle);
            var leftStyle = ParseExcelBorderStyle(param.BorderLeftStyle ?? param.BorderStyle);
            if (topStyle.HasValue) style.BorderTop = topStyle.Value;
            if (rightStyle.HasValue) style.BorderRight = rightStyle.Value;
            if (bottomStyle.HasValue) style.BorderBottom = bottomStyle.Value;
            if (leftStyle.HasValue) style.BorderLeft = leftStyle.Value;

            if (!(style is XSSFCellStyle xssfStyle)) return;
            var topColor = CreateExcelColor(param.BorderTopColor ?? param.BorderColor);
            var rightColor = CreateExcelColor(param.BorderRightColor ?? param.BorderColor);
            var bottomColor = CreateExcelColor(param.BorderBottomColor ?? param.BorderColor);
            var leftColor = CreateExcelColor(param.BorderLeftColor ?? param.BorderColor);
            if (topStyle.HasValue && topColor != null) xssfStyle.SetTopBorderColor(topColor);
            if (rightStyle.HasValue && rightColor != null) xssfStyle.SetRightBorderColor(rightColor);
            if (bottomStyle.HasValue && bottomColor != null) xssfStyle.SetBottomBorderColor(bottomColor);
            if (leftStyle.HasValue && leftColor != null) xssfStyle.SetLeftBorderColor(leftColor);
        }

        private BorderStyle? ParseExcelBorderStyle(string value)
        {
            return !string.IsNullOrWhiteSpace(value)
                && Enum.TryParse(value, true, out BorderStyle borderStyle)
                    ? borderStyle
                    : (BorderStyle?)null;
        }

        private bool HasExcelFontStyle(OfficeExcelCellStyleParam param)
        {
            return param != null && (
                !string.IsNullOrWhiteSpace(param.FontName)
                || param.FontSize.HasValue
                || !string.IsNullOrWhiteSpace(param.FontColor)
                || param.Bold.HasValue
                || param.Italic.HasValue
                || param.Underline.HasValue);
        }

        private XSSFColor CreateExcelColor(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var hex = value.Trim().TrimStart('#');
            if (hex.Length == 8) hex = hex.Substring(2);
            if (hex.Length != 6) return null;
            if (!byte.TryParse(hex.Substring(0, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var red)
                || !byte.TryParse(hex.Substring(2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var green)
                || !byte.TryParse(hex.Substring(4, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var blue))
            {
                return null;
            }
            var color = new XSSFColor();
            color.SetRgb(new[] { red, green, blue });
            return color;
        }

        private OfficeExcelCellStyleParam GetExcelFieldStyle(JObject field, string propertyName)
        {
            var token = GetExcelFieldToken(field, propertyName);
            if (token == null || token.Type == JTokenType.Null) return null;
            try
            {
                if (token.Type == JTokenType.String)
                {
                    var json = token.Value<string>();
                    return string.IsNullOrWhiteSpace(json)
                        ? null
                        : JsonConvert.DeserializeObject<OfficeExcelCellStyleParam>(json);
                }
                return token.ToObject<OfficeExcelCellStyleParam>();
            }
            catch
            {
                return null;
            }
        }

        private JToken GetExcelFieldToken(JObject field, string propertyName)
        {
            return field?.GetValue(propertyName, StringComparison.OrdinalIgnoreCase);
        }

        private string GetExcelFieldString(JObject field, string propertyName)
        {
            var token = GetExcelFieldToken(field, propertyName);
            return token == null || token.Type == JTokenType.Null ? null : token.ToString();
        }

        private double? GetExcelFieldDouble(JObject field, string propertyName)
        {
            var value = GetExcelFieldString(field, propertyName);
            return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var result)
                ? result
                : (double?)null;
        }

        private bool? GetExcelFieldBool(JObject field, string propertyName)
        {
            var value = GetExcelFieldString(field, propertyName);
            if (bool.TryParse(value, out var boolResult)) return boolResult;
            if (int.TryParse(value, out var intResult)) return intResult != 0;
            return null;
        }

        private void SetExcelColumnWidth(ISheet sheet, int columnIndex, double width)
        {
            var safeWidth = Math.Max(0.1d, Math.Min(255d, width));
            sheet.SetColumnWidth(columnIndex, (int)Math.Round(safeWidth * 256d));
        }

        private double? MaxNullable(double? left, double? right)
        {
            if (!left.HasValue) return right;
            if (!right.HasValue) return left;
            return Math.Max(left.Value, right.Value);
        }
    }
}
