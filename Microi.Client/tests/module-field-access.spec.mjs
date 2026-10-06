import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleFieldAccess, resolvedModuleFieldAccess } from '../src/utils/module-field-permissions.js';

test('所有身份命中均生效，拒绝优先且隐藏禁止编辑', () => {
    const config = { Version: 1, Enabled: true, Rules: [
        { Roles: ['role'], Fields: [{ Name: 'Amount', Visible: true, Editable: true }] },
        { Departments: ['dept'], Fields: [{ Name: 'Amount', Editable: false }] },
        { Jobs: ['job'], Fields: [{ Name: 'Secret', Visible: false, Editable: true }] },
        { Users: ['user'], Fields: [{ Name: 'Personal', Visible: false }] }
    ] };
    const user = { Id: 'USER', RoleIds: ['role'], DeptIds: [{Id:'dept'}], Jobs: ['job'] };
    assert.deepEqual(moduleFieldAccess(config, user, 'Amount'), {visible:true,editable:false});
    assert.deepEqual(moduleFieldAccess(config, user, 'Secret'), {visible:false,editable:false});
    assert.deepEqual(moduleFieldAccess(config, user, 'Personal'), {visible:false,editable:false});
});

test('服务端有效权限投影大小写匹配，默认拒绝及未知协议安全关闭', () => {
    const access = {Version:1,DefaultVisible:false,DefaultEditable:false,Fields:{NAME:{Visible:true,Editable:true},Readonly:{Visible:true,Editable:false},Secret:{Visible:false,Editable:true}}};
    assert.deepEqual(resolvedModuleFieldAccess(access,'Name'),{visible:true,editable:true});
    assert.deepEqual(resolvedModuleFieldAccess(access,'Readonly'),{visible:true,editable:false});
    assert.deepEqual(resolvedModuleFieldAccess(access,'Secret'),{visible:false,editable:false});
    assert.deepEqual(resolvedModuleFieldAccess(access,'Unlisted'),{visible:false,editable:false});
    assert.deepEqual(resolvedModuleFieldAccess({...access,Version:2},'Name'),{visible:false,editable:false});
    assert.deepEqual(resolvedModuleFieldAccess(access,'Id'),{visible:true,editable:false});
    assert.equal(resolvedModuleFieldAccess(null,'Name'),null);
});
