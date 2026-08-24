import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const resourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(resourceDirectory, '../../..');
const packagePath = path.join(resourceDirectory, 'app.microi.store.json');
const mirrorPath = path.join(
  workspaceRoot,
  'Microi-V8-Engine',
  'Microi吾码 (api.itdos.com)',
  'iTdos.Product.Internal',
  '表单引擎',
  '应用商城（sys_microistore）',
  '表单V8事件',
  '后端表单提交前V8事件（SubmitBeforeServerV8）.js',
);

const packageModel = JSON.parse(readFileSync(packagePath, 'utf8'));
const storeTable = packageModel.DiyTables.find((item) => item.Name === 'sys_microistore');
assert.ok(storeTable, 'app.microi.store.json must contain sys_microistore');
const eventCode = String(storeTable.SubmitBeforeServerV8 || '').replace(/\r\n/gu, '\n');

function executeEvent({
  action = 'Update',
  form = {},
  oldForm = {},
  param = {},
  notSaveField,
} = {}) {
  const V8 = {
    Form: { ...form },
    OldForm: { ...oldForm },
    FormSubmitAction: action,
    Param: param,
  };
  if (notSaveField !== undefined) V8.NotSaveField = notSaveField;
  const result = vm.runInNewContext(`(function () {\n${eventCode}\n})()`, { V8 });
  assert.equal(result.Code, 1);
  return V8.Form;
}

test('marketplace package carries the explicit-version contract and release metadata', () => {
  assert.equal(packageModel.PackageInfo.Version, 'v7.5.31');
  assert.match(packageModel.PackageInfo.ChangeHistory, /(?:^|\n)2026-08-21 v7\.5\.4 /u);
  assert.match(eventCode, /Version: v1\.1\.3/u);
  assert.match(eventCode, /MARKETPLACE_EXPLICIT_VERSION_V1/u);
});

test('add and legacy blank versions receive a normalized default', () => {
  const added = executeEvent({ action: 'Add' });
  assert.equal(added.AppVersion, 'v1.0.0');
  assert.equal(added.IsPublic, 1);

  const legacyUpdate = executeEvent({
    form: { Name: 'legacy metadata' },
    oldForm: { AppVersion: '' },
  });
  assert.equal(legacyUpdate.AppVersion, 'v1.0.0');
});

test('sparse metadata updates preserve the stored version without synthesizing a version field', () => {
  const form = executeEvent({
    form: {
      Id: 'app-1',
      Name: 'source-only sync',
      PrivateSourcePath: 'ai-app-source/app-1',
      PublicPublishPath: 'micro-app/app-1/',
    },
    oldForm: { AppVersion: 'v3.8.2' },
  });

  assert.equal(Object.prototype.hasOwnProperty.call(form, 'AppVersion'), false);
  assert.match(form.AppUpdateTime, /^\d{4}-\d{2}-\d{2} /u);
});

test('explicit version submissions keep the existing normalize and bump rules', () => {
  const sameVersion = executeEvent({
    form: { AppVersion: 'v1.2.9' },
    oldForm: { AppVersion: 'v1.2.9' },
  });
  assert.equal(sameVersion.AppVersion, 'v1.3.0');

  const blankVersion = executeEvent({
    form: { AppVersion: '' },
    oldForm: { AppVersion: 'v2.4.1' },
  });
  assert.equal(blankVersion.AppVersion, 'v2.4.2');

  const requestedVersion = executeEvent({
    form: { AppVersion: ' 2.6 ' },
    oldForm: { AppVersion: 'v2.4.1' },
  });
  assert.equal(requestedVersion.AppVersion, 'v2.6.0');
});

test('delete actions never bump or synthesize a version field', () => {
  const sparseDelete = executeEvent({
    action: 'Delete',
    form: { Id: 'app-1' },
    oldForm: { AppVersion: 'v4.5.6' },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(sparseDelete, 'AppVersion'), false);

  const fullDelete = executeEvent({
    action: 'Del',
    form: { Id: 'app-1', AppVersion: 'v4.5.6' },
    oldForm: { AppVersion: 'v4.5.6' },
  });
  assert.equal(fullDelete.AppVersion, 'v4.5.6');
});

test('_NotSaveField wins over an explicit version value from every supported V8 surface', () => {
  const cases = [
    { form: { AppVersion: 'v9.0.0', _NotSaveField: ['appversion'] } },
    { form: { AppVersion: 'v9.0.0' }, param: { _NotSaveField: '["AppVersion"]' } },
    { form: { AppVersion: 'v9.0.0' }, notSaveField: ['AppVersion'] },
  ];

  for (const input of cases) {
    const form = executeEvent({ ...input, oldForm: { AppVersion: '3.4.5' } });
    assert.equal(form.AppVersion, '3.4.5');
  }
});

test('_NotSaveField on a sparse update does not synthesize or clear the stored version', () => {
  const form = executeEvent({
    form: { Name: 'metadata only', _NotSaveField: ['AppVersion'] },
    oldForm: { AppVersion: 'v5.6.7' },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(form, 'AppVersion'), false);
});

test('the iTdos V8 mirror matches the package event when the local tenant tree is available', (t) => {
  if (!existsSync(mirrorPath)) {
    t.skip('local iTdos V8 mirror is not present in this checkout');
    return;
  }
  const mirrorCode = readFileSync(mirrorPath, 'utf8').replace(/\r\n/gu, '\n');
  assert.equal(mirrorCode, eventCode);
});
