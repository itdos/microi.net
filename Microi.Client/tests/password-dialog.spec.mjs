import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { platformServiceSourcePath } from './helpers/platform-service-source.mjs';

const source = readFileSync(platformServiceSourcePath('src/PersonalSettings.vue'), 'utf8');
const changePassword = source.slice(source.indexOf('async function changePassword()'), source.indexOf('\nasync function addPasskey()'));
function fixture(overrides = {}) {
    const calls = [], notices = [];
    const state = {
        busy:{ value:'' }, password:{ old:'old-password', next:'new-password', confirm:'new-password', totpCode:'' },
        user:{ value:{ Id:'current-user', Account:'current-account' } },
        capabilities:{ value:{} }, context:{ osClient:'current-tenant' },
        utf8Base64:value => Buffer.from(value).toString('base64'),
        passwordActionHash:async (id, value) => `${id}:${value}`,
        showNotice:(...args) => notices.push(args),
        client:{ post:async (url, model) => { calls.push({url, model}); return {Code:1}; } },
        ...overrides
    };
    state.clearPasswordInputs = () => { state.password.old = ''; state.password.next = ''; state.password.confirm = ''; state.password.totpCode = ''; };
    vm.createContext(state);
    const run = vm.runInContext(`(${changePassword})`, state);
    return {state, calls, notices, run};
}

test('password dialog reuses the canonical personal settings route and isolates password-only presentation', () => {
    const navbar = readFileSync(new URL('../src/layout/components/Navbar.vue', import.meta.url), 'utf8');
    assert.match(navbar, /@click="OpenChangePassword"/);
    const avatar = navbar.slice(navbar.indexOf('<el-dropdown class="avatar-container'), navbar.indexOf('<!-- 遮罩层 -->'));
    assert.match(avatar, /OpenPersonalSettings[\s\S]*?OpenChangePassword[\s\S]*?@click="logout"/);
    assert.match(navbar, /ComponentName="MicroAppDialog"/);
    assert.match(navbar, /AppKey: 'microi-platform-service'.*Action: 'ChangePassword'/);
    assert.match(source, /context\.dialogData\?\.Action === 'ChangePassword'/);
    assert.match(source, /onBeforeUnmount\(clearPasswordInputs\)/);
});

test('incomplete, short, mismatched and duplicate password submissions do not call the server', async () => {
    for (const password of [{old:'',next:'abcdef',confirm:'abcdef'}, {old:'old',next:'abc',confirm:'abc'}, {old:'old',next:'abcdef',confirm:'different'}]) {
        const f = fixture({password});await f.run();assert.equal(f.calls.length,0);assert.equal(f.notices.length,1);
    }
    const f = fixture({busy:{value:'password'}});await f.run();assert.equal(f.calls.length,0);
});

test('password change uses the authoritative loaded user and clears secrets after success', async () => {
    const f = fixture();await f.run();
    assert.equal(f.calls[0].url,'/api/SysUser/UptSysUser');
    assert.equal(f.calls[0].model.Id,'current-user');
    assert.equal(f.calls[0].model.Pwd,Buffer.from('old-password').toString('base64'));
    assert.equal(f.calls[0].model.NewPwd,Buffer.from('new-password').toString('base64'));
    assert.equal(f.state.password.old,'');assert.equal(f.state.password.next,'');assert.equal(f.state.busy.value,'');
});

test('enrolled strong factor obtains a password-bound ticket and failed verification prevents the write', async () => {
    for (const code of [1,0]) {
        let challenge;
        const f = fixture({capabilities:{value:{Enabled:true,PasswordChangeStepUp:true,HasStepUpPasskey:true}},verifyPasskey:async (_, data) => { challenge=data;return {Code:code,Data:{Ticket:'one-time-ticket'},Msg:'verification denied'}; }});
        await f.run();assert.equal(challenge.purpose,'ChangePassword');assert.equal(challenge.osClient,'current-tenant');
        assert.equal(challenge.actionHash,`current-user:${Buffer.from('new-password').toString('base64')}`);
        assert.equal(f.calls.length,code===1?1:0);
        if(code===1)assert.equal(f.calls[0].model._IdentityVerificationTicket,'one-time-ticket');
        else assert.equal(f.state.password.old,'old-password');
        assert.equal(f.state.busy.value,'');
    }
});
