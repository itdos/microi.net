import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, nextTick } from 'vue';
import { createPinia, defineStore } from 'pinia';
import persistedstate from 'pinia-plugin-persistedstate';
import { installPickedPersistence } from '../src/pinia/picked-persistence.js';

function fixture(initial = null) {
    let reads = 0, writes = 0, raw = initial;
    const storage = { getItem: () => raw, setItem: (_key, value) => { writes++; raw = value; } };
    const pinia = createPinia();
    pinia.use(context => { if (!installPickedPersistence(context)) persistedstate(context); });
    createApp({}).use(pinia);
    const store = defineStore('diy', {
        state: () => ({ CurrentTime: 0, OsLoading: false, Token: 'token-a', ThemeClass: 'light',
            CurrentUser: { Id: 'u1', _RoleLimits: Array.from({ length: 2000 }, (_, index) => ({
                Id: index, get Permission() { reads++; return 'read'; }
            })) } }),
        persist: { key: 'microi.net', storage, pick: ['CurrentUser', 'Token', 'ThemeClass'],
            afterHydrate: ({ store }) => { if (store.ThemeClass === 'legacy') store.ThemeClass = 'light'; } }
    })(pinia);
    return { store, reset: () => { reads = 0; writes = 0; }, get reads() { return reads; }, get writes() { return writes; },
        get saved() { return raw ? JSON.parse(raw) : null; }, setRaw: value => { raw = value; },
        dispose: () => store.$dispose() };
}
async function settle() { await nextTick(); await Promise.resolve(); }

test('unpersisted clock and loading changes do not traverse or serialize permissions', async () => {
    const f = fixture(); await settle(); f.reset();
    f.store.CurrentTime++; f.store.OsLoading = true;
    await settle();
    assert.equal(f.reads, 0); assert.equal(f.writes, 0); f.dispose();
});

test('theme changes reuse serialized permissions while preserving the complete saved identity', async () => {
    const f = fixture(); await settle(); f.reset();
    f.store.ThemeClass = 'dark'; await settle();
    assert.equal(f.reads, 0); assert.equal(f.writes, 1);
    assert.equal(f.saved.CurrentUser._RoleLimits.length, 2000);
    assert.equal(f.saved.ThemeClass, 'dark'); assert.equal(f.saved.CurrentTime, undefined); f.dispose();
});

test('nested permission changes, identity replacement and logout are persisted', async () => {
    const f = fixture(); await settle(); f.reset();
    f.store.CurrentUser._RoleLimits[0].Id = 42; await settle();
    assert.equal(f.saved.CurrentUser._RoleLimits[0].Id, 42);
    f.store.$patch({ CurrentUser: { Id: 'u2', _RoleLimits: [{ Id: 'new' }] }, Token: 'token-b' }); await settle();
    assert.equal(f.saved.CurrentUser.Id, 'u2'); assert.equal(f.saved.Token, 'token-b');
    f.store.CurrentUser = {}; f.store.Token = ''; f.store.$persist();
    assert.deepEqual(f.saved.CurrentUser, {}); assert.equal(f.saved.Token, ''); f.dispose();
});

test('hydrate hooks, explicit refresh and disposal retain lifecycle behavior', async () => {
    const f = fixture(JSON.stringify({ Token: 'restored', CurrentUser: { Id: 'u9', _RoleLimits: [] }, ThemeClass: 'legacy', OsLoading: true }));
    assert.equal(f.store.Token, 'restored'); assert.equal(f.store.ThemeClass, 'light'); assert.equal(f.store.OsLoading, false);
    f.setRaw(JSON.stringify({ Token: 'next', CurrentUser: { Id: 'u10' }, ThemeClass: 'dark' }));
    f.store.$hydrate(); await settle(); assert.equal(f.store.CurrentUser.Id, 'u10');
    f.dispose(); f.reset(); f.store.Token = 'disposed'; await settle(); assert.equal(f.writes, 0);
});

test('unsupported persistence options fall back to the standard plugin', () => {
    assert.equal(installPickedPersistence({ store: { $id: 'another' }, options: { persist: true } }), false);
    assert.equal(installPickedPersistence({ store: { $id: 'diy' }, options: { persist: { pick: ['nested.value'] } } }), false);
});

test('failed serialization cannot mix an old identity with a new token and recovers after correction', async () => {
    const f = fixture(); f.store.$persist();
    const original = f.saved;
    const cycle = {}; cycle.self = cycle;
    f.store.CurrentUser = cycle; f.store.Token = 'new-token'; await settle();
    assert.deepEqual(f.saved, original);
    f.store.CurrentUser = { Id: 'recovered', _RoleLimits: [] }; await settle();
    assert.equal(f.saved.Token, 'new-token'); assert.equal(f.saved.CurrentUser.Id, 'recovered'); f.dispose();
});

test('manual persistence is immediate and malformed hydrate data preserves the current session', async () => {
    const f = fixture(); f.store.Token = 'immediate'; f.store.$persist();
    assert.equal(f.saved.Token, 'immediate');
    f.setRaw('{bad json'); f.store.$hydrate();
    assert.equal(f.store.Token, 'immediate');
    f.store.ThemeClass = 'dark'; await settle();
    assert.equal(f.saved.Token, 'immediate'); f.dispose();
});
