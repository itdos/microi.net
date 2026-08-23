using System.Collections.Generic;
using NPOI.HSSF.UserModel;
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;
using System.IO;
using System.Data;
using System;
using System.Dynamic;
using Dos.Common;
using System.Globalization;
using System.Linq;

namespace Microi.net
{
    public class NPOIHelper
    {

        public NPOIHelper() { }

        /// <summary>
        /// 文件流初始化对象
        /// </summary>
        /// <param name="stream"></param>
        public NPOIHelper(Stream stream)
        {
            _IWorkbook = CreateWorkbook(stream);
        }
        /// <summary>
        /// 文件流初始化对象
        /// </summary>
        /// <param name="stream"></param>
        public NPOIHelper(byte[] bytes)
        {
            var stream = StreamHelper.BytesToStream(bytes);
            _IWorkbook = CreateWorkbook(stream);
        }
        /// <summary>
        /// 传入文件名
        /// </summary>
        /// <param name="fileName"></param>
        public NPOIHelper(string fileName)
        {
            using (FileStream fileStream = new FileStream(fileName, FileMode.Open, FileAccess.Read))
            {
                _IWorkbook = CreateWorkbook(fileStream);
            }
        }

        /// <summary>
        /// 工作薄
        /// </summary>
        private IWorkbook _IWorkbook;

        /// <summary>
        /// 创建工作簿对象
        /// </summary>
        /// <param name="stream"></param>
        /// <returns></returns>
        private IWorkbook CreateWorkbook(Stream stream)
        {
            if (stream == null)
            {
                throw new ArgumentException("Excel文件流为空。");
            }
            var bytes = ReadAllBytes(stream);

            //XSSFWorkbook 适用XLSX格式，HSSFWorkbook 适用XLS格式
            Exception xlsxException = null;
            try
            {
                var xssfWorkbook = new XSSFWorkbook(new MemoryStream(bytes)); //07
                if (xssfWorkbook.NumberOfSheets > 0)
                {
                    return xssfWorkbook;
                }
                xlsxException = new ArgumentException("XLSX读取成功但未识别到任何Sheet。");
            }
            catch (Exception ex)
            {
                xlsxException = ex;
            }

            try
            {
                var hssfWorkbook = new HSSFWorkbook(new MemoryStream(bytes)); //03
                if (hssfWorkbook.NumberOfSheets > 0)
                {
                    return hssfWorkbook;
                }
                throw new ArgumentException("XLS读取成功但未识别到任何Sheet。");
            }
            catch (Exception xlsException)
            {
                throw new ArgumentException(
                    $"无法识别Excel工作簿，请确认文件是真实的.xls/.xlsx文件且至少包含一个Sheet。XLSX读取错误：{xlsxException?.Message}；XLS读取错误：{xlsException.Message}",
                    xlsException);
            }
        }

        private static byte[] ReadAllBytes(Stream stream)
        {
            ResetStream(stream);
            using (var memoryStream = new MemoryStream())
            {
                stream.CopyTo(memoryStream);
                return memoryStream.ToArray();
            }
        }

        private static void ResetStream(Stream stream)
        {
            if (stream != null && stream.CanSeek)
            {
                stream.Position = 0;
            }
        }

        /// <summary>
        /// 把Sheet中的数据转换为DataTable
        /// </summary>
        /// <param name="sheet"></param>
        /// <returns></returns>
        private DataTable ExportToDataTable(ISheet sheet)
        {
            DataTable dt = new DataTable();

            //默认，第一行是字段
            IRow headRow = sheet.GetRow(0);

            //设置datatable字段
            for (int i = headRow.FirstCellNum, len = headRow.LastCellNum; i < len; i++)
            {
                dt.Columns.Add(headRow.Cells[i].StringCellValue);
            }
            //遍历数据行
            for (int i = (sheet.FirstRowNum + 1), len = sheet.LastRowNum + 1; i < len; i++)
            {
                IRow tempRow = sheet.GetRow(i);
                DataRow dataRow = dt.NewRow();

                //遍历一行的每一个单元格
                for (int r = 0, j = tempRow.FirstCellNum, len2 = tempRow.LastCellNum; j < len2; j++, r++)
                {

                    ICell cell = tempRow.GetCell(j);

                    if (cell != null)
                    {
                        switch (cell.CellType)
                        {
                            case CellType.String:
                                dataRow[r] = cell.StringCellValue;
                                break;
                            case CellType.Numeric:
                                dataRow[r] = cell.NumericCellValue;
                                break;
                            case CellType.Boolean:
                                dataRow[r] = cell.BooleanCellValue;
                                break;
                            default:
                                dataRow[r] = "";
                                break;
                        }
                    }
                }
                dt.Rows.Add(dataRow);
            }
            return dt;
        }

        /// <summary>
        /// Sheet中的数据转换为List集合
        /// </summary>
        /// <param name="sheet"></param>
        /// <param name="fields"></param>
        /// <returns></returns>
        private IList<T> ExportToList<T>(ISheet sheet, string[] fields) where T : class, new()
        {
            IList<T> list = new List<T>();

            //遍历每一行数据
            for (int i = sheet.FirstRowNum + 1, len = sheet.LastRowNum + 1; i < len; i++)
            {
                T t = new T();
                IRow row = sheet.GetRow(i);

                for (int j = 0, len2 = fields.Length; j < len2; j++)
                {
                    ICell cell = row.GetCell(j);
                    object cellValue = null;
                    if (cell == null)
                    {
                        continue;
                    }
                    switch (cell.CellType)
                    {
                        case CellType.String: //文本
                            cellValue = cell.StringCellValue;
                            break;
                        case CellType.Numeric: //数值
                            cellValue = cell.NumericCellValue;//Double转换为int
                            break;
                        case CellType.Boolean: //bool
                            cellValue = cell.BooleanCellValue;
                            break;
                        case CellType.Blank: //空白
                            cellValue = "";
                            break;
                        default:
                            cellValue = "";
                            break;
                    }
                    typeof(T).GetProperty(fields[j]).SetValue(t, cellValue, null);
                }
                list.Add(t);
            }

            return list;
        }

        /// <summary>
        /// 获取第一个Sheet的第X行，第Y列的值。起始点为1
        /// </summary>
        /// <param name="X">行</param>
        /// <param name="Y">列</param>
        /// <returns></returns>
        public string GetCellValue(int X, int Y)
        {
            ISheet sheet = _IWorkbook.GetSheetAt(0);

            IRow row = sheet.GetRow(X - 1);

            return row.GetCell(Y - 1).ToString();
        }

        /// <summary>
        /// 获取一行的所有数据
        /// </summary>
        /// <param name="X">第x行</param>
        /// <returns></returns>
        public string[] GetCells(int X)
        {
            List<string> list = new List<string>();

            ISheet sheet = _IWorkbook.GetSheetAt(0);

            IRow row = sheet.GetRow(X - 1);

            for (int i = 0, len = row.LastCellNum; i < len; i++)
            {
                list.Add(row.GetCell(i).StringCellValue);//这里没有考虑数据格式转换，会出现bug
            }
            return list.ToArray();
        }

        /// <summary>
        /// 第一个Sheet数据，转换为DataTable
        /// </summary>
        /// <returns></returns>
        public DataTable ExportExcelToDataTable()
        {
            return ExportToDataTable(_IWorkbook.GetSheetAt(0));
        }

        /// <summary>
        /// 第sheetIndex表数据，转换为DataTable
        /// </summary>
        /// <param name="sheetIndex">第几个Sheet，从1开始</param>
        /// <returns></returns>
        public DataTable ExportExcelToDataTable(int sheetIndex)
        {
            return ExportToDataTable(_IWorkbook.GetSheetAt(sheetIndex - 1));
        }


        /// <summary>
        /// Excel中默认第一张Sheet导出到集合
        /// </summary>
        /// <param name="fields">Excel各个列，依次要转换成为的对象字段名称</param>
        /// <returns></returns>
        public IList<T> ExcelToList<T>(string[] fields) where T : class, new()
        {
            return ExportToList<T>(_IWorkbook.GetSheetAt(0), fields);
        }


        /// <summary>
        /// Excel中指定的Sheet导出到集合
        /// </summary>
        /// <param name="sheetIndex">第几张Sheet,从1开始</param>
        /// <param name="fields">Excel各个列，依次要转换成为的对象字段名称</param>
        /// <returns></returns>
        public IList<T> ExcelToList<T>(int sheetIndex, string[] fields) where T : class, new()
        {
            return ExportToList<T>(_IWorkbook.GetSheetAt(sheetIndex - 1), fields);
        }

        public List<dynamic> ExcelToListDynamic(
            int sheetIndex = 0,
            int? maxDataRows = null,
            int? maxColumns = null,
            int? headerStartRow = null,
            int? headerEndRow = null,
            int? dataStartRow = null,
            int? dataEndRow = null,
            IEnumerable<ExcelImportColumnParam> columnMappings = null)
        {
            if (_IWorkbook == null)
            {
                throw new ArgumentException("Excel工作簿初始化失败。");
            }
            if (_IWorkbook.NumberOfSheets <= 0)
            {
                throw new ArgumentException("Excel文件未识别到任何Sheet，请检查文件是否损坏或是否为真实的Excel文件。");
            }
            if (sheetIndex < 0 || sheetIndex >= _IWorkbook.NumberOfSheets)
            {
                throw new ArgumentException($"Sheet索引({sheetIndex})超出范围，当前文件共有{_IWorkbook.NumberOfSheets}个Sheet。");
            }
            var sheet = _IWorkbook.GetSheetAt(sheetIndex);
            if (sheet == null)
            {
                throw new ArgumentException($"未读取到第{sheetIndex + 1}个Sheet，请检查Excel文件内容。");
            }
            return ExcelToListDynamic(
                sheet,
                maxDataRows,
                maxColumns,
                headerStartRow,
                headerEndRow,
                dataStartRow,
                dataEndRow,
                columnMappings);
        }

        private sealed class ExcelDynamicColumnDefinition
        {
            public int ColumnIndex { get; set; }
            public string FieldName { get; set; }
        }

        private static int ExcelColumnNameToIndex(string column)
        {
            if (column.DosIsNullOrWhiteSpace()) return -1;
            var value = 0;
            foreach (var character in column.Trim().ToUpperInvariant())
            {
                if (character < 'A' || character > 'Z') return -1;
                value = value * 26 + character - 'A' + 1;
            }
            return value - 1;
        }

        private static ICell GetMergedAnchorCell(ISheet sheet, int rowIndex, int columnIndex)
        {
            for (var mergeIndex = 0; mergeIndex < sheet.NumMergedRegions; mergeIndex++)
            {
                var range = sheet.GetMergedRegion(mergeIndex);
                if (range != null && range.IsInRange(rowIndex, columnIndex))
                {
                    return sheet.GetRow(range.FirstRow)?.GetCell(range.FirstColumn);
                }
            }
            return sheet.GetRow(rowIndex)?.GetCell(columnIndex);
        }

        private static object GetExcelCellValue(ICell cell, IFormulaEvaluator evaluator, DataFormatter formatter)
        {
            if (cell == null) return null;
            try
            {
                if (cell.CellType == CellType.Formula)
                {
                    var formulaValue = formatter.FormatCellValue(cell, evaluator)?.Trim();
                    return formulaValue.DosIsNullOrWhiteSpace() ? null : formulaValue;
                }
                switch (cell.CellType)
                {
                    case CellType.String:
                        var text = cell.StringCellValue?.Trim();
                        return text.DosIsNullOrWhiteSpace() ? null : text;
                    case CellType.Numeric:
                        if (DateUtil.IsValidExcelDate(cell.NumericCellValue) && DateUtil.IsCellDateFormatted(cell))
                        {
                            return cell.DateCellValue?.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
                        }
                        return cell.NumericCellValue.ToString(CultureInfo.InvariantCulture);
                    case CellType.Boolean:
                        return cell.BooleanCellValue;
                    default:
                        return null;
                }
            }
            catch
            {
                var fallback = formatter.FormatCellValue(cell, evaluator)?.Trim();
                return fallback.DosIsNullOrWhiteSpace() ? null : fallback;
            }
        }

        private static string BuildExcelHeader(
            ISheet sheet,
            int headerStartIndex,
            int headerEndIndex,
            int columnIndex,
            IFormulaEvaluator evaluator,
            DataFormatter formatter)
        {
            var values = new List<string>();
            for (var rowIndex = headerStartIndex; rowIndex <= headerEndIndex; rowIndex++)
            {
                var value = GetExcelCellValue(
                    GetMergedAnchorCell(sheet, rowIndex, columnIndex),
                    evaluator,
                    formatter)?.ToString()?.Trim();
                if (!value.DosIsNullOrWhiteSpace() && (values.Count == 0 || values.Last() != value))
                {
                    values.Add(value);
                }
            }
            return string.Join(" / ", values);
        }

        private List<dynamic> ExcelToListDynamic(
            ISheet sheet,
            int? maxDataRows,
            int? maxColumns,
            int? headerStartRow,
            int? headerEndRow,
            int? dataStartRow,
            int? dataEndRow,
            IEnumerable<ExcelImportColumnParam> columnMappings)
        {
            if (sheet == null) throw new ArgumentException("Excel Sheet为空。");

            var firstRowNumber = sheet.FirstRowNum + 1;
            var lastRowNumber = sheet.LastRowNum + 1;
            var normalizedHeaderStartRow = headerStartRow ?? firstRowNumber;
            var normalizedHeaderEndRow = headerEndRow ?? normalizedHeaderStartRow;
            var normalizedDataStartRow = dataStartRow ?? normalizedHeaderEndRow + 1;
            var normalizedDataEndRow = Math.Min(dataEndRow ?? lastRowNumber, lastRowNumber);
            if (normalizedHeaderStartRow < firstRowNumber || normalizedHeaderStartRow > lastRowNumber)
            {
                throw new ArgumentException($"表头起始行{normalizedHeaderStartRow}超出Sheet有效范围{firstRowNumber}-{lastRowNumber}。");
            }
            if (normalizedHeaderEndRow < normalizedHeaderStartRow || normalizedHeaderEndRow >= normalizedDataStartRow)
            {
                throw new ArgumentException("表头行范围无效，表头结束行必须不小于起始行且位于数据起始行之前。");
            }
            if (normalizedDataStartRow < firstRowNumber || normalizedDataEndRow < normalizedDataStartRow)
            {
                throw new ArgumentException("数据行范围无效，请确认数据起始行和结束行。");
            }

            var configuredColumns = (columnMappings ?? Enumerable.Empty<ExcelImportColumnParam>())
                .Where(item => item != null)
                .ToList();
            if (maxColumns.HasValue && configuredColumns.Count > maxColumns.Value)
            {
                throw new ArgumentException($"Excel有效列数{configuredColumns.Count}超过上限{maxColumns.Value}，请精简后导入。");
            }

            var evaluator = _IWorkbook.GetCreationHelper().CreateFormulaEvaluator();
            var formatter = new DataFormatter();
            var columnDefinitions = new List<ExcelDynamicColumnDefinition>();
            if (configuredColumns.Any())
            {
                var fieldNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var mapping in configuredColumns)
                {
                    var columnIndex = mapping.ColumnIndex ?? ExcelColumnNameToIndex(mapping.Column);
                    var fieldName = !mapping.Name.DosIsNullOrWhiteSpace()
                        ? mapping.Name.Trim()
                        : (!mapping.Label.DosIsNullOrWhiteSpace() ? mapping.Label.Trim() : mapping.Header?.Trim());
                    if (columnIndex < 0 || fieldName.DosIsNullOrWhiteSpace())
                    {
                        throw new ArgumentException("Excel列映射包含无效的列索引或目标字段。");
                    }
                    if (!fieldNames.Add(fieldName))
                    {
                        throw new ArgumentException($"Excel列映射中的目标字段[{fieldName}]重复。");
                    }
                    columnDefinitions.Add(new ExcelDynamicColumnDefinition
                    {
                        ColumnIndex = columnIndex,
                        FieldName = fieldName
                    });
                }
            }
            else
            {
                var lastCellIndex = -1;
                for (var rowIndex = normalizedHeaderStartRow - 1; rowIndex <= normalizedHeaderEndRow - 1; rowIndex++)
                {
                    var row = sheet.GetRow(rowIndex);
                    if (row != null) lastCellIndex = Math.Max(lastCellIndex, row.LastCellNum - 1);
                }
                if (lastCellIndex < 0)
                {
                    throw new ArgumentException($"Excel Sheet[{sheet.SheetName}]表头为空，请确认指定行包含字段标题。");
                }
                var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                for (var columnIndex = 0; columnIndex <= lastCellIndex; columnIndex++)
                {
                    var fieldName = BuildExcelHeader(
                        sheet,
                        normalizedHeaderStartRow - 1,
                        normalizedHeaderEndRow - 1,
                        columnIndex,
                        evaluator,
                        formatter);
                    if (fieldName.DosIsNullOrWhiteSpace()) continue;
                    var uniqueName = fieldName;
                    var suffix = 2;
                    while (!usedNames.Add(uniqueName)) uniqueName = $"{fieldName}_{suffix++}";
                    columnDefinitions.Add(new ExcelDynamicColumnDefinition
                    {
                        ColumnIndex = columnIndex,
                        FieldName = uniqueName
                    });
                }
            }

            if (!columnDefinitions.Any())
            {
                throw new ArgumentException($"Excel Sheet[{sheet.SheetName}]未读取到有效表头或列映射。");
            }
            if (maxColumns.HasValue && columnDefinitions.Count > maxColumns.Value)
            {
                throw new ArgumentException($"Excel有效列数{columnDefinitions.Count}超过上限{maxColumns.Value}，请精简后导入。");
            }
            if (maxDataRows.HasValue
                && normalizedDataEndRow - normalizedDataStartRow + 1 > maxDataRows.Value * 5L)
            {
                throw new ArgumentException("Excel数据范围包含过多空行，请重新指定紧凑的数据起止行。");
            }

            var list = new List<dynamic>();
            var enhancedMode = headerStartRow.HasValue
                || headerEndRow.HasValue
                || dataStartRow.HasValue
                || dataEndRow.HasValue
                || configuredColumns.Any();
            for (var rowNumber = normalizedDataStartRow; rowNumber <= normalizedDataEndRow; rowNumber++)
            {
                var row = sheet.GetRow(rowNumber - 1);
                if (row == null) continue;
                dynamic expandoObject = new ExpandoObject();
                var dictionary = (IDictionary<string, object>)expandoObject;
                var hasValue = false;
                foreach (var column in columnDefinitions)
                {
                    var value = GetExcelCellValue(row.GetCell(column.ColumnIndex), evaluator, formatter);
                    dictionary[column.FieldName] = value;
                    if (value != null && !value.ToString().DosIsNullOrWhiteSpace()) hasValue = true;
                }
                if (!hasValue) continue;
                if (maxDataRows.HasValue && list.Count >= maxDataRows.Value)
                {
                    throw new ArgumentException($"Excel数据行数超过上限{maxDataRows.Value}，请拆分后导入。");
                }
                if (enhancedMode) dictionary["_ExcelRow"] = rowNumber;
                list.Add(expandoObject);
            }
            return list;
        }
    }
}
