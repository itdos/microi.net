function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function responseUser(value) {
  const record = asRecord(value)
  return asRecord(record.CurrentUser).Id ? asRecord(record.CurrentUser) : record
}

function sameUser(left, right) {
  const leftId = String(asRecord(left).Id || '').trim().toLowerCase()
  const rightId = String(asRecord(right).Id || '').trim().toLowerCase()
  return !!leftId && leftId === rightId
}

// 资料保存接口可能只返回 { OsClient, UserId, Changed } 操作摘要，不能用它覆盖登录用户。
// 仅当响应明确携带同一个用户的 Id 时才把它视为完整/部分用户投影；否则使用已提交字段合并缓存。
export function mergeCurrentUserAfterProfileSave(cachedUser, submittedProfile, responseData) {
  const cached = asRecord(cachedUser)
  const submitted = { ...asRecord(submittedProfile) }
  delete submitted.ContentSecurityLoginCode

  const returned = responseUser(responseData)
  const verifiedReturned = sameUser(cached, returned) ? returned : {}
  const merged = {
    ...cached,
    ...submitted,
    ...verifiedReturned
  }

  // 登录用户 Id 是当前会话锚点，资料接口不能通过响应或提交值替换它。
  if (cached.Id) merged.Id = cached.Id
  return merged
}

export default {
  mergeCurrentUserAfterProfileSave
}
