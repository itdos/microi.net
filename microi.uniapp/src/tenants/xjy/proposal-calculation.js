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
    'Id',
    'CreateTime',
    'UpdateTime',
    'CreateUser',
    'OsClient',
    'AnzhuangCS',
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
  const people = numberValue(form.Renshu)
  const currentDeviceCount = numberValue(form.ShebeiSL)
  const currentWaterDeviceCount = numberValue(form.DangqianYSSBSL)
  const currentYears = numberValue(form.HesuanNS)
  const waterMethod = String(form.DangqianYSFS || '')
  const usesBoiler = waterMethod.includes('开水机')
  const usesDirectDrinking = waterMethod.includes('直饮机')
  const usesKettle = waterMethod.includes('电水壶')
  const usesBottledWater = waterMethod.includes('桶装水')

  let currentWaterCost = 0
  let currentElectricityCost = 0
  let currentServiceCost = 0

  if (usesBoiler || usesDirectDrinking || usesKettle) {
    currentWaterCost = people * 2.4
    currentServiceCost = usesBoiler ? currentDeviceCount * 500 : 0
    currentElectricityCost = usesBoiler || usesKettle ? people * 90 : people * 30
  } else if (usesBottledWater) {
    currentWaterCost = numberValue(form.TongzhuangSDJ) * 20 * people
    currentElectricityCost = people * 30
  }

  const currentTotal = currentWaterCost + currentElectricityCost + currentServiceCost
  const currentAllDevicesTotal = currentTotal * currentWaterDeviceCount

  const rentalElectricityCost = people * 30
  const rentalWaterCost = people * 2.4
  const rentalServiceCost = numberValue(form.ShebeiDJZL) * currentDeviceCount
  const rentalTotal = rentalElectricityCost + rentalWaterCost + rentalServiceCost
  const rentalAllDevicesTotal = rentalTotal * numberValue(form.HezuoHYSSBSL)

  const buyoutYears = numberValue(form.ShisuanNSMD)
  const buyoutEquipmentCost = numberValue(form.ShebeiDJ)
  const buyoutFilterCost = numberValue(form.GenghuanLXJG)
  const buyoutAnnualEquipmentCost = buyoutYears > 0 ? buyoutEquipmentCost / buyoutYears : 0
  const buyoutTotal = buyoutAnnualEquipmentCost +
    rentalElectricityCost + rentalWaterCost + buyoutFilterCost
  const buyoutAllDevicesTotal = buyoutTotal * numberValue(form.HezuoHYSSBSLMD)

  return {
    DangqianYSCB: fixed(currentWaterCost),
    DangqianFWCB: fixed(currentServiceCost),
    DangqianYDCB: fixed(currentElectricityCost),
    DangqianYSZCB: fixed(currentTotal),
    DangqianYSZCBAll: fixed(currentAllDevicesTotal),
    DuonianLJCB: fixed(currentAllDevicesTotal * currentYears),
    HezuoHYDCB: fixed(rentalElectricityCost),
    HezuoHYDCBMD: fixed(rentalElectricityCost),
    HezuoHYSCB: fixed(rentalWaterCost),
    HezuoHYSCBMD: fixed(rentalWaterCost),
    HezuoHFWCB: fixed(rentalServiceCost),
    HezuoHYSZCB: fixed(rentalTotal),
    HezuoHYSZCBAll: fixed(rentalAllDevicesTotal),
    DuonianLJCBAfter: fixed(rentalAllDevicesTotal * numberValue(form.ShisuanNS)),
    ShebeiMDCBDT: buyoutEquipmentCost,
    HezuoHFWCBMD: fixed(buyoutFilterCost),
    HezuoHYSZCBMD: fixed(buyoutTotal),
    HezuoHYSZCBAllMD: fixed(buyoutAllDevicesTotal),
    DuonianLJCBMD: fixed(buyoutAllDevicesTotal * buyoutYears)
  }
}
