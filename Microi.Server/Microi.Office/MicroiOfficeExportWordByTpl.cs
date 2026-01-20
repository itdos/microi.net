using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NPOI.XWPF.UserModel;
using System.Net.Http;
using System.Drawing;
using NPOI.SS.UserModel;
using SkiaSharp;

namespace Microi.net
{
    public partial class MicroiOffice : IMicroiOffice
    {
        public IFormEngine _formEngine;
        public MicroiOffice(IFormEngine formEngine)
        {
            _formEngine = formEngine;
        }
        /// <summary>
        /// 根据模板文件进行导出 - 完全兼容 .NET Standard 2.0 版本
        /// </summary>
        public async Task<DosResult<byte[]>> ExportWordByTpl(OfficeExportParam param)
        {
            if (param.FormDataId.DosIsNullOrWhiteSpace() || param.FormEngineKey.DosIsNullOrWhiteSpace() ||
                param.OsClient.DosIsNullOrWhiteSpace() || (param.TplFileByte == null && param.TplKey.DosIsNullOrWhiteSpace() && param.TplId.DosIsNullOrWhiteSpace()))
            {
                return new DosResult<byte[]>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            try
            {
                #region 初始化数据
                var diyTableResult = await _formEngine.GetFormDataAsync<DiyTable>("diy_table", new
                {
                    _Where = new List<DiyWhere>() { new DiyWhere() { Name = "Name", Value = param.FormEngineKey, Type = "=" } },
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                });
                if (diyTableResult.Code != 1) return new DosResult<byte[]>(0, null, diyTableResult.Msg);

                var allFieldListResult = await _formEngine.GetTableDataAsync<DiyField>("diy_field", new
                {
                    _Where = new List<DiyWhere>() { new DiyWhere() { Name = "TableId", Value = diyTableResult.Data.Id, Type = "=" } },
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                });
                if (allFieldListResult.Code != 1) return new DosResult<byte[]>(0, null, allFieldListResult.Msg);

                var sysConfig = (await _formEngine.GetSysConfig(param.OsClient)).Data;
                var formDataResult = await _formEngine.GetFormDataAsync(param.FormEngineKey, new
                {
                    Id = param.FormDataId,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                });
                if (formDataResult.Code != 1) return new DosResult<byte[]>(0, null, formDataResult.Msg);

                JObject formData = JObject.FromObject(formDataResult.Data);
                var allFieldList = allFieldListResult.Data;
                #endregion

                #region 获取模板文件
                if (!param.TplKey.DosIsNullOrWhiteSpace() || !param.TplId.DosIsNullOrWhiteSpace())
                {
                    var tplResult = await _formEngine.GetFormDataAsync("microi_print_template", new
                    {
                        Id = param.FormDataId,
                        _Where = new List<DiyWhere>() {
                            new DiyWhere() { Name = "Id", Value = param.TplId, Type = "=" },
                            new DiyWhere() { Name = "TplKey", Value = param.TplKey, Type = "=", AndOr = "OR" },
                        },
                        OsClient = param.OsClient,
                        _CurrentUser = param._CurrentUser,
                    });
                    if (tplResult.Code != 1) return new DosResult<byte[]>(0, null, "获取模板信息失败：" + tplResult.Msg);

                    var tplFile = (string)tplResult.Data.TplFile;
                    var tplByteResult = await MicroiEngine.HDFS.GetPrivateFileByte(new DiyUploadParam()
                    {
                        OsClient = param.OsClient,
                        FilePathName = tplFile
                    });
                    if (tplByteResult.Code != 1) return new DosResult<byte[]>(0, null, tplByteResult.Msg);
                    param.TplFileByte = tplByteResult.Data as byte[];
                }
                #endregion

                // 创建文档并处理内容
                XWPFDocument doc = new XWPFDocument(StreamHelper.BytesToStream(param.TplFileByte));

                // 替换主表内容
                foreach (var para in doc.Paragraphs)
                {
                    ReplaceKey(para, formData, sysConfig, allFieldList);
                }

                // 处理表格
                await ProcessTables(doc, allFieldList, formData, sysConfig, param);

                // 保存文档
                using (var ms = new MemoryStream())
                {
                    doc.Write(ms);
                    return new DosResult<byte[]>(1, StreamHelper.StreamToBytes(ms));
                }
            }
            catch (Exception ex)
            {
                return new DosResult<byte[]>(0, null, $"导出失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 处理所有表格
        /// </summary>
        private async Task ProcessTables(XWPFDocument doc, List<DiyField> allFields, JObject formData, dynamic sysConfig, OfficeExportParam param)
        {
            var childTableFields = allFields.Where(d => d.Component == "TableChild").ToList();

            foreach (var table in doc.Tables)
            {
                if (table.Rows.Count < 2) continue;

                var firstCell = table.Rows[0].GetTableCells()[0];
                if (firstCell.Paragraphs.Count == 0) continue;

                var firstCellText = firstCell.Paragraphs[0].ParagraphText;
                var tableChildField = childTableFields.FirstOrDefault(d => firstCellText.Contains("$" + d.Name + "$"));
                if (tableChildField == null) continue;

                await ProcessChildTableData(table, tableChildField, formData, sysConfig, param);
            }
        }

        /// <summary>
        /// 处理子表数据 - 重新设计版本
        /// </summary>
        private async Task ProcessChildTableData(XWPFTable table, DiyField tableChildField, JObject formData, dynamic sysConfig, OfficeExportParam param)
        {
            try
            {
                var fieldConfig = JsonHelper.Deserialize<DiyFieldConfig>(tableChildField.Config);

                var tableChildResult = await _formEngine.GetFormDataAsync<DiyTable>("diy_table", new
                {
                    Id = fieldConfig.TableChildTableId,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                });
                if (tableChildResult.Code != 1) return;

                var childDataResult = await _formEngine.GetTableDataAsync(tableChildResult.Data.Name, new
                {
                    _SysMenuId = fieldConfig.TableChildSysMenuId,
                    _Where = new List<DiyWhere>() {
                        new DiyWhere() {
                            Name = fieldConfig.TableChildFkFieldName,
                            Value = formData[fieldConfig.TableChild.PrimaryTableFieldName].Val<string>(),
                            Type = "="
                        }
                    },
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                });
                if (childDataResult.Code != 1) return;

                var childData = childDataResult.Data;
                if (childData.Count == 0) return;

                // 找到数据行起始位置（包含 $_RowIndex$ 的行）
                int dataStartRowIndex = FindDataStartRowIndex(table);
                if (dataStartRowIndex == -1)
                {
                    System.Diagnostics.Debug.WriteLine("未找到包含 $_RowIndex$ 的数据行");
                    return;
                }

                // 扩展表格行 - 只在数据起始行往下添加行
                ExpandTableRowsFromDataStart(table, dataStartRowIndex, childData.Count);

                // 处理表格所有行
                ProcessAllTableRows(table, dataStartRowIndex, tableChildField, childData, formData, sysConfig);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"处理子表数据失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 找到数据行起始位置（包含 $_RowIndex$ 的行）
        /// </summary>
        private int FindDataStartRowIndex(XWPFTable table)
        {
            for (int rowIndex = 0; rowIndex < table.Rows.Count; rowIndex++)
            {
                var row = table.Rows[rowIndex];
                foreach (var cell in row.GetTableCells())
                {
                    foreach (var para in cell.Paragraphs)
                    {
                        if (!string.IsNullOrEmpty(para.ParagraphText) && para.ParagraphText.Contains("$_RowIndex$"))
                        {
                            // System.Diagnostics.Debug.WriteLine($"找到数据起始行: {rowIndex}");
                            return rowIndex;
                        }
                    }
                }
            }
            return -1;
        }

        /// <summary>
        /// 扩展表格行 - 只在数据起始行往下添加行
        /// </summary>
        private void ExpandTableRowsFromDataStart(XWPFTable table, int dataStartRowIndex, int requiredDataRows)
        {
            // 当前已有数据行数：从数据起始行开始到表格末尾
            int currentDataRows = 1; // 模板中已经有一行数据行

            if (requiredDataRows > currentDataRows)
            {
                int rowsToAdd = requiredDataRows - currentDataRows;
                var templateRow = table.Rows[dataStartRowIndex];

                for (int i = 0; i < rowsToAdd; i++)
                {
                    try
                    {
                        // 复制模板行的 CTRow 来创建新行
                        var newCTRow = templateRow.GetCTRow().Copy();
                        var newRow = new XWPFTableRow(newCTRow, table);

                        // 在数据起始行后插入新行
                        table.AddRow(newRow, dataStartRowIndex + 1 + i);

                        // System.Diagnostics.Debug.WriteLine($"成功添加第 {i + 1} 行到位置 {dataStartRowIndex + 1 + i}");
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"添加行失败: {ex.Message}");
                        // 降级方案：创建简单新行并复制内容
                        try
                        {
                            var newRow = table.CreateRow();
                            CopyRowContent(templateRow, newRow);
                        }
                        catch (Exception fallbackEx)
                        {
                            System.Diagnostics.Debug.WriteLine($"降级方案也失败: {fallbackEx.Message}");
                        }
                    }
                }
            }
        }

        /// <summary>
        /// 处理表格所有行
        /// </summary>
        private void ProcessAllTableRows(XWPFTable table, int dataStartRowIndex, DiyField tableChildField, List<object> childData, JObject formData, dynamic sysConfig)
        {
            // 处理所有行
            for (int rowIndex = 0; rowIndex < table.Rows.Count; rowIndex++)
            {
                var row = table.Rows[rowIndex];

                if (rowIndex == 0)
                {
                    // 第一行：标题行，只替换子表字段名为空
                    JObject titleRowData = new JObject();
                    foreach (var item in formData)
                    {
                        titleRowData[item.Key] = item.Value;
                    }
                    titleRowData[tableChildField.Name] = "";

                    ProcessRowCells(row, titleRowData, sysConfig);
                }
                else if (rowIndex >= dataStartRowIndex && (rowIndex - dataStartRowIndex) < childData.Count)
                {
                    // 数据行
                    int dataIndex = rowIndex - dataStartRowIndex;
                    var rowData = JObject.FromObject(childData[dataIndex]);
                    rowData.Add("_RowIndex", dataIndex + 1); // 从1开始计数

                    ProcessRowCells(row, rowData, sysConfig);
                }
                else
                {
                    // 其他行（特殊行、结尾行等）- 只替换主表数据
                    JObject otherRowData = new JObject();
                    foreach (var item in formData)
                    {
                        otherRowData[item.Key] = item.Value;
                    }
                    otherRowData[tableChildField.Name] = "";

                    ProcessRowCells(row, otherRowData, sysConfig);
                }
            }
        }

        /// <summary>
        /// 处理行的所有单元格
        /// </summary>
        private void ProcessRowCells(XWPFTableRow row, JObject rowData, dynamic sysConfig)
        {
            foreach (var cell in row.GetTableCells())
            {
                foreach (var para in cell.Paragraphs)
                {
                    ReplaceKey(para, rowData, sysConfig);
                }
            }
        }

        /// <summary>
        /// 复制行内容 - 备用方案
        /// </summary>
        private void CopyRowContent(XWPFTableRow sourceRow, XWPFTableRow targetRow)
        {
            try
            {
                // 确保目标行有足够多的单元格
                while (targetRow.GetTableCells().Count < sourceRow.GetTableCells().Count)
                {
                    targetRow.AddNewTableCell();
                }

                // 复制每个单元格的内容
                for (int i = 0; i < sourceRow.GetTableCells().Count; i++)
                {
                    var sourceCell = sourceRow.GetCell(i);
                    var targetCell = targetRow.GetCell(i);

                    if (sourceCell != null && targetCell != null)
                    {
                        // 清除目标单元格的现有内容
                        while (targetCell.Paragraphs.Count > 0)
                        {
                            targetCell.RemoveParagraph(0);
                        }

                        // 复制源单元格的所有段落
                        foreach (var sourcePara in sourceCell.Paragraphs)
                        {
                            var targetPara = targetCell.AddParagraph();
                            targetPara.Alignment = sourcePara.Alignment;

                            foreach (var sourceRun in sourcePara.Runs)
                            {
                                var targetRun = targetPara.CreateRun();
                                targetRun.SetText(sourceRun.GetText(0));
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"复制行内容失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 替换关键字 - 修复版本
        /// </summary>
        private void ReplaceKey(XWPFParagraph para, JObject formData, dynamic sysConfig, List<DiyField> diyFields = null)
        {
            var oldText = para.ParagraphText;
            if (oldText.DosIsNullOrWhiteSpace()) return;

            var newText = para.ParagraphText;
            string imgKey = null;

            // 识别图片字段并准备文本替换
            foreach (var item in formData)
            {
                if (diyFields != null && diyFields.Any(d => d.Component == "ImgUpload" && d.Name == item.Key) &&
                    oldText.Contains($"${item.Key}$"))
                {
                    imgKey = item.Key;
                }
                else
                {
                    newText = newText.Replace($"${item.Key}$", item.Value?.Value<string>() ?? "");
                }
            }

            try
            {
                if (!string.IsNullOrEmpty(imgKey))
                {
                    string imageUrl = (string)sysConfig.FileServer + formData[imgKey].Val<string>();
                    if (!string.IsNullOrEmpty(imageUrl))
                    {
                        // 替换图片占位符
                        ReplaceImagePlaceholder(para, $"${imgKey}$", imageUrl);
                        return;
                    }
                }

                // 普通文本替换 - 使用修复后的方法
                if (oldText != newText)
                {
                    // 先尝试使用ReplaceText
                    para.ReplaceText(oldText, newText);

                    // 检查替换是否成功
                    if (para.ParagraphText == oldText)
                    {
                        // ReplaceText失败，使用可靠的重建方法
                        ReliableParagraphReplace(para, oldText, newText);
                    }
                }
            }
            catch (Exception ex)
            {
                // 降级处理：使用可靠的重建方法
                try
                {
                    ReliableParagraphReplace(para, oldText, newText);
                }
                catch
                {
                    // 最终降级方案
                    System.Diagnostics.Debug.WriteLine($"段落处理失败: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// 可靠的段落替换方法 - 修正版本
        /// </summary>
        private void ReliableParagraphReplace(XWPFParagraph para, string oldText, string newText)
        {
            try
            {
                // 只保存对齐方式，这是最常用的格式
                var alignment = para.Alignment;

                // 清除所有现有的Run
                while (para.Runs.Count > 0)
                {
                    para.RemoveRun(0);
                }

                // 创建新的Run并设置文本
                var newRun = para.CreateRun();
                newRun.SetText(newText, 0);

                // 恢复对齐方式
                para.Alignment = alignment;

                // System.Diagnostics.Debug.WriteLine($"可靠替换成功: '{oldText}' -> '{newText}'");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"可靠段落替换失败: {ex.Message}");

                // 降级方案：尝试逐Run替换
                try
                {
                    ReplaceTextByRuns(para, oldText, newText);
                }
                catch (Exception finalEx)
                {
                    System.Diagnostics.Debug.WriteLine($"所有替换方法都失败: {finalEx.Message}");
                }
            }
        }

        /// <summary>
        /// 通过逐Run替换文本 - 降级方案
        /// </summary>
        private void ReplaceTextByRuns(XWPFParagraph para, string oldText, string newText)
        {
            try
            {
                // 如果段落只有一个Run，直接替换
                if (para.Runs.Count == 1)
                {
                    var run = para.Runs[0];
                    run.SetText(newText, 0);
                    return;
                }

                // 如果有多个Run，清除所有并创建一个新的
                while (para.Runs.Count > 0)
                {
                    para.RemoveRun(0);
                }

                var newRun = para.CreateRun();
                newRun.SetText(newText, 0);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"逐Run替换失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 替换图片占位符
        /// </summary>
        private void ReplaceImagePlaceholder(XWPFParagraph para, string placeholder, string imageUrl)
        {
            try
            {
                var runs = para.Runs;
                if (runs == null || runs.Count == 0)
                {
                    InsertImageToParagraph(para, imageUrl);
                    return;
                }

                // 查找包含占位符的run
                for (int i = 0; i < runs.Count; i++)
                {
                    var run = runs[i];
                    var runText = run.GetText(0);

                    if (!string.IsNullOrEmpty(runText) && runText.Contains(placeholder))
                    {
                        int placeholderIndex = runText.IndexOf(placeholder);

                        // 处理占位符前的文本
                        if (placeholderIndex > 0)
                        {
                            var beforeRun = para.InsertNewRun(i);
                            beforeRun.SetText(runText.Substring(0, placeholderIndex), 0);
                            i++;
                        }

                        // 移除包含占位符的run
                        para.RemoveRun(i);

                        // 插入图片
                        var imageRun = para.InsertNewRun(i);
                        if (!TryInsertImage(imageRun, imageUrl))
                        {
                            imageRun.SetText("[图片]", 0);
                        }

                        // 处理占位符后的文本
                        if (placeholderIndex + placeholder.Length < runText.Length)
                        {
                            var afterRun = para.InsertNewRun(i + 1);
                            afterRun.SetText(runText.Substring(placeholderIndex + placeholder.Length), 0);
                        }
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                // 降级为文本替换
                para.ReplaceText(placeholder, "[图片]");
                System.Diagnostics.Debug.WriteLine($"图片替换失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 在段落中插入图片
        /// </summary>
        private void InsertImageToParagraph(XWPFParagraph para, string imageUrl)
        {
            try
            {
                var run = para.CreateRun();
                if (!TryInsertImage(run, imageUrl))
                {
                    run.SetText("[图片]", 0);
                }
            }
            catch
            {
                var run = para.CreateRun();
                run.SetText("[图片]", 0);
            }
        }

        /// <summary>
        /// 尝试插入图片
        /// </summary>
        private bool TryInsertImage(XWPFRun run, string imageUrl)
        {
            try
            {
                byte[] imageData = DownloadImage(imageUrl);
                if (imageData == null || imageData.Length == 0) return false;

                using (var stream = new MemoryStream(imageData))
                {
                    // 获取图片类型
                    int pictureType = GetPictureType(imageUrl);

                    // 计算图片尺寸
                    int widthEmu = 0;
                    int heightEmu = 0;
                    ReturnImageWidthHeight(imageData, widthEmu, out widthEmu, out heightEmu);
                    widthEmu = PixelsToEmu(widthEmu);
                    heightEmu = PixelsToEmu(heightEmu);
                    // 使用NPOI标准方法插入图片
                    run.AddPicture(stream, pictureType, "image", widthEmu, heightEmu);
                    return true;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"插入图片失败: {ex.Message}");
                return false;
            }
        }
        /// <summary>
        /// 将像素转换为EMU（English Metric Unit）
        /// </summary>
        /// <param name="pixels">像素值</param>
        /// <param name="dpi">DPI值，默认96</param>
        /// <returns>EMU值</returns>
        private int PixelsToEmu(int pixels, double dpi = 96.0)
        {
            // 转换公式：
            // 1 inch = 914400 EMU
            // 1 pixel = 1/96 inch (在96 DPI下)
            // 所以：1 pixel = 914400 / 96 = 9525 EMU
            return (int)(pixels * 914400.0 / dpi);
        }


        /// <summary>
        /// 下载图片
        /// </summary>
        private byte[] DownloadImage(string imageUrl)
        {
            try
            {
                using (var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) })
                {
                    return httpClient.GetByteArrayAsync(imageUrl).GetAwaiter().GetResult();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"下载图片失败: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 获取图片类型 - 修复不明确引用问题
        /// </summary>
        private int GetPictureType(string imageUrl)
        {
            if (string.IsNullOrEmpty(imageUrl))
                return (int)NPOI.XWPF.UserModel.PictureType.JPEG;

            string extension = System.IO.Path.GetExtension(imageUrl).ToLower();

            // 使用传统的 switch 语句替代 switch 表达式
            switch (extension)
            {
                case ".png":
                    return (int)NPOI.XWPF.UserModel.PictureType.PNG;
                case ".gif":
                    return (int)NPOI.XWPF.UserModel.PictureType.GIF;
                case ".bmp":
                    return (int)NPOI.XWPF.UserModel.PictureType.BMP;
                case ".jpeg":
                case ".jpg":
                    return (int)NPOI.XWPF.UserModel.PictureType.JPEG;
                default:
                    return (int)NPOI.XWPF.UserModel.PictureType.JPEG;
            }
        }

        /// <summary>
        /// 计算图片高度
        /// </summary>
        private void ReturnImageWidthHeight(byte[] imageData, int widthEmu, out int width, out int height)
        {
            try
            {
                using (var stream = new MemoryStream(imageData))
                {
                    // using (var image = System.Drawing.Image.FromStream(stream))
                    // {
                    //     double ratio = (double)image.Height / image.Width;
                    //     return (int)(widthEmu * ratio);
                    // }

                    // 获取图片原始尺寸
                    using (var skImage = SKImage.FromEncodedData(stream))
                    {
                        int originalWidth = skImage.Width;
                        int originalHeight = skImage.Height;
                        // double ratio = (double)skImage.Height / skImage.Width;
                        width = originalWidth;
                        height = originalHeight;
                    }
                }
            }
            catch (Exception ex)
            {
                // 默认4:3比例
                // return (int)(widthEmu * 0.75);
                width = widthEmu;
                height = (int)(widthEmu * 0.75);
            }
        }
    }
}