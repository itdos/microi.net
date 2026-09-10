// 客户采购工作台的可重复回归由统一门禁自动发现，测试正文留在唯一应用源码旁。
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverTests } from '../run-node-regressions.mjs';
import '../../../Microi-V8-Engine/宁波鸿地-开发环境 (api-dev.chongstech.com)/hongdi-dev.default.default/AI应用/junchi-create-purchase-order-v2/tests/purchase-v2.test.mjs';
import '../../../Microi-V8-Engine/宁波鸿地-开发环境 (api-dev.chongstech.com)/hongdi-dev.default.default/AI应用/junchi-create-purchase-order-v2/tests/purchase-tree-v2.test.mjs';

test('采购工作台适配器通过统一原生回归发现入口', () => {
  const file = fileURLToPath(import.meta.url);
  // 验证真实发现入口接纳本文件；原应用测试仍由上方两个导入完整执行。
  assert.ok(discoverTests(path.dirname(file)).includes(file));
});
