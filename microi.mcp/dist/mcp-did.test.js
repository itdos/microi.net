import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMcpDid } from './mcp-did.js';
test('keeps an explicit printable ASCII DID unchanged', () => {
    assert.equal(resolveMcpDid('MCP:NingboHongdi', 'ignored'), 'MCP:NingboHongdi');
});
test('keeps the legacy DID for an ASCII hostname', () => {
    assert.equal(resolveMcpDid(undefined, 'DEV-PC-01'), 'MCP:DEV-PC-01');
});
test('normalizes a Chinese hostname to a stable printable ASCII DID', () => {
    const first = resolveMcpDid(undefined, '宁波鸿地');
    const second = resolveMcpDid(undefined, '宁波鸿地');
    assert.equal(first, second);
    assert.match(first, /^[\x20-\x7E]+$/);
    assert.ok(first.length <= 128);
    assert.notEqual(first, 'MCP:宁波鸿地');
});
test('uses the original Unicode value when generating the stable digest', () => {
    assert.notEqual(resolveMcpDid(undefined, '宁波鸿地'), resolveMcpDid(undefined, '任亿科技'));
});
test('normalizes configured control characters and oversized values', () => {
    const value = resolveMcpDid(`MCP:DEV\r\n${'A'.repeat(200)}`);
    assert.match(value, /^[\x20-\x7E]+$/);
    assert.ok(value.length <= 128);
    assert.equal(value.includes('\r'), false);
    assert.equal(value.includes('\n'), false);
});
//# sourceMappingURL=mcp-did.test.js.map