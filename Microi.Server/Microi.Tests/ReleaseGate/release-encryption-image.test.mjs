import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import test from 'node:test';
import {projects,capturePlain,verifyEncrypted,verifyImage,dockerConfigIdentity} from '../../tools/release-encryption.mjs';

const helper=fileURLToPath(new URL('../../tools/inspect-docker-image-dlls.py',import.meta.url));
const python=execFileSync(process.platform==='win32'?'python':'python3',['-c','import sys; print(sys.executable)'],{encoding:'utf8'}).trim();
const names=projects.map(project=>project+'.dll');
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const encrypted=name=>Buffer.from('encrypted-'+name);
const dlls=()=>names.map(name=>({name:'app/'+name,bytes:encrypted(name)}));
// Real USTAR byte streams. The inspected archive is never expanded into the host filesystem.
function tar(entries){
 const parts=[];
 for(const {name,bytes=Buffer.alloc(0),type='0',link=''} of entries){
  const body=Buffer.from(bytes),header=Buffer.alloc(512);
  header.write(name,0,100);header.write('0000644\0',100,8);header.write('0000000\0',108,8);header.write('0000000\0',116,8);
  header.write(body.length.toString(8).padStart(11,'0')+'\0',124,12);header.write('00000000000\0',136,12);
  header.fill(32,148,156);header.write(type,156,1);header.write(link,157,100);header.write('ustar\0',257,6);header.write('00',263,2);
  const sum=header.reduce((total,byte)=>total+byte,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148,8);
  parts.push(header,body,Buffer.alloc((512-body.length%512)%512));
 }
 return Buffer.concat([...parts,Buffer.alloc(1024)]);
}
function fixture(layers=[dlls()],{compressed=false,tamperLayer=false,configIdMismatch=false,archiveExtra=[]}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-static-image-'));
 const layerBytes=layers.map(tar),config=Buffer.from(JSON.stringify({rootfs:{type:'layers',diff_ids:layerBytes.map(bytes=>'sha256:'+hash(bytes))}}));
 const imageId='sha256:'+hash(configIdMismatch?Buffer.from('different config'):config);
 const layerNames=layerBytes.map((_,index)=>`layers/${index}.tar`);
 const entries=[{name:'manifest.json',bytes:JSON.stringify([{Config:'config.json',Layers:layerNames}])},{name:'config.json',bytes:config}];
 layerBytes.forEach((bytes,index)=>entries.push({name:layerNames[index],bytes:tamperLayer&&index===0?tar(dlls().map(item=>({...item,bytes:'tampered'}))):compressed?gzipSync(bytes):bytes}));
 const archive=path.join(directory,'fixture.tar');fs.writeFileSync(archive,tar([...entries,...archiveExtra]));
 return {directory,archive,imageId,dispose(){fs.rmSync(directory,{recursive:true,force:false});}};
}
function inspect(f){
 const result=spawnSync(python,[helper,f.archive,f.imageId,JSON.stringify(names)],{encoding:'utf8'});
 return {...result,model:result.status===0?JSON.parse(result.stdout):undefined};
}
function successful(layers,options){
 const f=fixture(layers,options);try{
  const result=inspect(f);assert.equal(result.status,0,result.stderr);
  for(const name of names)assert.deepEqual(result.model.dlls[name],{bytes:encrypted(name).length,sha256:hash(encrypted(name)),md5:hash(encrypted(name),'md5')});
 }finally{f.dispose();}
}
function rejected(layers,pattern,options){
 const f=fixture(layers,options);try{const result=inspect(f);assert.notEqual(result.status,0);assert.match(result.stderr,pattern);}finally{f.dispose();}
}

test('static image reader applies a later layer over stale lower DLLs and validates gzip diff IDs',()=>{
 successful([dlls().map(item=>({...item,bytes:'stale'})),dlls()],{compressed:true});
});
test('file whiteout removes an inherited DLL',()=>{
 rejected([dlls(),[{name:'app/.wh.'+names[0]}]],/Missing final image DLLs/);
});
test('whiteout after a same-layer replacement never removes that replacement',()=>{
 successful([dlls(),[{name:'app/'+names[0],bytes:encrypted(names[0])},{name:'app/.wh.'+names[0]}]]);
});
test('opaque app directory removes lower DLLs even when new entries precede the marker',()=>{
 rejected([dlls(),[{name:'app/'+names[0],bytes:encrypted(names[0])},{name:'app/.wh..wh..opq'}]],/Missing final image DLLs/);
 successful([dlls().map(item=>({...item,bytes:'stale'})),[...dlls(),{name:'app/.wh..wh..opq'}]]);
});
test('ancestor and root opaque whiteouts remove inherited app DLLs',()=>{
 rejected([dlls(),[{name:'.wh.app'}]],/Missing final image DLLs/);
 rejected([dlls(),[{name:'.wh..wh..opq'}]],/Missing final image DLLs/);
});
for(const type of ['1','2'])test(`relevant ${type==='1'?'hardlink':'symlink'} DLL or ancestor is rejected`,()=>{
 for(const name of ['app','app/'+names[0]])rejected([dlls(),[{name,type,link:'elsewhere'}]],/Linked image DLL or ancestor/);
});
test('unsafe archive traversal cannot impersonate an app DLL',()=>{
 rejected([[...dlls(),{name:'../app/'+names[0],bytes:'evil'}]],/Unsafe image archive path/);
});
test('a linked outer layer entry is rejected without dereference',()=>{
 const f=fixture();try{
  const config=Buffer.from(JSON.stringify({rootfs:{type:'layers',diff_ids:['sha256:'+'0'.repeat(64)]}}));
  f.imageId='sha256:'+hash(config);
  fs.writeFileSync(f.archive,tar([{name:'manifest.json',bytes:JSON.stringify([{Config:'config.json',Layers:['layer.tar']}])},{name:'config.json',bytes:config},{name:'layer.tar',type:'2',link:'outside'}]));
  const result=inspect(f);assert.notEqual(result.status,0);assert.match(result.stderr,/Missing or linked image archive entry/);
 }finally{f.dispose();}
});
test('config ID and layer diff IDs both bind inspected bytes to the immutable image',()=>{
 rejected([dlls()],/config digest differs/,{configIdMismatch:true});
 rejected([dlls()],/layer digest differs/,{tamperLayer:true});
});
test('duplicate outer entries and same-layer DLL entries fail closed',()=>{
 rejected([dlls()],/Duplicate image archive entry/,{archiveExtra:[{name:'config.json',bytes:'{}'}]});
 rejected([[...dlls(),dlls()[0]]],/Duplicate DLL in image layer/);
});
test('missing, empty and nonregular final DLLs fail closed',()=>{
 rejected([dlls().slice(1)],/Missing final image DLLs/);
 rejected([dlls().map((entry,index)=>index?entry:{...entry,bytes:''})],/Invalid image DLL size/);
 rejected([dlls(),[{name:'app/'+names[0],type:'5'}]],/not a regular file/);
});

function receipt(f){
 const directory=path.join(f.directory,'publish'),file=path.join(f.directory,'receipt.json');fs.mkdirSync(directory);
 for(const name of names)fs.writeFileSync(path.join(directory,name),'plain-'+name);
 capturePlain(directory,file);
 for(const name of names)fs.writeFileSync(path.join(directory,name),encrypted(name));
 fs.writeFileSync(path.join(directory,'.microi-encrypted'),names.map(name=>name+'='+hash(encrypted(name),'md5')).join('\n'));
 verifyEncrypted(directory,file);return {directory,file};
}
function mockDocker(f,{failSave=false,containerd=false}={}){
 const calls=[];
 const imageId=containerd?'sha256:'+hash(Buffer.from('immutable image manifest')):f.imageId;
 return {calls,runDocker(args){
  calls.push(args);
  if(args[0]==='image'&&args[1]==='inspect')return JSON.stringify({Id:imageId,...(containerd?{Descriptor:{digest:imageId,mediaType:'application/vnd.oci.image.manifest.v1+json',annotations:{'config.digest':f.imageId}}}:{})})+'\n';
  assert.deepEqual(args.slice(0,3),['image','save','--output']);assert.equal(args.at(-1),imageId);
  if(failSave)throw Object.assign(new Error('docker image save failed'),{status:47});
  fs.copyFileSync(f.archive,args[3]);return Buffer.alloc(0);
 }};
}
function assertCleaned(f){
 const entries=fs.readdirSync(f.directory),receipts=entries.filter(name=>name.endsWith('.cleanup.json'));
 assert.equal(receipts.length,1);assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,receipts[0]),'utf8')).cleaned,true);
 assert.ok(!entries.some(name=>name.endsWith('.owner.json')||fs.statSync(path.join(f.directory,name)).isDirectory()&&name.startsWith('release-scratch-')));
}
test('verifyImage invokes only image inspect/save, reads immutable image, cleans owned scratch and records success',()=>{
 const f=fixture();try{
  const r=receipt(f),docker=mockDocker(f),result=verifyImage(r.directory,r.file,'example/api:release',docker);
  assert.equal(result.image.imageId,f.imageId);assert.equal(docker.calls.length,2);
  assert.deepEqual(docker.calls[0],['image','inspect','example/api:release','--format','{{json .}}']);
  assertCleaned(f);assert.equal(JSON.parse(fs.readFileSync(r.file,'utf8')).image.imageId,f.imageId);
 }finally{f.dispose();}
});
test('verifyImage rejects stale final Docker DLLs, keeps no image success receipt and cleans scratch',()=>{
 const f=fixture([dlls().map(item=>({...item,bytes:'stale'}))]);try{
  const r=receipt(f),docker=mockDocker(f);assert.throws(()=>verifyImage(r.directory,r.file,'example/api:release',docker),/unencrypted or stale DLL/);
  assert.equal(JSON.parse(fs.readFileSync(r.file,'utf8')).image,undefined);assert.equal(docker.calls.length,2);assertCleaned(f);
 }finally{f.dispose();}
});
test('docker save failure retains its exit status, cannot write success and still cleans scratch',()=>{
 const f=fixture();try{
  const r=receipt(f),docker=mockDocker(f,{failSave:true});assert.throws(()=>verifyImage(r.directory,r.file,'example/api:release',docker),error=>error.status===47);
  assert.equal(JSON.parse(fs.readFileSync(r.file,'utf8')).image,undefined);assertCleaned(f);
 }finally{f.dispose();}
});

test('containerd manifest ID saves the immutable image while config digest binds actual archive bytes',()=>{
 const f=fixture();try{
  const r=receipt(f),docker=mockDocker(f,{containerd:true}),result=verifyImage(r.directory,r.file,'example/api:release',docker);
  assert.notEqual(result.image.imageId,f.imageId);assert.equal(result.image.configId,f.imageId);
  assert.deepEqual(result.image.dlls,JSON.parse(fs.readFileSync(r.file,'utf8')).encrypted);assertCleaned(f);
 }finally{f.dispose();}
});

test('containerd identity rejects wrong descriptor, missing config and an index instead of one image',()=>{
 const imageId='sha256:'+'a'.repeat(64),configId='sha256:'+'b'.repeat(64);
 const valid=()=>({Id:imageId,Descriptor:{digest:imageId,mediaType:'application/vnd.oci.image.manifest.v1+json',annotations:{'config.digest':configId}}});
 assert.deepEqual(dockerConfigIdentity(valid()),{imageId,configId});
 assert.deepEqual(dockerConfigIdentity({Id:configId}),{imageId:configId,configId});
 const wrong=valid();wrong.Descriptor.digest=configId;assert.throws(()=>dockerConfigIdentity(wrong),/descriptor differs/);
 const missing=valid();delete missing.Descriptor.annotations;assert.throws(()=>dockerConfigIdentity(missing),/authoritative config digest/);
 const index=valid();index.Descriptor.mediaType='application/vnd.oci.image.index.v1+json';assert.throws(()=>dockerConfigIdentity(index),/single manifest/);
 const malformed=valid();malformed.Descriptor.annotations['config.digest']='latest';assert.throws(()=>dockerConfigIdentity(malformed),/authoritative config digest/);
});
