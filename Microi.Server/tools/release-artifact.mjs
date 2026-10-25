import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {snapshotCandidate,changedCandidate} from './release-candidate.mjs';
import {assertCompositionArtifacts} from './release-composition.mjs';
import {verifyPlatformReleaseEvidence} from '../Microi.Tests/ReleaseGate/release-test-matrix.mjs';
import {verifyPublishedConfig} from './release-smoke-config.mjs';

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
export function verifyArtifact(receipt,candidate,files,type='api',policy='Full'){
 if(!['Full','PlatformRelease'].includes(policy)||receipt.schema!==1||receipt.gate!==policy||!receipt.candidate?.files)throw Error('Release Full/PlatformRelease acceptance policy/provenance mismatch: rebuild with the release script');
 if(policy==='PlatformRelease'&&(receipt.testEvidence?.scope!==policy||!path.isAbsolute(receipt.testEvidence?.file||'')||!/^[a-f0-9]{64}$/.test(receipt.testEvidence?.sha256||'')))throw Error('PlatformRelease original test evidence is missing');
 const changed=changedCandidate(receipt.candidate,candidate);
 if(changed.length)throw Error(`Prebuilt artifact is from different source: ${changed.slice(0,10).join(', ')}`);
 if(JSON.stringify(receipt.files)!==JSON.stringify(files))throw Error('Prebuilt artifact changed after acceptance: rebuild, do not re-sign stale files');
 if(type==='api')assertCompositionArtifacts(candidate,files);
}
export function verifySmokeReceipt(smoke, files){
 if(smoke?.passed!==true||smoke?.schema!==1||!smoke.files
   ||!['/api/Diagnostics/liveness','/apiengine/platform-sys-config'].every(p=>smoke.checks?.some(c=>c.path===p&&c.httpStatus===200&&c.code===1)))
   throw Error('Runtime smoke receipt is missing or failed');
 for(const name of ['Microi.net.Api.dll','Microi.net.dll','Microi.Core.dll','Microi.AI.dll','Microi.MCP.dll','Microi.WorkFlow.dll','Microi.Vision.dll'])
   if(!smoke.files[name]||smoke.files[name]!==files['publish/'+name])throw Error('Runtime smoke assembly changed: '+name);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,type,manifest,receiptFile]=process.argv.slice(2);
 const policy=process.env.MICROI_RELEASE_TEST_POLICY||'Full';
 if(!['Full','PlatformRelease'].includes(policy))throw Error('Release artifacts require the Full or PlatformRelease test policy');
 if(!['capture','verify'].includes(mode)||!['api','client'].includes(type)||!manifest||!receiptFile)throw Error('Usage: release-artifact.mjs capture|verify api|client <tested-source-manifest> <receipt>');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const candidate=JSON.parse(await fs.readFile(manifest,'utf8'));
 // 新范围必须携带可独立重读的原始 TRX/Node 证据；单独设置环境变量不能授权发布。
 const testEvidence=policy==='PlatformRelease'?await verifyPlatformReleaseEvidence(process.env.MICROI_RELEASE_TEST_RECEIPT,manifest):null;
 const changed=changedCandidate(candidate,await snapshotCandidate(undefined,undefined,{testPolicy:policy}));
 if(changed.length)throw Error(`Source changed after Full acceptance:\n${changed.slice(0,40).join('\n')}`);
 const directory=path.join(root,type==='api'?'Microi.Server/Microi.net.Api/bin/Release':'Microi.Client/bin/Release');
 // Capturing a hash of leaked credentials would still bind a bad artifact.
 // Both fresh captures and reused/pre-push artifacts must match the public template.
 if(type==='api')verifyPublishedConfig(path.join(directory,'publish'),path.join(root,'Microi.Server/Microi.net.Api/appsettings.json'));
 const files=await artifactFiles(directory,type);
 // PC 镜像没有后端规则 DLL；API 发行才核对后台审批的私有原生制品。
 if(type==='api')assertCompositionArtifacts(candidate,files);
 if(mode==='capture'){
  const smoke=type==='api'?JSON.parse(await fs.readFile(path.join(path.dirname(receiptFile),'api-smoke.json'),'utf8')):null;
  if(type==='api')verifySmokeReceipt(smoke,files);
  await fs.mkdir(path.dirname(path.resolve(receiptFile)),{recursive:true});
  await fs.writeFile(receiptFile,JSON.stringify({schema:1,gate:policy,testsExecuted:true,...(testEvidence?{testEvidence}:{}),smoke,capturedAt:new Date().toISOString(),candidate,files}));
 }else {
  const receipt=JSON.parse(await fs.readFile(receiptFile,'utf8'));
  verifyArtifact(receipt,candidate,files,type,policy);
  if(testEvidence&&JSON.stringify(receipt.testEvidence)!==JSON.stringify(testEvidence))throw Error('PlatformRelease test evidence changed after artifact capture');
 }
 console.log(`${type} artifact ${mode}: ${Object.keys(files).length} files bound to candidate; test policy=${policy}`);
}
