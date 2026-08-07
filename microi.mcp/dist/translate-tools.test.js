import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer, prepareMcpTranslateFileInput, } from './server.js';
function toolText(result) {
    return result.content
        .filter(item => item.type === 'text')
        .map(item => item.type === 'text' ? item.text : '')
        .join('\n');
}
test('translation MCP tools expose the complete safe tenant-bound business surface', async () => {
    let textRequest;
    let fileRequest;
    let suggestionRequest;
    const audits = [];
    const fakeClient = {
        translateText: async (input) => {
            textRequest = input;
            return {
                Code: 1,
                Msg: '',
                Data: {
                    Provider: 'LibreTranslate',
                    IsBatch: true,
                    TranslatedText: 'Hello',
                    TranslatedTexts: ['Hello', 'World'],
                    AlternativeGroups: [['Hi'], ['Earth']],
                },
            };
        },
        detectLanguage: async () => ({ Code: 1, Msg: '', Data: [{ Language: 'fr', Confidence: 98 }] }),
        listTranslateLanguages: async () => ({ Code: 1, Msg: '', Data: [{ Code: 'zh', Name: 'Chinese', Targets: ['en'] }] }),
        translateFile: async (input) => {
            fileRequest = input;
            const bytes = Buffer.from('translated file', 'utf8');
            return {
                Code: 1,
                Msg: '',
                Data: {
                    Provider: 'LibreTranslate',
                    FileName: 'translated.txt',
                    ContentType: 'text/plain',
                    FileByteBase64: bytes.toString('base64'),
                    ByteLength: bytes.length,
                },
            };
        },
        suggestTranslation: async (input) => {
            suggestionRequest = input;
            return { Code: 1, Msg: '', Data: { Provider: 'LibreTranslate', Success: true } };
        },
        getTranslateHealth: async () => ({
            Code: 1,
            Msg: '',
            Data: { Provider: 'LibreTranslate', Status: 'ok', Healthy: true, SupportsBatch: true },
        }),
        writeAuditLog: async (action, target, content) => {
            audits.push({ action, target, content });
            return { Code: 1, Data: null, Msg: '' };
        },
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'tenant-a', apiBaseUrl: 'https://microi.test', label: '测试租户', codexMode: true,
    });
    const client = new Client({ name: 'microi-translate-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const catalog = await client.callTool({
            name: 'microi_codex', arguments: { action: 'list_tools', params: { keyword: 'translate' } },
        });
        for (const name of [
            'microi_translate', 'microi_detect_language', 'microi_list_translate_languages',
            'microi_translate_file', 'microi_suggest_translation', 'microi_get_translate_health',
        ])
            assert.match(toolText(catalog), new RegExp(name, 'u'));
        const translated = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_translate',
                params: {
                    sourceTexts: ['你好', '世界'], fromLang: 'auto', targetLang: 'en', alternatives: 1,
                    OsClient: 'forged', Endpoint: 'https://evil.example', ApiKey: 'forged',
                },
            },
        });
        assert.equal(translated.isError, undefined);
        assert.deepEqual(textRequest, {
            SourceTexts: ['你好', '世界'], FromLang: 'auto', Lang: 'en', Format: 'text', Alternatives: 1,
        });
        assert.equal(textRequest.OsClient, undefined);
        for (const [action, params] of [
            ['microi_detect_language', { sourceText: 'Bonjour' }],
            ['microi_list_translate_languages', {}],
            ['microi_get_translate_health', {}],
        ]) {
            const response = await client.callTool({ name: 'microi_codex', arguments: { action, params } });
            assert.equal(response.isError, undefined);
        }
        const blockedFile = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_translate_file', params: {
                    fileByteBase64: Buffer.from('hello').toString('base64'), fileName: 'note.txt', targetLang: 'zh', includeFileByteBase64: true,
                } },
        });
        assert.equal(blockedFile.isError, true);
        assert.match(toolText(blockedFile), /TRANSLATE_FILE/u);
        const translatedFile = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_translate_file', params: {
                    fileByteBase64: Buffer.from('hello').toString('base64'), fileName: 'note.txt',
                    fromLang: 'en', targetLang: 'zh', includeFileByteBase64: true,
                    confirmExecution: 'TRANSLATE_FILE', Endpoint: 'https://evil.example',
                } },
        });
        assert.equal(translatedFile.isError, undefined);
        assert.equal(fileRequest?.FileName, 'note.txt');
        assert.equal(fileRequest.Endpoint, undefined);
        assert.match(toolText(translatedFile), /translated\.txt/u);
        const blockedSuggestion = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_suggest_translation', params: {
                    sourceText: 'Hello', suggestedText: '你好', fromLang: 'en', targetLang: 'zh',
                } },
        });
        assert.equal(blockedSuggestion.isError, true);
        const suggestion = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_suggest_translation', params: {
                    sourceText: 'Hello', suggestedText: '你好', fromLang: 'en', targetLang: 'zh',
                    confirmExecution: 'TRANSLATE_SUGGEST', ApiKey: 'forged',
                } },
        });
        assert.equal(suggestion.isError, undefined);
        assert.deepEqual(suggestionRequest, {
            SourceText: 'Hello', SuggestedText: '你好', FromLang: 'en', Lang: 'zh',
        });
        assert.equal(audits.length, 2);
        assert.doesNotMatch(audits.map(item => item.content).join('\n'), /Hello|你好|evil|forged|tenant-a/u);
        assert.match(audits[0].content, /"sha256":"[a-f0-9]{64}"/u);
        assert.match(audits[1].content, /sourceSha256/u);
    }
    finally {
        await client.close();
        await server.close();
    }
});
test('prepareMcpTranslateFileInput rejects ambiguous and unsupported files before HTTP', () => {
    assert.throws(() => prepareMcpTranslateFileInput({ targetLang: 'en' }), /必须且只能/u);
    assert.throws(() => prepareMcpTranslateFileInput({
        fileByteBase64: Buffer.from('x').toString('base64'), fileName: 'payload.exe', targetLang: 'en',
    }), /仅支持 TXT/u);
    assert.throws(() => prepareMcpTranslateFileInput({
        filePath: 'relative.txt', targetLang: 'en',
    }), /绝对路径/u);
});
//# sourceMappingURL=translate-tools.test.js.map