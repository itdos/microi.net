import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { assertPayloadSourceIntegrity, assertSourceIntegrity, findSourceIntegrityIssues } from './source-integrity.js';
test('detects AI and terminal output contamination markers', () => {
    const samples = [
        'var a = 1;\n…676 tokens truncated…\nreturn a;',
        'var a = 1;\n...1961 tokens truncated...\nreturn a;',
        'var a = 1;\nExit code: 0\nreturn a;',
        'Chunk ID: abc123',
        'Wall time: 0.25 seconds',
        'Process exited with code 1',
    ];
    for (const sample of samples) {
        assert.ok(findSourceIntegrityIssues(sample).length > 0, sample);
        assert.throws(() => assertSourceIntegrity(sample, '测试保存'));
    }
});
test('does not reject legitimate quoted business strings', () => {
    const source = [
        'var message = "Exit code: 0";',
        'var label = "Chunk ID: business-value";',
        '// The phrase tokens truncated is discussed here.',
        'return { Code: 1, Data: message };',
    ].join('\n');
    assert.deepEqual(findSourceIntegrityIssues(source), []);
    assert.doesNotThrow(() => assertSourceIntegrity(source, '测试保存'));
});
test('scans nested module button payloads', () => {
    assert.throws(() => assertPayloadSourceIntegrity({
        ModuleId: 'module-1',
        MoreBtns: JSON.stringify([{ Id: 'button-1', V8Code: 'var a = 1;\nExit code: 0' }]),
    }, '更新菜单模块'));
});
test('microservice source replacement never sends legacy full-table Replace=true', () => {
    const serverSource = fs.readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
    const syncImplementation = serverSource.match(/export async function runMicroServiceSourceSync[\s\S]*?const LEGACY_STREAM_COMPATIBILITY_MAX_FILES/)?.[0] || '';
    assert.match(syncImplementation, /Replace:\s*false/u);
    assert.match(syncImplementation, /ReplacePrivateSourceOnly:\s*input\.replace !== false/u);
    assert.match(syncImplementation, /ReplacePrivateSourceOnly:\s*true/u);
    assert.doesNotMatch(syncImplementation, /Replace:\s*input\.replace/u);
});
//# sourceMappingURL=source-integrity.test.js.map