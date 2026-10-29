import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';

export const requiredStages=['unit','core','acme','security','legacy','linux'];
export const legacyScripts=['docker-e2e.mjs','platform-protocol.e2e.mjs','registry-scheduler.e2e.mjs','platform-login.e2e.mjs','https-proxy.e2e.mjs','bootstrap.e2e.mjs','browser-smoke.mjs','platform-menu.e2e.mjs'];
export const requiredPluginChecks=['install-healthy-pinned-image','real-authenticated-business-probe','restart-and-persistence','stop-start-business-readback','uninstall-preserves-volume','reinstall-same-image-and-preserved-business-data'];
export const backupFamilies=['mysql','postgresql','sqlserver','oracle','redis','mongodb','minio'];
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const securitySourcePaths={guard:'Microi.Server/Microi.Panel/AuthGuard',runner:'Microi.Server/Microi.Panel/AuthGuard/tests/docker_security_e2e.py'};
export const securityPhases=['ssh','redis','mongodb','mysql'];
export const securityGuardFiles=['collectors.py','daemon.py','firewall.py','nginx_adapter.py','redis_proxy.py','store.py'];
const authenticationChecks=(kind,repeats=1)=>Array.from({length:repeats},()=>[1,2,3].map(n=>kind+':authentication-error:'+n).concat(kind+':third-failure-kernel-ban')).flat();
export const requiredSecurityChecks={
 ssh:[...authenticationChecks('ssh',3),'ssh:baseline-other-ip','nft:INPUT-blocks-correct-password','ssh:other-ip-remains-usable','nft:ban-survives-agent-restart','nft:own-rules-reconciled-after-loss','ssh:manual-unban-works','nft:IPv6-INPUT-blocks','ssh:IPv6-other-ip-works','nft:auto-unban-before-expiry-blocks','ssh:automatic-expiry-restores-network','manual-unban:','manual-unban:'],
 redis:[...authenticationChecks('redis'),'redis:real-backend-through-proxy','nft:FORWARD-raw-redis-backend-bypass-blocked','redis:correct-fourth-password-blocked','redis:other-source-works','redis:unban-restores-proxy','manual-unban:'],
 mongodb:[...authenticationChecks('mongodb'),'nft:FORWARD-mongodb-correct-password-blocked','mongodb:other-source-works','mongodb:unban-restores-network','manual-unban:'],
 mysql:[...authenticationChecks('mysql',2),'nft:FORWARD-mysql-correct-password-blocked','mysql:other-source-works','mysql:unban-restores-network','iptables:baseline-before-ban','iptables:FORWARD-blocks-correct-password','iptables:INPUT-shared-ban-blocks-ssh','iptables:other-ip-works','iptables:manual-unban-restores-network','manual-unban:','manual-unban:'],
};
export function verifySecurityEvidence(report,expected){
 const hash=/^[a-f0-9]{64}$/,image=/^sha256:[a-f0-9]{64}$/;
 assert.match(expected.imageId,image);assert.match(expected.sourceHash,hash);assert.match(expected.runnerSha256,hash);
 assert.deepEqual(Object.keys(expected.guardHashes||{}).sort(),securityGuardFiles,'Frozen guard source file set is incomplete or unexpected');
 for(const [name,value] of Object.entries(expected.guardHashes)){assert.match(name,/^[a-z_]+\.py$/);assert.match(value,hash);}
 assert.deepEqual(Object.keys(expected.images).sort(),['mongodb','mysql','redis','tools']);for(const id of Object.values(expected.images))assert.match(id,image);
 assert.equal(report.completed,true);assert(!report.failure,'Authentication network suite failed');assert.equal(report.candidateChangedDuringRun,false);
 assert.equal(report.scope,'isolated Linux namespaces; not a customer deployment','This receipt does not establish native systemd acceptance');
 assert.deepEqual(report.candidate,{imageId:expected.imageId,sourceHash:expected.sourceHash});
 assert.equal(report.runnerSha256,expected.runnerSha256);assert.deepEqual(report.sourceHashes,expected.guardHashes);assert.deepEqual(report.images,expected.images);
 assert.deepEqual(report.selectedPhases,securityPhases);assert.deepEqual(Object.keys(report.phases).sort(),[...securityPhases].sort());
 assert(Number.isFinite(report.startedAt)&&report.finishedAt>=report.startedAt);
 assert(Array.isArray(report.checks)&&report.checks.length>=61);
 for(const check of report.checks){assert.equal(check.passed,true);assert(['setup',...securityPhases].includes(check.phase));}
 assert(report.checks.some(c=>c.phase==='setup'&&c.name==='defaults-enabled-3-86400-cumulative'));
 assert.equal(report.runtimeSnapshots?.length,8,'Missing actual runtime file readbacks');let last=report.startedAt;
 for(const phase of securityPhases){
  const row=report.phases[phase],checks=report.checks.filter(check=>check.phase===phase);
  assert.equal(row.completed,true);assert(!row.failure);assert(row.startedAt>=last&&row.finishedAt>=row.startedAt&&row.finishedAt<=report.finishedAt);last=row.finishedAt;
  assert.deepEqual(row.policy,{enabled:true,maxFailures:3,banSeconds:86400,windowSeconds:0});assert.equal(row.checks,checks.length);
  const available=checks.map(check=>check.name);
  for(const name of requiredSecurityChecks[phase]){const index=available.findIndex(actual=>name==='manual-unban:'?actual.startsWith(name):actual===name);assert(index>=0,phase+' is missing '+name);available.splice(index,1);}
  const bans=checks.filter(check=>check.name===phase+':third-failure-kernel-ban');assert(bans.some(check=>check.detail?.banSeconds===86400),'No actual 24-hour ban recorded for '+phase);
  for(const ban of bans){assert(Number.isFinite(ban.detail?.createdAt)&&Number.isFinite(ban.detail.expiresAt));assert([60,86400].includes(ban.detail.banSeconds));assert(Math.abs(ban.detail.expiresAt-ban.detail.createdAt-ban.detail.banSeconds)<1);}
  for(const suffix of ['before','after']){
   const snapshots=report.runtimeSnapshots.filter(s=>s.phase===phase+':'+suffix);assert.equal(snapshots.length,1);const actual=snapshots[0];
   assert.match(actual.containerId,hash);assert.equal(actual.containerId,report.runtimeSnapshots[0].containerId);assert.equal(actual.imageId,expected.images.tools);
   assert.deepEqual(actual.sourceHashes,expected.guardHashes);assert.equal(actual.runnerSha256,expected.runnerSha256);
   assert(actual.observedAt>=row.startedAt&&actual.observedAt<=row.finishedAt);
  }
 }
 assert.equal(report.cleanup?.passed,true);for(const key of ['remainingContainers','remainingNetworks','remainingVolumes','errors'])assert.deepEqual(report.cleanup[key],[],'Incomplete Security cleanup: '+key);
 return {checks:report.checks.length,phases:[...securityPhases],scope:report.scope};
}
export const hostNginxSourcePaths={
 hostAdapterSha256:'Microi.Server/Microi.Panel/AuthGuard/nginx_adapter.py',
 hostRunnerSha256:'Microi.Server/Microi.Tests/Panel/panel-host-nginx.e2e.py',
 externalRunnerSha256:'Microi.Server/Microi.Tests/Panel/panel-external-acme.e2e.py',
};
const hostPhaseChecks={
 inventory:['actual vendor database, read-only discovery and business baseline'],
 exercise:['explicit attachment is required before writes','stale CAS leaves configuration and business bytes intact','real nginx -t failure keeps original service','real edit, worker reload and backup history agree','history rollback restores the real site'],
 'prepare-vendor-edit':['old Panel request frozen before the operator edits through the actual vendor'],
 'verify-vendor-edit':['later real vendor edit survives the stale Panel request'],
 'checkpoint-restart':['durable restart checkpoint captured'],
 'verify-service-restart':['actual restart retains attachment, business and renewal registration'],
 'verify-host-reboot':['actual restart retains attachment, business and renewal registration'],
 'verify-external-acme':['real external issue and renewal agree with task ledger, TLS rotation and business bytes'],
 cleanup:['only exact test tags removed; later SSL/vendor settings retained'],
};
const hostProviders=['1Panel','BaoTa'];
const hash=value=>assert.match(value,/^[a-f0-9]{64}$/);
const timestamp=value=>{assert(Number.isFinite(value)&&value>0,'Missing real observation timestamp');return value;};
const bootIdentity=state=>{
 assert.match(state?.bootId,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
 timestamp(state.bootStartedAt);return state;
};
export function verifyLinuxInstallEvidence(report,browsers,{order,imageId,repoDigests=[]}){
 assert(['panel-baota-onepanel','baota-onepanel-panel'].includes(order));assert.match(imageId,/^sha256:[a-f0-9]{64}$/);
 const allowed=new Set([imageId,...repoDigests.map(value=>{assert.match(value,/@sha256:[a-f0-9]{64}$/);return value.slice(value.lastIndexOf('@')+1);})]);
 const phases=order==='panel-baota-onepanel'?['baseline','after-baota','after-1panel','post-reboot']:['baseline','post-reboot'];
 let checks=0;
 for(const name of phases){
  const phase=report.phases?.[name];assert.equal(phase?.completed,true,'Incomplete installation phase '+name);
  assert.match(phase.state?.imageDigest,/^sha256:[a-f0-9]{64}$/);assert(allowed.has(phase.state.imageDigest),'Installed digest is not the exact candidate');
  assert.equal(phase.state.imageId,imageId,'Installation ran a different image');bootIdentity(phase.state);
  assert(timestamp(phase.finishedAt)>=timestamp(phase.startedAt));assert(Array.isArray(phase.passed)&&phase.passed.length>0);checks+=phase.passed.length;
 }
 const before=bootIdentity(report.baseline),after=report.phases['post-reboot'].state;
 assert.equal(before.bootId,report.phases.baseline.state.bootId);assert.notEqual(before.bootId,after.bootId,'Installation lacks a real host reboot');
 assert(after.bootStartedAt>before.bootStartedAt);
 assert.equal(browsers.length,2,'Require exactly one browser receipt before and one after reboot');
 assert.equal(new Set(browsers.map(row=>row.file)).size,2,'Browser evidence file was reused');
 assert.deepEqual(browsers.map(row=>row.report.phase).sort(),['before-reboot','post-reboot']);
 for(const row of browsers){
  assert(typeof row.file==='string'&&row.file.length>0);const result=row.report;
  assert.equal(result.completed,true);assert.equal(result.runId,report.runId);assert.deepEqual(result.errors,[]);
  assert.equal(result.runtime?.imageId,imageId);bootIdentity(result.runtime);
  const expected=result.phase==='post-reboot'?after:before;assert.equal(result.runtime.bootId,expected.bootId);
  assert(Math.abs(result.runtime.bootStartedAt-expected.bootStartedAt)<5);assert(timestamp(result.finishedAt)>=timestamp(result.startedAt));
  assert(result.startedAt>=expected.bootStartedAt);
  if(result.phase==='before-reboot')assert(result.finishedAt<=after.bootStartedAt+5,'Before-reboot browser receipt was produced after reboot');
  for(const check of ['real independent Panel browser login','real BaoTa browser login page remains usable','real 1Panel browser login page remains usable'])assert(result.passed?.includes(check),'Missing actual browser check: '+check);
  checks+=result.passed.length;
 }
 return {checks,runId:report.runId};
}
// 只接收冻结 runner 的真实报告；旧成功项后追加的失败不能被挑选忽略。
export function verifyHostNginxEvidence(report,external,{sourceHash,imageId,hostAdapterSha256,hostRunnerSha256,externalRunnerSha256},externalSha256,runId){
 for(const value of [sourceHash,hostAdapterSha256,hostRunnerSha256,externalRunnerSha256,externalSha256])hash(value);
 assert.equal(report.runId,runId);assert.equal(external.runId,runId);assert.equal(typeof runId,'string');assert(runId.length>5);
 assert.deepEqual(report.candidate,{imageId,sourceHash,hostAdapterSha256});assert.equal(report.runnerSha256,hostRunnerSha256);
 assert.equal(external.completed,true);assert.equal(external.candidateImageId,imageId);assert.equal(external.sourceHash,sourceHash);
 assert.equal(external.hostAdapterSha256,hostAdapterSha256);assert.equal(external.runnerSha256,externalRunnerSha256);
 assert.equal(external.hostRunnerSha256,hostRunnerSha256);
 const latest={};let checks=0;
 for(const [name,required] of Object.entries(hostPhaseChecks)){
  const attempts=report.phases?.[name];assert(Array.isArray(attempts)&&attempts.length>0,'Missing real host phase: '+name);
  const phase=attempts.at(-1);assert.equal(phase.completed,true,'Latest host phase is incomplete: '+name);assert.equal(phase.failure,null,'Host phase retained a failure: '+name);
  const started=timestamp(phase.startedAt),finished=timestamp(phase.finishedAt);assert(finished>=started);
  assert(attempts.every(item=>timestamp(item.startedAt)<=started),'Host phase chronology was reordered: '+name);
  assert.equal(phase.runtime?.imageId,imageId);assert.equal(phase.runtime?.hostAdapterSha256,hostAdapterSha256);
  assert.match(phase.runtime.bootId,/^[a-f0-9-]{36}$/);timestamp(phase.runtime.bootStartedAt);
  assert(Array.isArray(phase.passed));
  for(const provider of hostProviders)for(const check of required)
   assert.equal(phase.passed.filter(item=>item.check===provider+': '+check).length,1,'Missing or duplicated '+provider+' '+name+' evidence: '+check);
  checks+=phase.passed.length;latest[name]=phase;
 }
 assert.notEqual(latest['checkpoint-restart'].runtime.bootId,latest['verify-host-reboot'].runtime.bootId,'No independently observed host reboot');
 assert.equal(latest['verify-service-restart'].runtime.bootId,latest['checkpoint-restart'].runtime.bootId,'Service-only restart used a different host boot');
 assert.equal(latest['verify-external-acme'].runtime.bootId,latest['verify-host-reboot'].runtime.bootId,'External SSL was checked on a different boot');
 assert(latest['verify-external-acme'].startedAt>=latest['verify-host-reboot'].finishedAt,'SSL receipt was not independently checked after reboot');
 assert(latest.cleanup.startedAt>=latest['verify-external-acme'].finishedAt,'Fixture cleanup is older than SSL acceptance');
 assert(Array.isArray(external.sites));assert.deepEqual(external.sites.map(row=>row.provider).sort(),hostProviders);
 assert.equal(new Set(external.sites.map(row=>row.instanceId+':'+row.siteId)).size,2,'External sites were duplicated');
 for(const site of external.sites){
  assert.equal(site.completed,true);assert.equal(site.afterHostReboot,true);assert.equal(typeof site.instanceId,'string');assert(site.instanceId.length>0);assert.match(site.siteId,/^[a-f0-9]{32}$/);
  const rollback=site.hostDeploymentRollback;assert.equal(rollback?.completed,true,'Missing real host certificate transaction rollback');
  assert.equal(rollback.scope,'Real host certificate transaction, not an ExternalAcmeIssue operation');assert.equal(rollback.status,503);
  assert.match(rollback.requestId,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);hash(rollback.configurationSha256);
  for(const snapshot of [rollback.before,rollback.after]){assert.equal(snapshot?.status,200);hash(snapshot.bodySha256);hash(snapshot.certificateSha256);assert.match(snapshot.certificateSha1,/^[A-F0-9]{40}$/);assert(Number.isFinite(snapshot.lifetimeSeconds)&&snapshot.lifetimeSeconds>0);}
  for(const key of ['status','bodySha256','certificateSha256','certificateSha1'])assert.equal(rollback.before[key],rollback.after[key],'Host rollback did not restore '+key);
  assert(Array.isArray(rollback.handshakeFailures)&&rollback.handshakeFailures.length>0,'No independently observed deployment TLS failure');
  for(const failure of rollback.handshakeFailures){assert(['SSLV3_ALERT_HANDSHAKE_FAILURE','HANDSHAKE_FAILURE','NO_SHARED_CIPHER'].includes(failure.reason));assert(timestamp(failure.observedAt)<=timestamp(rollback.observedAt));}
  assert(rollback.observedAt<=latest['verify-external-acme'].startedAt,'Host rollback evidence was not included in the independent final receipt readback');
  hash(site.firstCertificateSha256);hash(site.renewedCertificateSha256);assert.notEqual(site.firstCertificateSha256,site.renewedCertificateSha256,'No actual external certificate rotation');
  for(const key of ['issueOperationId','renewOperationId'])assert.match(site[key],/^[a-f0-9]{32}$/);
  assert.notEqual(site.issueOperationId,site.renewOperationId,'Issue was reused as renewal');
  const scheduled=site.scheduledRenewal;assert.equal(scheduled?.actor,'scheduler');assert.equal(scheduled.action,'ExternalAcmeRenew');
  assert.match(scheduled.operationId,/^[a-f0-9]{32}$/);assert.notEqual(scheduled.operationId,site.issueOperationId);assert.notEqual(scheduled.operationId,site.renewOperationId);
  hash(scheduled.certificateSha256);assert.notEqual(scheduled.certificateSha256,site.firstCertificateSha256,'Normal scheduled renewal did not rotate the served certificate');
  assert.notEqual(scheduled.certificateSha256,site.renewedCertificateSha256,'Post-reboot renewal reused the pre-reboot certificate');
  assert(timestamp(scheduled.observedAt)>=timestamp(scheduled.operationUpdatedAt));
  const automatic=site.automaticRenewal;assert.equal(automatic?.enabled,true);assert.equal(automatic.actor,'scheduler');assert.equal(automatic.action,'ExternalAcmeRenew');
  assert.equal(typeof automatic.registrationId,'string');assert(automatic.registrationId.length>0);assert.equal(typeof automatic.registrationRevision,'string');assert(automatic.registrationRevision.length>0);
  assert.notEqual(automatic.bootIdBefore,automatic.bootIdAfter);assert.equal(automatic.bootIdBefore,latest['checkpoint-restart'].runtime.bootId);assert.equal(automatic.bootIdAfter,latest['verify-host-reboot'].runtime.bootId);
  const boot=timestamp(automatic.bootStartedAt),created=timestamp(automatic.operationCreatedAt),updated=timestamp(automatic.operationUpdatedAt),observed=timestamp(automatic.observedAt);
  assert(scheduled.observedAt<=boot,'Normal scheduled renewal evidence is not from before reboot');
  timestamp(automatic.scheduledNextCheckBeforeReboot);assert(updated>=created&&observed>=updated);assert(created>=boot||updated>=boot,'Automatic renewal predates the host reboot');
  assert(Math.abs(boot-latest['verify-host-reboot'].runtime.bootStartedAt)<5,'Automatic renewal belongs to a different boot');
  const confirmed=latest['verify-external-acme'].passed.find(item=>item.check===site.provider+': '+hostPhaseChecks['verify-external-acme'][0]).evidence;
  assert.equal(confirmed?.receiptSha256,externalSha256,'Host runner did not independently bind this exact external receipt');
  assert.equal(confirmed.certificateSha256,site.renewedCertificateSha256);assert.equal(confirmed.afterHostReboot,true);
 }
 return {checks,providers:[...hostProviders],runId};
}
// ASP.NET 静态资源清单记录每次构建的文件修改时间。只允许这个已识别的生成时间差异；
// 路由、响应语义、ETag、完整性和实际资源字节继续严格比较，不允许忽略整个生成文件。
export function compareGeneratedEndpoints(actual,expected){
 const times=[];
 function normalize(value,side){
  const copy=structuredClone(value);assert.equal(copy.ManifestType,'Publish');assert(Array.isArray(copy.Endpoints)&&copy.Endpoints.length>0);
  for(const item of copy.Endpoints){
   assert(typeof item.AssetFile==='string'&&!item.AssetFile.split('/').includes('..'));
   const header=item.ResponseHeaders?.find(h=>h.Name==='Last-Modified');assert(header,'Missing static asset Last-Modified');
   assert.equal(new Date(header.Value).toUTCString(),header.Value,'Invalid generated HTTP timestamp');
   times.push({side,assetFile:item.AssetFile,lastModified:header.Value});header.Value='<verified build timestamp>';
  }return copy;
 }
 assert.deepEqual(normalize(actual,'image'),normalize(expected,'source'),'Static asset manifests differ beyond build timestamps');
 return times;
}
export async function fingerprintPanelSource(root){
 const inputs=['Microi.Server/Microi.Panel','Microi.Server/Microi.Tests/Panel','Microi.Server/Microi.Tests/run-tests.ps1','Microi.Server/Microi.Tests/run-node-regressions.mjs','Microi.Server/.editorconfig','Microi.UI/src','Microi.UI/package.json','microi.skills/ui-design/SKILL.md','microi.skills/microi-ui/SKILL.md','数据库、案例、文档、资料/install-microi-panel.sh','数据库、案例、文档、资料/install-microi.sh','数据库、案例、文档、资料/install-microi-offline.sh','数据库、案例、文档、资料/microi-offline-prepare.sh'];
 const files=[];
 async function collect(path){
  const {stat}=await import('node:fs/promises');const info=await stat(path);
  if(info.isDirectory())for(const entry of await readdir(path,{withFileTypes:true})){
   if(entry.isDirectory()&&/^(bin|obj|node_modules|dist|wwwroot|TestResults|__pycache__|\.git)$/.test(entry.name))continue;
   if(entry.isSymbolicLink())throw Error('Source fingerprint rejects symbolic links: '+path+'/'+entry.name);
   if(entry.isDirectory()||entry.isFile())await collect(resolve(path,entry.name));
  }else files.push({path:relative(root,path).replaceAll('\\','/'),sha256:sha256(await readFile(path)),size:info.size});
 }
 for(const input of inputs)await collect(resolve(root,input));
 files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return {sha256:sha256(files.map(x=>`${x.path}\t${x.sha256}\t${x.size}`).join('\n')),files};
}
export function verifyPanelGate(receipts,{sourceHash,imageId,catalog,hostNginxBindings,securityBindings}){
 assert.match(sourceHash,/^[a-f0-9]{64}$/);assert.match(imageId,/^sha256:[a-f0-9]{64}$/);
 for(const receipt of receipts){assert.equal(receipt.completed,true,'Incomplete stage: '+receipt.stage);assert.equal(receipt.sourceHash,sourceHash,'Source changed since '+receipt.stage);assert.equal(receipt.imageId,imageId,'Candidate image mismatch: '+receipt.stage);assert(receipt.checks>0,'Zero checks in '+receipt.stage);assert.equal(receipt.failed,0);assert.equal(receipt.skipped,0);}
 for(const stage of requiredStages)assert.equal(receipts.filter(r=>r.stage===stage).length,1,'Missing or duplicated stage: '+stage);
 const unit=receipts.find(r=>r.stage==='unit');assert(unit.counts.csharp>0&&unit.counts.node>0&&unit.counts.legacy>0&&unit.counts.security>0&&unit.counts.authGuard>0&&unit.counts.hostMaintenance>0,'Unit coverage is incomplete');
 const core=receipts.find(r=>r.stage==='core');assert(core.counts.docker>=24&&core.counts.browser>=9&&core.counts.platformEntry>=5&&core.counts.hostNginxUi>=8&&core.counts.httpSecurity>=10,'Core behavior coverage is incomplete');
 assert(receipts.find(r=>r.stage==='acme').checks>=5,'Real ACME coverage is incomplete');
 const security=receipts.find(r=>r.stage==='security'),network=security.networkEvidence;
 assert(network?.file&&network.inputsFile&&network.inputs,'Actual authentication network evidence and frozen inputs are required');
 assert.deepEqual(network.inputs,{imageId,sourceHash,...securityBindings,images:network.inputs.images});
 assert.equal(security.checks,verifySecurityEvidence(network.report,network.inputs).checks);
 const legacy=receipts.find(r=>r.stage==='legacy');assert.deepEqual([...legacy.scripts].sort(),[...legacyScripts].sort(),'Legacy protocol suite is incomplete');
 const linux=receipts.find(r=>r.stage==='linux');
 assert.deepEqual([...linux.installOrders].sort(),['baota-onepanel-panel','panel-baota-onepanel']);assert.equal(linux.realThirdPartyPanels,true);assert.equal(linux.rebootVerified,true);
 assert(Array.isArray(linux.installEvidence),'Linux is missing independently bound installation and browser evidence');
 assert.deepEqual(linux.installEvidence.map(item=>item.order).sort(),[...linux.installOrders].sort());
 assert.equal(new Set(linux.installEvidence.map(item=>item.report?.runId)).size,2);
 for(const item of linux.installEvidence)verifyLinuxInstallEvidence(item.report,item.browsers,{order:item.order,imageId,repoDigests:linux.repoDigests||[]});
 assert(Array.isArray(linux.hostNginxEvidence),'Linux is missing real existing-site and external SSL reports');
 assert.deepEqual(linux.hostNginxEvidence.map(item=>item.order).sort(),[...linux.installOrders].sort());
 assert.equal(new Set(linux.hostNginxEvidence.map(item=>item.runId)).size,2,'Two installation orders reused one host run');
 for(const item of linux.hostNginxEvidence){
  assert(item.hostNginxReportFile&&item.externalAcmeReceiptFile,'Actual Linux evidence files are required');
  assert.equal(linux.installEvidence.find(entry=>entry.order===item.order)?.report.runId,item.runId,'Installation and host-site evidence belong to different lab runs');
  verifyHostNginxEvidence(item.report,item.externalAcmeReceipt,{sourceHash,imageId,...hostNginxBindings},item.externalAcmeReceiptSha256,item.runId);
 }
 const expected=catalog.flatMap(plugin=>plugin.versions.map((version,index)=>({key:plugin.id+':'+version.id,backup:index===0&&backupFamilies.includes(plugin.id)})));
 assert(expected.length>0,'Actual candidate catalog is missing');
 const plugins=receipts.filter(r=>r.stage.startsWith('plugins')).flatMap(r=>r.results||[]);
 assert.equal(plugins.length,expected.length,'Plugin version coverage differs from the actual catalog');
 assert.equal(new Set(plugins.map(x=>x.plugin+':'+x.version)).size,expected.length,'Plugin versions were duplicated across shards');
 for(const item of expected){const result=plugins.find(x=>x.plugin+':'+x.version===item.key);assert(result?.success,'Missing successful real plugin: '+item.key);for(const check of requiredPluginChecks)assert(result.checks.includes(check),item.key+' is missing '+check);if(item.backup)for(const check of ['cold-backup-and-resume','new-volume-restore-and-old-volume-preserved','backup-file-deletion'])assert(result.checks.includes(check),item.key+' is missing '+check);}
 return {completed:true,sourceHash,imageId,stages:receipts.length,pluginVersions:expected.length,checks:receipts.reduce((sum,r)=>sum+r.checks,0),failed:0,skipped:0};
}
