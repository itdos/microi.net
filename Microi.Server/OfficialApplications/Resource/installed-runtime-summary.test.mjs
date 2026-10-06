import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import test from 'node:test';
const source=await readFile(new URL('./import-package.js',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
function load(){const body=source.match(/function summarizeInstalledRuntimeAssets\(assets\) \{[\s\S]*?\r?\n\}/)?.[0];assert.ok(body,'安装器必须按目标运行资产计算摘要，不能保留旧 DistHash');return new Function('V8',body+';return summarizeInstalledRuntimeAssets;')({EncryptHelper:{Sha256Hex:hash}});}
test('运行摘要使用目标租户实际 HTML 和构建字节的摘要，顺序稳定',()=>{
 const summarize=load(),assets=[{Path:'index.html',Hash:hash('tenant-specific-html'),Size:672},{Path:'assets/app.js',Hash:hash('javascript'),Size:31}];
 const result=summarize(assets);assert.deepEqual(result,{DistHash:hash('assets/app.js\t'+hash('javascript')+'\t31\nindex.html\t'+hash('tenant-specific-html')+'\t672'),TotalSize:703});
 assert.deepEqual(summarize([...assets].reverse()),result);assert.notEqual(summarize([{...assets[0],Hash:hash('another tenant')},assets[1]]).DistHash,result.DistHash);
 assert.match(source,/DistHash: installedRuntimeSummary\.DistHash|serviceRow\.DistHash = installedRuntimeSummary\.DistHash/);
 assert.match(source,/installedService\.DistHash[\s\S]*installedRuntimeSummary\.DistHash/);
});
test('缺失哈希、非法大小、重复路径和超限运行包拒绝生成可信摘要',()=>{
 const summarize=load(),valid={Path:'index.html',Hash:hash('html'),Size:12};
 for(const assets of [[],[{...valid,Hash:''}],[{...valid,Size:-1}],[{...valid,Size:1.5}],[{...valid,Size:Infinity}],[valid,{...valid,Path:'INDEX.HTML'}],Array.from({length:257},(_,i)=>({...valid,Path:i+'.js'})),[{...valid,Size:5*1024*1024+1}]])assert.throws(()=>summarize(assets));
});
