import assert from 'node:assert/strict';import test from 'node:test';
import {runSourceZip,sha256,sourceFixture} from './ai-app-source-zip-harness.mjs';

function installedFixture(){
 const f=sourceFixture(3),rows=f.rows.slice().sort((a,b)=>a.FilePath<b.FilePath?-1:a.FilePath>b.FilePath?1:0),digest=sha256(Buffer.from(rows.map(r=>r.FilePath+'\t'+r.ContentHash+'\t'+r.Size).join('\n')));
 f.app.PrivateSourcePath='/itdos/ai-app-source-staged/'+f.app.Id+'/store-'+digest;
 for(const r of f.rows){const old=r.HdfsPath;r.HdfsPath=f.app.PrivateSourcePath+'/'+r.FilePath;f.bytes.set(r.HdfsPath,f.bytes.get(old));}
 return f;
}
test('完整安装活动根清单与根摘要一致时可导出完整原生源码',async()=>{
 const r=await runSourceZip(installedFixture());assert.equal(r.result.Code,1);assert.equal(r.result.Data.FileCount,3);
});
for(const kind of ['partial','empty','malformed-root','wrong-root-digest','metadata-drift'])test('安装分片窗口或摘要漂移不得把剩余文件当作完整源码 '+kind,async()=>{
 const f=installedFixture();if(kind==='partial')f.rows.pop();
 if(kind==='empty')f.rows=[];
 if(kind==='malformed-root'){
  f.app.PrivateSourcePath=f.app.PrivateSourcePath.replace(/store-[a-f0-9]{64}$/,'store-incomplete');
  for(const row of f.rows){const prior=row.HdfsPath;row.HdfsPath=f.app.PrivateSourcePath+'/'+row.FilePath;f.bytes.set(row.HdfsPath,f.bytes.get(prior));}
 }
 if(kind==='wrong-root-digest'){
  const old=f.app.PrivateSourcePath;f.app.PrivateSourcePath=old.replace(/store-[a-f0-9]{64}$/,'store-'+'0'.repeat(64));
  for(const row of f.rows){const prior=row.HdfsPath;row.HdfsPath=f.app.PrivateSourcePath+'/'+row.FilePath;f.bytes.set(row.HdfsPath,f.bytes.get(prior));}
 }
 if(kind==='metadata-drift')f.rows[0].ContentHash='a'.repeat(64);
 const r=await runSourceZip(f);assert.equal(r.result.Code,0);assert.equal(r.result.Reason,'SOURCE_ZIP_METADATA');assert.equal(r.state.reads.length+r.state.zips.length,0);assert.equal(r.state.writes,0);
});
test('源码包装目录仍按完整物理 FilePath 核对安装根，归档路径继续兼容去掉 source/',async()=>{
 const f=installedFixture();for(const r of f.rows){const old=r.HdfsPath;r.FilePath='source/'+r.FilePath;r.HdfsPath=f.app.PrivateSourcePath+'/'+r.FilePath;f.bytes.set(r.HdfsPath,f.bytes.get(old));}
 const digest=sha256(Buffer.from(f.rows.slice().sort((a,b)=>a.FilePath<b.FilePath?-1:1).map(r=>r.FilePath+'\t'+r.ContentHash+'\t'+r.Size).join('\n')));f.app.PrivateSourcePath=f.app.PrivateSourcePath.replace(/store-[a-f0-9]{64}$/,'store-'+digest);
 for(const r of f.rows){const old=r.HdfsPath;r.HdfsPath=f.app.PrivateSourcePath+'/'+r.FilePath;f.bytes.set(r.HdfsPath,f.bytes.get(old));}
 const r=await runSourceZip(f);assert.equal(r.result.Code,1);assert.equal(r.result.Data.FileCount,3);assert.ok(r.state.zips[0].Entries.every(e=>!e.Path.startsWith('source/')));
});
