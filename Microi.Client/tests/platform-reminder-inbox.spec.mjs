import test from 'node:test';
import assert from 'node:assert/strict';
import { createReminderInbox, safeReminderLink } from '../src/utils/platform-reminder-inbox.js';
const instant = Date.parse('2026-09-10T00:00:00Z');
const item = { Id:'Local:batch:0', Title:'维护',Content:'<script>文字</script>',EndsAt:'2026-09-11T00:00:00Z' };
function harness(request, options={}) {
    const state = {rows:[],timers:[],calls:[]};
    state.inbox=createReminderInbox({request:async param=>{state.calls.push(param);return request(param)},entryId:'same-document-123456',
        onChange:rows=>{state.rows=rows},now:()=>instant,schedule:(cb,ms)=>{state.timers.push({cb,ms});return state.timers.length},cancel:()=>{},...options});
    return state;
}
test('realtime wakeups coalesce and never append duplicate dialogs',async()=>{
    let release;const wait=new Promise(resolve=>{release=resolve});
    const h=harness(async()=>{await wait;return {Code:1,Data:[item,item]}});
    const running=h.inbox.refresh();await h.inbox.refresh();await h.inbox.refresh();
    assert.equal(h.calls.length,1);release();await running;
    assert.equal(h.rows.length,1);assert.equal(h.timers.at(-1).ms,1000);h.inbox.dispose();
});
test('fallback polls every 15 seconds; realtime keeps bounded reconciliation',async()=>{
    for(const [online,delay] of [[false,15000],[true,60000]]){
        const h=harness(async()=>({Code:1,Data:[item]}),{connected:()=>online});await h.inbox.refresh();
        assert.equal(h.timers.at(-1).ms,delay);h.inbox.dispose();
    }
});
test('V8.Http JSON text responses display and acknowledge normally',async()=>{
    const h=harness(async p=>JSON.stringify({Code:1,Data:p.Action==='Inbox'?[item]:{Closed:true}}));
    await h.inbox.refresh();assert.equal(h.rows.length,1);
    await h.inbox.close(item.Id);assert.deepEqual(h.rows,[]);
    await h.inbox.refresh();assert.equal(h.calls.filter(x=>x.Action==='Acknowledge').length,1);h.inbox.dispose();
});
test('closing offline dismisses immediately and retries exactly the same receipt',async()=>{
    let offline=true;
    const h=harness(async p=>{if(p.Action==='Acknowledge'&&offline)throw Error('offline');return {Code:1,Data:p.Action==='Inbox'?[item]:{}}});
    await h.inbox.refresh();await h.inbox.close(item.Id);assert.deepEqual(h.rows,[]);
    offline=false;await h.inbox.refresh();assert.deepEqual(h.rows,[]);
    const acknowledgements=h.calls.filter(x=>x.Action==='Acknowledge');assert.equal(acknowledgements.length,2);assert.deepEqual(acknowledgements[0],acknowledgements[1]);
    await h.inbox.close(item.Id);assert.equal(h.calls.filter(x=>x.Action==='Acknowledge').length,2);h.inbox.dispose();
});
test('logout or tenant switch discards an in-flight response',async()=>{
    let release;const wait=new Promise(resolve=>{release=resolve});const h=harness(async()=>{await wait;return {Code:1,Data:[item]}});
    const running=h.inbox.refresh();h.inbox.dispose();release();await running;assert.deepEqual(h.rows,[]);assert.equal(h.timers.length,0);
});
test('withdrawal and expiry remove an already-visible reminder',async()=>{
    let rows=[item],clock=instant;
    const h=harness(async()=>({Code:1,Data:rows}),{now:()=>clock});await h.inbox.refresh();assert.equal(h.rows.length,1);
    rows=[];await h.inbox.refresh();assert.deepEqual(h.rows,[]);
    rows=[item];clock=Date.parse(item.EndsAt);await h.inbox.refresh();assert.deepEqual(h.rows,[]);h.inbox.dispose();
});
test('links reject script, credentials, backslashes, protocol-relative and controls',()=>{
    for(const value of ['javascript:alert(1)','//evil.test','/\\evil.test','https://u:p@evil.test','data:text/html,x','https://a.test/\n'])assert.equal(safeReminderLink(value,'https://tenant.test'),'');
    assert.equal(safeReminderLink('/help','https://tenant.test'),'https://tenant.test/help');
    assert.equal(safeReminderLink('https://microi.net/doc','https://tenant.test'),'https://microi.net/doc');
});
