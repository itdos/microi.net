export const resourceEnginePath = '/apiengine/mci-file-resource-manager'
export const resourceActions = ['Capabilities', 'Policy', 'List', 'Register', 'Update', 'Evaluate']
// Metadata-only pending writes survive tab unmounts, scoped to the authenticated session in memory.
export const pendingResourceWrites = new Map()
export function resourceSessionIdentity(context) {
  const token = String(context.token || '').replace(/^Bearer\s+/i, '')
  let session = ''
  try {
    const middle = token.split('.')[1]
    const payload = JSON.parse(atob(middle.replace(/-/g, '+').replace(/_/g, '/')))
    session = String(payload.MicroiSessionId || '')
  } catch { /* Older non-JWT sessions use the token only as an in-memory isolation key. */ }
  return JSON.stringify([context.apiBase, context.osClient, context.currentUser?.Id, session || token])
}

const messages = {
  PLATFORM_ADMIN_REQUIRED: '需要平台管理员权限，请使用有权限的当前租户账号。',
  RESOURCE_STORE_UNAVAILABLE: '资源目录尚不可用，请检查应用升级状态。',
  RESOURCE_CONFLICT: '目录已被其他操作更新，请刷新列表后重新编辑。',
  RESOURCE_VERSION_CONFLICT: '同一资源的版本已经变化，当前入口不能刷新版本，请保留原记录并核对发布清单。',
  RESOURCE_NOT_FOUND: '记录不存在或不属于当前租户，请刷新目录。',
  CURRENT_TENANT_PUBLIC_NAMESPACE_REQUIRED: '只能登记当前租户命名空间内的公开资源。',
  PUBLIC_BUILD_REQUIRED: '请选择当前租户公开编译产物的文件 Id。',
  INVALID_RESOURCE_NAME: '请填写 1–160 字的资源名称，不含控制字符。',
  INVALID_RESOURCE_ID: '文件 Id 格式不正确。',
  INVALID_CONTENT_HASH: 'SHA-256 必须为 64 位十六进制字符。',
  INVALID_NUMBER: '请填写有效的整数大小或目录版本。',
  INVALID_CONTENT_TYPE: '请填写有效的 MIME 类型。',
  INVALID_PUBLIC_OBJECT_KEY: '对象路径不能含域名、签名参数、百分号或目录跳转。',
  UNSUPPORTED_PUBLIC_RESOURCE_TYPE: '此文件类型不在公开资源目录的支持范围内。',
  PRIMARY_PUBLIC_BASE_MISSING: '当前租户尚未配置主文件服务器。',
  SOURCE_TENANT_MISMATCH: '资源不属于当前租户。',
  TENANT_MISMATCH: '会话租户发生变化，请刷新页面。',
  RESOURCE_READBACK_MISMATCH: '保存回读未能确认，请刷新目录核对结果。',
  UNSUPPORTED_RESOURCE_KIND: '请选择支持的资源类型。',
  RESPONSE_INVALID: '服务返回的数据不完整，请刷新重试。',
  CAPABILITY_UNSUPPORTED: '当前管理接口尚未提供此版本的资源目录，请先检查应用升级。',
  NETWORK_UNAVAILABLE: '读取失败，请检查连接后刷新重试。',
  WRITE_RESULT_UNKNOWN: '提交结果尚未确认。请先刷新目录核对，勿重复提交；已保留本次输入。',
  WRITE_READBACK_PENDING: '服务已确认保存，但目录回读失败。请刷新目录核对；不要重复提交。',
}
const blockerMessages = {
  BackupBaseMissing: '尚未配置备用文件服务器', InvalidBackupBase: '备用文件服务器地址无效',
  ThresholdMissingOrDisabled: '流量阈值未配置或已关闭', InvalidThreshold: '流量阈值无效', InvalidWindow: '统计窗口配置无效',
  ResourceDisabled: '此资源暂未纳入评估', PublicResourceRequired: '仅支持公开资源', SourceTenantMismatch: '资源租户归属不匹配',
  TrustedTrafficCollectorNotConnected: '可信流量采集尚未接通', VerifiedReplicaWorkerNotConnected: '副本复制与校验尚未接通',
  RuntimeResolverNotConnected: '运行时分流尚未接通',
}
// Server rejection classification is independent of display text. Unknown transport/local codes remain uncertain.
const definitiveWriteRejections = new Set([
  'PLATFORM_ADMIN_REQUIRED', 'RESOURCE_STORE_UNAVAILABLE', 'RESOURCE_CONFLICT', 'RESOURCE_VERSION_CONFLICT',
  'RESOURCE_NOT_FOUND', 'CURRENT_TENANT_PUBLIC_NAMESPACE_REQUIRED', 'PUBLIC_BUILD_REQUIRED', 'INVALID_RESOURCE_NAME',
  'INVALID_RESOURCE_ID', 'INVALID_CONTENT_HASH', 'INVALID_NUMBER', 'INVALID_CONTENT_TYPE', 'INVALID_PUBLIC_OBJECT_KEY',
  'UNSUPPORTED_PUBLIC_RESOURCE_TYPE', 'PRIMARY_PUBLIC_BASE_MISSING', 'SOURCE_TENANT_MISMATCH', 'TENANT_MISMATCH',
  'UNSUPPORTED_RESOURCE_KIND', 'REQUEST_TOO_LARGE', 'UNSUPPORTED_ARGUMENT', 'INVALID_FILE_SERVER_BASE',
  'INVALID_TRAFFIC_THRESHOLD', 'INVALID_RESOURCE', 'UNSUPPORTED_RESOURCE_ARGUMENT', 'UNSUPPORTED_SOURCE_PROVIDER',
  'APPLICATION_METADATA_MUST_BE_AUTHORITATIVE', 'INVALID_ENABLED', 'TENANT_REQUIRED', 'UNSUPPORTED_ACTION',
])
export const resourceError = code => messages[code] || '资源目录操作失败，请刷新并核对服务状态。'
export const blockerLabel = code => blockerMessages[code] || '存在未识别的校验条件，请核对服务版本。'
export function formatResourceBytes(value) {
  if (value === null || value === undefined || value === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0) return '未知'
  let number = Number(value), unit = 0
  while (number >= 1024 && unit < 4) { number /= 1024; unit++ }
  return `${number.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][unit]}`
}
function fail(code, uncertain = false) { const e = new Error(resourceError(code)); e.code = code; e.uncertain = uncertain; throw e }
function name(value) {
  const text = String(value ?? '').trim()
  if (!text || text.length > 160 || /[\u0000-\u001f\u007f]/.test(text)) fail('INVALID_RESOURCE_NAME')
  return text
}
function id(value) { const text = String(value ?? '').trim(); if (!/^[a-zA-Z0-9-]{1,36}$/.test(text)) fail('INVALID_RESOURCE_ID'); return text }
export function registrationRequest(form) {
  const Resource = { Kind: form.Kind, Name: name(form.Name) }
  if (form.Kind === 'ApplicationPublicBuild') Resource.SourceFileId = id(form.SourceFileId)
  else if (form.Kind === 'PlatformStatic') {
    Resource.ObjectKey = String(form.ObjectKey ?? '').trim()
    if (!Resource.ObjectKey || /[\\%?#:\s]/.test(Resource.ObjectKey) || Resource.ObjectKey.split('/').some(x => !x || x === '.' || x === '..')) fail('INVALID_PUBLIC_OBJECT_KEY')
    Resource.ContentHash = String(form.ContentHash ?? '').trim().toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(Resource.ContentHash)) fail('INVALID_CONTENT_HASH')
    Resource.Size = Number(form.Size)
    if (!Number.isSafeInteger(Resource.Size) || Resource.Size < 1) fail('INVALID_NUMBER')
    Resource.ContentType = String(form.ContentType ?? '').trim()
    if (Resource.ContentType.length > 128 || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:;\s*charset=[a-z0-9-]+)?$/i.test(Resource.ContentType)) fail('INVALID_CONTENT_TYPE')
  } else fail('UNSUPPORTED_RESOURCE_KIND')
  return { Action: 'Register', Resource }
}
export function updateRequest(row, form) {
  const ExpectedRowVersion = Number(row.RowVersion)
  if (!Number.isSafeInteger(ExpectedRowVersion) || ExpectedRowVersion < 1 || ExpectedRowVersion > 2147483646) fail('INVALID_NUMBER')
  return { Action: 'Update', Id: id(row.Id), ExpectedRowVersion, Name: name(form.Name), Enabled: form.Enabled === true }
}
export function directoryState() {
  return { loading: false, saving: false, loaded: false, capabilities: null, policy: null, rows: [], total: null, page: 1, pageSize: 20, evaluation: null, error: '', notice: '', writeUncertain: false }
}

// Only metadata actions are exposed. Evidence, routing URLs and secrets are never accepted from the editor.
export function createResourceDirectory(call, state = directoryState(), pendingWrites = new Map()) {
  let generation = 0, disposed = false, scope = 'default'
  const current = g => !disposed && generation === g
  async function request(payload, write = false) {
    let result
    try { result = await call(payload); if (typeof result === 'string') result = JSON.parse(result) }
    catch { fail(write ? 'WRITE_RESULT_UNKNOWN' : 'NETWORK_UNAVAILABLE', write) }
    if (!result || typeof result !== 'object' || !Number.isInteger(Number(result.Code))) fail(write ? 'WRITE_RESULT_UNKNOWN' : 'RESPONSE_INVALID', write)
    if (Number(result.Code) !== 1) {
      const code = String(result.Msg ?? '')
      // SDKs can wrap a lost HTTP response as Code=0. Only explicit backend rejection codes are definitive.
      if (write && !definitiveWriteRejections.has(code)) fail('WRITE_RESULT_UNKNOWN', true)
      fail(code)
    }
    if (!result.Data || typeof result.Data !== 'object') fail(write ? 'WRITE_RESULT_UNKNOWN' : 'RESPONSE_INVALID', write)
    return result.Data
  }
  function applyList(data) {
    if (!Array.isArray(data.Rows) || data.Rows.length > 100 || !Number.isInteger(data.PageIndex) || data.PageIndex < 1 || !Number.isInteger(data.PageSize) || data.PageSize < 1 || data.PageSize > 100) fail('RESPONSE_INVALID')
    state.rows = data.Rows
    state.total = data.TotalCount !== null && data.TotalCount !== undefined && Number.isSafeInteger(Number(data.TotalCount)) && Number(data.TotalCount) >= 0 ? Number(data.TotalCount) : null
    state.page = data.PageIndex; state.pageSize = data.PageSize; state.loaded = true
  }
  function matchesMutation(row, payload) {
    if (payload.Action === 'Update') return row.Id === payload.Id && Number(row.RowVersion) >= payload.ExpectedRowVersion + 1 && row.Name === payload.Name && Number(row.Enabled) === Number(payload.Enabled)
    const r = payload.Resource
    return row.Kind === r.Kind && (r.Kind === 'ApplicationPublicBuild'
      ? row.SourceFileId === r.SourceFileId
      : row.ObjectKey === r.ObjectKey && row.ContentHash === r.ContentHash && Number(row.Size) === r.Size && row.ContentType === r.ContentType)
  }
  function reconcilePending() {
    const pending = pendingWrites.get(scope)
    if (pending && state.rows.some(row => matchesMutation(row, pending))) {
      pendingWrites.delete(scope); state.notice = '上次提交已通过目录回读确认。'
    }
    state.writeUncertain = pendingWrites.has(scope)
    if (state.writeUncertain) state.error = '上次提交尚未在当前页确认，请继续翻页核对或稍后刷新。确认前暂停新的写入；不会自动重提。'
  }
  async function refresh(page = state.page) {
    if (state.loading || state.saving || disposed) return
    const g = generation; state.loading = true; state.error = ''; state.capabilities = null; state.evaluation = null
    try {
      const caps = await request({ Action: 'Capabilities' })
      if (!current(g)) return
      if (caps.Protocol !== 'ManagedFileResource/1' || caps.Scope !== 'CurrentTenantPublicMetadataOnly' || !resourceActions.every(x => caps.Actions?.includes(x)) || caps.NoStorageWrites !== true || caps.RuntimeRoutingEnabled !== false || caps.DependencyGroupsSupported !== false || caps.CrossTenantGovernanceSupported !== false) fail('CAPABILITY_UNSUPPORTED')
      const [policy, list] = await Promise.all([request({ Action: 'Policy' }), request({ Action: 'List', PageIndex: page, PageSize: state.pageSize })])
      if (!current(g)) return
      if (!Array.isArray(policy.Blockers)) fail('RESPONSE_INVALID')
      applyList(list); state.policy = policy; state.capabilities = caps; reconcilePending()
    } catch (e) { if (current(g)) { state.error = e.message; state.loaded = false; state.rows = []; state.total = null; state.policy = null } }
    finally { if (current(g)) state.loading = false }
  }
  async function save(payload) {
    if (state.saving || state.loading || state.writeUncertain || !state.capabilities || disposed) return false
    const g = generation; state.saving = true; state.error = ''; state.notice = ''; state.evaluation = null
    const writeScope = scope, mutation = JSON.parse(JSON.stringify(payload))
    pendingWrites.set(writeScope, mutation)
    const clearPending = () => { if (pendingWrites.get(writeScope) === mutation) pendingWrites.delete(writeScope) }
    let confirmed = false
    try {
      const result = await request(payload, true)
      if (!result.Resource?.Id || result.UseBackup !== false || !matchesMutation(result.Resource, payload)) fail('WRITE_RESULT_UNKNOWN', true)
      confirmed = true
      clearPending()
      if (!current(g)) return false
      state.notice = result.Replayed ? '相同资源已在目录中，未重复登记。' : '目录信息已保存。此操作不复制文件，也不启用分流。'
      const list = await request({ Action: 'List', PageIndex: 1, PageSize: state.pageSize })
      if (!current(g)) return false
      applyList(list); clearPending(); state.writeUncertain = false
      return true
    } catch (e) {
      const uncertain = confirmed || e.uncertain === true || e.code === 'RESOURCE_READBACK_MISMATCH'
      if (!uncertain) clearPending()
      if (current(g)) { state.writeUncertain = uncertain; state.error = confirmed ? resourceError('WRITE_READBACK_PENDING') : e.message }
      return false
    }
    finally { if (current(g)) state.saving = false }
  }
  async function register(form) { try { return await save(registrationRequest(form)) } catch (e) { state.error = e.message; return false } }
  async function update(row, form) { try { return await save(updateRequest(row, form)) } catch (e) { state.error = e.message; return false } }
  async function evaluate(row) {
    if (state.loading || state.saving || !state.capabilities || disposed) return
    const g = generation; state.loading = true; state.error = ''; state.evaluation = null
    try {
      const data = await request({ Action: 'Evaluate', Id: id(row.Id) })
      if (!current(g)) return
      if (data.ResourceId !== row.Id || data.SourceRevision !== row.SourceRevision || !Array.isArray(data.Blockers) || data.UseBackup !== false) fail('RESPONSE_INVALID')
      state.evaluation = data
    } catch (e) { if (current(g)) state.error = e.message }
    finally { if (current(g)) state.loading = false }
  }
  function reset(nextScope = 'default') { generation++; scope = nextScope; Object.assign(state, directoryState(), { writeUncertain: pendingWrites.has(scope) }) }
  return { state, refresh, register, update, evaluate, reset, dispose() { disposed = true; generation++ } }
}
