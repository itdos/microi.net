import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export function currentPlatformEvent(events,{runId,deploymentId,lastSync}) {
 const match=/^panel-gate-legacy-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(runId);
 assert(match,'Legacy event evidence requires the current gate RunId');
 const started=Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`),synced=Date.parse(lastSync);
 assert(Number.isFinite(started)&&Number.isFinite(synced)&&synced>=started);
 const candidates=events.filter(event=>event.action==='PlatformConnected'&&event.deploymentId===deploymentId
  &&/^[a-f0-9]{32}$/.test(event.eventId)&&Date.parse(event.occurredAt)>=started&&Date.parse(event.occurredAt)<=synced);
 assert(candidates.length,'No persisted platform connection event from the current acceptance run');
 return candidates.sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt))[0];
}

export function currentPlatformLog(rows,event,osClient) {
 assert(Array.isArray(rows));assert(/^[a-f0-9]{32}$/.test(event.eventId));
 const id='audit_'+createHash('sha256').update(`Microi.Ops|${osClient.toLowerCase()}|${event.deploymentId}|${event.eventId}`).digest('hex').slice(0,40);
 const matches=rows.map((row,index)=>({row,index})).filter(({row})=>row.OtherInfo==='OpsEventId='+event.eventId);
 assert.equal(matches.length,1,'MongoDB must independently return exactly this run event, not an arbitrary historical Ops row');
 const {row,index}=matches[0];
 for(const [key,value] of Object.entries({Id:id,EventId:id,NodeId:event.deploymentId,Action:event.action,Content:event.message,Success:event.success,Category:'Operations',Source:'Microi.Ops',Type:'Microi.Ops'}))
  assert.equal(row[key],value,`Persisted Ops event ${key} mismatch`);
 return {row,index,eventId:event.eventId,persistedId:id};
}
