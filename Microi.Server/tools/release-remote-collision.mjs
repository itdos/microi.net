import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {packageMetadata,verifyNugetClosure} from './release-nuget-closure.mjs';
import {readPendingPackageList} from './release-encryption.mjs';

export class RemoteCollisionError extends Error {
 constructor(code){super(code);this.name='RemoteCollisionError';this.code=code;}
}
const fail=code=>{throw new RemoteCollisionError(code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=/^sha256:[a-f0-9]{64}$/;
function https(value){
 let url;try{url=new URL(value);}catch{fail('invalid-remote-url');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)fail('unsafe-remote-url');
 return url;
}
async function keylessGet(value,fetchImpl,timeout=30000){
 let url=https(value);
 for(let n=0;n<=3;n++){
  let response;try{response=await fetchImpl(url,{method:'GET',redirect:'manual',headers:{Accept:'application/octet-stream, application/json'},signal:AbortSignal.timeout(timeout)});}catch{fail('remote-read-unknown');}
  if(![301,302,303,307,308].includes(response.status))return response;
  const location=response.headers.get('location');await response.body?.cancel?.().catch(()=>{});
  if(!location||n===3)fail('remote-redirect-unknown');url=https(new URL(location,url));
 }
}
export async function nugetFlatBase(source,fetchImpl=fetch){
 const response=await keylessGet(source,fetchImpl);
 if(response.status!==200)fail('nuget-index-unknown');
 let index;try{const bytes=await response.arrayBuffer();if(bytes.byteLength>4*1024*1024)fail('nuget-index-too-large');index=JSON.parse(Buffer.from(bytes).toString());}catch{fail('nuget-index-invalid');}
 const resources=index?.resources?.filter(row=>(Array.isArray(row?.['@type'])?row['@type']:[row?.['@type']]).includes('PackageBaseAddress/3.0.0'));
 if(!resources?.length)fail('nuget-flat-container-missing');
 return https(resources[0]['@id']).href.replace(/\/?$/,'/');
}
function identityOf(file){
 const rows=packageMetadata([file]);if(rows.length!==1)fail('nuget-identity-invalid');
 const {id,version}=rows[0];
 if(!/^[A-Za-z0-9_.-]+$/.test(id||'')||!/^\d+\.\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.-]+)?$/.test(version||''))fail('nuget-identity-invalid');
 // 发行包已由正式闭包门禁校验；查询仍从实际 nuspec 身份构造，不能猜文件名。
 const normalized=version.replace(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/,(_,a,b,c,d)=>[a,b,c,...(d&&Number(d)!==0?[d]:[])].map(v=>String(Number(v))).join('.')).toLowerCase();
 return {id:id.toLowerCase(),version:normalized};
}
export async function inspectNugetPackage(file,source,{fetchImpl=fetch,flatBase,requirePresent=false}={}){
 const identity=identityOf(file),bytes=fs.readFileSync(file),localSha256=sha(bytes);
 const base=flatBase||await nugetFlatBase(source,fetchImpl);
 const response=await keylessGet(`${base}${identity.id}/${identity.version}/${identity.id}.${identity.version}.nupkg`,fetchImpl,120000);
 const proof={...identity,localSha256,bytes:bytes.length,checkedAt:new Date().toISOString()};
 if(response.status===404){await response.body?.cancel?.().catch(()=>{});if(requirePresent)fail('nuget-duplicate-unconfirmed');return {...proof,state:'absent'};}
 if(response.status!==200){await response.body?.cancel?.().catch(()=>{});fail('nuget-package-unknown');}
 if(!response.body)fail('nuget-package-empty');
 const hash=createHash('sha256');let count=0;
 try{for await(const chunk of response.body){count+=chunk.length;if(count>bytes.length)fail('nuget-package-collision');hash.update(chunk);}}catch(error){if(error instanceof RemoteCollisionError)throw error;fail('nuget-package-read-unknown');}
 const remoteSha256=hash.digest('hex');
 if(count!==bytes.length||remoteSha256!==localSha256)fail('nuget-package-collision');
 if(sha(fs.readFileSync(file))!==localSha256)fail('nuget-local-package-changed');
 return {...proof,state:'same',remoteSha256};
}
export async function inspectNugetSet(server,version,list,source,{fetchImpl=fetch}={}){
 const closure=verifyNugetClosure(server,version,list),pending=readPendingPackageList(list,server,version);
 const flatBase=await nugetFlatBase(source,fetchImpl),packages=[];
 // 完整集合全部读回通过后，调用方才允许上传首包；不把部分检查视为整轮成功。
 for(const file of pending.files)packages.push({file,...await inspectNugetPackage(file,source,{fetchImpl,flatBase})});
 const after=verifyNugetClosure(server,version,list);if(JSON.stringify(after)!==JSON.stringify(closure))fail('nuget-set-changed');
 for(const item of packages)if(sha(fs.readFileSync(item.file))!==item.localSha256)fail('nuget-local-package-changed');
 return {schema:'microi.release.nuget-remote-preflight.v1',version,checkedAt:new Date().toISOString(),packages,published:false};
}
function runDocker(args){
 const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});
 if(r.error)fail('docker-inspection-unknown');return r;
}
function imageIdentity(image,run){
 const r=run(['image','inspect',image,'--format','{"id":{{json .Id}},"repoDigests":{{json .RepoDigests}}}']);
 if(r.status!==0)fail('docker-local-image-unknown');let row;try{row=JSON.parse(r.stdout);}catch{fail('docker-local-image-invalid');}
 if(!digest.test(row.id)||!Array.isArray(row.repoDigests??[]))fail('docker-local-image-invalid');
 return {id:row.id,repoDigests:row.repoDigests??[]};
}
export function inspectDockerRemote(tag,{run=runDocker}={}){
 const r=run(['buildx','imagetools','inspect',tag,'--format','{{.Manifest.Digest}}']);
 if(r.status===0){const value=r.stdout.trim();if(!digest.test(value))fail('docker-remote-digest-invalid');return {state:'present',digest:value};}
 // Docker 的普通“not found”文本不能证明 HTTP 404；用 manifest 命令仅确认明确的不存在。
 const fallback=run(['manifest','inspect',tag]);
 if(fallback.status!==0&&/\b(?:manifest unknown|MANIFEST_UNKNOWN|no such manifest|404 Not Found)\b/i.test(fallback.stderr||''))return {state:'absent'};
 fail('docker-remote-state-unknown');
}
export function captureDockerPlan(image,prefix,templates,version,{run=runDocker}={}){
 if(!/^[A-Za-z0-9][A-Za-z0-9.:/_-]*$/.test(prefix)||!/^\d+\.\d+\.\d+(?:[-.][A-Za-z0-9.-]+)?$/.test(version))fail('docker-plan-invalid');
 const local=imageIdentity(image,run),tags=[];
 for(const template of templates.split(',')){
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*:(?:\{latest\}|\{version\})$/.test(template))fail('docker-tag-invalid');
  const fixed=template.endsWith(':{version}'),tag=`${prefix}/${template.replace('{latest}','latest').replace('{version}',`v${version}`)}`;
  const remote=inspectDockerRemote(tag,{run}),repository=tag.slice(0,tag.lastIndexOf(':'));
  if(fixed&&remote.state==='present'&&!local.repoDigests.includes(`${repository}@${remote.digest}`))fail('docker-version-collision');
  tags.push({tag,fixed,...remote});
 }
 if(!tags.length||new Set(tags.map(row=>row.tag)).size!==tags.length)fail('docker-tags-invalid');
 return {schema:'microi.release.docker-remote-plan.v1',image,localImageId:local.id,checkedAt:new Date().toISOString(),tags,atomicAcrossRegistry:false,published:false};
}
export function recheckDockerPlan(plan,tag,{run=runDocker}={}){
 if(plan?.schema!=='microi.release.docker-remote-plan.v1')fail('docker-plan-invalid');
 const expected=plan.tags?.find(row=>row.tag===tag);if(!expected)fail('docker-tag-not-planned');
 const local=imageIdentity(plan.image,run);if(local.id!==plan.localImageId)fail('docker-local-image-changed');
 const current=inspectDockerRemote(tag,{run});
 if(current.state!==expected.state||(current.digest??null)!==(expected.digest??null))fail('docker-remote-state-changed');
 if(expected.fixed&&current.state==='present'&&!local.repoDigests.includes(`${tag.slice(0,tag.lastIndexOf(':'))}@${current.digest}`))fail('docker-version-collision');
 return {tag,...current,checkedAt:new Date().toISOString(),atomicAcrossRegistry:false};
}
// push 返回成功只证明命令完成；每个实际标签必须独立读回，并与本次本地镜像的仓库摘要相同。
// 再读本地身份，拒绝回读过程中被其它构建覆盖的同名镜像；跨 Registry 仍不宣称原子发布。
export function confirmDockerPublication(plan,tag,{run=runDocker}={}){
 if(plan?.schema!=='microi.release.docker-remote-plan.v1'||!plan.tags?.some(row=>row.tag===tag))fail('docker-tag-not-planned');
 const before=imageIdentity(plan.image,run);if(before.id!==plan.localImageId)fail('docker-local-image-changed');
 const remote=inspectDockerRemote(tag,{run});if(remote.state!=='present')fail('docker-published-tag-missing');
 const repository=tag.slice(0,tag.lastIndexOf(':')),expected=`${repository}@${remote.digest}`;
 const after=imageIdentity(plan.image,run);
 if(after.id!==plan.localImageId)fail('docker-local-image-changed');
 if(!before.repoDigests.includes(expected)||!after.repoDigests.includes(expected))fail('docker-published-digest-mismatch');
 return {schema:'microi.release.docker-published-tag.v1',image:plan.image,localImageId:after.id,tag,digest:remote.digest,checkedAt:new Date().toISOString(),atomicAcrossRegistry:false,published:true};
}
export function writeDockerPublicationReceipt(planFile,tag,receipt,options={}){
 const proof=confirmDockerPublication(JSON.parse(fs.readFileSync(planFile,'utf8')),tag,options);
 // 不先建立“成功”占位文件；未知/不一致返回前完全不写，既有回执也不覆盖。
 fs.writeFileSync(receipt,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 return proof;
}
async function main(){
 const [mode,...args]=process.argv.slice(2);
 if(mode==='nuget-preflight'){
  const [server,version,list,config,receipt]=args;let settings;try{settings=JSON.parse(fs.readFileSync(config,'utf8').replace(/^\uFEFF/,''));}catch{fail('nuget-config-invalid');}
  const proof=await inspectNugetSet(server,version,list,settings.Source||'https://api.nuget.org/v3/index.json');fs.writeFileSync(receipt,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(`NuGet remote preflight verified ${proof.packages.length} packages; no uploads.`);return;
 }
 if(mode==='docker-baseline'){
  const [image,prefix,templates,version,receipt]=args;const proof=captureDockerPlan(image,prefix,templates,version);fs.writeFileSync(receipt,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log('Docker remote baseline verified; cross-registry updates are not atomic.');return;
 }
 if(mode==='docker-recheck'){const [receipt,tag]=args;recheckDockerPlan(JSON.parse(fs.readFileSync(receipt,'utf8')),tag);console.log('Docker remote state still matches its pre-push baseline.');return;}
 if(mode==='docker-confirm'){
  const [receipt,tag,publishedReceipt]=args;const proof=writeDockerPublicationReceipt(receipt,tag,publishedReceipt);
  console.log(`Docker published tag verified: ${proof.tag} @ ${proof.digest}`);return;
 }
 fail('remote-collision-usage');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(`Release remote guard failed: ${error instanceof RemoteCollisionError?error.code:'inspection-unknown'}`);process.exitCode=1;});
