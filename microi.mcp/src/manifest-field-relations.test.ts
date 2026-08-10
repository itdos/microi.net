import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPlan,
  manifestGuide,
  resolveManifestRelationConfig,
  validateManifestFieldRelations,
} from './advanced-tools.js';

const validManifest = {
  tables: [
    {
      name: 'Biz_Order',
      fields: [
        { name: 'CustomerId', label: '客户Id', component: 'Text', type: 'varchar(50)' },
        {
          name: 'CustomerProfile',
          label: '客户资料',
          component: 'JoinForm',
          relation: { cardinality: 'N:1', targetTable: 'Biz_Customer', joinFieldName: 'CustomerId' },
        },
        {
          name: 'Items',
          label: '订单明细',
          component: 'TableChild',
          relation: {
            cardinality: '1:N',
            targetTable: 'Biz_OrderItem',
            childForeignKey: 'OrderId',
            childModule: '订单明细（隐藏）',
          },
        },
      ],
    },
    {
      name: 'Biz_Customer',
      fields: [{ name: 'Name', label: '客户名称', component: 'Text', type: 'varchar(200)' }],
    },
    {
      name: 'Biz_OrderItem',
      fields: [
        { name: 'OrderId', label: '订单Id', component: 'Text', type: 'varchar(50)' },
        { name: 'ProductName', label: '商品', component: 'Text', type: 'varchar(200)' },
      ],
      indexes: [{ name: 'idx_orderitem_osclient_orderid', columns: ['OsClient', 'OrderId'], unique: false }],
    },
  ],
  modules: [
    { name: '订单', table: 'Biz_Order' },
    { name: '订单明细（隐藏）', table: 'Biz_OrderItem', display: 0, appDisplay: 0, hasChild: 0 },
  ],
};

test('Manifest rejects a self-referencing JoinForm before any write', () => {
  const manifest = structuredClone(validManifest);
  const joinField = manifest.tables[0].fields[1] as Record<string, unknown>;
  joinField.relation = { cardinality: 'N:1', targetTable: 'Biz_Order', joinFieldName: 'CustomerId' };

  const result = validateManifestFieldRelations(manifest);
  assert.ok(result.errors.some((error) => error.includes('与当前表相同')));
});

test('Manifest rejects JoinForm for a one-to-many collection', () => {
  const manifest = structuredClone(validManifest);
  const joinField = manifest.tables[0].fields[1] as Record<string, unknown>;
  joinField.relation = { cardinality: '1:N', targetTable: 'Biz_Customer', joinFieldName: 'CustomerId' };

  const result = buildPlan(manifest);
  assert.ok(result.errors.some((error) => error.includes('1:N 明细必须改用 TableChild')));
});

test('Manifest requires a hidden child module and tenant-scoped child lookup index', () => {
  const manifest = structuredClone(validManifest);
  manifest.modules[1].display = 1;
  manifest.tables[2].indexes = [];

  const result = validateManifestFieldRelations(manifest);
  assert.ok(result.errors.some((error) => error.includes('display=0、appDisplay=0、hasChild=0')));
  assert.ok(result.errors.some((error) => error.includes('(OsClient, OrderId)')));
});

test('Valid portable relations resolve current-tenant ids and override raw stale ids', () => {
  const validation = buildPlan(validManifest);
  assert.deepEqual(validation.errors, []);

  const joinField = {
    ...validManifest.tables[0].fields[1],
    config: { JoinForm: { TableId: 'stale-table-id', FormMode: 'View' } },
  };
  const tableIds = new Map([
    ['biz_customer', 'tenant-customer-table-id'],
    ['biz_orderitem', 'tenant-item-table-id'],
  ]);
  const moduleIds = new Map([['订单明细（隐藏）', 'tenant-child-menu-id']]);
  const joinConfig = resolveManifestRelationConfig(joinField, 'Biz_Order', tableIds, moduleIds);
  assert.deepEqual(joinConfig, {
    JoinForm: {
      TableId: 'tenant-customer-table-id',
      FormMode: 'View',
      TableName: 'Biz_Customer',
      JoinFieldName: 'CustomerId',
    },
  });

  const childConfig = resolveManifestRelationConfig(
    validManifest.tables[0].fields[2],
    'Biz_Order',
    tableIds,
    moduleIds,
  );
  assert.equal(childConfig.TableChildTableId, 'tenant-item-table-id');
  assert.equal(childConfig.TableChildSysMenuId, 'tenant-child-menu-id');
  assert.equal(childConfig.TableChildFkFieldName, 'OrderId');
  assert.deepEqual(childConfig.TableChild, { PrimaryTableFieldName: 'Id' });
});

test('Manifest schema teaches the portable relation contract and no JoinForm Name default', () => {
  const guide = manifestGuide('demo');
  const natural = guide.naturalFieldKeys as Record<string, Record<string, string>>;
  const examples = guide.relationExamples as Record<string, unknown>;
  assert.match(natural.fields.relation, /1:N/u);
  assert.ok(examples.joinForm);
  assert.ok(examples.tableChild);
});
