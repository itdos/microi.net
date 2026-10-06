import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {projects,capturePlain,verifyEncrypted,verifyFinal,verifyPackages} from '../../tools/release-encryption.mjs';

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
function zip(file,entries){
 const local=[],central=[];let offset=0;
 const crc=bytes=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 for(const [entry,content]of entries){
  const name=Buffer.from(entry),bytes=Buffer.from(content),header=Buffer.alloc(30),index=Buffer.alloc(46),checksum=crc(bytes);
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt32LE(checksum,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);
  index.writeUInt32LE(0x02014b50,0);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);index.writeUInt32LE(checksum,16);index.writeUInt32LE(bytes.length,20);index.writeUInt32LE(bytes.length,24);index.writeUInt16LE(name.length,28);index.writeUInt32LE(offset,42);
  local.push(header,name,bytes);central.push(index,name);offset+=header.length+name.length+bytes.length;
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
