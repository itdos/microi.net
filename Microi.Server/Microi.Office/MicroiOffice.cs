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
            var json = JsonConvert.SerializeObject(dynamicParam);
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
                var param = DynamicParam(dynamicParam);
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
            return ExportExcelAsync(param).Result;
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
            
            List<dynamic> result;
            SysMenu sysMenuModel = null;
            try
            {
                if(param.ExcelData != null)
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
                var fieldList = new List<DiyField>();
                if(param.ExcelHeader == null)
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
                    if(!param.ModuleEngineKey.DosIsNullOrWhiteSpace()){
                        _where.Add(new DiyWhere(){
                            Name = "ModuleEngineKey",
                            Value = param.ModuleEngineKey,
                            Type = "="
                        });
                    }
                    if(!param._SysMenuId.DosIsNullOrWhiteSpace()){
                        _where.Add(new DiyWhere(){
                            Name = "Id",
                            Value = param._SysMenuId,
                            Type = "="
                        });
                    }
                    var sysMenuModelResult = await MicroiEngine.FormEngine.GetFormDataAsync<SysMenu>(new
                    {
                        FormEngineKey = "Sys_Menu",
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
                                                    byte[] bytes = await MicroiEngine.Http.GetByte((string)sysConfig.FileServer + img["Path"]);
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
                                                    byte[] bytes = await MicroiEngine.Http.GetByte((string)sysConfig.FileServer + imgPath);
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
                                        var configObj = JObject.Parse(fieldModel.Config);
                                        var configs = configObj.Properties();
                                        var selectLabelObj = configs.FirstOrDefault(d => d.Name == "SelectLabel");
                                        var selectSaveFormatObj = configs.FirstOrDefault(d => d.Name == "SelectSaveFormat");
                                        var selectSaveFormatValue = "";
                                        if(selectSaveFormatObj != null){
                                            if(selectSaveFormatObj.Value.Type != JTokenType.Null && !selectSaveFormatObj.Value.ToString().DosIsNullOrWhiteSpace()){
                                                selectSaveFormatValue = selectSaveFormatObj.Value.ToString();
                                            }
                                        }
                                        if (selectLabelObj != null)
                                        {
                                            var val = selectLabelObj.Value;
                                            //SelectSaveFormat = Text
                                            if (val.Type != JTokenType.Null && !val.ToString().DosIsNullOrWhiteSpace())
                                            {
                                                var fieldName = fieldModel.Name;
                                                var valueStr = itemValue[fieldName].Value<string>();
                                                //2025-04-03：要处理数组而不仅仅是对象
                                                if(fieldModel.Component == "MultipleSelect"){
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
                                                }else if(selectSaveFormatValue != "Text"){
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
                                                }else{
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
                    var isStartStep = await diyCacheBase.GetAsync(startSign) == "1";
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
                    var dbInfo = DiyCommon.GetDbInfo(osClientModel.DbType);
                    //查询出DiyTableModel
                    //var diyTableModel = DiyTableRepository.First(d => d.Id == param.TableId);
                    var diyTableModel = dbSession.From<DiyTable>().Select(CommonModel._diyTableFields).Where(d => d.Id == param.TableId).First();
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


                            //取唯一字段
                            var uniqueFieldList = fieldList.Where(d => d.Unique == 1).ToList();

                            var tIndex1 = 0;
                            var tUptIndex1 = 0;
                            using (var trans = dbSession.BeginTransaction())
                            {
                                var count2 = 0;

                                importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已导入【0】条数据...");
                                await diyCacheBase.SetAsync(stepSign, importStepList);

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
                                        var sqlTableName = MicroiEngine.ORM(dbInfo.DbType).GetTableName(diyTableModel.Name, osClientModel.DbOracleTableSpace);

                                        var haveDataSql = $@"SELECT COUNT(Id) FROM {sqlTableName}
                                                            WHERE IsDeleted = 0 ";

                                        if (isHaveUnique.Value && !uniqueField.DosIsNullOrWhiteSpace())
                                        {
                                            //{(dbInfo.DbType == "SqlServer" ? "TOP 1" : "")} 
                                            var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(uniqueField);
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
                                        var colsSetBuilder = new System.Text.StringBuilder();

                                        foreach (var colModel in fieldList)
                                        {
                                            if (itemEObj.Any(d => d.Key == colModel.Label) && colModel.Name != uniqueField)
                                            {
                                                var valueObj = itemEObj.First(d => d.Key == colModel.Label).Value;
                                                var value = (valueObj == null || valueObj.ToString().DosIsNullOrWhiteSpace())
                                                                ? "" : valueObj.ToString();

                                                var joinVal = (colModel.Component == "Switch" || colModel.Component == "ImgUpload")
                                                    ? value.ToString()
                                                    : $"'{value}'";

                                                var sqlFieldName2 = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(colModel.Name);
                                                colsSetBuilder.Append($"{sqlFieldName2}={joinVal},");
                                            }
                                        }

                                        var colsSet = colsSetBuilder.ToString().TrimEnd(',');

                                        //在客户数据库修改数据
                                        var sqlTableName = MicroiEngine.ORM(dbInfo.DbType).GetTableName(diyTableModel.Name, osClientModel.DbOracleTableSpace);

                                        var uptSql = $@"UPDATE {sqlTableName} SET {colsSet} WHERE IsDeleted = 0   ";

                                        if (!uniqueField.DosIsNullOrWhiteSpace())
                                        {
                                            var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(uniqueField);
                                            uptSql += $" AND {sqlFieldName} = '{uniqueFieldValue}' ";
                                        }
                                        if (uniqueFieldLabelAll.Any())
                                        {
                                            foreach (var uniqueFieldItem in uniqueFieldLabelAll)
                                            {
                                                var sqlFieldName = MicroiEngine.ORM(dbInfo.DbType).GetFieldName(uniqueFieldItem.Name);

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
                                        var colNamesBuilder = new System.Text.StringBuilder();
                                        var colValuesBuilder = new System.Text.StringBuilder();
                                        
                                        foreach (var colModel in fieldList)
                                        {
                                            if (itemEObj.Any(d => d.Key == colModel.Label) || guanlianField.ContainsKey(colModel.Name))
                                            {
                                                //只有超级管理员才有权限导入Tenant数据
                                                if (param._CurrentSysUser._IsAdmin != true && colModel.Name == "TenantId")
                                                {
                                                    continue;
                                                }
                                                colNamesBuilder.Append(colModel.Name).Append(',');
                                                object value = guanlianField.ContainsKey(colModel.Name)
                                                    ? guanlianField[colModel.Name].ToString()
                                                    : itemEObj.FirstOrDefault(d => d.Key == colModel.Label).Value;

                                                if (colModel.Component == "Switch")
                                                {
                                                    colValuesBuilder.Append((value == null || value.ToString().DosIsNullOrWhiteSpace()) ? "0," : $"{value},");
                                                }
                                                else
                                                {
                                                    colValuesBuilder.Append((value == null || value.ToString().DosIsNullOrWhiteSpace()) ? "''," : $"'{value}',");
                                                }

                                                keyValues.Add(colModel.Name, value);
                                            }
                                        }
                                        if (!keyValues.Any(d => d.Key == "TenantId") && !param._CurrentSysUser.TenantId.DosIsNullOrWhiteSpace())
                                        {
                                            colNamesBuilder.Append("TenantId,TenantName");
                                            colValuesBuilder.Append($"'{param._CurrentSysUser.TenantId}','{param._CurrentSysUser.TenantName}',");
                                        }
                                        var colNames = colNamesBuilder.ToString();
                                        var colValues = colValuesBuilder.ToString();


                                        //在客户数据库中插入数据
                                        var sqlTableName = MicroiEngine.ORM(dbInfo.DbType).GetTableName(diyTableModel.Name, osClientModel.DbOracleTableSpace);
                                        var insertSql = $@"INSERT INTO {sqlTableName} (Id,CreateTime,UpdateTime,UserId,IsDeleted,{colNames.TrimEnd(',')}) 
                                                    VALUES ('{Ulid.NewUlid()}',{MicroiEngine.ORM(dbInfo.DbType).GetDatetimeFieldValue(DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss"))},NULL,'{param._CurrentSysUser.Id}',0,{colValues.TrimEnd(',')})";
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
                            importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已失败！{ex.Message}");
                            importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：lastSql：{lastSqlLog}");
                            await diyCacheBase.SetAsync(stepSign, importStepList);
                        }
                    });
                    result = new DosResult(1, null);
                }
                catch (Exception ex)
                {
                    await diyCacheBase.SetAsync(startSign, "0");
                    importStepList.Add($"{DateTime.Now.ToString(dateTimeFormat)}：已失败！{ex.Message}");
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
            return SendEmailAsync(param).Result;
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