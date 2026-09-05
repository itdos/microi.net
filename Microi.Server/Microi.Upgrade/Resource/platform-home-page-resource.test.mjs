import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compareSemanticVersions } from './application-store-replica-sync.mjs';

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
  assert.deepEqual(noticeWidget.referencePolicy, {
    onMissing: 'RemoveWidget',
    reason: '公告模块属于可选首页扩展；目标租户未安装公告表和菜单时移除本组件及空容器',
  });
  assert.doesNotMatch(JSON.stringify(page.JsonObj), /Microi吾码|吾码平台/);
});

test('SaaS package delivers PAGE5 by stable-id upsert and declares its client/runtime dependencies', () => {
  // 首页合同允许后续 SaaS 包继续演进，不能把其它功能正常升版误判为首页回归。
  assert.ok(compareSemanticVersions(packageModel.PackageInfo.Version, 'v7.8.18') >= 0);
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
  ]) {
    assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(capability), capability);
  }
});
