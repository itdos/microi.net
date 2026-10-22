import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import { createChatHistoryState, fetchChatHistoryPage, refreshChatHistoryTail, mergeChatHistory } from '../src/utils/chat-history.js';

const row = (id, time, text = id) => ({ MessageId:id, RequestId:`request-${id}`, FromUserId:'peer', ToUserId:'me', CreateTime:time, Content:text });
test('prepend older months, merge live messages and keep equal-text distinct messages', () => {
    const a=row('a','2025-12-31T12:00:00Z','相同文字'), b=row('b','2026-01-01T12:00:00Z','相同文字');
    const c=row('c','2026-02-01T12:00:00Z');
    assert.deepEqual(mergeChatHistory([b,c],[a,b], 'me','peer').map(r=>r.MessageId),['a','b','c']);
});
test('server acknowledgement replaces exactly its optimistic RequestId', () => {
    const sent={...row('a','2026-01-01T12:00:00Z'), FromUserId:'me',ToUserId:'peer'};
    const pending={...sent, MessageId:undefined, tempId:'local-a', SendFailed:true};
    const result=mergeChatHistory([pending],[sent], 'me','peer');
    assert.equal(result.length,1);
    assert.equal(result[0].MessageId,'a');
    assert.equal(result[0].tempId,undefined);
    assert.equal(result[0].SendFailed,undefined);
});
test('equal timestamp sorts by stable id and foreign conversations cannot enter list', () => {
    const time='2026-01-01T12:00:00Z';
    const result=mergeChatHistory([row('b',time)],[row('a',time),{...row('evil',time),FromUserId:'other'}],'me','peer');
    assert.deepEqual(result.map(r=>r.MessageId),['a','b']);
});
test('late peer page is ignored; simultaneous scroll requests coalesce', async () => {
    const state=createChatHistoryState('peer'); let selected=state, resolve, calls=0;
    const invoke=()=>{calls++;return new Promise(done=>{resolve=done;});};
    const first=fetchChatHistoryPage(state,invoke,'me',s=>s===selected);
    assert.equal(await fetchChatHistoryPage(state,invoke,'me',s=>s===selected),null);
    selected=createChatHistoryState('other',1);
    resolve({PeerUserId:'peer',Messages:[row('a','2025-12-01')],HasMore:true,NextCursor:'next'});
    assert.equal(await first,null);
    assert.equal(state.cursor,''); assert.equal(calls,1);
});
test('empty sparse partition page can continue, failures retain the cursor for retry', async () => {
    const state=createChatHistoryState('peer');
    const isCurrent=s=>s===state;
    assert.deepEqual(await fetchChatHistoryPage(state,async()=>({PeerUserId:'peer',Messages:[],HasMore:true,NextCursor:'2025'}),'me',isCurrent),[]);
    assert.equal(state.cursor,'2025');
    await fetchChatHistoryPage(state,async()=>{throw Error('网络中断');},'me',isCurrent);
    assert.equal(state.cursor,'2025'); assert.match(state.error,/网络中断/);
    let request;
    const result=await fetchChatHistoryPage(state,async(_method,args)=>{request=args;return {PeerUserId:'peer',Messages:[row('a','2025-01-01')],HasMore:false,NextCursor:'done'};},'me',isCurrent);
    assert.equal(request.HistoryCursor,'2025'); assert.equal(result.length,1); assert.equal(state.hasMore,false);
});
test('chat component compiles with cursor scroll and without broadcast history replacement', () => {
    const source=fs.readFileSync(new URL('../src/views/chat/index.vue',import.meta.url),'utf8');
    const {descriptor,errors}=parse(source); assert.deepEqual(errors,[]);
    const script=compileScript(descriptor,{id:'chat-history'});
    assert.ok(script.content.includes('fetchChatHistoryPage'));
    assert.deepEqual(compileTemplate({id:'chat-history',source:descriptor.template.content,filename:'chat.vue'}).errors,[]);
    assert.doesNotMatch(source,/invoke\("SendChatRecordToUser"/);
    assert.match(source,/@scroll\.passive="onHistoryScroll"/);
});

test('visible live messages acknowledge a bounded latest page without resetting old history cursor', async () => {
    const state = createChatHistoryState('peer'); state.cursor = 'older-2025'; state.hasMore = false; state.error = 'retained'; state.tailPending = true;
    const requests = [], resolvers = [];
    const invoke = (_method, request) => { requests.push(request); return new Promise(resolve => resolvers.push(resolve)); };
    const first = refreshChatHistoryTail(state, invoke, 'me', candidate => candidate === state);
    state.tailPending = true; // Another live message while the first read receipt is in flight.
    assert.equal(await refreshChatHistoryTail(state, invoke, 'me', () => true), null);
    resolvers.shift()({ PeerUserId: 'peer', Messages: [row('a', '2026-02-01')], NextCursor: 'new-tail', HasMore: true });
    await Promise.resolve();
    resolvers.shift()({ PeerUserId: 'peer', Messages: [row('a', '2026-02-01'), row('b', '2026-02-02')], HasMore: false });
    assert.deepEqual((await first).map(item => item.MessageId), ['a', 'b']);
    assert.equal(requests.length, 2); assert.ok(requests.every(request => request.HistoryCursor === '' && request._PageSize === 30));
    assert.equal(state.cursor, 'older-2025'); assert.equal(state.hasMore, false); assert.equal(state.error, 'retained');
    assert.equal(state.tailPending, false); assert.equal(state.tailLoading, false);
});
test('tail read failure stays retryable and late receipts never enter the newly selected peer', async () => {
    const state = createChatHistoryState('peer'); state.tailPending = true;
    assert.equal(await refreshChatHistoryTail(state, async () => { throw Error('disconnected'); }, 'me', () => true), null);
    assert.equal(state.tailPending, true);
    let selected = state, resolve;
    const pending = refreshChatHistoryTail(state, () => new Promise(done => { resolve = done; }), 'me', candidate => candidate === selected);
    selected = createChatHistoryState('new-peer');
    resolve({ PeerUserId: 'peer', Messages: [row('a', '2026-02-01')] });
    assert.equal(await pending, null); assert.equal(selected.tailPending, false); assert.equal(selected.cursor, '');
});

test('mobile chat compiles with the same cursor pager and no reserved history loader', () => {
    const source=fs.readFileSync(new URL('../src/views/mobile/chat.vue',import.meta.url),'utf8');
    const {descriptor,errors}=parse(source); assert.deepEqual(errors,[]);
    const script=compileScript(descriptor,{id:'mobile-chat-history'});
    assert.ok(script.content.includes('fetchChatHistoryPage'));
    assert.deepEqual(compileTemplate({id:'mobile-chat-history',source:descriptor.template.content,filename:'mobile-chat.vue'}).errors,[]);
    assert.doesNotMatch(source,/getChatRecord\(ws|reserved/);
    assert.match(source,/watch\(chatId/);
});
