import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  advanceOfficialPackageVersion,
  ensureMinimumPackageVersion,
  validateOfficialPackageChangeLog,
} from './resource-sync-core.mjs';

const resourceDirectory = dirname(fileURLToPath(import.meta.url));
const expectedPackageNames = [
  'app.microi.ai-engine.json',
  'app.microi.form-engine.json',
  'app.microi.message-notification.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.sso.json',
  'app.microi.store.json',
  'app.microi.sys-config.json',
  'app.microi.sys-log.json',
  'app.microi.sys_user.json',
];

function changeHistoryCoversVersion(changeHistory, version) {
  if (typeof changeHistory === 'string') {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^0-9A-Za-z.])${escapedVersion}(?=$|[^0-9A-Za-z.])`).test(changeHistory);
  }
  if (Array.isArray(changeHistory)) {
    return changeHistory.some(item => changeHistoryCoversVersion(item, version));
  }
  if (changeHistory && typeof changeHistory === 'object') {
    return Object.values(changeHistory).some(item => changeHistoryCoversVersion(item, version));
  }
  return false;
}

test('十个官方应用包的当前版本必须包含完整且一致的 ChangeLog', async t => {
  const actualPackageNames = (await readdir(resourceDirectory))
    .filter(name => /^app\.microi\..+\.json$/.test(name))
    .sort();
  assert.deepEqual(actualPackageNames, expectedPackageNames);

  for (const name of actualPackageNames) {
    await t.test(name, async () => {
      const content = await readFile(resolve(resourceDirectory, name), 'utf8');
      const packageModel = JSON.parse(content);
      const packageInfo = packageModel?.PackageInfo;
      const changeLog = packageInfo?.ChangeLog;

      assert.ok(changeLog && typeof changeLog === 'object' && !Array.isArray(changeLog),
        `${name}: PackageInfo.ChangeLog 必须是对象`);
      assert.equal(changeLog.Version, packageInfo.Version,
        `${name}: PackageInfo.ChangeLog.Version 必须精确等于 PackageInfo.Version`);
      for (const fieldName of ['Title', 'ChangeType', 'Content', 'ReleaseTime']) {
        assert.ok(typeof changeLog[fieldName] === 'string' && changeLog[fieldName].trim(),
          `${name}: PackageInfo.ChangeLog.${fieldName} 不能为空`);
      }
      assert.ok(changeHistoryCoversVersion(packageInfo.ChangeHistory, packageInfo.Version),
        `${name}: PackageInfo.ChangeHistory 必须覆盖当前版本 ${packageInfo.Version}`);
      assert.doesNotThrow(() => validateOfficialPackageChangeLog(name, content));
    });
  }
});

test('官方应用包发布门禁对缺失、错版、空字段和不一致历史失败关闭', () => {
  const validPackage = {
    PackageInfo: {
      Version: 'v1.2.3',
      ChangeLog: {
        Version: 'v1.2.3',
        Title: '标题',
        ChangeType: 'Feature',
        Content: '内容',
        ReleaseTime: '2026-08-25 18:00:00',
      },
      ChangeHistory: [{ Version: 'v1.2.3', Date: '2026-08-25', Description: '内容' }],
    },
  };
  const validate = model => validateOfficialPackageChangeLog(
    'app.microi.form-engine.json',
    JSON.stringify(model),
  );

  assert.doesNotThrow(() => validate(validPackage));
  assert.throws(() => validate({ PackageInfo: { Version: 'v1.2.3' } }), /ChangeLog 必须是对象/);
  assert.throws(() => validate({
    PackageInfo: { ...validPackage.PackageInfo, ChangeLog: { ...validPackage.PackageInfo.ChangeLog, Version: 'v1.2.2' } },
  }), /Version 必须精确等于/);
  assert.throws(() => validate({
    PackageInfo: { ...validPackage.PackageInfo, ChangeLog: { ...validPackage.PackageInfo.ChangeLog, Title: ' ' } },
  }), /Title 不能为空/);
  assert.throws(() => validate({
    PackageInfo: { ...validPackage.PackageInfo, ChangeHistory: [{ Version: 'v1.2.2' }] },
  }), /ChangeHistory 未覆盖当前版本/);
  assert.throws(() => validate({
    PackageInfo: {
      ...validPackage.PackageInfo,
      ChangeHistory: [{ Version: 'v1.2.3', Date: '2026-08-24', Description: '内容' }],
    },
  }), /当前版本日期或正文.*不一致/);
  assert.throws(() => validate({
    PackageInfo: {
      ...validPackage.PackageInfo,
      ChangeHistory: [{ Version: 'v1.2.3', Date: '2026-08-25', Description: '其它内容' }],
    },
  }), /当前版本日期或正文.*不一致/);
  assert.throws(() => validate({
    PackageInfo: {
      ...validPackage.PackageInfo,
      ChangeLog: { ...validPackage.PackageInfo.ChangeLog, ReleaseTime: '2026-08-25' },
    },
  }), /ReleaseTime 必须为 yyyy-MM-dd HH:mm:ss/);
  assert.doesNotThrow(() => validate({
    PackageInfo: {
      ...validPackage.PackageInfo,
      ChangeHistory: '2026-08-25 v1.2.3 内容\n',
    },
  }));
});

test('发布门禁拒绝历史数组被强转为占位字符串，即使当前版本说明完整', () => {
  const current = { Version: 'v1.2.3', Date: '2026-08-25', Description: '当前说明。' };
  const previous = [{ Version: 'v1.2.2', Date: '2026-08-24', Description: '必须保留的历史。' }];
  for (const history of [
    `2026-08-25 v1.2.3 当前说明。\n${String(previous)}`,
    [current, String(previous)],
    [current, { ...previous[0], Description: String(previous) }],
  ]) {
    assert.throws(() => validateOfficialPackageChangeLog('app.microi.sso.json', JSON.stringify({
      PackageInfo: {
        Version: current.Version,
        ChangeLog: { Version: current.Version, Title: '发布说明', ChangeType: 'Fix', Content: current.Description, ReleaseTime: '2026-08-25 12:00:00' },
        ChangeHistory: history,
      },
    })), /ChangeHistory.*对象转换占位符/);
  }
  const explanation = '修复旧历史被转换为 [object Object] 的问题，保留原始发布说明。';
  assert.doesNotThrow(() => validateOfficialPackageChangeLog('app.microi.sso.json', JSON.stringify({
    PackageInfo: {
      Version: current.Version,
      ChangeLog: { Version: current.Version, Title: '历史修复', ChangeType: 'Fix', Content: explanation, ReleaseTime: '2026-08-25 12:00:00' },
      ChangeHistory: [{ ...current, Description: explanation }, ...previous],
    },
  })));
});

test('官网三方同步自动提版时同步推进结构化日志和历史记录', () => {
  const stringHistory = {
    Version: 'v7.7.1',
    ChangeLog: {
      Version: 'v7.7.1',
      Title: '推荐应用字段',
      ChangeType: 'Feature',
      Content: '交付推荐应用字段。',
      ReleaseTime: '2026-08-27 15:50:00',
    },
    ChangeHistory: '2026-08-27 v7.7.1 交付推荐应用字段。\n',
  };
  assert.equal(
    advanceOfficialPackageVersion(stringHistory, 'v7.7.3', '2026-08-27 21:11:50'),
    'v7.7.3',
  );
  assert.equal(stringHistory.ChangeLog.Version, 'v7.7.3');
  assert.equal(stringHistory.ChangeLog.ReleaseTime, '2026-08-27 21:11:50');
  assert.match(stringHistory.ChangeHistory, /^2026-08-27 v7\.7\.3 交付推荐应用字段。/);
  assert.match(stringHistory.ChangeHistory, /v7\.7\.1/);

  const arrayHistory = {
    Version: 'v1.2.3',
    ChangeLog: {
      Version: 'v1.2.3',
      Title: '标题',
      ChangeType: 'Fix',
      Content: '修复内容。',
      ReleaseTime: '2026-08-26 10:00:00',
    },
    ChangeHistory: [{ Version: 'v1.2.3', Date: '2026-08-26', Description: '修复内容。' }],
  };
  advanceOfficialPackageVersion(arrayHistory, '1.2.4', '2026-08-27 21:11:50');
  assert.deepEqual(arrayHistory.ChangeHistory[0], {
    Version: 'v1.2.4',
    Date: '2026-08-27',
    Description: '修复内容。',
  });
  assert.equal(arrayHistory.ChangeHistory[1].Version, 'v1.2.3');
});

test('旧资源生成器的最低版本门禁只提升 Version 且不修改 ChangeLog', () => {
  const currentChangeLog = {
    Version: 'v7.6.1',
    Title: '标题',
    ChangeType: 'Feature',
    Content: '内容',
    ReleaseTime: '2026-08-25 16:00:00',
  };
  const current = { Version: 'v7.6.1', ChangeLog: { ...currentChangeLog } };
  assert.equal(ensureMinimumPackageVersion(current, 'v7.5.7'), 'v7.6.1');
  assert.deepEqual(current, { Version: 'v7.6.1', ChangeLog: currentChangeLog });

  const legacy = { Version: 'v7.5.6', ChangeLog: { ...currentChangeLog } };
  assert.equal(ensureMinimumPackageVersion(legacy, 'v7.5.7'), 'v7.5.7');
  assert.deepEqual(legacy.ChangeLog, currentChangeLog);
  assert.throws(
    () => ensureMinimumPackageVersion({ Version: 'future' }, 'v7.5.7'),
    /PackageInfo\.Version必须是 vX\.Y\.Z/,
  );
});
