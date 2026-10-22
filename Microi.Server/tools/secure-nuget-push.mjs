import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {inspectNugetPackage,RemoteCollisionError} from './release-remote-collision.mjs';

const DEFAULT_SOURCE='https://api.nuget.org/v3/index.json';
const UPLOAD_TIMEOUT_MS=10*60*1000;

class PublishError extends Error{
 constructor(code,status){super(code);this.name='PublishError';this.code=code;this.status=status;}
}

// 发布密钥只在本进程内从已忽略的私有配置读取，不放进 shell、子进程 argv 或日志。
export function parsePrivateConfig(raw){
 let config;
 try{config=JSON.parse(raw.replace(/^\uFEFF/,''));}catch{throw new PublishError('invalid-config');}
 const key=config?.ApiKey;
 if(typeof key!=='string'||!key||key==='your-nuget-api-key-here'||key.length>4096||/[\x00-\x1f\x7f]/.test(key)){
  throw new PublishError('missing-api-key');
 }
 const source=config.Source==null||config.Source===''?DEFAULT_SOURCE:config.Source;
 if(typeof source!=='string')throw new PublishError('invalid-source');
 return {apiKey:key,source};
}

function requireSafeHttpsUrl(value,code){
 let url;
 try{url=new URL(value);}catch{throw new PublishError(code);}
 // 禁止把密钥带到不安全协议、含凭据/查询的地址；任何重定向均不跟随。
 if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.search||url.hash)throw new PublishError(code);
 return url;
}

export async function resolvePublishEndpoint(source,fetchImpl=fetch){
 const indexUrl=requireSafeHttpsUrl(source,'unsupported-source');
 let response,indexRequest=indexUrl;
 // 服务索引不含密钥，允许有限个 HTTPS 跳转（国内网络会把 api.nuget.org 跳到镜像索引）。
 // 上传请求携带密钥，因此绝不跟随跳转，并额外固定官方发布端点。
 for(let redirects=0;redirects<=3;redirects+=1){
  try{
   response=await fetchImpl(indexRequest,{method:'GET',redirect:'manual',headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
  }catch{throw new PublishError('service-index-unreachable');}
  if(![301,302,303,307,308].includes(response.status))break;
  if(redirects===3)throw new PublishError('service-index-redirect-limit');
  const location=response.headers.get('location');
  if(!location)throw new PublishError('service-index-redirect-without-location');
  let redirectUrl;
  try{redirectUrl=new URL(location,indexRequest);}catch{throw new PublishError('unsafe-service-index-redirect');}
  indexRequest=requireSafeHttpsUrl(redirectUrl,'unsafe-service-index-redirect');
  await response.body?.cancel?.().catch(()=>{});
 }
 if(response.status!==200)throw new PublishError('service-index-http',response.status);
 let index;
 try{index=await response.json();}catch{throw new PublishError('invalid-service-index');}
 const resource=index?.resources?.find(item=>{
  const types=Array.isArray(item?.['@type'])?item['@type']:[item?.['@type']];
  return types.includes('PackagePublish/2.0.0');
 });
 if(typeof resource?.['@id']!=='string')throw new PublishError('publish-resource-missing');
 const endpoint=requireSafeHttpsUrl(resource['@id'],'unsafe-publish-resource');
 if(indexUrl.hostname==='api.nuget.org'&&
    !(endpoint.hostname==='www.nuget.org'&&endpoint.port===''&&endpoint.pathname==='/api/v2/package')){
  throw new PublishError('unexpected-official-publish-resource');
 }
 return endpoint;
}

export function multipartParts(packageFile,packageSize,boundary){
 if(!Number.isSafeInteger(packageSize)||packageSize<=0)throw new PublishError('invalid-package-size');
 if(!/^[a-f0-9]{32,64}$/.test(boundary))throw new PublishError('invalid-boundary');
 // PackagePublish/2.0.0 要求第一个 multipart 部分就是 nupkg 原始字节。
 const prefix=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="package"; filename="package.nupkg"\r\nContent-Type: application/octet-stream\r\n\r\n`);
 const suffix=Buffer.from(`\r\n--${boundary}--\r\n`);
 async function* chunks(){
  yield prefix;
  for await(const chunk of fs.createReadStream(packageFile))yield chunk;
  yield suffix;
 }
 return {body:Readable.from(chunks()),length:prefix.length+packageSize+suffix.length};
}

export async function pushPackage(packageFile,settings,{fetchImpl=fetch,boundary=randomBytes(24).toString('hex')}={}){
 let stat;
 try{stat=await fsp.stat(packageFile);}catch{throw new PublishError('package-unreadable');}
 if(!stat.isFile())throw new PublishError('package-not-file');
 // 完整集合门禁之后仍逐包回读；同版只能复用完全相同的远端原始字节。
 const prior=await inspectNugetPackage(packageFile,settings.source,{fetchImpl});
 if(prior.state==='same')return 'duplicate';
 const endpoint=await resolvePublishEndpoint(settings.source,fetchImpl);
 if(createHash('sha256').update(await fsp.readFile(packageFile)).digest('hex')!==prior.localSha256)throw new PublishError('package-changed-before-upload');
 const {body,length}=multipartParts(packageFile,stat.size,boundary);
 let response;
 try{
  response=await fetchImpl(endpoint,{
   method:'PUT',redirect:'manual',duplex:'half',signal:AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
   headers:{
    'X-NuGet-ApiKey':settings.apiKey,
    'X-NuGet-Protocol-Version':'4.1.0',
    'Content-Type':`multipart/form-data; boundary=${boundary}`,
    'Content-Length':String(length)
   },
   body
  });
 }catch{throw new PublishError('upload-failed');}
 await response.body?.cancel?.().catch(()=>{});
 if(response.status===201||response.status===202)return 'uploaded';
 if(response.status===409){
  // 服务端 409 只说明身份已占用；结果未知或正文不同都必须停止后续发布。
  const duplicate=await inspectNugetPackage(packageFile,settings.source,{fetchImpl,requirePresent:true});
  if(duplicate.localSha256!==prior.localSha256)throw new PublishError('package-changed-after-upload');
  return 'duplicate';
 }
 throw new PublishError('upload-http',response.status);
}

async function main(){
 const [mode,arg,configFile]=process.argv.slice(2);
 if(mode!=='probe'&&mode!=='push')throw new PublishError('usage');
 const privateConfig=mode==='probe'?arg:configFile;
 if(!privateConfig||(mode==='push'&&!arg))throw new PublishError('usage');
 let raw;
 try{raw=await fsp.readFile(privateConfig,'utf8');}catch{throw new PublishError('config-unreadable');}
 const settings=parsePrivateConfig(raw);
 requireSafeHttpsUrl(settings.source,'unsupported-source');
 if(mode==='probe'){
  process.stdout.write('NuGet private configuration ready\n');
  return;
 }
 const result=await pushPackage(arg,settings);
 process.stdout.write(`${path.basename(arg)}: ${result}\n`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{
  // HTTP 正文、异常原文和配置正文可能回显密钥，故只打印固定代码与数字状态。
  const code=error instanceof PublishError||error instanceof RemoteCollisionError?error.code:'unexpected-error';
  const status=error instanceof PublishError&&Number.isInteger(error.status)?` (HTTP ${error.status})`:'';
  process.stderr.write(`NuGet 安全推送失败：${code}${status}\n`);
  process.exitCode=1;
 });
}
