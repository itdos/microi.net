// 自建 MinIO 镜像发布前的真实 S3 协议验收；不使用匿名开放或跳过签名来模拟成功。
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {s3Request} from './panel-s3.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),image=process.env.PANEL_MINIO_IMAGE||'microi-panel-minio:2025-10-15-microi1';
const platform=process.env.PANEL_MINIO_PLATFORM||'linux/amd64',port=Number(process.env.PANEL_MINIO_PORT||62080);
const run='panel-minio-'+platform.split('/')[1]+'-'+Date.now(),work=resolve(root,'.tmp/panel-20260910',run),password=randomBytes(30).toString('base64url'),label='io.microi.panel.test';
function docker(args){try{return execFileSync('docker',args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:2*1024*1024}).trim();}catch(e){throw Error(String(e.stderr||e.message).replaceAll(password,'<redacted>'));}}
const s3=(method,path,body='')=>s3Request(port,password,method,path,body);
async function ready(){for(let i=0;i<90;i++){try{const response=await fetch(`http://127.0.0.1:${port}/minio/health/ready`,{signal:AbortSignal.timeout(5000)});await response.arrayBuffer();if(response.ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('MinIO did not become ready');}
await mkdir(work,{recursive:true});await writeFile(resolve(work,'minio.env'),`MINIO_ROOT_USER=paneltest\nMINIO_ROOT_PASSWORD=${password}\n`);
let created=false;
try{
 docker(['volume','create','--label',`${label}=${run}`,run+'-data']);
 docker(['run','-d','--name',run,'--label',`${label}=${run}`,'--platform',platform,'--memory','512m','--cpus','1','--cap-drop','ALL','--security-opt','no-new-privileges','--env-file',resolve(work,'minio.env'),'-p',`127.0.0.1:${port}:9000`,'-p',`127.0.0.1:${port+1}:9001`,'-v',run+'-data:/data',image]);created=true;console.log('STARTED '+run);await ready();
 console.log('READY '+run);await s3('PUT','/panel-acceptance');await s3('PUT','/panel-acceptance/probe.txt','persistent object');assert.equal(await s3('GET','/panel-acceptance/probe.txt'),'persistent object');console.log('S3 signed write/read passed');
 assert.equal((await fetch(`http://127.0.0.1:${port}/panel-acceptance/probe.txt`)).status,403);
 assert.equal((await fetch(`http://127.0.0.1:${port+1}/`)).status,200);
 docker(['restart',run]);await ready();assert.equal(await s3('GET','/panel-acceptance/probe.txt'),'persistent object');
 await s3('DELETE','/panel-acceptance/probe.txt');await s3('DELETE','/panel-acceptance');
 const actual=JSON.parse(docker(['inspect',run]))[0],version=docker(['exec',run,'minio','--version']);assert.match(version,/RELEASE.2025-10-15T17-29-55Z/);assert.equal(actual.Config.User,'10001:10001');
 assert.equal(docker(['exec',run,'sha256sum','/usr/share/microi/minio/minio-source.tar.gz']).split(' ')[0],'be6d0bd3696c3a13a35f02d3a0280b64319c67918b4501c5c3d87f96d000085c');
 await writeFile(resolve(work,'report.json'),JSON.stringify({run,image,platform,imageId:actual.Image,version,checks:['authenticated S3 create/read/delete','anonymous access rejected','console HTTP','restart persistence','non-root execution','bundled source SHA-256'],completed:true},null,2));console.log('PASS '+platform+' '+resolve(work,'report.json'));
}finally{if(created){const actual=JSON.parse(docker(['inspect',run]))[0];assert.equal(actual.Config.Labels[label],run);if(actual.State.Running)docker(['stop',run]);}}
