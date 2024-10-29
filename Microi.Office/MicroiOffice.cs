using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Xml.Linq;
using Dos.Common;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Minio;
using MySqlX.XDevAPI.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NPOI.SS.UserModel;
using NPOI.XWPF.UserModel;

namespace Microi.net
{

    public static class MicroiOfficeExtensions
    {
        public static IServiceCollection AddMicroiOffice(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiOffice, MicroiOffice>();
                Console.WriteLine("Microi：注入Office插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                Console.WriteLine("Microi：注入Office插件失败：" + ex.Message);
                return services;
            }
        }
    }
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
                return new DosResult<byte[]>(0, null, DiyMessage.Msg["ParamError"][param._Lang]);
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
    }
}

