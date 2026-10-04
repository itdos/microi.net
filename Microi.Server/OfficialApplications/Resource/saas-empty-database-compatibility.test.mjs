import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
test('SaaS 配置文本使用离页类型，空库在 MySQL 8 严格行宽限制下可建表', () => {
  const model = read('./app.microi.saas-engine.json');
  const names = read('./saas-config-text-fields.json');
  const table = model.DiyTables.find(row => row.Name === 'sys_osclients');
  const ddl = model.DDLStatements.find(row => row.TableName === 'sys_osclients').DDL;
  for (const name of names) {
    const field = model.DiyFields.find(row => row.TableId === table.Id && row.Name === name);
    const column = model.PhysicalColumns.find(row => row.TABLE_NAME === table.Name && row.COLUMN_NAME === name);
    assert.equal(field?.Type?.toLowerCase(), 'mediumtext', `字段元数据 ${name}`);
    assert.equal(column?.DATA_TYPE?.toLowerCase(), 'mediumtext', `物理列 ${name}`);
    assert.match(ddl, new RegExp('`' + name + '` mediumtext\\b', 'i'), `建表 SQL ${name}`);
  }
  for (const name of ['Id', 'OsClient', 'OsClientType', 'OsClientNetwork']) {
    assert.match(ddl, new RegExp('`' + name + '` varchar\\(', 'i'), `租户标识 ${name} 保持有界文本`);
  }
  assert.ok(!names.includes('IsEnable'), '开关字段不能变成文本');
});
