import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const projects=['Microi.net','Microi.AI','Microi.MCP','Microi.WorkFlow','Microi.Vision'];
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const describe=bytes=>({bytes:bytes.length,sha256:hash(bytes),md5:hash(bytes,'md5')});
const readDlls=directory=>Object.fromEntries(projects.map(project=>{
 const name=project+'.dll',bytes=fs.readFileSync(path.join(directory,name));
 assert.ok(bytes.length>0,`Empty required DLL: ${name}`);return [name,describe(bytes)];
}));
const save=(file,model)=>{fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});fs.writeFileSync(file,JSON.stringify(model,null,2)+'\n',{mode:0o600});};

export function capturePlain(directory,file){
 const model={plain:readDlls(directory),capturedAt:new Date().toISOString()};save(file,model);return model;
}
export function verifyEncrypted(directory,file){
 const model=JSON.parse(fs.readFileSync(file,'utf8')),encrypted=readDlls(directory);
 const signature=fs.readFileSync(path.join(directory,'.microi-encrypted'),'utf8');
 for(const name of projects.map(p=>p+'.dll')){
  const matches=signature.split(/\r?\n/).filter(line=>line.startsWith(name+'='));
  assert.equal(matches.length,1,`Missing or duplicate encryption fingerprint: ${name}`);
  assert.equal(matches[0].slice(name.length+1).toLowerCase(),encrypted[name].md5,`Encryption fingerprint differs: ${name}`);
  assert.notEqual(model.plain?.[name]?.sha256,undefined,`Missing original DLL evidence: ${name}`);
  assert.notEqual(model.plain[name].sha256,encrypted[name].sha256,`DLL encryption did not change bytes: ${name}`);
 }
 model.encrypted=encrypted;model.encryptedAt=new Date().toISOString();save(file,model);return model;
}
export function verifyFinal(directory,file){
 const model=JSON.parse(fs.readFileSync(file,'utf8'));assert.ok(model.encrypted,'Missing verified encryption receipt');
 assert.deepEqual(readDlls(directory),model.encrypted,'Final DLL bytes differ from encrypted receipt');
 verifyEncrypted(directory,file);return model;
}

// ZIP entry names are literal identities. unzip -p treats names as globs and
// -Z1 splits legitimate embedded newlines, so neither can certify DLL copies.
let pythonExecutable;
function findPython(){
 if(pythonExecutable!==undefined)return pythonExecutable;
 for(const executable of process.platform==='win32'?['python','python3']:['python3','python']){
  try{
   pythonExecutable=execFileSync(executable,['-c','import sys; assert sys.version_info >= (3, 8); print(sys.executable)'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
   if(pythonExecutable)return pythonExecutable;
  }catch{/* An absent interpreter or Windows Store alias is not a ZIP reader. */}
 }
 pythonExecutable=null;return null;
}
function inspectZip(file,dllNames){
 const python=findPython(),names=JSON.stringify(Object.fromEntries(dllNames));let output;
 if(python){
  const script=`import hashlib, json, sys, zipfile
names = json.loads(sys.argv[2])
records = []
with zipfile.ZipFile(sys.argv[1]) as archive:
 infos = archive.infolist()
 if len({info.orig_filename for info in infos}) != len(infos):
  raise ValueError('Duplicate ZIP entries')
 for info in infos:
  entry = info.orig_filename
  record = {'entry': entry}
  dll = names.get(entry.replace('\\\\', '/').rsplit('/', 1)[-1].lower())
  if dll:
   if info.file_size > 64 * 1024 * 1024:
    raise ValueError('Closed DLL ZIP entry exceeds inspection limit')
   data = archive.read(info)
   record.update(dll=dll, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), md5=hashlib.md5(data).hexdigest())
  records.append(record)
print(json.dumps(records, ensure_ascii=True))`;
  output=execFileSync(python,['-c',script,path.resolve(file),names],{maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
 }else{
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const script=`$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.IO.Compression.FileSystem;
$names=ConvertFrom-Json ${quote(names)}; $records=[Collections.Generic.List[Object]]::new(); $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);
$z=[IO.Compression.ZipFile]::OpenRead(${quote(path.resolve(file))}); try {
 foreach($e in $z.Entries){
  if(!$seen.Add($e.FullName)){throw 'Duplicate ZIP entries'}
  $record=@{entry=$e.FullName}; $basename=($e.FullName.Replace('\\','/').Split('/')[-1]).ToLowerInvariant(); $dll=$names.PSObject.Properties[$basename];
  if($null -ne $dll){
   if($e.Length -gt 67108864){throw 'Closed DLL ZIP entry exceeds inspection limit'}
   $s=$e.Open(); $m=[IO.MemoryStream]::new(); try{$s.CopyTo($m); $bytes=$m.ToArray()}finally{$s.Dispose(); $m.Dispose()}
   $sha=[Security.Cryptography.SHA256]::Create(); $md5=[Security.Cryptography.MD5]::Create(); try{
    $record.dll=$dll.Value; $record.bytes=$bytes.Length; $record.sha256=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant(); $record.md5=[BitConverter]::ToString($md5.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
   }finally{$sha.Dispose(); $md5.Dispose()}
  }
  $records.Add($record)
 }
 [Console]::Write((ConvertTo-Json -InputObject @($records.ToArray()) -Depth 5 -Compress))
}finally{$z.Dispose()}`;
  const encoded=Buffer.from(script,'utf16le').toString('base64');
  for(const executable of ['pwsh','powershell.exe']){
   try{output=execFileSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});break;}
   catch(error){if(error.code!=='ENOENT')throw error;}
  }
  assert.ok(output,'Exact ZIP inspection requires Python 3 or PowerShell; publication is blocked');
 }
 const records=JSON.parse(output.toString('utf8'));
 assert.ok(Array.isArray(records)&&records.every(record=>typeof record.entry==='string'),'Invalid exact ZIP inspection result');
 // A NuGet package requires archive entries. .NET Framework's old ZIP reader
 // can silently return none for an embedded-newline name; never omit that ZIP.
 assert.ok(records.length>0,'Exact ZIP reader returned no entries; NuGet publication is blocked');
 assert.equal(new Set(records.map(record=>record.entry)).size,records.length,'Duplicate ZIP entries');
 return records;
}
export function verifyPackages(directory,file,version,packages){
 const model=verifyFinal(directory,file),found=new Set(),results=[];
 const dllNames=new Map(Object.keys(model.encrypted).map(name=>[name.toLowerCase(),name]));
 for(const packageFile of packages){
  assert.ok(path.basename(packageFile).endsWith(`.${version}.nupkg`),'Package version differs');
  const before=describe(fs.readFileSync(packageFile));
  const entries=[];
  for(const record of inspectZip(packageFile,dllNames)){
   const {entry}=record,name=dllNames.get(path.posix.basename(entry.replaceAll('\\','/')).toLowerCase());
   if(!name)continue;
   const actual={bytes:record.bytes,sha256:record.sha256,md5:record.md5};assert.deepEqual(actual,model.encrypted[name],`Unencrypted or stale DLL in ${path.basename(packageFile)}: ${entry}`);
   found.add(name);entries.push({entry,dll:name,...actual});
  }
  const after=describe(fs.readFileSync(packageFile));
  assert.deepEqual(after,before,`NuGet package changed during ZIP inspection: ${packageFile}`);
  results.push({file:path.resolve(packageFile),bytes:after.bytes,sha256:after.sha256,entries});
 }
 for(const project of projects)assert.ok(found.has(project+'.dll'),`No actual encrypted NuGet entry: ${project}`);
 model.packages={version,verifiedAt:new Date().toISOString(),files:results};save(file,model);return model;
}

// Match the release script's original find expression, including nested projects
// and PackageId names which differ from a source directory. Never follow links.
export function enumeratePendingPackages(server,version){
 assert.match(version||'',/^\d+\.\d+\.\d+$/);
 const result=[];
 const visit=directory=>{
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
   const candidate=path.join(directory,entry.name),portable=candidate.replaceAll('\\','/');
   if(portable.includes('/bin/Release/')&&entry.name.endsWith(`.${version}.nupkg`)&&!entry.name.endsWith('.symbols.nupkg'))result.push(candidate);
   if(entry.isDirectory()&&!fs.lstatSync(candidate).isSymbolicLink())visit(candidate);
  }
 };
 visit(path.resolve(server));return normalizePendingPackages(result,server,version);
}
function normalizePendingPackages(files,server,version){
 const root=fs.realpathSync(server),seen=new Set();
 return files.map(filename=>{
  const candidate=path.resolve(filename),stat=fs.lstatSync(candidate);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink(),`Unknown or linked NuGet package: ${filename}`);
  const real=fs.realpathSync(candidate),relative=path.relative(root,real).replaceAll('\\','/');
  assert.ok(relative&&!relative.startsWith('../')&&!path.isAbsolute(relative),`NuGet package is outside the server root: ${filename}`);
  assert.ok(('/'+relative).includes('/bin/Release/')&&path.basename(real).endsWith(`.${version}.nupkg`)&&!real.endsWith('.symbols.nupkg'),`Unsupported pending NuGet package: ${filename}`);
  const key=process.platform==='win32'?real.toLowerCase():real;
  assert.ok(!seen.has(key),`Duplicate pending NuGet package: ${filename}`);seen.add(key);return real;
 }).sort();
}
export function readPendingPackageList(filename,server,version){
 const stat=fs.lstatSync(filename);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Pending NuGet list must be a regular owned file');
 const bytes=fs.readFileSync(filename);
 assert.ok(bytes.length&&bytes.at(-1)===0,'Pending NuGet list must contain NUL-terminated paths');
 const entries=bytes.subarray(0,-1).toString('utf8').split('\0');
 assert.ok(entries.every(Boolean),'Empty pending NuGet list item');
 return {files:normalizePendingPackages(entries,server,version),list:{file:path.resolve(filename),bytes:bytes.length,sha256:hash(bytes)}};
}
function assertCompleteInventory(files,server,version){
 assert.deepEqual(files,enumeratePendingPackages(server,version),'NuGet package inventory differs from the complete pending upload set');
}
export function verifyPendingPackages(directory,file,version,listFile){
 const server=path.resolve(directory,'../../../..'),pending=readPendingPackageList(listFile,server,version);
 assertCompleteInventory(pending.files,server,version);
 const model=verifyPackages(directory,file,version,pending.files);
 assertCompleteInventory(pending.files,server,version);
 assert.deepEqual(readPendingPackageList(listFile,server,version).list,pending.list,'Pending NuGet list changed during verification');
 model.packages.server=fs.realpathSync(server);model.packages.list=pending.list;save(file,model);return model;
}
function verifiedPending(directory,file,version){
 const model=verifyFinal(directory,file),pending=model.packages;
 assert.ok(pending&&pending.server&&pending.list,'Missing complete verified NuGet upload list');
 assert.equal(pending.version,version,'Verified NuGet release version differs');
 assert.deepEqual(readPendingPackageList(pending.list.file,pending.server,version).list,pending.list,'Verified pending NuGet list changed');
 return model;
}
function assertPackageBytes(expected){
 const actual=describe(fs.readFileSync(expected.file));
 assert.equal(actual.bytes,expected.bytes,`NuGet package bytes changed before upload: ${expected.file}`);
 assert.equal(actual.sha256,expected.sha256,`NuGet package hash changed before upload: ${expected.file}`);
}
export function verifyPendingPackageInventory(directory,file,version,freshListFile){
 const model=verifiedPending(directory,file,version),pending=model.packages;
 const fresh=readPendingPackageList(freshListFile,pending.server,version),files=pending.files.map(packageFile=>packageFile.file);
 assert.deepEqual(fresh.files,files,'NuGet package inventory changed before the first upload');
 assertCompleteInventory(files,pending.server,version);
 for(const packageFile of pending.files)assertPackageBytes(packageFile);
 return model;
}
export function verifyPendingPackageUpload(directory,file,version,packageFile){
 const model=verifiedPending(directory,file,version),pending=model.packages;
 const [canonical]=normalizePendingPackages([packageFile],pending.server,version);
 const expected=pending.files.find(item=>item.file===canonical);
 assert.ok(expected,`Unverified NuGet package cannot be uploaded: ${packageFile}`);
 assertPackageBytes(expected);return expected;
}
export function verifyImage(directory,file,image){
 const model=verifyFinal(directory,file),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'microi-encrypted-image-'));let container;
 try{
  const imageId=execFileSync('docker',['image','inspect',image,'--format','{{.Id}}'],{encoding:'utf8'}).trim();
  // Never start this container or expose ports; only inspect the exact immutable image.
  container=execFileSync('docker',['create','--network','none','--entrypoint','/bin/true',imageId],{encoding:'utf8'}).trim();
  assert.match(container,/^[a-f0-9]{64}$/);
  for(const name of Object.keys(model.encrypted)){
   const target=path.join(temporary,name);execFileSync('docker',['cp',`${container}:/app/${name}`,target],{stdio:['ignore','pipe','pipe']});
   assert.deepEqual(describe(fs.readFileSync(target)),model.encrypted[name],`Docker contains an unencrypted or stale DLL: ${name}`);
  }
  model.image={image,imageId,verifiedAt:new Date().toISOString(),dlls:model.encrypted};save(file,model);return model;
 }finally{
  if(container)execFileSync('docker',['rm',container],{stdio:['ignore','pipe','pipe']});
  fs.rmSync(temporary,{recursive:true,force:true});
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,directory,receipt,extra,pending]=process.argv.slice(2);
 assert.ok(directory&&receipt,'Usage: release-encryption.mjs plain|encrypted|final|packages|packages-cas|package-cas|image <publish-directory> <receipt> [version|image] [NUL-list|package]');
 if(mode==='plain')capturePlain(directory,receipt);
 else if(mode==='encrypted')verifyEncrypted(directory,receipt);
 else if(mode==='final')verifyFinal(directory,receipt);
 else if(mode==='image'){assert.ok(extra);verifyImage(directory,receipt,extra);}
 else if(mode==='packages'){
  assert.match(extra||'',/^\d+\.\d+\.\d+$/);assert.ok(pending,'Complete pending NuGet upload list is required');
  verifyPendingPackages(directory,receipt,extra,pending);
 }else if(mode==='packages-cas'){
  assert.ok(extra&&pending);verifyPendingPackageInventory(directory,receipt,extra,pending);
 }else if(mode==='package-cas'){
  assert.ok(extra&&pending);verifyPendingPackageUpload(directory,receipt,extra,pending);
 }else throw Error('Unknown encryption verification mode');
 console.log(`Encryption ${mode} evidence verified for all five closed DLLs.`);
}
