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

// Read the actual ZIP bytes; a changed archive timestamp/checksum is insufficient proof.
function zipRead(file,entry){
 try{return execFileSync('unzip',entry?['-p',file,entry]:['-Z1',file],{maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});}
 catch(error){
  if(error.code!=='ENOENT')throw error;
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const script="Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead("+quote(path.resolve(file))+"); try { "+(entry?
   "$e=$z.GetEntry("+quote(entry)+"); if($null -eq $e){throw 'Missing ZIP entry'}; $s=$e.Open(); $o=[Console]::OpenStandardOutput(); $s.CopyTo($o); $s.Dispose()":
   "$z.Entries | ForEach-Object { [Console]::WriteLine($_.FullName) }")+" } finally { $z.Dispose() }";
  const encoded=Buffer.from(script,'utf16le').toString('base64');
  for(const executable of ['pwsh','powershell.exe']){
   try{return execFileSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});}
   catch(fallback){if(fallback.code!=='ENOENT')throw fallback;}
  }
  throw Error('ZIP inspection requires unzip or PowerShell; publication is blocked');
 }
}
export function verifyPackages(directory,file,version,packages){
 const model=verifyFinal(directory,file),found=new Set(),results=[];
 for(const packageFile of packages){
  assert.ok(path.basename(packageFile).endsWith(`.${version}.nupkg`),'Package version differs');
  const names=zipRead(packageFile).toString('utf8').split(/\r?\n/).filter(Boolean),entries=[];
  assert.equal(new Set(names).size,names.length,'Duplicate ZIP entries');
  for(const entry of names){
   const name=path.posix.basename(entry.replaceAll('\\','/'));
   if(!model.encrypted[name])continue;
   const actual=describe(zipRead(packageFile,entry));assert.deepEqual(actual,model.encrypted[name],`Unencrypted or stale DLL in ${path.basename(packageFile)}: ${entry}`);
   found.add(name);entries.push({entry,...actual});
  }
  results.push({file:path.resolve(packageFile),sha256:hash(fs.readFileSync(packageFile)),entries});
 }
 for(const project of projects)assert.ok(found.has(project+'.dll'),`No actual encrypted NuGet entry: ${project}`);
 model.packages={version,verifiedAt:new Date().toISOString(),files:results};save(file,model);return model;
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
 const [mode,directory,receipt,extra]=process.argv.slice(2);
 assert.ok(directory&&receipt,'Usage: release-encryption.mjs plain|encrypted|final|packages|image <publish-directory> <receipt> [version|image]');
 if(mode==='plain')capturePlain(directory,receipt);
 else if(mode==='encrypted')verifyEncrypted(directory,receipt);
 else if(mode==='final')verifyFinal(directory,receipt);
 else if(mode==='image'){assert.ok(extra);verifyImage(directory,receipt,extra);}
 else if(mode==='packages'){
  assert.match(extra||'',/^\d+\.\d+\.\d+$/);const server=path.resolve(directory,'../../../..');
  const packages=fs.readdirSync(server,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>path.join(server,e.name,'bin/Release',`${e.name}.${extra}.nupkg`)).filter(f=>fs.existsSync(f));
  verifyPackages(directory,receipt,extra,packages);
 }else throw Error('Unknown encryption verification mode');
 console.log(`Encryption ${mode} evidence verified for all five closed DLLs.`);
}
