import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const page = JSON.parse(fs.readFileSync(path.join(directory, 'platform-home-page.json'), 'utf8'));
const packageModel = JSON.parse(fs.readFileSync(path.join(directory, 'app.microi.saas-engine.json'), 'utf8'));

function widgets(json) {
  return (json.wrapperList || []).flatMap(wrapper => wrapper.widgetList || []);
}

test('PAGE5 starts with the shared AI composer and contains the complete operational home sections', () => {
  assert.equal(page.Id, 'd50ea9ce-c4d1-445f-b1f6-1e456bd4cd90');
  assert.equal(page.Number, 'PAGE5');
  assert.equal(page.RoutePath, '/');
  assert.equal(page.JsonObj.formConfig.watermark, false);
  assert.equal(page.JsonObj.formConfig.watermarkStyle.content, '');
  const wrappers = page.JsonObj.wrapperList;
  assert.equal(wrappers[0].widgetList[0].type, 'aiengine');
  assert.equal(wrappers[0].wrapperOption.span, 24);
  assert.equal(wrappers[1].widgetList[0].type, 'homeoverview');
  assert.equal(wrappers[1].wrapperOption.span, 24);
  assert.deepEqual(
    widgets(page.JsonObj).map(widget => widget.type),
    ['aiengine', 'homeoverview', 'workcenter', 'diycalendar', 'diytable'],
  );
  const noticeWidget = widgets(page.JsonObj).find(widget => widget.type === 'diytable');
  const workCenterWidget = widgets(page.JsonObj).find(widget => widget.type === 'workcenter');
  const calendarWidget = widgets(page.JsonObj).find(widget => widget.type === 'diycalendar');
  assert.deepEqual(noticeWidget.referencePolicy, {
    onMissing: 'RemoveWidget',
    reason: '公告模块属于可选首页扩展；目标租户未安装公告表和菜单时移除本组件及空容器',
  });
  assert.equal(workCenterWidget.widgetParams[3].value, '01KX884VXENKCJQMMTYPS2PK63');
  assert.equal(workCenterWidget.widgetParams[4].value, 'a283360d-9f1f-43d3-9380-074d60b87375');
  assert.equal(calendarWidget.widgetParams[0].value, 'a283360d-9f1f-43d3-9380-074d60b87375');
  assert.doesNotMatch(JSON.stringify(page.JsonObj), /Microi吾码|吾码平台/);
});

test('SaaS package delivers PAGE5 by stable-id upsert and declares its client/runtime dependencies', () => {
  assert.equal(packageModel.PackageInfo.Version, 'v7.8.26');
  const dataSets = packageModel.DataSets.filter(item => (
    String(item.TableName || '').toLowerCase() === 'mic_page'
  ));
  assert.equal(dataSets.length, 1);
  assert.equal(dataSets[0].ConflictPolicy, 'UpsertById');
  assert.deepEqual(dataSets[0].ConflictFields, ['Id']);
  assert.equal(dataSets[0].Rows.length, 1);
  const row = dataSets[0].Rows[0];
  assert.equal(row.Id, page.Id);
  assert.equal(row.RoutePath, '/');
  assert.deepEqual(JSON.parse(row.JsonObj), page.JsonObj);
  for (const capability of [
    'ClientFeature:PageEngineHomeOverviewV1',
    'PageEngineWidget:homeoverview',
    'ApiEngine:platform-home-overview@v1.0.0',
    'PageEngineResource:PAGE5@v2.0.0',
    'Installer:AllRoleMenuReadGrantV1',
    'RoleEvent:RequiredHomeReadV1',
    'ClientFeature:PageEngineMenuScopedReadV1',
  ]) {
    assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(capability), capability);
  }

  const homeMenu = packageModel.SysMenus.find(item => item.Id === 'daa16941-afa8-4263-a77d-26a14b679bbd');
  assert.equal(homeMenu.Url, '/');
  assert.equal(homeMenu.DiyTableId, 'f41b3c12-3bab-412e-a891-22835e45d15a');
  assert.equal(homeMenu.ComponentPath, `/page-engine/renderer?Id=${page.Id}`);
  const calendarMenu = packageModel.SysMenus.find(item => item.Id === 'a283360d-9f1f-43d3-9380-074d60b87375');
  assert.equal(calendarMenu.DiyTableName, 'microi_calendar');
  assert.equal(calendarMenu.Display, 0);
  assert.equal(calendarMenu.AppDisplay, 0);

  assert.deepEqual(packageModel.ResourcePolicies.MenuReadGrants, [
    { MenuId: homeMenu.Id, RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Fail' },
    { MenuId: calendarMenu.Id, RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Fail' },
    { MenuId: '299b8094-7e9e-4862-8e3c-62fdc4cc8a09', RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Skip' },
    { MenuId: '01KX884VMCV672GN43Z5RCT84X', RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Skip' },
    { MenuId: '01KX884VXENKCJQMMTYPS2PK63', RoleSelector: 'AllActiveRoles', Permissions: ['Read'], OnMissing: 'Skip' },
  ]);
  const roleTable = packageModel.DiyTables.find(item => item.Name === 'sys_role');
  assert.match(roleTable.SubmitBeforeServerV8, /ROLE_REQUIRED_HOME_READ_V1/u);
  assert.match(roleTable.SubmitBeforeServerV8, /requiredHomeMenuIds/u);
  assert.match(roleTable.SubmitBeforeServerV8, /normalizedMenuLimits\.length > 0 \|\| mustLoadRequiredHomeMenus/u);
});
