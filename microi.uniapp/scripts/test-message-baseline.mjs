import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pageSource = readFileSync(new URL('../src/pages/message/index.vue', import.meta.url), 'utf8')
const businessRuntimeSource = readFileSync(new URL('../src/platform/business-runtime.js', import.meta.url), 'utf8')
const requestSource = readFileSync(new URL('../src/utils/request.js', import.meta.url), 'utf8')
const sdkSource = readFileSync(new URL('../src/utils/microi.v8.js', import.meta.url), 'utf8')
const profileSource = readFileSync(new URL('../src/pages/profile/index.vue', import.meta.url), 'utf8')
const profileAdapterSource = readFileSync(new URL('../src/platform/form-record-adapter.js', import.meta.url), 'utf8')
const passwordSource = readFileSync(new URL('../src/pages/native/password.vue', import.meta.url), 'utf8')

test('聚合 App 消息页不依赖租户专属通讯录接口', () => {
	assert.doesNotMatch(pageSource, /get-sys-user-roles/)
	assert.doesNotMatch(pageSource, /get-sysUser-list/)
	assert.doesNotMatch(pageSource, /GetSysUserPublicInfo/)
	assert.doesNotMatch(pageSource, /loadRoles|loadContacts|roleLoading|personTypes/)
})

test('消息页保留登录态、实时消息和本地搜索能力', () => {
	assert.match(pageSource, /checkLoginAndLoad\(\)/)
	assert.match(pageSource, /connectSignalR\(\)/)
	assert.match(pageSource, /ReceiveSendLastContacts/)
	assert.match(pageSource, /filteredMessageList/)
})

test('没有跨租户目录契约时不展示不可用的通讯录和发起聊天入口', () => {
	assert.doesNotMatch(pageSource, /activeTab === 'contacts'/)
	assert.doesNotMatch(pageSource, /showNewChat/)
	assert.doesNotMatch(pageSource, /message\.contacts|message\.startChat|message\.selectContact/)
})

test('首页菜单使用 Microi 平台托管接口而不是已下线的 SysMenu Controller', () => {
	assert.match(businessRuntimeSource, /\/apiengine\/platform-sys-menu\?Action=GetSysMenuStep/)
	assert.doesNotMatch(businessRuntimeSource, /\/api\/SysMenu\/GetSysMenuStep/)
})

test('业务列表使用 Microi 平台托管接口而不是已下线的 ModuleEngine Controller', () => {
	assert.match(businessRuntimeSource, /\/apiengine\/platform-module-data/)
	assert.match(businessRuntimeSource, /Action:\s*'GetTableData'/)
	assert.doesNotMatch(businessRuntimeSource, /\/api\/ModuleEngine\/GetTableData/)
})

test('个人资料和密码使用平台托管用户接口', () => {
	const userSource = [requestSource, profileAdapterSource, passwordSource].join('\n')
	assert.match(userSource, /\/apiengine\/platform-current-user/)
	assert.match(userSource, /\/apiengine\/platform-sys-user-admin\?Action=UptSysUser/)
	assert.match(userSource, /\/apiengine\/platform-sys-user-admin\?Action=RefreshLoginUser/)
	assert.doesNotMatch(userSource, /\/api\/SysUser\/(?:GetCurrentUser|UptSysUser|uptsysuser|RefreshLoginUser)/)
})

test('头像私有文件签发绑定用户资源并走平台托管接口', () => {
	assert.match(profileSource, /resourceKind:\s*'UserAvatar'[\s\S]{0,100}resourceId:\s*this\.currentUser\.Id/)
	assert.match(sdkSource, /apiEngineRun\('platform-private-file-url'/)
	assert.match(sdkSource, /if \(!hasPrivateFileAccessContext\(options\)\) return ''/)
	assert.doesNotMatch(sdkSource, /requestPrivate\('GetPrivateFileUrl'\)|requestPrivate\('MallFileUrl'\)/)
})
