import assert from 'node:assert/strict'
import test from 'node:test'

import {
	buildContactRequest,
	extractRoleOptions,
	normalizeContact,
	normalizeRoleOptions
} from '../src/pages/message/contact-role-filter.mjs'

test('角色数据源兼容 Microi 常见的 Id/Name 与 Key/Value 结构', () => {
	assert.deepEqual(normalizeRoleOptions([
		{ Id: 'role-1', Name: '销售经理' },
		{ Key: 'role-2', Value: '客服' },
		{ id: 'role-3', label: '售后师傅' },
		{ Id: 'role-1', Name: '重复项' }
	]), [
		{ id: 'role-1', label: '销售经理' },
		{ id: 'role-2', label: '客服' },
		{ id: 'role-3', label: '售后师傅' }
	])
})

test('GetFieldsData 响应能够提取角色选项', () => {
	assert.deepEqual(extractRoleOptions({
		Data: [{ Result: { Data: [{ Id: 'role-1', Name: '管理员' }] } }]
	}), [{ id: 'role-1', label: '管理员' }])
})

test('未选择角色时继续使用当前公共通讯录接口', () => {
	assert.deepEqual(buildContactRequest({
		pageIndex: 1,
		pageSize: 20,
		keyword: ' 张三 ',
		roleNames: []
	}), {
		url: '/api/SysUser/GetSysUserPublicInfo',
		data: { State: 1, _PageIndex: 1, _PageSize: 20, _Keyword: '张三' }
	})
})

test('选择角色时恢复老版 RoleNames 接口筛选链路', () => {
	assert.deepEqual(buildContactRequest({
		pageIndex: 2,
		pageSize: 20,
		keyword: '',
		roleNames: ['客服', '售后师傅']
	}), {
		url: '/apiengine/get-sysUser-list',
		data: {
			_PageIndex: 2,
			_PageSize: 20,
			Keyword: '',
			RoleNames: ['客服', '售后师傅']
		}
	})
})

test('角色筛选接口的 DeptName 能映射到当前页面字段', () => {
	assert.deepEqual(normalizeContact({ Id: 'user-1', Name: '张三', DeptName: '客服部' }), {
		Id: 'user-1',
		Name: '张三',
		DeptName: '客服部',
		DepartmentName: '客服部'
	})
})
