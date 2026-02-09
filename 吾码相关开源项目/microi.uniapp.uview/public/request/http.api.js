// 此处第二个参数vm，就是我们在页面使用的this，你可以通过vm获取vuex等操作，更多内容详见uView对拦截器的介绍部分：
const install = (Vue, vm) => {

	let apiList = [
		{ name:'GetLogin', url:'/api/SysUser/Login'},
		{ name:'GetSysMenuStep', url:'/api/SysMenu/GetSysMenuStep'},
		{ name:'GetSysUser', url:'/api/SysUser/GetSysUser'},
		{ name:'UptSysUser', url:'/api/SysUser/UptSysUser'},
		{ name:'GetSysMenuModel', url:'/api/SysMenu/GetSysMenuModel'},
		{ name:'GetDiyTableRow', url:'/api/diytable/GetDiyTableRow'},
		{ name:'GetDiyField', url:'/api/DiyField/GetDiyField'},
		{ name:'GetDiyTableModel', url:'/api/diytable/GetDiyTableModel'},
		{ name:'GetDiyTableRowModel', url:'/api/diytable/GetDiyTableRowModel'},
		
		
		//表单设计
		{ name:'GetTableData', url:'/api/FormEngine/GetTableData'},
		{ name:'GetDiyFieldSqlData', url:'/api/diytable/GetDiyFieldSqlData'},
		{ name:'AddFormData', url:'/api/FormEngine/AddFormData'},
		{ name:'GetFormData', url:'/api/FormEngine/GetFormData'},
		{ name:'UptFormData', url:'/api/FormEngine/UptFormData'},
		{ name:'DelFormData', url:'/api/FormEngine/DelFormData'},
		
		//首页待办
		{ name:'GetWFWork', url:'/api/WorkFlow/GetWFWork'},
		//上传图片
		{ name:'Upload', url:'/api/HDFS/Upload'},
		
		//部门机构
		{ name:'GetSysDeptStep', url:'/api/SysDept/GetSysDeptStep'},
		//组织机构
		{ name:'GetSysDept', url:'/api/SysDept/GetSysDept'},
		
		//盘点
		{ name:'ApiEngineRun', url:'/api/ApiEngine/Run'},
		
		
		//自定义接口
		{ name:'PanDian', url:'/zongxun/pan_dian/start'},
		
	]
	

	let _api = {};
	(() => {
		apiList.forEach(item => {
			_api[item.name] = (params = {}) => vm.$u[item.method?item.method:`post`](params.id?`${item.url}/${params.id}`:item.url, params);
		})
		return _api;
	})()
	
	
	// 将各个定义的接口名称，统一放进对象挂载到vm.$u.api(因为vm就是this，也即this.$u.api)下
	vm.$u.api = _api;
}

export default {
	install
}