export const getApiUrl = (url) => {
  var apiUrl = {
    getSysMenuStep: '/api/SysMenu/getSysMenuStep', // 获取系统菜单步骤
    GetDiyField: '/api/diyfield/getDiyField', // 获取自定义表单字段
    getDiyFieldByDiyTables: '/api/diyfield/getDiyFieldByDiyTables', // 获取自定义表格字段
    GetNewGuid: '/api/diytable/NewGuid', // 获取新的Guid
    getFieldsData: '/api/diytable/getFieldsData', // 过滤下拉选择 获取数据
    GetSysDeptStep: '/api/SysDept/GetSysDeptStep', // 过滤下拉选择 获取组织机构数据
    getDiyFieldSqlData: '/api/diytable/getDiyFieldSqlData', // 过滤下拉选择 远程搜索数据
    TokenLogin: '/api/SysUser/TokenLogin', // 登录
    StartWork: '/api/WorkFlow/StartWork', // 启动工作流
    uptsysuser: '/api/SysUser/uptsysuser', // 修改用户信息
    getWFWork: '/api/WorkFlow/getWFWork', // 获取工作流信息
    getWFFlow: '/api/WorkFlow/getWFFlow', // 获取工作流步骤信息
    getWFNodeModel: '/api/WorkFlow/getWFNodeModel', // 获取工作流节点模型
    sendWorkFlow: '/api/WorkFlow/sendWork', // 发送工作流
    getWFHistory: '/api/WorkFlow/getWFHistory', // 获取工作流历史
    ReportEngine: '/api/DataSourceEngine/Run', // 运行报表引擎
    getStartWFNode: '/api/WorkFlow/getStartWFNode', // 获取开始节点信息
    handOverWork: '/api/WorkFlow/handOverWork', // 移交工作流
    recallWork: '/api/WorkFlow/recallWork', // 撤回工作流
  }
  return apiUrl[url]
};