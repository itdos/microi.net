/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-tenant-admin-credential-repair
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-tenant-admin-credential-repair | Version: v1.0.0 */
var p = V8.Param || {};
if (!V8.CurrentUser || Number(V8.CurrentUser.Level || 0) < 9999) {
  return { Code: 1002, Msg: '仅主租户超级管理员可以修复历史管理员密码编码。' };
}
var key = String(p.TenantKey || '').trim();
if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(key)) return { Code: 0, Msg: '租户标识无效。' };
var apply = p.Apply === true;
if (apply && p.Confirm !== 'REPAIR-ENCODING:' + key) return { Code: 0, Msg: '请先检查，再提交精确的密码编码修复确认。' };
if (typeof V8.Method.RepairOwnedTenantAdminPasswordEncoding !== 'function') return { Code: 0, Msg: '当前后端尚不支持历史编码修复，请先更新平台。' };
var result = V8.Method.RepairOwnedTenantAdminPasswordEncoding({ TenantKey: key, Apply: apply });
if (apply && result && result.Code === 1 && result.Data && result.Data.Changed) {
  try { V8.Method.AddSysLog({ Type: '安全审计', Title: '修复自助租户历史密码编码', Content: key + ': V8 -> DES; 密码保持不变', Level: 2 }); } catch (auditError) {}
}
return result;
