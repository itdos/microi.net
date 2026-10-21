import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { parse } from '@babel/parser';

// 直接执行平台真实提交转换函数，不能用同样写错的测试替身掩盖值丢失。
const source = readFileSync(new URL('../src/utils/diy.common.js', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module' });
const object = ast.program.body.find(n => n.type === 'VariableDeclaration' && n.declarations.some(d => d.id.name === 'DiyCommon')).declarations.find(d => d.id.name === 'DiyCommon').init;
const method = object.properties.find(n => n.key.name === 'ForRowModelHandler');
const common = { IsNull: v => v === null || v === undefined || v === '' };
const handler = vm.runInNewContext(`({${source.slice(method.start, method.end)}})`, { DiyCommon: common, _: { where: (fields, match) => fields.filter(f => f.Name === match.Name) } }).ForRowModelHandler;
function serialize(value, Component, Config) {
  const model = { Owner: structuredClone(value) };
  handler(model, [{ Name: 'Owner', Component, Config }]);
  return JSON.parse(JSON.stringify(model));
}

for (const source of ['Data', 'Sql', 'DataSource', 'ApiEngine', 'Api']) {
  test(`${source}: 未重新选择直接提交保留标量，选择对象按配置转换`, () => {
    for (const field of ['Id', 'Code', '']) {
      const config = { DataSource: source, SelectSaveField: field, SelectLabel: 'Name', SelectSaveFormat: 'Text' };
      for (const value of ['id-string', 0, '', null]) assert.deepEqual(serialize(value, 'Select', config), { Owner: value });
      const option = { Id: 'id', Code: 'code', Name: 'Label', Extra: 'keep' };
      assert.deepEqual(serialize(option, 'Select', config), { Owner: option[field || 'Name'] });
      assert.deepEqual(serialize(option, 'Select', { ...config, SelectSaveFormat: 'Json' }), { Owner: option });
      const mixed = ['id-string', 0, option];
      assert.deepEqual(serialize(mixed, 'MultipleSelect', config), { Owner: field ? ['id-string', 0, option[field]] : mixed });
      assert.deepEqual(serialize(mixed, 'MultipleSelect', { ...config, SelectSaveFormat: 'Json' }), { Owner: mixed });
    }
  });
}

test('KeyValue: 数值零、大小写键和历史混合数组不会丢失', () => {
  const cfg = { DataSource: 'KeyValue', SelectSaveField: 'Key', SelectLabel: 'Value', SelectSaveFormat: 'Text' };
  assert.deepEqual(serialize({ Key: 0, Value: '零' }, 'Select', cfg), { Owner: 0 });
  assert.deepEqual(serialize([{ Key: 0, Value: '零' }, 'text', { key: 'lower', value: '小写' }], 'MultipleSelect', cfg), { Owner: [0, 'text', 'lower'] });
  assert.deepEqual(serialize([], 'MultipleSelect', cfg), { Owner: [] });
});
