// 官方应用只有一个源码根；统一回归门禁直接执行该事实源测试，不复制运行代码。
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = new URL('../../../Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/AI应用/ai-employee-center/tests/gateway.test.cjs', import.meta.url);
assert.ok(fs.existsSync(source), '统一回归要求提供 AI 员工应用的唯一源码根');
await import(source.href);
await import(new URL('draft.test.cjs',source).href);
await import(new URL('context.test.cjs',source).href);
