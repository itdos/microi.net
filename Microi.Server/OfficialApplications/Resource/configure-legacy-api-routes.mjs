import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(root, '../../Microi.Core/ApiEngine/legacy-api-routes.json'), 'utf8'));
const packages = fs.readdirSync(root).filter(name => /^app\..*\.json$/.test(name));
const groups = new Map();
for (const route of catalog.Routes) {
  if (!groups.has(route.EngineKey)) groups.set(route.EngineKey, []);
  groups.get(route.EngineKey).push(route);
}
const found = new Set();
for (const name of packages) {
  const file = path.join(root, name);
  const model = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = false;
  for (const engine of model.SysApiEngines || []) {
    const routes = groups.get(engine.ApiEngineKey);
    if (!routes) continue;
    found.add(engine.ApiEngineKey);
    const before = JSON.stringify(engine);
    const aliases = new Map(String(engine.ApiRoutes || '').split(';').filter(Boolean).map(route => [route.toLowerCase(), route]));
    for (const route of routes) aliases.set(route.Path.toLowerCase(), route.Path);
    engine.ApiRoutes = [...aliases.values()].join(';');
    // 包内保留路径到动作的代码，使仅升级应用包的旧 API 节点也能正确接收旧客户端。
    // UserBehavior 的 Action 是业务信号，不能改成 Controller 方法名 Signal。
    if (engine.ApiEngineKey === 'platform-sys-user-session') {
      if (!engine.ApiV8Code.includes("diylogin:'Login'"))
        engine.ApiV8Code = engine.ApiV8Code.replace("login:'Login',", "login:'Login', diylogin:'Login',");
    } else if (engine.ApiEngineKey !== 'platform-user-behavior-signal') {
      const mapping = Object.fromEntries(routes.map(route => [route.Path.toLowerCase(), route.Action]));
      const guard = `/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */\n// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。\nvar legacyRouteActions = ${JSON.stringify(mapping, null, 2)};\nvar legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();\nif (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {\n  V8.Param.Action = legacyRouteActions[legacyRequestPath];\n}\n/* LEGACY_ROUTE_ACTIONS_V1:END */\n`;
      engine.ApiV8Code = engine.ApiV8Code.replace(/\/\* LEGACY_ROUTE_ACTIONS_V1:BEGIN \*\/[\s\S]*?\/\* LEGACY_ROUTE_ACTIONS_V1:END \*\/\n?/, '');
      const noticeEnd = engine.ApiV8Code.match(/^(?:\s*\/\*[\s\S]*?\*\/\s*)+/)?.[0].length || 0;
      engine.ApiV8Code = engine.ApiV8Code.slice(0, noticeEnd) + '\n\n' + guard + engine.ApiV8Code.slice(noticeEnd).replace(/^\s+/, '');
    }
    if (JSON.stringify(engine) !== before) changed = true;
    const source = path.join(root, engine.ApiEngineKey + '.js');
    if (fs.existsSync(source) && fs.readFileSync(source, 'utf8') !== engine.ApiV8Code)
      fs.writeFileSync(source, engine.ApiV8Code);
  }
  if (changed) fs.writeFileSync(file, JSON.stringify(model, null, 2) + '\n');
}
for (const key of groups.keys()) if (!found.has(key)) throw new Error(`历史接口缺少唯一官方包归属: ${key}`);
console.log(`历史路由已同步: ${catalog.Routes.length} 个地址，${groups.size} 个接口引擎。`);
