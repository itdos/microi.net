// 官方应用只有一个源码根；统一回归门禁直接执行该事实源测试，不复制运行代码。
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {officialApplicationSource} from './official-application-source.mjs';
const source = pathToFileURL(path.join(officialApplicationSource('ai-employee-center'),'tests/gateway.test.cjs'));
await import(source.href);
await import(new URL('draft.test.cjs',source).href);
await import(new URL('context.test.cjs',source).href);
