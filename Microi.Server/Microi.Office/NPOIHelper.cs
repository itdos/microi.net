using System.Collections.Generic;
using NPOI.HSSF.UserModel;
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;
using System.IO;
using System.Data;
using System;
using System.Dynamic;
using Dos.Common;

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
            int? maxColumns = null)
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
            return ExcelToListDynamic(sheet, maxDataRows, maxColumns);
        }
        private List<dynamic> ExcelToListDynamic(
            ISheet sheet,
            int? maxDataRows,
            int? maxColumns)
        {
            var list = new List<dynamic>();
            if (sheet == null)
            {
                throw new ArgumentException("Excel Sheet为空。");
            }
            var headRow = sheet.GetRow(sheet.FirstRowNum);
            if (headRow == null)
            {
                throw new ArgumentException($"Excel Sheet[{sheet.SheetName}]未读取到表头行，请确认第一行是字段标题。");
            }
            var cells = headRow.Cells;
            if (cells == null || cells.Count == 0)
            {
                throw new ArgumentException($"Excel Sheet[{sheet.SheetName}]表头为空，请确认第一行是字段标题。");
            }
            var dataRowCount = Math.Max(0, sheet.LastRowNum - sheet.FirstRowNum);
            if (maxDataRows.HasValue && dataRowCount > maxDataRows.Value)
            {
                throw new ArgumentException(
                    $"Excel数据行数{dataRowCount}超过上限{maxDataRows.Value}，请拆分后导入。");
            }
            var fields = new List<string>();
            foreach (var cell in cells)
            {
                var fieldName = cell?.ToString();
                if (!fieldName.DosIsNullOrWhiteSpace())
                {
                    fields.Add(fieldName.Trim());
                }
            }
            if (fields.Count == 0)
            {
                throw new ArgumentException($"Excel Sheet[{sheet.SheetName}]未读取到有效表头，请确认第一行是字段标题。");
            }
            if (maxColumns.HasValue && fields.Count > maxColumns.Value)
            {
                throw new ArgumentException(
                    $"Excel有效列数{fields.Count}超过上限{maxColumns.Value}，请精简后导入。");
            }

            //遍历每一行数据
            for (int i = sheet.FirstRowNum + 1, len = sheet.LastRowNum + 1; i < len; i++)
            {
                dynamic expandoObject = new ExpandoObject();
                IDictionary<string, object> dictionary = (IDictionary<string, object>)expandoObject;
                IRow row = sheet.GetRow(i);
                if (row != null)
                {
                    #region 如果第一列的值就为空了，整行不要
                    ICell cell1 = row.GetCell(0);
                    if (cell1 == null)
                    {
                        continue;
                    }
                    object cellValue1 = null;
                    switch (cell1.CellType)
                    {
                        case CellType.String: //文本
                            cellValue1 = cell1.StringCellValue;
                            break;
                        case CellType.Numeric: //数值
                            cellValue1 = cell1.NumericCellValue;//Double转换为int.。//2020-06-17是哪个SB说要转成int的？不要5.20这种小数点？
                            break;
                        case CellType.Boolean: //bool
                            cellValue1 = cell1.BooleanCellValue;
                            break;
                        case CellType.Blank: //空白
                            cellValue1 = "";
                            break;
                        default:
                            cellValue1 = "";
                            break;
                    }
                    if (cellValue1 == null || cellValue1.ToString().DosIsNullOrWhiteSpace())
                    {
                        continue;
                    }
                    #endregion


                    for (int j = 0, len2 = fields.Count; j < len2; j++)
                    {
                        try
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
                                case CellType.Numeric: //数值。注意：日期也是数值，所以这里要判断
                                    if (DateUtil.IsValidExcelDate(cell.NumericCellValue) && DateUtil.IsCellDateFormatted(cell))
                                    {
                                        DateTime D = row.GetCell(j).DateCellValue.Value;
                                        cellValue = (D.ToString().Length == 0 || D.ToString().Contains("#")) ? "" : D.ToString();
                                    }
                                    else
                                    {
                                        double strValue = cell.NumericCellValue;
                                        cellValue = (strValue.ToString().Length == 0 || strValue.ToString().Contains("#")) ? "" : strValue.ToString();
                                    }
                                    //cellValue = cell.NumericCellValue;//Double转换为int.。//2020-06-17是哪个SB说要转成int的？不要5.20这种小数点？
                                    break;
                                case CellType.Boolean: //bool
                                    cellValue = cell.BooleanCellValue;
                                    break;
                                case CellType.Blank: //空白
                                    cellValue = "";
                                    break;
                                case CellType.Formula: //公式：也可能是图片
                                    //if (cell.CellType == CellType.String)
                                    //{
                                    //    // 获取富文本字符串
                                    //    IRichTextString richText = cell.RichStringCellValue;

                                    //    // 循环获取图片
                                    //    for (int k = 0; k < richText.NumFormattingRuns; k++)
                                    //    {
                                    //        if (richText.GetFontAtIndex(k).IsBold) // 通常图片会被设置为粗体
                                    //        {
                                    //            // 获取图片
                                    //            byte[] bytes = richText.GetFontAtIndex(i).GetImage();

                                    //            // 将字节流保存为文件或进行其他处理
                                    //            using (FileStream fs = new FileStream("output.png", FileMode.Create, FileAccess.Write))
                                    //            {
                                    //                fs.Write(bytes, 0, bytes.Length);
                                    //            }

                                    //            break; // 通常只有一个图片，所以我们只需要第一个图片即可
                                    //        }
                                    //    }
                                    //}
                                    cellValue = "";
                                    break;
                                default:
                                    cellValue = "";
                                    break;
                            }

                            //typeof(T).GetProperty(fields[j]).SetValue(t, cellValue, null);
                            // #if !NET461 && !NETSTANDARD2_0
                            // expandoObject.TryAdd(fields[j], cellValue);
                            // expandoObject[fields[j]] = cellValue;
                            if (!dictionary.ContainsKey(fields[j]))
                            {
                                dictionary.Add(fields[j], cellValue);
                            }
                            else
                            {
                                dictionary[fields[j]] = cellValue; // 更新值
                            }
                            // #endif
                        }
                        catch (Exception ex)
                        {
                            //LogHelper.Error(ex.Message, "ExcelToListDynamic_");
                        }


                    }
                    list.Add(expandoObject);
                }

            }

            return list;
        }
    }
}
