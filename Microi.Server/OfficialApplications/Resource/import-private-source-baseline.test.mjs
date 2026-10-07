import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('./import-package.js',import.meta.url),'utf8');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const copy=v=>JSON.parse(JSON.stringify(v));
const helperStart=source.indexOf('    // PRIVATE_SOURCE_ACTIVE_BASELINE_V1');
const helperEnd=source.indexOf('    var pruneApplicationAssets',helperStart);
const helpers=helperStart<0?'':source.slice(helperStart,helperEnd);
const loopStart=source.indexOf('        var uploadedSource = [];');
const loopEnd=source.indexOf('        // PACKAGE_RUNTIME_VERSION_SEPARATION_V1',loopStart);
assert.ok(loopStart>0&&loopEnd>loopStart);

function fixture(options={}){
 const appId='AppABC',tenant='qa-tenant',filePath='src/中文 文件.ts',bytes=Buffer.from('保持原始源码字节\n');
 const file={Path:filePath,Sha256:hash(bytes),Size:bytes.length};
 const root='ai-app-source-staged/'+appId+'/store-'+hash(filePath+'\t'+file.Sha256+'\t'+file.Size);
 const target='/'+tenant+'/'+root+'/'+filePath;
 const old='/'+tenant+'/ai-app-source/appabc/202610/中文_文件-123.ts';
 const objects=new Map([[old,bytes]]),calls=[],writes=[];
 const existing={Id:'file-1',FilePath:filePath,HdfsPath:options.canonical?target:old,StorageScope:'Private',ContentHash:file.Sha256,Size:file.Size};
 if(options.canonical)objects.set(target,bytes);
 if(options.badTarget)objects.set(target,Buffer.from('wrong source'));
 if(options.missingOriginal)objects.delete(old);
 const method={
  ObjectExist(p){calls.push(['exist',copy(p)]);assert.equal(p.Limit,true);return{Code:1,Data:objects.has(p.FilePathName)};},
  GetObjectSha256(p){calls.push(['hash',copy(p)]);assert.equal(p.Limit,true);const b=objects.get(p.FilePathName);return b?{Code:1,Data:{Sha256:hash(b),Size:b.length}}:{Code:0,Msg:'missing'};},
  CopyObject(p){calls.push(['copy',copy(p)]);assert.equal(p.Limit,true);assert.ok(p.FilePathName.startsWith('/'+tenant+'/'));assert.ok(p.Path.startsWith('/'+tenant+'/'));if(options.copyFailure)return{Code:0};objects.set(p.Path,Buffer.from(objects.get(p.FilePathName)));if(options.copyLostAck)throw Error('lost ACK');return{Code:1};},
  MoveObject(){assert.fail('source objects must be preserved');},DelFile(){assert.fail('source objects must be preserved');}
 };
 if(options.noCopy)delete method.CopyObject;
 const ctx={V8:{OsClient:tenant,Method:method,EncryptHelper:{Sha256Hex:s=>hash(Buffer.from(s,'utf8'))}},System:{Convert:{FromBase64String:s=>Buffer.from(s,'base64')}},
  firstTextParam:list=>{for(const v of list)if(v!==undefined&&v!==null&&String(v)!=='')return String(v);return'';},
  normalizeApplicationPath:v=>String(v||'').replace(/\\/g,'/').replace(/^\/+|\/+$/g,''),
  applicationFileSha256Base64:s=>hash(Buffer.from(s,'base64')),base64DecodedSize:s=>Buffer.from(s,'base64').length,
  applicationFileName:p=>p.split('/').at(-1),applicationFileType:p=>p.split('.').at(-1),
  appId,appKey:'demo',appName:'演示',appType:'MicroService',sourceRoot:root,sourceFiles:[file],bundleIndex:0,totalBundleAssets:0,
  backgroundChunkingEnabled:false,backgroundCheckpoint:{},existingApplicationAssets:{[filePath.toLowerCase()]:existing},
  stats:{ApplicationSourceFilesReused:0,ApplicationSourceFiles:0},reportProgress:()=>{},
  shouldContinueApplicationAssets:()=>false,markApplicationAssetUploaded:()=>calls.push(['budget']),
  buildApplicationAssetContinuation:(...a)=>({Continuation:a}),
  reuseApplicationAsset:()=>options.newUpload?null:{Path:filePath,HdfsPath:existing.HdfsPath,Hash:existing.ContentHash,Size:existing.Size,StorageScope:existing.StorageScope,Reused:true},
  uploadApplicationAsset:(r,f,limit,rewrite)=>{assert.equal(r,root);assert.equal(limit,true);assert.equal(rewrite,false);calls.push(['upload']);return{Path:filePath,HdfsPath:old,Hash:file.Sha256,Size:file.Size};},
  expectedApplicationPaths:{},upsertApplicationRow:(t,q,row)=>{assert.equal(t,'mci_ai_app_file');writes.push(copy(row));return{Code:1};}
 };
 vm.createContext(ctx);if(helpers)vm.runInContext(helpers,ctx,{timeout:1000});
 const run=()=>vm.runInContext('(function(){'+source.slice(loopStart,loopEnd)+'return uploadedSource;})()',ctx,{timeout:1000});
 return{ctx,file,old,target,root,objects,calls,writes,run};
}

test('legacy reused source is copied to the exact active root and metadata is rewritten while old bytes remain',()=>{
 const f=fixture(),rows=f.run();assert.equal(rows[0].HdfsPath,f.target);assert.equal(f.writes.length,1);assert.equal(f.writes[0].HdfsPath,f.target);assert.equal(f.writes[0].StorageScope,'Private');assert.deepEqual(f.objects.get(f.old),f.objects.get(f.target));assert.equal(f.calls.filter(x=>x[0]==='copy').length,1);assert.equal(f.calls.filter(x=>x[0]==='budget').length,1);
});
test('new upload bytes are copied and verified before the source metadata points at the stable object',()=>{
 const f=fixture({newUpload:true});f.run();assert.equal(f.writes[0].HdfsPath,f.target);assert.deepEqual(f.objects.get(f.old),f.objects.get(f.target));assert.equal(f.calls.filter(x=>x[0]==='budget').length,1);
});
test('canonical same-version reinstall hashes existing bytes without copying or rewriting metadata',()=>{
 const f=fixture({canonical:true});const rows=f.run();assert.equal(rows[0].HdfsPath,f.target);assert.equal(f.writes.length,0);assert.equal(f.calls.filter(x=>x[0]==='hash').length,1);assert.equal(f.calls.filter(x=>x[0]==='copy').length,0);
});
test('lost copy acknowledgement is reconciled only by the actual destination hash and length',()=>{
 const f=fixture({copyLostAck:true});f.run();assert.equal(f.writes[0].HdfsPath,f.target);assert.deepEqual(f.objects.get(f.old),f.objects.get(f.target));
});
for(const opt of [{badTarget:true},{copyFailure:true},{missingOriginal:true},{noCopy:true}])test('storage mismatch or unavailable capability fails before metadata writes '+JSON.stringify(opt),()=>{
 const f=fixture(opt);assert.throws(f.run,/PRIVATE_SOURCE_/);assert.equal(f.writes.length,0);assert.ok(!f.calls.some(x=>x[0]==='budget'));
});
test('source data in a public bucket is rejected before copying or changing metadata',()=>{
 const f=fixture();f.ctx.existingApplicationAssets[f.file.Path.toLowerCase()].StorageScope='Public';assert.throws(f.run,/PRIVATE_SOURCE_/);assert.equal(f.writes.length,0);
});
test('source outside this application or tenant is rejected before storage access',()=>{
 for(const path of ['/other-tenant/ai-app-source/appabc/x','/qa-tenant/ai-app-source/other-app/x','/qa-tenant/ai-app-source/appabc/../x']){
  const f=fixture();f.ctx.existingApplicationAssets[f.file.Path.toLowerCase()].HdfsPath=path;assert.throws(f.run,/PRIVATE_SOURCE_/);assert.equal(f.writes.length,0);assert.equal(f.calls.length,0);
 }
});
test('a durable earlier source slice reuses verified canonical metadata without rehashing the prefix',()=>{
 const f=fixture({canonical:true});Object.assign(f.ctx,{backgroundChunkingEnabled:true,backgroundCheckpoint:{Phase:'ApplicationAssets',AssetKind:'Source',BundleIndex:0,AssetIndex:1}});const rows=f.run();assert.equal(rows[0].HdfsPath,f.target);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
});
for(const kind of ['Build','BuildRepair'])test('编译文件检查点继续时不重新消耗已经验证的源码分片 '+kind,()=>{
 const f=fixture({canonical:true});Object.assign(f.ctx,{backgroundChunkingEnabled:true,backgroundCheckpoint:{Phase:'ApplicationAssets',AssetKind:kind,BundleIndex:0,AssetIndex:0}});
 f.ctx.shouldContinueApplicationAssets=()=>true;
 const rows=f.run();assert.ok(Array.isArray(rows),'编译检查点不能退回 Source 游标');assert.equal(rows[0].HdfsPath,f.target);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
});
test('后续应用检查点不会重复验证前一个应用的规范私有源码',()=>{
 const f=fixture({canonical:true});Object.assign(f.ctx,{backgroundChunkingEnabled:true,backgroundCheckpoint:{Phase:'ApplicationAssets',AssetKind:'Source',BundleIndex:1,AssetIndex:0}});
 f.ctx.shouldContinueApplicationAssets=()=>true;
 assert.ok(Array.isArray(f.run()));assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
});
for(const change of ['unknown-kind','earlier-bundle','foreign-root'])test('未验证的检查点或非规范源码仍必须占用验证预算 '+change,()=>{
 const f=fixture({canonical:true});Object.assign(f.ctx,{backgroundChunkingEnabled:true,backgroundCheckpoint:{Phase:'ApplicationAssets',AssetKind:'Build',BundleIndex:0,AssetIndex:0}});
 if(change==='unknown-kind')f.ctx.backgroundCheckpoint.AssetKind='Unknown';
 if(change==='earlier-bundle')f.ctx.bundleIndex=1;
 if(change==='foreign-root')f.ctx.reuseApplicationAsset=()=>({Path:f.file.Path,HdfsPath:f.old,Hash:f.file.Sha256,Size:f.file.Size,StorageScope:'Private',Reused:true});
 f.ctx.shouldContinueApplicationAssets=()=>true;
 assert.deepEqual(copy(f.run()),{Continuation:[f.ctx.bundleIndex,'Source',0,1]});assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
});
test('canonical reuse also respects the source verification budget and returns the same next cursor',()=>{
 const f=fixture({canonical:true});f.ctx.shouldContinueApplicationAssets=()=>true;const r=f.run();assert.deepEqual(copy(r),{Continuation:[0,'Source',0,1]});assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
});
test('source manifest uses ordinal paths, raw-byte hashes and sizes, independent of input order',()=>{
 const f=fixture();assert.equal(typeof f.ctx.getPrivateSourceBaselineRoot,'function');const second={Path:'A/文件.txt',Sha256:hash(Buffer.from('a')),Size:1};
 const expected='ai-app-source-staged/AppABC/store-'+hash([second,f.file].map(r=>r.Path+'\t'+r.Sha256+'\t'+r.Size).join('\n'));
 assert.equal(f.ctx.getPrivateSourceBaselineRoot('AppABC',[f.file,second]),expected);assert.equal(f.ctx.getPrivateSourceBaselineRoot('AppABC',[second,f.file]),expected);
 for(const bad of ['../file','a//file','a\\file','a%2ffile',' file','a#file'])assert.throws(()=>f.ctx.getPrivateSourceBaselineRoot('AppABC',[{...f.file,Path:bad}]),/PRIVATE_SOURCE_/);
 assert.throws(()=>f.ctx.getPrivateSourceBaselineRoot('AppABC',[f.file,{...f.file,Path:f.file.Path.toUpperCase()}]),/PRIVATE_SOURCE_/);
});
