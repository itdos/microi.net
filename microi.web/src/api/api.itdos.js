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
        return "/api/SysUser/getSysUser"; //' + DiyCommon.GetApiClientUrl() + '
    },
    // GetSysUserFk: function() {
    //   return '/api/sysuserfk/getSysUserfk' //' + DiyCommon.GetApiClientUrl() + '
    // },
    UptSysUser: function () {
        return "/api/SysUser/uptSysUser"; //' + DiyCommon.GetApiClientUrl() + '
    },
    AddSysUser: function () {
        return "/api/SysUser/addSysUser"; //' + DiyCommon.GetApiClientUrl() + '
    },
    DelSysUser: function () {
        return "/api/SysUser/delSysUser"; //' + DiyCommon.GetApiClientUrl() + '
    },

    GetSysRole: function () {
        return "/api/sysrole/getSysRole"; //' + DiyCommon.GetApiClientUrl() + '
    },
    GetSysRoleModel: function () {
        return "/api/sysrole/getSysRoleModel"; //' + DiyCommon.GetApiClientUrl() + '
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
        return "/api/SysUser/login"; //' + DiyCommon.GetApiClientUrl() + '
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
        return "/api/SysUser/getCurrentUser"; //' + DiyCommon.GetApiClientUrl() + '
    },

    /**
     * 基础数据
     */
    // GetSysBaseData: '/api/' + joinUrl + 'SysBaseData/GetSysBaseData',
    GetSysBaseData: function () {
        return "/api/SysBaseData/getSysBaseData"; //' + DiyCommon.GetApiClientUrl() + '
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
        return "/api/" + DiyCommon.GetApiClientUrl() + "SysUser/Logout";
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
        return "/api/SysMenu/addSysMenu";
        return "/api/" + DiyCommon.GetApiClientUrl() + "SysMenu/AddSysMenu";
    },
    /**
     * 删除菜单
     */
    // DelSysMenu: '/api/' + joinUrl + 'SysMenu/DelSysMenu',
    DelSysMenu: function () {
        return "/api/SysMenu/delSysMenu";
        return "/api/" + DiyCommon.GetApiClientUrl() + "SysMenu/DelSysMenu";
    },
    /**
     * 修改菜单
     */
    // UptSysMenu: '/api/' + joinUrl + 'SysMenu/UptSysMenu',
    UptSysMenu: function () {
        return "/api/SysMenu/uptSysMenu";
        return "/api/" + DiyCommon.GetApiClientUrl() + "SysMenu/UptSysMenu";
    },
    /**
     * 获取菜单tree
     */
    // GetSysMenuStep: '/api/' + joinUrl + 'SysMenu/GetSysMenuStep',
    GetSysMenuStep: function () {
        return "/api/SysMenu/getSysMenuStep";
        return "/api/" + DiyCommon.GetApiClientUrl() + "SysMenu/GetSysMenuStep";
    },
    GetSysMenuModel : "/api/FormEngine/GetSysMenu",

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
        return "/api/SysRole/delSysRole"; //' + DiyCommon.GetApiClientUrl() + '
    },

    /**
     * 修改角色
     * @param  {Id} 角色Id
     * @param  {Name} 角色名称，可选
     */
    // UptSysRole: '/api/' + joinUrl + 'SysRole/UptSysRole',
    UptSysRole: function () {
        return "/api/SysRole/UptSysRole"; //' + DiyCommon.GetApiClientUrl() + '
    },

    /**
     * 新增角色
     * @param  {Name} 角色名称
     */
    // AddSysRole: '/api/' + joinUrl + 'SysRole/AddSysRole',
    AddSysRole: function () {
        return "/api/SysRole/AddSysRole"; //' + DiyCommon.GetApiClientUrl() + '
    },

    /**
     * 基础数据
     */
    // AddSysBaseData: '/api/' + joinUrl + 'SysBaseData/AddSysBaseData',
    AddSysBaseData: function () {
        return "/api/SysBaseData/addSysBaseData"; //' + DiyCommon.GetApiClientUrl() + '
    },
    /**
     * 基础数据
     */
    // DelSysBaseData: '/api/' + joinUrl + 'SysBaseData/DelSysBaseData',
    DelSysBaseData: function () {
        return "/api/SysBaseData/delSysBaseData"; //' + DiyCommon.GetApiClientUrl() + '
    },
    /**
     * 基础数据
     */
    // UptSysBaseData: '/api/' + joinUrl + 'SysBaseData/UptSysBaseData',
    UptSysBaseData: function () {
        return "/api/SysBaseData/uptSysBaseData"; //' + DiyCommon.GetApiClientUrl() + '
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
        return "/api/SysBaseData/getSysBaseDataStep"; //' + DiyCommon.GetApiClientUrl() + '
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

    GetSysDept: "/api/SysDept/getSysDept",
    GetSysDeptStep: "/api/SysDept/getSysDeptStep",
    AddSysDept: "/api/SysDept/addSysDept",
    UptSysDept: "/api/SysDept/uptSysDept",
    DelSysDept: "/api/SysDept/delSysDept",

    LoadNotDiyTable: "/api/diytable/loadNotDiyTable",
    GetNotDiyTable: "/api/diytable/getNotDiyTable",
    GetDiyTable: "/api/diytable/getDiyTable",
    AddDiyTable: "/api/diytable/addDiyTable",
    DelDiyTable: "/api/diytable/delDiyTable",
    UptDiyTable: "/api/diytable/uptDiyTable",
    GetDiyTableModel: "/api/FormEngine/GetDiyTable",
    AddDiyTableRow: "/api/FormEngine/AddFormData",
    AddDiyTableRowBatch: "/api/diytable/addDiyTableRowBatch",
    AddFormDataBatch: "/api/FormEngine/AddFormDataBatch",
    DelDiyTableRowBatch: "/api/diytable/delDiyTableRowBatch",
    DelDiyDataListByWhere: "/api/diytable/delDiyDataListByWhere",
    UptDiyTableRowBatch: "/api/diytable/uptDiyTableRowBatch",
    UptFormDataBatch: "/api/FormEngine/UptFormDataBatch",
    DelFormDataBatch: "/api/FormEngine/DelFormDataBatch",
    GetDiyTableRow: "/api/FormEngine/GetTableData",
    GetDiyTableRowTree: "/api/diytable/getDiyTableRowTree",
    GetTableDataTree: "/api/FormEngine/GetTableDataTree",
    GetDiyTableRowModel: "/api/FormEngine/GetFormData",
    DelDiyTableRow: "/api/FormEngine/DelFormData",
    UptDiyTableRow: "/api/FormEngine/UptFormData",
    UptDiyDataListByWhere: "/api/diytable/uptDiyDataListByWhere",
    GetDiyFieldSqlData: "/api/diytable/getDiyFieldSqlData", // sql数据源来源
    GetDataSourceEngine: "/api/DataSourceEngine/Run", // 数据源引擎来源
    ApiEngineRun: "/api/ApiEngine/Run", // 数据源引擎来源
    GetFieldsData: "/api/diytable/getFieldsData",
    GetImportDiyTableRowStep: "/api/diytable/getImportDiyTableRowStep",

    GetDiyField: "/api/diyfield/getDiyField",
    GetDiyFieldByDiyTables: "/api/diyfield/getDiyFieldByDiyTables",
    AddDiyField: "/api/diyfield/addDiyField",
    DelDiyField: "/api/diyfield/delDiyField",
    UptDiyField: "/api/diyfield/uptDiyField",
    GetDiyFieldModel: "/api/diyfield/getDiyFieldModel",
    UptDiyFieldList: "/api/diyfield/uptDiyFieldList",

    GetSysRoleLimitByMenuId: "/api/SysMenu/GetSysRoleLimitByMenuId" //获取角色菜单权限（李赛赛）
};

export { DiyApi };
