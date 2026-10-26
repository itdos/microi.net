import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
import test from 'node:test';
import {projects,capturePlain,verifyEncrypted,verifyFinal,verifyPackageDll,verifyPackages,enumeratePendingPackages,readPendingPackageList,verifyPendingPackages,verifyPendingPackageInventory,verifyPendingPackageUpload} from '../../tools/release-encryption.mjs';

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
  zip(filename,[[project+'.nuspec',`<package><metadata><id>${project}</id><version>8.5.2</version></metadata></package>`],['lib/net10.0/'+project+'.dll',fs.readFileSync(path.join(directory,project+'.dll'))]]);return filename;
 });
 const list=path.join(root,'pending.nul');
 const writeList=(entries=files)=>fs.writeFileSync(list,Buffer.from(entries.join('\0')+'\0'));
 writeList();
 return {root,server,directory,file,files,list,writeList,dispose:()=>fs.rmSync(root,{recursive:true,force:true})};
}

for(const scenario of ['already-encrypted-stable-digest','replace-plaintext-without-digest-tools','reject-stale-package'])
test(`NuGet DLL replacement gate accepts verified bytes: ${scenario}`,()=>{
 const f=pendingFixture();try{
  const source=fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url)),'utf8');
  const begin=source.indexOf('    replace_dll_in_nupkg() {'),end=source.indexOf('    _replace_error=0',begin);
  assert.ok(begin>0&&end>begin);
  const gitExec=process.platform==='win32'?execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim():'';
  const bash=process.platform==='win32'?path.resolve(gitExec,'../../..','bin/bash.exe'):'bash';
  const cli=fileURLToPath(new URL('../../tools/release-encryption.mjs',import.meta.url));
  const quote=value=>"'"+value.replaceAll('\\','/').replaceAll("'","'\\''")+"'";
  if(scenario.startsWith('replace-plaintext')||scenario==='reject-stale-package')zip(f.files[0],[['lib/net10.0/Microi.net.dll','plain-Microi.net']]);
  const run=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:f.root,encoding:'utf8',timeout:20000,input:`
set -e
print_step(){ :; }; print_success(){ :; }; print_warning(){ :; }
print_fail(){ printf '%s\\n' "$*" >&2; exit 17; }
run_release_command(){ "$@"; }
node(){ shift; ${quote(process.execPath)} ${quote(cli)} "$@"; }
md5(){ ${scenario.startsWith('already-')?"printf '11111111111111111111111111111111\\n'":'return 1'}; }
md5sum(){ return 1; }
${scenario==='reject-stale-package'?'zip(){ return 0; }':''}
VERSION=8.5.2
PUBLISH_DIR=${quote(f.directory)}
MICROI_ENCRYPTION_RECEIPT=${quote(f.file)}
MICROI_RELEASE_SCRATCH=${quote(f.root)}
${source.slice(begin,end)}
replace_dll_in_nupkg Microi.net
printf 'VERIFIED_PACKAGE_REACHED\\n'
`});
  assert.ifError(run.error);
  if(scenario==='reject-stale-package'){
   assert.equal(run.status,17,run.stdout+'\n'+run.stderr);
   assert.match(run.stderr,/Unencrypted or stale DLL/);
   assert.doesNotMatch(run.stdout,/VERIFIED_PACKAGE_REACHED/);
   return;
  }
  assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
  assert.match(run.stdout,/VERIFIED_PACKAGE_REACHED/);
  // 成功仍依赖现有完整包内字节门禁，不能仅靠新函数的退出码或日志。
  assert.equal(verifyPackages(f.directory,f.file,'8.5.2',f.files).packages.files.length,5);
 }finally{f.dispose();}
});

test('single-package DLL proof is idempotent and verifies every TFM without changing the archive',()=>{
 const f=pendingFixture();try{
  const dll=fs.readFileSync(path.join(f.directory,'Microi.net.dll'));
  zip(f.files[0],[['lib/netstandard2.1/Microi.net.dll',dll],['lib/net10.0/Microi.net.dll',dll]]);
  const before=fs.readFileSync(f.files[0]);
  for(let attempt=0;attempt<2;attempt++)assert.equal(verifyPackageDll(f.directory,f.file,f.files[0],'Microi.net').entries.length,2);
  assert.deepEqual(fs.readFileSync(f.files[0]),before);
 }finally{f.dispose();}
});

for(const scenario of ['wrong-second-tfm','missing-lib','stale-other-closed-copy','duplicate-entry','unknown-project','wrong-package-identity'])
test(`single-package DLL proof rejects ${scenario}`,()=>{
 const f=pendingFixture();try{
  const dll=fs.readFileSync(path.join(f.directory,'Microi.net.dll'));
  const entries=[['lib/netstandard2.1/Microi.net.dll',dll]];
  if(scenario==='wrong-second-tfm')entries.push(['lib/net10.0/Microi.net.dll','plain-Microi.net']);
  if(scenario==='missing-lib')entries[0][0]='tools/Microi.net.dll';
  if(scenario==='stale-other-closed-copy')entries.push(['tools/[a]/Microi.Vision.dll','plain-Microi.Vision']);
  if(scenario==='duplicate-entry')entries.push(entries[0]);
  zip(f.files[0],entries);
  assert.throws(()=>verifyPackageDll(f.directory,f.file,f.files[0],scenario==='unknown-project'?'Foreign':scenario==='wrong-package-identity'?'Microi.AI':'Microi.net'),/Unencrypted or stale DLL|Missing encrypted lib DLL|Duplicate ZIP entries|Unknown encrypted package project|Encrypted package identity differs/);
 }finally{f.dispose();}
});

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

for(const mode of ['success','after-scan-byte-drift','after-scan-added-package','candidate-rejected','candidate-drift-after-first-upload','missing-platform-dependency','remote-preflight-rejected'])test(`actual find NUL list and production NuGet shell gate ${mode}`,()=>{
 const f=pendingFixture();try{
  const nested=path.join(f.server,'Integration Product/nested/bin/Release/Custom.Package.8.5.2.nupkg');fs.mkdirSync(path.dirname(nested),{recursive:true});
  zip(nested,[['Custom.Package.nuspec','<package><metadata><id>Custom.Package</id><version>8.5.2</version></metadata></package>'],['tools/mIcRoI.vIsIoN.DLL',fs.readFileSync(path.join(f.directory,'Microi.Vision.dll'))]]);f.files.push(nested);
  if(mode==='missing-platform-dependency')zip(f.files[0],[['Microi.net.nuspec','<package><metadata><id>Microi.net</id><version>8.5.2</version><dependencies><dependency id="Microi.NPOI" version="8.5.2"/></dependencies></metadata></package>'],['lib/net10.0/Microi.net.dll',fs.readFileSync(path.join(f.directory,'Microi.net.dll'))]]);
  const cli=fileURLToPath(new URL('../../tools/release-encryption.mjs',import.meta.url));
  const tool=path.join(f.server,'tools/release-encryption.mjs');fs.mkdirSync(path.dirname(tool),{recursive:true});fs.copyFileSync(cli,tool);
  // 真实候选工具的直接依赖须完整复制，不能让隔离 shell 场景在进入发布门禁前因缺模块退出。
  for(const name of ['release-candidate.mjs','release-composition.mjs','release-standard-inputs.mjs','release-desktop-inputs.mjs','release-nuget-closure.mjs','release-scratch.mjs'])
   fs.copyFileSync(fileURLToPath(new URL('../../tools/'+name,import.meta.url)),path.join(f.server,'tools',name));
  const candidateRepos=['.','Microi.Server/Microi.net','Microi.Server/Microi.AI','Microi.Server/Microi.MCP','Microi.Agent','Microi.Client/src/views/webos','Microi.Server/Microi.WorkFlow','Microi.Server/Microi.Vision'];
  for(const repo of candidateRepos){const cwd=path.resolve(f.root,repo);fs.mkdirSync(cwd,{recursive:true});execFileSync('git',['init','--quiet'],{cwd});}
  fs.writeFileSync(path.join(f.root,'.gitignore'),'/evidence.json\n/pending.nul\n/.tmp/\n'+candidateRepos.slice(1).map(repo=>'/'+repo+'/').join('\n')+'\n');
  const candidate=path.join(f.root,'.tmp/verified-candidate.json'),probe=path.join(f.root,'candidate-source.txt');
  fs.writeFileSync(probe,'accepted source');
  // 此处验证既有 Full NuGet 制品；临时空仓不得继承外层正式 PlatformRelease 的候选与私有配置。
  const environment={...process.env,MICROI_RELEASE_TEST_POLICY:'Full'};
  for(const key of ['MICROI_RELEASE_CANDIDATE','MICROI_RELEASE_TEST_RECEIPT','MICROI_RELEASE_SMOKE_CONFIG','MICROI_RELEASE_COMPOSITION_FILE','CustomAfterMicrosoftCommonTargets','PrivateRulesProject','ApprovedRulesBootstrapSource','MicroiCoreProject'])delete environment[key];
  execFileSync(process.execPath,[path.join(f.server,'tools/release-candidate.mjs'),'capture',candidate],{cwd:f.root,env:environment});
  if(mode==='candidate-rejected')fs.appendFileSync(probe,' changed before first upload');
  const source=fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url)),'utf8');
  const budgetFunctions=source.slice(source.indexOf('# 从交互选项完成开始计时'),source.indexOf('# Windows (Git Bash) 下'));
  // NuGet 正式入口依赖原生断点函数；夹具必须加载真实定义，避免缺函数掩盖安全断言。
  const sessionFunctions=source.slice(source.indexOf('release_stage_needed() {'),source.indexOf('# 发布进程专用输出目录'));
  const begin=source.indexOf('# ─── 阶段（条件）: NuGet 推送'),end=source.indexOf('# ─── 阶段（条件）: 推送 Docker 镜像',begin);
  assert.ok(begin>0&&end>begin);
  const quote=value=>"'"+value.replaceAll('\\','/').replaceAll("'","'\\''")+"'";
  const gitExec=process.platform==='win32'?execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim():'';
  const bash=process.platform==='win32'?path.resolve(gitExec,'../../..','bin/bash.exe'):'bash';
  const extra=path.join(path.dirname(f.files[0]),'Extra Product.8.5.2.nupkg');
  const run=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:f.root,env:environment,encoding:'utf8',input:`
print_phase(){ :; }; print_step(){ :; }; print_success(){ :; }; print_warning(){ :; }; print_info(){ :; }
print_fail(){ printf '%s\\n' "$*" >&2; exit 17; }
${budgetFunctions}
${sessionFunctions}
PUSH_NUGET=true; HAS_ENCRYPT=true; DLL_ENCRYPTED=true; NUPKG_REPLACED=true
VERSION=8.5.2; PUBLISH_DIR=${quote(f.directory)}; MICROI_ENCRYPTION_RECEIPT=${quote(f.file)}
MICROI_RELEASE_GATE_DIR="$PWD/.tmp/microi-release-gate"
MICROI_RELEASE_CANDIDATE=${quote(candidate)}
CONFIG_FILE=private-config.json
node(){
 if [[ "$1" == *release-candidate.mjs && "$2" == verify ]]; then
  printf 'CANDIDATE_VERIFY_REACHED=%s\\n' "$3"
 fi
 if [[ "$1" == *release-remote-collision.mjs ]]; then
  printf 'REMOTE_PREFLIGHT_REACHED\\n'
  return ${mode==='remote-preflight-rejected'?23:0}
 fi
 if [[ "$1" == *secure-nuget-push.mjs ]]; then
  printf 'UPLOAD_REACHED=%s\\n' "$*"
  ${mode==='candidate-drift-after-first-upload'?`printf changed >> ${quote(probe)}`:':'}
  return 0
 fi
 ${quote(process.execPath)} "$@"; local result=$?
 if [ "$result" -eq 0 ] && [ "\$2" = packages ]; then
  ${mode==='after-scan-byte-drift'?`printf changed > ${quote(f.files[0])}`:mode==='after-scan-added-package'?`cp ${quote(f.files[0])} ${quote(extra)}`:':'}
 fi
 return "$result"
}
${source.slice(begin,end)}
`});
  assert.ifError(run.error);
  if(mode==='success'){
   assert.equal(run.status,0,run.stderr);
   assert.equal(run.stdout.match(/CANDIDATE_VERIFY_REACHED=/g)?.length,7,'首包和每包上传前均需复核候选源码');
   assert.equal(run.stdout.match(/UPLOAD_REACHED=/g)?.length,6);
   assert.equal(run.stdout.match(/REMOTE_PREFLIGHT_REACHED/g)?.length,1);
  }else{
   assert.equal(run.status,17,run.stderr);
   assert.equal(run.stdout.match(/CANDIDATE_VERIFY_REACHED=/g)?.length??0,mode==='missing-platform-dependency'?0:mode==='candidate-drift-after-first-upload'?3:1);
   assert.equal(run.stdout.match(/UPLOAD_REACHED=/g)?.length??0,mode==='candidate-drift-after-first-upload'?1:0);
   assert.match(run.stderr,mode==='remote-preflight-rejected'?/远端 NuGet 同版本包不同或无法确认/:mode==='missing-platform-dependency'?/本次 NuGet 包正文的版本或平台依赖闭包不完整/:mode==='candidate-rejected'?/首个 NuGet 上传前候选源码发生变化/:mode==='candidate-drift-after-first-upload'?/当前 NuGet 上传前候选源码发生变化/:/首个上传前 NuGet 清单或包字节发生变化/);
  }
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
