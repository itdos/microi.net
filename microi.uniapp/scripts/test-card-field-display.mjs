import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  appendSystemAuditFields,
  cardFieldKey,
  filterVisibleCardLines,
  resolveConfiguredFields,
  resolveConfiguredFieldNames,
  shouldKeepEmptyCardLine
} from '../src/platform/card-field-policy.mjs'

const fields = [
  { Id: 'field-owner', Name: 'OwnerId', Label: '负责人' },
  { Id: 'field-type', Name: 'CustomerType', Label: '客户类型' }
]

const availableFields = appendSystemAuditFields(fields)
assert.ok(availableFields.some((field) => field.Name === 'CreateTime'), '应补齐创建时间系统字段')
assert.ok(availableFields.some((field) => field.Name === 'UpdateTime'), '应补齐更新时间系统字段')
assert.equal(availableFields.filter((field) => field.Name === 'CreateTime').length, 1, '已有系统字段不应重复')
assert.deepEqual(
  resolveConfiguredFieldNames([{ Id: 'legacy-system-id', Name: 'CreateTime' }], availableFields),
  ['CreateTime'],
  '对象配置的 Id 无法匹配时应继续尝试 Name'
)
assert.equal(shouldKeepEmptyCardLine({ label: '负责人' }), true, '负责人空值时应保留')
assert.equal(shouldKeepEmptyCardLine({ label: ' 负责人 ' }), true, '负责人标签应容忍首尾空格')
assert.equal(shouldKeepEmptyCardLine({ label: '负责人电话' }), false, '其他空字段不应被扩大保留')
assert.equal(cardFieldKey({ field: 'DingdanBH' }), 'dingdanbh', '卡片字段去重必须忽略大小写')
assert.deepEqual(
  filterVisibleCardLines([
    { field: 'DingdanBH', label: '订单编号' },
    { field: 'XinLDD', label: '订单类型' }
  ], { DingdanBH: 'DD-001', XinLDD: '新客户订单' }, ['DingdanBH']).map((line) => line.field),
  ['XinLDD'],
  '已作为标题展示的订单编号不能在卡片正文中重复'
)

const legacyFields = [
  { Id: 'phone-id', Name: 'ShoujiH', Label: '具体生日' },
  { Id: 'status-id', Name: 'ZhiweiZT', Label: '字段元数据名称' }
]
assert.deepEqual(
  resolveConfiguredFields([
    { FieldId: 'phone-id', Label: '手机号' },
    { Name: 'ZhiweiZT', Label: '在职状态', AsName: 'EmploymentStatus' }
  ], legacyFields),
  [
    { field: 'ShoujiH', queryField: 'ShoujiH', label: '手机号', format: '' },
    { field: 'EmploymentStatus', queryField: 'ZhiweiZT', label: '在职状态', format: '' }
  ],
  '旧式卡片配置应优先保留配置时的中文标签和字段别名'
)
assert.deepEqual(
  resolveConfiguredFieldNames([{ Name: 'ZhiweiZT', AsName: 'EmploymentStatus' }], legacyFields),
  ['ZhiweiZT'],
  '查询字段必须使用数据库真实字段名，不能误用展示别名'
)

const unlimitedCardSources = [
  '../src/platform/module-registry.js',
  '../src/pages/business/list.vue',
  '../src/pages/module/list.vue',
  '../src/components/mci-business-related-list/mci-business-related-list.vue'
]
unlimitedCardSources.forEach((file) => {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  assert.equal(/(?:lines|visibleLines)[\s\S]{0,300}\.slice\(0,\s*4\)/.test(source), false, `${file} 不应把卡片内容限制为四行`)
})
const relatedListSource = readFileSync(new URL('../src/components/mci-business-related-list/mci-business-related-list.vue', import.meta.url), 'utf8')
const relatedListPageSource = readFileSync(new URL('../src/pages/business/related-list.vue', import.meta.url), 'utf8')
assert.doesNotMatch(
  relatedListSource,
  /loadGrantedMenuDefinition/,
  '关联 Tab 已有子菜单和表单授权上下文，不应重复加载并覆盖通用模块定义'
)

assert.match(relatedListSource, /createMenuModuleDefinition\(menu, this\.definition, this\.table\)/, '详情 Tab 应复用独立列表的菜单卡片编译逻辑')
assert.match(relatedListSource, /title:\s*menuConfig\.title/, '独立子表标题必须使用当前子菜单名称')
assert.match(relatedListSource, /'titleField', 'title', 'statusField'/, '后台刷新完整菜单时必须同步模块标题')
assert.match(relatedListSource, /\$emit\('title-change', title\)/, '子表模块名称刷新后必须通知独立页面更新导航标题')
assert.match(relatedListPageSource, /@title-change="handleTitleChange"/, '独立子表页面必须接收当前子菜单名称')
assert.match(relatedListPageSource, /handleTitleChange\(title\)[\s\S]{0,160}this\.pageTitle = nextTitle/, '独立子表顶部标题必须跟随后台模块名称')
assert.match(
  relatedListSource,
  /loadModuleDefinition\(this\.menuId, true, \{ includeHidden: true \}\)/,
  '只有详情关联子表可显式刷新隐藏菜单的完整展示配置'
)
assert.match(relatedListSource, /'menu', 'definition', 'titleField'/, '详情 Tab 应把完整模块的菜单快照交给 ViewManifest')
assert.match(relatedListSource, /void this\.loadPresentationConfig\(refresh\)/, '完整展示配置不得阻塞关联数据加载和骨架屏关闭')
assert.match(relatedListSource, /filterVisibleCardLines\(this\.config\.lines \|\| \[\], row/, '详情 Tab 必须复用普通列表的标题与正文去重规则')
assert.match(relatedListSource, /isCustomerOrderList\(\)[\s\S]{0,300}String\(tableName\)\.toLowerCase\(\) === 'diy_dingdan'/, '客户详情订单列表应直接按订单子表识别，不能依赖缺失的父表参数')
assert.match(relatedListSource, /return this\.isCustomerOrderList\(\) \? 'KehuMC' : this\.config\.titleField/, '客户订单卡片应强制以客户名称作为标题字段')
assert.match(relatedListSource, /parentCustomerName[\s\S]{0,120}'订单'/, '订单数据缺少客户名称时也不得回退到订单编号标题')
assert.doesNotMatch(relatedListSource, /payload\._SelectFields = this\.config\.selectFields/, '详情 Tab 的父子授权查询不应套用普通列表字段裁剪')
assert.doesNotMatch(relatedListSource, /\.\.\.\(menuConfig \|\| \{\}\)/, '详情 Tab 不应整体继承普通列表的排序、分页和查询配置')
assert.match(relatedListSource, /:time="cardBottomText\(row\)"/, '详情 Tab 应按平台底部字段配置渲染卡片底部')
assert.match(relatedListSource, /_SelectFields: this\.relatedSelectFields\(\)/, 'TableChild 查询必须显式补齐移动卡片引用字段')
assert.match(relatedListSource, /\.\.\.\(this\.config\.selectFields \|\| \[\]\)/, 'TableChild 查询字段应包含模块卡片完整字段集')
assert.doesNotMatch(relatedListSource, /if \(requestId !== this\.loadRequestId\) return/, '详情 Tab 不应因并发刷新丢弃所有已成功返回的数据并停留在骨架屏')
assert.match(relatedListSource, /finally \{[\s\S]{0,80}this\.loading = false/, '详情 Tab 请求结束后必须无条件关闭骨架屏')

const moduleRegistrySource = readFileSync(new URL('../src/platform/module-registry.js', import.meta.url), 'utf8')
const businessRuntimeSource = readFileSync(new URL('../src/platform/business-runtime.js', import.meta.url), 'utf8')
const viewManifestSource = readFileSync(new URL('../src/platform/view-manifest.js', import.meta.url), 'utf8')
const tenantBusinessSource = readFileSync(new URL('../src/tenants/xjy/business.js', import.meta.url), 'utf8')
assert.match(tenantBusinessSource, /orders: native\(\{[\s\S]{0,240}titleField: 'KehuMC'/, '订单本地回退配置不得再把订单编号设为标题')
assert.match(tenantBusinessSource, /proposals: native\(\{[\s\S]{0,100}title: '需求方案'/, '需求方案页面的离线兜底标题应与平台菜单一致')
assert.match(viewManifestSource, /matchingConfiguredMenu\(moduleConfig\) \|\| await findMenu/, 'ViewManifest 应优先复用模块定义中的同一菜单快照')
assert.match(moduleRegistrySource, /hasConfiguredCardFields:/, '模块配置应标记旧式卡片字段，阻止旧 ViewSchema 覆盖')
assert.match(moduleRegistrySource, /hasConfiguredMobileFields:/, '模块配置应分别标记移动正文配置')
assert.match(moduleRegistrySource, /const titleField = configuredMobile\.length[\s\S]{0,100}\(preferred\[0\] \|\| null\)/, '移动卡片第一配置字段必须固定作为标题')
assert.match(moduleRegistrySource, /configuredBottomFields\.map\(\(item\) => item\.queryField\)/, '卡片底部字段应并入查询字段')
assert.doesNotMatch(moduleRegistrySource, /configuredStatus\s*=\s*configuredTagFields\[0\]/, '旧式卡片标题标签不得再冒充跨端状态字段')
assert.match(moduleRegistrySource, /const statusField = preferredField\(fields, \[\/状态\|status\|stage\/i\]/, '旧模块只能按真实状态字段名称提供安全兜底')
assert.match(moduleRegistrySource, /!module && options\.includeHidden === true/, '隐藏菜单回读必须由关联子表显式开启')
assert.match(moduleRegistrySource, /findMenu\(\[\], '', refresh, menuId\)/, '隐藏关联菜单仍必须按精确 Id 刷新完整卡片配置')
;['../src/pages/business/list.vue', '../src/pages/module/list.vue'].forEach((file) => {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  assert.doesNotMatch(source, /includeHidden/, `${file} 主列表不得开启隐藏子菜单解析`)
})
assert.match(businessRuntimeSource, /payload\._SelectFields = moduleConfig\.selectFields/, '列表查询应显式携带卡片所需字段')

const statusOverrideSources = [
  '../src/pages/business/list.vue',
  '../src/pages/module/list.vue',
  '../src/components/mci-business-related-list/mci-business-related-list.vue'
]
statusOverrideSources.forEach((file) => {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  assert.doesNotMatch(
    source,
    /hasConfiguredCardFields[^\n]+\[[^\]]*['"]statusField['"]/,
    `${file} 不应阻止显式 ViewSchema 状态字段覆盖旧式自动值`
  )
  assert.match(
    source,
    /name === 'titleField' && merged\.hasConfiguredMobileFields/,
    `${file} 标题必须优先使用模块 MobileListFields 第一项`
  )
  assert.match(
    source,
    /dynamic\.tagsFromViewSchema[\s\S]{0,80}merged\.tagFields = dynamic\.tagFields \|\| \[\]/,
    `${file} 标签必须由跨端 TopFields 明确覆盖或清空`
  )
  assert.match(
    source,
    /dynamic\.statusFromViewSchema[\s\S]{0,100}merged\.statusField = dynamic\.statusField \|\| ''/,
    `${file} 应在跨端 StatusFields 为空时明确清除旧状态`
  )
  assert.match(
    source,
    /merged\.statusOptions = dynamic\.statusOptions \|\| \[\]/,
    `${file} 状态筛选项应同步跟随跨端状态字段`
  )
  assert.match(
    source,
    /\.\.\.\(dynamic\.requiredFields \|\| \[\]\)/,
    `${file} 应把跨端卡片全部引用字段并入列表查询`
  )
  assert.match(source, /value === '-' \? '' : value/, `${file} 状态字段为空时不应显示占位横线`)
  assert.match(source, /hasConfiguredMobileFields[\s\S]{0,60}\? ''[\s\S]{0,20}:/, `${file} 模块未配置底部字段时不得擅自回退创建时间`)
})
;['../src/pages/business/list.vue', '../src/pages/module/list.vue'].forEach((file) => {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  assert.match(source, /dynamic\.requiredFields/, `${file} 应统一查询跨端 Card-Mobile 所有字段`)
})
const businessListSource = readFileSync(new URL('../src/pages/business/list.vue', import.meta.url), 'utf8')
assert.match(businessListSource, /title: menu\.Name \|\| this\.baseConfig\.title/, '业务列表页面标题必须跟随后台模块名称')
assert.match(businessListSource, /!restored \|\| !this\.rowsContainConfiguredCardFields\(\)/, '旧页面快照缺少新卡片字段时必须重新查询')

console.log('card field display checks passed')
