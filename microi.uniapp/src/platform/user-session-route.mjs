export const USER_SESSION_ENGINE_PATH = '/apiengine/platform-sys-user-session'

export function buildUserSessionPayload(action, data = {}) {
  const normalizedAction = String(action || '').trim()
  if (!normalizedAction) throw new Error('用户会话动作不能为空')
  return { ...(data || {}), Action: normalizedAction }
}

export async function requestUserSession({ action, data = {}, requestPrimary, requestLegacy }) {
  if (typeof requestPrimary !== 'function' || typeof requestLegacy !== 'function') {
    throw new Error('用户会话请求缺少主路由或兼容路由适配器')
  }

  try {
    return await requestPrimary(USER_SESSION_ENGINE_PATH, buildUserSessionPayload(action, data))
  } catch (primaryError) {
    // 存量 Microi 服务可能尚未安装统一会话引擎；只有传输/HTTP 异常才回退旧 Controller。
    // 业务失败（例如密码错误）是 HTTP 200 响应，不会进入这里，也不会重复提交登录。
    return requestLegacy(`/api/SysUser/${action}`, data, primaryError)
  }
}
