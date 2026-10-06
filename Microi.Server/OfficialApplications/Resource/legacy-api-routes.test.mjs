import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync(new URL('../../Microi.Core/ApiEngine/legacy-api-routes.json', import.meta.url), 'utf8'));
const engines = fs.readdirSync(new URL('.', import.meta.url)).filter(name => /^app\..*\.json$/.test(name))
  .flatMap(name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8')).SysApiEngines || []);
for (const route of catalog.Routes) {
  test(`历史地址 ${route.Path} 随唯一接口交付并固定原动作`, () => {
    const owners = engines.filter(engine => engine.ApiEngineKey === route.EngineKey);
    assert.ok(owners.length >= 1);
    // 独立应用和 SaaS 底包共享的 Platform 资源必须具有相同正文。
    for (const copy of owners) assert.equal(copy.ApiV8Code, owners[0].ApiV8Code);
    const engine = owners[0];
    assert.ok(String(engine.ApiRoutes || '').toLowerCase().split(';').includes(route.Path.toLowerCase()));
    const param = { _RequestPath: route.Path.toLowerCase() + '--OsClient--test--', _HttpMethod: 'POST', Action: 'forged-delete' };
    if (route.Fallback === 'UserBehavior') return;
    if (route.EngineKey === 'platform-sys-user-session') {
      let actual;
      new Function('V8', engine.ApiV8Code)({ Param: param, Method: { RunPlatformApiRuntime: p => (actual = p.Action, { Code: 1 }) } });
      assert.equal(actual, route.Action);
      return;
    }
    const guard = engine.ApiV8Code.match(/\/\* LEGACY_ROUTE_ACTIONS_V1:BEGIN \*\/([\s\S]*?)\/\* LEGACY_ROUTE_ACTIONS_V1:END \*\//);
    assert.ok(guard);
    new Function('V8', guard[1])({ Param: param });
    assert.equal(param.Action, route.Action);
    const modern = { _RequestPath: '/apiengine/' + route.EngineKey, Action: 'modern-action' };
    new Function('V8', guard[1])({ Param: modern });
    assert.equal(modern.Action, 'modern-action');
  });
}
