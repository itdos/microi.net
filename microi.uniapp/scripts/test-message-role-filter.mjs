import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
	CONTACT_ROLE_API,
	CONTACT_USER_API,
	buildContactRequest,
	extractRoleOptions,
	normalizeContact,
	normalizeRoleOptions
} from '../src/pages/message/contact-role-filter.mjs'

test('角色数据兼容 Microi 常见的 Id/Name 与 Key/Value 结构', () => {
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

test('租户角色接口响应能够直接提取角色选项', () => {
	assert.equal(CONTACT_ROLE_API, '/apiengine/get-sys-user-roles')
	assert.deepEqual(extractRoleOptions({
		Code: 1,
		Data: [{ Id: 'role-1', Name: '管理员', Level: 100 }]
	}), [{ id: 'role-1', label: '管理员' }])
})

test('未选择角色时也通过租户隔离的通讯录接口加载人员', () => {
	assert.deepEqual(buildContactRequest({
		pageIndex: 1,
		pageSize: 20,
		keyword: ' 张三 ',
		roleIds: [],
		roleNames: []
	}), {
		url: CONTACT_USER_API,
		data: {
			_PageIndex: 1,
			_PageSize: 20,
			Keyword: '张三',
			RoleIds: [],
			RoleNames: []
		}
	})
})

test('选择角色时同时传稳定角色 ID 和名称兼容参数', () => {
	assert.deepEqual(buildContactRequest({
		pageIndex: 2,
		pageSize: 20,
		keyword: '',
		roleIds: ['role-2', 'role-3'],
		roleNames: ['客服', '售后师傅']
	}), {
		url: '/apiengine/get-sysUser-list',
		data: {
			_PageIndex: 2,
			_PageSize: 20,
			Keyword: '',
			RoleIds: ['role-2', 'role-3'],
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

test('角色下拉最多展示六行，超出后在 scroll-view 内滚动', () => {
	const pageSource = readFileSync(new URL('../src/pages/message/index.vue', import.meta.url), 'utf8')
	assert.match(pageSource, /class="role-options-scroll"[\s\S]*scroll-y/)
	assert.match(pageSource, /Math\.min\(Math\.max\(this\.personTypes\.length, 1\), 6\)/)
	assert.match(pageSource, /max-height:\s*432rpx/)
	assert.doesNotMatch(pageSource, /\/api\/FormEngine\/GetFieldsData/)
})
