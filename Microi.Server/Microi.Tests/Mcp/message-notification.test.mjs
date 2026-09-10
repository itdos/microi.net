import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
test('消息通知 MCP 真实工具 Schema、处理器、回读与权限契约',()=>{
 const source=fs.readFileSync(path.join(repo,'microi.mcp/src/server.ts'),'utf8');
 assert.match(source,/registerMessageNotificationTools\(server,\s*client,\s*context\)/);
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--max-old-space-size=256','--import','tsx','--test','--test-concurrency=1','--test-reporter=tap','src/message-notification-tools.test.ts'],{cwd:path.join(repo,'microi.mcp'),env,encoding:'utf8',windowsHide:true,timeout:60000});
 assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(result.stdout,/# tests 7\b/);assert.match(result.stdout,/# pass 7\b/);
 for(const key of ['fail','cancelled','skipped','todo'])assert.match(result.stdout,new RegExp(`# ${key} 0\\b`));
});
