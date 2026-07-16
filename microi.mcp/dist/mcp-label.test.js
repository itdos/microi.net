import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMcpLabel } from './mcp-label.js';
test('resolves a Chinese display label from ASCII Base64', () => {
    const label = '宁波鸿地';
    assert.equal(resolveMcpLabel({ MICROI_LABEL_BASE64: Buffer.from(label, 'utf8').toString('base64') }), label);
});
test('keeps the legacy plain label fallback', () => {
    assert.equal(resolveMcpLabel({ MICROI_LABEL: '宁波鸿地' }), '宁波鸿地');
});
test('falls back when the Base64 label is malformed', () => {
    assert.equal(resolveMcpLabel({ MICROI_LABEL_BASE64: 'not-base64', MICROI_LABEL: 'legacy-label' }), 'legacy-label');
});
//# sourceMappingURL=mcp-label.test.js.map