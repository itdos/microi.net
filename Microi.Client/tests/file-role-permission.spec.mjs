import test from 'node:test';
import assert from 'node:assert/strict';
import { fileRoleConfig, configurableFileRoles, canReadFile, canEditFile, visibleFiles, fileRoleNames } from '../src/utils/file-role-permission.js';

test('旧字段与三个展示开关均保持默认关闭', () => {
    assert.deepEqual(fileRoleConfig({}), { EnableRolePermission: false, HideUnauthorizedFiles: false, ShowUnauthorizedFileName: false, DisableRoleInheritance: false, ConfigurableRoleIds: [] });
});
test('候选角色范围为空兼容全部；非空只展示白名单，既有范围外角色保留为禁选项', () => {
    const roles = [{ Id: 'a', Name: 'A' }, { Id: 'b', Name: 'B' }];
    assert.equal(configurableFileRoles(roles).length, 2);
    assert.deepEqual(configurableFileRoles(roles, { ConfigurableRoleIds: ['a'] }), [roles[0]]);
    const options = configurableFileRoles(roles, { ConfigurableRoleIds: ['a'] }, { VisibleRoleIds: ['b'], VisibleRoleNames: ['B'] });
    assert.equal(options[1].Id, 'b'); assert.equal(options[1].Disabled, true);
    assert.equal(configurableFileRoles(roles, { ConfigurableRoleIds: ['deleted'] }).length, 0);
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
