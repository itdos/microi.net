// 发布前绑定两个平台的真实S3验收镜像；凭据仅经标准输入传递，不进入日志或报告。
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadImagePlan} from '../../../tools/dependency-images.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..'),version='2025-10-15-microi1';
const verifyOnly=process.argv.includes('--verify');
const [amdReport,armReport]=process.argv.slice(2).filter(x=>x!=='--verify');assert(amdReport&&armReport,'Supply the successful amd64 and arm64 report paths');
const directory=resolve(root,'.tmp/panel-20260910');
const source=resolve(directory,'minio-source/minio-source.tar.gz');const sourceHash=createHash('sha256').update(await readFile(source)).digest('hex');assert.equal(sourceHash,'be6d0bd3696c3a13a35f02d3a0280b64319c67918b4501c5c3d87f96d000085c');
const plan=await loadImagePlan(),secrets=[plan.config.Username,plan.config.Password].filter(Boolean),target=plan.registry+'/'+plan.namespace+'/minio:'+version;
const regctl=process.env.MICROI_RELEASE_REGCTL||'regctl';
async function run(binary,args,input=''){
 return new Promise((resolve,reject)=>{const child=spawn(binary,args,{cwd:root,windowsHide:true,env:process.env});let output='';const add=x=>{output+=x;if(output.length>16000)output=output.slice(-16000);};child.stdout.on('data',add);child.stderr.on('data',add);child.stdin.end(input);child.on('error',reject);child.on('close',code=>{for(const secret of secrets)output=output.replaceAll(secret,'<redacted>');code===0?resolve(output.trim()):reject(Error(output.slice(-2400)));});});
}
const reports=await Promise.all([amdReport,armReport].map(async path=>JSON.parse(await readFile(resolve(path),'utf8'))));
for(const [i,arch] of ['amd64','arm64'].entries()){
 const report=reports[i];assert.equal(report.completed,true);assert.equal(report.platform,'linux/'+arch);assert.equal(report.checks.length,6);
 const image=JSON.parse(await run('docker',['image','inspect',report.image]))[0];assert.equal(image.Id,report.imageId);assert.equal(image.Architecture,arch);
 assert.equal(image.Config.Labels['org.opencontainers.image.revision'],'9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a');
}
if(!verifyOnly)await run('docker',['login',plan.registry,'--username',plan.config.Username,'--password-stdin'],plan.config.Password);
const platforms=[];
for(const [i,arch] of ['amd64','arm64'].entries()){
 const tag=target+'-'+arch;
 if(!verifyOnly){await run('docker',['tag',reports[i].image,tag]);console.log('Push tested MinIO '+arch);await run('docker',['push','--platform','linux/'+arch,tag]);}
 const digest=await run(regctl,['manifest','head',tag]);assert.match(digest,/^sha256:[0-9a-f]{64}$/);platforms.push({architecture:arch,tag,digest,report:resolve([amdReport,armReport][i]),imageId:reports[i].imageId});
}
if(!verifyOnly)await run('docker',['buildx','imagetools','create','--tag',target,...platforms.map(x=>x.tag+'@'+x.digest)]);
const digest=await run(regctl,['manifest','head',target]);const index=JSON.parse(await run(regctl,['manifest','get',target,'--format','raw-body']));
assert.equal(index.manifests.length,2);for(const platform of platforms)assert(index.manifests.some(x=>x.digest===platform.digest&&x.platform.architecture===platform.architecture));
await mkdir(directory,{recursive:true});
await writeFile(resolve(directory,'minio-publish.json'),JSON.stringify({target,digest,platforms,sourceHash,publishedAt:new Date().toISOString(),upstreamArchived:true},null,2));
console.log('Verified '+target+'@'+digest);
