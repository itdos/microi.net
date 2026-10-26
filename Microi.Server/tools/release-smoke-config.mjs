import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {dockerConfigIdentity} from './release-encryption.mjs';
import {createReleaseScratch,cleanupReleaseScratch} from './release-scratch.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bootstrap=new Set(['OsClient','OsClientType','OsClientNetwork','OsClientDbType','OsClientDbConn','OsClientRedisHost','OsClientRedisPort','OsClientRedisPwd','OsClientRedisDataBase','OsClientDbMongoConn']);
const secretBootstrap=['OsClientDbConn','OsClientRedisHost','OsClientRedisPwd','OsClientDbMongoConn'];
const publicSections=new Set(['AppSettings','Logging','StaticWebAssets','AllowedHosts']);
function json(bytes){try{return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}catch{throw Error('Invalid smoke configuration JSON; contents withheld');}}
function unlinkedParents(file){for(let current=path.resolve(file);;current=path.dirname(current)){assert.ok(!fs.lstatSync(current).isSymbolicLink(),'Configuration path contains a link');if(path.dirname(current)===current)break;}}
function ordinary(file){unlinkedParents(file);const stat=fs.lstatSync(file);assert.ok(stat.isFile(),'Configuration input must be an ordinary file');return fs.readFileSync(file);}
function directory(folder){unlinkedParents(folder);assert.ok(fs.lstatSync(folder).isDirectory(),'Publish directory must be an ordinary directory');return fs.realpathSync(folder);}
function safeTemplate(bytes){
 const config=json(bytes);
 assert.ok(config&&typeof config==='object'&&!Array.isArray(config),'Invalid public configuration template');
 assert.ok(Object.keys(config).every(key=>publicSections.has(key)),'Public configuration contains an undeclared section');
 assert.ok(config.AppSettings&&typeof config.AppSettings==='object'&&!Array.isArray(config.AppSettings),'Public bootstrap settings missing');
 assert.ok(Object.keys(config.AppSettings).every(key=>bootstrap.has(key)||key==='//'),'Public bootstrap settings contain an undeclared key');
 for(const key of secretBootstrap)assert.ok(config.AppSettings[key]==null||config.AppSettings[key]==='','Public configuration contains a private connection value');
 return config;
}
export function assertPublishedConfigBytes(bytes,templateBytes){
 safeTemplate(templateBytes);safeTemplate(bytes);
 assert.ok(bytes.equals(templateBytes),'Published configuration differs from the frozen public template');
 return {bytes:bytes.length,sha256:hash(bytes)};
}
export function verifyPublishedConfig(folder,template){
 const publish=directory(folder),bytes=ordinary(path.join(publish,'appsettings.json')),expected=ordinary(template);
 const proof=assertPublishedConfigBytes(bytes,expected);
 for(const entry of fs.readdirSync(publish)){
  assert.ok(!/^appsettings\./i.test(entry)||entry==='appsettings.json','Publish contains an environment configuration or smoke backup');
  assert.ok(!['.microi-local','smoke-config.json'].includes(entry.toLowerCase()),'Publish contains local smoke recovery metadata');
 }
 return proof;
}
export function injectSmokeConfig(folder,template,source,stateFile){
 const publish=directory(folder);verifyPublishedConfig(publish,template);
 const state=path.join(directory(path.dirname(path.resolve(stateFile))),path.basename(stateFile)),relative=path.relative(publish,state);
 assert.ok(relative.startsWith('..'+path.sep)||path.isAbsolute(relative),'Smoke recovery state must be outside the Docker publish context');
 const original=ordinary(template),input=ordinary(source),local=json(input),settings=local?.AppSettings;
 assert.ok(settings&&typeof settings==='object'&&!Array.isArray(settings)&&typeof settings.OsClient==='string'&&settings.OsClient.trim(),'Smoke configuration requires its existing tenant');
 assert.ok(Object.keys(settings).every(key=>bootstrap.has(key)),'Smoke configuration contains an undeclared bootstrap key');
 // Only the ten infrastructure bootstrap keys may enter the temporary host.
 // Development login bypasses and other local-only sections are never copied.
 const injected=Buffer.from(JSON.stringify({...safeTemplate(original),AppSettings:settings},null,2)+'\n');
 const record={schema:1,publish,templateSha256:hash(original),templateBase64:original.toString('base64'),sourceSha256:hash(input),injectedSha256:hash(injected),restored:false};
 // Recovery is durable before touching appsettings. It contains only the public
 // template and hashes, never credentials or a copy of the private input.
 fs.writeFileSync(state,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
 fs.writeFileSync(path.join(publish,'appsettings.json'),injected,{mode:0o600});
 assert.equal(hash(ordinary(path.join(publish,'appsettings.json'))),record.injectedSha256,'Smoke configuration injection failed');
 return {sourceSha256:record.sourceSha256,injectedSha256:record.injectedSha256};
}
export function restoreSmokeConfig(folder,stateFile){
 const publish=directory(folder),record=json(ordinary(stateFile));
 assert.equal(record.schema,1,'Unknown smoke recovery schema');assert.equal(record.publish,publish,'Smoke recovery directory differs');
 const original=Buffer.from(record.templateBase64||'','base64');safeTemplate(original);
 assert.equal(hash(original),record.templateSha256,'Smoke recovery template is damaged');
 const target=path.join(publish,'appsettings.json');
 try{ordinary(target);}catch(error){if(error.code!=='ENOENT')throw error;}
 // publish belongs to this release lock. Always restore the saved public bytes,
 // including after an interrupted/partial injection; never alter the source.
 fs.writeFileSync(target,original);assert.equal(hash(ordinary(target)),record.templateSha256,'Smoke configuration restore failed');
 fs.writeFileSync(stateFile,JSON.stringify({...record,restored:true},null,2)+'\n',{mode:0o600});
 return {bytes:original.length,sha256:record.templateSha256};
}
export function verifyPublishedImage(image,template,run=execFileSync){
 const expected=ordinary(template);safeTemplate(expected);
 const workspace=fileURLToPath(new URL('../../',import.meta.url));
 const temporary=createReleaseScratch(process.env.MICROI_RELEASE_GATE_DIR||path.join(workspace,'.tmp','public-config-image'));let failure;
 try{
  const {imageId,configId}=dockerConfigIdentity(JSON.parse(run('docker',['image','inspect',image,'--format','{{json .}}'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()));
  const archive=path.join(temporary,'image.tar');
  // 仅读取不可变镜像层；复用已有摘要/whiteout/链接校验，禁止创建临时容器。
  run('docker',['image','save','--output',archive,imageId],{stdio:['ignore','pipe','pipe']});
  const python=process.platform==='win32'?'python':'python3';
  const inspected=JSON.parse(execFileSync(python,[fileURLToPath(new URL('./inspect-docker-image-dlls.py',import.meta.url)),archive,configId,'["appsettings.json"]','--configuration'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  assert.equal(inspected.imageId,configId,'Configuration archive is bound to another image');
  const actual=inspected.dlls['appsettings.json'];
  assert.ok(actual&&actual.bytes===expected.length&&actual.sha256===hash(expected),'Published image configuration differs from the frozen public template');
  return {imageId,configId,configuration:{bytes:actual.bytes,sha256:actual.sha256}};
 }catch(error){failure=error;throw error;
 }finally{
  try{cleanupReleaseScratch(temporary);}catch(error){if(!failure)throw error;console.error(`Image configuration cleanup failed: ${error.message}`);}
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [mode,folder,template,source,state]=process.argv.slice(2);
  if(mode==='verify')verifyPublishedConfig(folder,template);
  else if(mode==='image')console.log(JSON.stringify(verifyPublishedImage(folder,template)));
  else if(mode==='inject')injectSmokeConfig(folder,template,source,state);
  else if(mode==='restore')restoreSmokeConfig(folder,template);
  else throw Error('Unknown smoke configuration operation');
  console.log(`Smoke configuration ${mode}: verified`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
