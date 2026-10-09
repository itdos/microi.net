import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as preferences from '../src/utils/user-visual-preferences.js';
import {getUserVisualPreferenceSaveSession} from '../src/utils/user-visual-preference-save-session.js';
import {computed, reactive, watch} from '../node_modules/vue/index.mjs';

const sfc = readFileSync(new URL('../src/layout/components/ThemeSelect.vue', import.meta.url), 'utf8');
const script = sfc.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];/g, '')
  .replace('export default', 'const component =');
const componentFactory = new Function('DiyCommon', 'preferences', 'getUserVisualPreferenceSaveSession', 'setTimeout', 'clearTimeout', 'bindings', `
  const {computed, reactive, watch} = bindings;
  const useDiyStore = () => bindings.store, useAppStore = () => ({}), useSettingsStore = () => ({}), applyThemeColor = () => {};
  const Brush={}, Sunny={}, Moon={}, Check={}, MagicStick={}, InfoFilled={}, Grid={}, Menu={}, Expand={}, Setting={}, UiDensitySelect={};
  const {hasInstalledUserPreference, normalizeUserNavigationLayout, normalizeUserMenuChildExpandMode, resolveUserThemeColor} = preferences;
  ${script}
  return component;
`);
function instance(run = async () => ({Code: 1})) {
  const timers = new Map(), calls = [], errors = []; let timerId = 0;
  const store = reactive({user: {Id: 'own-user', NavigationLayout: 'Top', MenuChildExpandMode: 'System', ThemeColor: '#2563EB'}, Token:'fixture-session-a',
    get GetCurrentUser() {return this.user;}, setCurrentUser(value) {this.user = value;},setThemeColor(value){this.themeColor=value;}});
  let storedToken='fixture-session-a';
  const identity = {api: 'https://fixture.example', tenant: 'fixture'};
  Object.defineProperty(identity,'token',{get:()=>storedToken,set:value=>{storedToken=value;store.Token=value;}});
  const common = {GetApiBase: () => identity.api, GetOsClient: () => identity.tenant, getToken: () => identity.token,
    DecodeJwtPayload(token) {try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{return null;}},
    ApiEngine: {async Run(key, patch) {calls.push({key, patch: {...patch}}); return await run(patch);}}, Tips(message) {errors.push(message);}};
  const component = componentFactory(common, preferences, getUserVisualPreferenceSaveSession,
    callback => {timers.set(++timerId, callback); return timerId;}, id => timers.delete(id), {computed,reactive,watch,store});
  const mount = () => {
    const current = {diyStore: store};
    const setup = component.setup();
    Object.defineProperty(current, 'CurrentUser', {get: () => store.user});
    Object.defineProperty(current, 'preferenceSaveSession', {get: () => setup.preferenceSaveSession.value});
    for (const [key, value] of Object.entries(component.computed)) if (typeof value === 'object')
      Object.defineProperty(current, key, {get: value.get.bind(current), set: value.set.bind(current)});
    for (const [key, value] of Object.entries(component.methods)) current[key] = value.bind(current);
    return current;
  };
  const current = mount();
  const settle = async () => {for (let n = 0; n < 12; n++) await Promise.resolve();};
  return {current, calls, errors, timers, settle, mount, identity, unmount: (target = current) => component.beforeUnmount.call(target), async advance() {for (const [id, callback] of [...timers]) {timers.delete(id); callback();} await settle();}};
}
for (const layout of ['Side', 'Top', 'TopSide']) {
  test(`${layout} pending account preference survives actual component beforeUnmount`, async () => {
    const fixture = instance(); fixture.current.changeNavigationLayout(layout);
    fixture.unmount(); await fixture.settle(); await fixture.advance();
    assert.equal(fixture.calls.length, 1, 'a navbar remount must persist its pending selection exactly once');
    assert.deepEqual(fixture.calls[0], {key: 'platform-user-update-preferences', patch: {NavigationLayout: layout}});
    assert.equal(fixture.current.preferenceSaveState, 'saved');
  });
}
test('rapid layout changes coalesce the last selection before remount without duplicate writes', async () => {
  const fixture = instance();
  for (const layout of ['Side', 'Top', 'TopSide']) fixture.current.changeNavigationLayout(layout);
  fixture.current.changeMenuChildExpandMode('Right');
  fixture.unmount(); fixture.unmount(); await fixture.settle(); await fixture.advance();
  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(fixture.calls[0].patch, {NavigationLayout: 'TopSide', MenuChildExpandMode: 'Right'});
});
test('an in-flight save and the final queued preference complete without replaying the first patch', async () => {
  let release; const fixture = instance(async () => await new Promise(resolve => {release = () => resolve({Code: 1});}));
  fixture.current.saveInstalledVisualPreferences({ThemeColor: '#22C55E'}); await fixture.advance();
  fixture.current.changeNavigationLayout('Side'); fixture.current.changeNavigationLayout('TopSide'); fixture.unmount();
  assert.equal(fixture.calls.length, 1); release(); await fixture.settle(); await fixture.advance();
  assert.equal(fixture.calls.length, 2); assert.deepEqual(fixture.calls.map(call => call.patch), [{ThemeColor: '#22C55E'}, {NavigationLayout: 'TopSide'}]);
  release(); await fixture.settle(); await fixture.advance(); assert.equal(fixture.calls.length, 2);
});
test('a failed final save retains retry data and reports failure instead of claiming persistence', async () => {
  const fixture = instance(async () => ({Code: 0, Msg: 'fixture authorization denied'}));
  fixture.current.changeNavigationLayout('TopSide'); fixture.unmount(); await fixture.settle();
  assert.equal(fixture.calls.length, 1); assert.equal(fixture.current.preferenceSaveState, 'error');
  assert.deepEqual(fixture.current.pendingPreferencePatch, {NavigationLayout: 'TopSide'}); assert.equal(fixture.errors.length, 1);
});
test('unmount with no installed pending preference cannot issue an empty or foreign update', async () => {
  const fixture = instance(); delete fixture.current.diyStore.user.NavigationLayout;
  fixture.current.changeNavigationLayout('TopSide'); fixture.unmount(); await fixture.settle(); await fixture.advance();
  assert.deepEqual(fixture.calls, []);
});
test('a different logged-in account cannot inherit the unmounted previous account pending write', async () => {
  const fixture = instance(); fixture.current.changeNavigationLayout('TopSide');
  fixture.current.diyStore.user = {...fixture.current.diyStore.user, Id: 'another-user'};
  fixture.unmount(); await fixture.settle(); await fixture.advance(); assert.deepEqual(fixture.calls, []);
});
test('anonymous remnants cannot queue a server preference write', async () => {
  const fixture = instance(); delete fixture.current.diyStore.user.Id;
  fixture.current.changeNavigationLayout('TopSide'); await fixture.advance(); assert.deepEqual(fixture.calls, []);
});
test('the new navbar inherits an unmounted failure and can retry the actual pending save', async () => {
  let release, attempt = 0;
  const fixture = instance(async () => ++attempt === 1 ? await new Promise(resolve => {release = resolve;}) : {Code: 1});
  fixture.current.changeNavigationLayout('TopSide'); fixture.unmount();
  const next = fixture.mount(); assert.equal(next.preferenceSaveState, 'saving');
  release({Code: 0, Msg: 'fixture network failure'}); await fixture.settle();
  assert.equal(next.preferenceSaveState, 'error'); assert.equal(next.preferenceSaveError, 'fixture network failure');
  assert.deepEqual(next.pendingPreferencePatch, {NavigationLayout: 'TopSide'});
  next.retryVisualPreferences(); await fixture.settle();
  assert.equal(next.preferenceSaveState, 'saved'); assert.equal(fixture.calls.length, 2);
  assert.deepEqual(fixture.calls.map(call => call.patch), [{NavigationLayout: 'TopSide'}, {NavigationLayout: 'TopSide'}]);
});
for (const boundary of ['account', 'tenant', 'authorization', 'API server']) test(`a late old ${boundary} failure never merges into the new actor queue`, async () => {
  let release, attempt = 0;
  const fixture = instance(async () => ++attempt === 1 ? await new Promise(resolve => {release = resolve;}) : {Code: 1});
  fixture.current.saveInstalledVisualPreferences({ThemeColor: '#22C55E'}); await fixture.advance();
  const oldSession = fixture.current.preferenceSaveSession;
  if (boundary === 'account') fixture.current.diyStore.user = {...fixture.current.CurrentUser, Id: 'new-user'};
  if (boundary === 'tenant') fixture.identity.tenant = 'new-tenant';
  if (boundary === 'authorization') fixture.identity.token = 'new-login-session';
  if (boundary === 'API server') fixture.identity.api = 'https://another-fixture.example';
  const next = fixture.mount(); next.changeNavigationLayout('Side');
  release({Code: 0, Msg: 'old session rejected'}); await fixture.settle();
  assert.notEqual(next.preferenceSaveSession, oldSession);
  assert.deepEqual(next.pendingPreferencePatch, {NavigationLayout: 'Side'});
  assert.equal(next.preferenceSaveState, 'pending'); assert.equal(fixture.errors.length, 0);
  await fixture.advance(); assert.deepEqual(fixture.calls.map(call => call.patch), [{ThemeColor: '#22C55E'}, {NavigationLayout: 'Side'}]);
  assert.equal(next.preferenceSaveState, 'saved');
});
test('a late old success cannot replace the latest queued choice or another logged-in user projection', async () => {
  let release; const fixture = instance(async () => await new Promise(resolve => {release = resolve;}));
  fixture.current.changeNavigationLayout('TopSide'); await fixture.advance();
  fixture.current.changeNavigationLayout('Side');
  release({Code: 1, Data: {Id: 'own-user', NavigationLayout: 'TopSide'}}); await fixture.settle();
  assert.equal(fixture.current.CurrentUser.NavigationLayout, 'Side');
  await fixture.advance(); fixture.current.diyStore.user = {Id: 'new-user', NavigationLayout: 'Top'};
  release({Code: 1, Data: {Id: 'own-user', NavigationLayout: 'Side'}}); await fixture.settle();
  assert.deepEqual(fixture.current.CurrentUser, {Id: 'new-user', NavigationLayout: 'Top'});
});
const sessionToken = (session, issue) => 'fixture.' + Buffer.from(JSON.stringify({UserId:'own-user',OsClient:'fixture',MicroiSessionId:session,jti:issue})).toString('base64url') + '.fixture';
test('real Vue computed changes on standard Pinia token updates even when its localStorage reader is non-reactive', () => {
  const fixture=instance();fixture.identity.token=sessionToken('first-login','first');
  const previous=fixture.current.preferenceSaveSession;
  fixture.identity.token=sessionToken('next-login','next');
  assert.notEqual(fixture.current.preferenceSaveSession,previous,'A new login cannot reuse the cached previous session');
});
test('standard renewal preserves the same login session and completes its final pending preference', async () => {
  let release;const fixture=instance(async()=>await new Promise(resolve=>{release=resolve;}));
  fixture.identity.token=sessionToken('same-login','old-issued');const before=fixture.current.preferenceSaveSession;
  fixture.current.saveInstalledVisualPreferences({ThemeColor:'#22C55E'});await fixture.advance();
  fixture.current.changeNavigationLayout('TopSide');
  fixture.identity.token=sessionToken('same-login','renewed-issued');
  assert.equal(fixture.current.preferenceSaveSession,before,'A legitimate RotateFromToken renewal retains MicroiSessionId');
  fixture.identity.token=sessionToken('same-login','renewed-again');
  assert.equal(fixture.current.preferenceSaveSession,before,'Consecutive renewals retain the same final pending queue');
  fixture.unmount();release({Code:1});await fixture.settle();await fixture.advance();
  assert.deepEqual(fixture.calls.map(call=>call.patch),[{ThemeColor:'#22C55E'},{NavigationLayout:'TopSide'}]);
  release({Code:1});await fixture.settle();assert.equal(fixture.current.preferenceSaveState,'saved');
});
for (const status of ['success','failure']) test(`a previous login's late ${status} cannot alter the same user's new login choice`,async()=>{
  let release,attempt=0;const fixture=instance(async()=>++attempt===1?await new Promise(resolve=>{release=resolve;}):{Code:1});
  fixture.identity.token=sessionToken('old-login','old');fixture.current.saveInstalledVisualPreferences({ThemeColor:'#22C55E'});await fixture.advance();
  fixture.identity.token=sessionToken('new-login','new');const next=fixture.mount();next.changeNavigationLayout('Side');
  release(status==='success'?{Code:1,Data:{Id:'own-user',NavigationLayout:'TopSide'}}:{Code:0,Msg:'old login rejected'});await fixture.settle();
  assert.deepEqual(next.pendingPreferencePatch,{NavigationLayout:'Side'});assert.equal(next.CurrentUser.NavigationLayout,'Side');assert.equal(next.preferenceSaveState,'pending');
  await fixture.advance();assert.deepEqual(fixture.calls.map(call=>call.patch),[{ThemeColor:'#22C55E'},{NavigationLayout:'Side'}]);assert.equal(next.preferenceSaveState,'saved');
});
for (const claims of [{UserId:'own-user',OsClient:'fixture'}, {UserId:'different-user',OsClient:'fixture',MicroiSessionId:'shared'}, {UserId:'own-user',OsClient:'different-tenant',MicroiSessionId:'shared'}])
  test(`missing or mismatched standard session claims keep exact-token isolation (${JSON.stringify(claims)})`,()=>{
    const fixture=instance(),token=issue=>'fixture.'+Buffer.from(JSON.stringify({...claims,jti:issue})).toString('base64url')+'.fixture';
    fixture.identity.token=token('first');const before=fixture.current.preferenceSaveSession;
    fixture.identity.token=token('second');assert.notEqual(fixture.current.preferenceSaveSession,before,'Unmatched claims must not merge separate tokens into a trusted session');
  });
