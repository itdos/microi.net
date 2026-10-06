import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const packageModel = JSON.parse(fs.readFileSync(path.join(resourceRoot, 'app.microi.store.json'), 'utf8'));

test('应用商城官方包完整交付推荐应用字段', () => {
  const field = packageModel.DiyFields.find(item => item.TableName === 'sys_microistore' && item.Name === 'IsRecommend');
  const physical = packageModel.PhysicalColumns.find(item => item.TABLE_NAME === 'sys_microistore' && item.COLUMN_NAME === 'IsRecommend');
  const ddl = packageModel.DDLStatements.find(item => item.TableName === 'sys_microistore')?.DDL || '';

  assert.ok(field)
  assert.equal(field.Id, '01KZZRMJQFG190K2B4DM6KYJX4')
  assert.equal(field.Component, 'Switch')
  assert.equal(field.DefaultValue, '0')
  assert.equal(field.InTableEdit, 1)
  assert.ok(physical)
  assert.equal(physical.COLUMN_DEFAULT, '0')
  assert.match(ddl, /`IsRecommend` int NULL DEFAULT 0 COMMENT '是否推荐'/)
  assert.equal(packageModel.PackageInfo.FieldCount, packageModel.DiyFields.length)
  assert.equal(packageModel.PackageInfo.PhysicalColumnCount, packageModel.PhysicalColumns.length)
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes('Schema:MarketplaceRecommendationV1'))
  assert.ok(packageModel.PackageInfo.Capabilities.includes('Schema:MarketplaceRecommendationV1'))
})
