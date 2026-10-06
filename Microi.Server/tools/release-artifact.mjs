import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {snapshotCandidate,changedCandidate} from './release-candidate.mjs';
import {assertCompositionArtifacts} from './release-composition.mjs';

export async function artifactFiles(directory,type){
 const files={};
 async function walk(name){
  const file=path.join(directory,name),stat=await fs.lstat(file);
  if(stat.isSymbolicLink())throw Error(`Release context must not contain symbolic links: ${name}`);
  if(stat.isDirectory()){
   for(const child of (await fs.readdir(file)).sort())await walk(path.posix.join(name,child));
  }else files[name]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
 }
 for(const name of (type==='api'?['Dockerfile','publish']:['Dockerfile','default.conf','dist']))await walk(name);
 if(Object.keys(files).length<3)throw Error('Release context is empty or incomplete');
 return files;
}
export function verifyArtifact(receipt,candidate,files,type='api'){
 if(receipt.schema!==1||receipt.gate!=='Full'||!receipt.candidate?.files)throw Error('Missing Full acceptance provenance: rebuild with the release script');
 const changed=changedCandidate(receipt.candidate,candidate);
 if(changed.length)throw Error(`Prebuilt artifact is from different source: ${changed.slice(0,10).join(', ')}`);
 if(JSON.stringify(receipt.files)!==JSON.stringify(files))throw Error('Prebuilt artifact changed after acceptance: rebuild, do not re-sign stale files');
 if(type==='api')assertCompositionArtifacts(candidate,files);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,type,manifest,receiptFile]=process.argv.slice(2);
 if(!['capture','verify'].includes(mode)||!['api','client'].includes(type)||!manifest||!receiptFile)throw Error('Usage: release-artifact.mjs capture|verify api|client <tested-source-manifest> <receipt>');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const candidate=JSON.parse(await fs.readFile(manifest,'utf8'));
 const changed=changedCandidate(candidate,await snapshotCandidate());
 if(changed.length)throw Error(`Source changed after Full acceptance:\n${changed.slice(0,40).join('\n')}`);
 const directory=path.join(root,type==='api'?'Microi.Server/Microi.net.Api/bin/Release':'Microi.Client/bin/Release');
 const files=await artifactFiles(directory,type);
 // PC 镜像没有后端规则 DLL；API 发行才核对后台审批的私有原生制品。
 if(type==='api')assertCompositionArtifacts(candidate,files);
 if(mode==='capture'){
  await fs.mkdir(path.dirname(path.resolve(receiptFile)),{recursive:true});
  await fs.writeFile(receiptFile,JSON.stringify({schema:1,gate:'Full',capturedAt:new Date().toISOString(),candidate,files}));
 }else verifyArtifact(JSON.parse(await fs.readFile(receiptFile,'utf8')),candidate,files,type);
 console.log(`${type} artifact ${mode}: ${Object.keys(files).length} files bound to the Full-tested source`);
}
