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
using Minio;
using MySqlX.XDevAPI.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;
using NPOI.XWPF.UserModel;
using System.Net.Mail;
using System.Net;

namespace Microi.net
{

    
    /// <summary>
    /// 
    /// </summary>
    public class MicroiOffice : IMicroiOffice
    {
        private static FormEngine _formEngine = new FormEngine();
        private static ModuleEngine _moduleEngine = new ModuleEngine();
        /// <summary>
        /// 根据模板文件进行导出
        /// 传入 FormEngineKey、FormDataId、OsClient、_CurrentUser、TplKey 或者 TplFileStream 或者 TplId
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult<byte[]>> ExportWordByTpl(OfficeExportParam param)
        {

            if (
                param.FormDataId.DosIsNullOrWhiteSpace()
                || param.FormEngineKey.DosIsNullOrWhiteSpace()
                || param.OsClient.DosIsNullOrWhiteSpace()
                || (param.TplFileByte == null && param.TplKey.DosIsNullOrWhiteSpace() && param.TplId.DosIsNullOrWhiteSpace())
                )
            {
                return new DosResult<byte[]>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            try
            {
                //var clientModel = OsClient.GetClient(param.OsClient);

                #region 初始化数据
                //取diy_table
                var diyTableResult = await _formEngine.GetFormDataAsync<DiyTable>(new
                {
                    FormEngineKey = "Diy_Table",
                    _Where = new List<DiyWhere>() { new DiyWhere() {
                        Name = "Name",
                        Value = param.FormEngineKey,
                        Type = "="
                    } },
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                });
                if (diyTableResult.Code != 1)
                {
                    return new DosResult<byte[]>(0, null, diyTableResult.Msg);
                }
                var diyTableModel = diyTableResult.Data;
                //取该表的所有字段
                var allFieldListResult = await _formEngine.GetTableDataAsync<DiyField>(new
                {
                    FormEngineKey = "Diy_Field",
                    _Where = new List<DiyWhere>() { new DiyWhere() {
                        Name = "TableId",
                        Value = diyTableModel.Id,
                        Type = "="
                    } },
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                });
                if (allFieldListResult.Code != 1)
                {
                    return new DosResult<byte[]>(0, null, allFieldListResult.Msg);
                }
                var allFieldList = allFieldListResult.Data;

                //取数据
                var formDataResult = await _formEngine.GetFormDataAsync(new
                {
                    FormEngineKey = param.FormEngineKey,
                    Id = param.FormDataId,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                });
                if (formDataResult.Code != 1)
                {
                    return new DosResult<byte[]>(0, null, formDataResult.Msg);
                }
                #endregion

                JObject formData = JObject.FromObject(formDataResult.Data);

                #region 取模板文件
                if (!param.TplKey.DosIsNullOrWhiteSpace() || !param.TplId.DosIsNullOrWhiteSpace())
                {
                    var tplResult = await _formEngine.GetFormDataAsync(new
                    {
                        FormEngineKey = "microi_print_template", //"microi_export_template",
                        Id = param.FormDataId,
                        _Where = new List<DiyWhere>() {
                            new DiyWhere() {
                                Name = "Id", Value = param.TplId, Type = "="
                            },
                            new DiyWhere() {
                                Name = "TplKey", Value = param.TplKey, Type = "=", AndOr = "OR"
                            },
                        },
                        OsClient = param.OsClient,
                        _CurrentUser = param._CurrentUser,
                    });
                    if (tplResult.Code != 1)
                    {
                        return new DosResult<byte[]>(0, null, "获取模板信息失败：" + tplResult.Msg);
                    }
                    var tplFile = (string)tplResult.Data.TplFile;
                    //var tplByteResult = await DiyCommon.GetPrivateFileByte(new DiyUploadParam() {
                    //    OsClient = param.OsClient,
                    //    FilePathName = tplFile
                    //});
                    var tplByteResult = await new MicroiHDFS().GetPrivateFileByte(new DiyUploadParam()
                    {
                        OsClient = param.OsClient,
                        FilePathName = tplFile
                    });
                    if (tplByteResult.Code != 1)
                    {
                        return new DosResult<byte[]>(0, null, tplByteResult.Msg);
                    }
                    param.TplFileByte = tplByteResult.Data as byte[];
                }
                #endregion

                XWPFDocument doc = new XWPFDocument(StreamHelper.BytesToStream(param.TplFileByte));

                #region 替换主表
                foreach (var item in doc.Paragraphs)
                {
                    ReplaceKey(item, formData);
                }
                #endregion

                #region 替换子表
                var allChildTableFields = allFieldList.Where(d => d.Component == "TableChild").ToList();
                var tables = doc.Tables;
                foreach (var table in tables)
                {
                    if (table.Rows.Count >= 2
                        && table.Rows[0].GetTableCells().Count > 0
                        && table.Rows[0].GetTableCells()[0].Paragraphs.Count > 0)
                    {
                        var firstCellText = table.Rows[0].GetTableCells()[0].Paragraphs[0].ParagraphText;
                        var firstTableChildField = allChildTableFields.FirstOrDefault(d => firstCellText.Contains("$" + d.Name + "$"));
                        if (firstTableChildField == null)
                        {
                            continue;
                        }

                        //获取子表字段绑定的表
                        var fieldConfig = JsonConvert.DeserializeObject<DiyFieldConfig>(firstTableChildField.Config);
                        var tableChildDiyTableModelResult = await _formEngine.GetFormDataAsync<DiyTable>(new {
                            FormEngineKey  = "Diy_Table",
                            Id = fieldConfig.TableChildTableId,
                            OsClient = param.OsClient,
                            _CurrentUser = param._CurrentUser,
                        });
                        if (tableChildDiyTableModelResult.Code != 1)
                        {
                            return new DosResult<byte[]>(0, null, tableChildDiyTableModelResult.Msg);
                        }
                        var tableChildDiyTableModel = tableChildDiyTableModelResult.Data;
                        //取该子表的所有数据
                        var allTableChildDataResult = await _formEngine.GetTableDataAsync(new {
                            FormEngineKey = tableChildDiyTableModel.Name,
                            _SysMenuId = fieldConfig.TableChildSysMenuId,
                            _Where = new List<DiyWhere>() { new DiyWhere() {
                                    Name = fieldConfig.TableChildFkFieldName,
                                    Value = formData[fieldConfig.TableChild.PrimaryTableFieldName]?.Value<string>(),
                                    Type = "="
                                } },
                            OsClient = param.OsClient,
                            _CurrentUser = param._CurrentUser,
                        });
                        if (allTableChildDataResult.Code != 1)
                        {
                            return new DosResult<byte[]>(0, null, allTableChildDataResult.Msg);
                        }
                        var allTableChildData = allTableChildDataResult.Data;
                        if (allTableChildData.Count > 0)
                        {
                            //先根据子表数据，将子表行补齐
                            if (allTableChildData.Count > 1)
                            {
                                for (int i = 0; i < allTableChildData.Count - 1; i++)
                                {
                                    var newRow = table.GetRow(1);
                                    var newCTRow = table.GetRow(1).GetCTRow().Copy();
                                    var newEmptyRow = new XWPFTableRow(newCTRow, table);
                                    //for (int j = 0; j < newEmptyRow.GetTableCells().Count; j++)
                                    //{
                                    //    newEmptyRow.GetCell(j).SetText(newRow.GetCell(j).GetText());
                                    //}
                                    table.AddRow(newEmptyRow, 1);

                                    #region 一些历史尝试
                                    //table.InsertNewTableRow(0);//文件打不开
                                    //table.Rows.Add(newRow);//没有效果，仍然是一行
                                    //table.AddRow(newRow, 1);//修改第二行的数据，会导致其它数据跟着修改
                                    //var ctrow = table.GetRow(1).GetCTRow();   CTRow也会引用修改

                                    //var newRow2 = table.GetRow(1).GetCTRow();//完全不行
                                    //table.AddRow(new XWPFTableRow(newRow2, table));//完全不行

                                    //行不通
                                    //var newEmptyRow = table.CreateRow();
                                    //foreach (var cell in newRow.GetTableCells())
                                    //{
                                    //    var newEmptyCell = newEmptyRow.CreateCell();
                                    //    foreach (var para in cell.Paragraphs)
                                    //    {
                                    //        newEmptyCell.AddParagraph(para);
                                    //    }
                                    //}

                                    //行不通
                                    //var newEmptyRow = table.CreateRow();
                                    //for (int j = 0; j < newRow.GetTableCells().Count; j++)
                                    //{
                                    //    newEmptyRow.GetTableICells()[j] = newRow.GetTableCells()[j];
                                    //}
                                    #endregion

                                }
                            }

                            var tempCellField = new List<string>();
                            for (int rowIndex = 0; rowIndex < table.Rows.Count; rowIndex++)
                            {
                                var row = table.Rows[rowIndex];
                                //如果是第一行，只需要将子表字段名替换为空
                                if (rowIndex == 0)
                                {
                                    JObject rowData = new JObject();
                                    rowData.Add(firstTableChildField.Name, "");
                                    for (int cellIndex = 0; cellIndex < row.GetTableCells().Count; cellIndex++)
                                    {
                                        var cell = row.GetTableCells()[cellIndex];
                                        for (int paraIndex = 0; paraIndex < cell.Paragraphs.Count; paraIndex++)
                                        {
                                            var para = cell.Paragraphs[paraIndex];
                                            ReplaceKey(para, rowData);
                                        }
                                    }
                                }
                                //如果是第二行以及之后补齐的行
                                else if (rowIndex == 1)
                                {
                                    if (allTableChildData.Count >= rowIndex)
                                    {
                                        //记录每列的字段，以便创建新行要用到的取值
                                        JObject rowData = JObject.FromObject(allTableChildData[rowIndex - 1]);
                                        rowData.Add("_RowIndex", rowIndex);
                                        for (int cellIndex = 0; cellIndex < row.GetTableCells().Count; cellIndex++)
                                        {
                                            var cell = row.GetTableCells()[cellIndex];
                                            for (int paraIndex = 0; paraIndex < cell.Paragraphs.Count; paraIndex++)
                                            {
                                                var para = cell.Paragraphs[paraIndex];
                                                ReplaceKey(para, rowData);
                                            }
                                        }
                                    }
                                }
                                else
                                {
                                    if (allTableChildData.Count >= rowIndex)
                                    {
                                        //记录每列的字段，以便创建新行要用到的取值
                                        JObject rowData = JObject.FromObject(allTableChildData[rowIndex - 1]);
                                        rowData.Add("_RowIndex", rowIndex);
                                        for (int cellIndex = 0; cellIndex < row.GetTableCells().Count; cellIndex++)
                                        {
                                            var cell = row.GetTableCells()[cellIndex];
                                            for (int paraIndex = 0; paraIndex < cell.Paragraphs.Count; paraIndex++)
                                            {
                                                var para = cell.Paragraphs[paraIndex];
                                                ReplaceKey(para, rowData);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                #endregion

                using (Stream ms = new MemoryStream())
                {
                    doc.Write(ms);
                    return new DosResult<byte[]>(1, StreamHelper.StreamToBytes(ms));
                }
            }
            catch (Exception ex)
            {
                return new DosResult<byte[]>(0, null, ex.Message);
            }
        }
        private void ReplaceKey(XWPFParagraph para, JObject formData)
        {
            var oldText = para.ParagraphText;
            if (oldText.DosIsNullOrWhiteSpace())
            {
                return;
            }
            var newText = para.ParagraphText;
            foreach (var item in formData)
            {
                newText = newText.Replace($"${item.Key}$", item.Value?.Value<string>());
            }
            try
            {
                para.ReplaceText(oldText, newText);
            }
            catch (Exception ex)
            {
                Console.WriteLine("未处理的异常：" + ex.Message);
            }
            //string text = para.ParagraphText;
            //var runs = para.Runs;
            ////string styleid = para.Style;
            //for (int i = 0; i < runs.Count; i++)
            //{
            //    var run = runs[i];
            //    text = run.ToString();
            //    foreach (var item in formData)
            //    {
            //        //if (text.Contains($"${item.Key}$"))
            //        {
            //            text = text.Replace($"${item.Key}$", item.Value?.Value<string>());
            //        }
            //    }
            //    runs[i].SetText(text, 0);
            //}
        }
    
        /// <summary>
        /// 改用dynamic和Jobject
        /// 必传OsClient、TableId
        /// 可选_SysMenuId、_Keyword、_OrderBy、_OrderByType、_Search、_SearchCheckbox、_SearchDateTime、_SearchNumber
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<byte[]>> ExportExcel(DiyTableRowParam param)
        {
            SysMenu sysMenuModel = null;
            #region Check
            // if (param.TableId.DosIsNullOrWhiteSpace())
            // {
            //     return new DosResult<byte[]>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            // }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<byte[]>(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            #endregion
            List<dynamic> result = null;
            try
            {
                if(param.ExcelData != null)
                {
                    result = param.ExcelData;
                }
                else
                {
                    var tmpResult = await _formEngine.GetTableDataAsync(param);
                    if (tmpResult.Code != 1)
                    {
                        return new DosResult<byte[]>(0, null, tmpResult.Msg);
                    }
                    result = tmpResult.Data;
                }
                var fieldList = new List<DiyField>();
                if(param.ExcelHeader == null)
                {
                    //这里要考虑到SysMenuId配置的关联表，所以GetDiyField修改为GetDiyFieldByDiyTables
                    var fieldListResult = await new DiyFieldLogic().GetDiyFieldByDiyTables(new DiyFieldParam()
                    {
                        OsClient = param.OsClient,
                        //TableId = param.TableId,
                        TableIds = new List<string>() { param.TableId },
                        _SysMenuId = param._SysMenuId,
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
                if (param._SysMenuId != null)
                {
                    var sysMenuModelResult = await _formEngine.GetFormDataAsync<SysMenu>(new
                    {
                        FormEngineKey = "Sys_Menu",
                        Id = param._SysMenuId,
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
                                selectFields = JsonConvert.DeserializeObject<List<SearchFieldIdsModel>>(sysMenuModel.SelectFields);
                                if (selectFields.Any() && !sysMenuModel.NotShowFields.DosIsNullOrWhiteSpace())
                                {
                                    var notShowFields = JsonConvert.DeserializeObject<List<string>>(sysMenuModel.NotShowFields);
                                    notShowFields = notShowFields ?? new List<string>();
                                    foreach (var fieldId in notShowFields)
                                    {
                                        selectFields.RemoveAll(d => d.Id == fieldId);
                                    }
                                    fieldList = fieldList.Where(d => selectFields.Select(o => o.Id).Contains(d.Id)).ToList();
                                }
                            }
                            catch (Exception ex)
                            {

                            }
                        }
                    }
                }
                var sysConfig = (await _formEngine.GetSysConfig(param.OsClient)).Data;
                //-----END
                #region 开始导出
                IWorkbook workbook = new XSSFWorkbook();
                ISheet sheet = workbook.CreateSheet("Sheet1");
                sheet.SetColumnWidth(0, 20 * 256);
                var row = sheet.CreateRow(0);
                //先计算所有图片
                var rowIndexIndex = 0;
                //用来记录哪些字段需要额外生成列
                var dicFieldImgs = new Dictionary<string, int>();
                foreach (var item in result)
                {
                    var colIndexInit = 0;
                    JObject itemValue = JObject.FromObject(item);
                    foreach (var field in fieldList)
                    {
                        var fieldModel = fieldList.FirstOrDefault(d => d.Name.ToLower() == field.Name.ToLower());
                        if (fieldModel != null && !fieldModel.Config.DosIsNullOrWhiteSpace())
                        {
                            //如果是图片 --2024-10-09 by Anderson
                            if (fieldModel.Component == "ImgUpload")
                            {
                                //如果是多图
                                var configObj = JObject.Parse(fieldModel.Config);
                                var configs = configObj.Properties();
                                var selectLabelObj = configs.FirstOrDefault(d => d.Name == "ImgUpload");
                                if(selectLabelObj != null){
                                    var multiple = selectLabelObj?.Value["Multiple"]?.ToString();
                                    if(multiple == "1" || multiple == "True")
                                    {
                                        //获取图片数量
                                        var imgCount = 0;
                                        try
                                        {
                                            imgCount = JArray.Parse(itemValue[fieldModel.Name].Value<string>()).Count;
                                        }
                                        catch (System.Exception)
                                        {
                                            imgCount = 0;
                                        }
                                        if(imgCount > 0){
                                            //判断是不是最多的
                                            if(!dicFieldImgs.ContainsKey(fieldModel.Name))
                                            {
                                                dicFieldImgs.Add(fieldModel.Name, imgCount);
                                            }
                                            else
                                            {
                                                if(dicFieldImgs[fieldModel.Name]  < imgCount)
                                                {
                                                    dicFieldImgs[fieldModel.Name] = imgCount;
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
                    if (dicFieldImgs.ContainsKey(field.Name))
                    {
                        for (int j = 0; j < dicFieldImgs[field.Name]; j++)
                        {
                            row.CreateCell(index, CellType.String).SetCellValue(field.Label);
                            index++;
                        }
                        //开始合并列
                        if(index - dicFieldImgs[field.Name] > index - 1){
                            // 创建单元格范围地址
                            CellRangeAddress cellRangeAddress = new CellRangeAddress(0, 0, index - dicFieldImgs[field.Name], index - 1); // 合并第 0 行到第 1 行，第 0 列到第 2 列
                            // 添加合并区域
                            int mergedRegionIndex = sheet.AddMergedRegion(cellRangeAddress);
                        }
                        
                    }
                    else{
                        row.CreateCell(index, CellType.String).SetCellValue(field.Label);
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
                            // var value = itemValue[field.Name].Value<string>();
                            dynamic value = null;

                            var cellType = CellType.String;
                            if(
                                field.Type?.ToLower()?.Contains("int") == true
                                || field.Type?.ToLower()?.Contains("decimal") == true
                                || itemValue[field.Name].Type == JTokenType.Float
                                || itemValue[field.Name].Type == JTokenType.Integer
                            ){
                                cellType = CellType.Numeric;
                                value = itemValue[field.Name].Value<double?>();
                            }else{
                                
                                value = itemValue[field.Name].Value<string>();
                            }

                            

                            var fieldModel = fieldList.FirstOrDefault(d => d.Name.ToLower() == field.Name.ToLower());
                            if (fieldModel != null && !fieldModel.Config.DosIsNullOrWhiteSpace())
                            {
                                //如果是图片 --2024-10-09 by Anderson
                                if (fieldModel.Component == "ImgUpload")
                                {
                                    //获取图片地址、判断私有还是公有、判断MinIO/阿里云等
                                    var configObj = JObject.Parse(fieldModel.Config);
                                    var configs = configObj.Properties();
                                    var selectLabelObj = configs.FirstOrDefault(d => d.Name == "ImgUpload");
                                    if(selectLabelObj != null)
                                    {
                                        
                                        //如果是多图
                                        var multiple = selectLabelObj?.Value["Multiple"]?.ToString();
                                        var limit = selectLabelObj?.Value["Limit"]?.ToString();
                                        if(multiple == "1" || multiple == "True")
                                        {
                                            var imgsList = new JArray();
                                            try
                                            {
                                                imgsList = JArray.Parse(itemValue[fieldModel.Name].Value<string>());
                                            }
                                            catch (System.Exception)
                                            {}
                                            var imgsCount = dicFieldImgs[fieldModel.Name];
                                            var tempIndex2 = 0;
                                            for (var n = 0; n < imgsCount; n++)
                                            {
                                                //如果图片不够，空值占位
                                                if(imgsList.Count < n + 1){
                                                    sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                    var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                    // cell.SetCellValue(value);
                                                    if(n + 1 != imgsCount){
                                                        fieldIndex++;
                                                    }
                                                    continue;
                                                }
                                                var img = imgsList[n];
                                                //如果是私有
                                                if(limit == "1" || limit == "True"){
                                                    sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                    var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                    cell.SetCellValue(value);
                                                }
                                                else//如果是公有
                                                {
                                                    //后期通过HDFS插件来走内网取文件流
                                                    byte[] bytes = await DiyHttp.GetByte((string)sysConfig.FileServer + img["Path"]);
                                                    if(bytes == null){
                                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                        // 创建单元格样式
                                                        ICellStyle cellStyle = workbook.CreateCellStyle();
                                                        cellStyle.WrapText = true; // 设置文本换行
                                                        cell.CellStyle = cellStyle;
                                                        cell.SetCellValue(value);
                                                    }
                                                    else{
                                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);//, CellType.Formula  .SetCellValue(value);
                                                        hasImg = true;
                                                        int pictureIdx = workbook.AddPicture(bytes, NPOI.SS.UserModel.PictureType.PNG);
                                                        IDrawing drawing = sheet.CreateDrawingPatriarch();
                                                        int row1 = i + 1; // 图片左上角所在行
                                                        int col1 = fieldIndex; // 图片左上角所在列
                                                        int row2 = i + 2; // 图片右下角所在行
                                                        int col2 = fieldIndex + 1; // 图片右下角所在列
                                                        IClientAnchor anchor = new XSSFClientAnchor(0, 0, 0, 0, (short)col1, row1, (short)col2, row2);
                                                        IPicture pict = drawing.CreatePicture(anchor, pictureIdx);
                                                    }
                                                    
                                                    
                                                }
                                                if(tempIndex2 + 1 != imgsCount){
                                                    fieldIndex++;
                                                }
                                                tempIndex2++;
                                            }
                                        }
                                        else
                                        {
                                            //如果是单图
                                            var imgPath = itemValue[field.Name].Value<string>();
                                            if(imgPath.DosIsNullOrWhiteSpace()){
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
                                                if(limit == "1" || limit == "True"){

                                                }else{//如果是公有
                                                    //后期通过HDFS插件来走内网取文件流
                                                    byte[] bytes = await DiyHttp.GetByte((string)sysConfig.FileServer + imgPath);
                                                    if(bytes == null){
                                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);
                                                        // 创建单元格样式
                                                        ICellStyle cellStyle = workbook.CreateCellStyle();
                                                        cellStyle.WrapText = true; // 设置文本换行
                                                        cell.CellStyle = cellStyle;
                                                        cell.SetCellValue(value);
                                                    }else{
                                                        sheet.SetColumnWidth(fieldIndex, 20 * 256);
                                                        var cell = tRow.CreateCell(fieldIndex, CellType.String);//, CellType.Formula  .SetCellValue(value);
                                                        hasImg = true;
                                                        int pictureIdx = workbook.AddPicture(bytes, NPOI.SS.UserModel.PictureType.PNG);
                                                        IDrawing drawing = sheet.CreateDrawingPatriarch();
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
                                        var configObj = JObject.Parse(fieldModel.Config);
                                        var configs = configObj.Properties();
                                        var selectLabelObj = configs.FirstOrDefault(d => d.Name == "SelectLabel");
                                        if (selectLabelObj != null)
                                        {
                                            var val = selectLabelObj.Value;
                                            if (val.Type != JTokenType.Null && !val.ToString().DosIsNullOrWhiteSpace())
                                            {
                                                var valueObj = JObject.Parse(itemValue[field.Name].Value<string>());
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
                    if(param.ExcelHeader == null)
                    {
                        foreach (var field in CommonModel.DefaultExportFields)
                        {
                            sheet.SetColumnWidth(fieldIndex, 20 * 256);
                            var value = itemValue[field.Name].Value<string>();
                            tRow.CreateCell(fieldIndex, CellType.String).SetCellValue(value);
                            fieldIndex++;
                        }
                    }
                    if(!hasImg){
                        tRow.Height = 1 * 256;
                    }
                    i++;
                }
                //转为字节数组  
                MemoryStream stream = new MemoryStream();
                workbook.Write(stream);
                var buf = stream.ToArray();
                return new DosResult<byte[]>(1, buf);
                #endregion
            }
            catch (Exception ex)
            {
                return new DosResult<byte[]>(0, null, ex.Message);
            }
        }
        /// <summary>
        /// 2023-11 第二版导入功能
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_httpContext"></param>
        /// <returns></returns>
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
            var lockResult = await DiyLock.AsyncActionLock($"Microi:{param.OsClient}:ImportTableData:{param.TableId}", "", TimeSpan.FromSeconds(10), async () =>
            {
                var osClient = param.OsClient;
                var startSign = $"Microi:{param.OsClient}:ImportTableDataStart:{param.TableId}";
                var stepSign = $"Microi:{param.OsClient}:ImportTableDataStep:{param.TableId}";
                var DiyCacheBase = new MicroiCacheRedis(osClient);
                var importStepList = new List<string>();
                try
                {
                    var isStartStep = await DiyCacheBase.GetAsync(startSign) == "1";
                    if (isStartStep)
                    {
                        result = new DosResult(0, null, "注意：有数据正在导入！请导入结束后再操作。若进度异常，请联系系统管理员！");
                        return;
                    }
                    await DiyCacheBase.SetAsync(startSign, "1");
                    if (files.Count == 0)
                    {
                        await DiyCacheBase.SetAsync(startSign, "0");

                        importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：已失败！未找到文件！");
                        await DiyCacheBase.SetAsync(stepSign, importStepList);

                        result = new DosResult(0, null, "The file was not found!");
                        return;
                    }

                    importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：正在上传文件...");
                    await DiyCacheBase.SetAsync(stepSign, importStepList);

                    var file = files[0];
                    var realFileName = Guid.NewGuid();
                    var fileSuffix = Path.GetExtension(file.FileName);


                    importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：正在读取文件数据...");
                    await DiyCacheBase.SetAsync(stepSign, importStepList);

                    #region 拼接字段名
                    //获取所有需要插入的列名
                    var fieldListResult = await new DiyFieldLogic().GetDiyField(new DiyFieldParam()
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
                    var dbInfo = DiyCommon.GetDbInfo(osClientModel.DbType);
                    //查询出DiyTableModel
                    //var diyTableModel = DiyTableRepository.First(d => d.Id == param.TableId);
                    var diyTableModel = dbSession.From<DiyTable>().Select(CommonModel._diyTableFields).Where(d => d.Id == param.TableId).First();
                    if (diyTableModel == null)
                    {
                        await DiyCacheBase.SetAsync(startSign, "0");
                        result = new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "NoExistData", param._Lang) + " DiyTable-Id：" + param.TableId);
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
                        var sqlLog =  new List<string>();
                        var lastSqlLog = "";
                        try
                        {
                            //var allStu = new NPOIHelper(fileStream).ExcelToListDynamic();
                            //var allStu = new NPOIHelper(file.OpenReadStream()).ExcelToListDynamic();
                            var fileDataList = new NPOIHelper(fileByte).ExcelToListDynamic();
                            importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：已读取【" + fileDataList.Count + "】条数据！");
                            importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：正在开启新线程进行导入...");
                            await DiyCacheBase.SetAsync(stepSign, importStepList);

                            //var ossObject = ossClient.GetObject(new GetObjectRequest(bucketName, uploadPath.TrimStart('/')));

                            importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：正在获取基础数据...");
                            await DiyCacheBase.SetAsync(stepSign, importStepList);

                            // var count = 0;

                            importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：正在导入数据...");
                            await DiyCacheBase.SetAsync(stepSign, importStepList);


                            //取唯一字段
                            var uniqueFieldList = fieldList.Where(d => d.Unique == 1).ToList();

                            var tIndex1 = 0;
                            var tUptIndex1 = 0;
                            using (var trans = dbSession.BeginTransaction())
                            {
                                var count2 = 0;

                                importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：已导入【0】条数据...");
                                await DiyCacheBase.SetAsync(stepSign, importStepList);

                                bool? isHaveUnique = null;
                                var uniqueField = "";
                                var uniqueFieldLabel = "";
                                var uniqueFieldValue = "";

                                var uniqueFieldLabelAll = new List<UniqueFieldModel>();


                                //应该使用param._RowModel，但由于element upload组件暂不支持传入object，只能string，所以临时使用param._FieldId
                                JObject guanlianField = new JObject();
                                if (!param._FieldId.DosIsNullOrWhiteSpace())
                                {
                                    guanlianField = JObject.Parse(param._FieldId);
                                }

                                foreach (var item in fileDataList)
                                {
                                    var itemEObj = (item as ExpandoObject);

                                    var itemEObjKeys = itemEObj.Select(d => d.Key).ToList();
                                    //if (isHaveUnique == null)
                                    {
                                        foreach (var field in uniqueFieldList)
                                        {
                                            if (itemEObjKeys.Contains(field.Label))
                                            {
                                                isHaveUnique = true;

                                                //判断同时唯一、还是单独唯一
                                                var diyFieldConfig = JsonConvert.DeserializeObject<DiyFieldConfig>(field.Config);
                                                if (diyFieldConfig.Unique.Type == "All")
                                                {
                                                    var valueObj = itemEObj.First(d => d.Key == field.Label).Value;
                                                    //这里要判断日期类型
                                                    var value = (valueObj == null || valueObj.ToString().DosIsNullOrWhiteSpace())
                                                                    ? "" : valueObj.ToString();
                                                    uniqueFieldLabelAll.Add(new UniqueFieldModel()
                                                    {
                                                        Name = field.Name,
                                                        Label = field.Label,
                                                        Value = value
                                                    });
                                                }
                                                else
                                                {
                                                    uniqueField = field.Name;
                                                    uniqueFieldLabel = field.Label;
                                                    var valueObj = itemEObj.First(d => d.Key == field.Label).Value;
                                                    //这里要判断日期类型
                                                    var value = (valueObj == null || valueObj.ToString().DosIsNullOrWhiteSpace())
                                                                    ? "" : valueObj.ToString();
                                                    uniqueFieldValue = value;
                                                    //break;
                                                }
                                            }
                                        }
                                        if (isHaveUnique != true)
                                        {
                                            isHaveUnique = false;
                                        }
                                    }
                                    //else if (isHaveUnique == true)
                                    //{
                                    //    var valueObj = itemEObj.First(d => d.Key == uniqueFieldLabel).Value;
                                    //    var value = (valueObj == null || valueObj.ToString().DosIsNullOrWhiteSpace())
                                    //                    ? "" : valueObj.ToString();
                                    //    uniqueFieldValue = value;
                                    //}


                                    //判断是否存在，如果存在才执行下面的这些，不存在的话还是走新增
                                    var isHaveTheData = 0;
                                    if (
                                        (isHaveUnique.Value && !uniqueField.DosIsNullOrWhiteSpace())
                                        || (uniqueFieldLabelAll.Any())
                                    )
                                    {
                                        var sqlTableName = dbInfo.DbService.GetTableName(diyTableModel.Name, osClientModel.DbOracleTableSpace);

                                        var haveDataSql = $@"SELECT COUNT(Id) FROM {sqlTableName}
                                                            WHERE IsDeleted = 0 ";

                                        if (isHaveUnique.Value && !uniqueField.DosIsNullOrWhiteSpace())
                                        {
                                            //{(dbInfo.DbType == "SqlServer" ? "TOP 1" : "")} 
                                            var sqlFieldName = dbInfo.DbService.GetFieldName(uniqueField);
                                            haveDataSql += $" AND {sqlFieldName}='{uniqueFieldValue}' ";
                                        }

                                        if (uniqueFieldLabelAll.Any())
                                        {
                                            foreach (var uniqueFieldItem in uniqueFieldLabelAll)
                                            {
                                                haveDataSql += $" AND {uniqueFieldItem.Name}='{uniqueFieldItem.Value}' ";
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
                                        var colsSet = "";

                                        foreach (var colModel in fieldList)
                                        {
                                            if (itemEObj.Any(d => d.Key == colModel.Label) && colModel.Name != uniqueField)
                                            {
                                                var valueObj = itemEObj.First(d => d.Key == colModel.Label).Value;
                                                var value = (valueObj == null || valueObj.ToString().DosIsNullOrWhiteSpace())
                                                                ? "" : valueObj.ToString();

                                                var joinVal = "'" + value.ToString() + "'";

                                                if (colModel.Component == "Switch")
                                                {
                                                    joinVal = value.ToString();
                                                }
                                                else if (colModel.Component == "ImgUpload")
                                                {
                                                    joinVal = value.ToString();
                                                }

                                                var sqlFieldName2 = dbInfo.DbService.GetFieldName(colModel.Name);

                                                colsSet += $"{sqlFieldName2}={joinVal},";
                                            }
                                        }

                                        colsSet = colsSet.TrimEnd(',');

                                        //在客户数据库修改数据
                                        var sqlTableName = dbInfo.DbService.GetTableName(diyTableModel.Name, osClientModel.DbOracleTableSpace);

                                        var uptSql = $@"UPDATE {sqlTableName} SET {colsSet} WHERE IsDeleted = 0   ";

                                        if (!uniqueField.DosIsNullOrWhiteSpace())
                                        {
                                            var sqlFieldName = dbInfo.DbService.GetFieldName(uniqueField);
                                            uptSql += $" AND {sqlFieldName} = '{uniqueFieldValue}' ";
                                        }
                                        if (uniqueFieldLabelAll.Any())
                                        {
                                            foreach (var uniqueFieldItem in uniqueFieldLabelAll)
                                            {
                                                var sqlFieldName = dbInfo.DbService.GetFieldName(uniqueFieldItem.Name);

                                                uptSql += $" AND {sqlFieldName} = '{uniqueFieldItem.Value}' ";
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
                                        var colNames = "";
                                        var colValues = "";
                                        foreach (var colModel in fieldList)
                                        {
                                            if (itemEObj.Any(d => d.Key == colModel.Label) || guanlianField.ContainsKey(colModel.Name))
                                            {
                                                //只有超级管理员才有权限导入Tenant数据
                                                if (param._CurrentSysUser._IsAdmin != true && colModel.Name == "TenantId")
                                                {
                                                    continue;
                                                }
                                                colNames += colModel.Name + ",";
                                                object value = null;
                                                //应该使用param._RowModel，但由于element upload组件暂不支持传入object，只能string，所以临时使用param._FieldId
                                                //if (param._RowModel != null && param._RowModel.Any(d=>d.Key == colModel.Name))
                                                if (guanlianField.ContainsKey(colModel.Name))
                                                {
                                                    //value = param._RowModel[colModel.Name];
                                                    value = guanlianField[colModel.Name].ToString();
                                                }
                                                else
                                                {
                                                    value = itemEObj.FirstOrDefault(d => d.Key == colModel.Label).Value;
                                                }

                                                

                                                if (colModel.Component == "Switch")
                                                {
                                                    colValues += (value == null || value.ToString().DosIsNullOrWhiteSpace()) ? "0,"
                                                                : value.ToString() + ",";
                                                }
                                                else
                                                {
                                                    colValues += (value == null || value.ToString().DosIsNullOrWhiteSpace()) ? "'',"
                                                                : "'" + value.ToString() + "',";
                                                }

                                                keyValues.Add(colModel.Name, value);

                                            }
                                        }
                                        if (!keyValues.Any(d => d.Key == "TenantId") && !param._CurrentSysUser.TenantId.DosIsNullOrWhiteSpace())
                                        {
                                            colNames += "TenantId,TenantName";
                                            colValues += $"'{param._CurrentSysUser.TenantId}','{param._CurrentSysUser.TenantName}',";
                                        }


                                        //在客户数据库中插入数据
                                        var sqlTableName = dbInfo.DbService.GetTableName(diyTableModel.Name, osClientModel.DbOracleTableSpace);
                                        var insertSql = $@"INSERT INTO {sqlTableName} (Id,CreateTime,UpdateTime,UserId,IsDeleted,{colNames.TrimEnd(',')}) 
                                                    VALUES ('{Guid.NewGuid()}',{dbInfo.DbService.GetDatetimeFieldValue(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss"))},NULL,'{param._CurrentSysUser.Id}',0,{colValues.TrimEnd(',')})";
                                        sqlLog.Add(insertSql);
                                        lastSqlLog = insertSql;
                                        count2 += trans.FromSql(insertSql).ExecuteNonQuery();
                                    }
                                    tIndex1++;
                                    importStepList[importStepList.Count - 1] =
                                            DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss")
                                            + "：已导入【" + tIndex1 + "】条数据！";
                                    await DiyCacheBase.SetAsync(stepSign, importStepList);
                                }
                                trans.Commit();
                            }
                            importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：成功导入【" + tIndex1 + "】条数据！");
                            importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：其中【" + tUptIndex1 + "】条数据为修改！");
                            await DiyCacheBase.SetAsync(stepSign, importStepList);

                            importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：已全部成功结束！线程关闭。");
                            await DiyCacheBase.SetAsync(stepSign, importStepList);
                            await DiyCacheBase.SetAsync(startSign, "0");
                        }
                        catch (Exception ex)
                        {
                            await DiyCacheBase.SetAsync(startSign, "0");
                            importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：已失败！" + ex.Message);
                            importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：lastSql：" + lastSqlLog);
                            await DiyCacheBase.SetAsync(stepSign, importStepList);
                        }
                    });
                    result = new DosResult(1, null);
                }
                catch (Exception ex)
                {
                    await DiyCacheBase.SetAsync(startSign, "0");
                    importStepList.Add(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "：已失败！" + ex.Message);
                    await DiyCacheBase.SetAsync(stepSign, importStepList);
                    result = new DosResult(0, null, "已失败！请查看导入进度。" + ex.Message);
                }
            });
            if (lockResult.Code != 1)
            {
                return lockResult;
            }
            return result;
        }

        public async Task<DosResult> SendEmail(EmailParam param)
        {
            try
            {
                // 配置SMTP服务器
                string smtpServer = param.SmtpServer;// "smtp.example.com"; // 例如：smtp.gmail.com
                int port = param.SmtpPort;// 587; // Gmail通常使用587，其他服务可能不同
                bool enableSsl = param.EnableSSL; // 是否使用SSL
                string email = param.SystemEmail;// "your-email@example.com"; // 发件人邮箱地址
                string password = param.SystemEmailPwd;// "your-email-password"; // 发件人邮箱密码或应用专用密码（如Gmail的两步验证）
                // string recipient = "recipient@example.com"; // 收件人邮箱地址
        
                // 创建邮件消息对象
                MailMessage mail = new MailMessage();
                mail.From = new MailAddress(email);
                foreach (var item in param.Receivers)
                {
                    mail.To.Add(item);
                }
                mail.Subject = param.EmailSubject;// "测试邮件";
                mail.Body = param.EmailBody;//"你好！这是一封测试邮件。";
                mail.IsBodyHtml = true; // 如果邮件正文是HTML，设置为true
        
                // 创建SmtpClient对象并发送邮件
                using (SmtpClient smtpClient = new SmtpClient(smtpServer, port))
                {
                    smtpClient.Credentials = new NetworkCredential(email, password);
                    smtpClient.EnableSsl = enableSsl;
                    smtpClient.Send(mail);
                }
                return new DosResult(1, null, "");
            }
            catch (System.Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
    }
}

