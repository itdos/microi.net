#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const resourceDir = path.dirname(fileURLToPath(import.meta.url))
const packagePaths = [path.join(resourceDir, 'app.microi.saas-engine.json')]
if (process.argv.includes('--sync-base')) {
  packagePaths.push(path.join(resourceDir, '.resource-sync-base', 'app.microi.saas-engine.json'))
}

const SYS_CONFIG_TABLE_ID = 'c8570fa6-c10f-4014-8cb4-4b046e7ba69c'
const DEVELOPMENT_TAB_ID = 'cfa27918-6245-4893-a77b-887c1a1e37f6'
const TARGET_VERSION = 'v7.5.29'
const GROUP_IDS = {
  DevelopmentAccessRuntimeGroup: '7a5c11b0-4d9f-4c82-9100-000000000101',
  DevelopmentV8GovernanceGroup: '7a5c11b0-4d9f-4c82-9100-000000000102',
  DevelopmentGlobalCodeGroup: '7a5c11b0-4d9f-4c82-9100-000000000103',
  DevelopmentTemplateCodeGroup: '7a5c11b0-4d9f-4c82-9100-000000000104',
}

const groups = [
  {
    name: 'DevelopmentAccessRuntimeGroup', label: '接口、文件与运行环境', sort: 500,
    description: '接口地址、文件服务、验证码、日志、版本与开发期运行选项',
    icon: 'fas fa-network-wired',
    fields: [
      'ApiBase', 'OnlyOfficeApiBase', 'EnableCaptcha', 'PrintSqlToPage',
      'FileServer', 'MediaServer', 'DefaultIndexUrl', 'HDFS', 'ServerVersion',
      'ClientVersion', 'EnableSwagger', 'EnableUserClickLog', 'AMapKey',
    ],
  },
  {
    name: 'DevelopmentV8GovernanceGroup', label: 'V8 资源与执行边界', sort: 2000,
    description: '表单事件锁、超时、语句、内存、递归、并发、排队与嵌套调用上限',
    icon: 'fas fa-gauge-high',
    fields: [
      'FormEventTimeout', 'V8DefaultTimeoutSeconds', 'V8MaxTimeoutSeconds',
      'V8DefaultMaxStatements', 'V8MaxStatements', 'V8DefaultLimitMemoryMB',
      'V8MaxLimitMemoryMB', 'V8DefaultLimitRecursion', 'V8MaxLimitRecursion',
      'V8MaxConcurrentExecutions', 'V8TenantMaxExecutions', 'V8KeyMaxConcurrentExecutions',
      'V8ExecutionWaitMilliseconds', 'V8CallTreeLimitMemoryMB', 'V8MaxCallTreeLimitMemoryMB',
      'V8NestedApiDepth', 'V8MaxNestedApiDepth', 'V8IsolateNestedApiMemory',
    ],
  },
  {
    name: 'DevelopmentGlobalCodeGroup', label: '全局脚本与登录事件', sort: 4000,
    description: '前端、服务端全局 V8 与用户登录成功后的扩展脚本',
    icon: 'fas fa-code',
    fields: ['GlobalV8Code', 'GlobalServerV8Code', 'LoginEndV8Code'],
  },
  {
    name: 'DevelopmentTemplateCodeGroup', label: '页面模板与组件配置', sort: 4500,
    description: '模块、页面、登录区 HTML 以及富文本和验证码 JSON 配置',
    icon: 'fas fa-file-code',
    fields: ['MenuBottomContent', 'PageBottomTpl', 'UEditorConfig', 'CaptchaConfig', 'LoginBottomContent', 'IndexCodeApi'],
  },
]

function maxVersion(current, target) {
  const parse = value => String(value || '').replace(/^v/i, '').split('.').map(part => Number(part) || 0)
  const left = parse(current)
  const right = parse(target)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return current
    if ((left[index] || 0) < (right[index] || 0)) return target
  }
  return current || target
}

function parseConfig(value) {
  if (value && typeof value === 'object') return structuredClone(value)
  try { return JSON.parse(value || '{}') }
  catch { return {} }
}

function configurePackage(packagePath) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  const table = pkg.DiyTables.find(item => item.Id === SYS_CONFIG_TABLE_ID || String(item.Name).toLowerCase() === 'sys_config')
  if (!table) throw new Error('SaaS 引擎包缺少 sys_config')

  const byName = new Map(pkg.DiyFields
    .filter(item => item.TableId === table.Id)
    .map(item => [item.Name, item]))

  for (const definition of groups) {
    const current = byName.get(definition.name) || {}
    Object.assign(current, {
      TableName: 'Sys_Config', AppVisible: 1, Tab: DEVELOPMENT_TAB_ID,
      Type: '', Name: definition.name, InTableEdit: 0, Unique: 0, NameConfirm: 1,
      Config: JSON.stringify({
        CollapseGroup: {
          DefaultCollapsed: false,
          ScopeMode: 'UntilNextGroup',
          Description: definition.description,
          Icon: definition.icon,
          Theme: 'primary',
          ShowFieldCount: true,
        },
      }),
      TableId: table.Id, Readonly: 0, Encrypt: 0, BindRole: '[]', Component: 'CollapseGroup',
      Visible: 1, IsLockField: 1, Data: '[]', Sort: definition.sort, NotEmpty: 0,
      Label: definition.label, Id: current.Id || GROUP_IDS[definition.name],
      CreateTime: current.CreateTime || '2026-08-23 00:00:00',
      Description: definition.description, DefaultValue: '', FormWidth: 24,
    })
    if (!byName.has(definition.name)) {
      pkg.DiyFields.push(current)
      byName.set(definition.name, current)
    }

    definition.fields.forEach((fieldName, index) => {
      const field = byName.get(fieldName)
      if (!field) throw new Error(`开发配置缺少字段 ${fieldName}`)
      field.Tab = DEVELOPMENT_TAB_ID
      field.Sort = definition.sort + ((index + 1) * 100)
      if (field.Component === 'CodeEditor') {
        const config = parseConfig(field.Config)
        config.CodeEditor = { ...(config.CodeEditor || {}), DisplayMode: 'Dialog' }
        field.Config = JSON.stringify(config)
      }
    })
  }

  const legacyMapKey = byName.get('AMapKey')
  if (legacyMapKey) {
    legacyMapKey.Visible = 0
    legacyMapKey.AppVisible = 0
    legacyMapKey.Description = '历史兼容字段；新配置请在“安全与服务接入”维护 Map.* 后端私有设置。'
  }

  const info = pkg.PackageInfo || (pkg.PackageInfo = {})
  info.Version = maxVersion(info.Version, TARGET_VERSION)
  const historyLine = '2026-08-23 v7.5.29 系统设置“开发配置”按运行环境、V8 边界、全局脚本和页面模板默认展开分组；CodeEditor 支持字段级按钮弹层模式并默认显示代码字数。'
  if (!String(info.ChangeHistory || '').includes(historyLine)) {
    info.ChangeHistory = `${historyLine}\n${info.ChangeHistory || ''}`
  }
  info.RequiredPlatformCapabilities = [...new Set([
    ...(info.RequiredPlatformCapabilities || []),
    'ClientFeature:CodeEditorFieldDisplayMode',
    'SystemSettings:DevelopmentCollapseGroups',
  ])]
  info.FieldCount = pkg.DiyFields.length
  info.PhysicalColumnCount = pkg.PhysicalColumns.length
  info.DataRowCount = (pkg.DataSets || []).reduce(
    (total, item) => total + (Array.isArray(item.Rows) ? item.Rows.length : 0), 0)

  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    packagePath,
    version: info.Version,
    groups: groups.map(item => ({ name: item.name, fieldCount: item.fields.length })),
  }, null, 2))
}

packagePaths.forEach(configurePackage)
