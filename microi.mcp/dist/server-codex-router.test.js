import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
test('microi_codex discovers and invokes existing tools through one entry point', async () => {
    const fakeClient = {
        getStatus: async () => ({
            Code: 1,
            Data: { OsClient: 'junchi', Online: true },
        }),
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'junchi',
        apiBaseUrl: 'https://api.chongstech.com',
        label: '宁波鸿地',
        codexMode: true,
    });
    const client = new Client({ name: 'microi-router-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
    ]);
    try {
        const tools = await client.listTools();
        assert.equal(tools.tools.length, 1);
        assert.ok(tools.tools.some(tool => tool.name === 'microi_codex'));
        const resources = await client.listResources();
        assert.ok(resources.resources.some(resource => resource.uri === 'microi://codex/status'));
        assert.ok(resources.resources.some(resource => resource.uri === 'microi://codex/tools'));
        const templates = await client.listResourceTemplates();
        assert.ok(templates.resourceTemplates.some(template => template.uriTemplate === 'microi://codex/action/{action}/{params}'));
        const resourceStatus = await client.readResource({
            uri: 'microi://codex/action/microi_get_status/%7B%7D',
        });
        const firstResourceContent = resourceStatus.contents[0];
        const resourceStatusText = firstResourceContent && 'text' in firstResourceContent
            ? firstResourceContent.text
            : '';
        assert.match(resourceStatusText, /junchi/);
        const catalog = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'list_tools', params: { keyword: 'status' } },
        });
        const catalogText = catalog.content[0]?.type === 'text' ? catalog.content[0].text : '';
        assert.match(catalogText, /microi_get_status/);
        const databaseCatalog = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'list_tools', params: { keyword: 'database' } },
        });
        const databaseCatalogText = databaseCatalog.content[0]?.type === 'text'
            ? databaseCatalog.content[0].text
            : '';
        assert.match(databaseCatalogText, /microi_inspect_external_database/);
        assert.match(databaseCatalogText, /microi_execute_external_database/);
        assert.match(databaseCatalogText, /microi_save_database_connection/);
        const indexCatalog = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'list_tools', params: { keyword: 'index' } },
        });
        const indexCatalogText = indexCatalog.content[0]?.type === 'text'
            ? indexCatalog.content[0].text
            : '';
        assert.match(indexCatalogText, /microi_get_table_indexes/);
        assert.match(indexCatalogText, /microi_create_table_index/);
        assert.match(indexCatalogText, /microi_drop_table_index/);
        const blockedIndexCreate = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_create_table_index',
                params: {
                    tableName: 'biz_order',
                    columns: ['OsClient', 'OrderNo'],
                    unique: true,
                },
            },
        });
        const blockedIndexCreateText = blockedIndexCreate.content[0]?.type === 'text'
            ? blockedIndexCreate.content[0].text
            : '';
        assert.equal(blockedIndexCreate.isError, true);
        assert.match(blockedIndexCreateText, /confirmExecution="biz_order"/);
        const administrativeSqlDryRun = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_execute_external_database',
                params: {
                    dbKey: 'erp_sqlserver',
                    mode: 'NonQuery',
                    sql: 'DROP TABLE audit_example',
                },
            },
        });
        const administrativeSqlDryRunText = administrativeSqlDryRun.content[0]?.type === 'text'
            ? administrativeSqlDryRun.content[0].text
            : '';
        assert.match(administrativeSqlDryRunText, /"dryRun": true/);
        assert.match(administrativeSqlDryRunText, /"sqlSha256": "[a-f0-9]{64}"/);
        assert.doesNotMatch(administrativeSqlDryRunText, /DROP TABLE/);
        const saveDryRun = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_save_database_connection',
                params: {
                    dbKey: 'erp_sqlserver',
                    databaseType: 'SqlServer',
                    connectionString: 'Server=db.example;User Id=admin;Password=top-secret;',
                },
            },
        });
        const saveDryRunText = saveDryRun.content[0]?.type === 'text' ? saveDryRun.content[0].text : '';
        assert.match(saveDryRunText, /"dryRun": true/);
        assert.doesNotMatch(saveDryRunText, /top-secret|db\.example|admin/);
        const attachmentDryRun = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_import_external_attachment',
                params: {
                    sourceUrl: 'https://files.example.com/invoice.pdf?token=signed-secret',
                    headers: { Authorization: 'Bearer header-secret' },
                },
            },
        });
        const attachmentDryRunText = attachmentDryRun.content[0]?.type === 'text'
            ? attachmentDryRun.content[0].text
            : '';
        assert.match(attachmentDryRunText, /https:\/\/files\.example\.com\/\[REDACTED\]/);
        assert.doesNotMatch(attachmentDryRunText, /invoice\.pdf|signed-secret|header-secret/);
        const localAttachmentDryRun = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_import_external_attachment',
                params: {
                    sourcePath: '\\\\fileserver\\finance-secret\\annual-report-500mb.zip',
                },
            },
        });
        const localAttachmentDryRunText = localAttachmentDryRun.content[0]?.type === 'text'
            ? localAttachmentDryRun.content[0].text
            : '';
        assert.match(localAttachmentDryRunText, /LOCAL_OR_UNC_SOURCE/);
        assert.doesNotMatch(localAttachmentDryRunText, /annual-report-500mb\.zip|finance-secret|fileserver/);
        const status = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_get_status', params: {} },
        });
        const statusText = status.content[0]?.type === 'text' ? status.content[0].text : '';
        assert.match(statusText, /junchi/);
        const invalid = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_get_table_data', params: {} },
        });
        const invalidText = invalid.content[0]?.type === 'text' ? invalid.content[0].text : '';
        assert.equal(invalid.isError, true);
        assert.match(invalidText, /Invalid tool parameters/);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=server-codex-router.test.js.map