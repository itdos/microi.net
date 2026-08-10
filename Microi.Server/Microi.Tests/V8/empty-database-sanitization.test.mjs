import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const enginePath = path.join(
  here,
  '..',
  '..',
  '..',
  'Microi-V8-Engine',
  'Microi吾码 (api.itdos.com)',
  'iTdos.Product.Internal',
  '接口引擎',
  '系统',
  '[SaaS引擎]主库空数据库脱敏SQL(admin_get_empty_database_sanitization_sql).js'
)
const engineSource = fs.readFileSync(enginePath, 'utf8')
const execute = new Function('V8', engineSource)

function projectStoreRows(storeRows) {
  return storeRows.map((row) => {
    let packageModel = null
    let packageIsValid = 1
    if (String(row.AppPakcet || '').trim()) {
      try { packageModel = JSON.parse(row.AppPakcet) }
      catch { packageIsValid = 0 }
    }
    return {
      ...row,
      PackageIsValid: packageIsValid,
      DiyTableNamesJson: packageModel?.DiyTables
        ? JSON.stringify(packageModel.DiyTables.map((table) => table.Name))
        : null,
      ApiEngineKeysJson: packageModel?.SysApiEngines
        ? JSON.stringify(packageModel.SysApiEngines.map((engine) => engine.ApiEngineKey))
        : null
    }
  })
}

function run(storeRows, options = {}) {
  const defaultTables = [
    { Id: 'platform-table', Name: 'sys_menu' },
    { Id: 'legacy-table', Name: 'ExtraLegacy' }
  ]
  const defaultMenus = [
    { StoreId: 'legacy-app', DiyTableId: 'legacy-table', DiyTableName: '' }
  ]
  const queries = []
  const tablePages = options.tablePages || [defaultTables]
  const menuPages = options.menuPages || [defaultMenus]
  const result = execute({
    Db: {
      FromSql(sql) {
        queries.push(sql)
        if (/FROM\s+sys_apiengine/i.test(sql)) {
          return { ToArray: () => options.evidenceEngineRows || [] }
        }
        return { ToArray: () => projectStoreRows(storeRows) }
      }
    },
    FormEngine: {
      GetTableData(key, query) {
        const pageIndex = Number(query._PageIndex || 1) - 1
        if (key === 'diy_table' && Array.isArray(query.Ids)) {
          const requested = new Set(query.Ids)
          return { Code: 1, Data: tablePages.flat().filter((row) => requested.has(row.Id)) }
        }
        if (key === 'diy_table') return { Code: 1, Data: tablePages[pageIndex] || [] }
        if (key === 'sys_menu') return { Code: 1, Data: menuPages[pageIndex] || [] }
        return { Code: 0, Msg: `unexpected table ${key}` }
      }
    }
  })
  return { result, queries }
}

test('non-platform package tables and StoreId menu tables enter the cleanup SQL', () => {
  const { result } = run([
    {
      Id: 'platform-app',
      AppKey: 'app.microi.module-engine',
      ApplicationType: 'Platform',
      AppPakcet: JSON.stringify({ DiyTables: [{ Name: 'sys_menu' }] })
    },
    {
      Id: 'legacy-app',
      AppKey: 'legacy-regular',
      ApplicationType: '',
      AppType: '',
      AppPakcet: JSON.stringify({
        DiyTables: [{ Name: 'BusinessLegacy' }, { Name: 'sys_menu' }]
      })
    }
  ])

  assert.equal(result.Code, 1)
  assert.match(result.Data.Sql, /\('BusinessLegacy'\)/)
  assert.match(result.Data.Sql, /\('ExtraLegacy'\)/)
  assert.doesNotMatch(result.Data.Sql, /temp_app_owned_tables \(Name\) VALUES[^;]*\('sys_menu'\)/)
  assert.match(result.Data.Sql, /LIKE 'app\.microi\.%'/)
  assert.equal(result.Data.StoreCount, 2)
  assert.equal(result.Data.ApplicationOwnedTableCount, 2)
  assert.deepEqual(result.Data.ApplicationOwnedTables, ['BusinessLegacy', 'ExtraLegacy'])
})

test('misclassified business Platform app, package engines, jobs and mci_demo evidence are removed', () => {
  const { result } = run([
    {
      Id: 'platform-app',
      AppKey: 'app.microi.module-engine',
      ApplicationType: 'Platform',
      AppPakcet: JSON.stringify({
        DiyTables: [{ Name: 'sys_menu' }],
        SysApiEngines: [{ ApiEngineKey: 'app_platform_core' }]
      })
    },
    {
      Id: 'content-app',
      AppKey: 'ai-content-operations',
      ApplicationType: 'Platform',
      AppPakcet: JSON.stringify({
        DiyTables: [{ Name: 'mci_ai_content_plan' }, { Name: 'mci_ai_publish_task' }],
        SysApiEngines: [
          { ApiEngineKey: 'mci-ai-content-dispatch' },
          { ApiEngineKey: 'mci-ai-content-recover' }
        ]
      })
    }
  ], {
    evidenceEngineRows: [{ ApiEngineKey: 'mci_demo_ai_output_contract_lab' }]
  })

  assert.equal(result.Code, 1)
  assert.deepEqual(result.Data.ApplicationOwnedTables, ['mci_ai_content_plan', 'mci_ai_publish_task'])
  assert.deepEqual(result.Data.ApplicationOwnedEngineKeys, [
    'mci-ai-content-dispatch',
    'mci-ai-content-recover',
    'mci_demo_ai_output_contract_lab'
  ])
  assert.doesNotMatch(result.Data.Sql, /temp_app_owned_tables \(Name\) VALUES[^;]*\('sys_menu'\)/)
  assert.doesNotMatch(result.Data.Sql, /temp_app_owned_engines \(KeyName\) VALUES[^;]*\('app_platform_core'\)/)
  assert.match(result.Data.Sql, /DELETE c FROM microi_job_cron_triggers c/)
  assert.match(result.Data.Sql, /DELETE d FROM microi_job_job_details d/)
  assert.match(result.Data.Sql, /LEFT\(LOWER\(COALESCE\(ApiEngineKey, ''\)\), 9\) = 'mci_demo_'/)
  assert.match(result.Data.Sql, /m\.Name = '文章关联微服务'/)
})

test('invalid non-empty AppPakcet stops release before SQL execution', () => {
  const { result } = run([
    { Id: 'broken-app', AppKey: 'broken', ApplicationType: 'Web', AppPakcet: '{' }
  ])
  assert.equal(result.Code, 0)
  assert.match(result.Msg, /AppPakcet.*合法 JSON/)
})

test('menu-owned table lookup reads only the referenced diy_table ids', () => {
  const firstPage = Array.from({ length: 5000 }, (_, index) => ({
    Id: `table-${index}`,
    Name: `PlatformTable${index}`
  }))
  const { result } = run(
    [{ Id: 'legacy-app', AppKey: 'legacy', ApplicationType: 'Regular', AppPakcet: '{}' }],
    {
      tablePages: [firstPage, [{ Id: 'late-table', Name: 'LateBusiness' }]],
      menuPages: [[{ StoreId: 'legacy-app', DiyTableId: 'late-table', DiyTableName: '' }]]
    }
  )

  assert.equal(result.Code, 1)
  assert.deepEqual(result.Data.ApplicationOwnedTables, ['LateBusiness'])
})

test('store packages use compact MySQL JSON projection instead of loading package blobs', () => {
  const { result, queries } = run([])

  assert.equal(result.Code, 1)
  assert.equal(queries.length, 2)
  assert.match(queries[0], /JSON_VALID\(AppPakcet\)/)
  assert.match(queries[0], /JSON_EXTRACT\(SelectTable, '\$\[\*\]\.Name'\)/)
  assert.match(queries[0], /JSON_EXTRACT\(AppPakcet, '\$\.DiyTables\[\*\]\.Name'\)/)
  assert.match(queries[0], /JSON_EXTRACT\(SelectApiEngine, '\$\[\*\]\.ApiEngineKey'\)/)
  assert.match(queries[0], /JSON_EXTRACT\(AppPakcet, '\$\.SysApiEngines\[\*\]\.ApiEngineKey'\)/)
  assert.doesNotMatch(queries[0].split(/\bCASE\b/i, 1)[0], /\bAppPakcet\b/i)
  assert.match(queries[1], /FROM sys_apiengine/)
})

test('empty database SQL clears credentials and operational residue but keeps core table structures', () => {
  const { result } = run([])

  assert.equal(result.Code, 1)
  assert.match(result.Data.Sql, /DELETE from microi_database;/)
  assert.doesNotMatch(result.Data.Sql, /microi_database where DbName <> 'oracle11g'/)
  assert.match(result.Data.Sql, /DELETE from mci_file_remote_connection;/)
  assert.match(result.Data.Sql, /DELETE from mci_ai_token_account;/)
  assert.match(result.Data.Sql, /DELETE from mci_spider_account;/)
  assert.match(result.Data.Sql, /DELETE from mci_security_attack_event;/)
  assert.match(result.Data.Sql, /DELETE from mci_user_access_key;/)
  assert.match(result.Data.Sql, /DELETE from sys_business_blueprint;/)
  assert.match(result.Data.Sql, /DELETE from sys_datasource\s+WHERE LOWER\(COALESCE\(DataSourceKey, ''\)\) <> 'virtual-table-personal-setting';/)
  assert.doesNotMatch(result.Data.Sql, /DROP TABLE IF EXISTS mci_ai_token_account/)
})

test('unsafe package table names never enter generated SQL', () => {
  const { result } = run([
    {
      Id: 'unsafe-app',
      AppKey: 'unsafe',
      ApplicationType: 'Regular',
      AppPakcet: JSON.stringify({ DiyTables: [{ Name: "bad'); DROP TABLE sys_user; --" }] })
    }
  ])

  assert.equal(result.Code, 1)
  assert.equal(result.Data.ApplicationOwnedTableCount, 0)
  assert.doesNotMatch(result.Data.Sql, /DROP TABLE sys_user/i)
})
