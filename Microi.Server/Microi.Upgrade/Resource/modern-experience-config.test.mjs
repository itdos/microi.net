import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

async function readPackage(name) {
  return JSON.parse(await readFile(resolve(directory, name), 'utf8'));
}

test('系统设置通过 ViewSchema 使用通用表单工作台并保留经典列表', async () => {
  const packageModel = await readPackage('app.microi.saas-engine.json');
  const menu = packageModel.SysMenus.find(item => item.Id === 'ea6b79e8-2c6b-4d0f-9b6a-44d01a3479bf');
  const schema = JSON.parse(menu.ViewSchema);
  const view = schema.Views.find(item => item.Scene === 'List' && item.Device === 'PC');

  assert.equal(view.Layout.Preset, 'FormWorkbench');
  assert.deepEqual(view.Layout.Form, {
    Presentation: 'SettingsCenter',
    Mode: 'Edit',
    ShowClassicList: true,
    RecordSelector: {
      Display: 'Both',
      LabelFields: ['PeizhiMC', 'SysTitle', 'ApiBase'],
      Placeholder: '选择要维护的系统配置'
    }
  });
  assert.equal(menu.OpenType, 'Diy');
  assert.match(menu.PageBtns, /登录与身份/);
});

test('应用商城历史路由由内置微服务承载', async () => {
  const packageModel = await readPackage('app.microi.store.json');
  const menu = packageModel.SysMenus.find(item => item.Id === '61b7faee-35b2-4571-add2-5231a355f368');

  assert.equal(menu.Url, '/microi-store');
  assert.equal(menu.LegacyMenuUrl, '/microi-store');
  assert.equal(menu.OpenType, 'MicroService');
  assert.equal(menu.IsMicroiService, 1);
  assert.equal(menu.ComponentPath, '/micro-app/host');
  assert.equal(menu.MicroServiceKey, 'microi-platform-service');
  assert.equal(menu.MicroServiceRoutePath, '/marketplace');
});

test('平台微服务包包含商城路由', async () => {
  const packageModel = await readPackage('app.microi.saas-engine.json');
  const bundle = packageModel.ApplicationBundles.find(item => item.Application?.AppKey === 'microi-platform-service');

  assert.ok(bundle);
  assert.ok(bundle.Routes.some(route => route.RoutePath === '/marketplace'));
  assert.equal(bundle.VersionNo, 'v1.5.8');
  assert.equal(bundle.Application.CurrentVersion, 15);
});
