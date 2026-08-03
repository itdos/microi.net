import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlan, manifestGuide } from './advanced-tools.js';

test('manifest planning accepts explicit V8Unlimited and emits the high-risk warning', () => {
  const plan = buildPlan({
    name: 'V8 unlimited contract probe',
    tables: [{ name: 'Biz_Atomic', fields: [], v8Unlimited: true }],
    engines: [{ apiEngineKey: 'biz_atomic_run', code: 'return { Code: 1 };', v8Unlimited: true }],
  });

  assert.deepEqual(plan.errors, []);
  assert.equal(plan.warnings.filter((warning) => warning.includes('v8Unlimited=true')).length, 2);
  assert.match(plan.warnings.join('\n'), /进程常驻内存保护仍生效/u);
  assert.match(plan.warnings.join('\n'), /不会向嵌套接口继承/u);
});

test('manifest planning rejects ambiguous V8Unlimited values and false stays quiet', () => {
  const invalid = buildPlan({
    tables: [{ name: 'Biz_Invalid', fields: [], v8Unlimited: 'automatic' }],
    engines: [{ apiEngineKey: 'biz_invalid', v8Unlimited: 'automatic' }],
  });
  assert.equal(invalid.errors.filter((error) => error.includes('v8Unlimited 必须是 boolean 或 0/1')).length, 2);

  const safeDefault = buildPlan({
    tables: [{ name: 'Biz_Default', fields: [], v8Unlimited: false }],
    engines: [{ apiEngineKey: 'biz_default', v8Unlimited: false }],
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
  assert.equal(engines[0].v8Unlimited, false);
  assert.match(natural.tables.v8Unlimited, /Default false/u);
  assert.match(natural.engines.v8Unlimited, /does not inherit/u);
});
