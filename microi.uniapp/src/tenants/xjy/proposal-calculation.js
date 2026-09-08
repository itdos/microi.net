import { calculateCurrentProposalCosts, PROPOSAL_AFTER_COST_FIELDS } from './proposal-cost-model.mjs'

// zhy：客户方案默认值与成本计算集中在本模块，供小程序新增/编辑表单复用。
export const PROPOSAL_DEFAULT_VALUES = Object.freeze({
  ShebeiSL: 1,
  DangqianYSSBSL: 1,
  TongzhuangSDJ: 0,
  HesuanNS: 5,
  HezuoHYSSBSL: 1,
  ShisuanNS: 5,
  ShisuanNSMD: 5,
  HezuoHYSSBSLMD: 1,
  ShuizhiYQ: '纳滤',
  DashuiFS: '["4"]',
  JiareFS: '步进式',
  ShuiwenYQ: '["2"]'
})

export const PROPOSAL_CALCULATION_FIELDS = new Set([
  'DangqianYSFS',
  'Renshu',
  'ShebeiSL',
  'DangqianYSSBSL',
  'TongzhuangSDJ',
  'HesuanNS',
  'ShebeiDJZL',
  'ShebeiDJ',
  'GenghuanLXJG',
  'HezuoHYSSBSL',
  'ShisuanNS',
  'HezuoHYSSBSLMD',
  'ShisuanNSMD'
].map((name) => name.toLowerCase()))

function numberValue(value) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : 0
}

function fixed(value) {
  const number = Number(value)
  return (Number.isFinite(number) ? number : 0).toFixed(2)
}

function isEmptyProposalValue(value) {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  return typeof value === 'string' && value.trim() === '[]'
}

export function proposalInitialValues(form = {}) {
  return Object.fromEntries(
    Object.entries(PROPOSAL_DEFAULT_VALUES).filter(([name]) =>
      isEmptyProposalValue(form[name])
    )
  )
}

export function isProposalCalculationField(fieldName) {
  return PROPOSAL_CALCULATION_FIELDS.has(String(fieldName || '').toLowerCase())
}

export function proposalInheritedValues(source = {}) {
  const excludedFields = new Set([
    ...PROPOSAL_AFTER_COST_FIELDS,
    'Id',
    'CreateTime',
    'UpdateTime',
    'CreateUser',
    'OsClient',
    'AnzhuangCS',
    'ChangsuoDWSL',
    // zhy：新增方案的用水偏好使用产品默认值，不继承上一方案的历史选择。
    'ShuizhiYQ',
    'DashuiFS',
    'JiareFS',
    'ShuiwenYQ'
  ])
  const inherited = {}
  Object.entries(source || {}).forEach(([name, value]) => {
    if (!excludedFields.has(name) && value !== null && value !== undefined) {
      inherited[name] = value
    }
  })
  inherited.Paixu = numberValue(source.Paixu) + 1
  return inherited
}

export function calculateProposalCosts(form = {}) {
  // 主表只算现状；合作后费用只能来自点位汇总，不能用历史主表设备字段覆盖。
  return Object.fromEntries(Object.entries(calculateCurrentProposalCosts(form)).map(([key, value]) => [key, fixed(value)]))
}
