import {
  getUser,
  post,
  setUser,
  V8
} from '@/utils/request.js'
import {
  createNativeFormDefinition,
  isNativeFieldMultiple,
  loadNativeFormDefinition,
  saveNativeForm,
  validateNativeForm
} from '@/platform/native-form.js'

const DEFAULT_ADAPTER = 'form-engine'
const CURRENT_USER_ADAPTER = 'current-user'
const CURRENT_USER_EDITABLE_FIELDS = new Set([
  'avatar',
  'name',
  'realname',
  'email',
  'sex',
  'remark'
])

function ensureSuccess(result, fallbackMessage) {
  if (!result || Number(result.Code) !== 1) {
    throw new Error((result && result.Msg) || fallbackMessage)
  }
  return result
}

function normalizeValue(field, value) {
  if (field.component === 'Switch') return value ? 1 : 0
  if (isNativeFieldMultiple(field) && Array.isArray(value)) return JSON.stringify(value)
  return value
}

async function attachWeChatContentSecurityLoginCode(payload) {
  let isWeChatMiniProgram = false
  // #ifdef MP-WEIXIN
  isWeChatMiniProgram = true
  // #endif
  if (!isWeChatMiniProgram) return
  if (typeof uni === 'undefined' || typeof uni.login !== 'function') {
    throw new Error('内容安全检测暂不可用，请稍后重试。')
  }
  const result = await new Promise((resolve, reject) => {
    uni.login({ provider: 'weixin', success: resolve, fail: reject })
  })
  if (!result || !result.code) throw new Error('内容安全检测暂不可用，请稍后重试。')
  payload.ContentSecurityLoginCode = result.code
}

async function loadFormEngineRecord(context) {
  if (!context.rowId) return null
  return V8.FormEngine.GetFormData(context.tableName, {
    Id: context.rowId,
    ...(context.menuId ? { _SysMenuId: context.menuId } : {}),
    ...(context.tableChildAuth ? { _TableChildAuth: context.tableChildAuth } : {})
  })
}

async function saveFormEngineRecord(context) {
  return saveNativeForm(
    context.tableName,
    context.rowId,
    context.form,
    context.fields,
    context.extraValues,
    {
      menuId: context.menuId,
      tableChildAuth: context.tableChildAuth
    }
  )
}

async function loadFormEngineDefinition(context) {
  return loadNativeFormDefinition(
    context.tableName,
    context.refresh === true,
    {
      menuId: context.menuId,
      moduleEngineKey: context.moduleEngineKey,
      tableChildAuth: context.tableChildAuth
    }
  )
}

function currentUserDefinition() {
  return createNativeFormDefinition({
    Id: 'capability:current-user',
    Name: 'Sys_User',
    Description: '员工信息'
  }, [
    // 个人资料页暂时隐藏头像；保留字段定义，后续需要时可直接恢复。
    // {
    //   Id: 'current-user-avatar',
    //   Name: 'Avatar',
    //   Label: '头像',
    //   Component: 'ImgUpload',
    //   Visible: 1,
    //   AppVisible: 1,
    //   Sort: 10,
    //   Config: JSON.stringify({ ImgUpload: { Multiple: false, Limit: 1 } })
    // },
    {
      Id: 'current-user-no',
      Name: 'No',
      Label: '编号',
      Component: 'Text',
      Visible: 1,
      AppVisible: 1,
      Readonly: 1,
      Sort: 20
    },
    {
      Id: 'current-user-account',
      Name: 'Account',
      Label: '登录账号',
      Component: 'Text',
      Visible: 1,
      AppVisible: 1,
      Readonly: 1,
      Sort: 30
    },
    {
      Id: 'current-user-name',
      Name: 'Name',
      Label: '姓名',
      Component: 'Text',
      Visible: 1,
      AppVisible: 1,
      NotEmpty: 1,
      Sort: 40
    },
    {
      Id: 'current-user-email',
      Name: 'Email',
      Label: '邮箱',
      Component: 'Text',
      Visible: 1,
      AppVisible: 1,
      Sort: 50
    },
    {
      Id: 'current-user-phone',
      Name: 'Phone',
      Label: '手机号',
      Component: 'Text',
      Visible: 1,
      AppVisible: 1,
      Readonly: 1,
      Sort: 60
    },
    {
      Id: 'current-user-sex',
      Name: 'Sex',
      Label: '性别',
      Component: 'Radio',
      Visible: 1,
      AppVisible: 1,
      Sort: 70,
      Data: '男,女,保密'
    },
    {
      Id: 'current-user-remark',
      Name: 'Remark',
      Label: '个人简介',
      Component: 'Textarea',
      Visible: 1,
      AppVisible: 1,
      Sort: 80
    }
  ])
}

async function loadCurrentUserDefinition() {
  return currentUserDefinition()
}

async function loadCurrentUserRecord() {
  const result = ensureSuccess(
    await post('/api/SysUser/GetCurrentUser', {}),
    '当前用户资料加载失败'
  )
  const user = result.Data || {}
  setUser(user)
  return { ...result, Data: user }
}

async function saveCurrentUserRecord(context) {
  const validationError = validateNativeForm(context.form, context.fields)
  if (validationError) throw new Error(validationError)

  const currentUser = getUser() || {}
  if (!currentUser.Id) throw new Error('登录身份已失效，请重新登录')

  const payload = { Id: currentUser.Id }
  ;(context.fields || []).forEach((field) => {
    const name = String(field.Name || '')
    if (!name || !field.editable || context.form[name] === undefined) return
    if (!CURRENT_USER_EDITABLE_FIELDS.has(name.toLowerCase())) return
    payload[name] = normalizeValue(field, context.form[name])
  })
  await attachWeChatContentSecurityLoginCode(payload)

  const updateResult = ensureSuccess(
    await post('/api/SysUser/UptSysUser', payload),
    '个人资料保存失败'
  )
  const refreshResult = ensureSuccess(
    await post('/api/SysUser/RefreshLoginUser', {}),
    '个人资料已保存，但登录信息刷新失败'
  )
  const refreshedUser = refreshResult.Data || updateResult.Data || {
    ...currentUser,
    ...payload
  }
  setUser(refreshedUser)
  return {
    ...updateResult,
    Data: refreshedUser
  }
}

const adapters = {
  [DEFAULT_ADAPTER]: {
    definition: loadFormEngineDefinition,
    load: loadFormEngineRecord,
    save: saveFormEngineRecord
  },
  [CURRENT_USER_ADAPTER]: {
    definition: loadCurrentUserDefinition,
    load: loadCurrentUserRecord,
    save: saveCurrentUserRecord
  }
}

export function normalizeFormRecordAdapter(value) {
  const name = String(value || DEFAULT_ADAPTER).trim().toLowerCase()
  return adapters[name] ? name : DEFAULT_ADAPTER
}

export function isFormEngineRecordAdapter(value) {
  return normalizeFormRecordAdapter(value) === DEFAULT_ADAPTER
}

export async function loadNativeFormRecordDefinition(context = {}) {
  const adapter = adapters[normalizeFormRecordAdapter(context.adapter)]
  return adapter.definition(context)
}

export async function loadNativeFormRecord(context = {}) {
  const adapter = adapters[normalizeFormRecordAdapter(context.adapter)]
  return adapter.load(context)
}

export async function saveNativeFormRecord(context = {}) {
  const adapter = adapters[normalizeFormRecordAdapter(context.adapter)]
  return adapter.save(context)
}

export default {
  normalizeFormRecordAdapter,
  isFormEngineRecordAdapter,
  loadNativeFormRecordDefinition,
  loadNativeFormRecord,
  saveNativeFormRecord
}
