import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const resourceUrl = new URL('./app.microi.store.json', import.meta.url);
const modelSourceUrl = new URL('./get-microi-store-model.js', import.meta.url);
const publisherSourceUrl = new URL('./ai-app-publish-store.js', import.meta.url);
const packageModel = JSON.parse(await readFile(resourceUrl, 'utf8'));
const modelSource = await readFile(modelSourceUrl, 'utf8');
const publisherSource = await readFile(publisherSourceUrl, 'utf8');
const versionAtLeast = (actual, minimum) => {
  const left = String(actual || '').replace(/^v/i, '').split('.').map(value => Number.parseInt(value, 10) || 0);
  const right = String(minimum || '').replace(/^v/i, '').split('.').map(value => Number.parseInt(value, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0);
  }
  return true;
};

const tableName = 'sys_microistore_changelog';
const table = packageModel.DiyTables.find((item) => item.Name === tableName);
const fields = packageModel.DiyFields.filter((item) => item.TableId === table?.Id);
const fieldByName = new Map(fields.map((field) => [field.Name, field]));
const menu = packageModel.SysMenus.find((item) => item.DiyTableId === table?.Id);
const parentTable = packageModel.DiyTables.find((item) => item.Name === 'sys_microistore');
const childField = packageModel.DiyFields.find(
  (item) => item.TableId === parentTable?.Id && item.Component === 'TableChild' && item.Name === 'ChangeLogs',
);
const ddl = packageModel.DDLStatements.find((item) => item.TableName === tableName)?.DDL || '';

test('marketplace changelog is a real indexed 1:N child table', () => {
  assert.ok(table);
  assert.equal(table.EnableDataVersion, 1);
  assert.equal(table.EnableDataComment, 1);
  assert.equal(table.EnableDataLog, 1);
  assert.deepEqual(
    ['OsClient', 'StoreId', 'Version', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'Sort'].filter(
      (name) => !fieldByName.has(name),
    ),
    [],
  );
  assert.equal(fieldByName.get('StoreId').NotEmpty, 1);
  assert.equal(fieldByName.get('OsClient').Visible, 0);
  assert.equal(fieldByName.get('OsClient').Readonly, 1);
  assert.equal(fieldByName.get('Version').NotEmpty, 1);
  assert.equal(fieldByName.get('Content').FormWidth, 24);
  assert.match(ddl, /UNIQUE KEY ux_microistore_changelog_store_version \(OsClient, StoreId, Version\)/);
  assert.match(ddl, /KEY ix_microistore_changelog_store_release \(OsClient, StoreId, ReleaseTime\)/);
  assert.equal(
    packageModel.PhysicalColumns.filter((item) => item.TABLE_NAME === tableName).length,
    14,
  );
});

test('marketplace form exposes the changelog through a hidden child module', () => {
  assert.ok(menu);
  assert.equal(menu.Display, 0);
  assert.equal(menu.AppDisplay, 0);
  assert.equal(menu.HasChild, 0);
  assert.ok(childField);
  assert.equal(childField.Readonly, 0);
  const config = JSON.parse(childField.Config);
  assert.equal(config.TableChildTableId, table.Id);
  assert.equal(config.TableChildSysMenuId, menu.Id);
  assert.equal(config.TableChildFkFieldName, 'StoreId');
  assert.ok(JSON.parse(parentTable.Tabs).some((tab) => tab.Name === '更新日志'));
});

test('making or publishing an app requires the exact version changelog', () => {
  const button = packageModel.DiyFields.find(
    (item) => item.TableId === parentTable.Id && item.Name === 'BtnMakeApp',
  );
  assert.match(button.V8Code, /MARKETPLACE_CHANGELOG_REQUIRED_V1/);
  assert.match(button.V8Code, /sys_microistore_changelog/);
  assert.match(button.V8Code, /Version.*releaseVersion/);
  assert.match(button.V8Code, /\['OsClient', '=', V8\.OsClient\]/);
  assert.match(publisherSource, /MARKETPLACE_CHANGELOG_REQUIRED_V1/);
  assert.match(publisherSource, /MARKETPLACE_CHANGELOG_LEGACY_TENANT_V1/);
  assert.match(publisherSource, /requireMarketplaceChangeLog/);
  assert.match(publisherSource, /\['OsClient', '=', V8\.OsClient\]/);
  assert.match(publisherSource, /repairLegacyTenant === true/);
  assert.match(publisherSource, /action === 'Publish'/);
  assert.match(publisherSource, /UptFormData\('sys_microistore_changelog'/);
  assert.match(modelSource, /ChangeLogAvailable/);
  assert.match(modelSource, /ChangeLogs/);
  assert.match(modelSource, /\["OsClient", "=", V8\.OsClient\]/);
  assert.match(table.SubmitBeforeServerV8, /V8\.Form\.OsClient = tenantKey/);
});

test('package metadata and engine ownership describe the changelog capability', () => {
  assert.ok(versionAtLeast(packageModel.PackageInfo.Version, 'v7.5.31'));
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes('Schema:MarketplaceChangeLogV1'));
  assert.equal(
    packageModel.ResourcePolicies.ApiEngines['get-microi-store-model'].UpgradePolicy,
    'Managed',
  );
  assert.equal(
    packageModel.ResourcePolicies.ApiEngines.ai_app_publish_store.UpgradePolicy,
    'Managed',
  );
  assert.equal(packageModel.PackageInfo.TableCount, packageModel.DiyTables.length);
  assert.equal(packageModel.PackageInfo.FieldCount, packageModel.DiyFields.length);
  assert.equal(packageModel.PackageInfo.DDLCount, packageModel.DDLStatements.length);
  assert.equal(packageModel.PackageInfo.PhysicalColumnCount, packageModel.PhysicalColumns.length);
});
