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
                var result = new NPOIHelper(fileByte).ExcelToListDynamic(param.SheetIndex ?? 0);
                return new DosResultList<dynamic>(1, result);
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
                ISheet sheet = workbook.CreateSheet("Sheet1");
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
                        if (index - dicFieldImgs[field["Name"].Val<string>()] > index - 1)
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
                //转为字节数组  
                using (var stream = new MemoryStream())
                {
                    workbook.Write(stream);
                    var buf = stream.ToArray();
                    return new DosResult<byte[]>(1, buf);
                }
                #endregion
            }
            catch (Exception ex)
            {
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
                foreach (var sheet in sheets)
                {
                    ApplyExcelSheetDefaults(parentParam, sheet);
                    var sheetDataResult = await GetExportExcelSheetDataAsync(sheet);
                    if (sheetDataResult.Code != 1)
                    {
                        return new DosResult<byte[]>(0, null, sheetDataResult.Msg);
                    }
                    var sheetName = GetSafeExcelSheetName(workbook, sheet.SheetName, sheetIndex);
                    await WriteExportExcelSheetAsync(
                        workbook,
                        sheetName,
                        sheetDataResult.Data.ExcelData,
                        sheetDataResult.Data.ExcelHeader,
                        sheet.ExcelHeader == null,
                        sysConfig
                    );
                    sheetIndex++;
                }
                using (var stream = new MemoryStream())
                {
                    workbook.Write(stream);
                    return new DosResult<byte[]>(1, stream.ToArray());
                }
            }
            catch (Exception ex)
            {
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

        private async Task WriteExportExcelSheetAsync(IWorkbook workbook, string sheetName, List<dynamic> result, List<JObject> fieldList, bool appendDefaultFields, dynamic sysConfig)
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
                    if (index - dicFieldImgs[field["Name"].Val<string>()] > index - 1)
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
            var tableChildConfig = relationConfig?.TableChild;
            if (tableChildConfig?.ImportRelations != null)
            {
                foreach (var relation in tableChildConfig.ImportRelations)
                {
                    var parentKey = relation.ParentFieldName.DosIsNullOrWhiteSpace(relation.Parent);
                    var childKey = relation.ChildFieldName.DosIsNullOrWhiteSpace(relation.Child);
                    var parentField = ImportFindFieldByNameOrLabel(parentFields, parentKey, relation.ParentFieldLabel);
                    var childField = ImportFindFieldByNameOrLabel(childFields, childKey, relation.ChildFieldLabel);
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
            }

            if (!result.Any()
                && tableChildConfig != null
                && (!tableChildConfig.ImportParentMatchFieldName.DosIsNullOrWhiteSpace()
                    || !tableChildConfig.ImportChildMatchFieldName.DosIsNullOrWhiteSpace()))
            {
                var parentField = ImportFindFieldByNameOrLabel(parentFields, tableChildConfig.ImportParentMatchFieldName);
                var childField = ImportFindFieldByNameOrLabel(childFields, tableChildConfig.ImportChildMatchFieldName);
                if (parentField != null && childField != null)
                {
                    result.Add(new ImportChildParentMatch()
                    {
                        ParentField = parentField,
                        ChildField = childField,
                        ParentAlias = "Match0"
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
            var mappings = new List<DiyFieldConfigTableChildImportBackfill>();
            if (relationConfig?.TableChild?.ImportBackfillFields != null)
            {
                mappings.AddRange(relationConfig.TableChild.ImportBackfillFields);
            }
            if (relationConfig != null && !relationConfig.TableChildCallbackField.DosIsNullOrWhiteSpace())
            {
                try
                {
                    var legacyMappings = JsonHelper.Deserialize<List<DiyFieldConfigTableChildImportBackfill>>(relationConfig.TableChildCallbackField);
                    if (legacyMappings != null)
                    {
                        mappings.AddRange(legacyMappings);
                    }
                }
                catch { }
            }
            foreach (var mapping in mappings)
            {
                if (mapping == null) continue;
                var parentKey = mapping.ParentFieldName
                    .DosIsNullOrWhiteSpace(mapping.FatherFieldName)
                    .DosIsNullOrWhiteSpace(mapping.Parent)
                    .DosIsNullOrWhiteSpace(mapping.Father);
                var childKey = mapping.ChildFieldName.DosIsNullOrWhiteSpace(mapping.Child);
                var parentField = ImportFindFieldByNameOrLabel(parentFields, parentKey, mapping.ParentFieldLabel);
                var childField = ImportFindFieldByNameOrLabel(childFields, childKey, mapping.ChildFieldLabel);
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
                var importParentMatchFieldName = relationConfig.TableChild?.ImportParentMatchFieldName;
                var importChildMatchFieldName = relationConfig.TableChild?.ImportChildMatchFieldName;
                var hasExplicitImportRelation = relationConfig.TableChild?.ImportRelations?.Any() == true
                    || !importParentMatchFieldName.DosIsNullOrWhiteSpace()
                    || !importChildMatchFieldName.DosIsNullOrWhiteSpace();
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
            var stepSign = $"Microi:{osClient}:ImportTableDataStep:{param.TableId}";

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
            if (files.Count == 0)
            {
                await diyCacheBase.SetAsync(startSign, "0");
                importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已失败！未找到文件！");
                await diyCacheBase.SetAsync(stepSign, importStepList);
                result = new DosResult(0, null, "The file was not found!");
                return;
            }

            importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：正在上传文件...");
            await diyCacheBase.SetAsync(stepSign, importStepList);

            var file = files[0];
            var realFileName = Ulid.NewUlid().ToString();
            var fileSuffix = Path.GetExtension(file.FileName);

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
                try
                {
                    var fileDataList = new NPOIHelper(fileByte).ExcelToListDynamic();
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

                    //取唯一字段
                    var uniqueFieldList = importFieldList.Where(d => d["Unique"].Val<int>() == 1).ToList();

                    var tIndex1 = 0;
                    var tUptIndex1 = 0;
                    var sqlTableName = MicroiEngine.ORM(dbInfo.DbType).GetTableName(diyTableModel.Name, osClientModel.OsClientModel["DbOracleTableSpace"].Val<string>());
                    using (var trans = dbSession.BeginTransaction())
                    {
                        var count2 = 0;

                        importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已导入【0】条数据...");
                        await diyCacheBase.SetAsync(stepSign, importStepList);

                        foreach (var item in fileDataList)
                        {
                            IDictionary<string, object> itemEObj = ImportGetRowDictionary((object)item);
                            if (itemEObj == null)
                            {
                                importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：调试：第【{tIndex1 + 1}】行不是可识别的Excel数据，已跳过。");
                                continue;
                            }

                            var itemEObjKeys = itemEObj.Select(d => d.Key).ToList();
                            bool? isHaveUnique = false;
                            var uniqueField = "";
                            var uniqueFieldLabel = "";
                            var uniqueFieldValue = "";
                            var uniqueFieldLabelAll = new List<UniqueFieldModel>();

                            foreach (var field in uniqueFieldList)
                            {
                                object valueObj;
                                if (ImportTryGetFieldValue(itemEObj, null, field, out valueObj))
                                {
                                    isHaveUnique = true;
                                    var value = ImportNormalizeValue(valueObj, field);
                                    var uniqueType = ImportGetUniqueType(field);
                                    if (string.Equals(uniqueType, "All", StringComparison.OrdinalIgnoreCase))
                                    {
                                        uniqueFieldLabelAll.Add(new UniqueFieldModel()
                                        {
                                            Name = field["Name"].Val<string>(),
                                            Label = field["Label"].Val<string>(),
                                            Value = value
                                        });
                                    }
                                    else
                                    {
                                        uniqueField = field["Name"].Val<string>();
                                        uniqueFieldLabel = field["Label"].Val<string>();
                                        uniqueFieldValue = value;
                                    }
                                }
                            }
                            if (isHaveUnique != true)
                            {
                                isHaveUnique = false;
                            }

                            if (!uniqueField.DosIsNullOrWhiteSpace() && uniqueFieldValue.DosIsNullOrWhiteSpace())
                            {
                                isHaveUnique = false;
                            }
                            if (uniqueFieldLabelAll.Any(d => d.Value.DosIsNullOrWhiteSpace()))
                            {
                                uniqueFieldLabelAll.Clear();
                                if (uniqueField.DosIsNullOrWhiteSpace())
                                {
                                    isHaveUnique = false;
                                }
                            }


                            //判断是否存在，如果存在才执行下面的这些，不存在的话还是走新增
                            var isHaveTheData = 0;
                            if (
                                (isHaveUnique.Value && !uniqueField.DosIsNullOrWhiteSpace())
                                || (uniqueFieldLabelAll.Any())
                            )
                            {
                                var haveDataSql = $@"SELECT COUNT(Id) FROM {sqlTableName}
                                                            WHERE IsDeleted = 0 ";

                                if (isHaveUnique.Value && !uniqueField.DosIsNullOrWhiteSpace())
                                {
                                    //{(dbInfo.DbType == "SqlServer" ? "TOP 1" : "")} 
                                    var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(uniqueField);
                                    var uniqueFieldModel = uniqueFieldList.FirstOrDefault(d => d["Name"].Val<string>() == uniqueField);
                                    haveDataSql += $" AND {sqlFieldName}={ImportBuildSqlValue(uniqueFieldValue, uniqueFieldModel)} ";
                                }

                                if (uniqueFieldLabelAll.Any())
                                {
                                    foreach (var uniqueFieldItem in uniqueFieldLabelAll)
                                    {
                                        var uniqueFieldModel = uniqueFieldList.FirstOrDefault(d => d["Name"].Val<string>() == uniqueFieldItem.Name);
                                        var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(uniqueFieldItem.Name);
                                        haveDataSql += $" AND {sqlFieldName}={ImportBuildSqlValue(uniqueFieldItem.Value, uniqueFieldModel)} ";
                                    }
                                }

                                //if (dbInfo.DbType == "MySql")
                                //{
                                //    haveDataSql += " LIMIT 1";
                                //}
                                sqlLog.Add(haveDataSql);
                                lastSqlLog = haveDataSql;
                                isHaveTheData = dbSession.FromSql(haveDataSql).ToScalar<int>();
                            }

                            //如果存在唯一字段，并且要导入的数据中确实有唯一字段， 并且已经存在这条数据了
                            if (uniqueFieldList.Any()
                                && isHaveUnique != null
                                && isHaveUnique.Value
                                && isHaveTheData > 0
                                )
                            {
                                var colsSetBuilder = new System.Text.StringBuilder();

                                foreach (var colModel in importFieldList)
                                {
                                    object valueObj;
                                    if (ImportTryGetFieldValue(itemEObj, guanlianField, colModel, out valueObj) && colModel["Name"].Val<string>() != uniqueField)
                                    {
                                        //只有超级管理员才有权限导入Tenant数据
                                        if (param._CurrentUser?["_IsAdmin"].Val<bool>() != true && colModel["Name"].Val<string>() == "TenantId")
                                        {
                                            continue;
                                        }
                                        var joinVal = ImportBuildSqlValue(valueObj, colModel);
                                        var sqlFieldName2 = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(colModel["Name"].Val<string>());
                                        colsSetBuilder.Append($"{sqlFieldName2}={joinVal},");
                                    }
                                }

                                var colsSet = colsSetBuilder.ToString().TrimEnd(',');
                                if (colsSet.DosIsNullOrWhiteSpace())
                                {
                                    tIndex1++;
                                    importStepList[importStepList.Count - 1] = $"{DateTime.Now.ToString(dateTimeFormat)}：已导入【{tIndex1}】条数据！";
                                    await diyCacheBase.SetAsync(stepSign, importStepList);
                                    continue;
                                }

                                //在客户数据库修改数据
                                var uptSql = $@"UPDATE {sqlTableName} SET {colsSet} WHERE IsDeleted = 0   ";

                                if (!uniqueField.DosIsNullOrWhiteSpace())
                                {
                                    var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(uniqueField);
                                    var uniqueFieldModel = uniqueFieldList.FirstOrDefault(d => d["Name"].Val<string>() == uniqueField);
                                    uptSql += $" AND {sqlFieldName} = {ImportBuildSqlValue(uniqueFieldValue, uniqueFieldModel)} ";
                                }
                                if (uniqueFieldLabelAll.Any())
                                {
                                    foreach (var uniqueFieldItem in uniqueFieldLabelAll)
                                    {
                                        var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(uniqueFieldItem.Name);

                                        var uniqueFieldModel = uniqueFieldList.FirstOrDefault(d => d["Name"].Val<string>() == uniqueFieldItem.Name);
                                        uptSql += $" AND {sqlFieldName} = {ImportBuildSqlValue(uniqueFieldItem.Value, uniqueFieldModel)} ";
                                    }
                                }
                                sqlLog.Add(uptSql);
                                lastSqlLog = uptSql;
                                count2 += trans.FromSql(uptSql).ExecuteNonQuery();
                                tUptIndex1++;
                            }
                            else
                            {
                                var keyValues = new Dictionary<string, object>();
                                var colNamesBuilder = new System.Text.StringBuilder();
                                var colValuesBuilder = new System.Text.StringBuilder();

                                foreach (var colModel in importFieldList)
                                {
                                    object value;
                                    if (ImportTryGetFieldValue(itemEObj, guanlianField, colModel, out value))
                                    {
                                        //只有超级管理员才有权限导入Tenant数据
                                        if (param._CurrentUser?["_IsAdmin"].Val<bool>() != true && colModel["Name"].Val<string>() == "TenantId")
                                        {
                                            continue;
                                        }
                                        colNamesBuilder.Append(MicroiEngine.ORM(dbInfo.DbType).GetFieldName(colModel["Name"].Val<string>())).Append(',');
                                        colValuesBuilder.Append(ImportBuildSqlValue(value, colModel)).Append(',');

                                        keyValues.Add(colModel["Name"].Val<string>(), value);
                                    }
                                }
                                if (param._CurrentUser != null
                                    && !keyValues.Any(d => d.Key == "TenantId") 
                                    && !param._CurrentUser["TenantId"].Val<string>().DosIsNullOrWhiteSpace())
                                {
                                    colNamesBuilder.Append(MicroiEngine.ORM(dbInfo.DbType).GetFieldName("TenantId")).Append(',');
                                    colNamesBuilder.Append(MicroiEngine.ORM(dbInfo.DbType).GetFieldName("TenantName")).Append(',');
                                    colValuesBuilder.Append($"'{ImportEscapeSql(param._CurrentUser?["TenantId"].Val<string>())}','{ImportEscapeSql(param._CurrentUser?["TenantName"].Val<string>())}',");
                                }
                                var colNames = colNamesBuilder.ToString();
                                var colValues = colValuesBuilder.ToString();
                                if (colNames.TrimEnd(',').DosIsNullOrWhiteSpace())
                                {
                                    throw new Exception($"第【{tIndex1 + 1}】行未匹配到可导入字段，请检查Excel表头。表头：{string.Join(",", itemEObjKeys)}");
                                }


                                //在客户数据库中插入数据
                                var insertSql = $@"INSERT INTO {sqlTableName} (Id,CreateTime,UpdateTime,UserId,IsDeleted,{colNames.TrimEnd(',')}) 
                                                    VALUES ('{Ulid.NewUlid()}',{MicroiEngine.ORM(dbInfo.DbType).GetDatetimeFieldValue(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss"))},NULL,'{ImportEscapeSql(param._CurrentUser?["Id"].Val<string>())}',0,{colValues.TrimEnd(',')})";
                                sqlLog.Add(insertSql);
                                lastSqlLog = insertSql;
                                count2 += trans.FromSql(insertSql).ExecuteNonQuery();
                            }
                            tIndex1++;
                            importStepList[importStepList.Count - 1] = $"{DateTime.Now.ToString(dateTimeFormat)}：已导入【{tIndex1}】条数据！";
                            await diyCacheBase.SetAsync(stepSign, importStepList);
                        }
                        trans.Commit();
                    }
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：成功导入【{tIndex1}】条数据！");
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：其中【{tUptIndex1}】条数据为修改！");
                    await diyCacheBase.SetAsync(stepSign, importStepList);

                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已全部成功结束！线程关闭。");
                    await diyCacheBase.SetAsync(stepSign, importStepList);
                    await diyCacheBase.SetAsync(startSign, "0");
                }
                catch (Exception ex)
                {
                    await diyCacheBase.SetAsync(startSign, "0");
                    Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】导入表[{diyTableModel?.Name}/{param.TableId}]失败：{ex.Message}");
                    Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】导入表[{diyTableModel?.Name}/{param.TableId}]lastSql：{lastSqlLog}");
                    Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】导入表[{diyTableModel?.Name}/{param.TableId}]StackTrace：{ex}");
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
            Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】导入表[{param.TableId}]初始化失败：{ex}");
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
