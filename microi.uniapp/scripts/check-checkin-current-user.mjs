import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const request = read('src/utils/request.js')
const checkin = read('src/pages/native/checkin.vue')
const tenantForm = read('src/tenants/xjy/form.js')
const tenantBusiness = read('src/tenants/xjy/business.js')
const businessRuntime = read('src/platform/business-runtime.js')
const assertions = [
  [request.includes("post('/api/SysUser/GetCurrentUser', {})"), '缓存缺少完整用户时未刷新当前用户'],
  [request.includes('!refreshed.Id || !(refreshed.Name || refreshed.Account)'), '当前用户响应未校验 Id 和姓名/账号'],
  [checkin.includes('await getVerifiedCurrentUser()'), '拜访打卡提交前未校验当前用户'],
  [tenantForm.includes('await verifiedCurrentUserOption()'), '人员定位初始化/提交前未校验当前用户'],
  [tenantForm.includes("throw new Error('打卡人获取失败，请重新登录后再试')"), '人员定位未阻止空打卡人提交'],
  [/attendanceRecords:\s*native\(\{[\s\S]*?requireAuthorizedMenu:\s*true/.test(tenantBusiness), 'attendance records must require an authorized menu'],
  [businessRuntime.includes("moduleConfig.requireAuthorizedMenu === true && !menuId"), 'protected lists must fail closed without an authorized menu'],
  [businessRuntime.includes("payload._SysMenuId = menuId"), 'protected list requests must send the authorized menu id']
]
const failures = assertions.filter(([passed]) => !passed).map(([, message]) => message)
if (failures.length) {
  failures.forEach((message) => console.error(`[checkin-current-user] FAIL: ${message}`))
  process.exit(1)
}
console.log('[checkin-current-user] PASS: check-in user is verified and blank submissions are blocked')
