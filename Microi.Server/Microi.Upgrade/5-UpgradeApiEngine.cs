using System;
using System.Collections.Generic;
using System.Threading.Tasks;
namespace Microi.net
{
    /// <summary>
    /// 必要升级
    /// </summary>
    public class UpgradeApiEngine
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "2.0.0.0";
        /// <summary>
        /// 
        /// </summary>
        public static string Sql = @"
        INSERT INTO `sys_apiengine` (`Id`, `CreateTime`, `UpdateTime`, `UserId`, `UserName`, `IsDeleted`, `ApiName`, `ApiEngineKey`, `IsEnable`, `ApiRole`, `ApiV8Code`, `Lock`, `LockKey`, `ApiRemark`, `TestParam`, `TestResult`, `ApiAddress`, `AllowAnonymous`, `Files`) VALUES ('2a78d645-18c2-46f4-979a-b909399f3730', '2024-08-18 01:31:13', '2024-09-29 15:50:10', 'c74d669c-a3d4-11e5-b60d-b870f43edd03', '管理员', b'0', '平台初始化接口', 'microi-init', b'1', '[]', '//根据域名获取OsClient值：https://api-china.itdos.com/api/Os/GetOsClientByDomain\nvar osClient = V8.Param.OsClient;\nif(V8.Param.Domain){\n  var osClientResult = V8.FormEngine.GetFormData({\n    FormEngineKey : \'Sys_OsClients\',\n    _Where:[{ GroupStart : true, Name : \'DomainName\', Value : V8.Param.Domain, Type : \'=\' },\n            { AndOr : \'OR\', Name : \'DomainName\', Value : \'$\' + V8.Param.Domain  + \'$\', Type : \'Like\', GroupEnd : true},\n            { Name : \'IsEnable\', Value : \'1\', Type : \'=\' }],\n    OsClient : osClient,\n  });\n  if(osClientResult.Code == 1){\n    osClient = osClientResult.Data.OsClient;\n  }\n}\n//获取系统设置：https://api-china.itdos.com/api/DiyTable/getSysConfig\nvar sysConfigModel = V8.Cache.Get(`SysConfig:${osClient}`);\nif(!sysConfigModel){\n  var sysConfigResult = V8.FormEngine.GetFormData({\n    FormEngineKey : \'Sys_Config\',\n    _Where:[{ Name : \'IsEnable\', Value : \'1\', Type : \'=\' }],\n    OsClient : osClient,\n  });\n  if(sysConfigResult.Code == 1){\n    sysConfigModel = sysConfigResult.Data;\n  }\n}else{\n  sysConfigModel = JSON.parse(sysConfigModel);\n}\n//Token以旧换新，返回用户身份信息和权限：https://api-china.itdos.com/api/SysUser/getCurrentUser\nvar currentUser = {};\nvar token = {};\nif(V8.Param.Token){\n  var tokenResult = V8.Method.GetCurrentToken(V8.Param.Token, osClient);\n  if(tokenResult){\n    var refreshResult = V8.Method.RefreshLoginUser(tokenResult.CurrentUser.Id, osClient);\n    currentUser = refreshResult.Data;\n    var getCurrentToken = V8.Method.GetCurrentToken();\n    if(getCurrentToken && getCurrentToken.Token){\n      token = V8.Method.GetCurrentToken().Token;\n    }\n  }\n}\n//返回服务器当前时间：https://api-china.itdos.com/api/os/getDateTimeNow\nvar nowTime = V8.Action.GetDateTimeNow();\n//获取菜单\nvar menuResult = V8.FormEngine.GetTableDataTree({\n  FormEngineKey : \'sys_menu\',\n  _OrderBy : \'Sort\',\n  _OrderByType : \'ASC\',\n  _SelectFields : [\'Id\', \'Name\', \'Icon\', \'IconClass\', \'Display\', \'AppDisplay\', \'IsMicroiService\', \n    \'OpenType\', \'ComponentName\', \'ComponentPath\', \'PageTemplate\', \'Url\',\n    \'DiyTableId\', \'ParentId\', \'Sort\']\n});\nvar ModuleList = [];\nif(menuResult.Code == 1){\n  //分屏数据\n  menuResult.Data.forEach((item, index) => {\n    \n  });\n  ModuleList.push({\n    ScreenId : 1,\n    ScreenName : \'\',\n    List: menuResult.Data\n  });\n}\n\nV8.Result = {\n  Code : 1,\n  Data : {\n    OsClient : osClient,\n    SysConfig : sysConfigModel,\n    DateTimeNow : nowTime,\n    CurrentUser : currentUser,\n    Token : token,\n    ModuleList : ModuleList\n  }\n};', b'0', '', '可选参数：Domain、Token\n', '', '', '/apiengine/microi-init', b'1', '[]');

INSERT INTO `sys_apiengine` (`Id`, `CreateTime`, `UpdateTime`, `UserId`, `UserName`, `IsDeleted`, `ApiName`, `ApiEngineKey`, `IsEnable`, `ApiRole`, `ApiV8Code`, `Lock`, `LockKey`, `ApiRemark`, `TestParam`, `TestResult`, `ApiAddress`, `AllowAnonymous`, `Files`) VALUES ('4617671b-ac06-40c0-b26f-06e73d87187b', '2024-09-02 11:20:56', '2024-09-26 15:56:56', 'c74d669c-a3d4-11e5-b60d-b870f43edd03', '管理员', b'0', '获取系统菜单数据', 'get-sys-menu-tree', b'1', '[]', 'var result = V8.FormEngine.GetTableDataTree({\n  FormEngineKey : \'sys_menu\',\n  _OrderBy : \'Sort\',\n  _OrderByType : \'ASC\',\n  _SelectFields : [\'Id\', \'Name\', \'Icon\', \'IconClass\', \'Display\', \'AppDisplay\', \'IsMicroiService\', \n    \'OpenType\', \'ComponentName\', \'ComponentPath\', \'PageTemplate\', \'Url\',\n    \'DiyTableId\', \'ParentId\', \'Sort\']\n});\nif(result.Code != 1){\n  V8.Result = result; return;\n}\n//分屏数据\nvar newData = [];\nresult.Data.forEach((item, index) => {\n  \n});\nnewData.push({\n  ScreenId : 1,\n  ScreenName : \'\',\n  List: result.Data\n});\nV8.Result = { Code : 1, Data : newData };', b'0', '', '', '', '', '/apiengine/get-sys-menu-tree', b'0', '[]');
";
        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string OsClient)
        {
            var msgs = new List<string>();
            #region 新增字段 ApiRemark
            try
            {
                var fieldParam = new DiyFieldParam()
                {
                    TableName = "sys_apiengine",
                    Id = Ulid.NewUlid().ToString(),
                    TableId = "cf389aef-72cc-4980-9c5b-143123561ac0",
                    Label = "接口说明",
                    Name = "ApiRemark",//字段名
                    NameConfirm = 1,//是否已确认字段名
                    Type = "mediumtext",//字段类型
                    Component = "Textarea",//控件
                    NotEmpty = 0,//是否必填
                    Visible = 1,//是否显示
                    Readonly = 0,//是否只读
                    Sort = 12,//排序
                    Tab = "引擎配置",//分组
                    FormWidth = 24,//表单占宽：24、12、6、
                    TableWidth = 120,//表格占宽
                    Unique = 0,//是否唯一
                    BindRole = "[]",//绑定角色
                    Data = "[]",//数据源
                    Description = "",//说明
                    OsClient = OsClient,
                    UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",//创建人Id
                    IsDeleted = 0,//是否已删除
                    Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"Textarea\":{\"DefaultRows\":5},\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"Divider\":{\"Icon\":\"\"},\"DataSource\":\"\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"Upload\":{\"BeforeUploadV8\":\"\",\"GetPrivateFileBeforeServerV8\":\"\",\"GetPrivateFileAfterServerV8\":\"\"},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\",\"PrimaryTableFieldName\":\"Id\",\"DisablePagination\":false,\"NoneDefaultHeight\":false},\"JoinTable\":{\"TableId\":\"\",\"ModuleName\":\"\",\"ModuleId\":\"\",\"Where\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnName\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false,\"Filterable\":false,\"EmitPath\":true},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\",\"EmitPath\":true},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"CodeEditor\":{\"Height\":\"\"}}",//字段属性配置

                };
                var result = await MicroiEngine.FormEngine.AddDiyField(fieldParam);
                if (result.Code != 1)
                {
                    msgs.Add(result.Msg);
                }
            }
            catch (Exception ex)
            {
                msgs.Add(ex.Message);
            }
            #endregion

            #region 新增字段 Files
            try
            {
                var fieldParam = new DiyFieldParam()
                {
                    TableName = "sys_apiengine",
                    Id = Ulid.NewUlid().ToString(),
                    TableId = "cf389aef-72cc-4980-9c5b-143123561ac0",
                    Label = "相关附件",
                    Name = "Files",//字段名
                    NameConfirm = 1,//是否已确认字段名
                    Type = "mediumtext",//字段类型
                    Component = "FileUpload",//控件
                    NotEmpty = 0,//是否必填
                    Visible = 1,//是否显示
                    Readonly = 0,//是否只读
                    Sort = 900,//排序
                    Tab = "引擎配置",//分组
                    FormWidth = 24,//表单占宽：24、12、6、
                    TableWidth = 120,//表格占宽
                    Unique = 0,//是否唯一
                    BindRole = "[]",//绑定角色
                    Data = "[]",//数据源
                    Description = "",//说明
                    OsClient = OsClient,
                    UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",//创建人Id
                    IsDeleted = 0,//是否已删除
                    Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"Textarea\":{\"DefaultRows\":5},\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"Divider\":{\"Icon\":\"\"},\"DataSource\":\"\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"Upload\":{\"BeforeUploadV8\":\"\",\"GetPrivateFileBeforeServerV8\":\"\",\"GetPrivateFileAfterServerV8\":\"\"},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\",\"PrimaryTableFieldName\":\"Id\",\"DisablePagination\":false,\"NoneDefaultHeight\":false},\"JoinTable\":{\"TableId\":\"\",\"ModuleName\":\"\",\"ModuleId\":\"\",\"Where\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnName\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false,\"Filterable\":false,\"EmitPath\":true},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\",\"EmitPath\":true},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"CodeEditor\":{\"Height\":\"\"}}",//字段属性配置

                };
                var result = await MicroiEngine.FormEngine.AddDiyField(fieldParam);
                if (result.Code != 1)
                {
                    msgs.Add(result.Msg);
                }
            }
            catch (Exception ex)
            {
                msgs.Add(ex.Message);
            }
            #endregion

            return msgs;
        }
    }
}

