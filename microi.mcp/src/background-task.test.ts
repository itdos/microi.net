import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBackgroundWorkload, analyzeClientChunking } from './advanced-tools.js';

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

test('does not misclassify a long-task management dialog as the task itself', () => {
  const result = analyzeBackgroundWorkload({
    Name: '数据库定时备份',
    V8Code: `V8.OpenAppDialog({
      AppKey: 'microi-platform-service',
      RoutePath: '/database-backup',
      Title: '数据库定时备份',
      Width: '80%'
    });`,
  });
  assert.deepEqual(result, { required: false, reasons: [] });
});

test('accepts an explicit resumable client chunking contract', () => {
  const result = analyzeClientChunking({
    Name: '批量生成主构件码',
    Workload: {
      ExecutionMode: 'ClientChunked',
      MaxItemsPerChunk: 40,
      Resumable: true,
    },
  });
  assert.deepEqual(result, {
    declared: true,
    valid: true,
    maxItemsPerChunk: 40,
    resumable: true,
  });
});

test('rejects incomplete client chunking declarations', () => {
  const result = analyzeClientChunking({
    Name: '批量处理',
    Workload: {
      ExecutionMode: 'ClientChunked',
      MaxItemsPerChunk: 0,
    },
  });
  assert.equal(result.declared, true);
  assert.equal(result.valid, false);
});
