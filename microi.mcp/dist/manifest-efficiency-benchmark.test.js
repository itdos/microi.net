import assert from 'node:assert/strict';
import test from 'node:test';
import { runManifestEfficiencyBenchmark } from './manifest-efficiency-benchmark.js';
test('三类真实工具链载荷基准保持资源动作和验收契约一致，不把字节虚报为 Token', async () => {
    const report = await runManifestEfficiencyBenchmark();
    assert.equal(report.cases.length, 3);
    assert.match(report.boundary, /不是供应商 Token 账单/);
    for (const scenario of report.cases) {
        assert.equal(scenario.contractsEqual, true);
        assert.match(scenario.contractHash, /^[a-f0-9]{64}$/);
        assert.equal(scenario.baseline.errors, 0);
        assert.equal(scenario.candidate.errors, 0);
        assert.equal(scenario.baseline.validationCalls, 2);
        assert.equal(scenario.candidate.validationCalls, 2);
        assert.equal(scenario.baseline.toolCalls, 4);
        assert.equal(scenario.candidate.toolCalls, 4);
        assert.ok(scenario.selected.requestBytes + scenario.selected.responseBytes <= scenario.baseline.requestBytes + scenario.baseline.responseBytes);
    }
    assert.ok(report.cases.find(item => item.id === 'complete-system').requestReductionPercent > 50);
});
//# sourceMappingURL=manifest-efficiency-benchmark.test.js.map