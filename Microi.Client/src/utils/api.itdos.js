import { DiyCommon } from "@/utils/diy.common";

/*!
 * 统一api地址
 * 所有接口返回Json格式：
 * {
 *      Code, 接口执行是否成功，为1时一般会返回Data数据，不为1时一般会返回Msg错误提示
 *      Msg:'', 错误提示或其它提示
 *      Data: object, 返回的数据，任何类型
 * }
 * 以下@return仅说明返回的Data
 */
var joinUrl = "";

var DiyApi = {
    FormEngine: {
        GetFormData: "/api/FormEngine/GetFormData",
        GetFormDataAnonymous: "/api/FormEngine/GetFormDataAnonymous",
        GetTableData: "/api/FormEngine/GetTableData",
        GetTableTree: "/api/FormEngine/GetTableDataTree",
        AddFormData: "/api/FormEngine/AddFormData",
        AddFormDataBatch: "/api/FormEngine/AddFormDataBatch",
        UptFormData: "/api/FormEngine/UptFormData",
        UptFormDataBatch: "/api/FormEngine/UptFormDataBatch",
        UptFormDataByWhere: "/api/FormEngine/UptFormDataByWhere",
        DelFormData: "/api/FormEngine/DelFormData",
        DelFormDataBatch: "/api/FormEngine/DelFormDataBatch",
        DelFormDataByWhere: "/api/FormEngine/DelFormDataByWhere"
    },
    GetSysUser: function () {
        return "/apiengine/platform-sys-user-admin?Action=GetSysUser";
    },
    // GetSysUserFk: function() {
    //   return '/api/sysuserfk/getSysUserfk' //' + DiyCommon.GetApiClientUrl() + '
    // },
    UptSysUser: function () {
        return "/apiengine/platform-sys-user-admin?Action=UptSysUser";
    },
    AddSysUser: function () {
        return "/apiengine/platform-sys-user-admin?Action=AddSysUser";
    },
    DelSysUser: function () {
        return "/apiengine/platform-sys-user-admin?Action=DelSysUser";
    },

    GetSysRole: function () {
        return "/apiengine/platform-sys-role?Action=GetSysRole";
    },
    GetSysRoleModel: function () {
        return "/apiengine/platform-sys-role?Action=GetSysRoleModel";
    },

    /**
     * 用户登录
     * @param  {String} Account 请求后获得的数据
     * @param  {String} Pwd 密码
     * @return {Object}
     */
    // Login: '/api/' + joinUrl + 'SysUser/Login',
    DiyLogin: "/api/SysUser/diylogin",
    Login: function () {
        return "/api/SysUser/Login"; //' + DiyCommon.GetApiClientUrl() + '
    },
    TokenLogin: function () {
        return "/api/SysUser/tokenlogin"; //' + DiyCommon.GetApiClientUrl() + '
    },
    // Login: function (data) {
    //     data = qs.stringify(data)
    //     return request({
    //         url: '/api/' + joinUrl + 'SysUser/Login',
    //         method: 'post',
    //         data
    //     });
    // },
    // GetCurrentUser: '/api/' + joinUrl + 'SysUser/GetCurrentUser',
    GetCurrentUser: function () {
        return "/apiengine/platform-current-user";
    },

    /**
     * 基础数据
     */
    // GetSysBaseData: '/api/' + joinUrl + 'SysBaseData/GetSysBaseData',
    GetSysBaseData: function () {
        return "/apiengine/platform-sys-base-data?Action=GetSysBaseData";
    },

    GetBizWechat: "/api/BizWechat/GetBizWechat",

    GetDateTimeNow: "/api/os/GetDateTimeNow",
    /**
     * 获取桌面图标
     * @param  null
     * @return {Object} [{}]
     */
    // GetDesktop: '/api/' + DiyCommon.GetApiClientUrl() + 'os/GetDesktop',
    GetDesktop: function () {
        return "/api/" + DiyCommon.GetApiClientUrl() + "os/GetDesktop";
    },

    /**
     * 注销登录
     * @return {Object}
     */
    // Logout: '/api/' + joinUrl + 'SysUser/Logout',
    Logout: function () {
        // 登录、TokenLogin、GetCurrentUser 和后端控制器都使用统一的非租户前缀路由；
        // 租户身份由 Authorization/OsClient 解析。拼入 qiqiang 等 OsClient 会产生 404。
        return "/api/SysUser/Logout";
    },
    /**
     * 获取微信菜单
     */
    GetWxMenu: "/Menu/GetMenu",
    /**
     * 设置微信菜单
     */
    CreateWxMenu: "/Menu/CreateMenuFromJson",
    // UploadPreview: '/api/Upload', // '/api/os/UploadPreview',
    UploadPreview: function () {
        return DiyCommon.GetApiBase() + "/api/HDFS/Upload";
    },
    // 这里之所以要加上apiBase是因为一般此上传接口为填写在上传的 :action=""属性里，而此属性不会调用main.js的Post接口自动添加apiBase
    // / Multiple：是否多文件
    // / Limit：是否上传至需要有权限才能访问的文件夹
    // / Preview：是否压缩
    // Upload: '/api/Upload',
    Upload: function () {
        return DiyCommon.GetApiBase() + "/api/HDFS/Upload";
    },

    /**
     * 新增菜单
     */
    // AddSysMenu: '/api/' + joinUrl + 'SysMenu/AddSysMenu',
    AddSysMenu: function () {
        return "/apiengine/platform-sys-menu?Action=AddSysMenu";
    },
    /**
     * 删除菜单
     */
    // DelSysMenu: '/api/' + joinUrl + 'SysMenu/DelSysMenu',
    DelSysMenu: function () {
        return "/apiengine/platform-sys-menu?Action=DelSysMenu";
    },
    /**
     * 修改菜单
     */
    // UptSysMenu: '/api/' + joinUrl + 'SysMenu/UptSysMenu',
    UptSysMenu: function () {
        return "/apiengine/platform-sys-menu?Action=UptSysMenu";
    },
    /**
     * 获取菜单tree
     */
    // GetSysMenuStep: '/api/' + joinUrl + 'SysMenu/GetSysMenuStep',
    GetSysMenuStep: function () {
        return "/apiengine/platform-sys-menu?Action=GetSysMenuStep";
    },
    // 角色权限字段使用固定窄投影、授权版本缓存和线性组树。
    GetRolePermissionTree: function () {
        return "/apiengine/platform-sys-menu?Action=GetRolePermissionTree";
    },
    GetSysMenuModel: "/api/FormEngine/GetSysMenuModel",
    GetLeftRightPageConfig: "/api/FormEngine/GetLeftRightPageConfig",

    /**
     * 获取微信编辑器模板
     * @param  {String} Type 类别
     * @return {String}
     */
    GetWxEditorTpl: "/api/os/GetWxEditorTpl",

    /**
     * 删除角色
     * @param  {Id} 角色Id
     */
    // DelSysRole: '/api/' + joinUrl + 'SysRole/DelSysRole',
    DelSysRole: function () {
        return "/apiengine/platform-sys-role?Action=DelSysRole";
    },

    /**
     * 修改角色
     * @param  {Id} 角色Id
     * @param  {Name} 角色名称，可选
     */
    // UptSysRole: '/api/' + joinUrl + 'SysRole/UptSysRole',
    UptSysRole: function () {
        return "/apiengine/platform-sys-role?Action=UptSysRole";
    },

    /**
     * 新增角色
     * @param  {Name} 角色名称
     */
    // AddSysRole: '/api/' + joinUrl + 'SysRole/AddSysRole',
    AddSysRole: function () {
        return "/apiengine/platform-sys-role?Action=AddSysRole";
    },

    /**
     * 基础数据
     */
    // AddSysBaseData: '/api/' + joinUrl + 'SysBaseData/AddSysBaseData',
    AddSysBaseData: function () {
        return "/apiengine/platform-sys-base-data?Action=AddSysBaseData";
    },
    /**
     * 基础数据
     */
    // DelSysBaseData: '/api/' + joinUrl + 'SysBaseData/DelSysBaseData',
    DelSysBaseData: function () {
        return "/apiengine/platform-sys-base-data?Action=DelSysBaseData";
    },
    /**
     * 基础数据
     */
    // UptSysBaseData: '/api/' + joinUrl + 'SysBaseData/UptSysBaseData',
    UptSysBaseData: function () {
        return "/apiengine/platform-sys-base-data?Action=UptSysBaseData";
    },
    // /**
    //  * 基础数据
    //  */
    // GetSysBaseData: '/api/SysBaseData/getSysBaseData',
    /**
     * 基础数据
     */
    // GetSysBaseDataStep: '/api/' + joinUrl + 'SysBaseData/GetSysBaseDataStep',
    GetSysBaseDataStep: function () {
        return "/apiengine/platform-sys-base-data?Action=GetSysBaseDataStep";
    },

    /**
     * 富文本数据
     */
    // AddSysRichText: '/api/' + joinUrl + 'SysRichText/AddSysRichText',
    AddSysRichText: function () {
        return "/api/SysRichText/AddSysRichText"; //' + DiyCommon.GetApiClientUrl() + '
    },
    /**
     * 富文本数据
     */
    // DelSysRichText: '/api/' + joinUrl + 'SysRichText/DelSysRichText',
    DelSysRichText: function () {
        return "/api/SysRichText/DelSysRichText"; //' + DiyCommon.GetApiClientUrl() + '
    },
    /**
     * 富文本数据
     */
    // UptSysRichText: '/api/' + joinUrl + 'SysRichText/UptSysRichText',
    UptSysRichText: function () {
        return "/api/SysRichText/UptSysRichText"; //' + DiyCommon.GetApiClientUrl() + '
    },
    /**
     * 富文本数据
     */
    // GetSysRichText: '/api/' + joinUrl + 'SysRichText/GetSysRichText',
    GetSysRichText: function () {
        return "/api/SysRichText/GetSysRichText"; //' + DiyCommon.GetApiClientUrl() + '
    },
    /**
     * 富文本数据
     */
    // GetSysRichTextStep: '/api/' + joinUrl + 'SysRichText/GetSysRichTextStep',
    GetSysRichTextStep: function () {
        return "/api/SysRichText/GetSysRichTextStep"; //' + DiyCommon.GetApiClientUrl() + '
    },

    GetSysDept: "/apiengine/platform-sys-dept?Action=GetSysDept",
    GetSysDeptStep: "/apiengine/platform-sys-dept?Action=GetSysDeptStep",
    AddSysDept: "/apiengine/platform-sys-dept?Action=AddSysDept",
    UptSysDept: "/apiengine/platform-sys-dept?Action=UptSysDept",
    DelSysDept: "/apiengine/platform-sys-dept?Action=DelSysDept",

    LoadNotDiyTable: "/api/FormEngine/LoadNotDiyTable",
    GetNotDiyTable: "/api/FormEngine/GetNotDiyTable",
    GetDiyTable: "/api/FormEngine/GetDiyTableModel",
    AddDiyTable: "/api/FormEngine/AddDiyTable",
    DelDiyTable: "/api/FormEngine/DelDiyTable",
    UptDiyTable: "/api/FormEngine/UptDiyTable",
    GetDiyTableModel: "/api/FormEngine/GetDiyTableModel",
    AddDiyTableRow: "/api/FormEngine/AddFormData",
    AddDiyTableRowBatch: "/api/FormEngine/AddDiyTableRowBatch",
    AddFormDataBatch: "/api/FormEngine/AddFormDataBatch",
    DelDiyTableRowBatch: "/api/FormEngine/DelDiyTableRowBatch",
    DelDiyDataListByWhere: "/api/FormEngine/DelDiyDataListByWhere",
    UptDiyTableRowBatch: "/api/FormEngine/UptDiyTableRowBatch",
    UptFormDataBatch: "/api/FormEngine/UptFormDataBatch",
    DelFormDataBatch: "/api/FormEngine/DelFormDataBatch",
    GetDiyTableRow: "/api/FormEngine/GetTableData",
    GetDiyTableRowTree: "/api/FormEngine/GetDiyTableRowTree",
    GetTableData: "/api/FormEngine/GetTableData",
    GetTableDataTree: "/api/FormEngine/GetTableDataTree",
    GetDiyTableRowModel: "/api/FormEngine/GetFormData",
    DelDiyTableRow: "/api/FormEngine/DelFormData",
    UptDiyTableRow: "/api/FormEngine/UptFormData",
    SaveBatch: "/api/FormEngine/SaveBatch",
    UptDiyDataListByWhere: "/api/FormEngine/UptDiyDataListByWhere",
    GetDiyFieldSqlData: "/api/FormEngine/GetDiyFieldSqlData", // sql数据源来源
    GetDataSourceEngine: "/apiengine/platform-data-source-run", // 官方托管数据源接口引擎
    GetApiEngineUrl: function (apiEngineKey) {
        var key = String(apiEngineKey || "").trim();
        return key ? "/apiengine/" + encodeURIComponent(key) : "";
    },
    GetFieldsData: "/api/FormEngine/GetFieldsData",
    GetImportDiyTableRowStep: "/api/FormEngine/GetImportDiyTableRowStep",

    GetDiyField: "/api/FormEngine/GetDiyFieldList",
    GetDiyFieldList: "/api/FormEngine/GetDiyFieldList",
    GetDiyFieldByDiyTables: "/api/FormEngine/GetDiyFieldByDiyTables",
    AddDiyField: "/api/FormEngine/AddDiyField",
    DelDiyField: "/api/FormEngine/DelDiyField",
    UptDiyField: "/api/FormEngine/UptDiyField",
    GetDiyFieldModel: "/api/FormEngine/GetDiyFieldModel",
    UptDiyFieldList: "/api/FormEngine/UptDiyFieldList",

    GetSysRoleLimitByMenuId: "/apiengine/platform-sys-menu?Action=GetSysRoleLimitByMenuId" //获取角色菜单权限（李赛赛）
};

export { DiyApi };
