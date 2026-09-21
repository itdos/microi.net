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
import { readChildDraft, writeChildDraft } from '@/platform/child-form-drafts.mjs'
import { mergeCurrentUserAfterProfileSave } from '@/platform/current-user-profile.mjs'

const DEFAULT_ADAPTER = 'form-engine'
const CURRENT_USER_ADAPTER = 'current-user'
// 个人资料是 current-user 能力投影，不绑定某个租户的 diy_field.Id。
// 字段名 Avatar 是保存接口契约；头像取址使用 UserAvatar + 当前用户 Id 完成授权。
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

function normalizeCurrentUserValue(field, value) {
  const name = String(field && field.Name || '').toLowerCase()
  if (name === 'avatar' || name === 'publicavatar') return V8.extractUploadPath(value)
  return normalizeValue(field, value)
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
  if (context.draftRelation) return { Code: 1, Data: readChildDraft(context.draftRelation, context.tableName, context.rowId) }
  return V8.FormEngine.GetFormData(context.tableName, {
    Id: context.rowId,
    ...(context.menuId ? { _SysMenuId: context.menuId } : {}),
    ...(context.tableChildAuth ? { _TableChildAuth: context.tableChildAuth } : {})
  })
}

async function saveFormEngineRecord(context) {
  if (context.draftRelation) {
    const error = validateNativeForm(context.form, context.fields)
    if (error) throw new Error(error)
    const values = { ...context.extraValues }
    context.fields.forEach(field => {
      if (field.editable && context.form[field.Name] !== undefined) {
        values[field.Name] = normalizeValue(field, context.form[field.Name])
      }
    })
    return { Code: 1, Data: writeChildDraft(context.draftRelation, context.tableName, context.rowId, values) }
  }
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
    {
      Name: 'Avatar',
      Label: '头像',
      Component: 'ImgUpload',
      Visible: 1,
      AppVisible: 1,
      Sort: 10,
      Config: JSON.stringify({
        ImgUpload: {
          Limit: true,
          Multiple: false,
          MaxCount: 1,
          ShowFileList: false,
          Preview: true,
          MaxSize: 10,
          SaveFullPath: false
        }
      })
    },
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
    await post('/apiengine/platform-current-user', {}),
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

  const profileChanges = {}
  ;(context.fields || []).forEach((field) => {
    const name = String(field.Name || '')
    if (!name || !field.editable || context.form[name] === undefined) return
    if (!CURRENT_USER_EDITABLE_FIELDS.has(name.toLowerCase())) return
    profileChanges[name] = normalizeCurrentUserValue(field, context.form[name])
  })
  const requestPayload = { ...profileChanges }
  await attachWeChatContentSecurityLoginCode(requestPayload)

  const updateResult = ensureSuccess(
    await post('/apiengine/platform-user-update-profile', requestPayload),
    '个人资料保存失败'
  )
  const refreshedUser = mergeCurrentUserAfterProfileSave(
    currentUser,
    profileChanges,
    updateResult.Data
  )
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
