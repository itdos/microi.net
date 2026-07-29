import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBackgroundWorkload } from './advanced-tools.js';
test('classifies estimated long-running work as a background task', () => {
    const result = analyzeBackgroundWorkload({
        Name: '生成测试任务',
        ApiEngineKey: 'seed_test_tasks',
        Workload: { ExpectedItems: 2000, FanOutOperations: 10000, ExpectedSeconds: 3000 },
    });
    assert.equal(result.required, true);
    assert.match(result.reasons.join('\n'), /2000/);
    assert.match(result.reasons.join('\n'), /3000s/);
});
test('does not force a small synchronous row action into the queue', () => {
    const result = analyzeBackgroundWorkload({
        Name: '审核',
        ApiEngineKey: 'order_approve',
        Workload: { ExpectedItems: 1, ExpectedSeconds: 2 },
    });
    assert.deepEqual(result, { required: false, reasons: [] });
});
//# sourceMappingURL=background-task.test.js.map