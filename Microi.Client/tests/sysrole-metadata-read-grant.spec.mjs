import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';

const source = readFileSync(new URL('../src/views/system/components/sysrole-table-permission.vue', import.meta.url), 'utf8');
const component = vm.runInNewContext(parse(source).descriptor.script.content.replace('export default', 'module.exports ='), { module: { exports: {} } });
const policySource = readFileSync(new URL('../../Microi.Server/Microi.Core/Security/PlatformResourceSecurity.cs', import.meta.url), 'utf8');
const tableNames = (group) => [...policySource.match(new RegExp(`string\\[\\] ${group}TableNameValues =\\s*\\{([\\s\\S]*?)\\};`))[1].matchAll(/"([a-z_]+)"/g)].map(match => match[1]);

function editor() {
    const instance = { ...component.data(), modelValue: [], readonly: false };
    for (const [key, method] of Object.entries(component.methods)) instance[key] = method.bind(instance);
    instance.policyReady = true;
    for (const [mode, permissions] of [['AdministratorOnly', []], ['ReadOnly', ['Read']], ['RoleManaged', ['Read', 'Add', 'Edit', 'Del']]]) {
        for (const name of tableNames(mode)) instance.policyByTableName[name] = { TableName: name, Mode: mode, AllowedPermissions: permissions };
    }
    return instance;
}

for (const name of ['diy_table', 'diy_field']) {
    test(`${name} 服务端策略允许选择，编辑器只保留查询授权`, () => {
        const instance = editor();
        assert.equal(instance.isTableSelectable(name), true);
        assert.equal(instance.tablePolicyLabel(name), '仅可授权查询');
        assert.equal(instance.isPermissionAllowed(name.toUpperCase(), 'Read'), true);
        for (const permission of ['Add', 'Edit', 'Del']) assert.equal(instance.isPermissionAllowed(name, permission), false);
        assert.deepEqual(instance.applyPolicyToRow({ Name: name, Permission: ['Read', 'Edit'] }).Permission, ['Read']);
    });
}

test('敏感表保护、普通业务授权和策略读取失败保持原有行为', () => {
    const instance = editor();
    for (const name of ['sys_role', 'sys_rolelimit', 'sys_osclients', 'sys_apiengine']) {
        assert.equal(instance.isTableSelectable(name), false);
        assert.equal(instance.isPermissionAllowed(name, 'Read'), false);
    }
    assert.equal(instance.isPermissionAllowed('customer_orders', 'Edit'), true);
    instance.policyReady = false;
    assert.equal(instance.isTableSelectable('diy_table'), false);
    assert.equal(instance.isPermissionAllowed('diy_field', 'Read'), false);
});
