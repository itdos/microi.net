import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../../..')
const contract = JSON.parse(fs.readFileSync(path.join(repo, 'AI-Project/标准产品套件/source-contract.json'), 'utf8'))
assert.equal(contract.schemaVersion, 1)
assert.equal(contract.target.apiBase, 'https://api.itdos.com')
assert.equal(String(contract.target.osClient).toLowerCase(), 'itdos')
assert.ok(typeof contract.sourceParent === 'string' && !path.isAbsolute(contract.sourceParent))
const sourceParent = path.resolve(repo, contract.sourceParent)
const relative = path.relative(repo, sourceParent)
assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), '责任源码根必须位于当前工作区')
assert.ok(fs.statSync(sourceParent).isDirectory(), '契约责任源码缺失时必须失败')
// 脱敏接口由 SaaS 官方包单一拥有；远端拉取目录可能保留旧版本，不能成为平台发行回归的事实源。
const packagePath = path.join(repo, 'Microi.Server/OfficialApplications/Resource/app.microi.saas-engine.json')
const officialPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
assert.equal(officialPackage.PackageInfo.OsClient, 'iTdos')
const engineKey = 'admin_get_empty_database_sanitization_sql'
assert.equal(officialPackage.ResourcePolicies.ApiEngines[engineKey].UpgradePolicy, 'Managed')
const ownedEngines = officialPackage.SysApiEngines.filter(engine => engine.ApiEngineKey === engineKey)
assert.equal(ownedEngines.length, 1, '正式 SaaS 包必须唯一拥有空库脱敏接口')
const engineSource = ownedEngines[0].ApiV8Code
assert.ok(typeof engineSource === 'string' && engineSource.length > 0, '正式包必须携带实际发行正文')
const execute = new Function('V8', engineSource)

test('应用文件与版本清理先建立带主键的保留身份集合，避免 MySQL 5.7 OR 删除关联扫描', () => {
  const { result, queries } = run([{ Id: 'platform-id', AppKey: 'microi-platform-service', AppPakcet: '' }], {
    optionalTables: ['mci_ai_app_file', 'mci_ai_app_version']
  })
  assert.equal(result.Code, 1)
  const sql = result.Data.Sql
  const seed = sql.indexOf('CREATE TEMPORARY TABLE IF NOT EXISTS temp_platform_runtime_app_ids')
  assert.ok(seed >= 0)
  assert.match(sql, /temp_platform_runtime_app_ids\s*\(\s*Id VARCHAR\(191\) NOT NULL PRIMARY KEY/)
  for (const alias of ['f', 'v']) {
    const cleanup = sql.indexOf(`DELETE ${alias} FROM mci_ai_app_`)
    assert.ok(cleanup > seed, '保留身份必须在清理前物化')
    assert.match(sql, new RegExp(`LEFT JOIN temp_platform_runtime_app_ids p ON p.Id = ${alias}\\.AppId`))
    assert.doesNotMatch(sql, new RegExp(`p.Id = ${alias}\\.AppId OR p.AppKey = ${alias}\\.AppId`))
  }
  assert.match(sql, /SELECT Id FROM sys_microistore[\s\S]*?UNION ALL\s+SELECT AppKey FROM sys_microistore/)
  assert.ok(queries.every(query => /^\s*(?:\/\*[\s\S]*?\*\/\s*)?SELECT\b/i.test(query)), '源主库只读取，不在生成阶段清理')
})

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
      PackageDiyTableNamesJson: packageModel?.DiyTables
        ? JSON.stringify(packageModel.DiyTables.map((table) => table.Name))
        : null,
      PackageDiyFieldTableNamesJson: packageModel?.DiyFields
        ? JSON.stringify(packageModel.DiyFields.map((field) => field.TableName))
        : null,
      PackageDataSetTableNamesJson: packageModel?.DataSets
        ? JSON.stringify(packageModel.DataSets.map((dataSet) => dataSet.TableName))
        : null,
      PackageDdlTableNamesJson: packageModel?.DDLStatements
        ? JSON.stringify(packageModel.DDLStatements.map((statement) => statement.TableName))
        : null,
      PackagePhysicalColumnTableNamesJson: packageModel?.PhysicalColumns
        ? JSON.stringify(packageModel.PhysicalColumns.map((column) => column.TableName))
        : null,
      PackageApplicationBundleTableNamesJson: packageModel?.ApplicationBundles
        ? JSON.stringify(packageModel.ApplicationBundles.map((bundle) => bundle.TableName))
        : null,
      PackageSysMenuTableNamesJson: packageModel?.SysMenus
        ? JSON.stringify(packageModel.SysMenus.map((menu) => menu.TableName))
        : null,
      PackageDdlValuesJson: packageModel?.DDLStatements
        ? JSON.stringify(packageModel.DDLStatements.map((statement) => statement.DDL))
        : null,
      PackageApiEngineKeysJson: packageModel?.SysApiEngines
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
  const generatedIds = options.generatedIds || Array.from({ length: 7 }, (_, index) => `f0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`)
  let guidIndex = 0
  const result = execute({
    Method: {
      NewGuid() {
        if (options.guidFailure) throw new Error('random identity unavailable')
        return generatedIds[guidIndex++]
      }
    },
    EncryptHelper: {
      DESEncode(value) {
        if (options.encryptionFailure) throw new Error('credential encryption unavailable')
        return options.plaintextCipher ? value : `encrypted:${value}`
      }
    },
    Db: {
      FromSql(sql) {
        queries.push(sql)
        if (/EMPTY_DATABASE_DEPARTMENT_PARENT_NAME_V1/.test(sql)) {
          if (options.departmentColumnFailure) throw new Error('department columns unavailable')
          return { ToArray: () => options.departmentParentNameMissing ? [] : [{ FieldName: 'ParentName' }] }
        }
        if (/EMPTY_DATABASE_SAAS_PROMOTION_FIELDS_V1/.test(sql)) {
          if (options.promotionColumnFailure) throw new Error('promotion schema unavailable')
          return { ToArray: () => (options.promotionFields || []).map(FieldName => ({ FieldName })) }
        }
        if (/FROM\s+sys_user\b/i.test(sql)) {
          if (options.adminReadFailure) throw new Error('admin catalog unavailable')
          return { ToArray: () => options.adminUsers || [{ Id: 'admin-user', Level: 9999, IsDeleted: 0,
            RoleIds: JSON.stringify([{ Id: '5db47859-35a3-411a-a1f7-99482e057d24' }]) }] }
        }
        if (/FROM\s+sys_role\b/i.test(sql)) {
          if (options.roleReadFailure) throw new Error('role catalog unavailable')
          const roles = options.templateRoles || [
            { Id: '5db47859-35a3-411a-a1f7-99482e057d24', Level: 9999, IsDeleted: 0 },
            { Id: '949b2e88-cfa1-44cd-b234-85f043785ece', Level: 0, IsDeleted: 0 }
          ]
          return { ToArray: () => roles.filter(role => role.Level === 9999 && role.IsDeleted === 0) }
        }
        if (/FROM\s+sys_dept\b/i.test(sql)) {
          if (options.departmentReadFailure) throw new Error('department catalog unavailable')
          return { ToArray: () => options.templateDepartments || [
            { Id: '933da282-adf7-4b1d-90f9-bfad70dae3a5', IsDeleted: 0 },
            { Id: 'b4612bd0-f318-40f3-a620-547fa3e9cbc2', IsDeleted: 0 }
          ] }
        }
        // 安装记录与商城定义是不同读边界，模拟器不能用商城行冒充已安装应用。
        if (/FROM\s+sys_microistoreversion\b/i.test(sql)) {
          return { ToArray: () => options.installedRows || [] }
        }
        if (/FROM\s+sys_apiengine/i.test(sql)) {
          return { ToArray: () => options.evidenceEngineRows || [] }
        }
        if (/FROM\s+information_schema\.tables/i.test(sql)) {
          if (/EMPTY_DATABASE_STANDARD_SUITE_V1/.test(sql)) {
            if (options.suiteDiscoveryFailure) throw new Error('catalog unavailable')
            return { ToArray: () => (options.suitePhysicalTables || []).map((TableName) => ({ TableName })) }
          }
          const optionalTables = options.optionalTables || [
            'microi_job_cron_triggers',
            'microi_job_triggers',
            'microi_job_job_details',
            'mci_background_task',
            'mci_database_backup',
            'mci_gitee_star_audit',
            'mci_system_setting',
            'mci_user_external_identity',
            'mci_user_access_key',
            'diy_sso',
            'mci_identity_connector',
            'mci_identity_credential',
            'mci_identity_device',
            'mci_identity_face',
            'mci_identity_group',
            'mci_identity_group_member',
            'mci_identity_sync_conflict',
            'mci_identity_sync_run',
            'mci_identity_tag',
            'mci_identity_tag_assignment',
            'mci_identity_totp',
            'mci_ai_token_account',
            'mci_file_remote_connection',
            'mci_spider_account',
            'mci_redis_connection',
            'sys_servernode',
            'sys_sourcedatatable',
            'microi_database',
            'wx_mp',
            'wx_menu',
            'mci_marketplace_install_event',
            'mci_tenant_quota_log',
            'mic_msg_event_log',
            'mci_network_traffic_rollup',
            'mci_app_stream_gate_transition',
            'mci_nuget_stats_daily',
            'microi_job_locks',
            'wx_mini_program',
            'wx_tpl_msg',
            'mic_msgset'
          ]
          // 模拟真实IN筛选，不能让未列入发现SQL的表也凭测试夹具返回。
          return { ToArray: () => optionalTables.filter((name) => sql.includes("'" + name + "'")).map((TableName) => ({ TableName })) }
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

test('department template does not write ParentName when the real legacy schema omits it', () => {
  const { result } = run([], { departmentParentNameMissing: true })
  assert.equal(result.Code, 1)
  const statement = result.Data.Sql.match(/INSERT INTO sys_dept[\s\S]*?;/)[0]
  assert.doesNotMatch(statement, /ParentName/)
  assert.match(statement, /'默认组织'/)
  assert.match(statement, /'默认部门'/)
})

test('department schema discovery fails closed before emitting destructive SQL', () => {
  const { result } = run([], { departmentColumnFailure: true })
  assert.equal(result.Code, 0)
  assert.match(result.Msg, /组织机构字段/)
  assert.equal(result.Data?.Sql, undefined)
})

test('promotion templates retain schema, clear referral data and disable public registration', () => {
  const { result } = run([{ Id: 'custom', AppPakcet: JSON.stringify({ DiyTables: [{ Name: 'mci_saas_referral_link' }] }) }], {
    optionalTables: ['mci_saas_referral_link'],
    promotionFields: ['ReferralUserId', 'ReferralLinkId', 'PublicTrialRequestId', 'PublicTrialProvisioned', 'TrialEndTime',
      'SaasPublicTrialEnabled', 'SaasPublicTrialWebBase', 'SaasPromotionManagerRoleIds', 'DbConn']
  })
  assert.equal(result.Code, 1)
  assert.ok(result.Data.ProtectedPlatformTables.includes('mci_saas_referral_link'))
  assert.ok(!result.Data.ApplicationOwnedTables.includes('mci_saas_referral_link'))
  assert.match(result.Data.Sql, /DELETE FROM mci_saas_referral_link;/)
  assert.match(result.Data.Sql, /`ReferralUserId`=NULL/)
  assert.match(result.Data.Sql, /`SaasPublicTrialEnabled`=0/)
  assert.match(result.Data.Sql, /`PublicTrialProvisioned`=0/)
  assert.match(result.Data.Sql, /`SaasPromotionManagerRoleIds`=NULL/)
  assert.doesNotMatch(result.Data.Sql, /`DbConn`=NULL/)
})

test('legacy templates omit missing promotion columns and fail closed when their schema cannot be read', () => {
  const legacy = run([], { optionalTables: [], promotionFields: [] }).result
  assert.equal(legacy.Code, 1)
  assert.doesNotMatch(legacy.Data.Sql, /`ReferralUserId`=/)
  assert.doesNotMatch(legacy.Data.Sql, /DELETE FROM mci_saas_referral_link;/)
  assert.notEqual(run([], { promotionColumnFailure: true }).result.Code, 1)
})

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
  assert.equal(queries.filter((sql) => /FROM\s+sys_microistore\b/i.test(sql)).length, 1)
  const installedQuery = queries.find((sql) => /FROM\s+sys_microistoreversion\b/i.test(sql))
  assert.match(installedQuery, /SELECT StoreId, AppId FROM sys_microistoreversion/)
  assert.doesNotMatch(installedQuery, /SELECT\s+\*|InstallResult|AppPakcet/i)
  assert.match(queries[0], /JSON_VALID\(AppPakcet\)/)
  assert.match(queries[0], /JSON_EXTRACT\(SelectTable, '\$\[\*\]\.Name'\)/)
  assert.match(queries[0], /JSON_EXTRACT\(AppPakcet, '\$\.DiyTables\[\*\]\.Name'\)/)
  assert.doesNotMatch(queries[0], /JSON_EXTRACT\(AppPakcet, '\$\.DiyFields/)
  assert.doesNotMatch(queries[0], /JSON_EXTRACT\(AppPakcet, '\$\.ApplicationBundles/)
  assert.doesNotMatch(queries[0], /JSON_EXTRACT\(AppPakcet, '\$\.DDLStatements/)
  assert.doesNotMatch(queries[0], /JSON_EXTRACT\(AppPakcet, '\$\*\*\.TableName'\)/)
  assert.match(queries[0], /JSON_EXTRACT\(SelectApiEngine, '\$\[\*\]\.ApiEngineKey'\)/)
  assert.match(queries[0], /JSON_EXTRACT\(AppPakcet, '\$\.SysApiEngines\[\*\]\.ApiEngineKey'\)/)
  assert.doesNotMatch(queries[0], /JSON_EXTRACT\(AppPakcet, '\$\*\*/)
  assert.doesNotMatch(queries[0].split(/\bCASE\b/i, 1)[0], /\bAppPakcet\b/i)
  assert.match(queries[1], /FROM sys_apiengine/)
})

test('large non-DiyTables ownership nodes are deferred to backend recursive reconciliation', () => {
  const { result } = run([
    {
      Id: 'structured-app',
      AppKey: 'structured-app',
      ApplicationType: 'Regular',
      AppPakcet: JSON.stringify({
        DiyFields: [{ TableName: 'OnlyInDiyFields' }],
        DataSets: [{ TableName: 'OnlyInDataSets' }],
        DDLStatements: [{ TableName: 'OnlyInDdlMetadata', DDL: 'CREATE TABLE IF NOT EXISTS `OnlyInDdlText` (`Id` varchar(36));' }],
        PhysicalColumns: [{ TableName: 'OnlyInPhysicalColumns' }],
        ApplicationBundles: [{ TableName: 'OnlyInApplicationBundles' }],
        SysMenus: [{ TableName: 'OnlyInSysMenus' }]
      })
    }
  ])

  assert.equal(result.Code, 1)
  assert.deepEqual(result.Data.ApplicationOwnedTables, [])
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
  assert.match(result.Data.Sql, /UPDATE sys_user SET[\s\S]*PwdEncode='DES'/i)
  assert.match(result.Data.Sql, /GiteeUserId='', GiteeLogin=''/i)
  assert.match(result.Data.Sql, /EMPTY_DATABASE_CANONICAL_TENANT_TEMPLATE_V1/)
  assert.match(result.Data.Sql, /DELETE FROM sys_osclients[\s\S]*OsClientType[\s\S]*'PRODUCT'[\s\S]*OsClientNetwork[\s\S]*'INTERNAL'/i)
  assert.match(result.Data.Sql, /update sys_osclients set OsClient='iTdos',OsClientType='Product',OsClientNetwork='Internal',IsEnable=1,IsDeleted=0/i)
  assert.match(result.Data.Sql, /EMPTY_DATABASE_PLATFORM_RUNTIME_POINTER_NEUTRALIZATION_V1/)
  assert.match(result.Data.Sql, /UPDATE sys_microistore[\s\S]*PublishProtocolVersion\s*=\s*2[\s\S]*PublishState\s*=\s*'LegacyUnverified'/i)
  assert.match(result.Data.Sql, /ActivePublishVersionId\s*=\s*NULL[\s\S]*CommittedPublishVersionId\s*=\s*NULL[\s\S]*CommittedRuntimeManifestHash\s*=\s*NULL/i)
  assert.match(result.Data.Sql, /WHERE LOWER\(COALESCE\(AppKey, ''\)\) = 'microi-platform-service'/i)
  assert.match(result.Data.Sql, /DELETE from sys_business_blueprint;/)
  assert.match(result.Data.Sql, /DELETE l FROM diy_lang l/)
  assert.match(result.Data.Sql, /SUBSTRING_INDEX\(COALESCE\(l\.\`Key\`, ''\), ':', 2\)/)
  assert.match(result.Data.Sql, /l\.\`Key\` LIKE 'diy_field:%'/)
  assert.match(result.Data.Sql, /l\.\`Key\` LIKE 'diy_table:%'/)
  assert.doesNotMatch(result.Data.Sql, /LIKE CONCAT\('diy_field:', LOWER\(x\.Name\)/)
  for (const table of [
    'mci_background_task', 'mci_database_backup', 'mci_gitee_star_audit',
    'mci_system_setting', 'mci_user_external_identity', 'mci_user_access_key', 'diy_sso',
    'mci_identity_connector', 'mci_identity_credential', 'mci_identity_device', 'mci_identity_face',
    'mci_identity_group', 'mci_identity_group_member', 'mci_identity_sync_conflict', 'mci_identity_sync_run',
    'mci_identity_tag', 'mci_identity_tag_assignment', 'mci_identity_totp',
    'mci_ai_token_account', 'mci_file_remote_connection', 'mci_spider_account', 'mci_redis_connection',
    'sys_servernode', 'sys_sourcedatatable', 'microi_database', 'wx_mp', 'wx_menu',
    'mci_marketplace_install_event', 'mci_tenant_quota_log', 'mic_msg_event_log',
    'mci_network_traffic_rollup', 'mci_app_stream_gate_transition', 'mci_nuget_stats_daily',
    'microi_job_locks', 'wx_mini_program', 'wx_tpl_msg', 'mic_msgset'
  ]) {
    assert.match(result.Data.Sql, new RegExp(`DELETE FROM ${table};`, 'i'))
    assert.ok(result.Data.ProtectedPlatformTables.includes(table))
  }
  assert.match(result.Data.Sql, /DELETE from sys_datasource\s+WHERE LOWER\(COALESCE\(DataSourceKey, ''\)\) <> 'virtual-table-personal-setting';/)
  assert.doesNotMatch(result.Data.Sql, /DROP TABLE IF EXISTS mci_ai_token_account/)
})

test('mail and runtime history data are removed only from present tables while schemas remain protected', () => {
  const tables = ['mci_email_account', 'mci_email_message', 'mci_email_sync_log',
    'mci_apiengine_change_history', 'mci_vision_request', 'mci_vision_subject', 'mci_vision_sample']
  for (const optionalTables of [tables, []]) {
    const { result } = run([], { optionalTables })
    assert.equal(result.Code, 1)
    for (const table of tables) {
      const statement = new RegExp(`DELETE FROM ${table};`, 'i')
      if (optionalTables.length) assert.match(result.Data.Sql, statement)
      else assert.doesNotMatch(result.Data.Sql, statement)
      assert.ok(result.Data.ProtectedPlatformTables.includes(table))
      assert.doesNotMatch(result.Data.Sql, new RegExp(`DROP TABLE(?: IF EXISTS)? ${table}\\b`, 'i'))
    }
  }
})

test('unpackaged standard suite tables, orphan batch roots and source roots enter empty database cleanup', () => {
  const tables = ['mci_crm_customer', 'mci_cms_content', 'mci_oa_claim', 'mci_inv_doc', 'mci_cat_sku', 'mci_pt_party']
  const { result } = run([], {
    suitePhysicalTables: [...tables, 'sys_user', 'mci_inventory_other'],
    evidenceEngineRows: [{ ApiEngineKey: 'mci-inv-business' }, { ApiEngineKey: 'mci-catalog-access' }],
    menuPages: [[
      { Id: 'old-child', ParentId: 'batch', Name: '业务数据' },
      { Id: 'batch', ParentId: '', Name: 'AI应用后台·industry250' },
      { Id: 'std-child', ParentId: 'inv', Name: '仓库' },
      { Id: 'inv', ParentId: '', Name: '吾码进销存' },
      { Id: 'assistant', ParentId: '', Name: 'AI助手' }
    ]]
  })
  assert.equal(result.Code, 1)
  assert.deepEqual(result.Data.ApplicationOwnedTables, tables.sort())
  assert.deepEqual(result.Data.AiApplicationMenuIds, ['batch', 'inv', 'old-child', 'std-child'])
  assert.ok(result.Data.ApplicationOwnedEngineKeys.includes('mci-inv-business'))
  assert.doesNotMatch(result.Data.Sql, /temp_app_owned_tables \(Name\) VALUES[^;]*\('sys_user'\)/)
})

test('standard suite physical discovery failure prevents incomplete cleanup SQL', () => {
  const { result } = run([], { suiteDiscoveryFailure: true })
  assert.equal(result.Code, 0)
  assert.match(result.Msg, /标准应用.*停止/)
})

test('top-level AI application menu tree is removed recursively while AI assistant stays', () => {
  const { result } = run([], {
    menuPages: [[
      // Intentionally put descendants before their parent to prove the fixed-point walk,
      // rather than relying on database row order.
      { Id: 'ai-app-page', ParentId: 'ai-category', Name: '合同审查助手' },
      { Id: 'ai-category', ParentId: 'ai-app-root', Name: '办公效率' },
      { Id: 'ai-app-root', ParentId: '', Name: 'AI 应用' },
      { Id: 'ai-assistant', ParentId: 'system-root', Name: 'AI助手' },
      { Id: 'nested-ai-app-name', ParentId: 'system-root', Name: 'AI应用' }
    ]]
  })

  assert.equal(result.Code, 1)
  assert.equal(result.Data.AiApplicationMenuCount, 3)
  assert.deepEqual(result.Data.AiApplicationMenuIds, [
    'ai-app-page',
    'ai-app-root',
    'ai-category'
  ])
  assert.match(result.Data.Sql, /INSERT IGNORE INTO temp_app_menu_ids \(Id\) VALUES \('ai-app-page'\),\('ai-app-root'\),\('ai-category'\);/)
  assert.doesNotMatch(result.Data.Sql, /\('ai-assistant'\)/)
  assert.doesNotMatch(result.Data.Sql, /\('nested-ai-app-name'\)/)
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

test('owned flow topology is removed before its forms while unrelated workflow definitions remain', () => {
  const { result } = run([])
  assert.equal(result.Code, 1)
  const sql = result.Data.Sql
  assert.match(sql, /SELECT d.Id FROM wf_flowdesign d JOIN temp_app_diy_table_ids t ON d.TableId = t.Id/)
  assert.match(sql, /DELETE l FROM wf_line l JOIN temp_app_flow_ids f ON l.FlowDesignId = f.Id/)
  assert.match(sql, /DELETE n FROM wf_node n JOIN temp_app_flow_ids f ON n.FlowDesignId = f.Id/)
  assert.match(sql, /DELETE d FROM wf_flowdesign d JOIN temp_app_flow_ids f ON d.Id = f.Id/)
  assert.ok(sql.indexOf('DELETE l FROM wf_line l JOIN temp_app_flow_ids') < sql.indexOf('DELETE d FROM wf_flowdesign d JOIN temp_app_flow_ids'))
  assert.ok(sql.indexOf('DELETE d FROM wf_flowdesign d JOIN temp_app_flow_ids') < sql.indexOf('DELETE t FROM diy_table t'))
  assert.doesNotMatch(sql, /DELETE FROM wf_flowdesign;/i)
  assert.match(sql, /DROP TEMPORARY TABLE temp_app_flow_ids;/)
})

test('owned print API references and standard page routes are cleaned without removing platform templates', () => {
  const { result } = run([])
  const sql = result.Data.Sql
  assert.match(sql, /DELETE p FROM mic_print p[\s\S]*p.DataApi = a.Id[\s\S]*temp_app_owned_engines/)
  assert.ok(sql.indexOf('DELETE p FROM mic_print p') < sql.indexOf('DELETE FROM sys_apiengine'))
  assert.match(sql, /p.Title = '吾码CRM销售报价'/)
  assert.match(sql, /DELETE p FROM mic_page p[\s\S]*'\/mci-cms\/'/)
  assert.doesNotMatch(sql, /DELETE FROM mic_page;|DELETE FROM mic_print;/i)
})

test('ordinary application declarations cannot claim physical page print or workflow engine tables', () => {
  const names = ['mic_page', 'mic_print', 'wf_flowdesign', 'wf_node', 'wf_line', 'sys_microistore_package', 'sys_role', 'sys_dept', 'sys_userfk']
  const { result } = run([{ Id: 'business', AppKey: 'business', ApplicationType: 'Regular', AppPakcet: JSON.stringify({ DiyTables: names.map(Name => ({ Name })) }) }], { menuPages: [[]] })
  assert.equal(result.Code, 1)
  assert.deepEqual(result.Data.ApplicationOwnedTables, [])
  for (const name of names) {
    assert.ok(result.Data.ProtectedPlatformTables.includes(name), name)
    assert.ok(result.Data.Sql.includes("'" + name + "'"))
  }
})

test('application HDFS package indices are removed before stores without purging platform indices or older schemas', () => {
  const present = run([], { optionalTables: ['sys_microistore_package'] }).result
  assert.equal(present.Code, 1)
  assert.match(present.Data.Sql, /DELETE p FROM sys_microistore_package p\s+JOIN temp_ai_apps a ON p.StoreId = a.Id;/)
  assert.ok(present.Data.Sql.indexOf('DELETE p FROM sys_microistore_package p') < present.Data.Sql.indexOf('DELETE s FROM sys_microistore s'))
  assert.doesNotMatch(present.Data.Sql, /DELETE FROM sys_microistore_package;/i)
  const absent = run([], { optionalTables: [] }).result
  assert.equal(absent.Code, 1)
  assert.doesNotMatch(absent.Data.Sql, /DELETE p FROM sys_microistore_package p/)
})

test('empty template retains the current administrator role and creates an isolated read-only demo role', () => {
  const { result } = run([])
  assert.equal(result.Code, 1)
  assert.deepEqual(result.Data.TemplateRoleIds, [
    '5db47859-35a3-411a-a1f7-99482e057d24', 'f0000000-0000-4000-8000-000000000001'
  ])
  const sql = result.Data.Sql
  assert.match(sql, /DELETE FROM sys_role WHERE Id <> '5db47859-35a3-411a-a1f7-99482e057d24';/)
  assert.match(sql, /DELETE FROM sys_rolelimit WHERE RoleId <> '5db47859-35a3-411a-a1f7-99482e057d24';/)
  assert.match(sql, /RoleIds=CASE WHEN LOWER\(Account\)='admin' THEN '\[\{"Id":"5db47859-35a3-411a-a1f7-99482e057d24","Name":"超级管理员","Level":9999\}\]'/)
  assert.match(sql, /ELSE '\[\{"Id":"f0000000-0000-4000-8000-000000000001","Name":"演示角色","Level":0\}\]'/)
  assert.match(sql, /RolePermissionDetails='\[\]', DeptIds='\[\]'/)
  assert.match(sql, /VALUES \('f0000000-0000-4000-8000-000000000001', '演示角色', 0, '\["OnlyGet"\]'/)
  assert.doesNotMatch(sql, /949b2e88-cfa1-44cd-b234-85f043785ece/)
  assert.match(sql, /LEFT JOIN sys_role r ON r.Id=rl.RoleId[\s\S]*WHERE r.Id IS NULL/)
  assert.match(sql, /LEFT JOIN diy_table t ON t.Id=rl.FkId[\s\S]*LOWER\(COALESCE\(rl.Type,''\)\)='table' AND t.Id IS NULL/)
  assert.ok(sql.lastIndexOf('EMPTY_DATABASE_ROLE_PERMISSION_RESIDUE_V1') > sql.lastIndexOf("delete from sys_menu where"))
})

test('missing, ambiguous, unbound, deleted or unreadable administrator identity rejects incomplete empty template', () => {
  for (const options of [
    { roleReadFailure: true }, { adminReadFailure: true }, { adminUsers: [] },
    { adminUsers: [{ Level: 0, RoleIds: '[]' }] },
    { adminUsers: [{ Level: 9999, RoleIds: '{invalid' }] },
    { adminUsers: [{ Level: 9999, RoleIds: '[]' }] },
    { adminUsers: [{ Level: 9999, RoleIds: '[]' }, { Level: 9999, RoleIds: '[]' }] },
    { templateRoles: [] },
    { templateRoles: [{ Id: '5db47859-35a3-411a-a1f7-99482e057d24', Level: 0, IsDeleted: 0 }] },
    { templateRoles: [{ Id: '5db47859-35a3-411a-a1f7-99482e057d24', Level: 9999, IsDeleted: 1 }] },
    { templateRoles: [{ Id: 'other-role', Level: 9999, IsDeleted: 0 }] },
    { adminUsers: [{ Level: 9999, RoleIds: '[{"Id":"role-a"},{"Id":"role-b"}]' }], templateRoles: [
      { Id: 'role-a', Level: 9999, IsDeleted: 0 }, { Id: 'role-b', Level: 9999, IsDeleted: 0 }] }
  ]) {
    const { result } = run([], options)
    assert.equal(result.Code, 0)
    assert.match(result.Msg, /初始身份/)
    assert.equal(result.Data?.Sql, undefined)
  }
})

test('orphan installations require a retained platform identity, never a name or loose prefix', () => {
  const { result } = run([], { optionalTables: ['sys_microistoreversion', 'sys_appinstalled'] })
  assert.equal(result.Code, 1)
  const sql = result.Data.Sql
  assert.match(sql, /CREATE TEMPORARY TABLE IF NOT EXISTS temp_core_apps/)
  assert.match(sql, /DELETE iv FROM sys_microistoreversion iv\s+LEFT JOIN temp_core_apps p/)
  assert.match(sql, /COALESCE\(iv.StoreId,''\)<>'' AND iv.StoreId=p.Id/)
  assert.match(sql, /COALESCE\(iv.StoreId,''\)='' AND iv.AppId<>'' AND iv.AppId IN \(p.Id,p.AppId,p.AppKey\)/)
  assert.match(sql, /WHERE p.Id IS NULL OR COALESCE\(iv.IsDeleted,0\)<>0;/)
  assert.match(sql, /DELETE ai FROM sys_appinstalled ai\s+LEFT JOIN temp_core_apps p/)
  assert.match(sql, /DROP TEMPORARY TABLE temp_core_apps;/)
  const absent = run([], { optionalTables: [] }).result
  assert.doesNotMatch(absent.Data.Sql, /DELETE iv FROM sys_microistoreversion iv|DELETE ai FROM sys_appinstalled ai/)
})

test('empty template rebuilds a minimal organization and user department names without legacy account links', () => {
  const { result } = run([], { optionalTables: ['sys_userfk'] })
  assert.equal(result.Code, 1)
  assert.deepEqual(result.Data.TemplateDepartmentIds, ['f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003'])
  assert.match(result.Data.Sql, /DELETE FROM sys_dept;/)
  assert.match(result.Data.Sql, /DeptId='f0000000-0000-4000-8000-000000000003', DeptName='默认部门', DeptIds='\[\]'/)
  assert.match(result.Data.Sql, /\('f0000000-0000-4000-8000-000000000002', '默认组织', '00000000-0000-0000-0000-000000000000'/)
  assert.match(result.Data.Sql, /\('f0000000-0000-4000-8000-000000000003', '默认部门', 'f0000000-0000-4000-8000-000000000002', '默认组织'/)
  assert.doesNotMatch(result.Data.Sql, /933da282-adf7-4b1d-90f9-bfad70dae3a5|b4612bd0-f318-40f3-a620-547fa3e9cbc2/)
  assert.match(result.Data.Sql, /DELETE FROM sys_userfk;/)
  const absent=run([], { optionalTables: [] }).result
  assert.doesNotMatch(absent.Data.Sql, /DELETE FROM sys_userfk;/)
})

test('invalid, repeated or unavailable template identifiers prevent publishing a broken organization', () => {
  for (const options of [
    { guidFailure: true }, { generatedIds: ['invalid'] }, { generatedIds: [] },
    { generatedIds: Array(8).fill('f0000000-0000-4000-8000-000000000001') }
  ]) {
    const { result }=run([],options)
    assert.equal(result.Code,0)
    assert.match(result.Msg,/初始身份/)
    assert.equal(result.Data?.Sql,undefined)
  }
})

test('portable templates use tenant administrator identity and never depend on pre-existing demo or organization IDs', () => {
  const {result, queries} = run([], { adminUsers: [{ Level: 9999, RoleIds: '[{"Id":"tenant-admin-role"}]' }],
    templateRoles: [{ Id: 'tenant-admin-role', Level: 9999, IsDeleted: 0 }], templateDepartments: [], departmentReadFailure: true })
  assert.equal(result.Code, 1)
  assert.equal(result.Data.TemplateRoleIds[0], 'tenant-admin-role')
  assert.match(result.Data.Sql, /WHERE Id <> 'tenant-admin-role'/)
  assert.equal(new Set([...result.Data.TemplateRoleIds, ...result.Data.TemplateDepartmentIds]).size, 4)
  assert.ok(queries.every(sql => !/FROM\s+sys_dept\b/i.test(sql)), '业务组织不能作为空库中性身份的前置依赖')
})

test('unavailable encryption, plaintext ciphertext or reused random secrets reject unsafe demonstration credentials', () => {
  for (const options of [{ encryptionFailure: true }, { plaintextCipher: true },
    { generatedIds: ['f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000003',
      'f0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000005','f0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000005'] }]) {
    const {result} = run([], options)
    assert.equal(result.Code, 0)
    assert.match(result.Msg, /演示凭据/)
    assert.equal(result.Data?.Sql, undefined)
  }
})
