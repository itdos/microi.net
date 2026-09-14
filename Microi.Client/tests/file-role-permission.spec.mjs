import test from 'node:test';
import assert from 'node:assert/strict';
import { fileRoleConfig, canReadFile, canEditFile, visibleFiles, fileRoleNames } from '../src/utils/file-role-permission.js';

test('旧字段与三个展示开关均保持默认关闭', () => {
    assert.deepEqual(fileRoleConfig({}), { EnableRolePermission: false, HideUnauthorizedFiles: false, ShowUnauthorizedFileName: false, DisableRoleInheritance: false });
});
test('以后端授权为准，无权限附件不允许编辑或读取', () => {
    const file = { Id: 'locked', _FileAccess: { CanRead: false, CanEdit: false } };
    assert.equal(canReadFile(file), false);
    assert.equal(canEditFile(file, 'Edit'), false);
    assert.equal(canEditFile({ Id: 'legacy' }, 'View'), false);
    assert.equal(canEditFile({ Id: 'legacy' }, 'Edit'), true);
});
test('隐藏仅影响展示，原始列表保留不可操作的占位', () => {
    const files = [{ Id: 'a' }, { Id: 'b', _FileAccess: { CanRead: false } }];
    assert.equal(visibleFiles(files, {}).length, 2);
    assert.equal(visibleFiles(files, { HideUnauthorizedFiles: true }).length, 1);
    assert.equal(files.length, 2);
});
test('角色名称优先使用权威投影，兼容未保存的新附件', () => {
    assert.deepEqual(fileRoleNames({ VisibleRoleNames: ['一级', '二级'] }, []), ['一级', '二级']);
    assert.deepEqual(fileRoleNames({ VisibleRoleIds: ['r2'] }, [{ Id: 'r2', Name: '二级' }]), ['二级']);
});
