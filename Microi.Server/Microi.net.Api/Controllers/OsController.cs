using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NPOI.SS.Formula.Functions;
using System.Diagnostics;
using System.Text;

namespace Microi.net.Api
{
    /// <summary>
    /// DIY框架一些通用接口
    /// </summary>
    [EnableCors("any")]
    //[ServiceFilter(typeof(DiyFilter<dynamic>))]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class OsController : Controller
    {
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public JsonResult GetOsVersion()
        {
            return Json(new DosResult(1, "v3.10.24"));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        //[HttpGet, HttpPost]        //[AllowAnonymous]
        //public async Task<ActionResult> CreateQRCode()
        //{
        //    JObject param = new JObject();
        //    param.Add("ApiEngineKey", "");
        //    var result = await _apiEngine.RunAsync(param);
        //    return Json(result);
        //}

        /// <summary>
        /// 
        /// </summary>
        /// <param name="qrCodeContent"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public ActionResult CreateQRCode(string qrCodeContent)
        {
            if (qrCodeContent.DosIsNullOrWhiteSpace())
            {
                qrCodeContent = "测试内容";
            }
            var stream = Dos.Common.ImageHelper.CreateQRCode(qrCodeContent);

            using (BinaryReader binReader = new BinaryReader(stream))
            {
                byte[] bytes = binReader.ReadBytes(Convert.ToInt32(stream.Length));
                var base64Str = Convert.ToBase64String(bytes);
                return Content(base64Str);//data:image/png;base64,
            }
            //return Content(inputString);
            //return File(stream, "image/png");
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public JsonResult GetMicroiNetVersion()
        {
            var fv = FileVersionInfo.GetVersionInfo("Microi.net.dll");
            return Json(new DosResult(1, fv.FileVersion));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        // [HttpPost, HttpGet]
        // [AllowAnonymous]
        // public async Task<DosResult> DiyUpdate(string Version, string authorization)
        // {
        //     try
        //     {
        //         #region Check
        //         if (Version.DosIsNullOrWhiteSpace())
        //         {
        //             return new DosResult(0, null, "请传入版本号！如：v3.7.1");
        //         }

        //         var osClientName = "";
        //         SysUser? _currentSysUser = null;
        //         JObject _currentUser = new JObject();
        //         try
        //         {
        //             var sysUserCurrentToken = await DiyToken.GetCurrentToken<SysUser>();
        //             osClientName = sysUserCurrentToken.OsClient;
        //             _currentSysUser = sysUserCurrentToken.CurrentUser;

        //             var objUserCurrentToken = await DiyToken.GetCurrentToken<JObject>();
        //             _currentUser = objUserCurrentToken.CurrentUser;
        //         }
        //         catch (Exception ex)
        //         {

        //             osClientName = OsClient.OsClientName;
        //             if (!authorization.DosIsNullOrWhiteSpace())
        //             {
        //                 var tokenModel = await DiyToken.GetCurrentToken<SysUser>(authorization, osClientName);
        //                 if (tokenModel != null)
        //                 {
        //                     osClientName = tokenModel.OsClient;
        //                     _currentSysUser = tokenModel.CurrentUser;
        //                 }

        //                 var tokenObjModel = await DiyToken.GetCurrentToken<JObject>(authorization, osClientName);
        //                 if (tokenObjModel != null)
        //                 {
        //                     _currentUser = tokenObjModel.CurrentUser;
        //                 }
        //             }
        //         }
        //         #endregion

        //         #region 定义一些局部常用委托
        //         //新增字段
        //         var AddDiyField = async delegate (DiyFieldParam diyFieldParam)
        //         {
        //             try
        //             {
        //                 var fieldParam = new DiyFieldParam()
        //                 {
        //                     TableName = diyFieldParam.TableName,
        //                     Id = diyFieldParam.Id.DosIsNullOrWhiteSpace() ? Guid.NewGuid().ToString() : diyFieldParam.Id,
        //                     TableId = diyFieldParam.TableId,
        //                     Label = diyFieldParam.Label.DosIsNullOrWhiteSpace() ? diyFieldParam.Name : diyFieldParam.Label,
        //                     Name = diyFieldParam.Name,
        //                     NameConfirm = 1,
        //                     Type = diyFieldParam.Type ?? "varchar(50)",
        //                     Component = diyFieldParam.Component ?? "Text",
        //                     NotEmpty = diyFieldParam.NotEmpty,
        //                     Visible = diyFieldParam.Visible,
        //                     Readonly = diyFieldParam.Readonly,
        //                     UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",
        //                     Sort = diyFieldParam.Sort ?? 0,
        //                     Tab = diyFieldParam.Tab,
        //                     IsDeleted = 0,
        //                     Config = diyFieldParam.Config,
        //                     FormWidth = diyFieldParam.FormWidth,
        //                     TableWidth = diyFieldParam.TableWidth ?? 100,
        //                     Unique = diyFieldParam.Unique,
        //                     BindRole = "[]",
        //                     InTableEdit = 0,
        //                     IsLockField = 0,
        //                     Data = diyFieldParam.Data,
        //                     Description = diyFieldParam.Description,
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 };
        //                 //调用内置方法会更新缓存
        //                 var result = await MicroiEngine.FormEngine.AddDiyField(fieldParam);
        //                 if (result.Code != 1 && result.Msg.Contains("Duplicate entry"))
        //                 {
        //                     result = await MicroiEngine.FormEngine.UptDiyField(fieldParam);
        //                 }
        //                 return result;
        //             }
        //             catch (Exception ex)
        //             {
        //                 return new DosResult(0, null, ex.Message);
        //             }

        //         };
        //         #endregion

        //         var osClientModel = OsClient.GetClient(osClientName);
        //         var dbSession = osClientModel.Db;

        //         var resultMsg = "";
        //         if (Version == "v3.10.19")
        //         {
        //             #region WF_Node 表新增2个字段
        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "WF_Node",
        //                     Id = "cb35f773-cb87-4fd7-a6a9-865211f098ee",
        //                     Label = "允许移交",
        //                     Name = "AllowHandOver",
        //                     Type = "bit",
        //                     Component = "Switch",
        //                     Sort = 125
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【WF_Node】表【AllowHandOver】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【WF_Node】表【AllowHandOver】字段失败：" + ex.Message + "<br>";
        //             }

        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "WF_Node",
        //                     Id = "7752b736-e986-49e5-b2ea-7e8f014447c4",
        //                     Label = "隐藏移交选择人",
        //                     Name = "HideHandOverSelect",
        //                     Type = "bit",
        //                     Component = "Switch",
        //                     Description = "",
        //                     Sort = 130
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【WF_Node】表【HideHandOverSelect】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【WF_Node】表【HideHandOverSelect】字段失败：" + ex.Message + "<br>";
        //             }

        //             #endregion

        //             #region Sys_ApiEngine 表新增2个字段
        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "Sys_ApiEngine",
        //                     Id = "0d081fca-4def-4504-8c5a-e971eeb97af8",
        //                     Label = "自定义接口地址",
        //                     Name = "ApiAddress",
        //                     Type = "varchar(255)",
        //                     Component = "Text",
        //                     Description = ""
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【Sys_ApiEngine】表【ApiAddress】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【Sys_ApiEngine】表【ApiAddress】字段失败：" + ex.Message + "<br>";
        //             }

        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "Sys_ApiEngine",
        //                     Id = "f704a1fe-1740-482e-a9c3-6dc93fc9ba78",
        //                     Label = "允许匿名调用",
        //                     Name = "AllowAnonymous",
        //                     Type = "bit",
        //                     Component = "Switch",
        //                     Description = ""
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【Sys_ApiEngine】表【AllowAnonymous】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【Sys_ApiEngine】表【AllowAnonymous】字段失败：" + ex.Message + "<br>";
        //             }

        //             #endregion
        //         }
        //         else if (Version == "v3.9.15")
        //         {
        //             #region WF_Flow 表新增 3个字段
        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "WF_Flow",
        //                     Id = "c01a7137-20a9-450b-b4ac-50932bf8b2a3",
        //                     Label = "HandlerUsers",
        //                     Name = "HandlerUsers",
        //                     Type = "mediumtext",
        //                     Component = "Textarea",
        //                     Description = "处理过工作的人，包括同意、不同意、撤回、发起工作"
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【WF_Flow】表【HandlerUsers】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【WF_Flow】表【HandlerUsers】字段失败：" + ex.Message + "<br>";
        //             }

        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "WF_Flow",
        //                     Id = "7557c14b-19f7-44db-abbf-6bc15dd9472c",
        //                     Label = "CopyUsers",
        //                     Name = "CopyUsers",
        //                     Type = "mediumtext",
        //                     Component = "Textarea",
        //                     Description = "抄送过的人"
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【WF_Flow】表【CopyUsers】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【WF_Flow】表【CopyUsers】字段失败：" + ex.Message + "<br>";
        //             }

        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "WF_Flow",
        //                     Id = "377cbd37-155c-4b50-971f-358a265fead6",
        //                     Label = "NotHandlerUsers",
        //                     Name = "NotHandlerUsers",
        //                     Type = "mediumtext",
        //                     Component = "Textarea",
        //                     Description = "收到过待办但未处理过的人"
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【WF_Flow】表【NotHandlerUsers】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【WF_Flow】表【NotHandlerUsers】字段失败：" + ex.Message + "<br>";
        //             }

        //             #endregion
        //         }

        //         else if (Version == "v3.8.22")
        //         {
        //             #region Diy_Table 表新增 SubmitBeforeServerV8
        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "Diy_Table",
        //                     Id = "ee5818c7-8091-4752-95ff-5aa57882580a",
        //                     Label = "表单提交前事件",
        //                     Name = "SubmitBeforeServerV8",
        //                     Type = "mediumtext",
        //                     Component = "CodeEditor",
        //                     Description = "服务器端事件"
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【Diy_Table】表【SubmitBeforeServerV8】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【Diy_Table】表【SubmitBeforeServerV8】字段失败：" + ex.Message + "<br>";
        //             }
        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "Diy_Table",
        //                     Id = "d8e2a5f7-db45-425c-9c36-4e4ec00e4012",
        //                     Label = "表单提交后事件",
        //                     Name = "SubmitAfterServerV8",
        //                     Type = "mediumtext",
        //                     Component = "CodeEditor",
        //                     Description = "服务器端事件"
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【Diy_Table】表【SubmitBeforeServerV8】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【Diy_Table】表【SubmitBeforeServerV8】字段失败：" + ex.Message + "<br>";
        //             }
        //             #endregion
        //             #region Sys_Config 修复分组、 新增字段 PwdEncode 、 新增字段 PwdV8
        //             try
        //             {
        //                 MicroiEngine.FormEngine.UptFormData(new
        //                 {
        //                     FormEngineKey = "Diy_Table",
        //                     Id = "c8570fa6-c10f-4014-8cb4-4b046e7ba69c",
        //                     OsClient = osClientName,
        //                     Tabs = "[{\"Name\":\"系统信息\",\"EnName\":\"none\",\"Sort\":1,\"Display\":true,\"Icon\":\"fas fa-info-circle\"},{\"Sort\":\"2\",\"Name\":\"界面风格\",\"Display\":true},{\"Sort\":\"3\",\"Name\":\"开发配置\",\"Display\":true,\"Icon\":\"fab fa-dev\"},{\"Sort\":\"5\",\"Name\":\"密码强度\",\"Icon\":\"fas fa-user-secret\",\"Display\":true}]",
        //                 });
        //             }
        //             catch (Exception ex)
        //             {

        //             }
        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableId = "c8570fa6-c10f-4014-8cb4-4b046e7ba69c",
        //                     Id = "359a3477-6e0e-48fd-a015-a4ee83f80c76",
        //                     Label = "密码存储形式",
        //                     Name = "PwdEncode",
        //                     Type = "varchar(50)",
        //                     Component = "Radio",
        //                     Data = "[\"DES\",\"V8\"]",
        //                     Tab = "密码强度",
        //                     Sort = 2200,
        //                     Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"V8Code\":\"VjguRmllbGRTZXQoJ1B3ZFY4JywgJ1Zpc2libGUnLCBWOC5Gb3JtLlB3ZEVuY29kZSA9PSAnVjgnKTs=\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"DataSource\":\"Data\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnText\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false,\"EmitPath\":true},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\",\"EmitPath\":true},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"Divider\":{\"Icon\":\"\"},\"JoinTable\":{\"TableId\":\"\",\"ModuleName\":\"\",\"ModuleId\":\"\",\"Where\":\"\"}}",
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【Sys_Config】表【PwdEncode】字段！<br>";
        //                 else
        //                 {
        //                     var result2 = await MicroiEngine.FormEngine.UptDiyField(new DiyFieldParam()
        //                     {
        //                         TableName = "Sys_Config",
        //                         Name = "PwdEncode",
        //                         OsClient = osClientName,
        //                         Data = "[\"DES\",\"V8\"]",
        //                         Tab = "密码强度",
        //                         Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"V8Code\":\"VjguRmllbGRTZXQoJ1B3ZFY4JywgJ1Zpc2libGUnLCBWOC5Gb3JtLlB3ZEVuY29kZSA9PSAnVjgnKTs=\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"DataSource\":\"Data\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnText\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false,\"EmitPath\":true},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\",\"EmitPath\":true},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"Divider\":{\"Icon\":\"\"},\"JoinTable\":{\"TableId\":\"\",\"ModuleName\":\"\",\"ModuleId\":\"\",\"Where\":\"\"}}",
        //                     });
        //                     if (result2.Code == 1)
        //                         resultMsg += "成功修改【Sys_Config】表【PwdEncode】字段属性！<br>";
        //                 }
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【Sys_Config】表【PwdEncode】字段失败：" + ex.Message + "<br>";
        //             }
        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableId = "c8570fa6-c10f-4014-8cb4-4b046e7ba69c",
        //                     Id = "344b4721-1fa9-41ae-8dce-d7c8e78a0a1d",
        //                     Label = "密码V8加解密",
        //                     Name = "PwdV8",
        //                     Type = "mediumtext",
        //                     Component = "CodeEditor",
        //                     Visible = 0,
        //                     Tab = "密码强度",
        //                     Sort = 3100,
        //                     FormWidth = 24,
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【Sys_Config】表【PwdV8】字段！<br>";
        //                 else
        //                 {
        //                     var result2 = await MicroiEngine.FormEngine.UptDiyField(new DiyFieldParam()
        //                     {
        //                         OsClient = osClientName,
        //                         TableId = "c8570fa6-c10f-4014-8cb4-4b046e7ba69c",
        //                         Id = "344b4721-1fa9-41ae-8dce-d7c8e78a0a1d",
        //                         Label = "密码V8加解密",
        //                         Name = "PwdV8",
        //                         Type = "mediumtext",
        //                         Component = "CodeEditor",
        //                         Visible = 0,
        //                         Tab = "密码强度",
        //                         Sort = 3100,
        //                         FormWidth = 24,
        //                     });
        //                     if (result2.Code == 1)
        //                         resultMsg += "成功修改【Sys_Config】表【PwdV8】字段属性！<br>";
        //                 }
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【Sys_Config】表【PwdV8】字段失败：" + ex.Message + "<br>";
        //             }
        //             #endregion
        //             #region Sys_User 表新增字段 PwdEncode
        //             try
        //             {
        //                 var result = await AddDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "Sys_User",
        //                     Id = "ede9792b-ecbb-4d6d-b1f2-3ed8fb8c5c32",
        //                     Label = "密码存储形式",
        //                     Name = "PwdEncode",
        //                     Type = "varchar(50)",
        //                     Component = "Radio",
        //                     Tab = "扩展信息",
        //                     Data = "[\"DES\",\"V8\"]",
        //                 });
        //                 if (result.Code == 1)
        //                     resultMsg += "成功添加【Sys_User】表【PwdEncode】字段！<br>";
        //             }
        //             catch (Exception ex)
        //             {
        //                 resultMsg += "新增【Sys_User】表【PwdEncode】字段失败：" + ex.Message + "<br>";
        //             }
        //             //修改表PwdEncode值为DES
        //             try
        //             {
        //                 var diyWhere = new List<DiyWhere>();
        //                 diyWhere.Add(new DiyWhere()
        //                 {
        //                     Name = "PwdEncode",
        //                     Value = null,
        //                     Type = "="
        //                 });
        //                 var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync(new
        //                 {
        //                     OsClient = osClientName,
        //                     TableName = "Sys_User",
        //                     _RowModel = new
        //                     {
        //                         PwdEncode = "DES"
        //                     },
        //                     _Where = diyWhere,
        //                 });
        //                 if (result.Code == 1)
        //                 {
        //                     resultMsg += "成功修改【Sys_User】表【PwdV8】字段值为DES！<br>";
        //                 }
        //             }
        //             catch (Exception ex)
        //             {

        //             }
        //             #endregion
        //         }
        //         else if (Version == "v3.8.8")
        //         {
        //             //using (var trans = dbSession.BeginTransaction())
        //             {
        //                 #region 修改Sys_Menu表一些字段可为空
        //                 try
        //                 {
        //                     var sql2 = @$"ALTER TABLE `Sys_Menu` CHANGE `MultRun` `MultRun` bit NULL";
        //                     dbSession.FromSql(sql2).ExecuteNonQuery();
        //                 }
        //                 catch (Exception ex)
        //                 {

        //                 }

        //                 #endregion
        //                 //这是v3.6.29的更新，有些老系统没执行此更新会导致v3.8.8无法更新成功，所以再执行1次。
        //                 #region Diy_Table表新增字段：ServerDataV8、TreeParentField、TreeParentFields、TreeLazy、TreeHasChildren
        //                 var fields = new List<DiyField>();
        //                 fields.Add(new DiyField() { Name = "ServerDataV8", Type = "mediumtext", Label = "服务器端数据处理V8引擎代码" });
        //                 fields.Add(new DiyField() { Name = "TreeParentField", Type = "varchar(50)", Label = "" });
        //                 fields.Add(new DiyField() { Name = "TreeParentFields", Type = "mediumtext", Label = "" });
        //                 fields.Add(new DiyField() { Name = "TreeLazy", Type = "bit", Label = "" });
        //                 fields.Add(new DiyField() { Name = "TreeHasChildren", Type = "varchar(50)", Label = "" });
        //                 foreach (var field in fields)
        //                 {
        //                     try
        //                     {
        //                         dbSession.FromSql(
        //                             string.Format(@"ALTER TABLE `{0}` ADD COLUMN `{1}` {2} {3} COMMENT '{4}';",
        //                                 "Diy_Table",
        //                                 field.Name,
        //                                 field.Type,
        //                                 "null",
        //                                 field.Label
        //                             )
        //                         )
        //                         .ExecuteNonQuery();
        //                         resultMsg += "成功添加【Diy_Table】表【" + field.Name + "】字段！<br>";
        //                     }
        //                     catch (Exception ex)
        //                     {
        //                         //resultMsg += "【Diy_Table】表可能已经存在【" + field.Name + "】字段：" + ex.Message + "！<br>";
        //                     }
        //                 }
        //                 #endregion

        //                 #region 修改系统表字段类型
        //                 //获取所有Sys_、WF_、Diy_开头的表，并且类型是char36的字段
        //                 //var sqlTableList = @"select table_name
        //                 //                from information_schema.tables
        //                 //                where table_schema = (select database())
        //                 //                and (table_name like 'Diy_%' or table_name like 'Sys_%' or table_name like 'WF_%')";
        //                 var sqlFieldList = @"select table_name,column_name, 
        //                                         data_type,
        //                                         column_comment,
        //                                         column_key,
        //                                         extra,
        //                                         is_nullable,
        //                                         column_type 
        //                                         from information_schema.columns
        //                                         where table_schema = (select database()) 
        //                                         and column_type='char(36)'
        //                                         and (table_name like 'Diy_%' or table_name like 'Sys_%' or table_name like 'WF_%')";
        //                 var fieldList = dbSession.FromSql(sqlFieldList).ToList<information_schema_columns>();
        //                 if (fieldList.Count > 0)
        //                 {
        //                     resultMsg += $"有【{fieldList.Count}】个字段类型待修改！<br>";
        //                 }
        //                 var count = 0;
        //                 foreach (var field in fieldList)
        //                 {
        //                     try
        //                     {
        //                         var sql = @$"ALTER TABLE `{field.table_name}` CHANGE `{field.column_name}` `{field.column_name}`
        //                                     varchar(36) {(field.column_name.ToLower() == "id" ? "NOT NULL" : "NULL")}
        //                                     COMMENT '{(field.column_comment.DosIsNullOrWhiteSpace() ? field.column_name : field.column_comment)}';";
        //                         count += dbSession.FromSql(sql).ExecuteNonQuery();
        //                     }
        //                     catch (Exception ex)
        //                     {
        //                         continue;
        //                     }
        //                 }
        //                 if (fieldList.Count > 0 || count > 0)
        //                 {
        //                     resultMsg += $"成功修改【{count}】个字段的类型！<br>";
        //                 }
        //                 #endregion

        //                 #region 修改Sys_Menu表 表单属性


        //                 await MicroiEngine.FormEngine.LoadNotDiyTableAsync(new DiyTableParam()
        //                 {
        //                     Name = "Sys_Menu",
        //                     Id = "1d28e502-70ea-4a2b-9793-699b3f42234e",
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });

        //                 await AddDiyField(new DiyFieldParam()
        //                 {
        //                     Id = "aee82b03-efbb-4a39-add0-7b598fe07363",
        //                     TableId = "1d28e502-70ea-4a2b-9793-699b3f42234e",
        //                     Name = "ParentId",
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 await AddDiyField(new DiyFieldParam()
        //                 {
        //                     Id = "408399d3-4b4c-449d-848e-ec8c7085fe12",
        //                     TableId = "1d28e502-70ea-4a2b-9793-699b3f42234e",
        //                     Name = "ParentIds",
        //                     Type = "mediumtext",
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 await MicroiEngine.FormEngine.UptDiyTable(new DiyTableParam()
        //                 {
        //                     Id = "1d28e502-70ea-4a2b-9793-699b3f42234e",
        //                     IsTree = 1,
        //                     TreeParentField = "ParentId",
        //                     TreeParentFields = "ParentIds",
        //                     TreeLazy = 0,
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });

        //                 #endregion

        //                 #region 系统表全部加载为DIY表单
        //                 await MicroiEngine.FormEngine.LoadNotDiyTableAsync(new DiyTableParam()
        //                 {
        //                     Name = "Sys_User",
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 await MicroiEngine.FormEngine.LoadNotDiyTableAsync(new DiyTableParam()
        //                 {
        //                     Name = "Sys_Role",
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 await MicroiEngine.FormEngine.LoadNotDiyTableAsync(new DiyTableParam()
        //                 {
        //                     Name = "Sys_Dept",
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 await MicroiEngine.FormEngine.LoadNotDiyTableAsync(new DiyTableParam()
        //                 {
        //                     Name = "Diy_Table",
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 await MicroiEngine.FormEngine.LoadNotDiyTableAsync(new DiyTableParam()
        //                 {
        //                     Name = "Diy_Field",
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 #endregion

        //                 #region 系统设置，新增字段：GlobalServerV8Code，全局服务器端V8引擎代码
        //                 try
        //                 {
        //                     var result = await AddDiyField(new DiyFieldParam()
        //                     {
        //                         TableId = "c8570fa6-c10f-4014-8cb4-4b046e7ba69c",
        //                         Id = "b8bb3b0b-e4df-430f-bf8f-537a05dc4424",
        //                         Label = "全局服务器端V8引擎代码",
        //                         Name = "GlobalServerV8Code",
        //                         Type = "mediumtext",
        //                         Component = "CodeEditor",
        //                         OsClient = osClientName,
        //                         _CurrentSysUser = _currentSysUser,
        //                         _CurrentUser = _currentUser,
        //                     });
        //                     if (result.Code == 1)
        //                     {
        //                         resultMsg += "成功添加【Sys_Config】表【GlobalServerV8Code】字段！<br>";
        //                     }
        //                     else
        //                     {
        //                         //resultMsg += "【Sys_Config】表可能已经存在【EnableChat】字段：" + result.Msg + "！<br>";
        //                     }
        //                 }
        //                 catch (Exception ex)
        //                 {
        //                     resultMsg += "新增【Sys_Config】表【GlobalServerV8Code】字段失败：" + ex.Message + "<br>";
        //                 }
        //                 #endregion
        //             }
        //         }
        //         else if (Version == "v3.7.18")
        //         {
        //             using (var trans = dbSession.BeginTransaction())
        //             {
        //                 #region 节点属性，新增字段：SameDeptApprove，允许撤回
        //                 try
        //                 {
        //                     var result = await new DiyFieldLogic().AddDiyField(new DiyFieldParam()
        //                     {
        //                         TableName = "WF_Node",
        //                         //TableDescription = "流程引擎节点属性",
        //                         Id = "8d599d66-ca61-4661-b544-5b6585e62fc9",
        //                         TableId = "84571d14-50e7-40a6-b6b2-9343fbf4a88b",
        //                         Label = "同部门领导审批",
        //                         Name = "SameDeptApprove",
        //                         NameConfirm = 1,
        //                         Type = "bit",
        //                         Component = "Switch",
        //                         NotEmpty = 0,
        //                         Visible = 1,
        //                         Readonly = 0,
        //                         UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",
        //                         Sort = 117,
        //                         Tab = "",
        //                         IsDeleted = 0,
        //                         Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"DataSource\":\"\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnName\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"}}",
        //                         //FormWidth = 24,
        //                         TableWidth = 100,
        //                         Unique = 0,
        //                         BindRole = "[]",
        //                         InTableEdit = 0,
        //                         IsLockField = 0,
        //                         OsClient = osClientName,
        //                         _CurrentSysUser = _currentSysUser,
        //                         _CurrentUser = _currentUser,
        //                     });
        //                     if (result.Code == 1)
        //                     {
        //                         resultMsg += "成功添加【WF_Node】表【SameDeptApprove】字段！<br>";
        //                     }
        //                     else
        //                     {
        //                         //resultMsg += "【WF_Node】表可能已经存在【SameDeptApprove】字段：" + result.Msg + "！<br>";
        //                     }
        //                 }
        //                 catch (Exception ex)
        //                 {
        //                     resultMsg += "新增【WF_Node】表【SameDeptApprove】字段失败：" + ex.Message + "<br>";
        //                 }
        //                 #endregion
        //             }
        //         }
        //         else if (Version == "v3.7.1")
        //         {
        //             using (var trans = dbSession.BeginTransaction())
        //             {
        //                 #region 系统设置，新增字段：EnableChat，是否开启聊天系统
        //                 try
        //                 {
        //                     var result = await new DiyFieldLogic().AddDiyField(new DiyFieldParam()
        //                     {
        //                         TableId = "c8570fa6-c10f-4014-8cb4-4b046e7ba69c",
        //                         TableName = "Sys_Config",
        //                         //TableDescription = "系统设置",
        //                         Id = "acce5792-2b2e-4fcf-a9b0-d095dc46d973",
        //                         Label = "微聊系统",
        //                         Name = "EnableChat",
        //                         NameConfirm = 1,
        //                         Type = "bit",
        //                         Component = "Switch",
        //                         NotEmpty = 0,
        //                         Visible = 1,
        //                         Readonly = 0,
        //                         UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",
        //                         Sort = 2300,
        //                         Tab = "系统信息",
        //                         IsDeleted = 0,
        //                         Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"DataSource\":\"\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnText\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"}}",
        //                         TableWidth = 100,
        //                         Unique = 0,
        //                         BindRole = "[]",
        //                         InTableEdit = 0,
        //                         IsLockField = 0,
        //                         OsClient = osClientName,
        //                         _CurrentSysUser = _currentSysUser,
        //                         _CurrentUser = _currentUser,
        //                     });
        //                     if (result.Code == 1)
        //                     {
        //                         resultMsg += "成功添加【Sys_Config】表【EnableChat】字段！<br>";
        //                     }
        //                     else
        //                     {
        //                         //resultMsg += "【Sys_Config】表可能已经存在【EnableChat】字段：" + result.Msg + "！<br>";
        //                     }
        //                 }
        //                 catch (Exception ex)
        //                 {
        //                     resultMsg += "新增【Sys_Config】表【EnableChat】字段失败：" + ex.Message + "<br>";
        //                 }
        //                 #endregion
        //                 #region 节点属性，新增字段：LineValueV8，条件判断V8
        //                 try
        //                 {
        //                     var result = await new DiyFieldLogic().AddDiyField(new DiyFieldParam()
        //                     {
        //                         TableName = "WF_Node",
        //                         //TableDescription = "流程引擎节点属性",
        //                         Id = "ae2c1537-3996-41b0-a4f1-f18f9d16cace",
        //                         TableId = "84571d14-50e7-40a6-b6b2-9343fbf4a88b",
        //                         Label = "条件判断V8",
        //                         Name = "LineValueV8",
        //                         NameConfirm = 1,
        //                         Type = "mediumtext",
        //                         Component = "CodeEditor",
        //                         NotEmpty = 0,
        //                         Visible = 1,
        //                         Readonly = 0,
        //                         UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",
        //                         Sort = 310,
        //                         Tab = "",
        //                         IsDeleted = 0,
        //                         Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"DataSource\":\"\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnText\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"}}",
        //                         FormWidth = 24,
        //                         TableWidth = 100,
        //                         Unique = 0,
        //                         BindRole = "[]",
        //                         InTableEdit = 0,
        //                         IsLockField = 0,
        //                         OsClient = osClientName,
        //                         _CurrentSysUser = _currentSysUser,
        //                         _CurrentUser = _currentUser,
        //                     });
        //                     if (result.Code == 1)
        //                     {
        //                         resultMsg += "成功添加【WF_Node】表【LineValueV8】字段！<br>";
        //                     }
        //                     else
        //                     {
        //                         //resultMsg += "【WF_Node】表可能已经存在【LineValueV8】字段：" + result.Msg + "！<br>";
        //                     }
        //                 }
        //                 catch (Exception ex)
        //                 {
        //                     resultMsg += "新增【WF_Node】表【LineValueV8】字段失败：" + ex.Message + "<br>";
        //                 }
        //                 #endregion
        //                 #region 节点属性，新增字段：AllowRecall，允许撤回
        //                 try
        //                 {
        //                     var result = await new DiyFieldLogic().AddDiyField(new DiyFieldParam()
        //                     {
        //                         TableName = "WF_Node",
        //                         //TableDescription = "流程引擎节点属性",
        //                         Id = "24ca926e-d5ed-44f0-bc0b-2b75ede71fe3",
        //                         TableId = "84571d14-50e7-40a6-b6b2-9343fbf4a88b",
        //                         Label = "允许撤回",
        //                         Name = "AllowRecall",
        //                         NameConfirm = 1,
        //                         Type = "bit",
        //                         Component = "Switch",
        //                         NotEmpty = 0,
        //                         Visible = 1,
        //                         Readonly = 0,
        //                         UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",
        //                         Sort = 310,
        //                         Tab = "",
        //                         IsDeleted = 0,
        //                         Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"DataSource\":\"\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnText\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"}}",
        //                         //FormWidth = 24,
        //                         TableWidth = 100,
        //                         Unique = 0,
        //                         BindRole = "[]",
        //                         InTableEdit = 0,
        //                         IsLockField = 0,
        //                         OsClient = osClientName,
        //                         _CurrentSysUser = _currentSysUser,
        //                         _CurrentUser = _currentUser,
        //                     });
        //                     if (result.Code == 1)
        //                     {
        //                         resultMsg += "成功添加【WF_Node】表【AllowRecall】字段！<br>";
        //                     }
        //                     else
        //                     {
        //                         //resultMsg += "【WF_Node】表可能已经存在【AllowRecall】字段：" + result.Msg + "！<br>";
        //                     }
        //                 }
        //                 catch (Exception ex)
        //                 {
        //                     resultMsg += "新增【WF_Node】表【AllowRecall】字段失败：" + ex.Message + "<br>";
        //                 }
        //                 #endregion
        //                 #region 节点属性，StartV8控件显示出来
        //                 var result2 = await new DiyFieldLogic().UptDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "WF_Node",
        //                     Name = "StartV8",
        //                     Component = "CodeEditor",
        //                     Visible = 1,
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 if (result2.Code == 1)
        //                 {
        //                     resultMsg += "成功修改【WF_Node】表【StartV8】字段属性！<br>";//【可见】为true
        //                 }
        //                 else
        //                 {
        //                     resultMsg += "修改【WF_Node】表【StartV8】字段属性【可见】失败：" + result2.Msg + "<br>";
        //                 }
        //                 #endregion
        //             }
        //         }
        //         else if (Version == "v3.6.29")
        //         {
        //             using (var trans = dbSession.BeginTransaction())
        //             {
        //                 #region 节点属性，V8控件修改为代码编辑器
        //                 var result = await new DiyFieldLogic().UptDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "WF_Node",
        //                     Name = "StartV8",
        //                     Component = "CodeEditor",
        //                     //Visible = false,
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 resultMsg += "成功修改【WF_Node】表【StartV8】字段的控件类型！<br>";//，并隐藏【StartV8】字段
        //                 result = await new DiyFieldLogic().UptDiyField(new DiyFieldParam()
        //                 {
        //                     TableName = "WF_Node",
        //                     Name = "EndV8",
        //                     Component = "CodeEditor",
        //                     OsClient = osClientName,
        //                     _CurrentSysUser = _currentSysUser,
        //                     _CurrentUser = _currentUser,
        //                 });
        //                 resultMsg += "成功修改【WF_Node】表【EndV8】字段的控件类型为【CodeEditor】！<br>";
        //                 #endregion
        //                 #region Diy_Table表新增字段：ServerDataV8、TreeParentField、TreeParentFields、TreeLazy、TreeHasChildren
        //                 var fields = new List<DiyField>();
        //                 fields.Add(new DiyField() { Name = "ServerDataV8", Type = "mediumtext", Label = "服务器端数据处理V8引擎代码" });
        //                 fields.Add(new DiyField() { Name = "TreeParentField", Type = "varchar(50)", Label = "" });
        //                 fields.Add(new DiyField() { Name = "TreeParentFields", Type = "mediumtext", Label = "" });
        //                 fields.Add(new DiyField() { Name = "TreeLazy", Type = "bit", Label = "" });
        //                 fields.Add(new DiyField() { Name = "TreeHasChildren", Type = "varchar(50)", Label = "" });
        //                 foreach (var field in fields)
        //                 {
        //                     try
        //                     {
        //                         dbSession.FromSql(
        //                             string.Format(@"ALTER TABLE `{0}` ADD COLUMN `{1}` {2} {3} COMMENT '{4}';",
        //                                 "Diy_Table",
        //                                 field.Name,
        //                                 field.Type,
        //                                 "null",
        //                                 field.Label
        //                             )
        //                         )
        //                         .ExecuteNonQuery();
        //                         resultMsg += "成功添加【Diy_Table】表【" + field.Name + "】字段！<br>";
        //                     }
        //                     catch (Exception ex)
        //                     {
        //                         //resultMsg += "【Diy_Table】表可能已经存在【" + field.Name + "】字段：" + ex.Message + "！<br>";
        //                     }
        //                 }
        //                 #endregion
        //             }
        //         }
        //         else
        //         {
        //             return new DosResult(0, null, "【" + Version + "】该版本无需执行更新程序！");
        //         }
        //         return new DosResult(1, null, resultMsg);
        //     }
        //     catch (Exception ex)
        //     {


        //         return new DosResult(0, null, ex.Message);
        //     }

        // }

        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetOsClientByDomain(string Domain, string Lang = "")
        {
            var param = new DiyTableRowParam();
            param.TableName = "Sys_OsClients";
            param.OsClient = OsClient.GetConfigOsClient();
            if (Lang.DosIsNullOrWhiteSpace())
            {
                Lang = DiyMessage.Lang;
            }
            if (Domain.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }

            //指定条件
            //param._SearchEqual = new Dictionary<string, string>() {
            //    { "DomainName", Domain},
            //    { "IsDeleted", "0"},
            //    { "IsEnable", "1"},
            //};

            Domain = Domain.ToLower();

            //2025-12-01 Anderson：增加支持http、https
            if (Domain.Contains("http://") || Domain.Contains("https://"))
            {
                Domain = Domain.Replace("http://", "").Replace("https://", "");
            }

            //2026-01-01 Anderson：从内存中获取
            var cacheResult = OsClient.ClientList.FirstOrDefault(item
                => item.Value.DomainName == Domain
                || item.Value.DomainName == "http://" + Domain
                || item.Value.DomainName == "https://" + Domain
                || item.Value.DomainName.Split(';').Contains(Domain)
                || item.Value.DomainName.Split(';').Contains("http://" + Domain)
                || item.Value.DomainName.Split(';').Contains("https://" + Domain)
            );
            if (cacheResult.Value != null)
            {
                return Json(new DosResult(1, new
                {
                    OsClient = cacheResult.Value.OsClient
                }));
            }
            return Json(new DosResult(1, new
            {
                OsClient = OsClient.GetConfigOsClient(),
            }));


            //先用等号查询，性能更高
            //旧版写法，仍支持
            // param._Where = new List<DiyWhere>() {
            //     new DiyWhere(){ GroupStart = true, Name = "DomainName", Value = Domain, Type = "=" },
            //     new DiyWhere(){ AndOr = "OR", Name = "DomainName", Value = "http://" + Domain, Type = "=" },
            //     new DiyWhere(){ AndOr = "OR", Name = "DomainName", Value = "https://" + Domain, Type = "=", GroupEnd = true },
            //     new DiyWhere(){ Name = "IsEnable", Value = "1", Type = "=" },
            // };
            //新版写法
            param._Where = new List<List<object>>() {
                new List<object>{ "(", "DomainName", "=", Domain },
                new List<object>{ "OR", "DomainName", "=", "http://" + Domain },
                new List<object>{ "OR", "DomainName", "=", "https://" + Domain, ")"},
                new List<object>{ "IsEnable", "=", 1 },
            };
            //指定查询列
            param._SelectFields = new List<string>() { "DomainName", "OsClient" };
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(param);
            if (result.Code != 1)
            {
                //等号查询没有数据时，再用like查询
                //旧版写法，仍支持
                // param._Where = new List<DiyWhere>() {
                //     new DiyWhere(){ GroupStart = true, Name = "DomainName", Value = "$" + Domain + "$", Type = "Like" },
                //     new DiyWhere(){ AndOr = "OR", Name = "DomainName", Value = "$" + "http://" + Domain + "$", Type = "Like" },
                //     new DiyWhere(){ AndOr = "OR", Name = "DomainName", Value = "$" + "https://" + Domain + "$", Type = "Like", GroupEnd = true  },
                //     new DiyWhere(){ Name = "IsEnable", Value = "1", Type = "=" },
                // };
                //新版写法
                param._Where = new List<List<object>>() {
                    new List<object>{ "(", "DomainName", "Like", "$" + Domain + "$" },
                    new List<object>{ "OR", "DomainName", "Like", "," + Domain },
                    new List<object>{ "OR", "DomainName", "Like", ";" + "http://" + Domain },
                    new List<object>{ "OR", "DomainName", "Like", ";" + "https://" + Domain },
                    new List<object>{ "OR", "DomainName", "Like", "http://" + Domain + ";" },
                    new List<object>{ "OR", "DomainName", "Like", "https://" + Domain + ";" },
                    new List<object>{ "OR", "DomainName", "Like", "$" + "http://" + Domain + "$" },
                    new List<object>{ "OR", "DomainName", "Like", "$" + "https://" + Domain + "$", ")" },
                    new List<object>{ "IsEnable", "=", 1 },
                };
                result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(param);
                if (result.Code != 1)
                {
                    return Json(new DosResult(1, new
                    {
                        OsClient = OsClient.GetConfigOsClient(),
                    }));
                }
            }
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="Version"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        // [AllowAnonymous]
        public async Task CheckServer(string OsClient)
        {
            var resultHtml = "";

            var dockerOsClient = (Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? "");
            resultHtml += "<br>环境变量OsClient为：" + dockerOsClient;
            resultHtml += "<br>环境变量OsClientType为：" + (Environment.GetEnvironmentVariable("OsClientType", EnvironmentVariableTarget.Process) ?? "");
            resultHtml += "<br>环境变量OsClientNetwork为：" + (Environment.GetEnvironmentVariable("OsClientNetwork", EnvironmentVariableTarget.Process) ?? "");
            resultHtml += "<br>配置文件OsClient为：" + (ConfigHelper.GetAppSettings("OsClient") ?? "");
            resultHtml += "<br>配置文件OsClientType为：" + (ConfigHelper.GetAppSettings("OsClientType") ?? "");
            resultHtml += "<br>配置文件OsClientNetwork为：" + (ConfigHelper.GetAppSettings("OsClientNetwork") ?? "");

            var osClientStr = OsClient;
            if (osClientStr.DosIsNullOrWhiteSpace())
            {
                osClientStr = dockerOsClient;
                if (osClientStr.DosIsNullOrWhiteSpace())
                {
                    osClientStr = (ConfigHelper.GetAppSettings("OsClient") ?? "");
                }
            }

            //获取ClientModel
            try
            {
                var osClientModel = Microi.net.OsClient.GetClient(osClientStr);
                resultHtml += "<br>获取ClientModel成功：" + osClientModel.OsClient;
                //数据库连接
                try
                {
                    var sysConfigModel = osClientModel.Db.FromSql("SELECT * FROM sys_config").First<dynamic>();//SysConfig
                    if (sysConfigModel != null)
                    {
                        resultHtml += "<br>测试数据库连接成功：" + (sysConfigModel.SysTitle ?? "") + "-" + (sysConfigModel.CompanyName ?? "");
                    }
                }
                catch (Exception ex)
                {
                    resultHtml += "<br>测试数据库连接失败：" + ex.Message;
                }
                //redis连接
                try
                {
                    var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClientStr);
                    DiyCacheBase.Set("CheckServer", "Test");
                    resultHtml += "<br>测试Redis成功：" + osClientModel.RedisHost;
                }
                catch (Exception ex)
                {
                    resultHtml += "<br>测试Redis失败：" + (osClientModel.RedisHost ?? "") + ":" + (osClientModel.RedisPort ?? "") + "。" + ex.Message;
                }
                //测试MongoDB
                try
                {
                    var host = new MongodbHost()
                    {
                        Connection = osClientModel.DbMongoConnection,
                        DataBase = "sys_log_" + osClientModel.OsClient.ToString().ToLower(),
                        Table = "CheckServer"
                    };
                    var count = await TMongodbHelper<SysLog>.InsertAsync(host, new SysLog()
                    {
                        Remark = "CheckServer"
                    });
                    resultHtml += "<br>测试MongoDB成功！";
                }
                catch (Exception ex)
                {
                    resultHtml += "<br>测试MongoDB失败：" + ex.Message;
                }
            }
            catch (Exception ex)
            {


                resultHtml += "<br>获取ClientModel失败：" + ex.Message;
            }

            Response.ContentType = "text/html; charset=utf-8";
            var data = Encoding.UTF8.GetBytes(resultHtml);
            await Response.Body.WriteAsync(data, 0, data.Length);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        // [AllowAnonymous]
        public async Task OsClientInit()
        {
            var resultHtml = "";

            try
            {
                new OsClient().Init(true);
                resultHtml = JsonConvert.SerializeObject(new DosResult(1));
            }
            catch (Exception ex)
            {
                resultHtml = JsonConvert.SerializeObject(
                    new DosResult(0, null, ex.Message
                        , 0, new
                        {
                            DetailMsg = (ex.InnerException == null ? "" : (ex.InnerException.Message ?? "")) + "。-->" + ex.StackTrace
                        }
                ));
            }
            Response.ContentType = "text/html; charset=utf-8";
            var data = Encoding.UTF8.GetBytes(resultHtml);
            await Response.Body.WriteAsync(data, 0, data.Length);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task DynamicApiEngineInit()
        {
            var resultHtml = "";
            try
            {
                var currentToken = await DiyToken.GetCurrentToken<SysUser>();
                var clientModel = OsClient.GetClient(currentToken.OsClient);
                var result = await new DynamicRoute().Init(clientModel);
                resultHtml = JsonConvert.SerializeObject(result);
            }
            catch (Exception ex)
            {


                resultHtml = JsonConvert.SerializeObject(new DosResult(0, null,
                                "DynamicApiEngineInit。 " + ex.Message));// + "。-->" + (ex.InnerException == null ? "" : (ex.InnerException.Message ?? "")) + "。-->" + ex.StackTrace
            }

            Response.ContentType = "text/html; charset=utf-8";
            var data = Encoding.UTF8.GetBytes(resultHtml);
            await Response.Body.WriteAsync(data, 0, data.Length);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="OsClient"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public string GetOsClient()
        {
            var osClient = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process);
            osClient = osClient.DosIsNullOrWhiteSpace() ? ConfigHelper.GetAppSettings("OsClient") : osClient;

            var osClientType = Environment.GetEnvironmentVariable("OsClientType", EnvironmentVariableTarget.Process);
            osClientType = osClientType.DosIsNullOrWhiteSpace() ? ConfigHelper.GetAppSettings("OsClientType") : osClientType;

            var osClientNetwork = Environment.GetEnvironmentVariable("OsClientNetwork", EnvironmentVariableTarget.Process);
            osClientNetwork = osClientNetwork.DosIsNullOrWhiteSpace() ? ConfigHelper.GetAppSettings("OsClientNetwork") : osClientNetwork;

            return JsonConvert.SerializeObject(new
            {
                OsClient = osClient,
                OsClientType = osClientType,
                OsClientNetwork = osClientNetwork,
            });
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="OsClient"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public string GetHID()
        {
            var hid = DiyLicense.GetHardwareID();
            return hid;
        }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> GetDesktop()
        {
            #region 取当前登录会员信息
            var sysUser = await DiyToken.GetCurrentToken<SysUser>();
            #endregion
            var result = new List<SysMenu>();
            if (sysUser.CurrentUser.Account.ToLower() == "admin")
            {
                var tmpResult = await new SysMenuLogic().GetSysMenuStep(new SysMenuParam());
                if (tmpResult.Code != 1)
                {
                    return Json(tmpResult);
                }
                result = tmpResult.Data;
            }
            else
            {
                ////取当前用户所有角色
                //var roleIds = await new SysUserFkLogic().GetSysUserFk(new SysUserFkParam()
                //{
                //    UserId = sysUser.CurrentUser.Id,
                //    Type = "Role",
                //    OsClient = sysUser.OsClient
                //});
                ////再取这些角色拥有的菜单
                //var menuIds = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                //{
                //    RoleIds = roleIds.Select(d => d.FkId).ToList(),
                //    Type = "Menu",
                //    OsClient = sysUser.OsClient
                //});
                ////最后取菜单列表
                //var tmpResult = await new SysMenuLogic().GetSysMenuStep(new SysMenuParam()
                //{
                //    Ids = menuIds.Select(d => d.FkId).ToList(),
                //    OsClient = sysUser.OsClient
                //});
                //if (tmpResult.Code != 1)
                //{
                //    return Json(tmpResult);
                //}
                //result = tmpResult.Data;
            }
            return Json(new DosResult()
            {
                Code = 1,
                Data = result
            });
        }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public JsonResult GetDateTimeNow()
        {
            return Json(new DosResult(1, DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss")));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="OsClient"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public JsonResult MicroiNetInitCheck(string OsClient)
        {
            return Json(new DosResult(1, DiyStartup.MicroiNetInitCheck()));
        }
    }
}
