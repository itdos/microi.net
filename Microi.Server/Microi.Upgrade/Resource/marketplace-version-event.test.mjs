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
const versionAtLeast = (actual, minimum) => {
  const left = String(actual || '').replace(/^v/i, '').split('.').map(value => Number.parseInt(value, 10) || 0);
  const right = String(minimum || '').replace(/^v/i, '').split('.').map(value => Number.parseInt(value, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0);
  }
  return true;
};
const storeTable = packageModel.DiyTables.find((item) => item.Name === 'sys_microistore');
assert.ok(storeTable, 'app.microi.store.json must contain sys_microistore');
const eventCode = String(storeTable.SubmitBeforeServerV8 || '').replace(/\r\n/gu, '\n');

function runEvent({
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
  return { form: V8.Form, result };
}

function executeEvent(input = {}) {
  const action = String(input.action || 'Update').toLowerCase();
  const form = input.form || {};
  const oldForm = input.oldForm || {};
  const needsDefaultIdentity = action !== 'add' && action !== 'insert'
    && !['AppId', 'AppKey'].some(field => Object.prototype.hasOwnProperty.call(form, field)
      || Object.prototype.hasOwnProperty.call(oldForm, field));
  const executionInput = needsDefaultIdentity
    ? { ...input, form, oldForm: { AppId: 'app.test', AppKey: 'app.test', ...oldForm } }
    : input;
  const { form: executedForm, result } = runEvent(executionInput);
  assert.equal(result.Code, 1);
  return executedForm;
}

test('marketplace package carries the explicit-version contract and release metadata', () => {
  assert.ok(versionAtLeast(packageModel.PackageInfo.Version, 'v7.5.31'));
  assert.match(packageModel.PackageInfo.ChangeHistory, /(?:^|\n)2026-08-21 v7\.5\.4 /u);
  assert.match(eventCode, /Version: v1\.1\.4/u);
  assert.match(eventCode, /MARKETPLACE_EXPLICIT_VERSION_V1/u);
  assert.match(eventCode, /MARKETPLACE_STABLE_APPLICATION_IDENTITY_V1/u);
});

test('add and legacy blank versions receive a normalized default', () => {
  const added = executeEvent({ action: 'Add', form: { AppKey: 'app.example' } });
  assert.equal(added.AppVersion, 'v1.0.0');
  assert.equal(added.IsPublic, 1);
  assert.equal(added.AppId, 'app.example');

  const legacyUpdate = executeEvent({
    form: { Name: 'legacy metadata' },
    oldForm: { AppVersion: '', AppId: 'app.legacy', AppKey: 'app.legacy' },
  });
  assert.equal(legacyUpdate.AppVersion, 'v1.0.0');
});

test('stable marketplace identity is backfilled and missing identity fails closed', () => {
  const appIdOnly = executeEvent({ action: 'Add', form: { AppId: 'app.id-only' } });
  assert.equal(appIdOnly.AppKey, 'app.id-only');

  const repaired = executeEvent({
    form: { Name: 'repair legacy row' },
    oldForm: { AppKey: 'app.legacy-key', AppVersion: 'v1.0.0' },
  });
  assert.equal(repaired.AppId, 'app.legacy-key');

  const rejected = runEvent({ action: 'Add', form: {} });
  assert.equal(rejected.result.Code, 0);
  assert.match(rejected.result.Msg, /AppId|AppKey/u);
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
