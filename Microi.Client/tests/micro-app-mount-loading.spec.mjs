import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/views/micro-app/host.vue', import.meta.url), 'utf8');

function harness() {
    let now = 0;
    let pending;
    const context = vm.createContext({ Date: { now: () => now }, setTimeout: fn => { pending = fn; return 1; } });
    const method = name => {
        const body = source.match(new RegExp(`^        ${name}\\(([^\\n]*)\\) \\{([\\s\\S]*?)^        \\},`, 'm'));
        assert.ok(body, `actual host method ${name} must exist`);
        return vm.runInContext(`(function(${body[1]}) {${body[2]}})`, context);
    };
    const host = {
        resolveGeneration: 1, retryKey: 0, mountState: 'mounting', error: '',
        mountResourcesReady: false, recoveries: [], ready: 0, rendered: false,
        clearMountWatchdog() { pending = undefined; },
        hasRenderableMicroAppContent() { return this.rendered; },
        markMicroAppReady() { this.ready++; },
        recoverMountFailure(message, code) { this.recoveries.push({ message, code }); }
    };
    host.startMountWatchdog = method('startMountWatchdog').bind(host);
    return { host, method, tick(ms) { now = ms; const callback = pending; pending = undefined; callback?.(); } };
}

test('a real resource download beyond twelve seconds does not destroy a loading micro-app', () => {
    const h = harness();
    h.host.startMountWatchdog(1, 0);
    h.tick(17000);
    assert.deepEqual(h.host.recoveries, []);
    h.host.rendered = true;
    h.tick(18000);
    assert.equal(h.host.ready, 1);
});

test('beforemount starts the original twelve-second render deadline after resources arrive', () => {
    const h = harness();
    h.host.startMountWatchdog(1, 0);
    h.tick(47000);
    h.method('handleBeforeMount').call(h.host);
    h.tick(58999);
    assert.deepEqual(h.host.recoveries, []);
    h.tick(59001);
    assert.equal(h.host.recoveries.length, 1);
    assert.equal(h.host.recoveries[0].code, 'MICRO_APP_MOUNT_TIMEOUT');
});

test('a stalled download stays bounded and stale mount attempts cannot recover the active app', () => {
    const h = harness();
    h.host.startMountWatchdog(1, 0);
    h.tick(60001);
    assert.equal(h.host.recoveries.length, 1);
    const stale = harness();
    stale.host.startMountWatchdog(1, 0);
    stale.host.retryKey = 1;
    stale.tick(60001);
    assert.deepEqual(stale.host.recoveries, []);
});
