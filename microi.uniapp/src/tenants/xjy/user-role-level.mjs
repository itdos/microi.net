// 对齐员工信息 RoleIds 的后台值变更规则，不在小程序执行任意前端 V8。
export function userRoleLevel(payload = {}) {
  if (payload.cleared) return 0
  // value 包含完整选择；raw 可能仅包含本次已加载的选项，不能用它替代选择集合。
  const values = Array.isArray(payload.value) ? payload.value : (Array.isArray(payload.raw) ? payload.raw : [])
  const rows = Array.isArray(payload.raw) ? payload.raw : []
  return values.reduce((maximum, value) => {
    const row = value && typeof value === 'object'
      ? value
      : rows.find((item) => String(item.Id) === String(value))
    const level = Number(row?.Level)
    return Number.isFinite(level) && level > maximum ? level : maximum
  }, 0)
}
