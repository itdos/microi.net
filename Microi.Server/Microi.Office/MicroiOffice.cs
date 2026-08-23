using System;
using System.Collections.Generic;
using System.Dynamic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Xml.Linq;
using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;
using NPOI.XWPF.UserModel;
using System.Net.Mail;
using System.Net;
using NPOI.OpenXmlFormats.Dml.WordProcessing;
using NPOI.OpenXmlFormats.Dml;
using System.Text.RegularExpressions;
using System.Globalization;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public partial class MicroiOffice : IMicroiOffice
    {
        private const long MaxImportExcelFileBytes = 20L * 1024L * 1024L;
        private const int MaxImportExcelDataRows = 50000;
        private const int MaxImportExcelColumns = 256;
        private const int MaxImportErrorDetails = 100;
        private const string ImportErrorPolicyRollbackAll = "RollbackAll";
        private const string ImportErrorPolicyContinueOnError = "ContinueOnError";

        /// <summary>
        /// 通用的 dynamic 参数转换方法
        /// </summary>
        private T ConvertDynamicParam<T>(dynamic dynamicParam)
        {
            var json = JsonHelper.Serialize(dynamicParam);
            var jobjParam = JObject.Parse(json);
            return jobjParam.ToObject<T>(DiyCommon.JsonConfig);
        }

        private DiyTableRowParam DynamicParam2(dynamic dynamicParam) => ConvertDynamicParam<DiyTableRowParam>(dynamicParam);
        private EmailParam DynamicParam3(dynamic dynamicParam) => ConvertDynamicParam<EmailParam>(dynamicParam);
        private V8EngineOfficeParam DynamicParam(dynamic dynamicParam) => ConvertDynamicParam<V8EngineOfficeParam>(dynamicParam);
        /// <summary>
        /// excel转List dynamic ，必传：FileByteBase64（文件流对应的byte转base64字符串）
        /// </summary>
        /// <returns></returns>
        public DosResultList<dynamic> ExcelToList(dynamic dynamicParam)
        {
            try
            {
                V8EngineOfficeParam param = DynamicParam(dynamicParam);
                if (param.FileByteBase64.DosIsNullOrWhiteSpace())
                {
                    return new DosResultList<dynamic>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                }
                var fileByte = Convert.FromBase64String(param.FileByteBase64);
                var maxDataRows = Math.Min(param.MaxDataRows ?? MaxImportExcelDataRows, MaxImportExcelDataRows);
                var maxColumns = Math.Min(param.MaxColumns ?? MaxImportExcelColumns, MaxImportExcelColumns);
                string fileType = param.FileType ?? "";
                string fileName = param.FileName ?? "";
                var isCsv = fileType.Trim().TrimStart('.').Equals("csv", StringComparison.OrdinalIgnoreCase)
                    || Path.GetExtension(fileName).Equals(".csv", StringComparison.OrdinalIgnoreCase);
                List<dynamic> result;
                object dataAppend = null;
                if (isCsv)
                {
                    var csvResult = CsvImportHelper.CsvToListDynamic(
                        fileByte,
                        maxDataRows,
                        maxColumns,
                        param.HeaderStartRow,
                        param.HeaderEndRow,
                        param.DataStartRow,
                        param.DataEndRow,
                        param.Columns,
                        param.Encoding,
                        param.Delimiter);
                    result = csvResult.Rows;
                    dataAppend = new
                    {
                        FileType = "csv",
                        csvResult.Encoding,
                        csvResult.Delimiter
                    };
                }
                else
                {
                    result = new NPOIHelper(fileByte).ExcelToListDynamic(
                        param.SheetIndex ?? 0,
                        maxDataRows,
                        maxColumns,
                        param.HeaderStartRow,
                        param.HeaderEndRow,
                        param.DataStartRow,
                        param.DataEndRow,
                        param.Columns);
                }
                return new DosResultList<dynamic>(1, result, null, result.Count, dataAppend);
            }
            catch (Exception ex)
            {
                return new DosResultList<dynamic>(0, null, ex.Message);
            }
        }
        public DosResult<byte[]> ExportExcel(dynamic dynamicParam)
        {
            DiyTableRowParam param = DynamicParam2(dynamicParam);
            return ExportExcelAsync(param).ConfigureAwait(false).GetAwaiter().GetResult();
        }
        /// <summary>
        /// 改用dynamic和Jobject
        /// 必传OsClient、TableId
        /// 可选_SysMenuId、_Keyword、_OrderBy、_OrderByType、_Search、_SearchCheckbox、_SearchDateTime、_SearchNumber
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<byte[]>> ExportExcelAsync(DiyTableRowParam param)
        {
            #region Check
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<byte[]>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            #endregion

            var excelSheets = GetExcelSheets(param);
            if (excelSheets.Any())
            {
                return await ExportExcelSheetsAsync(param, excelSheets);
            }
            if (param.ExcelLayout != null)
            {
                return ExportExcelLayout(param);
            }

            List<dynamic> result;
            SysMenu sysMenuModel = null;
            try
            {
                if (param.ExcelData != null)
                {
                    result = param.ExcelData;
                }
                else
                {
                    var tmpResult = await MicroiEngine.FormEngine.GetTableDataAsync(param);
                    if (tmpResult.Code != 1)
                    {
                        return new DosResult<byte[]>(0, null, tmpResult.Msg);
                    }
                    result = tmpResult.Data;
                }
                var fieldList = new List<JObject>();
                if (param.ExcelHeader == null)
                {
                    //这里要考虑到SysMenuId配置的关联表，所以GetDiyField修改为GetDiyFieldByDiyTables
                    var fieldListResult = await MicroiEngine.FormEngine.GetDiyFieldByDiyTables(new DiyFieldParam()
                    {
                        OsClient = param.OsClient,
                        //TableId = param.TableId,
                        TableIds = new List<string>() { param.TableId },
                        _SysMenuId = param._SysMenuId,
                        _ModuleEngineKey = param.ModuleEngineKey,
                        IsDeleted = 0,
                        _OnlyRealField = true
                    });
                    if (fieldListResult.Code != 1)
                    {
                        return new DosResult<byte[]>(0, null, fieldListResult.Msg);
                    }
                    fieldList = fieldListResult.Data;
                }
                else
                {
                    fieldList = param.ExcelHeader;
                }

                //2022-06-11 只导出前端显示的字段
                if (!param._SysMenuId.DosIsNullOrWhiteSpace() || !param.ModuleEngineKey.DosIsNullOrWhiteSpace())
                {
                    var _where = new List<DiyWhere>();
                    if (!param.ModuleEngineKey.DosIsNullOrWhiteSpace())
                    {
                        _where.Add(new DiyWhere()
                        {
                            Name = "ModuleEngineKey",
                            Value = param.ModuleEngineKey,
                            Type = "="
                        });
                    }
                    if (!param._SysMenuId.DosIsNullOrWhiteSpace())
                    {
                        _where.Add(new DiyWhere()
                        {
                            Name = "Id",
                            Value = param._SysMenuId,
                            Type = "="
                        });
                    }
                    var sysMenuModelResult = await MicroiEngine.FormEngine.GetFormDataAsync<SysMenu>(new
                    {
                        FormEngineKey = "sys_menu",
                        // Id = param._SysMenuId,
                        _Where = _where,
                        OsClient = param.OsClient,
                    });
                    sysMenuModel = sysMenuModelResult.Data;
                    if (sysMenuModel != null)
                    {
                        if (!sysMenuModel.SelectFields.DosIsNullOrWhiteSpace())
                        {
                            var selectFields = new List<SearchFieldIdsModel>();
                            try
                            {
                                selectFields = JsonHelper.Deserialize<List<SearchFieldIdsModel>>(sysMenuModel.SelectFields);
                                if (selectFields.Any() && !sysMenuModel.NotShowFields.DosIsNullOrWhiteSpace())
                                {
                                    var notShowFields = JsonHelper.Deserialize<List<string>>(sysMenuModel.NotShowFields);
                                    notShowFields = notShowFields ?? new List<string>();
                                    foreach (var fieldId in notShowFields)
                                    {
                                        selectFields.RemoveAll(d => d.Id == fieldId);
                                    }
                                    fieldList = fieldList.Where(d => selectFields.Select(o => o.Id).Contains(d["Id"].Val<string>())).ToList();
                                }
                            }
                            catch (Exception ex)
                            {

                            }
                        }
                    }
                }
                var sysConfig = (await MicroiEngine.FormEngine.GetSysConfig(param.OsClient)).Data;
                //-----END
                #region 开始导出
                IWorkbook workbook = new XSSFWorkbook();
                var sheetName = GetSafeExcelSheetName(workbook, param.ExcelOptions?.SheetName, 1);
                ISheet sheet = workbook.CreateSheet(sheetName);
                sheet.SetColumnWidth(0, 20 * 256);
                var row = sheet.CreateRow(0);
                //先计算所有图片
                //用来记录哪些字段需要额外生成列
                var dicFieldImgs = new Dictionary<string, int>();
                foreach (var item in result)
                {
                    JObject itemValue = JObject.FromObject(item);
                    foreach (var field in fieldList)
                    {
                        var fieldModel = fieldList.FirstOrDefault(d => d["Name"].Val<string>().ToLower() == field["Name"].Val<string>().ToLower());
                        if (fieldModel != null && !fieldModel["Config"].Val<string>().DosIsNullOrWhiteSpace())
                        {
                            //如果是图片 --2024-10-09 by Anderson
                            if (fieldModel["Component"].Val<string>() == "ImgUpload")
                            {
                                //如果是多图
                                var configObj = JObject.Parse(fieldModel["Config"].Val<string>());
                                var configs = configObj.Properties();
                                var selectLabelObj = configs.FirstOrDefault(d => d.Name == "ImgUpload");
                                if (selectLabelObj != null)
                                {
                                    var multiple = selectLabelObj?.Value["Multiple"]?.ToString();
                                    if (multiple == "1" || multiple == "True")
                                    {
                                        //获取图片数量
                                        var imgCount = 0;
                                        try
                                        {
                                            imgCount = JArray.Parse(itemValue[fieldModel["Name"].Val<string>()].Val<string>()).Count;
                                        }
                                        catch (System.Exception)
                                        {
                                            imgCount = 0;
                                        }
                                        if (imgCount > 0)
                                        {
                                            //判断是不是最多的
                                            if (!dicFieldImgs.ContainsKey(fieldModel["Name"].Val<string>()))
                                            {
                                                dicFieldImgs.Add(fieldModel["Name"].Val<string>(), imgCount);
                                            }
                                            else
                                            {
                                                if (dicFieldImgs[fieldModel["Name"].Val<string>()] < imgCount)
                                                {
                                                    dicFieldImgs[fieldModel["Name"].Val<string>()] = imgCount;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                var index = 0;
                foreach (var field in fieldList)
                {
                    if (dicFieldImgs.ContainsKey(field["Name"].Val<string>()))
                    {
                        for (int j = 0; j < dicFieldImgs[field["Name"].Val<string>()]; j++)
                        {
                            row.CreateCell(index, CellType.String).SetCellValue(field["Label"].Val<string>());
                            index++;
                        }
                        //开始合并列
                        if (index - dicFieldImgs[field["Name"].Val<string>()] < index - 1)
                        {
                            // 创建单元格范围地址
                            CellRangeAddress cellRangeAddress = new CellRangeAddress(0, 0, index - dicFieldImgs[field["Name"].Val<string>()], index - 1); // 合并第 0 行到第 1 行，第 0 列到第 2 列
                            // 添加合并区域
                            int mergedRegionIndex = sheet.AddMergedRegion(cellRangeAddress);
                        }

                    }
                    else
                    {
                        row.CreateCell(index, CellType.String).SetCellValue(field["Label"].Val<string>());
                        index++;
                    }

                }
                if (param.ExcelHeader == null)
                {
                    foreach (var field in CommonModel.DefaultExportFields)
                    {
                        row.CreateCell(index, CellType.String).SetCellValue(field.Label);
                        index++;
                    }
                }

                var i = 0;
                foreach (var item in result)
                {
                    JObject itemValue = JObject.FromObject(item);
                    var tRow = sheet.CreateRow(i + 1);
                    tRow.Height = 8 * 256;
                    var fieldIndex = 0;
                    var hasImg = false;
                    foreach (var field in fieldList)
                    {
                        try
                        {
                            sheet.SetColumnWidth(fieldIndex, 20 * 256);

                            //2025-03-11新增：数字类型判断 --by Anderson
                            // var value = itemValue[field.Name].Val<string>();
                            dynamic value = null;

                            var cellType = CellType.String;
                            if (
                                field["Type"].Val<string>()?.ToLower()?.Contains("int") == true
                                || field["Type"].Val<string>()?.ToLower()?.Contains("decimal") == true
                                || itemValue[field["Name"].Val<string>()].Type == JTokenType.Float
                                || itemValue[field["Name"].Val<string>()].Type == JTokenType.Integer
                            )
                            {
                                cellType = CellType.Numeric;
                                value = itemValue[field["Name"].Val<string>()].Val<double?>();
                            }
                            else
                            {

                                value = itemValue[field["Name"].Val<string>()].Val<string>();
                            }

                            var fieldModel = fieldList.FirstOrDefault(d => d["Name"].Val<string>().ToLower() == field["Name"].Val<string>().ToLower());
                            if (fieldModel != null && !fieldModel["Config"].Val<string>().DosIsNullOrWhiteSpace())
                            {
                                //如果是图片 --2024-10-09 by Anderson
                                if (fieldModel["Component"].Val<string>() == "ImgUpload")
                                {
                                    //获取图片地址、判断私有还是公有、判断MinIO/阿里云等
                                    var configObj = JObject.Parse(fieldModel["Config"].Val<string>());
                                    var configs = configObj.Properties();
                                    var selectLabelObj = configs.FirstOrDefault(d => d.Name == "ImgUpload");
                                    if (selectLabelObj != null)
                                    {

                                        //如果是多图
                                        var multiple = selectLabelObj?.Value["Multiple"]?.ToString();
                                        var limit = selectLabelObj?.Value["Limit"]?.ToString();
                                        if (multiple == "1" || multiple == "True")
                                        {
                                            var imgsList = new JArray();
                                            try
                                            {
                                                imgsList = JArray.Parse(itemValue[fieldModel["Name"].Val<string>()].Val<string>());
                                            }
                                            catch (System.Exception)
                                            { }
                                            var imgsCount = dicFieldImgs[fieldModel["Name"].Val<string>()];
                                            var tempIndex2 = 0;
                                            for (var n = 0; n < imgsCount; n++)
                                            {
                                                //如果图片不够，空值占位
                                                if (imgsList.Count < n + 1)
                                                {
                                                    sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                    var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                    // cell.SetCellValue(value);
                                                    if (n + 1 != imgsCount)
                                                    {
                                                        fieldIndex++;
                                                    }
                                                    continue;
                                                }
                                                var img = imgsList[n];
                                                //如果是私有
                                                if (limit == "1" || limit == "True")
                                                {
                                                    sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                    var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                    cell.SetCellValue(value);
                                                }
                                                else//如果是公有
                                                {
                                                    //后期通过HDFS插件来走内网取文件流
                                                    byte[] bytes = await MicroiEngine.Http.GetByte((string)sysConfig.FileServer + img["Path"]);
                                                    if (bytes == null)
                                                    {
                                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                        // 创建单元格样式
                                                        ICellStyle cellStyle = workbook.CreateCellStyle();
                                                        cellStyle.WrapText = true; // 设置文本换行
                                                        cell.CellStyle = cellStyle;
                                                        cell.SetCellValue(value);
                                                    }
                                                    else
                                                    {
                                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);//, CellType.Formula  .SetCellValue(value);
                                                        hasImg = true;
                                                        int pictureIdx = workbook.AddPicture(bytes, NPOI.SS.UserModel.PictureType.PNG);
                                                        // 修复NPOI 2.7.5泛型问题：使用XSSFDrawing替代IDrawing
                                                        var drawing = sheet.CreateDrawingPatriarch() as XSSFDrawing;
                                                        int row1 = i + 1; // 图片左上角所在行
                                                        int col1 = fieldIndex; // 图片左上角所在列
                                                        int row2 = i + 2; // 图片右下角所在行
                                                        int col2 = fieldIndex + 1; // 图片右下角所在列
                                                        IClientAnchor anchor = new XSSFClientAnchor(0, 0, 0, 0, (short)col1, row1, (short)col2, row2);
                                                        IPicture pict = drawing.CreatePicture(anchor, pictureIdx);
                                                    }


                                                }
                                                if (tempIndex2 + 1 != imgsCount)
                                                {
                                                    fieldIndex++;
                                                }
                                                tempIndex2++;
                                            }
                                        }
                                        else
                                        {
                                            //如果是单图
                                            var imgPath = itemValue[field["Name"].Val<string>()].Val<string>();
                                            if (imgPath.DosIsNullOrWhiteSpace())
                                            {
                                                sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                // 创建单元格样式
                                                ICellStyle cellStyle = workbook.CreateCellStyle();
                                                cellStyle.WrapText = true; // 设置文本换行
                                                cell.CellStyle = cellStyle;
                                                cell.SetCellValue(value);
                                            }
                                            else
                                            {
                                                //如果是私有
                                                if (limit == "1" || limit == "True")
                                                {

                                                }
                                                else
                                                {//如果是公有
                                                    //后期通过HDFS插件来走内网取文件流
                                                    byte[] bytes = await MicroiEngine.Http.GetByte((string)sysConfig.FileServer + imgPath);
                                                    if (bytes == null)
                                                    {
                                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                        // 创建单元格样式
                                                        ICellStyle cellStyle = workbook.CreateCellStyle();
                                                        cellStyle.WrapText = true; // 设置文本换行
                                                        cell.CellStyle = cellStyle;
                                                        cell.SetCellValue(value);
                                                    }
                                                    else
                                                    {
                                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);//, CellType.Formula  .SetCellValue(value);
                                                        hasImg = true;
                                                        int pictureIdx = workbook.AddPicture(bytes, NPOI.SS.UserModel.PictureType.PNG);
                                                        // 修复NPOI 2.7.5泛型问题：使用XSSFDrawing替代IDrawing
                                                        var drawing = sheet.CreateDrawingPatriarch() as XSSFDrawing;
                                                        int row1 = i + 1; // 图片左上角所在行
                                                        int col1 = fieldIndex; // 图片左上角所在列
                                                        int row2 = i + 2; // 图片右下角所在行
                                                        int col2 = fieldIndex + 1; // 图片右下角所在列
                                                        IClientAnchor anchor = new XSSFClientAnchor(0, 0, 0, 0, (short)col1, row1, (short)col2, row2);
                                                        IPicture pict = drawing.CreatePicture(anchor, pictureIdx);

                                                    }
                                                }
                                            }
                                        }
                                    }
                                    else
                                    {
                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                        // 创建单元格样式
                                        ICellStyle cellStyle = workbook.CreateCellStyle();
                                        cellStyle.WrapText = true; // 设置文本换行
                                        cell.CellStyle = cellStyle;
                                        cell.SetCellValue(value);
                                    }
                                }
                                else
                                {
                                    //这里需要处理一下{Id:'', Name:''}这种格式
                                    var setSelectLabel = false;
                                    try
                                    {
                                        var configObj = JObject.Parse(fieldModel["Config"].Val<string>());
                                        var configs = configObj.Properties();
                                        var selectLabelObj = configs.FirstOrDefault(d => d.Name == "SelectLabel");
                                        var selectSaveFormatObj = configs.FirstOrDefault(d => d.Name == "SelectSaveFormat");
                                        var selectSaveFormatValue = "";
                                        if (selectSaveFormatObj != null)
                                        {
                                            if (selectSaveFormatObj.Value.Type != JTokenType.Null && !selectSaveFormatObj.Value.ToString().DosIsNullOrWhiteSpace())
                                            {
                                                selectSaveFormatValue = selectSaveFormatObj.Value.ToString();
                                            }
                                        }
                                        if (selectLabelObj != null)
                                        {
                                            var val = selectLabelObj.Value;
                                            //SelectSaveFormat = Text
                                            if (val.Type != JTokenType.Null && !val.ToString().DosIsNullOrWhiteSpace())
                                            {
                                                var fieldName = fieldModel["Name"].Val<string>();
                                                var valueStr = itemValue[fieldName].Val<string>();
                                                //2025-04-03：要处理数组而不仅仅是对象
                                                if (fieldModel["Component"].Val<string>() == "MultipleSelect")
                                                {
                                                    var valueArray = JArray.Parse(valueStr);
                                                    var labelValues = "";
                                                    // 遍历数组中的每个对象（如果数组可能有多个元素）
                                                    foreach (var item2 in valueArray)
                                                    {
                                                        var valueObj = item2 as JObject; // 将数组元素转为 JObject
                                                        if (valueObj == null) continue;

                                                        var valuePros = valueObj.Properties();
                                                        var valueProsLabel = valuePros.FirstOrDefault(d => d.Name == val.ToString());

                                                        if (valueProsLabel != null)
                                                        {
                                                            var labelVal = valueProsLabel.Value;
                                                            if (labelVal.Type != JTokenType.Null && !labelVal.ToString().DosIsNullOrWhiteSpace())
                                                            {
                                                                setSelectLabel = true;
                                                                labelValues += labelVal.ToString() + ",";
                                                            }
                                                        }
                                                    }
                                                    var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                    cell.SetCellValue(labelValues.TrimEnd(','));
                                                }
                                                else if (selectSaveFormatValue != "Text")
                                                {
                                                    var valueObj = JObject.Parse(valueStr);
                                                    var valuePros = valueObj.Properties();
                                                    var valueProsLabel = valuePros.FirstOrDefault(d => d.Name == val.ToString());
                                                    if (valueProsLabel != null)
                                                    {
                                                        var labelVal = valueProsLabel.Value;
                                                        if (labelVal.Type != JTokenType.Null && !labelVal.ToString().DosIsNullOrWhiteSpace())
                                                        {
                                                            setSelectLabel = true;
                                                            var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                            cell.SetCellValue(labelVal.ToString());
                                                        }
                                                    }
                                                }
                                                else
                                                {
                                                    sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                    tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                                                }
                                            }
                                        }
                                        else
                                        {
                                            sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                            tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                                    }
                                    if (!setSelectLabel)
                                    {
                                        tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                                    }
                                }
                            }
                            else
                            {
                                sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                            }
                        }
                        catch (Exception ex)
                        {

                        }
                        fieldIndex++;
                    }
                    if (param.ExcelHeader == null)
                    {
                        foreach (var field in CommonModel.DefaultExportFields)
                        {
                            sheet.SetColumnWidth(fieldIndex, 20 * 256);
                            var value = itemValue[field.Name].Val<string>();
                            tRow.CreateCell(fieldIndex, CellType.String).SetCellValue(value);
                            fieldIndex++;
                        }
                    }
                    if (!hasImg)
                    {
                        tRow.Height = 1 * 256;
                    }
                    i++;
                }
                ApplyExcelSheetFormatting(
                    workbook,
                    sheet,
                    result.Count,
                    fieldList,
                    dicFieldImgs,
                    param.ExcelHeader == null,
                    param.ExcelOptions);
                //转为字节数组  
                using (var stream = new MemoryStream())
                {
                    workbook.Write(stream);
                    var buf = stream.ToArray();
                    UserBehaviorAudit.Track(param, "Data", "DataExport", "导出数据", "Table",
                        param.TableId.DosIsNullOrWhiteSpace(param.FormEngineKey),
                        $"导出了表[{sysMenuModel?.Name.DosIsNullOrWhiteSpace(param.FormEngineKey)}]的[{result.Count}]条数据",
                        new { TableId = param.TableId, Table = param.FormEngineKey, MenuId = param._SysMenuId, Count = result.Count });
                    return new DosResult<byte[]>(1, buf);
                }
                #endregion
            }
            catch (Exception ex)
            {
                UserBehaviorAudit.Track(param, "Data", "DataExport", "导出数据", "Table",
                    param?.TableId.DosIsNullOrWhiteSpace(param?.FormEngineKey),
                    $"导出表[{param?.FormEngineKey}]的数据失败",
                    new { TableId = param?.TableId, Table = param?.FormEngineKey, Error = ex.Message }, false);
                return new DosResult<byte[]>(0, null, ex.Message);
            }
        }

        private List<ExcelSheetParam> GetExcelSheets(DiyTableRowParam param)
        {
            if (param?.ExcelSheets != null && param.ExcelSheets.Any())
            {
                return param.ExcelSheets;
            }
            if (param?.Sheets != null && param.Sheets.Any())
            {
                return param.Sheets;
            }
            return new List<ExcelSheetParam>();
        }

        private async Task<DosResult<byte[]>> ExportExcelSheetsAsync(DiyTableRowParam parentParam, List<ExcelSheetParam> sheets)
        {
            try
            {
                IWorkbook workbook = new XSSFWorkbook();
                var sysConfig = (await MicroiEngine.FormEngine.GetSysConfig(parentParam.OsClient)).Data;
                var sheetIndex = 1;
                var totalCount = 0;
                var totalLayoutCellCount = 0;
                foreach (var sheet in sheets)
                {
                    ApplyExcelSheetDefaults(parentParam, sheet);
                    var sheetName = GetSafeExcelSheetName(workbook, sheet.SheetName, sheetIndex);
                    if (sheet.ExcelLayout != null)
                    {
                        WriteExportExcelLayoutSheet(workbook, sheetName, sheet.ExcelLayout, sheet.ExcelOptions);
                        totalLayoutCellCount += sheet.ExcelLayout.Cells?.Count ?? 0;
                        sheetIndex++;
                        continue;
                    }
                    var sheetDataResult = await GetExportExcelSheetDataAsync(sheet);
                    if (sheetDataResult.Code != 1)
                    {
                        UserBehaviorAudit.Track(parentParam, "Data", "DataExport", "导出数据", "Table",
                            parentParam.TableId.DosIsNullOrWhiteSpace(parentParam.FormEngineKey),
                            "导出多工作表数据失败",
                            new { TableId = parentParam.TableId, Table = parentParam.FormEngineKey, Error = sheetDataResult.Msg }, false);
                        return new DosResult<byte[]>(0, null, sheetDataResult.Msg);
                    }
                    await WriteExportExcelSheetAsync(
                        workbook,
                        sheetName,
                        sheetDataResult.Data.ExcelData,
                        sheetDataResult.Data.ExcelHeader,
                        sheet.ExcelHeader == null,
                        sysConfig,
                        sheet.ExcelOptions
                    );
                    totalCount += sheetDataResult.Data.ExcelData?.Count ?? 0;
                    sheetIndex++;
                }
                using (var stream = new MemoryStream())
                {
                    workbook.Write(stream);
                    UserBehaviorAudit.Track(parentParam, "Data", "DataExport", "导出数据", "Table",
                        parentParam.TableId.DosIsNullOrWhiteSpace(parentParam.FormEngineKey),
                        $"导出了[{sheets.Count}]个工作表、共[{totalCount}]条数据、[{totalLayoutCellCount}]个布局单元配置",
                        new
                        {
                            TableId = parentParam.TableId,
                            Table = parentParam.FormEngineKey,
                            SheetCount = sheets.Count,
                            Count = totalCount,
                            LayoutCellCount = totalLayoutCellCount
                        });
                    return new DosResult<byte[]>(1, stream.ToArray());
                }
            }
            catch (Exception ex)
            {
                UserBehaviorAudit.Track(parentParam, "Data", "DataExport", "导出数据", "Table",
                    parentParam?.TableId.DosIsNullOrWhiteSpace(parentParam?.FormEngineKey),
                    "导出多工作表数据失败",
                    new { TableId = parentParam?.TableId, Table = parentParam?.FormEngineKey, Error = ex.Message }, false);
                return new DosResult<byte[]>(0, null, ex.Message);
            }
        }

        private void ApplyExcelSheetDefaults(DiyTableRowParam parentParam, ExcelSheetParam sheet)
        {
            if (sheet.OsClient.DosIsNullOrWhiteSpace())
            {
                sheet.OsClient = parentParam.OsClient;
            }
            if (sheet.TableId.DosIsNullOrWhiteSpace())
            {
                sheet.TableId = parentParam.TableId;
            }
            if (sheet._SysMenuId.DosIsNullOrWhiteSpace())
            {
                sheet._SysMenuId = parentParam._SysMenuId;
            }
            if (sheet.ModuleEngineKey.DosIsNullOrWhiteSpace())
            {
                sheet.ModuleEngineKey = parentParam.ModuleEngineKey;
            }
            if (sheet.FormEngineKey.DosIsNullOrWhiteSpace())
            {
                sheet.FormEngineKey = parentParam.FormEngineKey;
            }
            if (sheet._Lang.DosIsNullOrWhiteSpace())
            {
                sheet._Lang = parentParam._Lang;
            }
            if (sheet.ExcelHeader == null && parentParam.ExcelHeader != null)
            {
                sheet.ExcelHeader = parentParam.ExcelHeader;
            }
            sheet.ExcelOptions = MergeExcelExportOptions(parentParam.ExcelOptions, sheet.ExcelOptions);
            if (sheet.SheetName.DosIsNullOrWhiteSpace()
                && sheet.ExcelOptions != null
                && !sheet.ExcelOptions.SheetName.DosIsNullOrWhiteSpace())
            {
                sheet.SheetName = sheet.ExcelOptions.SheetName;
            }
        }

        private string GetSafeExcelSheetName(IWorkbook workbook, string sheetName, int index)
        {
            var name = sheetName.DosIsNullOrWhiteSpace() ? $"Sheet{index}" : sheetName.Trim();
            name = Regex.Replace(name, @"[\[\]\:\*\?\/\\]", "_");
            if (name.Length > 31)
            {
                name = name.Substring(0, 31);
            }
            if (name.DosIsNullOrWhiteSpace())
            {
                name = $"Sheet{index}";
            }
            var baseName = name;
            var suffixIndex = 2;
            while (workbook.GetSheet(name) != null)
            {
                var suffix = $"_{suffixIndex}";
                var maxBaseLength = 31 - suffix.Length;
                name = (baseName.Length > maxBaseLength ? baseName.Substring(0, maxBaseLength) : baseName) + suffix;
                suffixIndex++;
            }
            return name;
        }

        private class ExportExcelSheetData
        {
            public List<dynamic> ExcelData { get; set; }
            public List<JObject> ExcelHeader { get; set; }
        }

        private async Task<DosResult<ExportExcelSheetData>> GetExportExcelSheetDataAsync(DiyTableRowParam param)
        {
            List<dynamic> result;
            SysMenu sysMenuModel = null;
            if (param.ExcelData != null)
            {
                result = param.ExcelData;
            }
            else
            {
                var tmpResult = await MicroiEngine.FormEngine.GetTableDataAsync(param);
                if (tmpResult.Code != 1)
                {
                    return new DosResult<ExportExcelSheetData>(0, null, tmpResult.Msg);
                }
                result = tmpResult.Data;
            }
            var fieldList = new List<JObject>();
            if (param.ExcelHeader == null)
            {
                var fieldListResult = await MicroiEngine.FormEngine.GetDiyFieldByDiyTables(new DiyFieldParam()
                {
                    OsClient = param.OsClient,
                    TableIds = new List<string>() { param.TableId },
                    _SysMenuId = param._SysMenuId,
                    _ModuleEngineKey = param.ModuleEngineKey,
                    IsDeleted = 0,
                    _OnlyRealField = true
                });
                if (fieldListResult.Code != 1)
                {
                    return new DosResult<ExportExcelSheetData>(0, null, fieldListResult.Msg);
                }
                fieldList = fieldListResult.Data;
            }
            else
            {
                fieldList = param.ExcelHeader;
            }

            if (!param._SysMenuId.DosIsNullOrWhiteSpace() || !param.ModuleEngineKey.DosIsNullOrWhiteSpace())
            {
                var _where = new List<DiyWhere>();
                if (!param.ModuleEngineKey.DosIsNullOrWhiteSpace())
                {
                    _where.Add(new DiyWhere()
                    {
                        Name = "ModuleEngineKey",
                        Value = param.ModuleEngineKey,
                        Type = "="
                    });
                }
                if (!param._SysMenuId.DosIsNullOrWhiteSpace())
                {
                    _where.Add(new DiyWhere()
                    {
                        Name = "Id",
                        Value = param._SysMenuId,
                        Type = "="
                    });
                }
                var sysMenuModelResult = await MicroiEngine.FormEngine.GetFormDataAsync<SysMenu>(new
                {
                    FormEngineKey = "sys_menu",
                    _Where = _where,
                    OsClient = param.OsClient,
                });
                sysMenuModel = sysMenuModelResult.Data;
                if (sysMenuModel != null && !sysMenuModel.SelectFields.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        var selectFields = JsonHelper.Deserialize<List<SearchFieldIdsModel>>(sysMenuModel.SelectFields);
                        if (selectFields.Any() && !sysMenuModel.NotShowFields.DosIsNullOrWhiteSpace())
                        {
                            var notShowFields = JsonHelper.Deserialize<List<string>>(sysMenuModel.NotShowFields);
                            notShowFields = notShowFields ?? new List<string>();
                            foreach (var fieldId in notShowFields)
                            {
                                selectFields.RemoveAll(d => d.Id == fieldId);
                            }
                            fieldList = fieldList.Where(d => selectFields.Select(o => o.Id).Contains(d["Id"].Val<string>())).ToList();
                        }
                    }
                    catch (Exception)
                    {
                    }
                }
            }
            return new DosResult<ExportExcelSheetData>(1, new ExportExcelSheetData()
            {
                ExcelData = result,
                ExcelHeader = fieldList
            });
        }

        private async Task WriteExportExcelSheetAsync(
            IWorkbook workbook,
            string sheetName,
            List<dynamic> result,
            List<JObject> fieldList,
            bool appendDefaultFields,
            dynamic sysConfig,
            OfficeExcelExportOptionsParam options)
        {
            ISheet sheet = workbook.CreateSheet(sheetName);
            sheet.SetColumnWidth(0, 20 * 256);
            var row = sheet.CreateRow(0);
            var dicFieldImgs = new Dictionary<string, int>();
            foreach (var item in result)
            {
                JObject itemValue = JObject.FromObject(item);
                foreach (var field in fieldList)
                {
                    var fieldModel = fieldList.FirstOrDefault(d => d["Name"].Val<string>().ToLower() == field["Name"].Val<string>().ToLower());
                    if (fieldModel != null && !fieldModel["Config"].Val<string>().DosIsNullOrWhiteSpace())
                    {
                        if (fieldModel["Component"].Val<string>() == "ImgUpload")
                        {
                            var configObj = JObject.Parse(fieldModel["Config"].Val<string>());
                            var configs = configObj.Properties();
                            var selectLabelObj = configs.FirstOrDefault(d => d.Name == "ImgUpload");
                            if (selectLabelObj != null)
                            {
                                var multiple = selectLabelObj?.Value["Multiple"]?.ToString();
                                if (multiple == "1" || multiple == "True")
                                {
                                    var imgCount = 0;
                                    try
                                    {
                                        imgCount = JArray.Parse(itemValue[fieldModel["Name"].Val<string>()].Val<string>()).Count;
                                    }
                                    catch (System.Exception)
                                    {
                                        imgCount = 0;
                                    }
                                    if (imgCount > 0)
                                    {
                                        if (!dicFieldImgs.ContainsKey(fieldModel["Name"].Val<string>()))
                                        {
                                            dicFieldImgs.Add(fieldModel["Name"].Val<string>(), imgCount);
                                        }
                                        else if (dicFieldImgs[fieldModel["Name"].Val<string>()] < imgCount)
                                        {
                                            dicFieldImgs[fieldModel["Name"].Val<string>()] = imgCount;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            var index = 0;
            foreach (var field in fieldList)
            {
                if (dicFieldImgs.ContainsKey(field["Name"].Val<string>()))
                {
                    for (int j = 0; j < dicFieldImgs[field["Name"].Val<string>()]; j++)
                    {
                        row.CreateCell(index, CellType.String).SetCellValue(field["Label"].Val<string>());
                        index++;
                    }
                    if (index - dicFieldImgs[field["Name"].Val<string>()] < index - 1)
                    {
                        CellRangeAddress cellRangeAddress = new CellRangeAddress(0, 0, index - dicFieldImgs[field["Name"].Val<string>()], index - 1);
                        sheet.AddMergedRegion(cellRangeAddress);
                    }
                }
                else
                {
                    row.CreateCell(index, CellType.String).SetCellValue(field["Label"].Val<string>());
                    index++;
                }
            }
            if (appendDefaultFields)
            {
                foreach (var field in CommonModel.DefaultExportFields)
                {
                    row.CreateCell(index, CellType.String).SetCellValue(field.Label);
                    index++;
                }
            }

            var i = 0;
            foreach (var item in result)
            {
                JObject itemValue = JObject.FromObject(item);
                var tRow = sheet.CreateRow(i + 1);
                tRow.Height = 8 * 256;
                var fieldIndex = 0;
                var hasImg = false;
                foreach (var field in fieldList)
                {
                    try
                    {
                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                        dynamic value = null;
                        var cellType = CellType.String;
                        if (
                            field["Type"].Val<string>()?.ToLower()?.Contains("int") == true
                            || field["Type"].Val<string>()?.ToLower()?.Contains("decimal") == true
                            || itemValue[field["Name"].Val<string>()].Type == JTokenType.Float
                            || itemValue[field["Name"].Val<string>()].Type == JTokenType.Integer
                        )
                        {
                            cellType = CellType.Numeric;
                            value = itemValue[field["Name"].Val<string>()].Val<double?>();
                        }
                        else
                        {
                            value = itemValue[field["Name"].Val<string>()].Val<string>();
                        }

                        var fieldModel = fieldList.FirstOrDefault(d => d["Name"].Val<string>().ToLower() == field["Name"].Val<string>().ToLower());
                        if (fieldModel != null && !fieldModel["Config"].Val<string>().DosIsNullOrWhiteSpace())
                        {
                            if (fieldModel["Component"].Val<string>() == "ImgUpload")
                            {
                                var configObj = JObject.Parse(fieldModel["Config"].Val<string>());
                                var configs = configObj.Properties();
                                var selectLabelObj = configs.FirstOrDefault(d => d.Name == "ImgUpload");
                                if (selectLabelObj != null)
                                {
                                    var multiple = selectLabelObj?.Value["Multiple"]?.ToString();
                                    var limit = selectLabelObj?.Value["Limit"]?.ToString();
                                    if (multiple == "1" || multiple == "True")
                                    {
                                        var imgsList = new JArray();
                                        try
                                        {
                                            imgsList = JArray.Parse(itemValue[fieldModel["Name"].Val<string>()].Val<string>());
                                        }
                                        catch (System.Exception)
                                        { }
                                        var imgsCount = dicFieldImgs[fieldModel["Name"].Val<string>()];
                                        var tempIndex2 = 0;
                                        for (var n = 0; n < imgsCount; n++)
                                        {
                                            if (imgsList.Count < n + 1)
                                            {
                                                sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                tRow.CreateCell(fieldIndex, CellType.String);
                                                if (n + 1 != imgsCount)
                                                {
                                                    fieldIndex++;
                                                }
                                                continue;
                                            }
                                            var img = imgsList[n];
                                            if (limit == "1" || limit == "True")
                                            {
                                                sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                cell.SetCellValue(value);
                                            }
                                            else
                                            {
                                                byte[] bytes = await MicroiEngine.Http.GetByte((string)sysConfig.FileServer + img["Path"]);
                                                if (bytes == null)
                                                {
                                                    sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                    var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                    ICellStyle cellStyle = workbook.CreateCellStyle();
                                                    cellStyle.WrapText = true;
                                                    cell.CellStyle = cellStyle;
                                                    cell.SetCellValue(value);
                                                }
                                                else
                                                {
                                                    sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                    tRow.CreateCell(fieldIndex, CellType.String);
                                                    hasImg = true;
                                                    int pictureIdx = workbook.AddPicture(bytes, NPOI.SS.UserModel.PictureType.PNG);
                                                    var drawing = sheet.CreateDrawingPatriarch() as XSSFDrawing;
                                                    int row1 = i + 1;
                                                    int col1 = fieldIndex;
                                                    int row2 = i + 2;
                                                    int col2 = fieldIndex + 1;
                                                    IClientAnchor anchor = new XSSFClientAnchor(0, 0, 0, 0, (short)col1, row1, (short)col2, row2);
                                                    drawing.CreatePicture(anchor, pictureIdx);
                                                }
                                            }
                                            if (tempIndex2 + 1 != imgsCount)
                                            {
                                                fieldIndex++;
                                            }
                                            tempIndex2++;
                                        }
                                    }
                                    else
                                    {
                                        var imgPath = itemValue[field["Name"].Val<string>()].Val<string>();
                                        if (imgPath.DosIsNullOrWhiteSpace())
                                        {
                                            sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                            var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                            ICellStyle cellStyle = workbook.CreateCellStyle();
                                            cellStyle.WrapText = true;
                                            cell.CellStyle = cellStyle;
                                            cell.SetCellValue(value);
                                        }
                                        else if (!(limit == "1" || limit == "True"))
                                        {
                                            byte[] bytes = await MicroiEngine.Http.GetByte((string)sysConfig.FileServer + imgPath);
                                            if (bytes == null)
                                            {
                                                sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                ICellStyle cellStyle = workbook.CreateCellStyle();
                                                cellStyle.WrapText = true;
                                                cell.CellStyle = cellStyle;
                                                cell.SetCellValue(value);
                                            }
                                            else
                                            {
                                                sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                tRow.CreateCell(fieldIndex, CellType.String);
                                                hasImg = true;
                                                int pictureIdx = workbook.AddPicture(bytes, NPOI.SS.UserModel.PictureType.PNG);
                                                var drawing = sheet.CreateDrawingPatriarch() as XSSFDrawing;
                                                int row1 = i + 1;
                                                int col1 = fieldIndex;
                                                int row2 = i + 2;
                                                int col2 = fieldIndex + 1;
                                                IClientAnchor anchor = new XSSFClientAnchor(0, 0, 0, 0, (short)col1, row1, (short)col2, row2);
                                                drawing.CreatePicture(anchor, pictureIdx);
                                            }
                                        }
                                    }
                                }
                                else
                                {
                                    sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                    var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                    ICellStyle cellStyle = workbook.CreateCellStyle();
                                    cellStyle.WrapText = true;
                                    cell.CellStyle = cellStyle;
                                    cell.SetCellValue(value);
                                }
                            }
                            else
                            {
                                var setSelectLabel = false;
                                try
                                {
                                    var configObj = JObject.Parse(fieldModel["Config"].Val<string>());
                                    var configs = configObj.Properties();
                                    var selectLabelObj = configs.FirstOrDefault(d => d.Name == "SelectLabel");
                                    var selectSaveFormatObj = configs.FirstOrDefault(d => d.Name == "SelectSaveFormat");
                                    var selectSaveFormatValue = "";
                                    if (selectSaveFormatObj != null && selectSaveFormatObj.Value.Type != JTokenType.Null && !selectSaveFormatObj.Value.ToString().DosIsNullOrWhiteSpace())
                                    {
                                        selectSaveFormatValue = selectSaveFormatObj.Value.ToString();
                                    }
                                    if (selectLabelObj != null)
                                    {
                                        var val = selectLabelObj.Value;
                                        if (val.Type != JTokenType.Null && !val.ToString().DosIsNullOrWhiteSpace())
                                        {
                                            var fieldName = fieldModel["Name"].Val<string>();
                                            var valueStr = itemValue[fieldName].Val<string>();
                                            if (fieldModel["Component"].Val<string>() == "MultipleSelect")
                                            {
                                                var valueArray = JArray.Parse(valueStr);
                                                var labelValues = "";
                                                foreach (var item2 in valueArray)
                                                {
                                                    var valueObj = item2 as JObject;
                                                    if (valueObj == null) continue;
                                                    var valueProsLabel = valueObj.Properties().FirstOrDefault(d => d.Name == val.ToString());
                                                    if (valueProsLabel != null)
                                                    {
                                                        var labelVal = valueProsLabel.Value;
                                                        if (labelVal.Type != JTokenType.Null && !labelVal.ToString().DosIsNullOrWhiteSpace())
                                                        {
                                                            setSelectLabel = true;
                                                            labelValues += labelVal.ToString() + ",";
                                                        }
                                                    }
                                                }
                                                var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                cell.SetCellValue(labelValues.TrimEnd(','));
                                            }
                                            else if (selectSaveFormatValue != "Text")
                                            {
                                                var valueObj = JObject.Parse(valueStr);
                                                var valueProsLabel = valueObj.Properties().FirstOrDefault(d => d.Name == val.ToString());
                                                if (valueProsLabel != null)
                                                {
                                                    var labelVal = valueProsLabel.Value;
                                                    if (labelVal.Type != JTokenType.Null && !labelVal.ToString().DosIsNullOrWhiteSpace())
                                                    {
                                                        setSelectLabel = true;
                                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                        cell.SetCellValue(labelVal.ToString());
                                                    }
                                                }
                                            }
                                            else
                                            {
                                                sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                                            }
                                        }
                                    }
                                    else
                                    {
                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                        tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                                    }
                                }
                                catch (Exception)
                                {
                                    tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                                }
                                if (!setSelectLabel)
                                {
                                    tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                                }
                            }
                        }
                        else
                        {
                            sheet.SetColumnWidth(fieldIndex, 20 * 256);
                            tRow.CreateCell(fieldIndex, cellType).SetCellValue(value);
                        }
                    }
                    catch (Exception)
                    {
                    }
                    fieldIndex++;
                }
                if (appendDefaultFields)
                {
                    foreach (var field in CommonModel.DefaultExportFields)
                    {
                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                        var value = itemValue[field.Name].Val<string>();
                        tRow.CreateCell(fieldIndex, CellType.String).SetCellValue(value);
                        fieldIndex++;
                    }
                }
                if (!hasImg)
                {
                    tRow.Height = 1 * 256;
                }
                i++;
            }
            ApplyExcelSheetFormatting(
                workbook,
                sheet,
                result.Count,
                fieldList,
                dicFieldImgs,
                appendDefaultFields,
                options);
        }

        /// <summary>
        /// 2023-11 第二版导入功能
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_httpContext"></param>
        /// <returns></returns>
        private static bool ImportIsIgnoredComponent(string component)
        {
            if (component.DosIsNullOrWhiteSpace()) return false;
            var ignored = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Button", "TableChild", "Tabs", "CollapseGroup", "Divider",
                "Description", "Alert", "Html", "FormTab", "Layout"
            };
            return ignored.Contains(component);
        }

        private static bool ImportIsNumericType(string type)
        {
            if (type.DosIsNullOrWhiteSpace()) return false;
            var lower = type.ToLowerInvariant();
            return lower.StartsWith("int") || lower.StartsWith("bigint") || lower.StartsWith("decimal");
        }

        private static string ImportEscapeSql(object value)
        {
            return value == null ? "" : value.ToString().Replace("'", "''");
        }

        private static IDictionary<string, object> ImportGetRowDictionary(object item)
        {
            return item as IDictionary<string, object>;
        }

        private static List<JObject> ImportBuildFieldList(IEnumerable<JObject> fieldList, List<string> importStepList, string dateTimeFormat)
        {
            var result = new List<JObject>();
            var labelSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var ignoredCount = 0;
            var duplicateCount = 0;
            foreach (var field in fieldList
                .Where(d => d != null)
                .OrderByDescending(d => d["Visible"].Val<int>())
                .ThenBy(d => d["Sort"].Val<int>()))
            {
                var name = field["Name"].Val<string>();
                var label = field["Label"].Val<string>();
                var component = field["Component"].Val<string>();
                if (name.DosIsNullOrWhiteSpace() || label.DosIsNullOrWhiteSpace())
                {
                    ignoredCount++;
                    continue;
                }
                if (ImportIsIgnoredComponent(component))
                {
                    ignoredCount++;
                    continue;
                }
                if (!labelSet.Add(label))
                {
                    duplicateCount++;
                    continue;
                }
                result.Add(field);
            }
            if (ignoredCount > 0)
            {
                importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：调试：已跳过【{ignoredCount}】个布局/子表/按钮/无效字段。");
            }
            if (duplicateCount > 0)
            {
                importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：调试：已跳过【{duplicateCount}】个重复表头字段，优先使用可见字段。");
            }
            return result.OrderBy(d => d["Sort"].Val<int>()).ToList();
        }

        private static bool ImportTryGetFieldValue(IDictionary<string, object> row, JObject fixedField, JObject field, out object value)
        {
            value = null;
            if (field == null) return false;
            var name = field["Name"].Val<string>();
            var label = field["Label"].Val<string>();
            if (fixedField != null && !name.DosIsNullOrWhiteSpace() && fixedField.ContainsKey(name))
            {
                value = fixedField[name]?.ToString();
                return true;
            }
            if (row == null) return false;
            if (!label.DosIsNullOrWhiteSpace() && row.TryGetValue(label, out value)) return true;
            if (!name.DosIsNullOrWhiteSpace() && row.TryGetValue(name, out value)) return true;
            return false;
        }

        private static bool ImportHasFieldValue(IDictionary<string, object> row, JObject fixedField, JObject field)
        {
            if (!ImportTryGetFieldValue(row, fixedField, field, out var value)) return false;
            return value != null && !value.ToString().DosIsNullOrWhiteSpace();
        }

        private static string ImportNormalizeSwitch(object value)
        {
            if (value == null) return "0";
            if (value is bool boolValue) return boolValue ? "1" : "0";
            var text = value.ToString().Trim();
            if (text.DosIsNullOrWhiteSpace()) return "0";
            if (decimal.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out var decimalValue))
            {
                return decimalValue == 0 ? "0" : "1";
            }
            if (decimal.TryParse(text, NumberStyles.Any, CultureInfo.CurrentCulture, out decimalValue))
            {
                return decimalValue == 0 ? "0" : "1";
            }
            var yesValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "是", "有", "真", "true", "yes", "y", "on", "启用" };
            var noValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "否", "无", "假", "false", "no", "n", "off", "禁用" };
            if (yesValues.Contains(text)) return "1";
            if (noValues.Contains(text)) return "0";
            return "0";
        }

        private static string ImportNormalizeValue(object value, JObject field)
        {
            if (value == null) return "";
            if (value is DateTime dateTime)
            {
                return dateTime.ToString("yyyy-MM-dd HH:mm:ss");
            }

            var text = value.ToString().Trim();
            if (text.DosIsNullOrWhiteSpace()) return "";
            var component = field?["Component"].Val<string>();
            if (component == "DateTime")
            {
                if (DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dateTimeOffset))
                {
                    return dateTimeOffset.LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss");
                }
                if (DateTime.TryParse(text, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal, out var parsedDateTime))
                {
                    return parsedDateTime.ToString("yyyy-MM-dd HH:mm:ss");
                }
            }
            return text;
        }

        private static string ImportBuildSqlValue(object value, JObject field)
        {
            var component = field?["Component"].Val<string>();
            var type = field?["Type"].Val<string>() ?? "";
            if (component == "Switch")
            {
                return ImportNormalizeSwitch(value);
            }
            var normalized = ImportNormalizeValue(value, field);
            if (normalized.DosIsNullOrWhiteSpace())
            {
                return ImportIsNumericType(type) ? "NULL" : "''";
            }
            if (ImportIsNumericType(type) && component != "Text" && component != "Textarea")
            {
                if (!decimal.TryParse(normalized, NumberStyles.Any, CultureInfo.InvariantCulture, out var number)
                    && !decimal.TryParse(normalized, NumberStyles.Any, CultureInfo.CurrentCulture, out number))
                {
                    throw new Exception($"字段[{field?["Label"].Val<string>()}]需要数字，当前值为[{normalized}]。");
                }
                if (type.ToLowerInvariant().StartsWith("int") || type.ToLowerInvariant().StartsWith("bigint"))
                {
                    return decimal.Truncate(number).ToString(CultureInfo.InvariantCulture);
                }
                return number.ToString(CultureInfo.InvariantCulture);
            }
            return $"'{ImportEscapeSql(normalized)}'";
        }

        private static string ImportGetUniqueType(JObject field)
        {
            var fieldConfig = JsonHelper.Deserialize<DiyFieldConfig>(field["Config"].Val<string>() ?? "") ?? new DiyFieldConfig();
            return fieldConfig.Unique?.Type.DosIsNullOrWhiteSpace("Alone") ?? "Alone";
        }

        private static string ImportNormalizeErrorPolicy(string value)
        {
            if (value.DosIsNullOrWhiteSpace()) return ImportErrorPolicyRollbackAll;
            var normalized = value.Trim();
            if (normalized.Equals(ImportErrorPolicyRollbackAll, StringComparison.OrdinalIgnoreCase))
            {
                return ImportErrorPolicyRollbackAll;
            }
            if (normalized.Equals(ImportErrorPolicyContinueOnError, StringComparison.OrdinalIgnoreCase))
            {
                return ImportErrorPolicyContinueOnError;
            }
            throw new ArgumentException($"不支持的导入错误处理策略【{value}】，仅支持 {ImportErrorPolicyRollbackAll} 或 {ImportErrorPolicyContinueOnError}。");
        }

        private class ImportUniqueRule
        {
            public string Type { get; set; }
            public List<JObject> Fields { get; set; } = new List<JObject>();
        }

        private class ImportRowWriteResult
        {
            public bool Updated { get; set; }
            public int Affected { get; set; }
            public string LastSql { get; set; }
        }

        private static List<ImportUniqueRule> ImportBuildUniqueRules(IEnumerable<JObject> fields)
        {
            var uniqueFields = (fields ?? Enumerable.Empty<JObject>())
                .Where(d => d != null
                    && d["Unique"].Val<int>() == 1
                    && !d["Name"].Val<string>().DosIsNullOrWhiteSpace())
                .OrderBy(d => d["Sort"].Val<int>())
                .ToList();
            var rules = uniqueFields
                .Where(d => !string.Equals(ImportGetUniqueType(d), "All", StringComparison.OrdinalIgnoreCase))
                .Select(d => new ImportUniqueRule
                {
                    Type = "Alone",
                    Fields = new List<JObject> { d }
                })
                .ToList();
            var allFields = uniqueFields
                .Where(d => string.Equals(ImportGetUniqueType(d), "All", StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (allFields.Any())
            {
                rules.Add(new ImportUniqueRule { Type = "All", Fields = allFields });
            }
            return rules;
        }

        private static string ImportDescribeUniqueRule(ImportUniqueRule rule)
        {
            var fieldText = string.Join(" + ", (rule?.Fields ?? new List<JObject>())
                .Select(d => $"{d["Label"].Val<string>().DosIsNullOrWhiteSpace(d["Name"].Val<string>())}({d["Name"].Val<string>()})"));
            return string.Equals(rule?.Type, "All", StringComparison.OrdinalIgnoreCase)
                ? $"组合唯一【{fieldText}】"
                : $"单字段唯一【{fieldText}】";
        }

        private static string ImportDescribeUniqueRules(IEnumerable<ImportUniqueRule> rules)
        {
            var descriptions = (rules ?? Enumerable.Empty<ImportUniqueRule>())
                .Select(ImportDescribeUniqueRule)
                .Where(d => !d.DosIsNullOrWhiteSpace())
                .ToList();
            return descriptions.Any()
                ? string.Join("；", descriptions)
                : "未配置唯一字段（只能新增，重复导入可能产生重复数据）";
        }

        private static bool ImportTryBuildUniqueRuleValues(
            IDictionary<string, object> row,
            JObject fixedField,
            ImportUniqueRule rule,
            out List<KeyValuePair<JObject, object>> values)
        {
            values = new List<KeyValuePair<JObject, object>>();
            foreach (var field in rule?.Fields ?? new List<JObject>())
            {
                if (!ImportTryGetFieldValue(row, fixedField, field, out var value)
                    || ImportNormalizeValue(value, field).DosIsNullOrWhiteSpace())
                {
                    values.Clear();
                    return false;
                }
                values.Add(new KeyValuePair<JObject, object>(field, value));
            }
            return values.Any();
        }

        private static string ImportResolveExistingRowId(
            IDictionary<string, object> row,
            JObject fixedField,
            IEnumerable<ImportUniqueRule> rules,
            string sqlTableName,
            DbTrans trans,
            DbInfo dbInfo,
            List<string> sqlLog,
            out string lastSql)
        {
            lastSql = "";
            var matchedIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var rule in rules ?? Enumerable.Empty<ImportUniqueRule>())
            {
                if (!ImportTryBuildUniqueRuleValues(row, fixedField, rule, out var values)) continue;
                var whereSql = " WHERE IsDeleted = 0 ";
                foreach (var item in values)
                {
                    var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(item.Key["Name"].Val<string>());
                    whereSql += $" AND {sqlFieldName}={ImportBuildSqlValue(item.Value, item.Key)} ";
                }

                var countSql = $"SELECT COUNT(Id) FROM {sqlTableName}{whereSql}";
                sqlLog?.Add(countSql);
                lastSql = countSql;
                var count = trans.FromSql(countSql).ToScalar<int>();
                if (count > 1)
                {
                    throw new Exception($"{ImportDescribeUniqueRule(rule)}在当前表中命中【{count}】条数据，无法确定要修改的记录，请先清理重复数据。");
                }
                if (count != 1) continue;

                var idSql = $"SELECT Id FROM {sqlTableName}{whereSql}";
                sqlLog?.Add(idSql);
                lastSql = idSql;
                var id = trans.FromSql(idSql).ToScalar<string>();
                if (id.DosIsNullOrWhiteSpace())
                {
                    throw new Exception($"{ImportDescribeUniqueRule(rule)}已命中数据但未读取到记录 Id。");
                }
                matchedIds.Add(id);
                if (matchedIds.Count > 1)
                {
                    throw new Exception("同一导入行的不同唯一规则命中了不同记录，无法安全判断修改目标。请检查唯一字段值或清理冲突数据。");
                }
            }
            return matchedIds.FirstOrDefault();
        }

        private static ImportRowWriteResult ImportWriteRow(
            IDictionary<string, object> row,
            int excelRow,
            JObject fixedField,
            List<JObject> importFieldList,
            List<ImportUniqueRule> uniqueRules,
            string sqlTableName,
            DbTrans trans,
            DbInfo dbInfo,
            DiyTableRowParam param,
            List<string> sqlLog)
        {
            var existingId = ImportResolveExistingRowId(
                row, fixedField, uniqueRules, sqlTableName, trans, dbInfo, sqlLog, out var lastSql);
            if (!existingId.DosIsNullOrWhiteSpace())
            {
                var colsSetBuilder = new System.Text.StringBuilder();
                foreach (var colModel in importFieldList)
                {
                    var fieldName = colModel["Name"].Val<string>();
                    if (string.Equals(fieldName, "Id", StringComparison.OrdinalIgnoreCase)) continue;
                    if (!ImportTryGetFieldValue(row, fixedField, colModel, out var valueObj)) continue;
                    if (param._CurrentUser?["_IsAdmin"].Val<bool>() != true
                        && string.Equals(fieldName, "TenantId", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(fieldName);
                    colsSetBuilder.Append($"{sqlFieldName}={ImportBuildSqlValue(valueObj, colModel)},");
                }
                var colsSet = colsSetBuilder.ToString().TrimEnd(',');
                if (colsSet.DosIsNullOrWhiteSpace())
                {
                    return new ImportRowWriteResult { Updated = true, Affected = 0, LastSql = lastSql };
                }
                var idField = MicroiEngine.ORM(dbInfo.DbType).GetFieldName("Id");
                var updateSql = $"UPDATE {sqlTableName} SET {colsSet} WHERE IsDeleted = 0 AND {idField}='{ImportEscapeSql(existingId)}'";
                sqlLog?.Add(updateSql);
                var affected = trans.FromSql(updateSql).ExecuteNonQuery();
                if (affected > 1)
                {
                    throw new Exception($"Excel 第【{excelRow}】行按唯一规则修改了【{affected}】条记录，已终止以避免批量误改。");
                }
                return new ImportRowWriteResult { Updated = true, Affected = affected, LastSql = updateSql };
            }

            var importedFieldNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var colNamesBuilder = new System.Text.StringBuilder();
            var colValuesBuilder = new System.Text.StringBuilder();
            foreach (var colModel in importFieldList)
            {
                var fieldName = colModel["Name"].Val<string>();
                if (string.Equals(fieldName, "Id", StringComparison.OrdinalIgnoreCase)) continue;
                if (!ImportTryGetFieldValue(row, fixedField, colModel, out var value)) continue;
                if (param._CurrentUser?["_IsAdmin"].Val<bool>() != true
                    && string.Equals(fieldName, "TenantId", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                colNamesBuilder.Append(MicroiEngine.ORM(dbInfo.DbType).GetFieldName(fieldName)).Append(',');
                colValuesBuilder.Append(ImportBuildSqlValue(value, colModel)).Append(',');
                importedFieldNames.Add(fieldName);
            }
            if (param._CurrentUser != null
                && !importedFieldNames.Contains("TenantId")
                && !param._CurrentUser["TenantId"].Val<string>().DosIsNullOrWhiteSpace())
            {
                colNamesBuilder.Append(MicroiEngine.ORM(dbInfo.DbType).GetFieldName("TenantId")).Append(',');
                colNamesBuilder.Append(MicroiEngine.ORM(dbInfo.DbType).GetFieldName("TenantName")).Append(',');
                colValuesBuilder.Append($"'{ImportEscapeSql(param._CurrentUser?["TenantId"].Val<string>())}','{ImportEscapeSql(param._CurrentUser?["TenantName"].Val<string>())}',");
            }
            var colNames = colNamesBuilder.ToString().TrimEnd(',');
            var colValues = colValuesBuilder.ToString().TrimEnd(',');
            if (colNames.DosIsNullOrWhiteSpace())
            {
                var headers = string.Join(",", row.Keys.Where(d => !string.Equals(d, "_ExcelRow", StringComparison.OrdinalIgnoreCase)));
                throw new Exception($"Excel 第【{excelRow}】行未匹配到可导入字段，请检查表头和列映射。表头：{headers}");
            }
            var insertSql = $@"INSERT INTO {sqlTableName} (Id,CreateTime,UpdateTime,UserId,IsDeleted,{colNames})
                                VALUES ('{Ulid.NewUlid()}',{MicroiEngine.ORM(dbInfo.DbType).GetDatetimeFieldValue(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss"))},NULL,'{ImportEscapeSql(param._CurrentUser?["Id"].Val<string>())}',0,{colValues})";
            sqlLog?.Add(insertSql);
            var insertAffected = trans.FromSql(insertSql).ExecuteNonQuery();
            if (insertAffected != 1)
            {
                throw new Exception($"Excel 第【{excelRow}】行新增结果异常，数据库影响行数为【{insertAffected}】。");
            }
            return new ImportRowWriteResult { Updated = false, Affected = insertAffected, LastSql = insertSql };
        }

        private static int ImportGetExcelRowNumber(IDictionary<string, object> row, int sourceIndex, DiyTableRowParam param)
        {
            if (row != null
                && row.TryGetValue("_ExcelRow", out var value)
                && int.TryParse(value?.ToString(), out var excelRow)
                && excelRow > 0)
            {
                return excelRow;
            }
            var firstDataRow = param?._ImportDataStartRow
                ?? ((param?._ImportHeaderEndRow ?? param?._ImportHeaderStartRow ?? 1) + 1);
            return firstDataRow + sourceIndex;
        }

        private static JObject ImportFindField(IEnumerable<JObject> fields, IEnumerable<string> names, IEnumerable<string> labels)
        {
            var nameSet = new HashSet<string>(names ?? new List<string>(), StringComparer.OrdinalIgnoreCase);
            var labelSet = new HashSet<string>(labels ?? new List<string>(), StringComparer.OrdinalIgnoreCase);
            return fields
                .Where(d => d != null)
                .OrderByDescending(d => d["Unique"].Val<int>())
                .ThenByDescending(d => string.Equals(d["Name"].Val<string>(), "Code", StringComparison.OrdinalIgnoreCase))
                .ThenByDescending(d => string.Equals(d["Label"].Val<string>(), "项目编号", StringComparison.OrdinalIgnoreCase))
                .FirstOrDefault(d => nameSet.Contains(d["Name"].Val<string>()) || labelSet.Contains(d["Label"].Val<string>()));
        }

        private class ImportChildParentMatch
        {
            public JObject ChildField { get; set; }
            public JObject ParentField { get; set; }
            public string ParentAlias { get; set; }
        }

        private class ImportChildParentBackfill
        {
            public JObject ChildField { get; set; }
            public JObject ParentField { get; set; }
            public string ParentAlias { get; set; }
        }

        private static JObject ImportFindFieldByNameOrLabel(IEnumerable<JObject> fields, string nameOrLabel, string label = null)
        {
            if (fields == null) return null;
            var list = fields.Where(d => d != null).ToList();
            if (!nameOrLabel.DosIsNullOrWhiteSpace())
            {
                var match = list.FirstOrDefault(d => string.Equals(d["Name"].Val<string>(), nameOrLabel, StringComparison.OrdinalIgnoreCase));
                if (match != null) return match;
                match = list.FirstOrDefault(d => string.Equals(d["Label"].Val<string>(), nameOrLabel, StringComparison.OrdinalIgnoreCase));
                if (match != null) return match;
            }
            if (!label.DosIsNullOrWhiteSpace())
            {
                return list.FirstOrDefault(d => string.Equals(d["Label"].Val<string>(), label, StringComparison.OrdinalIgnoreCase));
            }
            return null;
        }

        private static object ImportJTokenToObject(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) return null;
            if (token is JValue value) return value.Value;
            return token.ToString(Formatting.None);
        }

        private static string ImportGetFixedFieldString(JObject fixedField, JObject field)
        {
            if (fixedField == null || field == null) return "";
            var name = field["Name"].Val<string>();
            if (name.DosIsNullOrWhiteSpace() || !fixedField.ContainsKey(name)) return "";
            return ImportNormalizeValue(ImportJTokenToObject(fixedField[name]), field);
        }

        private static string ImportBuildMatchKey(IEnumerable<string> values)
        {
            return string.Join("\u001F", values.Select(d => (d ?? "").Trim().ToUpperInvariant()));
        }

        private static List<ImportChildParentMatch> ImportBuildChildParentMatches(
            List<JObject> childFields,
            List<JObject> parentFields,
            DiyFieldConfig relationConfig)
        {
            var result = new List<ImportChildParentMatch>();
            var relations = DiyTableChildFieldRelationHelper.GetRelations(relationConfig);
            foreach (var relation in relations.Where(d => d.ImportMatch))
            {
                var parentField = ImportFindFieldByNameOrLabel(
                    parentFields,
                    relation.ParentField,
                    relation.ParentFieldLabel);
                var childField = ImportFindFieldByNameOrLabel(
                    childFields,
                    relation.ChildField,
                    relation.ChildFieldLabel);
                if (parentField != null && childField != null)
                {
                    result.Add(new ImportChildParentMatch()
                    {
                        ParentField = parentField,
                        ChildField = childField,
                        ParentAlias = $"Match{result.Count}"
                    });
                }
            }

            if (result.Any()) return result;

            var preferredNames = new[]
            {
                "XiangmuBH", "ProjectCode", "ProjectNo", "ProjectBH",
                "CustomerName", "KehuMC", "KehuName", "ClientName",
                "SupplierName", "GongyingshangMC", "Name", "Code", "No"
            };
            foreach (var name in preferredNames)
            {
                var parentField = ImportFindFieldByNameOrLabel(parentFields, name);
                var childField = ImportFindFieldByNameOrLabel(childFields, name);
                if (parentField != null && childField != null)
                {
                    result.Add(new ImportChildParentMatch()
                    {
                        ParentField = parentField,
                        ChildField = childField,
                        ParentAlias = "Match0"
                    });
                    return result;
                }
            }

            var preferredLabels = new[] { "项目编号", "项目编码", "项目号", "客户名称", "客户名", "客户", "供应商名称", "供应商", "编号", "编码", "名称" };
            foreach (var label in preferredLabels)
            {
                var parentField = ImportFindFieldByNameOrLabel(parentFields, label);
                var childField = ImportFindFieldByNameOrLabel(childFields, label);
                if (parentField != null && childField != null)
                {
                    result.Add(new ImportChildParentMatch()
                    {
                        ParentField = parentField,
                        ChildField = childField,
                        ParentAlias = "Match0"
                    });
                    return result;
                }
            }

            var fallbackChildField = ImportFindField(
                childFields,
                new[] { "XiangmuBH", "ProjectCode", "ProjectNo", "ProjectBH", "Code" },
                new[] { "项目编号", "项目编码", "项目号" });
            var fallbackParentField = ImportFindField(
                parentFields,
                new[] { "Code", "XiangmuBH", "ProjectCode", "ProjectNo", "ProjectBH" },
                new[] { "项目编号", "项目编码", "项目号" });
            if (fallbackParentField != null && fallbackChildField != null)
            {
                result.Add(new ImportChildParentMatch()
                {
                    ParentField = fallbackParentField,
                    ChildField = fallbackChildField,
                    ParentAlias = "Match0"
                });
            }
            return result;
        }

        private static List<ImportChildParentBackfill> ImportBuildChildParentBackfills(
            List<JObject> childFields,
            List<JObject> parentFields,
            DiyFieldConfig relationConfig)
        {
            var result = new List<ImportChildParentBackfill>();
            foreach (var mapping in DiyTableChildFieldRelationHelper.GetRelations(relationConfig))
            {
                if (mapping == null) continue;
                var parentField = ImportFindFieldByNameOrLabel(parentFields, mapping.ParentField, mapping.ParentFieldLabel);
                var childField = ImportFindFieldByNameOrLabel(childFields, mapping.ChildField, mapping.ChildFieldLabel);
                if (parentField == null || childField == null) continue;
                if (result.Any(d => string.Equals(d.ChildField["Name"].Val<string>(), childField["Name"].Val<string>(), StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }
                result.Add(new ImportChildParentBackfill()
                {
                    ParentField = parentField,
                    ChildField = childField,
                    ParentAlias = $"Backfill{result.Count}"
                });
            }
            return result;
        }

        private static int ImportBackfillChildFieldsFromParentRow(
            IDictionary<string, object> childRow,
            JObject fixedField,
            JObject parentRow,
            List<ImportChildParentBackfill> backfills)
        {
            if (childRow == null || parentRow == null || backfills == null || backfills.Count == 0) return 0;
            var count = 0;
            foreach (var backfill in backfills)
            {
                if (backfill?.ChildField == null || backfill.ParentField == null) continue;
                if (ImportHasFieldValue(childRow, fixedField, backfill.ChildField)) continue;
                var value = ImportNormalizeValue(ImportJTokenToObject(parentRow[backfill.ParentAlias]), backfill.ParentField);
                if (value.DosIsNullOrWhiteSpace()) continue;
                var childLabel = backfill.ChildField["Label"].Val<string>();
                var childName = backfill.ChildField["Name"].Val<string>();
                if (!childLabel.DosIsNullOrWhiteSpace()) childRow[childLabel] = value;
                if (!childName.DosIsNullOrWhiteSpace()) childRow[childName] = value;
                count++;
            }
            return count;
        }

        private int ImportAutoFillChildFkByParentCode(
            List<dynamic> fileDataList,
            List<JObject> currentFieldList,
            JObject fixedField,
            DiyTable currentTable,
            DbSession dbSession,
            DbInfo dbInfo,
            OsClientSecret osClientModel,
            List<string> importStepList,
            string dateTimeFormat)
        {
            if (fileDataList == null || fileDataList.Count == 0 || currentTable == null) return 0;
            var filledCount = 0;
            var tableChildFields = dbSession.From<DiyField>()
                .Where(d => d.Component == "TableChild" && d.IsDeleted == 0)
                .ToList();

            var duplicateMatchWarnings = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var relationField in tableChildFields)
            {
                DiyFieldConfig relationConfig = null;
                try
                {
                    relationConfig = JsonHelper.Deserialize<DiyFieldConfig>(relationField.Config ?? "") ?? new DiyFieldConfig();
                }
                catch
                {
                    continue;
                }
                if (!string.Equals(relationConfig.TableChildTableId, currentTable.Id, StringComparison.OrdinalIgnoreCase)
                    || relationConfig.TableChildFkFieldName.DosIsNullOrWhiteSpace())
                {
                    continue;
                }
                if (relationConfig.TableChild?.ImportAutoFillFk == false)
                {
                    continue;
                }

                var fkField = currentFieldList.FirstOrDefault(d => string.Equals(d["Name"].Val<string>(), relationConfig.TableChildFkFieldName, StringComparison.OrdinalIgnoreCase));
                if (fkField == null) continue;

                var parentTable = dbSession.From<DiyTable>()
                    .Where(d => d.Id == relationField.TableId && d.IsDeleted == 0)
                    .First();
                if (parentTable == null) continue;

                var parentFieldEntities = dbSession.From<DiyField>()
                    .Where(d => d.TableId == parentTable.Id && d.IsDeleted == 0)
                    .ToList();
                var parentFields = parentFieldEntities.Select(d => JObject.FromObject(d)).ToList();
                var parentCodeField = ImportFindField(
                    parentFields,
                    new[] { "Code", "XiangmuBH", "ProjectCode", "ProjectNo", "ProjectBH" },
                    new[] { "项目编号", "项目编码", "项目号" });
                var primaryFieldName = relationConfig.TableChild?.PrimaryTableFieldName;
                if (primaryFieldName.DosIsNullOrWhiteSpace()) primaryFieldName = "Id";

                var dbOracleTableSpace = osClientModel.OsClientModel["DbOracleTableSpace"].Val<string>();
                var sqlTableName = MicroiEngine.ORM(dbInfo.DbType).GetTableName(parentTable.Name, dbOracleTableSpace);
                var sqlPkFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(primaryFieldName);
                var backfills = ImportBuildChildParentBackfills(currentFieldList, parentFields, relationConfig);
                var backfillSelectSql = string.Join(",", backfills.Select(d =>
                    $"{MicroiEngine.ORM(dbInfo.DbType).GetFieldName(d.ParentField["Name"].Val<string>())} {d.ParentAlias}"));
                var fixedParentKey = ImportGetFixedFieldString(fixedField, fkField);
                if (!fixedParentKey.DosIsNullOrWhiteSpace() && backfills.Any())
                {
                    var fixedSql = $"SELECT {backfillSelectSql} FROM {sqlTableName} WHERE IsDeleted = 0 AND {sqlPkFieldName} = '{ImportEscapeSql(fixedParentKey)}'";
                    var fixedParent = dbSession.FromSql(fixedSql).First<dynamic>();
                    if (fixedParent != null)
                    {
                        var fixedParentRow = JObject.FromObject((object)fixedParent);
                        var fixedBackfillCount = 0;
                        foreach (var row in fileDataList.Select(ImportGetRowDictionary))
                        {
                            fixedBackfillCount += ImportBackfillChildFieldsFromParentRow(row, fixedField, fixedParentRow, backfills);
                        }
                        if (fixedBackfillCount > 0)
                        {
                            var backfillText = string.Join(" + ", backfills.Select(d => $"{parentTable.Name}.{d.ParentField["Name"].Val<string>()}->{currentTable.Name}.{d.ChildField["Name"].Val<string>()}"));
                            importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：调试：已根据固定父表[{parentTable.Name}.{primaryFieldName}={fixedParentKey}]回填子表字段[{backfillText}]【{fixedBackfillCount}】处。");
                        }
                    }
                }
                var hasExplicitImportRelation = DiyTableChildFieldRelationHelper
                    .GetRelations(relationConfig)
                    .Any(d => d.ImportMatch);
                var matches = ImportBuildChildParentMatches(currentFieldList, parentFields, relationConfig);
                if (!matches.Any() && parentCodeField != null)
                {
                    var childCodeField = ImportFindField(
                        currentFieldList,
                        new[] { "XiangmuBH", "ProjectCode", "ProjectNo", "ProjectBH", "Code" },
                        new[] { "项目编号", "项目编码", "项目号" });
                    if (childCodeField != null)
                    {
                        matches.Add(new ImportChildParentMatch()
                        {
                            ParentField = parentCodeField,
                            ChildField = childCodeField,
                            ParentAlias = "Match0"
                        });
                    }
                }
                if (!matches.Any()) continue;

                for (var matchIndex = 0; matchIndex < matches.Count; matchIndex++)
                {
                    matches[matchIndex].ParentAlias = $"Match{matchIndex}";
                }

                var pendingRowKeys = new List<KeyValuePair<IDictionary<string, object>, string>>();
                var firstMatchValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var row in fileDataList.Select(ImportGetRowDictionary))
                {
                    if (row == null || ImportHasFieldValue(row, fixedField, fkField)) continue;
                    var values = new List<string>();
                    foreach (var match in matches)
                    {
                        ImportTryGetFieldValue(row, null, match.ChildField, out var childValue);
                        var normalized = ImportNormalizeValue(childValue, match.ChildField);
                        if (normalized.DosIsNullOrWhiteSpace())
                        {
                            values.Clear();
                            break;
                        }
                        values.Add(normalized);
                    }
                    if (!values.Any()) continue;
                    pendingRowKeys.Add(new KeyValuePair<IDictionary<string, object>, string>(row, ImportBuildMatchKey(values)));
                    firstMatchValues.Add(values[0]);
                }
                if (!pendingRowKeys.Any()) continue;

                var firstSqlMatchFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(matches[0].ParentField["Name"].Val<string>());
                var matchSelectSql = string.Join(",", matches.Select(d =>
                    $"{MicroiEngine.ORM(dbInfo.DbType).GetFieldName(d.ParentField["Name"].Val<string>())} {d.ParentAlias}"));
                var selectSql = matchSelectSql;
                if (!backfillSelectSql.DosIsNullOrWhiteSpace())
                {
                    selectSql += "," + backfillSelectSql;
                }
                var codeToId = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var codeToParentRow = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase);
                var duplicateKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var relationFilledCount = 0;
                var relationBackfillCount = 0;

                foreach (var chunk in firstMatchValues.Select((code, index) => new { code, index }).GroupBy(d => d.index / 500))
                {
                    var inValues = string.Join(",", chunk.Select(d => $"'{ImportEscapeSql(d.code)}'"));
                    var sql = $"SELECT {sqlPkFieldName} Id,{selectSql} FROM {sqlTableName} WHERE IsDeleted = 0 AND {firstSqlMatchFieldName} IN ({inValues})";
                    var parentRows = dbSession.FromSql(sql).ToArray();
                    foreach (var row in parentRows)
                    {
                        var rowObj = JObject.FromObject((object)row);
                        var values = new List<string>();
                        foreach (var match in matches)
                        {
                            var normalized = ImportNormalizeValue(ImportJTokenToObject(rowObj[match.ParentAlias]), match.ParentField);
                            if (normalized.DosIsNullOrWhiteSpace())
                            {
                                values.Clear();
                                break;
                            }
                            values.Add(normalized);
                        }
                        if (!values.Any()) continue;
                        var code = ImportBuildMatchKey(values);
                        var id = ImportNormalizeValue(ImportJTokenToObject(rowObj["Id"]), null);
                        if (code.DosIsNullOrWhiteSpace() || id.DosIsNullOrWhiteSpace()) continue;
                        if (codeToId.ContainsKey(code) && !string.Equals(codeToId[code], id, StringComparison.OrdinalIgnoreCase))
                        {
                            duplicateKeys.Add(code);
                            continue;
                        }
                        if (!codeToId.ContainsKey(code))
                        {
                            codeToId.Add(code, id);
                            codeToParentRow.Add(code, rowObj);
                        }
                    }
                }

                foreach (var item in pendingRowKeys)
                {
                    var row = item.Key;
                    var code = item.Value;
                    if (code.DosIsNullOrWhiteSpace() || duplicateKeys.Contains(code) || !codeToId.TryGetValue(code, out var parentId)) continue;
                    row[fkField["Label"].Val<string>()] = parentId;
                    row[fkField["Name"].Val<string>()] = parentId;
                    if (codeToParentRow.TryGetValue(code, out var parentRow))
                    {
                        relationBackfillCount += ImportBackfillChildFieldsFromParentRow(row, fixedField, parentRow, backfills);
                    }
                    relationFilledCount++;
                    filledCount++;
                }
                var matchText = string.Join(" + ", matches.Select(d => $"{parentTable.Name}.{d.ParentField["Name"].Val<string>()}={currentTable.Name}.{d.ChildField["Name"].Val<string>()}"));
                if (relationFilledCount > 0)
                {
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：调试：已根据导入关联[{matchText}]批量补齐子表字段[{currentTable.Name}.{fkField["Name"].Val<string>()}]【{relationFilledCount}】条。");
                }
                if (relationBackfillCount > 0)
                {
                    var backfillText = string.Join(" + ", backfills.Select(d => $"{parentTable.Name}.{d.ParentField["Name"].Val<string>()}->{currentTable.Name}.{d.ChildField["Name"].Val<string>()}"));
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：调试：已根据导入关联[{matchText}]批量回填子表字段[{backfillText}]【{relationBackfillCount}】处。");
                }
                var duplicateWarningKey = $"{parentTable.Name}|{currentTable.Name}|{matchText}";
                if (hasExplicitImportRelation && duplicateKeys.Count > 0 && !duplicateMatchWarnings.Contains(duplicateWarningKey))
                {
                    duplicateMatchWarnings.Add(duplicateWarningKey);
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：调试：主表匹配字段存在【{duplicateKeys.Count}】个重复值，相关子表行未自动补齐外键。");
                }
            }
            return filledCount;
        }

        private static string ImportBuildExceptionDebug(Exception ex)
        {
            if (ex == null) return "";
            var messages = new List<string>()
            {
                $"{ex.GetType().Name}: {ex.Message}"
            };
            var inner = ex.InnerException;
            var innerIndex = 1;
            while (inner != null && innerIndex <= 2)
            {
                messages.Add($"Inner{innerIndex} {inner.GetType().Name}: {inner.Message}");
                inner = inner.InnerException;
                innerIndex++;
            }
            if (!ex.StackTrace.DosIsNullOrWhiteSpace())
            {
                var firstStackLine = ex.StackTrace
                    .Split(new[] { Environment.NewLine }, StringSplitOptions.RemoveEmptyEntries)
                    .FirstOrDefault();
                if (!firstStackLine.DosIsNullOrWhiteSpace())
                {
                    messages.Add($"Stack: {firstStackLine.Trim()}");
                }
            }
            return string.Join("；", messages);
        }

        public async Task<DosResult> ImportExcel(DiyTableRowParam param, HttpContext _httpContext = null)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace()
                || param.TableId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            var result = new DosResult();
            var _context = DiyHttpContext.Current ?? _httpContext;
            var files = _context.Request.Form.Files;
            const string dateTimeFormat = "yyyy/MM/dd HH:mm:ss";
            var osClient = param.OsClient;
            var startSign = $"Microi:{osClient}:ImportTableDataStart:{param.TableId}";
            var stepSign = $"Microi:{osClient}:ImportTableDataStep:{param.TableId}:{param._SysMenuId}";

            var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam()
            {
                Key = $"Microi:{osClient}:ImportTableData:{param.TableId}",
                OsClient = osClient,
                Expiry = TimeSpan.FromSeconds(10)
            }, async () =>
    {
        var diyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);
        var importStepList = new List<string>();
        try
        {
            var isStartStep = (string)await diyCacheBase.GetAsync(startSign) == "1";
            if (isStartStep)
            {
                result = new DosResult(0, null, "注意：有数据正在导入！请导入结束后再操作。若进度异常，请联系系统管理员！");
                return;
            }
            await diyCacheBase.SetAsync(startSign, "1");
            if (files.Count != 1)
            {
                await diyCacheBase.SetAsync(startSign, "0");
                importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已失败！必须且只能上传一个 Excel 或 CSV 文件！");
                await diyCacheBase.SetAsync(stepSign, importStepList);
                result = new DosResult(0, null, "必须且只能上传一个 Excel 或 CSV 文件！");
                return;
            }

            var file = files[0];
            var fileSuffix = Path.GetExtension(file.FileName)?.ToLowerInvariant();
            if (file.Length <= 0 || file.Length > MaxImportExcelFileBytes)
            {
                await diyCacheBase.SetAsync(startSign, "0");
                result = new DosResult(0, null, $"Excel/CSV 文件必须大于0且不超过{MaxImportExcelFileBytes / 1024 / 1024}MB！");
                importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已失败！{result.Msg}");
                await diyCacheBase.SetAsync(stepSign, importStepList);
                return;
            }
            if (fileSuffix != ".xls" && fileSuffix != ".xlsx" && fileSuffix != ".csv")
            {
                await diyCacheBase.SetAsync(startSign, "0");
                result = new DosResult(0, null, "只允许导入真实的 .xls、.xlsx 或 .csv 文件！");
                importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已失败！{result.Msg}");
                await diyCacheBase.SetAsync(stepSign, importStepList);
                return;
            }
            string importErrorPolicy;
            try
            {
                importErrorPolicy = ImportNormalizeErrorPolicy(param._ImportErrorPolicy);
            }
            catch (Exception ex)
            {
                await diyCacheBase.SetAsync(startSign, "0");
                result = new DosResult(0, null, ex.Message);
                importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已失败！{ex.Message}");
                await diyCacheBase.SetAsync(stepSign, importStepList);
                return;
            }

            importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：正在上传文件...");
            await diyCacheBase.SetAsync(stepSign, importStepList);

            var realFileName = Ulid.NewUlid().ToString();

            importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：正在读取文件数据...");
            await diyCacheBase.SetAsync(stepSign, importStepList);

            #region 拼接字段名
            //获取所有需要插入的列名
            var fieldListResult = await MicroiEngine.FormEngine.GetDiyField(new DiyFieldParam()
            {
                TableId = param.TableId,
                OsClient = param.OsClient,
                _OnlyRealField = true,
                IsDeleted = 0
            });
            var fieldList = fieldListResult.Data;
            #endregion

            var osClientModel = OsClient.GetClient(param.OsClient);
            DbSession dbSession = osClientModel.Db;
            var dbInfo = DiyCommon.GetDbInfo(osClientModel.OsClientModel["DbType"].Val<string>());
            //查询出DiyTableModel
            //var diyTableModel = DiyTableRepository.First(d => d.Id == param.TableId);
            var diyTableModel = dbSession.From<DiyTable>()
                                // .Select(CommonModel._diyTableFields)
                                .Where(d => d.Id == param.TableId)
                                .First();
            if (diyTableModel == null)
            {
                await diyCacheBase.SetAsync(startSign, "0");
                result = new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoExistData", param._Lang) + " DiyTable-Id：" + param.TableId);
                return;
            }


            //var allStu = new NPOIHelper(file.OpenReadStream()).ExcelToListDynamic();
            //importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：已读取【" + allStu.Count + "】条数据！");
            //importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：正在开启新线程进行导入...");
            //await DiyCacheBase.SetAsync(stepSign, importStepList);

            //放在ThreadPool.QueueUserWorkItem外面不会报错Cannot access a closed Stream.
            //var allStu2 = new NPOIHelper(file.OpenReadStream()).ExcelToListDynamic();

            //注意这里的stream无法传入到子线程中去，会报：Cannot access a closed Stream.
            //var fileStream = file.OpenReadStream();
            var fileByte = StreamHelper.StreamToBytes(file.OpenReadStream());
            //ThreadPool.QueueUserWorkItem(async (state) =>
            Task task = Task.Run(async () =>
            {
                var sqlLog = new List<string>();
                var lastSqlLog = "";
                var successCount = 0;
                var updatedCount = 0;
                var failedCount = 0;
                try
                {
                    if (!OfficeDocumentSecurity.HasExpectedFileSignature(fileSuffix, fileByte))
                    {
                        throw new ArgumentException($"上传内容与文件类型{fileSuffix}不一致或文件已损坏。");
                    }
                    var importColumnMappings = new List<ExcelImportColumnParam>();
                    if (!param._ImportColumnsJson.DosIsNullOrWhiteSpace())
                    {
                        importColumnMappings = JsonConvert.DeserializeObject<List<ExcelImportColumnParam>>(
                            param._ImportColumnsJson) ?? new List<ExcelImportColumnParam>();
                    }
                    List<dynamic> fileDataList;
                    CsvImportHelper.CsvImportResult csvImportResult = null;
                    if (fileSuffix == ".csv")
                    {
                        csvImportResult = CsvImportHelper.CsvToListDynamic(
                            fileByte,
                            MaxImportExcelDataRows,
                            MaxImportExcelColumns,
                            param._ImportHeaderStartRow,
                            param._ImportHeaderEndRow,
                            param._ImportDataStartRow,
                            param._ImportDataEndRow,
                            importColumnMappings,
                            null,
                            null);
                        string expectedEncoding = (param._ImportEncoding ?? "").Trim();
                        if (expectedEncoding.Equals("GB18030", StringComparison.OrdinalIgnoreCase)) expectedEncoding = "GBK";
                        if (!expectedEncoding.DosIsNullOrWhiteSpace()
                            && !expectedEncoding.Equals(csvImportResult.Encoding, StringComparison.OrdinalIgnoreCase))
                        {
                            throw new ArgumentException($"CSV 编码复核不一致：前端识别为{expectedEncoding}，服务端识别为{csvImportResult.Encoding}。");
                        }
                        string expectedDelimiter = param._ImportDelimiter == "\t" ? "\\t" : (param._ImportDelimiter ?? "");
                        if (!expectedDelimiter.DosIsNullOrWhiteSpace()
                            && !expectedDelimiter.Equals(csvImportResult.Delimiter, StringComparison.Ordinal))
                        {
                            throw new ArgumentException("CSV 分隔符复核不一致，请重新上传后确认预览。");
                        }
                        fileDataList = csvImportResult.Rows;
                    }
                    else
                    {
                        fileDataList = new NPOIHelper(fileByte).ExcelToListDynamic(
                            param._ImportSheetIndex ?? 0,
                            MaxImportExcelDataRows,
                            MaxImportExcelColumns,
                            param._ImportHeaderStartRow,
                            param._ImportHeaderEndRow,
                            param._ImportDataStartRow,
                            param._ImportDataEndRow,
                            importColumnMappings);
                    }
                    if (param._ImportHeaderStartRow.HasValue || importColumnMappings.Any())
                    {
                        var sourceDescription = csvImportResult == null
                            ? $"Sheet第【{(param._ImportSheetIndex ?? 0) + 1}】张"
                            : $"CSV 编码【{csvImportResult.Encoding}】、分隔符【{csvImportResult.Delimiter}】";
                        importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已按确认范围解析：{sourceDescription}，"
                            + $"表头【{param._ImportHeaderStartRow ?? 1}-{param._ImportHeaderEndRow ?? param._ImportHeaderStartRow ?? 1}】行，"
                            + $"数据从第【{param._ImportDataStartRow ?? (param._ImportHeaderEndRow ?? 1) + 1}】行开始，"
                            + $"映射【{importColumnMappings.Count}】列。");
                    }
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已读取【{fileDataList.Count}】条数据！");
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：正在开启新线程进行导入...");
                    await diyCacheBase.SetAsync(stepSign, importStepList);

                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：正在获取基础数据...");
                    await diyCacheBase.SetAsync(stepSign, importStepList);

                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：正在导入数据...");
                    await diyCacheBase.SetAsync(stepSign, importStepList);

                    //应该使用param._RowModel，但由于element upload组件暂不支持传入object，只能string，所以临时使用param._FieldId
                    JObject guanlianField = new JObject();
                    if (!param._FieldId.DosIsNullOrWhiteSpace())
                    {
                        try
                        {
                            guanlianField = JObject.Parse(param._FieldId);
                        }
                        catch (Exception ex)
                        {
                            throw new Exception($"关联字段参数解析失败：{ex.Message}");
                        }
                    }

                    var importFieldList = ImportBuildFieldList(fieldList, importStepList, dateTimeFormat);
                    if (!importFieldList.Any())
                    {
                        throw new Exception("未找到可导入字段，请检查Excel表头是否与字段名称一致。");
                    }
                    ImportAutoFillChildFkByParentCode(fileDataList, importFieldList, guanlianField, diyTableModel, dbSession, dbInfo, osClientModel, importStepList, dateTimeFormat);
                    await diyCacheBase.SetAsync(stepSign, importStepList);

                    // 唯一规则只能由服务端字段元数据计算，前端 _ImportMetaJson 中的规则仅用于提示。
                    var uniqueRules = ImportBuildUniqueRules(fieldList);
                    var uniqueRuleDescription = ImportDescribeUniqueRules(uniqueRules);
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：错误处理策略：【{importErrorPolicy}】。");
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：重复数据判断：【{uniqueRuleDescription}】。任一规则命中同一记录则修改，均未命中则新增。");
                    await diyCacheBase.SetAsync(stepSign, importStepList);

                    var sqlTableName = MicroiEngine.ORM(dbInfo.DbType).GetTableName(
                        diyTableModel.Name,
                        osClientModel.OsClientModel["DbOracleTableSpace"].Val<string>());
                    var progressIndex = importStepList.Count;
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已处理【0/{fileDataList.Count}】条，成功【0】条，失败【0】条...");
                    await diyCacheBase.SetAsync(stepSign, importStepList);

                    if (importErrorPolicy == ImportErrorPolicyRollbackAll)
                    {
                        using (var trans = dbSession.BeginTransaction())
                        {
                            try
                            {
                                for (var sourceIndex = 0; sourceIndex < fileDataList.Count; sourceIndex++)
                                {
                                    var itemEObj = ImportGetRowDictionary((object)fileDataList[sourceIndex]);
                                    var excelRow = ImportGetExcelRowNumber(itemEObj, sourceIndex, param);
                                    if (itemEObj == null)
                                    {
                                        throw new Exception($"Excel 第【{excelRow}】行不是可识别的数据对象。");
                                    }
                                    ImportRowWriteResult rowResult;
                                    try
                                    {
                                        rowResult = ImportWriteRow(
                                            itemEObj, excelRow, guanlianField, importFieldList, uniqueRules,
                                            sqlTableName, trans, dbInfo, param, sqlLog);
                                    }
                                    catch (Exception rowEx)
                                    {
                                        throw new Exception($"Excel 第【{excelRow}】行导入失败：{rowEx.Message}", rowEx);
                                    }
                                    lastSqlLog = rowResult.LastSql ?? lastSqlLog;
                                    successCount++;
                                    if (rowResult.Updated) updatedCount++;
                                    importStepList[progressIndex] = $"{DateTime.Now.ToString(dateTimeFormat)}：已处理【{sourceIndex + 1}/{fileDataList.Count}】条，成功【{successCount}】条，失败【0】条...";
                                    await diyCacheBase.SetAsync(stepSign, importStepList);
                                }
                                trans.Commit();
                            }
                            catch (Exception ex)
                            {
                                if (!trans.IsCommitOrRollback)
                                {
                                    try { trans.Rollback(); }
                                    catch (Exception rollbackEx)
                                    {
                                        throw new AggregateException("导入失败且数据库回滚也发生异常。", ex, rollbackEx);
                                    }
                                }
                                var rolledBackCount = successCount;
                                successCount = 0;
                                updatedCount = 0;
                                failedCount = 1;
                                throw new Exception($"本次选择了“任一行失败则全部回滚”；已回滚此前处理的【{rolledBackCount}】条数据。{ex.Message}", ex);
                            }
                        }
                    }
                    else
                    {
                        for (var sourceIndex = 0; sourceIndex < fileDataList.Count; sourceIndex++)
                        {
                            var itemEObj = ImportGetRowDictionary((object)fileDataList[sourceIndex]);
                            var excelRow = ImportGetExcelRowNumber(itemEObj, sourceIndex, param);
                            using (var trans = dbSession.BeginTransaction())
                            {
                                try
                                {
                                    if (itemEObj == null)
                                    {
                                        throw new Exception("该行不是可识别的数据对象。");
                                    }
                                    var rowResult = ImportWriteRow(
                                        itemEObj, excelRow, guanlianField, importFieldList, uniqueRules,
                                        sqlTableName, trans, dbInfo, param, sqlLog);
                                    lastSqlLog = rowResult.LastSql ?? lastSqlLog;
                                    trans.Commit();
                                    successCount++;
                                    if (rowResult.Updated) updatedCount++;
                                }
                                catch (Exception rowEx)
                                {
                                    var rollbackError = "";
                                    if (!trans.IsCommitOrRollback)
                                    {
                                        try { trans.Rollback(); }
                                        catch (Exception rollbackEx)
                                        {
                                            throw new AggregateException(
                                                $"Excel 第【{excelRow}】行失败且该行事务回滚异常，无法安全继续。",
                                                rowEx,
                                                rollbackEx);
                                        }
                                    }
                                    failedCount++;
                                    if (failedCount <= MaxImportErrorDetails)
                                    {
                                        importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：Excel 第【{excelRow}】行失败，已跳过：{rowEx.Message}{rollbackError}");
                                        MicroiEngine.QueueSystemLog(
                                            param.OsClient,
                                            "Office",
                                            "DataImportRowFailed",
                                            "Excel 数据导入行失败并跳过",
                                            $"ExcelRow={excelRow}; Error={rowEx}",
                                            2,
                                            false,
                                            param.TableId);
                                    }
                                }
                            }
                            importStepList[progressIndex] = $"{DateTime.Now.ToString(dateTimeFormat)}：已处理【{sourceIndex + 1}/{fileDataList.Count}】条，成功【{successCount}】条，失败【{failedCount}】条...";
                            await diyCacheBase.SetAsync(stepSign, importStepList);
                        }
                        if (failedCount > MaxImportErrorDetails)
                        {
                            importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：另有【{failedCount - MaxImportErrorDetails}】条错误未逐条展示，完整数量已计入失败统计。");
                        }
                    }

                    var addedCount = successCount - updatedCount;
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：导入完成：成功【{successCount}】条（新增【{addedCount}】、修改【{updatedCount}】），失败【{failedCount}】条。");
                    importStepList.Add(importErrorPolicy == ImportErrorPolicyContinueOnError && failedCount > 0
                        ? $"{DateTime.Now.ToString(dateTimeFormat)}：已按用户选择跳过错误行，其余成功行均已提交。"
                        : $"{DateTime.Now.ToString(dateTimeFormat)}：已全部成功结束！线程关闭。");
                    UserBehaviorAudit.Track(param, "Data", "DataImport", "导入数据", "Table", param.TableId,
                        $"向表[{diyTableModel?.Name}/{param.TableId}]导入完成，策略[{importErrorPolicy}]，成功[{successCount}]、新增[{addedCount}]、修改[{updatedCount}]、失败[{failedCount}]",
                        new
                        {
                            TableId = param.TableId,
                            Table = diyTableModel?.Name,
                            ErrorPolicy = importErrorPolicy,
                            Count = successCount,
                            Updated = updatedCount,
                            Added = addedCount,
                            Failed = failedCount,
                            UniqueRules = uniqueRuleDescription
                        });
                    await diyCacheBase.SetAsync(stepSign, importStepList);
                    await diyCacheBase.SetAsync(startSign, "0");
                }
                catch (Exception ex)
                {
                    UserBehaviorAudit.Track(param, "Data", "DataImport", "导入数据", "Table", param.TableId,
                        $"向表[{diyTableModel?.Name}/{param.TableId}]导入数据失败",
                        new
                        {
                            TableId = param.TableId,
                            Table = diyTableModel?.Name,
                            ErrorPolicy = importErrorPolicy,
                            Success = successCount,
                            Updated = updatedCount,
                            Failed = failedCount,
                            Error = ex.Message
                        }, false);
                    await diyCacheBase.SetAsync(startSign, "0");
                    MicroiEngine.QueueSystemLog(param.OsClient, "Office", "DataImportFailed", "Excel 数据导入失败", ex.ToString(), 2, false, param.TableId);
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已失败！{ex.Message}");
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：lastSql：{lastSqlLog}");
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：调试：{ImportBuildExceptionDebug(ex)}");
                    await diyCacheBase.SetAsync(stepSign, importStepList);
                }
            });
            result = new DosResult(1, null);
        }
        catch (Exception ex)
        {
            await diyCacheBase.SetAsync(startSign, "0");
            MicroiEngine.QueueSystemLog(param.OsClient, "Office", "DataImportInitializationFailed", "Excel 数据导入初始化失败", ex.ToString(), 2, false, param.TableId);
            importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已失败！{ex.Message}");
            importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：调试：{ImportBuildExceptionDebug(ex)}");
            await diyCacheBase.SetAsync(stepSign, importStepList);
            result = new DosResult(0, null, $"已失败！请查看导入进度。{ex.Message}");
        }
    });
            if (lockResult.Code != 1)
            {
                return lockResult;
            }
            return result;
        }

        public DosResult SendEmail(dynamic dynamicParam)
        {
            EmailParam param = DynamicParam3(dynamicParam);
            return SendEmailAsync(param).ConfigureAwait(false).GetAwaiter().GetResult();
        }
        public async Task<DosResult> SendEmailAsync(EmailParam param)
        {
            try
            {
                // 配置SMTP服务器
                var smtpServer = param.SmtpServer;
                var port = param.SmtpPort;
                var enableSsl = param.EnableSSL;
                var email = param.SystemEmail;
                var password = param.SystemEmailPwd;

                // 创建邮件消息对象
                using (var mail = new MailMessage())
                {
                    mail.From = new MailAddress(email);
                    foreach (var receiver in param.Receivers)
                    {
                        mail.To.Add(receiver);
                    }
                    mail.Subject = param.EmailSubject;
                    mail.Body = param.EmailBody;
                    mail.IsBodyHtml = true;

                    // 创建SmtpClient对象并发送邮件
                    using (var smtpClient = new SmtpClient(smtpServer, port))
                    {
                        smtpClient.Credentials = new NetworkCredential(email, password);
                        smtpClient.EnableSsl = enableSsl;
                        smtpClient.Send(mail);
                    }
                }
                return new DosResult(1, null, string.Empty);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
    }
}
