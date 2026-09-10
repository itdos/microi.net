import assert from 'node:assert/strict';
import test from 'node:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerMessageNotificationTools } from './message-notification-tools.js';
const decode = (r) => JSON.parse(r.content.filter(x => x.type === 'text').map(x => x.type === 'text' ? x.text : '').join(''));
const config = { Key: 'order_approved', Title: '审批通知', Type: ['平台内部'], IsEnable: true };
const rule = { Title: '维护公告', Content: '今晚维护', ScopeType: 'Tenants', AccountScope: 'SuperAdmins', AllTargets: true, StartsAt: '2026-09-10T01:00:00Z', EndsAt: '2026-09-11T01:00:00Z' };
async function session(run, response) {
    const calls = [], audits = [];
    const fake = { executeEngine: async (key, p) => { calls.push({ key, p }); return response ? response(key, p) : { Code: 1, Data: { Result: { Code: 1, Data: p.Action === 'Save' && key.endsWith('-config') ? { Rule: { Id: 'config-1' } } : { Id: p.Id || 'a'.repeat(32), Administrator: true } } } }; }, writeAuditLog: async (a, t, c) => { audits.push([a, t, c].join('|')); return { Code: 1 }; } };
    const server = new McpServer({ name: 'notification-test', version: '1' });
    registerMessageNotificationTools(server, fake, { osClient: 'test-tenant', label: '测试连接', apiBaseUrl: 'https://test.invalid' });
    const client = new Client({ name: 'notification-test', version: '1' }), [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    try {
        await run(client, calls, audits);
    }
    finally {
        await client.close();
        await server.close();
    }
}
test('统一通知发现绑定当前连接，跨租户不读取角色列表', async () => session(async (client, calls) => {
    const inventory = await client.listTools();
    assert.equal(inventory.tools.length, 3);
    const result = decode(await client.callTool({ name: 'microi_get_notification_context', arguments: {} }));
    assert.equal(result.Data.ApplicationKey, 'app.microi.message-notification');
    assert.equal(calls.length, 2);
    for (const scope of ['Tenants', 'Editions', 'Roles', 'Users'])
        await client.callTool({ name: 'microi_get_notification_context', arguments: { action: 'Recipients', recipientScope: scope } });
    assert.equal(calls[2].key, 'platform-reminder-runtime');
    assert.equal(calls[2].p.ScopeType, 'Tenants');
    assert.equal(calls[3].key, 'platform-reminder-runtime');
    assert.equal(calls[3].p.ScopeType, 'Editions');
    assert.equal(calls[4].key, 'platform-message-notification-config');
    assert.equal(calls[4].p.Kind, 'Roles');
    assert.equal(calls[5].key, 'platform-message-notification-config');
    assert.equal(calls[5].p.Kind, 'Users');
    await client.callTool({ name: 'microi_get_notification_context', arguments: { action: 'Adapters', keyword: 'notify', pageSize: 20 } });
    assert.equal(calls[6].key, 'platform-message-notification-config');
    assert.equal(calls[6].p.Action, 'Adapters');
    assert.equal(calls[6].p.Keyword, 'notify');
    assert.ok(calls.every(c => !('ApiBase' in c.p) && !('OsClient' in c.p)));
}));
test('预览和检查不会发送，保存原通知表配置后自动回读', async () => session(async (client, calls, audits) => {
    const preview = decode(await client.callTool({ name: 'microi_configure_business_notification', arguments: { action: 'Save', rule: config } }));
    assert.equal(preview.confirmationRequired, 'Save:order_approved');
    assert.equal(calls.length, 0);
    assert.equal(audits.length, 0);
    await client.callTool({ name: 'microi_configure_business_notification', arguments: { action: 'Validate', rule: config } });
    assert.equal(calls[0].p.Action, 'Validate');
    assert.equal(audits.length, 0);
    const saved = decode(await client.callTool({ name: 'microi_configure_business_notification', arguments: { action: 'Save', rule: config, confirmExecution: 'Save:order_approved' } }));
    assert.equal(saved.Code, 1);
    assert.equal(calls[1].p.Action, 'Save');
    assert.equal(calls[2].p.Action, 'Get');
    assert.equal(calls[2].p.Id, 'config-1');
    assert.ok(calls.every(c => c.key === 'platform-message-notification-config'));
    assert.ok(audits.every(a => !a.includes('审批通知')));
}));
test('缺版本、确认不符和越界字段都不能触发写入', async () => session(async (client, calls) => {
    const requests = [
        { name: 'microi_configure_business_notification', arguments: { action: 'Save', id: 'config-1', rule: config, confirmExecution: 'Save:config-1' } },
        { name: 'microi_manage_system_reminder', arguments: { action: 'Publish', id: 'a'.repeat(32), requestId: 'stable-request-0001', confirmExecution: 'Publish:' + 'a'.repeat(32) } },
        { name: 'microi_manage_system_reminder', arguments: { action: 'Save', rule, confirmExecution: 'Save:new' } },
        { name: 'microi_configure_business_notification', arguments: { rule: { ...config, ChannelApiEngineMap: { Token: 'not-an-adapter' } } } },
    ];
    for (const request of requests) {
        const result = await client.callTool(request);
        assert.equal(result.isError, true);
    }
    const preview = decode(await client.callTool({ name: 'microi_manage_system_reminder', arguments: { action: 'Publish', id: 'a'.repeat(32), expectedRevision: 1, requestId: 'stable-request-0001', confirmExecution: 'wrong' } }));
    assert.equal(preview.dryRun, true);
    assert.equal(calls.length, 0);
}));
test('公告保存保持草稿与稳定请求，发布和撤回各自单独执行并回读规则', async () => session(async (client, calls) => {
    const requestId = 'stable-request-0001', id = 'a'.repeat(32);
    await client.callTool({ name: 'microi_manage_system_reminder', arguments: { action: 'Save', rule: { ...rule, DisplayMode: 'AfterServerRestart' }, requestId, confirmExecution: 'Save:' + requestId } });
    assert.equal(calls[0].p.Action, 'Save');
    assert.equal(calls[0].p.Rule.DisplayMode, 'AfterServerRestart');
    assert.equal(calls[0].p.Rule.AccountScope, 'SuperAdmins');
    assert.equal(calls[1].p.Action, 'Get');
    assert.equal(calls[1].p.Id, id);
    for (const action of ['Publish', 'Withdraw'])
        await client.callTool({ name: 'microi_manage_system_reminder', arguments: { action, id, expectedRevision: 1, requestId, confirmExecution: action + ':' + id } });
    assert.deepEqual(calls.map(c => c.p.Action), ['Save', 'Get', 'Publish', 'Get', 'Withdraw', 'Get']);
    assert.ok(calls.filter(c => c.p.Action !== 'Get').every(c => c.p.RequestId === requestId));
}));
test('服务端拒绝原样失败，不绕路重试或假报成功', async () => session(async (client, calls) => {
    const result = await client.callTool({ name: 'microi_manage_system_reminder', arguments: { action: 'Validate', rule } });
    assert.equal(result.isError, true);
    assert.equal(decode(result).Msg, '无当前租户权限');
    assert.equal(calls.length, 1);
}, () => ({ Code: 1, Data: { Result: { Code: 0, Msg: '无当前租户权限' } } })));
test('本租户选定普通帐号默认可收件，跨平台范围默认仅超级管理员', async () => session(async (client, calls) => {
    for (const ScopeType of ['Users', 'Tenants', 'Editions'])
        await client.callTool({ name: 'microi_manage_system_reminder', arguments: { action: 'Validate', rule: { ...rule, ScopeType, AccountScope: undefined } } });
    assert.deepEqual(calls.map(call => call.p.Rule.AccountScope), ['AllAccounts', 'SuperAdmins', 'SuperAdmins']);
}));
test('未知写入结果只提示回读，不回显敏感异常或自动重复发送', async () => session(async (client, calls) => {
    const result = await client.callTool({ name: 'microi_configure_business_notification', arguments: { action: 'Save', rule: config, confirmExecution: 'Save:order_approved' } });
    assert.equal(result.isError, true);
    const value = JSON.stringify(result);
    assert.match(value, /先按原 Id/);
    assert.doesNotMatch(value, /sensitive-value/);
    assert.equal(calls.length, 1);
}, () => { throw new Error('sensitive-value'); }));
//# sourceMappingURL=message-notification-tools.test.js.map