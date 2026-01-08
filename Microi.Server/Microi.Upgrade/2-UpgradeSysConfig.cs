using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 必要升级
    /// </summary>
	public class UpgradeSysConfig
	{
        /// <summary>
        /// 版本号
        /// </summary>
        public static string Version = "1.9.5.8";
        /// <summary>
        /// 升级MySql语句
        /// </summary>
        public static string Sql = @"
    ALTER TABLE `sys_config` ADD COLUMN `ServerVersion` varchar(50) NULL COMMENT '服务器端版本号';
    ALTER TABLE `sys_config` ADD COLUMN `ClientVersion` varchar(50) NULL COMMENT '客户器端版本号';
    INSERT INTO `diy_field` (`Id`, `TableId`, `Label`, `Name`, `NameConfirm`, `Type`, `Code`, `Component`, `Description`, `NotEmpty`, `Visible`, `Readonly`, `CreateTime`, `UpdateTime`, `UserId`, `Sort`, `Tab`, `OsClient`, `IsDeleted`, `Data`, `Config`, `FormWidth`, `TableWidth`, `DefaultValue`, `Unique`, `BindRole`, `V8TmpEngineTable`, `V8TmpEngineForm`, `Placeholder`, `Remark`, `DataAppend`, `InTableEdit`, `KeyupV8Code`, `IsLockField`, `Encrypt`, `UserName`, `AppVisible`) VALUES ('5ccf87a2-c246-4e49-8b4f-e941d1c200f9', 'c8570fa6-c10f-4014-8cb4-4b046e7ba69c', '客户器端版本号', 'ClientVersion', b'1', 'varchar(50)', '', 'Text', '请勿手动修改，由Microi.Upgrade升级程序自动控制', b'0', b'1', b'1', '2024-09-19 15:42:43', '2024-09-19 15:45:36', 'c74d669c-a3d4-11e5-b60d-b870f43edd03', 150, '开发配置', 'iTdos', b'0', '[]', '{\""ParamData\"":{},\""KeysAddVisible\"":false,\""KeysAddVModel\"":\""\"",\""Sql\"":\""\"",\""EnableSearch\"":false,\""NumberTextStep\"":1,\""NumberTextPrecision\"":0,\""NumberText\"":0,\""NumberTextMath\"":\""\"",\""NumberTextBtn\"":true,\""NumberTextBtnPosition\"":\""right\"",\""Textarea\"":{\""DefaultRows\"":5},\""V8Code\"":\""\"",\""V8CodeBlur\"":\""\"",\""DividerPosition\"":\""left\"",\""Divider\"":{\""Icon\"":\""\""},\""DataSource\"":\""\"",\""DataSourceSqlRemote\"":false,\""DataSourceSqlRemoteLoading\"":false,\""DataSourceId\"":\""\"",\""TextShowPassword\"":false,\""TextIcon\"":\""\"",\""TextIconPosition\"":\""\"",\""TextApend\"":\""\"",\""TextApendPosition\"":\""\"",\""SelectLabel\"":\""\"",\""SelectSaveField\"":\""\"",\""SelectSaveFormat\"":\""Text\"",\""DateTimeType\"":\""date\"",\""TextAutocomplete\"":false,\""AutoNumberFixed\"":\""\"",\""AutoNumberLength\"":1,\""AutoNumberFields\"":[],\""AutoNumber\"":{\""DataRule\"":\""\"",\""CreateRule\"":\""\""},\""ImgUpload\"":{\""Limit\"":false,\""Multiple\"":false,\""Tips\"":\""\"",\""MaxCount\"":10,\""ShowFileList\"":false,\""Preview\"":true,\""MaxSize\"":10},\""FileUpload\"":{\""Limit\"":true,\""Multiple\"":true,\""Tips\"":\""\"",\""MaxCount\"":10,\""ShowFileList\"":false,\""MaxSize\"":10},\""Upload\"":{\""BeforeUploadV8\"":\""\"",\""GetPrivateFileBeforeServerV8\"":\""\"",\""GetPrivateFileAfterServerV8\"":\""\""},\""DevComponentName\"":\""\"",\""DevComponentPath\"":\""\"",\""TableChildTableId\"":\""\"",\""TableChildSysMenuId\"":\""\"",\""TableChildSysMenuName\"":\""\"",\""TableChildFkFieldName\"":\""\"",\""TableChildCallbackField\"":\""\"",\""TableChildRowClickV8\"":\""\"",\""TableChild\"":{\""Data\"":[],\""SearchAppend\"":{},\""LastTableId\"":\""\"",\""LastSysMenuId\"":\""\"",\""LastSysMenuName\"":\""\"",\""PrimaryTableFieldName\"":\""Id\"",\""DisablePagination\"":false,\""NoneDefaultHeight\"":false},\""JoinTable\"":{\""TableId\"":\""\"",\""ModuleName\"":\""\"",\""ModuleId\"":\""\"",\""Where\"":\""\""},\""JoinForm\"":{\""TableId\"":\""\"",\""TableName\"":\""\"",\""Id\"":\""\"",\""FormMode\"":\""\"",\""_SearchEqual\"":{}},\""MapCompany\"":\""Baidu\"",\""Button\"":{\""Type\"":\""primary\"",\""Loading\"":false,\""Icon\"":\""\"",\""Size\"":\""mini\"",\""PreviewCanClick\"":true},\""Autocomplete\"":{},\""Unique\"":{\""Type\"":\""Alone\""},\""OpenTable\"":{\""BtnName\"":\""\"",\""ShowDialog\"":false,\""MultipleSelect\"":false,\""SubmitV8\"":\""\"",\""BeforeOpenV8\"":\""\"",\""SearchAppend\"":{}},\""Department\"":{\""Multiple\"":false,\""Filterable\"":false,\""EmitPath\"":true},\""Cascader\"":{\""Lazy\"":false,\""Filterable\"":false,\""Value\"":\""\"",\""Label\"":\""\"",\""Children\"":\""\"",\""ParentField\"":\""\"",\""ParentFields\"":\""\"",\""Multiple\"":false,\""Disabled\"":\""\"",\""Leaf\"":\""\"",\""EmitPath\"":true},\""SelectTree\"":{\""Lazy\"":false,\""Filterable\"":false,\""Value\"":\""\"",\""Label\"":\""\"",\""Children\"":\""\"",\""ParentField\"":\""\"",\""ParentFields\"":\""\"",\""Multiple\"":false,\""Disabled\"":\""\"",\""Leaf\"":\""\""},\""CodeEditor\"":{\""Height\"":\""\""}}', NULL, 120, '', b'0', '[]', '', '', NULL, '', '', b'0', '', b'0', NULL, NULL, 1);
    INSERT INTO `diy_field` (`Id`, `TableId`, `Label`, `Name`, `NameConfirm`, `Type`, `Code`, `Component`, `Description`, `NotEmpty`, `Visible`, `Readonly`, `CreateTime`, `UpdateTime`, `UserId`, `Sort`, `Tab`, `OsClient`, `IsDeleted`, `Data`, `Config`, `FormWidth`, `TableWidth`, `DefaultValue`, `Unique`, `BindRole`, `V8TmpEngineTable`, `V8TmpEngineForm`, `Placeholder`, `Remark`, `DataAppend`, `InTableEdit`, `KeyupV8Code`, `IsLockField`, `Encrypt`, `UserName`, `AppVisible`) VALUES ('8f5422cf-a155-4426-8f4e-f4788dc68293', 'c8570fa6-c10f-4014-8cb4-4b046e7ba69c', '服务器端版本号', 'ServerVersion', b'1', 'varchar(50)', '', 'Text', '请勿手动修改，由Microi.Upgrade升级程序自动控制', b'0', b'1', b'1', '2024-09-19 15:42:13', '2024-09-19 15:45:33', 'c74d669c-a3d4-11e5-b60d-b870f43edd03', 100, '开发配置', 'iTdos', b'0', '[]', '{\""ParamData\"":{},\""KeysAddVisible\"":false,\""KeysAddVModel\"":\""\"",\""Sql\"":\""\"",\""EnableSearch\"":false,\""NumberTextStep\"":1,\""NumberTextPrecision\"":0,\""NumberText\"":0,\""NumberTextMath\"":\""\"",\""NumberTextBtn\"":true,\""NumberTextBtnPosition\"":\""right\"",\""Textarea\"":{\""DefaultRows\"":5},\""V8Code\"":\""\"",\""V8CodeBlur\"":\""\"",\""DividerPosition\"":\""left\"",\""Divider\"":{\""Icon\"":\""\""},\""DataSource\"":\""\"",\""DataSourceSqlRemote\"":false,\""DataSourceSqlRemoteLoading\"":false,\""DataSourceId\"":\""\"",\""TextShowPassword\"":false,\""TextIcon\"":\""\"",\""TextIconPosition\"":\""\"",\""TextApend\"":\""\"",\""TextApendPosition\"":\""\"",\""SelectLabel\"":\""\"",\""SelectSaveField\"":\""\"",\""SelectSaveFormat\"":\""Text\"",\""DateTimeType\"":\""date\"",\""TextAutocomplete\"":false,\""AutoNumberFixed\"":\""\"",\""AutoNumberLength\"":1,\""AutoNumberFields\"":[],\""AutoNumber\"":{\""DataRule\"":\""\"",\""CreateRule\"":\""\""},\""ImgUpload\"":{\""Limit\"":false,\""Multiple\"":false,\""Tips\"":\""\"",\""MaxCount\"":10,\""ShowFileList\"":false,\""Preview\"":true,\""MaxSize\"":10},\""FileUpload\"":{\""Limit\"":true,\""Multiple\"":true,\""Tips\"":\""\"",\""MaxCount\"":10,\""ShowFileList\"":false,\""MaxSize\"":10},\""Upload\"":{\""BeforeUploadV8\"":\""\"",\""GetPrivateFileBeforeServerV8\"":\""\"",\""GetPrivateFileAfterServerV8\"":\""\""},\""DevComponentName\"":\""\"",\""DevComponentPath\"":\""\"",\""TableChildTableId\"":\""\"",\""TableChildSysMenuId\"":\""\"",\""TableChildSysMenuName\"":\""\"",\""TableChildFkFieldName\"":\""\"",\""TableChildCallbackField\"":\""\"",\""TableChildRowClickV8\"":\""\"",\""TableChild\"":{\""Data\"":[],\""SearchAppend\"":{},\""LastTableId\"":\""\"",\""LastSysMenuId\"":\""\"",\""LastSysMenuName\"":\""\"",\""PrimaryTableFieldName\"":\""Id\"",\""DisablePagination\"":false,\""NoneDefaultHeight\"":false},\""JoinTable\"":{\""TableId\"":\""\"",\""ModuleName\"":\""\"",\""ModuleId\"":\""\"",\""Where\"":\""\""},\""JoinForm\"":{\""TableId\"":\""\"",\""TableName\"":\""\"",\""Id\"":\""\"",\""FormMode\"":\""\"",\""_SearchEqual\"":{}},\""MapCompany\"":\""Baidu\"",\""Button\"":{\""Type\"":\""primary\"",\""Loading\"":false,\""Icon\"":\""\"",\""Size\"":\""mini\"",\""PreviewCanClick\"":true},\""Autocomplete\"":{},\""Unique\"":{\""Type\"":\""Alone\""},\""OpenTable\"":{\""BtnName\"":\""\"",\""ShowDialog\"":false,\""MultipleSelect\"":false,\""SubmitV8\"":\""\"",\""BeforeOpenV8\"":\""\"",\""SearchAppend\"":{}},\""Department\"":{\""Multiple\"":false,\""Filterable\"":false,\""EmitPath\"":true},\""Cascader\"":{\""Lazy\"":false,\""Filterable\"":false,\""Value\"":\""\"",\""Label\"":\""\"",\""Children\"":\""\"",\""ParentField\"":\""\"",\""ParentFields\"":\""\"",\""Multiple\"":false,\""Disabled\"":\""\"",\""Leaf\"":\""\"",\""EmitPath\"":true},\""SelectTree\"":{\""Lazy\"":false,\""Filterable\"":false,\""Value\"":\""\"",\""Label\"":\""\"",\""Children\"":\""\"",\""ParentField\"":\""\"",\""ParentFields\"":\""\"",\""Multiple\"":false,\""Disabled\"":\""\"",\""Leaf\"":\""\""},\""CodeEditor\"":{\""Height\"":\""\""}}', NULL, 120, '', b'0', '[]', '', '', NULL, '', '', b'0', '', b'0', NULL, NULL, 1);
";
        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string OsClient)
        {
            var msgs = new List<string>();
            #region 新增字段 PrintSqlToPage
            try
            {
                var fieldParam = new DiyFieldParam()
                {
                    TableName = "sys_config",
                    Id = Ulid.NewUlid().ToString(),
                    TableId = "c8570fa6-c10f-4014-8cb4-4b046e7ba69c",
                    Label = "返回sql到前端",
                    Name = "PrintSqlToPage",//字段名
                    NameConfirm = 1,//是否已确认字段名
                    Type = "int",//字段类型
                    Component = "Switch",//控件
                    NotEmpty = 0,//是否必填
                    Visible = 1,//是否显示
                    Readonly = 0,//是否只读
                    Sort = 12,//排序
                    Tab = "开发配置",//分组
                    FormWidth = 12,//表单占宽：24、12、6、
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

            #region 新增字段 CaptchaConfig
            try
            {
                var fieldParam = new DiyFieldParam()
                {
                    TableName = "sys_config",
                    Id = Ulid.NewUlid().ToString(),
                    TableId = "c8570fa6-c10f-4014-8cb4-4b046e7ba69c",
                    Label = "验证码配置",
                    Name = "CaptchaConfig",//字段名
                    NameConfirm = 1,//是否已确认字段名
                    Type = "mediumtext",//字段类型
                    Component = "CodeEditor",//控件
                    NotEmpty = 0,//是否必填
                    Visible = 1,//是否显示
                    Readonly = 0,//是否只读
                    Sort = 3400,//排序
                    Tab = "开发配置",//分组
                    FormWidth = 24,//表单占宽：24、12、6、
                    TableWidth = 120,//表格占宽
                    Unique = 0,//是否唯一
                    BindRole = "[]",//绑定角色
                    Data = "[]",//数据源
                    Description = "",//说明
                    OsClient = OsClient,
                    UserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03",//创建人Id
                    IsDeleted = 0,//是否已删除
                    Config = "{\"ParamData\":{},\"KeysAddVisible\":false,\"KeysAddVModel\":\"\",\"Sql\":\"\",\"EnableSearch\":false,\"NumberTextStep\":1,\"NumberTextPrecision\":0,\"NumberText\":0,\"NumberTextMath\":\"\",\"NumberTextBtn\":true,\"NumberTextBtnPosition\":\"right\",\"Textarea\":{\"DefaultRows\":5},\"V8Code\":\"\",\"V8CodeBlur\":\"\",\"DividerPosition\":\"left\",\"Divider\":{\"Icon\":\"\"},\"DataSource\":\"\",\"DataSourceSqlRemote\":false,\"DataSourceSqlRemoteLoading\":false,\"DataSourceId\":\"\",\"TextShowPassword\":false,\"TextIcon\":\"\",\"TextIconPosition\":\"\",\"TextApend\":\"\",\"TextApendPosition\":\"\",\"SelectLabel\":\"\",\"SelectSaveField\":\"\",\"SelectSaveFormat\":\"Text\",\"DateTimeType\":\"date\",\"TextAutocomplete\":false,\"AutoNumberFixed\":\"\",\"AutoNumberLength\":1,\"AutoNumberFields\":[],\"AutoNumber\":{\"DataRule\":\"\",\"CreateRule\":\"\"},\"ImgUpload\":{\"Limit\":false,\"Multiple\":false,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"Preview\":true,\"MaxSize\":10},\"FileUpload\":{\"Limit\":true,\"Multiple\":true,\"Tips\":\"\",\"MaxCount\":10,\"ShowFileList\":false,\"MaxSize\":10},\"Upload\":{\"BeforeUploadV8\":\"\",\"GetPrivateFileBeforeServerV8\":\"\",\"GetPrivateFileAfterServerV8\":\"\"},\"DevComponentName\":\"\",\"DevComponentPath\":\"\",\"TableChildTableId\":\"\",\"TableChildSysMenuId\":\"\",\"TableChildSysMenuName\":\"\",\"TableChildFkFieldName\":\"\",\"TableChildCallbackField\":\"\",\"TableChildRowClickV8\":\"\",\"TableChild\":{\"Data\":[],\"SearchAppend\":{},\"LastTableId\":\"\",\"LastSysMenuId\":\"\",\"LastSysMenuName\":\"\",\"PrimaryTableFieldName\":\"Id\",\"DisablePagination\":false,\"NoneDefaultHeight\":false},\"JoinTable\":{\"TableId\":\"\",\"ModuleName\":\"\",\"ModuleId\":\"\",\"Where\":\"\"},\"JoinForm\":{\"TableId\":\"\",\"TableName\":\"\",\"Id\":\"\",\"FormMode\":\"\",\"_SearchEqual\":{}},\"MapCompany\":\"Baidu\",\"Button\":{\"Type\":\"primary\",\"Loading\":false,\"Icon\":\"\",\"Size\":\"mini\",\"PreviewCanClick\":true},\"Autocomplete\":{},\"Unique\":{\"Type\":\"Alone\"},\"OpenTable\":{\"BtnName\":\"\",\"ShowDialog\":false,\"MultipleSelect\":false,\"SubmitV8\":\"\",\"BeforeOpenV8\":\"\",\"SearchAppend\":{}},\"Department\":{\"Multiple\":false,\"Filterable\":false,\"EmitPath\":true},\"Cascader\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\",\"EmitPath\":true},\"SelectTree\":{\"Lazy\":false,\"Filterable\":false,\"Value\":\"\",\"Label\":\"\",\"Children\":\"\",\"ParentField\":\"\",\"ParentFields\":\"\",\"Multiple\":false,\"Disabled\":\"\",\"Leaf\":\"\"},\"CodeEditor\":{\"Height\":\"200\"}}",//字段属性配置
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

