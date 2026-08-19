export const PROPOSAL_TABLE = 'diy_kehufaxx'
export const PROPOSAL_INSTALLATION_TABLE = 'diy_anzhuang_dw'
export const PROPOSAL_INSTALLATION_BATCH_ENGINE = 'xjy_batch_update_proposal_installation_points'

export const PROPOSAL_INSTALLATION_FIELDS = {
  place: 'AnzhuangCS',
  deviceModel: 'ShebeiXH',
  deviceModelId: 'ShebeiXHID',
  deviceName: 'ShebeiMC',
  deviceQuantity: 'ShebeiSL',
  people: 'Renshu'
}

const COPY_EXCLUDED_COMPONENTS = new Set([
  'Divider', 'CollapseGroup', 'Tabs', 'Alert', 'StaticText', 'Html',
  'TableChild', 'JoinForm', 'JoinTable', 'OpenTable', 'Button'
])
const COPY_EXCLUDED_FIELDS = new Set([
  'id', 'createtime', 'updatetime', 'createuserid', 'updateuserid',
  'userid', 'username', 'osclient', 'isdeleted'
])
const BATCH_EXCLUDED_FIELDS = new Set([
  ...COPY_EXCLUDED_FIELDS,
  'anzhuangdianweiid'
])
const BATCH_MANAGED_READONLY_FIELDS = new Set([
  PROPOSAL_INSTALLATION_FIELDS.deviceName.toLowerCase()
])

export function isProposalInstallationQuickContext(parentTableName, childTableName) {
  return String(parentTableName || '').toLowerCase() === PROPOSAL_TABLE &&
    String(childTableName || '').toLowerCase() === PROPOSAL_INSTALLATION_TABLE
}

export function createProposalInstallationId(now = Date.now, random = Math.random) {
  let seed = Number(now()) || Date.now()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = (seed + random() * 16) % 16 | 0
    seed = Math.floor(seed / 16)
    return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16)
  })
}

export function proposalInstallationDraft(id = createProposalInstallationId()) {
  return {
    Id: id,
    [PROPOSAL_INSTALLATION_FIELDS.place]: '',
    [PROPOSAL_INSTALLATION_FIELDS.deviceModel]: '',
    [PROPOSAL_INSTALLATION_FIELDS.deviceModelId]: '',
    [PROPOSAL_INSTALLATION_FIELDS.deviceName]: '',
    [PROPOSAL_INSTALLATION_FIELDS.deviceQuantity]: 1,
    [PROPOSAL_INSTALLATION_FIELDS.people]: ''
  }
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = row && row[key]
    if (value !== undefined && value !== null && String(value).trim()) return value
  }
  return ''
}

export function proposalInstallationDeviceValues(selection = {}) {
  const raw = selection.raw && typeof selection.raw === 'object' ? selection.raw : {}
  if (selection.cleared) {
    return {
      [PROPOSAL_INSTALLATION_FIELDS.deviceModel]: '',
      [PROPOSAL_INSTALLATION_FIELDS.deviceModelId]: '',
      [PROPOSAL_INSTALLATION_FIELDS.deviceName]: ''
    }
  }
  return {
    [PROPOSAL_INSTALLATION_FIELDS.deviceModel]: selection.value ?? '',
    [PROPOSAL_INSTALLATION_FIELDS.deviceModelId]: firstValue(raw, ['Id', 'ID', 'id']),
    [PROPOSAL_INSTALLATION_FIELDS.deviceName]: firstValue(raw, [
      'ShangpinMC', 'ShebeiMC', 'ProductName', 'Name', 'name', 'Label', 'label'
    ])
  }
}

export function proposalInstallationDeviceBatchValues(selection = {}) {
  const base = proposalInstallationDeviceValues(selection)
  if (selection.cleared) {
    return {
      ...base,
      ShebeiDJ: '',
      ShebeiDJZL: '',
      GenghuanLXJG: ''
    }
  }
  const raw = selection.raw && typeof selection.raw === 'object' ? selection.raw : {}
  return {
    ...base,
    ShebeiDJ: firstValue(raw, ['Xianjia', 'ShebeiDJ', 'BuyoutPrice', 'Price']),
    ShebeiDJZL: firstValue(raw, ['ZulinXJ', 'ShebeiDJZL', 'RentalPrice']),
    GenghuanLXJG: firstValue(raw, ['GenghuanLXJG', 'FilterPrice'])
  }
}

export function isProposalInstallationBatchField(field = {}) {
  const name = String(field.Name || '')
  const component = String(field.component || field.Component || '')
  const type = String(field.Type || '').trim()
  const visible = field.visible !== undefined
    ? field.visible !== false
    : Number(field.AppVisible ?? field.Visible ?? 1) !== 0
  const editable = field.editable !== undefined
    ? field.editable !== false
    : Number(field.Readonly ?? field.ReadOnly ?? 0) !== 1
  const managedReadonly = BATCH_MANAGED_READONLY_FIELDS.has(name.toLowerCase())
  return Boolean(name && type && visible && (editable || managedReadonly)) &&
    !BATCH_EXCLUDED_FIELDS.has(name.toLowerCase()) &&
    !COPY_EXCLUDED_COMPONENTS.has(component) &&
    Number(field.IsVirtual || 0) !== 1 &&
    Number(field.Encrypt || 0) !== 1
}

export function proposalInstallationBatchFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .filter(isProposalInstallationBatchField)
    .sort((left, right) => Number(left.Sort || 0) - Number(right.Sort || 0))
}

export function proposalInstallationBatchPatch(form = {}, enabled = {}, dependencies = {}) {
  const result = {}
  Object.keys(enabled || {}).forEach((name) => {
    if (enabled[name] === true) result[name] = form[name]
  })
  Object.keys(dependencies || {}).forEach((name) => {
    if (dependencies[name] !== undefined) result[name] = dependencies[name]
  })
  return result
}

export function proposalInstallationWriteValues(row = {}, fieldNames = PROPOSAL_INSTALLATION_FIELDS) {
  return {
    [fieldNames.place]: String(row[fieldNames.place] || '').trim(),
    [fieldNames.deviceModel]: row[fieldNames.deviceModel] ?? '',
    ...(fieldNames.deviceModelId ? { [fieldNames.deviceModelId]: row[fieldNames.deviceModelId] ?? '' } : {}),
    [fieldNames.deviceName]: row[fieldNames.deviceName] ?? '',
    [fieldNames.deviceQuantity]: Number(row[fieldNames.deviceQuantity] || 0),
    [fieldNames.people]: Number(row[fieldNames.people] || 0)
  }
}

export function proposalInstallationCopyValues(row = {}, fields = []) {
  const rowKeys = Object.keys(row)
  return fields.reduce((values, field) => {
    const name = String(field && field.Name || '')
    const component = String(field && (field.component || field.Component) || '')
    if (!name || COPY_EXCLUDED_FIELDS.has(name.toLowerCase()) || COPY_EXCLUDED_COMPONENTS.has(component)) {
      return values
    }
    const sourceKey = rowKeys.find((key) => key.toLowerCase() === name.toLowerCase())
    if (sourceKey !== undefined) values[name] = row[sourceKey]
    return values
  }, {})
}
