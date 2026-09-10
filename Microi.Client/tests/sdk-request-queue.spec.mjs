import { suite } from 'node:test';

// 以标准 Node suite 注册共享矩阵，使统一发现器能够分类，保留全部八个真实行为用例。
await suite('PC/API 分发 SDK 的请求队列回归', async () => {
  await import('../../microi.uniapp/scripts/test-request-queue.mjs');
});
