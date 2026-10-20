import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {snapshotReleaseComposition} from './release-composition.mjs';
import {snapshotStandardInputs} from './release-standard-inputs.mjs';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const repositories=['.','Microi.Server/Microi.net','Microi.Server/Microi.AI','Microi.Server/Microi.MCP','Microi.Agent','Microi.Client/src/views/webos','Microi.Server/Microi.WorkFlow','Microi.Server/Microi.Vision'];
// Build products and the synchronization receipt are not executable source candidates.
const generated=/(^|\/)(?:dist|bin|obj|node_modules|TestResults|\.resource-sync-base|\.git)(?:\/|$)|\.(?:vsix|nupkg|snupkg)$/i;
// 此门禁用于 PC/API Docker 发布，独立 UniApp 的页面、客户资源和包版本不进入这两个镜像。
// 但后端内容安全回归直接读取 UniApp SDK，因此仍保留整个 utils 目录作为跨端契约输入。
// 不能排除 Microi.Client、后端源码/测试、内置应用资源或闭源子仓来绕过真正的候选漂移。
const independentMobileSource=name=>/^microi\.uniapp\//i.test(name)
 &&!/^microi\.uniapp\/src\/utils\//i.test(name)
 &&name!=='microi.uniapp/scripts/test-request-queue.mjs';
// Microi Code desktop installer is released and verified on its own channel.
// Its app/upstream checkout does not enter the PC/API images or the VSIX/CLI;
// the shared plugin, MCP, Skills and server-engine sources remain guarded.
const independentDesktopSource=name=>/^Microi\.Agent\/(?:apps\/microi-code|upstream\/dsh-desktop)\//i.test(name);
// 官网源码、测试、依赖和正文均由独立官网发布验收，不进入 PC/API 镜像。
// 共享 SDK、Skills、MCP 与平台发布工具继续进入 PC/API Full 候选。
const documentationOnly=name=>/^microi\.doc\//i.test(name)
 // 定时商店巡检只追加内部交接日志；不进入 PC/API、VSIX 或 CLI 运行制品。
 // 仅此精确日志路径豁免；Skills、MCP、测试、发布脚本与运行知识仍受门禁保护。
 ||name==='Microi.Agent/维护交接与更新记录.md';

// 插件打包重复生成这两份已跟踪元数据。仅顶层 builtAt 是非行为时间；
// 版本、依赖、文件数量与源码摘要仍全部进入候选，未知字段和其它文件不得排除。
const timestampMetadata=new Set([
 'Microi.Agent/plugins/microi/assets/build-meta.json',
 'Microi.Agent/plugins/microi/scripts/microi-skills.meta.json',
]);
function candidateBytes(key,bytes){
 if(!timestampMetadata.has(key))return bytes;
 const metadata=JSON.parse(bytes.toString('utf8'));
 if(typeof metadata.builtAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(metadata.builtAt))throw Error(`Invalid known build timestamp: ${key}`);
 delete metadata.builtAt;
 return JSON.stringify(metadata);
}

// 一键脚本在最终加密冒烟时消费本地环境标记及其选中的配置；它们即使被
// Git 忽略也必须绑定 Full。回执只保存原始字节哈希，绝不序列化连接凭据。
async function snapshotLocalSmokeInputs(root){
 if(process.env.MICROI_RELEASE_SMOKE_CONFIG){
  const filename=path.resolve(process.env.MICROI_RELEASE_SMOKE_CONFIG),stat=await lstat(filename);
  if(stat.isSymbolicLink()||!stat.isFile())throw Error('Explicit smoke configuration must be a regular file');
  const bytes=await readFile(filename),config=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  const allowed=new Set(['OsClient','OsClientType','OsClientNetwork','OsClientDbType','OsClientDbConn','OsClientRedisHost','OsClientRedisPort','OsClientRedisPwd','OsClientRedisDataBase','OsClientDbMongoConn']);
  if(!config.AppSettings?.OsClient||Object.keys(config.AppSettings).some(key=>!allowed.has(key)))throw Error('Explicit smoke AppSettings must contain only approved bootstrap keys');
  return {'@smoke-config':createHash('sha256').update(bytes).digest('hex')};
 }
 const api='Microi.Server/Microi.net.Api',markerName=api+'/.microi-local';
 const files={[markerName]:null};
 let marker;
 try{marker=await lstat(path.join(root,markerName));}catch(error){if(error.code==='ENOENT')return files;throw error;}
 for(const directory of ['Microi.Server',api]){
  const stat=await lstat(path.join(root,directory));
  if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('Local smoke environment parent must be a real directory: '+directory);
 }
 if(marker.isSymbolicLink()||!marker.isFile())throw Error('Local smoke environment marker must be a regular file');
 const markerBytes=await readFile(path.join(root,markerName)),environment=markerBytes.toString('utf8').trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(environment)||environment==='.'||environment==='..')throw Error('Unsafe local environment name for smoke configuration');
 const configName=api+'/appsettings.'+environment+'.json';
 let configStat;
 try{configStat=await lstat(path.join(root,configName));}catch(error){if(error.code==='ENOENT')throw Error('Local smoke environment configuration is missing: '+configName);throw error;}
 if(configStat.isSymbolicLink()||!configStat.isFile())throw Error('Local smoke configuration must be a regular file');
 const configBytes=await readFile(path.join(root,configName));
 let config;try{config=JSON.parse(configBytes.toString('utf8').replace(/^\uFEFF/,''));}catch{throw Error('Local smoke environment configuration is invalid JSON');}
 const allowed=new Set(['OsClient','OsClientType','OsClientNetwork','OsClientDbType','OsClientDbConn','OsClientRedisHost','OsClientRedisPort','OsClientRedisPwd','OsClientRedisDataBase','OsClientDbMongoConn']);
 if(!config.AppSettings||typeof config.AppSettings!=='object'||Array.isArray(config.AppSettings)||typeof config.AppSettings.OsClient!=='string'||!config.AppSettings.OsClient.trim()||Object.keys(config.AppSettings).some(key=>!allowed.has(key)))throw Error('Local smoke AppSettings must contain an OsClient and only approved bootstrap keys');
 files[markerName]=createHash('sha256').update(markerBytes).digest('hex');
 files[configName]=createHash('sha256').update(configBytes).digest('hex');
 return files;
}

export async function snapshotCandidate(root=workspace,repos=repositories,options={}){
 const files={};
 for(const repository of repos){
  const cwd=path.resolve(root,repository);
  const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd,encoding:'utf8',maxBuffer:32*1024*1024}).split('\0').filter(Boolean);
  for(const name of [...new Set(names)].sort()){
   const key=path.posix.join(repository.replaceAll('\\','/'),name.replaceAll('\\','/'));
   const buildRecipe=/\/bin\/Release\/(?:Dockerfile|default\.conf)$/.test(key);
   if((generated.test(key)&&!buildRecipe)||independentMobileSource(key)||independentDesktopSource(key)||documentationOnly(key))continue;
   try{
    const sourcePath=path.resolve(cwd,name),stat=await lstat(sourcePath);
    // Git 会把目录联接作为未跟踪输入列出；先验证路径类型，避免读目录抢先抛错而跳过私有契约边界。
    if(stat.isSymbolicLink())throw Error(`Candidate source uses a symbolic link: ${key}`);
    if(!stat.isFile())throw Error(`Candidate source must be a regular file: ${key}`);
    files[key]=createHash('sha256').update(candidateBytes(key,await readFile(sourcePath))).digest('hex');
   }
   catch(error){if(error.code==='ENOENT')files[key]=null;else throw error;}
  }
 }
 Object.assign(files,await snapshotStandardInputs(root,{
  includeTestInputs:!['UserRequestedSkip','SmokeOnly'].includes(process.env.MICROI_RELEASE_TEST_POLICY)
 }));
 Object.assign(files,await snapshotLocalSmokeInputs(root));
 // Implicit composition belongs only to this actual workspace; explicit foreign contracts still fail.
 const compositionOptions={...options,environment:options.environment??(path.resolve(root)===workspace?process.env:{})};
 const privateInputs=await snapshotReleaseComposition(root,compositionOptions);
 if(privateInputs){
  for(const [key,value]of Object.entries(privateInputs.files)){
   if(Object.hasOwn(files,key)&&files[key]!==value)throw Error(`Private composition source collision: ${key}`);
   files[key]=value;
  }
 }
 return {scope:'pc-api-docker-with-mobile-sdk-contracts',files,...(privateInputs?{composition:privateInputs.composition}:{})};
}

export function changedCandidate(before,after){
 const changed=[...new Set([...Object.keys(before.files),...Object.keys(after.files)])].filter(name=>before.files[name]!==after.files[name]);
 if(JSON.stringify(before.composition??null)!==JSON.stringify(after.composition??null))changed.push('<private-build-composition>');
 return changed.sort();
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,manifest]=process.argv.slice(2);
 if(!['capture','verify'].includes(mode)||!manifest)throw new Error('Usage: release-candidate.mjs capture|verify <manifest>');
 const current=await snapshotCandidate();
 if(mode==='capture'){
  await mkdir(path.dirname(path.resolve(manifest)),{recursive:true});
  await writeFile(manifest,JSON.stringify({...current,capturedAt:new Date().toISOString()},null,2));
  console.log(`Recorded ${Object.keys(current.files).length} candidate source files across ${repositories.length} repositories.`);
 }else{
  const previous=JSON.parse(await readFile(manifest,'utf8'));
  const changed=changedCandidate(previous,current);
  if(changed.length)throw new Error(`Full 验收后候选源码发生变化，必须重新加载并验收；尚未允许继续发布：\n${changed.slice(0,40).join('\n')}`);
  console.log('Final candidate source is identical to the Full acceptance candidate.');
 }
}
