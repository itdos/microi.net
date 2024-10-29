import { request } from '@/config/http'
import Qs from 'qs'
const header = { 'content-type': 'application/x-www-form-urlencoded'}
const microiRequest = {
	// 获取配置
	async GetSysConfig(data: any) : Promise<any> {
		try {
			const response = await request('/api/diyTable/getSysConfig', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 登陆
	async login(data: any) : Promise<any> {
		try {
			const response = await request('/api/SysUser/login', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 获取短信验证码
	async sendMsg(data: any) : Promise<any> {
		try {
			const response = await request('/api/sms/send', 'POST', data);
			return response;
		} catch (error) {
			return error
		}
	},
	// 修改密码
	async uptsysuser(data: any) : Promise<any> {
		try {
			const response = await request('/api/SysUser/uptsysuser', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 首页-我的工作
	async GetWFWork(data: { WorkType: string; _Keyword: string; }) : Promise<any> {
		try {
			const response = await request('/api/WorkFlow/GetWFWork', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	async GetWFFlow(data: { WorkType: string; _Keyword: string; }) : Promise<any> {
		try {
			const response = await request('/api/WorkFlow/GetWFFlow', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 获取退回节点数据
	async GetReturnNode(data: { NodeId: string; }) : Promise<any> {
		try {
			const response = await request('/api/WorkFlow/GetWFNodeModel', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 处理提交工作流程
	async SendWork(data: { NodeId: string; }) : Promise<any> {
		try {
			const response = await request('/api/WorkFlow/SendWork', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 工作台
	async getSysMenuStep(data: { OsClient: string; }) : Promise<any> {
		try {
			const response = await request('/api/SysMenu/getSysMenuStep', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 通讯录
	async getSysUser(data: any) : Promise<any> {
		try {
			const response = await request('/api/SysUser/getSysUser', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 部门机构
	async GetSysDeptStep(data: any) : Promise<any> {
		try {
			const response = await request('/api/SysDept/GetSysDeptStep', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 我的工作
	async GetFormData(data: any) : Promise<any> {
		try {
			const response = await request('/api/FormEngine/GetFormData', 'POST', data);
			return response;
		} catch (error) {
			return error
		}
	},
	// 我的工作-获取流程记录
	async GetWFHistory(data: any) : Promise<any> {
		try {
			const response = await request('/api/WorkFlow/GetWFHistory', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 表单设计
	async GetDiyField(data: any) : Promise<any> {
		try {
			const response = await request('/api/DiyField/GetDiyField', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 获取列表内容
	async GetDiyTableRow(data: any) : Promise<any> {
		try {
			const response = await request('/api/diytable/GetDiyTableRow', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 获取表单NewGuid
	async GetNewGuid(data: any) : Promise<any> {
		try {
			const response = await request('/api/diytable/NewGuid', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 获取表单数据 
	async GetDiyTableModel(data: any) : Promise<any> {
		try {
			const response = await request('/api/diytable/GetDiyTableModel', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 获取表单数据
	async GetDiyTableRowModel(data: any) : Promise<any> {
		try {
			const response = await request('/api/diytable/GetDiyTableRowModel', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	// 过滤下拉选择 获取数据
	async GgetFieldsData(data: any) : Promise<any> {
		try {
			const response = await request('/api/diytable/getFieldsData', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
	//  新增表单
	async AddFormData(data: any) : Promise<any> {
		try {
			const response = await request('/api/FormEngine/AddFormData', 'POST', data);
			return response;
		} catch (error) {
			return error
		}
	},
	//  编辑表单
	async UptFormData(data: any) : Promise<any> {
		try {
			const response = await request('/api/FormEngine/UptFormData', 'POST', data);
			return response;
		} catch (error) {
			return error
		}
	},
	//  删除表单
	async DelFormData(data: any) : Promise<any> {
		try {
			const response = await request('/api/FormEngine/DelFormData', 'POST', data);
			return response;
		} catch (error) {
			return error
		}
	},
	async GetTableData(data: any) : Promise<any> {
		try {
			const response = await request('/api/FormEngine/GetTableData', 'POST', data);
			return response;
		} catch (error) {
			return error
		}
	},
	// 如果是表内新增 子表新增 
	async AddFormDataBatch(data: any) : Promise<any> {
		try {
			const response = await request('/api/FormEngine/AddFormDataBatch', 'POST', data);
			return response;
		} catch (error) {
			return error
		}
	},
	// 如果token 自动登录
	async TokenLogin(data: any) : Promise<any> {
		try {
			const response = await request('/api/SysUser/TokenLogin', 'POST', Qs.stringify(data), header);
			return response;
		} catch (error) {
			return error
		}
	},
}
export default microiRequest