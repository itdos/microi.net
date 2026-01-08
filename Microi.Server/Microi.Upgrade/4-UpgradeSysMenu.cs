using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 必要升级
    /// </summary>
	public class UpgradeSysMenu
	{
        /// <summary>
        /// 版本号
        /// </summary>
        public static string Version = "2.0.0.0";
        /// <summary>
        /// 升级MySql语句
        /// </summary>
        public static string Sql = @"
    update sys_menu set DisplayMac=1,SizeWidthMac=1,SizeHeightMac=1 where DisplayMac is null;
    update sys_menu set DisplayWin=1 where DisplayWin is null;
";
        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string OsClient)
        {
            var msgs = new List<string>();
            #region 新增字段 DisplayWin
            try
            {
                var fieldParam = new DiyFieldParam()
                {
                    TableName = "sys_menu",
                    Id = Ulid.NewUlid().ToString(),
                    TableId = "1d28e502-70ea-4a2b-9793-699b3f42234e",
                    Label = "是否显示（win）",
                    Name = "DisplayWin",//字段名
                    NameConfirm = 1,//是否已确认字段名
                    Type = "int",//字段类型
                    Component = "Switch",//控件
                    NotEmpty = 0,//是否必填
                    Visible = 1,//是否显示
                    Readonly = 0,//是否只读
                    Sort = -950,//排序
                    Tab = "",//分组
                    IsDeleted = 0,//是否已删除
                    Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"Textarea\":{\"DefaultRows\":5},\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"Divider\":{\"Icon\":\"\"},\"DataSource\":\"\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"Upload\":{\"BeforeUploadV8\":\"\",\"GetPrivateFileBeforeServerV8\":\"\",\"GetPrivateFileAfterServerV8\":\"\"},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\",\"PrimaryTableFieldName\":\"Id\",\"DisablePagination\":false,\"NoneDefaultHeight\":false},\"JoinTable\":{\"TableId\":\"\",\"ModuleName\":\"\",\"ModuleId\":\"\",\"Where\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnName\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false,\"Filterable\":false,\"EmitPath\":true},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\",\"EmitPath\":true},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"CodeEditor\":{\"Height\":\"\"}}",//字段属性配置
                    FormWidth = 12,//表单占宽：24、12、6、
                    TableWidth = 120,//表格占宽
                    Unique = 0,//是否唯一
                    BindRole = "[]",//绑定角色
                    Data = "[]",//数据源
                    Description = "",//说明
                    OsClient = OsClient,
                    UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",//创建人Id
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

            #region 新增字段 DisplayMac
            try
            {
                var fieldParam = new DiyFieldParam()
                {
                    TableName = "sys_menu",
                    Id = Ulid.NewUlid().ToString(),
                    TableId = "1d28e502-70ea-4a2b-9793-699b3f42234e",
                    Label = "是否显示（mac）",
                    Name = "DisplayMac",//字段名
                    NameConfirm = 1,//是否已确认字段名
                    Type = "int",//字段类型
                    Component = "Switch",//控件
                    NotEmpty = 0,//是否必填
                    Visible = 1,//是否显示
                    Readonly = 0,//是否只读
                    Sort = -950,//排序
                    Tab = "",//分组
                    IsDeleted = 0,//是否已删除
                    Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"Textarea\":{\"DefaultRows\":5},\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"Divider\":{\"Icon\":\"\"},\"DataSource\":\"\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"Upload\":{\"BeforeUploadV8\":\"\",\"GetPrivateFileBeforeServerV8\":\"\",\"GetPrivateFileAfterServerV8\":\"\"},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\",\"PrimaryTableFieldName\":\"Id\",\"DisablePagination\":false,\"NoneDefaultHeight\":false},\"JoinTable\":{\"TableId\":\"\",\"ModuleName\":\"\",\"ModuleId\":\"\",\"Where\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnName\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false,\"Filterable\":false,\"EmitPath\":true},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\",\"EmitPath\":true},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"CodeEditor\":{\"Height\":\"\"}}",//字段属性配置
                    FormWidth = 12,//表单占宽：24、12、6、
                    TableWidth = 120,//表格占宽
                    Unique = 0,//是否唯一
                    BindRole = "[]",//绑定角色
                    Data = "[]",//数据源
                    Description = "",//说明
                    OsClient = OsClient,
                    UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",//创建人Id
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

            #region 新增字段 SizeWidthMac
            try
            {
                var fieldParam = new DiyFieldParam()
                {
                    TableName = "sys_menu",
                    Id = Ulid.NewUlid().ToString(),
                    TableId = "1d28e502-70ea-4a2b-9793-699b3f42234e",
                    Label = "图标宽（mac）",
                    Name = "SizeWidthMac",//字段名
                    NameConfirm = 1,//是否已确认字段名
                    Type = "varchar(50)",//字段类型
                    Component = "Radio",//控件
                    NotEmpty = 0,//是否必填
                    Visible = 1,//是否显示
                    Readonly = 0,//是否只读
                    Sort = -950,//排序
                    Tab = "",//分组
                    IsDeleted = 0,//是否已删除
                    Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"Textarea\":{\"DefaultRows\":5},\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"Divider\":{\"Icon\":\"\"},\"DataSource\":\"Data\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"Upload\":{\"BeforeUploadV8\":\"\",\"GetPrivateFileBeforeServerV8\":\"\",\"GetPrivateFileAfterServerV8\":\"\"},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\",\"PrimaryTableFieldName\":\"Id\",\"DisablePagination\":false,\"NoneDefaultHeight\":false},\"JoinTable\":{\"TableId\":\"\",\"ModuleName\":\"\",\"ModuleId\":\"\",\"Where\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnName\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false,\"Filterable\":false,\"EmitPath\":true},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\",\"EmitPath\":true},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"CodeEditor\":{\"Height\":\"\"}}",//字段属性配置
                    FormWidth = 12,//表单占宽：24、12、6、
                    TableWidth = 120,//表格占宽
                    Unique = 0,//是否唯一
                    BindRole = "[]",//绑定角色
                    Data = "[\"1\",\"2\",\"3\",\"4\"]",//数据源
                    Description = "",//说明
                    OsClient = OsClient,
                    UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",//创建人Id
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

            #region 新增字段 SizeHeightMac
            try
            {
                var fieldParam = new DiyFieldParam()
                {
                    TableName = "sys_menu",
                    Id = Ulid.NewUlid().ToString(),
                    TableId = "1d28e502-70ea-4a2b-9793-699b3f42234e",
                    Label = "图标高（mac）",
                    Name = "SizeHeightMac",//字段名
                    NameConfirm = 1,//是否已确认字段名
                    Type = "varchar(50)",//字段类型
                    Component = "Radio",//控件
                    NotEmpty = 0,//是否必填
                    Visible = 1,//是否显示
                    Readonly = 0,//是否只读
                    Sort = -950,//排序
                    Tab = "",//分组
                    IsDeleted = 0,//是否已删除
                    Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"Textarea\":{\"DefaultRows\":5},\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"Divider\":{\"Icon\":\"\"},\"DataSource\":\"Data\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"Upload\":{\"BeforeUploadV8\":\"\",\"GetPrivateFileBeforeServerV8\":\"\",\"GetPrivateFileAfterServerV8\":\"\"},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\",\"PrimaryTableFieldName\":\"Id\",\"DisablePagination\":false,\"NoneDefaultHeight\":false},\"JoinTable\":{\"TableId\":\"\",\"ModuleName\":\"\",\"ModuleId\":\"\",\"Where\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnName\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false,\"Filterable\":false,\"EmitPath\":true},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\",\"EmitPath\":true},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"CodeEditor\":{\"Height\":\"\"}}",//字段属性配置
                    FormWidth = 12,//表单占宽：24、12、6、
                    TableWidth = 120,//表格占宽
                    Unique = 0,//是否唯一
                    BindRole = "[]",//绑定角色
                    Data = "[\"1\",\"2\",\"3\",\"4\"]",//数据源
                    Description = "",//说明
                    OsClient = OsClient,
                    UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",//创建人Id
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

