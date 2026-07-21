using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;

namespace Microi.net
{
    public partial class MicroiOffice
    {
        private sealed class ExcelLayoutCellState
        {
            public bool HasValue { get; set; }
            public object Value { get; set; }
            public string Formula { get; set; }
            public string DataType { get; set; }
            public OfficeExcelCellStyleParam Style { get; set; }
        }

        private DosResult<byte[]> ExportExcelLayout(DiyTableRowParam param)
        {
            try
            {
                IWorkbook workbook = new XSSFWorkbook();
                var sheetName = GetSafeExcelSheetName(
                    workbook,
                    param.ExcelOptions?.SheetName,
                    1);
                WriteExportExcelLayoutSheet(workbook, sheetName, param.ExcelLayout, param.ExcelOptions);
                using (var stream = new System.IO.MemoryStream())
                {
                    workbook.Write(stream);
                    UserBehaviorAudit.Track(param, "Data", "DataExport", "导出数据", "Table",
                        param.TableId.DosIsNullOrWhiteSpace(param.FormEngineKey),
                        $"导出了高级布局工作表[{sheetName}]、[{param.ExcelLayout?.Cells?.Count ?? 0}]个单元配置",
                        new
                        {
                            TableId = param.TableId,
                            Table = param.FormEngineKey,
                            SheetName = sheetName,
                            LayoutCellCount = param.ExcelLayout?.Cells?.Count ?? 0
                        });
                    return new DosResult<byte[]>(1, stream.ToArray());
                }
            }
            catch (Exception ex)
            {
                UserBehaviorAudit.Track(param, "Data", "DataExport", "导出数据", "Table",
                    param?.TableId.DosIsNullOrWhiteSpace(param?.FormEngineKey),
                    "导出高级布局工作表失败",
                    new { TableId = param?.TableId, Table = param?.FormEngineKey, Error = ex.Message }, false);
                return new DosResult<byte[]>(0, null, ex.Message);
            }
        }

        private void WriteExportExcelLayoutSheet(
            IWorkbook workbook,
            string sheetName,
            OfficeExcelLayoutParam layout,
            OfficeExcelExportOptionsParam options)
        {
            layout = layout ?? new OfficeExcelLayoutParam();
            options = options ?? new OfficeExcelExportOptionsParam();
            var sheet = workbook.CreateSheet(sheetName);
            var states = new Dictionary<long, ExcelLayoutCellState>();
            var mergedRanges = new List<CellRangeAddress>();
            var styleCache = new Dictionary<string, ICellStyle>(StringComparer.Ordinal);
            var maxRowIndex = -1;
            var maxColumnIndex = -1;

            foreach (var item in layout.Cells ?? new List<OfficeExcelLayoutCellParam>())
            {
                if (item == null || string.IsNullOrWhiteSpace(item.Range)) continue;
                var range = ParseExcelRange(item.Range);
                maxRowIndex = Math.Max(maxRowIndex, range.LastRow);
                maxColumnIndex = Math.Max(maxColumnIndex, range.LastColumn);
                for (var rowIndex = range.FirstRow; rowIndex <= range.LastRow; rowIndex++)
                {
                    for (var columnIndex = range.FirstColumn; columnIndex <= range.LastColumn; columnIndex++)
                    {
                        var state = GetExcelLayoutCellState(states, rowIndex, columnIndex);
                        state.Style = MergeExcelCellStyle(state.Style, item.Style);
                    }
                }

                var firstCellState = GetExcelLayoutCellState(states, range.FirstRow, range.FirstColumn);
                if (item.Value != null || !string.IsNullOrWhiteSpace(item.Formula)
                    || string.Equals(item.DataType, "Blank", StringComparison.OrdinalIgnoreCase))
                {
                    firstCellState.HasValue = true;
                    firstCellState.Value = item.Value;
                    firstCellState.Formula = item.Formula;
                    firstCellState.DataType = item.DataType;
                }
                if (item.Merge == true) AddExcelMergedRange(mergedRanges, range);
            }

            foreach (var rangeText in layout.MergedRanges ?? new List<string>())
            {
                if (string.IsNullOrWhiteSpace(rangeText)) continue;
                var range = ParseExcelRange(rangeText);
                maxRowIndex = Math.Max(maxRowIndex, range.LastRow);
                maxColumnIndex = Math.Max(maxColumnIndex, range.LastColumn);
                AddExcelMergedRange(mergedRanges, range);
            }

            foreach (var rowConfig in layout.Rows ?? new List<OfficeExcelLayoutRowParam>())
            {
                if (rowConfig == null || rowConfig.Row < 1) continue;
                var rowIndex = rowConfig.Row - 1;
                maxRowIndex = Math.Max(maxRowIndex, rowIndex);
                var row = sheet.GetRow(rowIndex) ?? sheet.CreateRow(rowIndex);
                if (rowConfig.Height.HasValue && rowConfig.Height.Value > 0)
                {
                    row.HeightInPoints = (float)Math.Min(rowConfig.Height.Value, 409.5d);
                }
                if (rowConfig.Hidden.HasValue) row.ZeroHeight = rowConfig.Hidden.Value;
            }

            foreach (var pair in states.OrderBy(item => item.Key))
            {
                GetExcelCellAddress(pair.Key, out var rowIndex, out var columnIndex);
                var row = sheet.GetRow(rowIndex) ?? sheet.CreateRow(rowIndex);
                var cell = row.GetCell(columnIndex) ?? row.CreateCell(columnIndex);
                if (pair.Value.HasValue) SetExcelLayoutCellValue(cell, pair.Value);
                var finalStyle = MergeExcelCellStyle(options.CellStyle, pair.Value.Style);
                var cellStyle = CreateExcelCellStyle(workbook, finalStyle, styleCache);
                if (cellStyle != null) cell.CellStyle = cellStyle;
            }

            foreach (var range in mergedRanges)
            {
                if (range.FirstRow != range.LastRow || range.FirstColumn != range.LastColumn)
                {
                    sheet.AddMergedRegion(range);
                }
            }

            if (options.DefaultColumnWidth.HasValue && maxColumnIndex >= 0)
            {
                for (var columnIndex = 0; columnIndex <= maxColumnIndex; columnIndex++)
                {
                    SetExcelColumnWidth(sheet, columnIndex, options.DefaultColumnWidth.Value);
                }
            }
            foreach (var columnConfig in layout.Columns ?? new List<OfficeExcelLayoutColumnParam>())
            {
                if (columnConfig == null) continue;
                var columnIndex = GetExcelLayoutColumnIndex(columnConfig);
                if (columnIndex < 0) continue;
                maxColumnIndex = Math.Max(maxColumnIndex, columnIndex);
                if (columnConfig.Width.HasValue) SetExcelColumnWidth(sheet, columnIndex, columnConfig.Width.Value);
                if (columnConfig.Hidden.HasValue) sheet.SetColumnHidden(columnIndex, columnConfig.Hidden.Value);
                if (columnConfig.AutoSize == true && columnConfig.Hidden != true)
                {
                    sheet.AutoSizeColumn(columnIndex, true);
                }
                var currentWidth = sheet.GetColumnWidth(columnIndex) / 256d;
                if (columnConfig.MinWidth.HasValue && currentWidth < columnConfig.MinWidth.Value)
                {
                    SetExcelColumnWidth(sheet, columnIndex, columnConfig.MinWidth.Value);
                    currentWidth = columnConfig.MinWidth.Value;
                }
                if (columnConfig.MaxWidth.HasValue && currentWidth > columnConfig.MaxWidth.Value)
                {
                    SetExcelColumnWidth(sheet, columnIndex, columnConfig.MaxWidth.Value);
                }
            }

            foreach (var group in layout.RowGroups ?? new List<OfficeExcelLayoutRowGroupParam>())
            {
                if (group == null || group.StartRow < 1 || group.EndRow < group.StartRow) continue;
                var firstRow = group.StartRow - 1;
                var lastRow = group.EndRow - 1;
                maxRowIndex = Math.Max(maxRowIndex, lastRow);
                sheet.GroupRow(firstRow, lastRow);
                if (group.Collapsed.HasValue) sheet.SetRowGroupCollapsed(firstRow, group.Collapsed.Value);
            }

            ApplyExcelWorksheetOptions(
                workbook,
                sheet,
                options,
                maxColumnIndex + 1,
                maxRowIndex + 1);
            sheet.ForceFormulaRecalculation = true;
        }

        private CellRangeAddress ParseExcelRange(string value)
        {
            var rangeText = (value ?? string.Empty).Trim().Replace("$", string.Empty);
            if (string.IsNullOrWhiteSpace(rangeText) || rangeText.Contains("!"))
            {
                throw new ArgumentException($"Excel Range 无效：{value}");
            }
            CellRangeAddress range;
            if (rangeText.Contains(":"))
            {
                range = CellRangeAddress.ValueOf(rangeText);
            }
            else
            {
                var cell = new CellReference(rangeText);
                range = new CellRangeAddress(cell.Row, cell.Row, cell.Col, cell.Col);
            }
            if (range.FirstRow < 0 || range.LastRow > 1048575
                || range.FirstColumn < 0 || range.LastColumn > 16383)
            {
                throw new ArgumentOutOfRangeException(nameof(value), $"Excel Range 超出 xlsx 限制：{value}");
            }
            return range;
        }

        private void AddExcelMergedRange(List<CellRangeAddress> ranges, CellRangeAddress range)
        {
            if (range.FirstRow == range.LastRow && range.FirstColumn == range.LastColumn) return;
            foreach (var existing in ranges)
            {
                var intersects = range.FirstRow <= existing.LastRow && range.LastRow >= existing.FirstRow
                    && range.FirstColumn <= existing.LastColumn && range.LastColumn >= existing.FirstColumn;
                if (intersects)
                {
                    if (range.FirstRow == existing.FirstRow && range.LastRow == existing.LastRow
                        && range.FirstColumn == existing.FirstColumn && range.LastColumn == existing.LastColumn)
                    {
                        return;
                    }
                    throw new ArgumentException($"Excel 合并区域互相重叠：{existing.FormatAsString()} 与 {range.FormatAsString()}");
                }
            }
            ranges.Add(range);
        }

        private ExcelLayoutCellState GetExcelLayoutCellState(
            Dictionary<long, ExcelLayoutCellState> states,
            int rowIndex,
            int columnIndex)
        {
            var key = GetExcelCellKey(rowIndex, columnIndex);
            if (!states.TryGetValue(key, out var state))
            {
                state = new ExcelLayoutCellState();
                states[key] = state;
            }
            return state;
        }

        private long GetExcelCellKey(int rowIndex, int columnIndex)
        {
            return ((long)rowIndex << 20) | (uint)columnIndex;
        }

        private void GetExcelCellAddress(long key, out int rowIndex, out int columnIndex)
        {
            rowIndex = (int)(key >> 20);
            columnIndex = (int)(key & 0xFFFFF);
        }

        private int GetExcelLayoutColumnIndex(OfficeExcelLayoutColumnParam column)
        {
            if (!string.IsNullOrWhiteSpace(column.Column))
            {
                var value = column.Column.Trim().Replace("$", string.Empty);
                return CellReference.ConvertColStringToIndex(value);
            }
            return column.Index.HasValue ? column.Index.Value - 1 : -1;
        }

        private void SetExcelLayoutCellValue(ICell cell, ExcelLayoutCellState state)
        {
            if (!string.IsNullOrWhiteSpace(state.Formula))
            {
                cell.SetCellFormula(state.Formula.Trim().TrimStart('='));
                return;
            }
            var value = state.Value;
            if (value is JValue jValue) value = jValue.Value;
            if (value is JToken token && !(token is JValue)) value = token.ToString(Formatting.None);
            var dataType = (state.DataType ?? string.Empty).Trim().ToLowerInvariant();
            if (dataType == "blank" || value == null)
            {
                cell.SetCellType(CellType.Blank);
                return;
            }
            if (dataType == "string")
            {
                cell.SetCellValue(Convert.ToString(value, CultureInfo.InvariantCulture));
                return;
            }
            if (dataType == "number")
            {
                cell.SetCellValue(Convert.ToDouble(value, CultureInfo.InvariantCulture));
                return;
            }
            if (dataType == "boolean")
            {
                cell.SetCellValue(Convert.ToBoolean(value, CultureInfo.InvariantCulture));
                return;
            }
            if (dataType == "datetime" || dataType == "date")
            {
                if (value is DateTime dateTime)
                {
                    cell.SetCellValue(dateTime);
                    return;
                }
                if (DateTime.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), CultureInfo.InvariantCulture,
                    DateTimeStyles.AllowWhiteSpaces, out var parsedDate))
                {
                    cell.SetCellValue(parsedDate);
                    return;
                }
                throw new FormatException($"Excel 日期值无法解析：{value}");
            }

            switch (value)
            {
                case bool boolValue:
                    cell.SetCellValue(boolValue);
                    break;
                case DateTime dateValue:
                    cell.SetCellValue(dateValue);
                    break;
                case byte _:
                case sbyte _:
                case short _:
                case ushort _:
                case int _:
                case uint _:
                case long _:
                case ulong _:
                case float _:
                case double _:
                case decimal _:
                    cell.SetCellValue(Convert.ToDouble(value, CultureInfo.InvariantCulture));
                    break;
                default:
                    cell.SetCellValue(Convert.ToString(value, CultureInfo.InvariantCulture));
                    break;
            }
        }
    }
}
