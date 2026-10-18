import assert from 'node:assert/strict';
import test from 'node:test';
import { clampPanelWidth, normalizePanelWidth, resolvePanelCollapsed, createPanelPreferenceClient } from '../src/utils/panel-layout-preferences.js';

function fixture(run = async () => ({ Code:1 })) {
    let identity = { UserId:'one', OsClient:'tenant', MicroiSessionId:'session-1' }, token = 'token-1';
    const calls = [], warnings = [];
    const store = { GetCurrentUser:{ Id:'one', SidebarWidth:null, RoleTreeWidth:null, SidebarCollapsed:null, RoleTreeCollapsed:null }, setCurrentUser(user) { this.GetCurrentUser = user; } };
    const client = createPanelPreferenceClient({ store, getToken:() => token, decodeToken:() => identity, getApiBase:() => 'https://api.test', getOsClient:() => 'tenant', run:async (key, patch) => { calls.push({ key, patch }); return run(patch); }, notify:message => warnings.push(message) });
    const flush = () => { clearTimeout(client.activeSession().preferenceSaveTimer); return client.flush(); };
    return { client, store, calls, warnings, flush, identity(value) { identity = value; token += 'x'; }, dispose() { clearTimeout(client.activeSession().preferenceSaveTimer); } };
}
test('宽度容错、窄视口裁剪与收起状态保持独立语义', () => {
    assert.equal(normalizePanelWidth(null),240); assert.equal(normalizePanelWidth('320px'),320);
    assert.equal(normalizePanelWidth(999),600); assert.equal(normalizePanelWidth(-1),160);
    assert.equal(normalizePanelWidth('calc(100vw)'),240); assert.equal(clampPanelWidth(600,900),420);
    assert.equal(clampPanelWidth(300,400),0); assert.equal(normalizePanelWidth(600),600);
    assert.equal(resolvePanelCollapsed(null),false); assert.equal(resolvePanelCollapsed('0',true),false); assert.equal(resolvePanelCollapsed(1),true);
});
test('保存只发已安装四字段且固定调用官方偏好接口', async () => {
    const f = fixture();
    try { f.client.save({ SidebarWidth:320, RoleTreeCollapsed:1, Id:'other', Account:'unsafe' }); await f.flush();
        assert.deepEqual(f.calls,[{ key:'platform-user-update-preferences',patch:{ SidebarWidth:320,RoleTreeCollapsed:1 } }]);
        assert.equal(f.store.GetCurrentUser.Id,'one');
    } finally { f.dispose(); }
});
test('旧租户未安装字段不假装服务器已保存', () => {
    const f = fixture(); try { f.store.GetCurrentUser={ Id:'one' }; assert.equal(f.client.save({ SidebarWidth:300 }),false); assert.equal(f.calls.length,0); } finally { f.dispose(); }
});
test('在途旧响应不能覆盖后续拖拽最后选择', async () => {
    let complete; const f = fixture(() => new Promise(resolve => { complete = resolve; }));
    try { f.client.save({ SidebarWidth:280 }); const first = f.flush(); f.client.save({ SidebarWidth:360 });
        complete({ Code:1,Data:{ Id:'one',SidebarWidth:280 } }); await first;
        assert.equal(f.store.GetCurrentUser.SidebarWidth,360);
        assert.equal(f.client.activeSession().pendingPreferencePatch.SidebarWidth,360);
    } finally { f.dispose(); }
});
test('失败保留重试数据和可见错误，成功后准确清除', async () => {
    let fail = true; const f = fixture(async () => fail ? { Code:0,Msg:'offline' } : { Code:1 });
    try { f.client.save({ RoleTreeWidth:304 }); await f.flush(); assert.equal(f.client.activeSession().preferenceSaveState,'error'); assert.equal(f.warnings.length,1);
        assert.deepEqual(f.client.activeSession().pendingPreferencePatch,{ RoleTreeWidth:304 }); fail=false; await f.flush(); assert.equal(f.client.activeSession().preferenceSaveState,'saved');
    } finally { f.dispose(); }
});
test('标准续签复用原队列，新登录和换账号隔离旧响应', async () => {
    let complete; const f = fixture(() => new Promise(resolve => { complete=resolve; }));
    try { f.client.save({ SidebarWidth:288 }); const original=f.client.activeSession(); f.identity({ UserId:'one',OsClient:'tenant',MicroiSessionId:'session-1' }); assert.equal(f.client.activeSession(),original);
        const pending=f.flush(); f.store.GetCurrentUser={ Id:'two',SidebarWidth:null }; f.identity({ UserId:'two',OsClient:'tenant',MicroiSessionId:'session-2' });
        complete({ Code:1,Data:{ Id:'one',SidebarWidth:288 } }); await pending; assert.equal(f.store.GetCurrentUser.Id,'two'); assert.equal(f.store.GetCurrentUser.SidebarWidth,null);
        assert.notEqual(f.client.activeSession(),original);
    } finally { f.dispose(); }
});
