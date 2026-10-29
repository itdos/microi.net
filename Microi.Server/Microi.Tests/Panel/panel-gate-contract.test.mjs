import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyPanelGate,verifyHostNginxEvidence,verifyLinuxInstallEvidence,verifySecurityEvidence,requiredSecurityChecks,securityPhases,securityGuardFiles,requiredPluginChecks,legacyScripts,compareGeneratedEndpoints,sha256} from './panel-gate-contract.mjs';
const current={sourceHash:'a'.repeat(64),imageId:'sha256:'+'b'.repeat(64),hostNginxBindings:{hostAdapterSha256:'c'.repeat(64),hostRunnerSha256:'d'.repeat(64),externalRunnerSha256:'e'.repeat(64)},catalog:[{id:'nginx',versions:[{id:'1'},{id:'2'}]}]};
current.securityBindings={guardHashes:Object.fromEntries(['collectors.py','daemon.py','firewall.py','nginx_adapter.py','redis_proxy.py','store.py'].map(name=>[name,'7'.repeat(64)])),runnerSha256:'8'.repeat(64)};
function securityEvidence(){
 const images=Object.fromEntries(['tools','redis','mongodb','mysql'].map((name,index)=>[name,'sha256:'+String(index+1).repeat(64)]));
 const inputs={imageId:current.imageId,sourceHash:current.sourceHash,...current.securityBindings,images};
 const report={completed:true,scope:'isolated Linux namespaces; not a customer deployment',candidate:{imageId:current.imageId,sourceHash:current.sourceHash},
  runnerSha256:inputs.runnerSha256,sourceHashes:inputs.guardHashes,images,selectedPhases:[...securityPhases],startedAt:1000,finishedAt:1100,candidateChangedDuringRun:false,
  checks:[{phase:'setup',name:'defaults-enabled-3-86400-cumulative',passed:true},...securityPhases.flatMap(phase=>requiredSecurityChecks[phase].map(name=>({phase,name:name==='manual-unban:'?name+'172.28.10.10':name,passed:true})))],
  phases:Object.fromEntries(securityPhases.map((name,i)=>[name,{completed:true,startedAt:1001+i*10,finishedAt:1005+i*10,checks:requiredSecurityChecks[name].length,policy:{enabled:true,maxFailures:3,banSeconds:86400,windowSeconds:0}}])),
  runtimeSnapshots:securityPhases.flatMap((name,i)=>['before','after'].map((suffix,j)=>({phase:name+':'+suffix,observedAt:1002+i*10+j,containerId:'9'.repeat(64),imageId:images.tools,sourceHashes:inputs.guardHashes,runnerSha256:inputs.runnerSha256}))),
  cleanup:{passed:true,remainingContainers:[],remainingNetworks:[],remainingVolumes:[],errors:[]}};
 for(const check of report.checks)if(check.name.endsWith(':third-failure-kernel-ban'))check.detail={banSeconds:86400,createdAt:1000,expiresAt:87400};
 return {file:'security/report.json',inputsFile:'security/inputs.json',inputs,report};
}
const hostBinding={sourceHash:current.sourceHash,imageId:current.imageId,...current.hostNginxBindings};
function hostEvidence(order='panel-baota-onepanel'){
 const runId='panel-lab-'+order,before='11111111-1111-1111-1111-111111111111',after='22222222-2222-2222-2222-222222222222';
 const externalAcmeReceipt={completed:true,runId,candidateImageId:current.imageId,sourceHash:current.sourceHash,hostAdapterSha256:hostBinding.hostAdapterSha256,runnerSha256:hostBinding.externalRunnerSha256,hostRunnerSha256:hostBinding.hostRunnerSha256,
  sites:['1Panel','BaoTa'].map((provider,index)=>({provider,instanceId:'actual-'+provider,siteId:String(index+1).repeat(32),completed:true,afterHostReboot:true,
   hostDeploymentRollback:{completed:true,scope:'Real host certificate transaction, not an ExternalAcmeIssue operation',status:503,requestId:'12345678-1234-1234-1234-123456789abc',configurationSha256:'9'.repeat(64),
    before:{status:200,bodySha256:'a'.repeat(64),certificateSha256:'b'.repeat(64),certificateSha1:'B'.repeat(40),lifetimeSeconds:599},
    after:{status:200,bodySha256:'a'.repeat(64),certificateSha256:'b'.repeat(64),certificateSha1:'B'.repeat(40),lifetimeSeconds:595},
    handshakeFailures:[{reason:'SSLV3_ALERT_HANDSHAKE_FAILURE',observedAt:1160}],observedAt:1165},
   issueOperationId:'3'.repeat(32),renewOperationId:'4'.repeat(32),firstCertificateSha256:'5'.repeat(64),renewedCertificateSha256:'6'.repeat(64),
   scheduledRenewal:{operationId:'8'.repeat(32),actor:'scheduler',action:'ExternalAcmeRenew',certificateSha256:'8'.repeat(64),operationUpdatedAt:1250,observedAt:1251},
   automaticRenewal:{enabled:true,actor:'scheduler',action:'ExternalAcmeRenew',registrationId:'registered-'+provider,registrationRevision:'7'.repeat(32),
    operationCreatedAt:1650,operationUpdatedAt:1700,scheduledNextCheckBeforeReboot:1501,bootIdBefore:before,bootIdAfter:after,bootStartedAt:1550,observedAt:1750}}))};
 const externalAcmeReceiptSha256=sha256(JSON.stringify(externalAcmeReceipt));
 const definitions=[
  ['inventory',1000,['actual vendor database, read-only discovery and business baseline']],
  ['exercise',1100,['explicit attachment is required before writes','stale CAS leaves configuration and business bytes intact','real nginx -t failure keeps original service','real edit, worker reload and backup history agree','history rollback restores the real site']],
  ['prepare-vendor-edit',1200,['old Panel request frozen before the operator edits through the actual vendor']],
  ['verify-vendor-edit',1300,['later real vendor edit survives the stale Panel request']],
  ['verify-service-restart',1400,['actual restart retains attachment, business and renewal registration']],
  ['checkpoint-restart',1500,['durable restart checkpoint captured']],
  ['verify-host-reboot',1600,['actual restart retains attachment, business and renewal registration']],
  ['verify-external-acme',1800,['real external issue and renewal agree with task ledger, TLS rotation and business bytes']],
  ['cleanup',1900,['only exact test tags removed; later SSL/vendor settings retained']],
 ];
 const report={runId,candidate:{imageId:current.imageId,sourceHash:current.sourceHash,hostAdapterSha256:hostBinding.hostAdapterSha256},runnerSha256:hostBinding.hostRunnerSha256,
  phases:Object.fromEntries(definitions.map(([name,startedAt,checks])=>[name,[{completed:true,failure:null,startedAt,finishedAt:startedAt+1,
   runtime:{imageId:current.imageId,hostAdapterSha256:hostBinding.hostAdapterSha256,bootId:startedAt<1600?before:after,bootStartedAt:startedAt<1600?500:1550},
   passed:['1Panel','BaoTa'].flatMap(provider=>checks.map(check=>({check:provider+': '+check,evidence:name==='verify-external-acme'?{receiptSha256:externalAcmeReceiptSha256,certificateSha256:'6'.repeat(64),afterHostReboot:true}:{}})))}]]))};
 return {order,runId,hostNginxReportFile:'host-'+order+'.json',externalAcmeReceiptFile:'external-'+order+'.json',report,externalAcmeReceipt,externalAcmeReceiptSha256};
}
function verifyHost(value){return verifyHostNginxEvidence(value.report,value.externalAcmeReceipt,hostBinding,value.externalAcmeReceiptSha256,value.runId);}
function installEvidence(order='panel-baota-onepanel'){
 const runId='panel-lab-'+order,before={imageId:current.imageId,imageDigest:current.imageId,bootId:'11111111-1111-1111-1111-111111111111',bootStartedAt:500};
 const after={...before,bootId:'22222222-2222-2222-2222-222222222222',bootStartedAt:1550};
 const report={runId,baseline:before,phases:Object.fromEntries(['baseline','after-baota','after-1panel','post-reboot'].map((phase,index)=>[phase,{completed:true,state:phase==='post-reboot'?after:before,startedAt:phase==='post-reboot'?1600:1000+index*10,finishedAt:phase==='post-reboot'?1601:1001+index*10,passed:['actual installation check']}]))};
 const browsers=['before-reboot','post-reboot'].map((phase,index)=>({file:order+'/'+phase+'.json',report:{runId,phase,completed:true,errors:[],runtime:index?after:before,startedAt:index?1700:1300,finishedAt:index?1701:1301,passed:['real independent Panel browser login','real BaoTa browser login page remains usable','real 1Panel browser login page remains usable']}}));
 return {order,file:order+'/installation.json',report,browsers};
}
function verifyInstall(value,repoDigests=[]){return verifyLinuxInstallEvidence(value.report,value.browsers,{order:value.order,imageId:current.imageId,repoDigests});}
function evidence(){const common={completed:true,sourceHash:current.sourceHash,imageId:current.imageId,checks:1,failed:0,skipped:0};return[
 {...common,stage:'unit',counts:{csharp:1,node:1,legacy:1,security:1,authGuard:1,hostMaintenance:1}},
 {...common,stage:'core',counts:{docker:24,browser:9,platformEntry:5,hostNginxUi:8,httpSecurity:10}},
 {...common,stage:'acme',checks:5},
 {...common,stage:'legacy',scripts:[...legacyScripts]},
 {...common,stage:'linux',installOrders:['panel-baota-onepanel','baota-onepanel-panel'],realThirdPartyPanels:true,rebootVerified:true,installEvidence:['panel-baota-onepanel','baota-onepanel-panel'].map(installEvidence),hostNginxEvidence:['panel-baota-onepanel','baota-onepanel-panel'].map(hostEvidence)},
 {...common,stage:'plugins',results:['1','2'].map(version=>({plugin:'nginx',version,success:true,checks:[...requiredPluginChecks]}))},
 {...common,stage:'security',checks:61,networkEvidence:securityEvidence()},
 ];}
test('Panel gate accepts complete current-candidate evidence',()=>assert.equal(verifyPanelGate(evidence(),current).completed,true));

test('Security stage binds all four real authentication phases, exact source bytes and cached images',()=>{
 const value=securityEvidence();assert.equal(verifySecurityEvidence(value.report,value.inputs).checks,61);
});

test('Security requires every actual guard Python module instead of an assumed file count',()=>{
 assert.deepEqual(securityGuardFiles,Object.keys(current.securityBindings.guardHashes).sort());
 for(const name of securityGuardFiles){const value=structuredClone(securityEvidence());delete value.inputs.guardHashes[name];assert.throws(()=>verifySecurityEvidence(value.report,value.inputs));}
 const unexpected=structuredClone(securityEvidence());unexpected.inputs.guardHashes['extra.py']='f'.repeat(64);assert.throws(()=>verifySecurityEvidence(unexpected.report,unexpected.inputs));
});

test('Security rejects missing, duplicate and incomplete authentication phases',()=>{
 for(const alter of [r=>r.selectedPhases.pop(),r=>r.selectedPhases[3]='ssh',r=>delete r.phases.mysql,r=>r.phases.ssh.completed=false,
  r=>r.phases.mongodb.checks=0,r=>r.checks[1].passed=false,r=>r.completed=false,r=>r.failure='authentication fixture failed']){
  const value=securityEvidence();alter(value.report);assert.throws(()=>verifySecurityEvidence(value.report,value.inputs));
 }
});

test('Security rejects a stale candidate, different runtime bytes and unbound database image',()=>{
 for(const alter of [r=>r.candidate.imageId='sha256:'+'f'.repeat(64),r=>r.candidate.sourceHash='f'.repeat(64),r=>r.runnerSha256='f'.repeat(64),
  r=>r.sourceHashes={...r.sourceHashes,daemon:'f'.repeat(64)},r=>r.runtimeSnapshots[0].sourceHashes={...r.sourceHashes,'store.py':'f'.repeat(64)},
  r=>r.runtimeSnapshots[0].runnerSha256='f'.repeat(64),r=>r.runtimeSnapshots.pop(),r=>r.runtimeSnapshots[0].imageId='sha256:'+'f'.repeat(64),
  r=>r.images={...r.images,mysql:'sha256:'+'f'.repeat(64)},r=>r.candidateChangedDuringRun=true]){
  const value=securityEvidence();alter(value.report);assert.throws(()=>verifySecurityEvidence(value.report,value.inputs));
 }
});

test('Security cannot replace default policy or meaningful network behavior with a case count',()=>{
 for(const alter of [r=>r.phases.ssh.policy.enabled=false,r=>r.phases.mysql.policy.banSeconds=60,r=>r.phases.redis.policy.maxFailures=5,
  r=>r.phases.mongodb.policy.windowSeconds=60,r=>r.checks.find(x=>x.name==='mysql:third-failure-kernel-ban').detail.expiresAt=1010,
  r=>r.checks.find(x=>x.name==='redis:third-failure-kernel-ban').detail={banSeconds:60,createdAt:1000,expiresAt:1060},
  r=>r.checks.find(x=>x.name==='ssh:automatic-expiry-restores-network').name='other check',
  r=>r.checks.find(x=>x.name==='nft:FORWARD-raw-redis-backend-bypass-blocked').name='other check',r=>r.scope='native systemd verified']){
  const value=securityEvidence();alter(value.report);assert.throws(()=>verifySecurityEvidence(value.report,value.inputs));
 }
});

test('Security requires independently successful owned-container, network and volume cleanup',()=>{
 for(const alter of [r=>r.cleanup.passed=false,r=>r.cleanup.errors.push('cleanup failed'),r=>r.cleanup.remainingVolumes.push('owned-volume'),
  r=>r.cleanup.remainingNetworks.push('owned-network'),r=>r.cleanup.remainingContainers.push('owned-container'),r=>delete r.cleanup.remainingVolumes]){
  const value=securityEvidence();alter(value.report);assert.throws(()=>verifySecurityEvidence(value.report,value.inputs));
 }
});

test('Panel gate requires the raw Security report and separately frozen inputs',()=>{
 for(const alter of [r=>r.pop(),r=>delete r[6].networkEvidence,r=>delete r[6].networkEvidence.inputsFile,r=>r[6].checks=62,
  r=>r[6].networkEvidence.inputs={...r[6].networkEvidence.inputs,runnerSha256:'f'.repeat(64)}]){
  const values=evidence();alter(values);assert.throws(()=>verifyPanelGate(values,current));
 }
});
test('Panel gate rejects missing stages, failed, skipped and zero-case receipts',()=>{
 for(const alter of [r=>r.pop(),r=>r[0].completed=false,r=>r[0].failed=1,r=>r[0].skipped=1,r=>r[0].checks=0,r=>r.splice(4,1)]){const r=evidence();alter(r);assert.throws(()=>verifyPanelGate(r,current));}
});
test('Panel gate cannot reuse receipts from before default authentication protection',()=>{
 for(const key of ['security','authGuard']){const r=evidence();delete r[0].counts[key];assert.throws(()=>verifyPanelGate(r,current));}
});
test('Panel gate requires current existing-site UI regression evidence',()=>{
 for(const key of ['hostNginxUi','httpSecurity']){const receipts=evidence();delete receipts[1].counts[key];assert.throws(()=>verifyPanelGate(receipts,current));}
});
test('Real host gate accepts two providers with independently bound post-reboot automatic SSL rotation',()=>{
 assert.equal(verifyHost(hostEvidence()).providers.length,2);
});

test('Real external SSL evidence requires the independent typed host deployment failure and restored TLS/business',()=>{
 for(const alter of [s=>delete s.hostDeploymentRollback,s=>s.hostDeploymentRollback.completed=false,s=>s.hostDeploymentRollback.status=200,
  s=>s.hostDeploymentRollback.after.certificateSha256='f'.repeat(64),s=>s.hostDeploymentRollback.after.bodySha256='f'.repeat(64),
  s=>s.hostDeploymentRollback.handshakeFailures=[],s=>s.hostDeploymentRollback.handshakeFailures[0].reason='connection timeout',
  s=>s.hostDeploymentRollback.handshakeFailures[0].observedAt=2000,s=>s.hostDeploymentRollback.requestId='manual',
  s=>s.hostDeploymentRollback.scope='ExternalAcmeIssue rollback',s=>s.hostDeploymentRollback.configurationSha256='partial']){
  const value=hostEvidence();alter(value.externalAcmeReceipt.sites[0]);assert.throws(()=>verifyHost(value));
 }
});
test('Linux installation accepts only complete immutable digest equality',()=>{
 assert(verifyInstall(installEvidence()).checks>0);
 const repo='registry.example/panel@sha256:'+'9'.repeat(64);
 const valid=installEvidence();for(const phase of Object.values(valid.report.phases))phase.state.imageDigest='sha256:'+'9'.repeat(64);
 assert(verifyInstall(valid,[repo]).checks>0);
 for(const digest of ['','sha256:','sha256:'+'9'.repeat(63),'9'.repeat(64),'sha256:'+'8'.repeat(64)]){
  const value=installEvidence();value.report.phases.baseline.state.imageDigest=digest;assert.throws(()=>verifyInstall(value,[repo]));
 }
 const wrong=installEvidence();wrong.report.phases.baseline.state.imageId='sha256:'+'8'.repeat(64);assert.throws(()=>verifyInstall(wrong,[repo]));
});
test('Linux browser evidence rejects reused files, missing phases and stale boots',()=>{
 for(const alter of [x=>x.browsers[1].file=x.browsers[0].file,x=>x.browsers[1]=structuredClone(x.browsers[0]),x=>x.browsers[1].report.phase='before-reboot',
  x=>x.browsers[1].report.runtime=structuredClone(x.browsers[0].report.runtime),x=>delete x.browsers[1].report.runtime.bootId,
  x=>x.browsers[1].report.runtime.imageId='sha256:'+'8'.repeat(64),x=>x.browsers[0].report.finishedAt=1800,x=>x.browsers[1].report.passed.pop()]){
  const value=installEvidence();alter(value);assert.throws(()=>verifyInstall(value));
 }
});
test('Linux installation cannot label an unchanged kernel as post reboot',()=>{
 const value=installEvidence();value.report.phases['post-reboot'].state=structuredClone(value.report.baseline);assert.throws(()=>verifyInstall(value));
});
test('Real host gate rejects stale candidate, adapter and either frozen runner',()=>{
 for(const alter of [x=>x.report.candidate.imageId='sha256:'+'f'.repeat(64),x=>x.report.candidate.sourceHash='f'.repeat(64),x=>x.report.candidate.hostAdapterSha256='f'.repeat(64),
  x=>x.report.runnerSha256='f'.repeat(64),x=>x.externalAcmeReceipt.runnerSha256='f'.repeat(64),x=>x.externalAcmeReceipt.hostAdapterSha256='f'.repeat(64),
  x=>x.externalAcmeReceipt.sourceHash='f'.repeat(64),x=>x.report.phases.exercise[0].runtime.imageId='sha256:'+'f'.repeat(64)]){
  const value=hostEvidence();alter(value);assert.throws(()=>verifyHost(value));
 }
});
test('Real host gate rejects missing phases and a newer failed retry after an older success',()=>{
 for(const alter of [x=>delete x.report.phases['verify-vendor-edit'],x=>x.report.phases.exercise.push({...structuredClone(x.report.phases.exercise[0]),startedAt:2000,completed:false,failure:{message:'live failure'}}),
  x=>x.report.phases['verify-host-reboot'][0].passed.pop(),x=>x.externalAcmeReceipt.sites.pop(),x=>x.report.phases.exercise[0].passed.splice(1,1)]){
  const value=hostEvidence();alter(value);assert.throws(()=>verifyHost(value));
 }
});
test('Real SSL gate rejects manual renewal, no reboot, stale evidence and unchanged served certificate',()=>{
 for(const alter of [x=>x.externalAcmeReceipt.sites[0].automaticRenewal.actor='paneladmin',x=>x.externalAcmeReceipt.sites[0].afterHostReboot=false,
  x=>x.externalAcmeReceipt.sites[0].automaticRenewal.operationUpdatedAt=1500,x=>x.externalAcmeReceipt.sites[0].automaticRenewal.bootStartedAt=1000,
  x=>x.externalAcmeReceipt.sites[0].firstCertificateSha256='6'.repeat(64),x=>x.externalAcmeReceiptSha256='f'.repeat(64),
  x=>x.report.phases['verify-external-acme'][0].passed[0].evidence.certificateSha256='f'.repeat(64),x=>x.report.phases['verify-external-acme'][0].startedAt=1500,
  x=>delete x.externalAcmeReceipt.sites[0].scheduledRenewal,x=>x.externalAcmeReceipt.sites[0].scheduledRenewal.actor='paneladmin',
  x=>x.externalAcmeReceipt.sites[0].scheduledRenewal.operationId='3'.repeat(32),x=>x.externalAcmeReceipt.sites[0].scheduledRenewal.certificateSha256='5'.repeat(64),
  x=>x.externalAcmeReceipt.sites[0].scheduledRenewal.certificateSha256='6'.repeat(64),x=>x.externalAcmeReceipt.sites[0].scheduledRenewal.observedAt=1800,
  x=>x.externalAcmeReceipt.hostRunnerSha256='f'.repeat(64)]){
  const value=hostEvidence();alter(value);assert.throws(()=>verifyHost(value));
 }
});
test('Panel Linux stage cannot omit real reports or reuse one installation-order run',()=>{
 for(const alter of [x=>delete x[4].hostNginxEvidence,x=>x[4].hostNginxEvidence.pop(),x=>x[4].hostNginxEvidence[1]=structuredClone(x[4].hostNginxEvidence[0]),
  x=>delete x[4].hostNginxEvidence[0].hostNginxReportFile]){const value=evidence();alter(value);assert.throws(()=>verifyPanelGate(value,current));}
});
test('Panel gate rejects stale source or a different tested image',()=>{
 for(const key of ['sourceHash','imageId']){const r=evidence();r[0][key]='changed';assert.throws(()=>verifyPanelGate(r,current));}
});
test('Panel gate requires the independent maintenance regression suite',()=>{
 for(const count of [undefined,0]){const rows=evidence();rows[0].counts.hostMaintenance=count;assert.throws(()=>verifyPanelGate(rows,current),/Unit coverage is incomplete/);}
});
test('Panel gate cannot substitute simulated or one-direction coexistence',()=>{
 for(const alter of [r=>r[4].realThirdPartyPanels=false,r=>r[4].rebootVerified=false,r=>r[4].installOrders.pop()]){const r=evidence();alter(r);assert.throws(()=>verifyPanelGate(r,current));}
});
test('Panel gate requires every real version and retained-data reinstall',()=>{
 for(const alter of [r=>r[5].results.pop(),r=>r[5].results[1].version='1',r=>r[5].results[0].checks.pop(),r=>r[5].results[0].success=false]){const r=evidence();alter(r);assert.throws(()=>verifyPanelGate(r,current));}
});
test('Generated manifest comparison accepts only valid build timestamp differences',()=>{
 const original={ManifestType:'Publish',Endpoints:[{Route:'index.html',AssetFile:'index.html',ResponseHeaders:[{Name:'Last-Modified',Value:'Wed, 09 Sep 2026 20:41:54 GMT'},{Name:'ETag',Value:'content-hash'}]}]};
 const rebuilt=structuredClone(original);rebuilt.Endpoints[0].ResponseHeaders[0].Value='Thu, 10 Sep 2026 01:00:00 GMT';
 assert.equal(compareGeneratedEndpoints(original,rebuilt).length,2);
 for(const alter of [x=>x.Endpoints[0].Route='different',x=>x.Endpoints[0].ResponseHeaders[1].Value='different',x=>x.Endpoints[0].ResponseHeaders[0].Value='invalid',x=>x.Endpoints[0].AssetFile='../secret']){
  const changed=structuredClone(rebuilt);alter(changed);assert.throws(()=>compareGeneratedEndpoints(original,changed));
 }
});
