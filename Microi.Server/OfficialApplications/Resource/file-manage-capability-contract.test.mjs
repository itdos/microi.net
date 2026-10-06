import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(directory, 'mci-file-sync-capability.js'), 'utf8');

function execute({ currentUser, rows = [], resultCode = 1 } = {}) {
  const calls = [];
  const value = vm.runInNewContext(`(function () {\n${source}\n})()`, {
    V8: {
      CurrentUser: currentUser,
      FormEngine: {
        GetTableData(tableName, query) {
          calls.push({ tableName, query });
          return { Code: resultCode, Data: rows };
        }
      }
    }
  });
  return { value: JSON.parse(JSON.stringify(value)), calls };
}

test('official file-manager capability resolves the current tenant menu without a hard-coded id', () => {
  assert.match(source, /OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.match(source, /FileManagerSysMenuId/);
  assert.doesNotMatch(source, /01KVSGRM21ZVA2QRGEFD6Y3VHA/i);

  const { value, calls } = execute({
    currentUser: { Id: 'admin', Level: 9999 },
    rows: [
      { Id: 'lookalike', ComponentPath: '/file-manage/index.vue-copy', IsDeleted: 0 },
      { Id: 'deleted', ComponentPath: '/file-manage/index.vue', IsDeleted: 1 },
      { Id: 'tenant-file-menu', ComponentPath: '@/views/file-manage/index.vue', IsDeleted: 0 }
    ]
  });

  assert.equal(value.Code, 1);
  assert.equal(value.Data.FileManagerSysMenuId, 'tenant-file-menu');
  assert.equal(value.Data.AuthorizedPrivateObjectUrl, undefined);
  assert.equal(value.Data.Capabilities.AuthorizedPrivateObjectUrl, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tableName, 'sys_menu');
  assert.deepEqual(Array.from(calls[0].query._SelectFields), ['Id', 'ComponentPath', 'IsDeleted']);
});

test('file-manager capability fails closed for non-admin identities and missing authoritative menus', () => {
  const ordinary = execute({ currentUser: { Id: 'user', Level: 100 }, rows: [] });
  assert.equal(ordinary.value.Code, 0);
  assert.equal(ordinary.calls.length, 0);

  const missing = execute({
    currentUser: { Id: 'admin', Level: 9999 },
    rows: [{ Id: 'other', ComponentPath: '/file-manage/index.vue-lookalike', IsDeleted: 0 }]
  });
  assert.equal(missing.value.Code, 0);
  assert.match(missing.value.Msg, /更新【文件柜】应用/);
});
