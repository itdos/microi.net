import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFileUploadConfig } from './file-upload-config.js';
test('附件权限默认值与私有存储约束', () => {
  const input = { EnableRolePermission: true, Limit: false, Multiple: true, MaxCount: 10 };
  assert.deepEqual(buildFileUploadConfig(input), { FileUpload: { ...input, Limit: true, HideUnauthorizedFiles: false, ShowUnauthorizedFileName: false, DisableRoleInheritance: false, ConfigurableRoleIds: [] } });
  assert.equal(input.Limit, false);
  assert.throws(() => buildFileUploadConfig({ EnableRolePermission: 'false' }), /boolean/);
  assert.equal((buildFileUploadConfig({}).FileUpload as Record<string, unknown>).EnableRolePermission, false);
  assert.deepEqual((buildFileUploadConfig({ ConfigurableRoleIds: ['r1', 'r1'] }).FileUpload as Record<string, unknown>).ConfigurableRoleIds, ['r1']);
  assert.throws(() => buildFileUploadConfig({ ConfigurableRoleIds: 'r1' }), /ConfigurableRoleIds/);
  assert.throws(() => buildFileUploadConfig({ ConfigurableRoleIds: [{}] }), /ConfigurableRoleIds/);
});
