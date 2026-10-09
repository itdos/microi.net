import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
import test from 'node:test';
import {projects,capturePlain,verifyEncrypted,verifyFinal,verifyPackages,enumeratePendingPackages,readPendingPackageList,verifyPendingPackages,verifyPendingPackageInventory,verifyPendingPackageUpload} from '../../tools/release-encryption.mjs';

const md5=bytes=>createHash('md5').update(bytes).digest('hex');
function fixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-encryption-proof-')),file=path.join(directory,'evidence.json');
 for(const project of projects)fs.writeFileSync(path.join(directory,project+'.dll'),Buffer.from('plain-'+project));
 capturePlain(directory,file);
 const encrypt=()=>{
  for(const project of projects)fs.writeFileSync(path.join(directory,project+'.dll'),Buffer.from('encrypted-'+project));
  signature();
 };
 const signature=()=>fs.writeFileSync(path.join(directory,'.microi-encrypted'),projects.map(p=>p+'.dll='+md5(fs.readFileSync(path.join(directory,p+'.dll')))).join('\n'));
 return {directory,file,encrypt,signature,dispose:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
// Real ZIP fixture, stored entries with valid CRC32; no external dependency or worktree proxy.
function zip(file,entries,{deflate=false}={}){
 const local=[],central=[];let offset=0;
 const crc=bytes=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 for(const [entry,content]of entries){
  const name=Buffer.from(entry),bytes=Buffer.from(content),packed=deflate?deflateRawSync(bytes):bytes,header=Buffer.alloc(30),index=Buffer.alloc(46),checksum=crc(bytes);
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(deflate?8:0,8);header.writeUInt32LE(checksum,14);header.writeUInt32LE(packed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);
  index.writeUInt32LE(0x02014b50,0);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);index.writeUInt16LE(deflate?8:0,10);index.writeUInt32LE(checksum,16);index.writeUInt32LE(packed.length,20);index.writeUInt32LE(bytes.length,24);index.writeUInt16LE(name.length,28);index.writeUInt32LE(offset,42);
  local.push(header,name,packed);central.push(index,name);offset+=header.length+name.length+packed.length;
 }
 const end=Buffer.alloc(22),directory=Buffer.concat(central);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 fs.writeFileSync(file,Buffer.concat([...local,directory,end]));
}
function packages(f,change=()=>{}){
 return projects.map(project=>{
  const file=path.join(f.directory,`${project}.8.5.2.nupkg`),entries=[['lib/net10.0/'+project+'.dll',fs.readFileSync(path.join(f.directory,project+'.dll'))]];
  change(project,entries);zip(file,entries);return file;
 });
}
function pendingFixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'microi nuget all packages '));
 const server=path.join(root,'Microi.Server'),directory=path.join(server,'Microi.net.Api/bin/Release/publish'),file=path.join(root,'evidence.json');
 fs.mkdirSync(directory,{recursive:true});
 for(const project of projects)fs.writeFileSync(path.join(directory,project+'.dll'),'plain-'+project);
 capturePlain(directory,file);
 for(const project of projects)fs.writeFileSync(path.join(directory,project+'.dll'),'encrypted-'+project);
 fs.writeFileSync(path.join(directory,'.microi-encrypted'),projects.map(p=>p+'.dll='+md5(fs.readFileSync(path.join(directory,p+'.dll')))).join('\n'));
 verifyEncrypted(directory,file);
 const files=projects.map(project=>{
  const filename=path.join(server,project,'bin/Release',`${project}.8.5.2.nupkg`);fs.mkdirSync(path.dirname(filename),{recursive:true});
  zip(filename,[['lib/net10.0/'+project+'.dll',fs.readFileSync(path.join(directory,project+'.dll'))]]);return filename;
 });
 const list=path.join(root,'pending.nul');
 const writeList=(entries=files)=>fs.writeFileSync(list,Buffer.from(entries.join('\0')+'\0'));
 writeList();
 return {root,server,directory,file,files,list,writeList,dispose:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('literal ZIP wildcard names cannot read an encrypted neighboring entry instead of a plaintext DLL',()=>{
 const f=fixture(),previousPath=process.env.PATH;try{
  // Exercise the actual Git Bash unzip branch of the old gate on Windows.
  if(process.platform==='win32'){
   const gitExec=execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim();
   process.env.PATH=path.resolve(gitExec,'../../..','usr/bin')+path.delimiter+previousPath;
  }
  f.encrypt();verifyEncrypted(f.directory,f.file);
  for(const [literal,neighbor]of [['[a]','a'],['star*dir','star-neighbordir'],['question?dir','questionXdir']]){
   const files=packages(f,(project,entries)=>{
    if(project==='Microi.net')entries.push(
     [`tools/${literal}/Microi.Vision.dll`,'plain-Microi.Vision'],
     [`tools/${neighbor}/Microi.Vision.dll`,fs.readFileSync(path.join(f.directory,'Microi.Vision.dll'))]);
   });
   assert.throws(()=>verifyPackages(f.directory,f.file,'8.5.2',files),/Unencrypted or stale DLL/,`Literal ${literal} must be read by exact ZIP entry identity`);
  }
 }finally{process.env.PATH=previousPath;f.dispose();}
});

test('valid encrypted literal wildcard, backslash and newline ZIP entries retain their full names',()=>{
 const f=fixture();try{
  f.encrypt();verifyEncrypted(f.directory,f.file);
  const names=['tools/[a]/Microi.Vision.dll','tools/star*dir/Microi.Vision.dll','tools/question?dir/Microi.Vision.dll','tools\\literal\\Microi.Vision.dll','tools/line\nbreak/Microi.Vision.dll'];
  const files=packages(f,(project,entries)=>{if(project==='Microi.net')for(const entry of names)entries.push([entry,fs.readFileSync(path.join(f.directory,'Microi.Vision.dll'))]);});
  const proof=verifyPackages(f.directory,f.file,'8.5.2',files);
  assert.deepEqual(proof.packages.files[0].entries.slice(1).map(entry=>entry.entry),names);
 }finally{f.dispose();}
});

test('duplicate literal ZIP entries cannot conceal a second closed DLL copy',()=>{
 const f=fixture();try{
  f.encrypt();verifyEncrypted(f.directory,f.file);
  const files=packages(f,(project,entries)=>{if(project==='Microi.net')entries.push(['tools/[a]/Microi.Vision.dll','encrypted-Microi.Vision'],['tools/[a]/Microi.Vision.dll','plain-Microi.Vision']);});
  assert.throws(()=>verifyPackages(f.directory,f.file,'8.5.2',files),/Duplicate ZIP entries/);
 }finally{f.dispose();}
});

test('real deflated NuGet entries are hashed from decompressed DLL bytes',()=>{
 const f=fixture();try{
  f.encrypt();verifyEncrypted(f.directory,f.file);
  const files=projects.map(project=>{
   const filename=path.join(f.directory,`${project}.8.5.2.nupkg`);
   zip(filename,[['lib/net10.0/'+project+'.dll',fs.readFileSync(path.join(f.directory,project+'.dll'))]],{deflate:true});return filename;
  });
  assert.equal(verifyPackages(f.directory,f.file,'8.5.2',files).packages.files.length,5);
 }finally{f.dispose();}
});

test('Windows precise PowerShell ZIP fallback preserves literal names when Python is unavailable',{skip:process.platform!=='win32'},()=>{
 const f=pendingFixture();try{
  const names=['tools/[a]/Microi.Vision.dll','tools/star*dir/Microi.Vision.dll','tools/question?dir/Microi.Vision.dll','tools\\literal\\Microi.Vision.dll'];
  zip(f.files[0],[['lib/net10.0/Microi.net.dll',fs.readFileSync(path.join(f.directory,'Microi.net.dll'))],...names.map(entry=>[entry,fs.readFileSync(path.join(f.directory,'Microi.Vision.dll'))])],{deflate:true});
  const cli=fileURLToPath(new URL('../../tools/release-encryption.mjs',import.meta.url));
  const environment={...process.env,PATH:path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0')};
  const run=spawnSync(process.execPath,[cli,'packages',f.directory,f.file,'8.5.2',f.list],{encoding:'utf8',env:environment});
  assert.equal(run.status,0,run.stderr);
  const proof=JSON.parse(fs.readFileSync(f.file,'utf8'));
  assert.deepEqual(proof.packages.files.find(item=>item.file===fs.realpathSync(f.files[0])).entries.slice(1).map(item=>item.entry),names);
  zip(f.files[0],[['lib/net10.0/Microi.net.dll',fs.readFileSync(path.join(f.directory,'Microi.net.dll'))],['tools/[a]/Microi.Vision.dll','plain-Microi.Vision'],['tools/a/Microi.Vision.dll',fs.readFileSync(path.join(f.directory,'Microi.Vision.dll'))]],{deflate:true});
  const rejected=spawnSync(process.execPath,[cli,'packages',f.directory,f.file,'8.5.2',f.list],{encoding:'utf8',env:environment});
  assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/Unencrypted or stale DLL/);
  // PS 5.1/.NET Framework silently exposes zero entries for a newline name.
  // The package cannot be omitted even when the other five packages are valid.
  const extra=path.join(path.dirname(f.files[0]),'Hidden.Copy.8.5.2.nupkg');
  zip(extra,[['tools/line\nbreak/Microi.Vision.dll','plain-Microi.Vision']],{deflate:true});
  f.files.push(extra);f.writeList();
  zip(f.files[0],[['lib/net10.0/Microi.net.dll',fs.readFileSync(path.join(f.directory,'Microi.net.dll'))]],{deflate:true});
  const hidden=spawnSync(process.execPath,[cli,'packages',f.directory,f.file,'8.5.2',f.list],{encoding:'utf8',env:environment});
  assert.notEqual(hidden.status,0);assert.match(hidden.stderr,/Exact ZIP reader returned no entries/);
 }finally{f.dispose();}
});

test('missing precise ZIP readers cannot authorize an upload',()=>{
 const f=pendingFixture();try{
  const cli=fileURLToPath(new URL('../../tools/release-encryption.mjs',import.meta.url));
  const run=spawnSync(process.execPath,[cli,'packages',f.directory,f.file,'8.5.2',f.list],{encoding:'utf8',env:{...process.env,PATH:f.root}});
  assert.notEqual(run.status,0);assert.match(run.stderr,/Exact ZIP inspection requires Python 3 or PowerShell/);
  assert.equal(JSON.parse(fs.readFileSync(f.file,'utf8')).packages,undefined);
 }finally{f.dispose();}
});

test('real publication CLI rejects a stale closed DLL in a nested differently named NuGet package',()=>{
 const f=pendingFixture();try{
  const extra=path.join(f.server,'Integration Product/nested/bin/Release/Custom.Package.8.5.2.nupkg');fs.mkdirSync(path.dirname(extra),{recursive:true});
  zip(extra,[['tools/Microi.Vision.dll','plain-Microi.Vision']]);f.files.push(extra);f.writeList();
  const cli=fileURLToPath(new URL('../../tools/release-encryption.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[cli,'packages',f.directory,f.file,'8.5.2',f.list],{encoding:'utf8'});
  assert.notEqual(result.status,0,'Every pending package must be checked before any upload, including nested PackageId differences');
  assert.match(result.stderr,/Unencrypted or stale DLL/);
 }finally{f.dispose();}
});

test('real CLI packages and both CAS modes preserve complete nested PackageId and case-varied DLL copies',()=>{
 const f=pendingFixture();try{
  const extra=path.join(f.server,'Integration Product/nested/bin/Release/Custom.Package.8.5.2.nupkg');fs.mkdirSync(path.dirname(extra),{recursive:true});
  zip(extra,[['tools/mIcRoI.vIsIoN.DLL',fs.readFileSync(path.join(f.directory,'Microi.Vision.dll'))]]);f.files.push(extra);f.writeList();
  const cli=fileURLToPath(new URL('../../tools/release-encryption.mjs',import.meta.url));
  for(const args of [['packages',f.list],['packages-cas',f.list],['package-cas',extra]]){
   const result=spawnSync(process.execPath,[cli,args[0],f.directory,f.file,'8.5.2',args[1]],{encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);
  }
  const proof=JSON.parse(fs.readFileSync(f.file,'utf8'));
  assert.equal(proof.packages.files.length,6);
  const scanned=proof.packages.files.find(packageFile=>packageFile.file===fs.realpathSync(extra));
  assert.equal(scanned.bytes,fs.statSync(extra).size);
  assert.equal(scanned.entries[0].entry,'tools/mIcRoI.vIsIoN.DLL');
  assert.equal(scanned.entries[0].dll,'Microi.Vision.dll');
  assert.equal(scanned.sha256,createHash('sha256').update(fs.readFileSync(extra)).digest('hex'));
 }finally{f.dispose();}
});
test('case-varied plaintext closed DLL names cannot bypass the archive scan',()=>{
 const f=fixture();try{
  f.encrypt();verifyEncrypted(f.directory,f.file);
  const files=packages(f,(_,entries)=>entries.push(['tools/microi.VISION.DLL','plain-Microi.Vision']));
  assert.throws(()=>verifyPackages(f.directory,f.file,'8.5.2',files),/Unencrypted or stale DLL/);
 }finally{f.dispose();}
});
test('symbol and other-version archives are excluded from the exact pending upload inventory',()=>{
 const f=pendingFixture();try{
  for(const name of ['Ignored.8.5.2.symbols.nupkg','Ignored.8.5.2.snupkg','Ignored.8.5.1.nupkg'])fs.writeFileSync(path.join(path.dirname(f.files[0]),name),'not a package to publish');
  assert.deepEqual(enumeratePendingPackages(f.server,'8.5.2'),f.files.map(file=>fs.realpathSync(file)).sort());
  assert.equal(verifyPendingPackages(f.directory,f.file,'8.5.2',f.list).packages.files.length,5);
 }finally{f.dispose();}
});
test('an omitted pending package is rejected before any partial ZIP scan can authorize upload',()=>{
 const f=pendingFixture();try{f.writeList(f.files.slice(1));assert.throws(()=>verifyPendingPackages(f.directory,f.file,'8.5.2',f.list),/complete pending upload set/);}finally{f.dispose();}
});
test('duplicate, empty and unterminated pending list items fail closed',()=>{
 const f=pendingFixture();try{
  f.writeList([...f.files,f.files[0]]);assert.throws(()=>readPendingPackageList(f.list,f.server,'8.5.2'),/Duplicate pending/);
  fs.writeFileSync(f.list,Buffer.from(f.files.join('\0')+'\0\0'));assert.throws(()=>readPendingPackageList(f.list,f.server,'8.5.2'),/Empty pending/);
  fs.writeFileSync(f.list,Buffer.from(f.files.join('\0')));assert.throws(()=>readPendingPackageList(f.list,f.server,'8.5.2'),/NUL-terminated/);
 }finally{f.dispose();}
});
test('unknown paths outside the server or outside bin Release cannot enter the pending list',()=>{
 const f=pendingFixture();try{
  const outside=path.join(f.root,'Outside.8.5.2.nupkg');zip(outside,[]);
  f.writeList([...f.files,outside]);assert.throws(()=>readPendingPackageList(f.list,f.server,'8.5.2'),/outside the server root/);
  const unsupported=path.join(f.server,'Unknown.8.5.2.nupkg');zip(unsupported,[]);
  f.writeList([...f.files,unsupported]);assert.throws(()=>readPendingPackageList(f.list,f.server,'8.5.2'),/Unsupported pending/);
 }finally{f.dispose();}
});
test('a linked pending package is rejected instead of following an unknown target',()=>{
 const f=pendingFixture();try{
  const extra=path.join(path.dirname(f.files[0]),'Linked.8.5.2.nupkg');fs.symlinkSync(f.files[0],extra,'file');
  f.writeList([...f.files,extra]);assert.throws(()=>readPendingPackageList(f.list,f.server,'8.5.2'),/Unknown or linked/);
 }finally{f.dispose();}
});
test('first-upload CAS rejects an added real package, and per-package CAS rejects its unverified path',()=>{
 const f=pendingFixture();try{
  verifyPendingPackages(f.directory,f.file,'8.5.2',f.list);
  const extra=path.join(path.dirname(f.files[0]),'Added.8.5.2.nupkg');zip(extra,[['content/readme.txt','new package']]);
  const fresh=path.join(f.root,'fresh.nul');fs.writeFileSync(fresh,Buffer.from([...f.files,extra].join('\0')+'\0'));
  assert.throws(()=>verifyPendingPackageInventory(f.directory,f.file,'8.5.2',fresh),/inventory changed before the first upload/);
  assert.throws(()=>verifyPendingPackageUpload(f.directory,f.file,'8.5.2',extra),/Unverified NuGet package/);
 }finally{f.dispose();}
});
test('same-sized actual package metadata drift blocks both first-upload and per-package hashes',()=>{
 const f=pendingFixture();try{
  const contents=fs.readFileSync(path.join(f.directory,projects[0]+'.dll'));
  zip(f.files[0],[['lib/net10.0/'+projects[0]+'.dll',contents],['content/info.txt','metadata-A']]);
  verifyPendingPackages(f.directory,f.file,'8.5.2',f.list);
  const previousBytes=fs.statSync(f.files[0]).size;
  zip(f.files[0],[['lib/net10.0/'+projects[0]+'.dll',contents],['content/info.txt','metadata-B']]);
  assert.equal(fs.statSync(f.files[0]).size,previousBytes);
  assert.throws(()=>verifyPendingPackageInventory(f.directory,f.file,'8.5.2',f.list),/hash changed before upload/);
  assert.throws(()=>verifyPendingPackageUpload(f.directory,f.file,'8.5.2',f.files[0]),/hash changed before upload/);
 }finally{f.dispose();}
});
test('verified NUL list byte changes cannot silently reorder or replace upload inputs',()=>{
 const f=pendingFixture();try{
  verifyPendingPackages(f.directory,f.file,'8.5.2',f.list);f.writeList([...f.files].reverse());
  assert.throws(()=>verifyPendingPackageUpload(f.directory,f.file,'8.5.2',f.files[0]),/Verified pending NuGet list changed/);
 }finally{f.dispose();}
});

for(const mode of ['success','after-scan-byte-drift','after-scan-added-package'])test(`actual find NUL list and production NuGet shell gate ${mode}`,()=>{
 const f=pendingFixture();try{
  const nested=path.join(f.server,'Integration Product/nested/bin/Release/Custom.Package.8.5.2.nupkg');fs.mkdirSync(path.dirname(nested),{recursive:true});
  zip(nested,[['tools/mIcRoI.vIsIoN.DLL',fs.readFileSync(path.join(f.directory,'Microi.Vision.dll'))]]);f.files.push(nested);
  const cli=fileURLToPath(new URL('../../tools/release-encryption.mjs',import.meta.url));
  const tool=path.join(f.server,'tools/release-encryption.mjs');fs.mkdirSync(path.dirname(tool),{recursive:true});fs.copyFileSync(cli,tool);
  const source=fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url)),'utf8');
  const begin=source.indexOf('# ─── 阶段（条件）: NuGet 推送'),end=source.indexOf('# ─── 阶段（条件）: 推送 Docker 镜像',begin);
  assert.ok(begin>0&&end>begin);
  const quote=value=>"'"+value.replaceAll('\\','/').replaceAll("'","'\\''")+"'";
  const gitExec=process.platform==='win32'?execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim():'';
  const bash=process.platform==='win32'?path.resolve(gitExec,'../../..','bin/bash.exe'):'bash';
  const extra=path.join(path.dirname(f.files[0]),'Extra Product.8.5.2.nupkg');
  const run=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:f.root,encoding:'utf8',input:`
print_phase(){ :; }; print_step(){ :; }; print_success(){ :; }; print_warning(){ :; }
print_fail(){ printf '%s\\n' "$*" >&2; exit 17; }
PUSH_NUGET=true; HAS_ENCRYPT=true; DLL_ENCRYPTED=true; NUPKG_REPLACED=true
VERSION=8.5.2; PUBLISH_DIR=${quote(f.directory)}; MICROI_ENCRYPTION_RECEIPT=${quote(f.file)}
NUGET_API_KEY=fixture; NUGET_SOURCE=fixture
dotnet(){ printf 'UPLOAD_REACHED=%s\\n' "$*"; }
node(){
 ${quote(process.execPath)} "$@"; local result=$?
 if [ "$result" -eq 0 ] && [ "\$2" = packages ]; then
  ${mode==='after-scan-byte-drift'?`printf changed > ${quote(f.files[0])}`:mode==='after-scan-added-package'?`cp ${quote(f.files[0])} ${quote(extra)}`:':'}
 fi
 return "$result"
}
${source.slice(begin,end)}
`});
  assert.ifError(run.error);
  if(mode==='success'){assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.match(/UPLOAD_REACHED=/g)?.length,6);}
  else{assert.equal(run.status,17,run.stderr);assert.equal(run.stdout.includes('UPLOAD_REACHED='),false);assert.match(run.stderr,/首个上传前 NuGet 清单或包字节发生变化/);}
 }finally{f.dispose();}
});

test('all five actual DLLs must change and match their native encryption fingerprints',()=>{
 const f=fixture();try{f.encrypt();const proof=verifyEncrypted(f.directory,f.file);assert.equal(Object.keys(proof.encrypted).length,5);verifyFinal(f.directory,f.file);}finally{f.dispose();}
});
test('success flag or matching fingerprint cannot certify an unchanged plaintext DLL',()=>{
 const f=fixture();try{f.signature();assert.throws(()=>verifyEncrypted(f.directory,f.file),/did not change bytes/);}finally{f.dispose();}
});
test('one unchanged DLL blocks the entire encrypted release',()=>{
 const f=fixture();try{f.encrypt();fs.writeFileSync(path.join(f.directory,'Microi.AI.dll'),'plain-Microi.AI');f.signature();assert.throws(()=>verifyEncrypted(f.directory,f.file),/did not change bytes/);}finally{f.dispose();}
});
test('missing or duplicate native fingerprint blocks release',()=>{
 const f=fixture();try{f.encrypt();fs.appendFileSync(path.join(f.directory,'.microi-encrypted'),'\nMicroi.net.dll=duplicate');assert.throws(()=>verifyEncrypted(f.directory,f.file),/duplicate encryption/);}finally{f.dispose();}
});
test('missing closed DLL blocks release',()=>{
 const f=fixture();try{f.encrypt();fs.unlinkSync(path.join(f.directory,'Microi.MCP.dll'));assert.throws(()=>verifyEncrypted(f.directory,f.file),/ENOENT/);}finally{f.dispose();}
});
test('plaintext rebuild after encryption invalidates final release evidence',()=>{
 const f=fixture();try{f.encrypt();verifyEncrypted(f.directory,f.file);fs.writeFileSync(path.join(f.directory,'Microi.Vision.dll'),'plain-Microi.Vision');assert.throws(()=>verifyFinal(f.directory,f.file),/Final DLL bytes differ/);}finally{f.dispose();}
});
test('all five actual NuGet ZIP entries match the encrypted DLL receipts',()=>{
 const f=fixture();try{f.encrypt();verifyEncrypted(f.directory,f.file);const proof=verifyPackages(f.directory,f.file,'8.5.2',packages(f));assert.equal(proof.packages.files.length,5);}finally{f.dispose();}
});
test('changed NuGet archive containing one plaintext DLL is rejected before upload',()=>{
 const f=fixture();try{f.encrypt();verifyEncrypted(f.directory,f.file);const files=packages(f,(project,entries)=>{if(project==='Microi.AI')entries[0][1]='plain-Microi.AI';});assert.throws(()=>verifyPackages(f.directory,f.file,'8.5.2',files),/Unencrypted or stale DLL/);}finally{f.dispose();}
});
test('extra stale closed DLL in any NuGet package is rejected',()=>{
 const f=fixture();try{f.encrypt();verifyEncrypted(f.directory,f.file);const files=packages(f,(project,entries)=>{if(project==='Microi.net')entries.push(['tools/Microi.Vision.dll','plain-Microi.Vision']);});assert.throws(()=>verifyPackages(f.directory,f.file,'8.5.2',files),/Unencrypted or stale DLL/);}finally{f.dispose();}
});
test('omitted closed NuGet DLL cannot pass a partial package scan',()=>{
 const f=fixture();try{f.encrypt();verifyEncrypted(f.directory,f.file);const files=packages(f).slice(1);assert.throws(()=>verifyPackages(f.directory,f.file,'8.5.2',files),/No actual encrypted NuGet entry/);}finally{f.dispose();}
});
test('NuGet package from a different release version is rejected',()=>{
 const f=fixture();try{f.encrypt();verifyEncrypted(f.directory,f.file);assert.throws(()=>verifyPackages(f.directory,f.file,'8.5.1',packages(f)),/Package version differs/);}finally{f.dispose();}
});
