import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=fs.readFileSync(path.join(repo,'Microi.Server/Microi.Core/V8Engine/V8McpLogic.ApplicationAssetStreamV3.Runtime.cs'),'utf8');
function method(name){const start=source.search(new RegExp('private static [^\\r\\n]+ '+name+'\\('));assert.ok(start>=0,name);const end=source.indexOf('\n        private static ',start+1);return source.slice(start,end<0?source.length:end);}
test('v3版本INSERT中摘要列和值同位，所有字段数一致且参数化',()=>{
 const body=method('InsertApplicationAssetV3Version'),array=name=>[...body.match(new RegExp('var '+name+' = new\\[\\]\\s*\\{([\\s\\S]*?)\\};'))[1].matchAll(/"([^"\r\n]+)"/g)].map(m=>m[1]);
 const columns=array('columns'),values=array('values');assert.equal(columns.length,values.length);const i=columns.indexOf('ChangeSummary');assert.ok(i>=0,'v3插入漏存版本变更摘要');assert.equal(values[i],'@changeSummary');assert.match(body,/AddInParameter\("@changeSummary", request\.ChangeSummary\)/);
});
test('内存版本快照与恢复请求保留持久摘要，不从恢复客户端覆盖',()=>{
 assert.match(method('BuildApplicationAssetV3VersionSnapshot'),/\["ChangeSummary"\] = request\.ChangeSummary/);
 assert.match(source,/ChangeSummary = SafeJString\(version, "ChangeSummary"\)/);
});
test('展示摘要不改变既有不可变发布指纹和恢复证明',()=>{
 assert.ok(!method('BuildApplicationAssetV3BuildLog').includes('["ChangeSummary"]'));
 assert.match(method('ParseApplicationAssetV3ProtocolRequest'),/ChangeSummary/);
});
test('MCP真实流式发布Schema接受2000字符摘要且拒绝对象与超长值',()=>{
 const mcp=fs.readFileSync(path.join(repo,'microi.mcp/src/server.ts'),'utf8'),field=mcp.match(/changeSummary: (z\.string\(\)[^\r\n]+)\.describe\('Version change summary/);
 assert.ok(field);const {z}=createRequire(path.join(repo,'microi.mcp/package.json'))('zod'),schema=new Function('z','return '+field[1])(z);
 for(const x of [undefined,'说明','文'.repeat(2000)])assert.equal(schema.safeParse(x).success,true);
 for(const x of [{Status:'Completed'},['说明'],'文'.repeat(2001)])assert.equal(schema.safeParse(x).success,false);
});
