import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateOfficialPackageInstallContracts, validateOfficialDataSetSchemaClosure } from './resource-sync-core.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const officialPackageNames = fs.readdirSync(directory)
  .filter(name => /^app\.microi\..+\.json$/.test(name));

function fixture(overrides = {}) {
  return JSON.stringify({
    PackageInfo: { Name: 'SaaS引擎' },
    PhysicalColumns: ['Id', 'JsonObj'].map(COLUMN_NAME => ({ TABLE_NAME: 'mic_page', COLUMN_NAME })),
    DiyTables: [{ Id: 'page-table', Name: 'mic_page' }],
    DiyFields: ['Id', 'JsonObj'].map(Name => ({ TableId: 'page-table', Name })),
    DDLStatements: [{ TableName: 'mic_page', DDL: 'CREATE TABLE `mic_page` (`Id` varchar(36), `JsonObj` mediumtext)' }],
    SysMenus: [],
    DataSets: [],
    ...overrides,
  });
}

function pageDataSet(widget) {
  return [{
    TableName: 'mic_page',
    Rows: [{
      Id: 'PAGE5',
      JsonObj: JSON.stringify({ wrapperList: [{ widgetList: [widget] }] }),
    }],
  }];
}

test('all official packages satisfy physical migration and PageEngine reference contracts', () => {
  for (const name of officialPackageNames) {
    assert.doesNotThrow(
      () => validateOfficialPackageInstallContracts(
        name,
        fs.readFileSync(path.join(directory, name), 'utf8'),
      ),
      name,
    );
  }
});

test('dataset closure rejects missing tables, fields, physical columns and DDL before publication', () => {
  const complete = JSON.parse(fixture({ DataSets: [{ TableName: 'mic_page', Rows: [{ Id: '1', JsonObj: '{}' }], ConflictFields: ['Id'] }] }));
  assert.doesNotThrow(() => validateOfficialDataSetSchemaClosure('fixture', complete));
  for (const key of ['DiyTables', 'DiyFields', 'DDLStatements', 'PhysicalColumns']) {
    assert.throws(() => validateOfficialDataSetSchemaClosure('fixture', { ...complete, [key]: [] }), /缺少完整建表资源/);
  }
  for (const key of ['DiyFields', 'PhysicalColumns']) {
    const incomplete = structuredClone(complete);
    incomplete[key] = incomplete[key].slice(0, 1);
    assert.throws(() => validateOfficialDataSetSchemaClosure('fixture', incomplete), /mic_page.jsonobj/);
  }
  const missingDdlField = structuredClone(complete);
  missingDdlField.DDLStatements[0].DDL = 'CREATE TABLE `mic_page` (`Id` varchar(36))';
  assert.throws(() => validateOfficialDataSetSchemaClosure('fixture', missingDdlField), /mic_page.jsonobj/);
});

test('official package gate rejects a dangling PageEngine diytable reference', () => {
  assert.throws(
    () => validateOfficialPackageInstallContracts('app.microi.saas-engine.json', fixture({
      DataSets: pageDataSet({
        type: 'diytable',
        widgetParams: [{ value: 'table-1' }, { value: 'menu-1' }],
      }),
    })),
    /未闭包 diytable 引用/,
  );
});

test('official package gate accepts an intentional optional PageEngine reference', () => {
  assert.doesNotThrow(
    () => validateOfficialPackageInstallContracts('app.microi.saas-engine.json', fixture({
      DataSets: pageDataSet({
        type: 'diytable',
        referencePolicy: {
          onMissing: 'RemoveWidget',
          reason: 'The announcement module is optional on legacy tenants.',
        },
        widgetParams: [{ value: 'table-1' }, { value: 'menu-1' }],
      }),
    })),
  );
});

test('official package gate requires target-tenant backfill for NOT NULL OsClient', () => {
  const column = {
    TABLE_NAME: 'sys_microistore_changelog',
    COLUMN_NAME: 'OsClient',
    COLUMN_TYPE: 'varchar(50)',
    IS_NULLABLE: 'NO',
    COLUMN_DEFAULT: null,
  };
  assert.throws(
    () => validateOfficialPackageInstallContracts('app.microi.store.json', fixture({
      PackageInfo: { Name: '应用商城' },
      PhysicalColumns: [column],
    })),
    /BACKFILL_VALUE_SOURCE=TargetOsClient/,
  );
  assert.doesNotThrow(
    () => validateOfficialPackageInstallContracts('app.microi.store.json', fixture({
      PackageInfo: { Name: '应用商城' },
      PhysicalColumns: [{ ...column, BACKFILL_VALUE_SOURCE: 'TargetOsClient' }],
    })),
  );
});
