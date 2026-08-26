import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareV8VersionedCode } from './v8-version.js';

const managedNotice = `/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：sample
 */`;

const versionHeader = `/*
 * V8 ApiEngine
 * ApiEngineKey: sample
 * Version: v1.3.5
 * Function:
 * - 原有功能说明。
 */`;

function prepare(currentCode: string) {
  return prepareV8VersionedCode({
    kind: 'ApiEngine',
    key: 'sample',
    currentCode,
    changeSummary: '测试官方源码头保护',
  });
}

test('official ownership notice remains the absolute first header when versioning', () => {
  const prepared = prepare(`${managedNotice}\n\n${versionHeader}\n\nreturn { Code : 1 };\n`);

  assert.equal(prepared.version, 'v1.3.6');
  assert.ok(prepared.code.startsWith(`${managedNotice}\n\n/*\n * V8 ApiEngine`));
  assert.equal((prepared.code.match(/OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/g) || []).length, 1);
  assert.equal((prepared.code.match(/\* Version: v1\.3\.6/g) || []).length, 1);
  assert.doesNotMatch(prepared.code, /Version: v1\.3\.5/);
  assert.match(prepared.code, /\* - 原有功能说明。/);
});

test('legacy version-first official source is normalized without duplicating either header', () => {
  const prepared = prepare(`${versionHeader}\n\n${managedNotice}\n\nreturn { Code : 1 };\n`);

  assert.ok(prepared.code.startsWith(`${managedNotice}\n\n/*\n * V8 ApiEngine`));
  assert.equal((prepared.code.match(/OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/g) || []).length, 1);
  assert.equal((prepared.code.match(/\* Version: v1\.3\.6/g) || []).length, 1);
  assert.match(prepared.code, /return \{ Code : 1 \};/);
});

test('CreateIfMissing ownership notice is protected as well', () => {
  const tenantNotice = managedNotice.replace(
    'OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1',
    'OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1',
  );
  const prepared = prepare(`${tenantNotice}\n\nreturn { Code : 1 };\n`);

  assert.ok(prepared.code.startsWith(`${tenantNotice}\n\n/*\n * V8 ApiEngine`));
  assert.equal((prepared.code.match(/OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1/g) || []).length, 1);
});
