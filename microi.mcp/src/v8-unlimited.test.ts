import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { z } from 'zod';
import { buildPlan, manifestGuide } from './advanced-tools.js';

test('创建和保存接口的实际Schema支持后端受控HTTP响应且拒绝未知模式', () => {
  const source=fs.readFileSync(new URL('./server.ts',import.meta.url),'utf8');
  const matches=[...source.matchAll(/responseType:\s*z\.enum\(\[([^\]]+)\]\)/g)];
  assert.equal(matches.length,2);
  for(const match of matches){
    const values=[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
    const schema=z.enum(values as [string,...string[]]);
    for(const mode of ['JSON','String','File','HTML','Stream','HTTP'])assert.equal(schema.safeParse(mode).success,true,mode);
    for(const mode of ['RawScript','HTTP\r\nX-Evil: 1',''])assert.equal(schema.safeParse(mode).success,false,mode);
  }
});

test('manifest planning uses positive V8Limit for tables and engines', () => {
  const plan = buildPlan({
    name: 'V8 limit contract probe',
    tables: [{ name: 'Biz_Atomic', fields: [], v8Limit: true }],
    engines: [{ apiEngineKey: 'biz_atomic_run', code: 'return { Code: 1 };', v8Limit: true }],
  });

  assert.deepEqual(plan.errors, []);
  assert.equal(plan.warnings.filter((warning) => warning.includes('v8Unlimited')).length, 0);
});

test('manifest planning rejects invalid and conflicting table V8Limit values', () => {
  const invalid = buildPlan({
    tables: [{ name: 'Biz_Invalid', fields: [], v8Limit: 'automatic' }],
    engines: [{ apiEngineKey: 'biz_invalid', v8Limit: 'automatic' }],
  });
  assert.equal(invalid.errors.filter((error) => error.includes('v8Limit 必须是 boolean 或 0/1')).length, 2);

  const safeDefault = buildPlan({
    tables: [{ name: 'Biz_Default', fields: [], v8Limit: false }],
    engines: [{ apiEngineKey: 'biz_default', v8Limit: false }],
  });
  assert.equal(safeDefault.warnings.some((warning) => warning.includes('v8Unlimited')), false);

  const conflict = buildPlan({
    tables: [{ name: 'Biz_Conflict', fields: [], v8Limit: true, v8Unlimited: true }],
  });
  assert.equal(conflict.errors.some((error) => error.includes('v8Limit 与兼容字段 v8Unlimited 的语义冲突')), true);
});

test('manifest planning accepts legacy table V8Unlimited only as inverted compatibility input', () => {
  const legacy = buildPlan({
    tables: [{ name: 'Biz_Legacy', fields: [], v8Unlimited: true }],
  });
  assert.deepEqual(legacy.errors, []);
  assert.equal(legacy.warnings.some((warning) => warning.includes('v8Unlimited 已弃用')), true);
});

test('manifest schema documents safe defaults for tables and engines', () => {
  const guide = manifestGuide('demo');
  const shape = guide.manifestShape as Record<string, unknown>;
  const tables = shape.tables as Array<Record<string, unknown>>;
  const engines = shape.engines as Array<Record<string, unknown>>;
  const natural = guide.naturalFieldKeys as Record<string, Record<string, string>>;

  assert.equal(tables[0].v8Limit, false);
  assert.equal(engines[0].v8Limit, false);
  assert.match(natural.tables.v8Limit, /Default false/u);
  assert.match(natural.engines.v8Limit, /false means no Jint/u);
});

test('engine list and detail default missing runtime fields to V8Limit=false', () => {
  const source = fs.readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
  assert.match(source, /e\.V8Unlimited !== undefined && e\.V8Unlimited !== null[\s\S]{0,120}: 0;/u);
  assert.match(source, /engine\?\.V8Unlimited !== undefined && engine\?\.V8Unlimited !== null[\s\S]{0,140}: false/u);
});
