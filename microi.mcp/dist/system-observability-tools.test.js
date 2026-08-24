import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
function toolText(result) {
    return result.content
        .filter(item => item.type === 'text')
        .map(item => item.type === 'text' ? item.text : '')
        .join('\n');
}
test('system observability MCP exposes bounded read catalog and confirmed IP governance', async () => {
    const queries = [];
    const commands = [];
    const audits = [];
    const fakeClient = {
        querySystemObservability: async (query) => {
            queries.push(query);
            return { Code: 1, Msg: '', Data: { Action: query.Action, CurrentNodeOnly: true } };
        },
        manageSystemObservability: async (command) => {
            commands.push(command);
            return { Code: 1, Msg: '已封禁。', Data: { Ip: command.Ip } };
        },
        writeAuditLog: async (action, target, content) => {
            audits.push({ action, target, content });
            return { Code: 1, Msg: '', Data: null };
        },
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'tenant-a', apiBaseUrl: 'https://microi.test', label: '测试租户', codexMode: true,
    });
    const client = new Client({ name: 'microi-system-observability-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const catalog = await client.callTool({
            name: 'microi_codex', arguments: { action: 'list_tools', params: { keyword: 'observability' } },
        });
        assert.match(toolText(catalog), /microi_query_system_observability/u);
        assert.match(toolText(catalog), /microi_manage_system_observability/u);
        const capabilities = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_query_system_observability', params: { action: 'Capabilities' } },
        });
        assert.equal(capabilities.isError, undefined);
        assert.equal(queries[0]?.Action, 'Capabilities');
        const traffic = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_query_system_observability',
                params: { action: 'HistoricalDashboard', rangeKey: '30d', top: 15 },
            },
        });
        assert.equal(traffic.isError, undefined);
        assert.deepEqual(queries[1], {
            Action: 'HistoricalDashboard', RangeKey: '30d', Top: 15,
        });
        const trafficDetails = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_query_system_observability',
                params: {
                    action: 'TrafficDetails', rangeKey: '7d', pageIndex: 2, pageSize: 15,
                    transferAction: '上传', ip: '203.0.113.20', userId: 'user-1',
                    endpoint: '/apiengine/upload-file', keyword: '.zip',
                },
            },
        });
        assert.equal(trafficDetails.isError, undefined);
        assert.deepEqual(queries[2], {
            Action: 'TrafficDetails', Keyword: '.zip', _Keyword: '.zip',
            PageIndex: 2, _PageIndex: 2, PageSize: 15, _PageSize: 15,
            RangeKey: '7d', TransferAction: '上传', Ip: '203.0.113.20',
            UserId: 'user-1', Endpoint: '/apiengine/upload-file',
        });
        const missingTrace = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_query_system_observability', params: { action: 'Trace' } },
        });
        assert.equal(missingTrace.isError, true);
        assert.equal(queries.length, 3);
        const dryRun = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_manage_system_observability',
                params: { action: 'BlockIp', ip: '203.0.113.10', blockMinutes: 45, reason: '异常流量复核' },
            },
        });
        assert.equal(dryRun.isError, undefined);
        assert.match(toolText(dryRun), /"dryRun": true/u);
        assert.match(toolText(dryRun), /BlockIp:203\.0\.113\.10/u);
        assert.equal(commands.length, 0);
        assert.equal(audits.length, 0);
        const confirmed = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_manage_system_observability',
                params: {
                    action: 'BlockIp', ip: '203.0.113.10', blockMinutes: 45, reason: '异常流量复核',
                    confirmExecution: 'BlockIp:203.0.113.10',
                },
            },
        });
        assert.equal(confirmed.isError, undefined);
        assert.deepEqual(commands[0], {
            Action: 'BlockIp', Ip: '203.0.113.10', BlockMinutes: 45, Reason: '异常流量复核',
        });
        assert.equal(audits.length, 1);
        assert.doesNotMatch(audits[0]?.content || '', /异常流量复核/u);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=system-observability-tools.test.js.map