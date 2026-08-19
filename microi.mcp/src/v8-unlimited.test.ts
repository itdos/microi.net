import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlan, manifestGuide } from './advanced-tools.js';

test('manifest planning keeps table V8Unlimited and accepts positive engine V8Limit', () => {
  const plan = buildPlan({
    name: 'V8 unlimited contract probe',
    tables: [{ name: 'Biz_Atomic', fields: [], v8Unlimited: true }],
    engines: [{ apiEngineKey: 'biz_atomic_run', code: 'return { Code: 1 };', v8Limit: true }],
  });

  assert.deepEqual(plan.errors, []);
  assert.equal(plan.warnings.filter((warning) => warning.includes('v8Unlimited=true')).length, 1);
  assert.match(plan.warnings.join('\n'), /进程常驻内存保护仍生效/u);
});

test('manifest planning rejects ambiguous table V8Unlimited and engine V8Limit values', () => {
  const invalid = buildPlan({
    tables: [{ name: 'Biz_Invalid', fields: [], v8Unlimited: 'automatic' }],
    engines: [{ apiEngineKey: 'biz_invalid', v8Limit: 'automatic' }],
  });
  assert.equal(invalid.errors.filter((error) => error.includes('v8Unlimited 必须是 boolean 或 0/1')).length, 1);
  assert.equal(invalid.errors.filter((error) => error.includes('v8Limit 必须是 boolean 或 0/1')).length, 1);

  const safeDefault = buildPlan({
    tables: [{ name: 'Biz_Default', fields: [], v8Unlimited: false }],
    engines: [{ apiEngineKey: 'biz_default', v8Limit: false }],
  });
  assert.equal(safeDefault.warnings.some((warning) => warning.includes('v8Unlimited=true')), false);
});

test('manifest schema documents safe defaults for tables and engines', () => {
  const guide = manifestGuide('demo');
  const shape = guide.manifestShape as Record<string, unknown>;
  const tables = shape.tables as Array<Record<string, unknown>>;
  const engines = shape.engines as Array<Record<string, unknown>>;
  const natural = guide.naturalFieldKeys as Record<string, Record<string, string>>;

  assert.equal(tables[0].v8Unlimited, false);
  assert.equal(engines[0].v8Limit, false);
  assert.match(natural.tables.v8Unlimited, /Default false/u);
  assert.match(natural.engines.v8Limit, /false means no Jint/u);
});
