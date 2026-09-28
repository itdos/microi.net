import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = new URL('../../../microi.openclaw/server/services/employee-worker.test.cjs', import.meta.url);
assert.ok(fs.existsSync(source), '统一回归要求提供吾码小龙虾源码');
await import(source.href);
