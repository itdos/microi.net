import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const properties=['CustomAfterMicrosoftCommonTargets','PrivateRulesProject','ApprovedRulesBootstrapSource','MicroiCoreProject'];
const generatedDirectories=new Set(['.git','bin','obj','node_modules','dist','TestResults','.resource-sync-base']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function inside(root,value){
 if(typeof value!=='string'||!value||/[\r\n\0]/.test(value))throw Error('Invalid private composition path');
 const full=path.resolve(root,value),relative=path.relative(root,full);
 if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Private composition path escapes the release workspace');
 return {full,key:relative.replaceAll('\\','/')};
}
async function regularPath(root,value,kind){
 const entry=inside(root,value);
 // 显式组合可以读取根仓忽略的私有源码，但不能通过链接读取工作区外的文件。
 let parent=path.resolve(root);
 for(const part of path.relative(root,entry.full).split(path.sep)){
  parent=path.join(parent,part);const stat=await fs.lstat(parent);
  if(stat.isSymbolicLink())throw Error(`Private composition must not use symbolic links: ${entry.key}`);
 }
 const stat=await fs.lstat(entry.full);
 if(kind==='file'?!stat.isFile():!stat.isDirectory())throw Error(`Invalid private composition ${kind}: ${entry.key}`);
 return entry;
}

/** 后台构建专用契约。不是生产配置，也不接受 V8/MCP/HTTP 的代码加载参数。 */
export async function snapshotReleaseComposition(root,options={}){
 const environment=options.environment??process.env;
 const manifest=options.compositionManifest??environment.MICROI_RELEASE_COMPOSITION_FILE;
 if(!manifest){
  if(properties.some(key=>environment[key]))throw Error('Private MSBuild properties require MICROI_RELEASE_COMPOSITION_FILE provenance');
  return null;
 }
 const manifestEntry=await regularPath(root,manifest,'file'),manifestBytes=await fs.readFile(manifestEntry.full);
 const contract=JSON.parse(manifestBytes.toString('utf8').replace(/^\uFEFF/,''));
 if(contract.schema!==1||Object.keys(contract).sort().join(',')!=='artifacts,directories,files,properties,schema')throw Error('Invalid private composition schema');
 if(!contract.properties||Object.keys(contract.properties).sort().join(',')!==[...properties].sort().join(','))throw Error('Private composition requires the four fixed build properties');
 if(!Array.isArray(contract.files)||!contract.files.length||!Array.isArray(contract.directories)||!Array.isArray(contract.artifacts)||!contract.artifacts.length)throw Error('Private composition sources or artifacts missing');
 const files={[manifestEntry.key]:hash(manifestBytes)},normalizedProperties={};
 for(const value of contract.files){const entry=await regularPath(root,value,'file');files[entry.key]=hash(await fs.readFile(entry.full));}
 for(const value of contract.directories){
  const entry=await regularPath(root,value,'directory');
  async function walk(directory){
   for(const child of (await fs.readdir(directory)).sort()){
    const full=path.join(directory,child),stat=await fs.lstat(full);
    if(stat.isSymbolicLink())throw Error('Private source tree contains a symbolic link');
    if(stat.isDirectory()){if(!generatedDirectories.has(child))await walk(full);}
    else if(stat.isFile()){const key=inside(root,full).key;files[key]=hash(await fs.readFile(full));}
    else throw Error('Private source tree contains a non-file entry');
    if(Object.keys(files).length>16384)throw Error('Private composition source limit exceeded');
   }
  }
  await walk(entry.full);
 }
 for(const key of properties){
  const entry=await regularPath(root,contract.properties[key],'file');
  if(!Object.hasOwn(files,entry.key))throw Error(`Private build property is absent from frozen sources: ${key}`);
  if(typeof environment[key]!=='string'||path.resolve(root,environment[key])!==entry.full)throw Error(`Actual MSBuild property differs from the private composition: ${key}`);
  normalizedProperties[key]=entry.key;
 }
 const seenArtifacts=new Set(),artifacts=contract.artifacts.map(row=>{
  // 私有审批中的实际 DLL hash 必须与最终 publish 内容一致；不能重新签名另一份构建结果。
  if(!row||Object.keys(row).sort().join(',')!=='path,sha256'||typeof row.path!=='string'||!/^publish\/[A-Za-z0-9_.-]+\.dll$/.test(row.path)||!/^([a-f0-9]{64})$/.test(row.sha256))throw Error('Invalid private approved artifact');
  if(seenArtifacts.has(row.path.toLowerCase()))throw Error('Duplicate private approved artifact');seenArtifacts.add(row.path.toLowerCase());
  return {...row};
 }).sort((a,b)=>a.path.localeCompare(b.path));
 return {files,composition:{schema:1,manifest:manifestEntry.key,properties:normalizedProperties,artifacts}};
}

export function assertCompositionArtifacts(candidate,files){
 for(const row of candidate.composition?.artifacts??[]){
  if(files[row.path]!==row.sha256)throw Error(`Private approved artifact is missing or changed: ${row.path}`);
 }
}
