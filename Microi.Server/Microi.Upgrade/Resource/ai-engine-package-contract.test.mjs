import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  aiRemovedDuplicateTableNames,
  aiRuntimeTableNames,
  aiSubscriptionTableNames,
  configurePackageModel,
  packageDefinitions,
} from './configure-v8-first-platform-packages.mjs';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(resourceRoot, '..', '..', '..');
const aiDefinition = packageDefinitions.find(
  definition => definition.file === 'app.microi.ai-engine.json',
);
const sysUserDefinition = packageDefinitions.find(
  definition => definition.file === 'app.microi.sys_user.json',
);
const expectedKeys = [
  'mci_ai_data_assistant',
  'platform-ai-account',
  'platform-ai-runtime',
  'platform-ai-custom-hook',
];
const legacyStoreEngineKeys = [
  'ai_app_list',
  'ai_app_detail',
  'ai_app_get_file',
  'ai_app_save_file',
  'ai_app_create',
  'ai_app_build',
  'ai_app_preview',
  'ai_app_download_source_zip',
  'ai_app_download_build_zip',
  'ai_app_moveobject_probe',
  'ai_app_moveobject_exec_probe',
  'ai_app_publish_store',
];

function fixtureEngine(key, code = 'return { Code: 1 };') {
  return {
    Id: `fixture-${key}`,
    ApiEngineKey: key,
    ApiName: key,
    ApiAddress: `/apiengine/${key}`,
    ApiV8Code: code,
    Version: 'v1.0.0',
    IsDeleted: 0,
    IsEnable: 1,
  };
}

function createV634Fixture() {
  const assistantSource = `// Microi official AI data assistant
// Version: v1.1.4
function runDataAssistant() {
  var action = String(V8.Param.Action || V8.Param.action || 'chat').toLowerCase();
  return { Code: 1, Data: { Action: action } };
}
return runDataAssistant();`;
  const engines = [
    fixtureEngine('mci_ai_data_assistant', assistantSource),
    ...legacyStoreEngineKeys.map(key => fixtureEngine(key)),
    fixtureEngine('unexpected_ai_engine'),
  ];
  const tableNames = [
    'mic_ai',
    'app_mic_aiapp',
    'mci_ai_app',
    ...aiRemovedDuplicateTableNames,
  ];
  const tables = tableNames.map((name, index) => ({
    Id: `legacy-table-${index}`,
    Name: name,
    Description: name,
  }));
  return {
    PackageInfo: {
      Name: 'AI助手',
      Version: 'v6.3.4',
      RequiredPlatformCapabilities: [],
      ChangeHistory: '',
    },
    DDLStatements: tables.map(table => ({
      TableName: table.Name,
      TableId: table.Id,
      DDL: `CREATE TABLE IF NOT EXISTS \`${table.Name}\` (\`Id\` varchar(36) NOT NULL);`,
    })),
    PhysicalColumns: tables.map(table => ({
      TABLE_NAME: table.Name,
      COLUMN_NAME: 'Id',
      COLUMN_TYPE: 'varchar(36)',
      DATA_TYPE: 'varchar',
      IS_NULLABLE: 'NO',
      COLUMN_DEFAULT: null,
      COLUMN_COMMENT: '',
      COLUMN_KEY: 'PRI',
      EXTRA: '',
      ORDINAL_POSITION: 1,
    })),
    DiyTables: tables,
    DiyFields: tables.map(table => ({
      Id: `legacy-field-${table.Id}`,
      TableId: table.Id,
      TableName: table.Name,
      Name: 'Id',
      Type: 'varchar(36)',
    })),
    DataSets: tables.map(table => ({
      TableId: table.Id,
      TableName: table.Name,
      Rows: [{ Id: `legacy-row-${table.Id}` }],
    })),
    SysApiEngines: engines,
    ResourcePolicies: {
      SchemaVersion: 1,
      ApiEngines: Object.fromEntries(engines.map(engine => [
        engine.ApiEngineKey,
        { Ownership: 'Platform', UpgradePolicy: 'Managed' },
      ])),
    },
  };
}

function configuredFixture() {
  return configurePackageModel(createV634Fixture(), aiDefinition);
}

test('AI media model fields install as nullable metadata without copying provider configuration', () => {
  const source = JSON.parse(fs.readFileSync(path.join(resourceRoot, aiDefinition.file), 'utf8'));
  const regenerated = configurePackageModel(structuredClone(source), aiDefinition);
  assert.deepEqual(regenerated, source);
  for (const name of ['MediaProtocol', 'MediaModels']) {
    const field = source.DiyFields.filter(x => x.TableName === 'mic_ai' && x.Name === name);
    const column = source.PhysicalColumns.filter(x => x.TABLE_NAME === 'mic_ai' && x.COLUMN_NAME === name);
    assert.equal(field.length, 1); assert.equal(column.length, 1);
    assert.equal(field[0].Tab, '高级配置'); assert.equal(field[0].Visible, 1); assert.equal(column[0].IS_NULLABLE, 'YES');
    assert.ok(source.DDLStatements.find(x => x.TableName === 'mic_ai').DDL.includes('`' + name + '`'));
  }
  const protocol = source.DiyFields.find(x => x.TableName === 'mic_ai' && x.Name === 'MediaProtocol');
  assert.equal(JSON.parse(protocol.Config).SelectSaveField, 'Key');
  assert.equal(protocol.FormWidth ?? null, null);
  assert.equal(source.DataSets.filter(x => x.TableName === 'mic_ai').length, 0);
});

function engine(model, key) {
  return model.SysApiEngines.find(item => item.ApiEngineKey === key);
}

test('AI assistant v7.7.2 has an exact four-engine closure', () => {
  assert.ok(aiDefinition, 'missing app.microi.ai-engine package definition');
  assert.equal(aiDefinition.version, 'v7.7.2');
  assert.deepEqual([...aiDefinition.exactEngineKeys].sort(), [...expectedKeys].sort());
  assert.deepEqual([...aiDefinition.removeEngines].sort(), [...legacyStoreEngineKeys].sort());

  const model = configuredFixture();
  const actualKeys = model.SysApiEngines.map(item => item.ApiEngineKey);
  assert.deepEqual([...actualKeys].sort(), [...expectedKeys].sort());
  assert.equal(new Set(actualKeys).size, 4);
  assert.equal(model.PackageInfo.Version, 'v7.7.2');
  assert.equal(model.PackageInfo.ApiEngineCount, 4);
  assert.deepEqual(
    Object.keys(model.ResourcePolicies.ApiEngines).sort(),
    [...expectedKeys].sort(),
  );
  for (const key of legacyStoreEngineKeys) {
    assert.ok(!actualKeys.includes(key), `${key} must not remain in AI assistant package`);
    assert.ok(!(key in model.ResourcePolicies.ApiEngines), `${key} policy must be removed`);
  }
});

test('AI assistant owns all 11 runtime tables through DDL, physical and low-code metadata', () => {
  const model = configuredFixture();
  assert.equal(aiSubscriptionTableNames.length, 9);
  assert.equal(aiRuntimeTableNames.length, 11);
  assert.equal(new Set(aiRuntimeTableNames.map(name => name.toLowerCase())).size, 11);
  assert.ok(!aiRuntimeTableNames.includes('mci_ai_token_recharge'));

  for (const tableName of aiRuntimeTableNames) {
    const tables = model.DiyTables.filter(row => row.Name === tableName);
    const ddls = model.DDLStatements.filter(row => row.TableName === tableName);
    const columns = model.PhysicalColumns.filter(row => row.TABLE_NAME === tableName);
    const fields = model.DiyFields.filter(row => row.TableName === tableName);
    assert.equal(tables.length, 1, `${tableName} must have one DiyTable`);
    assert.equal(ddls.length, 1, `${tableName} must have one DDL statement`);
    assert.ok(columns.length > 0, `${tableName} must have physical columns`);
    assert.equal(fields.length, columns.length, `${tableName} fields must match physical columns`);
    assert.deepEqual(
      fields.map(row => row.Name).sort(),
      columns.map(row => row.COLUMN_NAME).sort(),
      `${tableName} low-code and physical field names must match`,
    );
    assert.equal(ddls[0].TableId, tables[0].Id);
    assert.match(
      ddls[0].DDL,
      new RegExp(`^CREATE TABLE IF NOT EXISTS [\u0060"]?${tableName}[\u0060"]?`, 'i'),
    );
    assert.doesNotMatch(ddls[0].DDL, /(?:^|;\s*)(?:INSERT|UPDATE|DELETE|ALTER)\s|UUID\s*\(/im);
    for (const column of columns) {
      assert.match(column.COLUMN_TYPE, /^[a-z]+(?:\([0-9,]+\))?$/);
      assert.match(column.DATA_TYPE, /^[a-z]+$/);
      assert.ok(['YES', 'NO'].includes(column.IS_NULLABLE));
      assert.ok(Number(column.ORDINAL_POSITION) > 0);
    }
  }

  const promptPreview = model.PhysicalColumns.find(row => (
    row.TABLE_NAME === 'mci_ai_token_log' && row.COLUMN_NAME === 'PromptPreview'
  ));
  const promptField = model.DiyFields.find(row => (
    row.TableName === 'mci_ai_token_log' && row.Name === 'PromptPreview'
  ));
  assert.equal(promptPreview.COLUMN_TYPE, 'varchar(200)');
  assert.equal(promptField.Type, 'varchar(200)');
  assert.equal(promptField.Visible, 0);
  assert.equal(promptField.AppVisible, 0);
  assert.equal(
    model.PhysicalColumns.find(row => (
      row.TABLE_NAME === 'mci_ai_token_log' && row.COLUMN_NAME === 'Question'
    )).COLUMN_TYPE,
    'longtext',
  );
  assert.equal(model.PackageInfo.TableCount, model.DiyTables.length);
  assert.equal(model.PackageInfo.FieldCount, model.DiyFields.length);
  assert.equal(model.PackageInfo.DDLCount, model.DDLStatements.length);
  assert.equal(model.PackageInfo.PhysicalColumnCount, model.PhysicalColumns.length);
});

test('AI assistant drops three duplicate Store tables from every package resource layer', () => {
  const model = configuredFixture();
  for (const tableName of aiRemovedDuplicateTableNames) {
    assert.ok(!model.DiyTables.some(row => row.Name === tableName));
    assert.ok(!model.DDLStatements.some(row => row.TableName === tableName));
    assert.ok(!model.PhysicalColumns.some(row => row.TABLE_NAME === tableName));
    assert.ok(!model.DiyFields.some(row => row.TableName === tableName));
    assert.ok(!model.DataSets.some(row => row.TableName === tableName));
  }
  for (const tableName of ['app_mic_aiapp', 'mci_ai_app']) {
    assert.ok(model.DiyTables.some(row => row.Name === tableName), `${tableName} must remain AI-owned`);
  }
  assert.ok(!model.DiyTables.some(row => String(row.Name).toLowerCase() === 'sys_user'));
});

test('the 11 new AI runtime tables have no competing local official package owner', () => {
  const otherPackages = fs.readdirSync(resourceRoot)
    .filter(file => /^app\..+\.json$/i.test(file) && file !== 'app.microi.ai-engine.json')
    .map(file => ({
      file,
      model: JSON.parse(fs.readFileSync(path.join(resourceRoot, file), 'utf8')),
    }));
  for (const tableName of aiRuntimeTableNames) {
    const owners = otherPackages
      .filter(item => (item.model.DiyTables || []).some(row => (
        String(row.Name || '').toLowerCase() === tableName.toLowerCase()
      )))
      .map(item => item.file);
    assert.deepEqual(owners, [], `${tableName} has competing owners: ${owners.join(',')}`);
  }
});

test('generated AI and system-account package JSON files are idempotent with exact counts', () => {
  const expectations = [
    {
      definition: aiDefinition,
      file: 'app.microi.ai-engine.json',
      counts: {
        TableCount: 17,
        FieldCount: 250,
        DDLCount: 17,
        PhysicalColumnCount: 526,
        ApiEngineCount: 4,
        DataSetCount: 1,
        DataRowCount: 6,
      },
    },
    {
      definition: sysUserDefinition,
      file: 'app.microi.sys_user.json',
      counts: {
        TableCount: 3,
        FieldCount: 91,
        DDLCount: 3,
        PhysicalColumnCount: 352,
        ApiEngineCount: 8,
        DataSetCount: 0,
        DataRowCount: 0,
      },
    },
  ];
  for (const expectation of expectations) {
    const source = JSON.parse(fs.readFileSync(path.join(resourceRoot, expectation.file), 'utf8'));
    const regenerated = configurePackageModel(structuredClone(source), expectation.definition);
    assert.deepEqual(regenerated, source, `${expectation.file} generator must be idempotent`);
    for (const [name, value] of Object.entries(expectation.counts)) {
      assert.equal(source.PackageInfo[name], value, `${expectation.file} ${name}`);
    }
  }
});

test('Sys_User.AiApiKey belongs to the system-account package in all schema layers', () => {
  const sourcePackage = JSON.parse(fs.readFileSync(
    path.join(resourceRoot, 'app.microi.sys_user.json'),
    'utf8',
  ));
  const model = configurePackageModel(sourcePackage, sysUserDefinition);
  const userTable = model.DiyTables.find(row => String(row.Name).toLowerCase() === 'sys_user');
  const ddl = model.DDLStatements.find(row => String(row.TableName).toLowerCase() === 'sys_user');
  const columns = model.PhysicalColumns.filter(row => (
    String(row.TABLE_NAME).toLowerCase() === 'sys_user'
    && String(row.COLUMN_NAME).toLowerCase() === 'aiapikey'
  ));
  const fields = model.DiyFields.filter(row => (
    String(row.TableName).toLowerCase() === 'sys_user'
    && String(row.Name).toLowerCase() === 'aiapikey'
  ));
  assert.ok(userTable);
  assert.equal(columns.length, 1);
  assert.equal(columns[0].COLUMN_TYPE, 'varchar(200)');
  assert.equal(fields.length, 1);
  assert.equal(fields[0].TableId, userTable.Id);
  assert.equal(fields[0].Visible, 0);
  assert.equal(fields[0].AppVisible, 0);
  assert.equal(fields[0].Readonly, 1);
  assert.equal([...ddl.DDL.matchAll(/`AiApiKey`\s+varchar\(200\)/gi)].length, 1);
  assert.ok(!configuredFixture().DiyTables.some(row => (
    String(row.Name).toLowerCase() === 'sys_user'
  )));

  const subscriptionService = fs.readFileSync(
    path.join(workspaceRoot, 'Microi.Server', 'Microi.AI', 'SubscriptionService.cs'),
    'utf8',
  );
  assert.match(subscriptionService, /缺少 Sys_User\.AiApiKey 字段，请先升级官方系统账号应用/);
  assert.doesNotMatch(subscriptionService, /缺少 Sys_User\.AiApiKey[^\n]+AI 引擎应用/);
});

test('relay usage schema points missing tables and PromptPreview to the AI assistant package', () => {
  const source = fs.readFileSync(
    path.join(workspaceRoot, 'Microi.Server', 'Microi.AI', 'RelayUsageSchema.cs'),
    'utf8',
  );
  assert.match(source, /缺少 AI 中转站用量表，请先升级官方 AI助手应用/);
  assert.match(source, /缺少 mci_ai_token_log\.PromptPreview 字段，请先升级官方 AI助手应用/);
  assert.doesNotMatch(source, /请先升级官方 AI 引擎应用/);
});

test('all three official engines are Managed and carry a conspicuous restore notice', () => {
  const model = configuredFixture();
  for (const key of ['mci_ai_data_assistant', 'platform-ai-account', 'platform-ai-runtime']) {
    const policy = model.ResourcePolicies.ApiEngines[key];
    const source = engine(model, key).ApiV8Code;
    assert.equal(policy.Ownership, 'Platform');
    assert.equal(policy.UpgradePolicy, 'Managed');
    assert.match(source, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
    assert.match(source, /极重要：这是官方应用托管接口/);
    assert.match(source, /安装、更新或重新安装“AI助手”，都会以官方源码恢复/);
    assert.match(source, new RegExp(`ApiEngineKey：${key}`));
  }
});

test('the app-wide tenant hook is CreateIfMissing and succeeds by default', () => {
  const model = configuredFixture();
  const policy = model.ResourcePolicies.ApiEngines['platform-ai-custom-hook'];
  const source = engine(model, 'platform-ai-custom-hook').ApiV8Code;
  assert.equal(policy.Ownership, 'Tenant');
  assert.equal(policy.UpgradePolicy, 'CreateIfMissing');
  assert.match(source, /^\/\* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/);
  assert.match(source, /官方更新或重新安装不得覆盖/);
  assert.match(source, /return \{ Code : 1 \};\s*$/);
});

test('data assistant sends only the action envelope to the tenant hook', () => {
  const source = engine(configuredFixture(), 'mci_ai_data_assistant').ApiV8Code;
  const call = source.match(
    /V8\.ApiEngine\.Run\('platform-ai-custom-hook',\s*\{([\s\S]*?)\}\s*\)/,
  );
  assert.ok(call, 'mci_ai_data_assistant must call platform-ai-custom-hook');
  const payload = call[1];
  const fields = [...payload.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)]
    .map(match => match[1])
    .sort();
  assert.deepEqual(fields, ['Action', 'SourceApiEngineKey', 'Stage']);
  assert.doesNotMatch(
    payload,
    /Question|Answer|Prompt|Model|Credential|Authorization|ApiKey\s*:|TaskHandle|FileHandle|Rows?\s*:/i,
  );
});

test('account hook payload excludes prompts, answers, keys and supplier task identifiers', () => {
  const source = engine(configuredFixture(), 'platform-ai-account').ApiV8Code;
  const start = source.indexOf('function runTenantHook');
  const end = source.indexOf('function getPlans', start);
  assert.ok(start >= 0 && end > start);
  const hookSource = source.slice(start, end);
  assert.match(hookSource, /SourceApiEngineKey:\s*'platform-ai-account'/);
  assert.match(hookSource, /Action:\s*actionName/);
  assert.doesNotMatch(
    hookSource,
    /Prompt|Answer|Authorization|ApiKey\b|TaskHandle|FileHandle|TaskId|FileId|task_id|file_id|FirstFrame|LastFrame|Response/i,
  );
});

test('official docs and both AI skills state package ownership and compatibility boundaries', () => {
  const docs = [
    path.join(workspaceRoot, 'microi.doc', 'docs', 'doc', 'system-engine', 'ai-engine.md'),
    path.join(workspaceRoot, 'microi.skills', 'ai-engine', 'SKILL.md'),
    path.join(workspaceRoot, 'Microi.Server', 'Microi.AI', 'Resource', 'skill-ai-engine.md'),
  ].map(file => fs.readFileSync(file, 'utf8'));
  for (const source of docs) {
    assert.match(source, /app\.microi\.ai-engine/);
    assert.match(source, /v6\.3\.6/);
    assert.match(source, /mci_ai_data_assistant/);
    assert.match(source, /platform-ai-account/);
    assert.match(source, /platform-ai-runtime/);
    assert.match(source, /platform-ai-custom-hook/);
    assert.match(source, /app\.microi\.store/);
    assert.match(source, /ai_app_\*/);
    assert.match(source, /不会删除|不删除/);
    assert.match(source, /mci_ai_token_account/);
    assert.match(source, /PromptPreview/);
    assert.match(source, /app\.microi\.sys_user/);
    assert.match(source, /mci_ai_app_version/);
    assert.match(source, /mci_ai_app_file/);
    assert.match(source, /sys_microistore/);
  }
  const packageBoundaryLines = source => source
    .replaceAll('\r\n', '\n')
    .split('\n')
    .filter(line => line.includes('官方 AI助手应用归')
      || line.includes('这 12 个 `ai_app_*` 归')
      || line.includes('9 张 `mic_sub_*` 订阅表')
      || line.includes('`Sys_User.AiApiKey` 归官方')
      || line.includes('v6.3.6 还必须从 AI助手包'));
  assert.deepEqual(packageBoundaryLines(docs[1]), packageBoundaryLines(docs[2]));
});
